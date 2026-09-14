import { Dexie, type Table } from "dexie";
import { z } from "zod";
import type { Catalog, State, Session } from "./api.ts";

export const observationSchema = z.object({
  segment_id: z.string().min(1),
  observed_at: z.string().datetime({ offset: true }).refine(value => Date.parse(value) <= Date.now() + 300000, "Capture time cannot be in the future"),
  geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
  accuracy_m: z.number().finite().min(0).max(100000),
  status_claim: z.enum(["open", "restricted", "blocked", "closed", "unknown"]),
  condition_code: z.string().trim().min(1).max(100),
  note: z.string().trim().min(1).max(4000),
});
export type Observation = z.infer<typeof observationSchema>;
export type QueuedReport = {
  client_report_id: string; owner: string; client_sequence: number; device_id: string;
  observation: Observation; state: "saved_on_device" | "retry_pending" | "reauth_required" | "failed" | "conflict" | "accepted_for_review";
  attempts: number; message: string; canonical_id?: string;
};
export class ReportStore extends Dexie {
  reports!: Table<QueuedReport, string>;
  settings!: Table<{ key: string; value: string | number }, string>;
  contexts!: Table<OfflineContext, string>;
  constructor(name = "ner-lens-field-reports") {
    super(name);
    this.version(1).stores({ reports: "client_report_id, owner, state", settings: "key" });
    this.version(2).stores({ contexts: "key" });
  }
}
export const reportStore = new ReportStore();
export type OfflineContext = { key: string; profile: Pick<Session["user"], "actor_id" | "display_name" | "roles" | "jurisdiction_ids">; catalog: Catalog; state: State; saved_at: string };
export async function saveOfflineContext(session: Session, catalog: Catalog, state: State, db = reportStore) {
  const { actor_id, display_name, roles, jurisdiction_ids } = session.user;
  if (!catalog.corridors.some(corridor => corridor.corridor_id === state.corridor_id)) throw new Error("Snapshot does not belong to the loaded catalog");
  await db.contexts.put({ key: "last", profile: { actor_id, display_name, roles, jurisdiction_ids }, catalog, state, saved_at: new Date().toISOString() });
}
export async function loadOfflineContext(db = reportStore) { return db.contexts.get("last"); }
export async function clearOfflineContext(db = reportStore) { await db.contexts.clear(); }
export async function saveReport(owner: string, observation: Observation, db = reportStore) {
  if (!owner) throw new Error("Sign in before capturing a report");
  const validated = observationSchema.parse(observation);
  return db.transaction("rw", db.reports, db.settings, async () => {
    const device = String((await db.settings.get("device"))?.value ?? crypto.randomUUID());
    const sequence = Number((await db.settings.get("sequence"))?.value ?? 0) + 1;
    await db.settings.bulkPut([{ key: "device", value: device }, { key: "sequence", value: sequence }]);
    const report: QueuedReport = { client_report_id: crypto.randomUUID(), owner, client_sequence: sequence, device_id: device, observation: validated, state: "saved_on_device", attempts: 0, message: "Saved on this device; not submitted." };
    await db.reports.add(report);
    return report;
  });
}
export async function syncReports(owner: string, db = reportStore, send: typeof fetch = fetch) {
  // ponytail: sequential text-only queue; add media transfer when the protected upload contract exists.
  for (const row of await db.reports.where("owner").equals(owner).sortBy("client_sequence")) {
    if (["accepted_for_review", "failed", "conflict"].includes(row.state)) continue;
    await db.reports.update(row.client_report_id, { attempts: row.attempts + 1 });
    let response: Response;
    try {
      response = await send("/v1/field-reports", { method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "Idempotency-Key": row.client_report_id, "X-Ner-Lens-Actor": owner }, body: JSON.stringify({ ...row.observation, client_report_id: row.client_report_id, client_sequence: row.client_sequence, device_id: row.device_id, clock_offset_seconds: 0 }) });
    } catch {
      await db.reports.update(row.client_report_id, { state: "retry_pending", message: "Connection unavailable. Report retained for retry." });
      break;
    }
    if (response.status === 401 || response.status === 403) {
      await db.reports.update(row.client_report_id, { state: "reauth_required", message: "Sign in with the original account or contact your administrator. Report retained." });
      break;
    }
    if (!response.ok) {
      const state = response.status === 409 ? "conflict" : response.status >= 500 || response.status === 429 ? "retry_pending" : "failed";
      await db.reports.update(row.client_report_id, { state, message: `Server returned ${response.status}. Original report retained.` });
      if (state === "retry_pending") break;
      continue;
    }
    try {
      const ack = await response.json();
      if (ack.client_report_id !== row.client_report_id || typeof ack.field_report_id !== "string" || ack.sync_state !== "accepted_for_review") throw new Error("Invalid acknowledgement");
      await db.reports.update(row.client_report_id, { state: "accepted_for_review", canonical_id: ack.field_report_id, message: "Received for human review; this is not an operational road-status decision." });
    } catch {
      await db.reports.update(row.client_report_id, { state: "retry_pending", message: "Acknowledgement could not be verified. Same report ID will be retried." });
      break;
    }
  }
}

