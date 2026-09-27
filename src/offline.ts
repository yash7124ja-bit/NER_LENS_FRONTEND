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
export type QueuedPhoto = { key: string; owner: string; reportId: string; slot: number;
  blob: Blob; sha256: string; state?: "saved_on_device" | "retry_pending" | "reauth_required" | "failed" | "conflict"; message?: string };
export type CachedRouteAlert = {
  alert_id: string; owner: string; mission_id: string; route_id: string; message: string;
  reason: string; created_at: string; expires_at: string; delivery_state: string;
  acknowledgment: { decision: string; acknowledged_at: string; selection_id: string | null } | null;
  vehicle_profile?: string | null; vehicle_entitlement?: string | null;
  retrieved_at?: string | null; uncertainty_score?: number | null; linked_segment_count?: number;
  pending_decision?: "accept" | "decline"; idempotency_key?: string;
  sync_state?: "saved_on_device" | "retry_pending" | "reauth_required" | "conflict";
};
export type DriverAction = "accept" | "reject" | "start" | "declare-delivery";
export type CachedDriverMission = {
  key: string; owner: string; mission_id: string; corridor_id: string; state: string;
  cargo_class: string; priority: string; delivery_window_end: string;
  receiving_facility: string | null; vehicle_id: string | null; saved_at: string; expires_at: string;
  pending: { action: DriverAction; idempotency_key: string; state: "saved_on_device" | "retry_pending" | "reauth_required" | "conflict" }[];
};
export class ReportStore extends Dexie {
  reports!: Table<QueuedReport, string>;
  settings!: Table<{ key: string; value: string | number }, string>;
  contexts!: Table<OfflineContext, string>;
  media!: Table<QueuedPhoto, string>;
  alerts!: Table<CachedRouteAlert, string>;
  missions!: Table<CachedDriverMission, string>;
  constructor(name = "ner-lens-field-reports") {
    super(name);
    this.version(1).stores({ reports: "client_report_id, owner, state", settings: "key" });
    this.version(2).stores({ contexts: "key" });
    this.version(3).stores({ media: "key, owner, reportId" });
    this.version(4).stores({ alerts: "alert_id, owner, mission_id" });
    this.version(5).stores({ missions: "key, owner, corridor_id" });
  }
}
export const reportStore = new ReportStore();
export type OfflineContext = { key: string; profile: Pick<Session["user"], "actor_id" | "display_name" | "roles" | "jurisdiction_ids">; catalog: Catalog; state: State; saved_at: string; expires_at: string };
export async function saveOfflineContext(session: Session, catalog: Catalog, state: State, db = reportStore) {
  const { actor_id, display_name, roles, jurisdiction_ids } = session.user;
  if (!catalog.corridors.some(corridor => corridor.corridor_id === state.corridor_id)) throw new Error("Snapshot does not belong to the loaded catalog");
  await db.contexts.put({ key: "last", profile: { actor_id, display_name, roles, jurisdiction_ids }, catalog, state, saved_at: new Date().toISOString(), expires_at: session.expires_at });
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
export async function savePhoto(owner: string, localReportId: string, slot: number, file: Blob, db = reportStore) {
  const report = await db.reports.get(localReportId);
  if (!report || report.owner !== owner) throw new Error("Report belongs to another account or is missing");
  if (!Number.isInteger(slot) || slot < 0 || slot > 3) throw new Error("Photo slot must be 1–4");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024)
    throw new Error("Choose a JPEG, PNG or WebP image up to 2 MB");
  const key = `${owner}:${localReportId}:${slot}`;
  if (await db.media.get(key)) throw new Error("This photo slot is already saved");
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
    byte => byte.toString(16).padStart(2, "0")).join("");
  await db.media.add({ key, owner, reportId: localReportId, slot, blob: file, sha256,
    state: "saved_on_device", message: "Saved on this device; not uploaded." });
}
export async function syncReports(owner: string, db = reportStore, send: typeof fetch = fetch) {
  // ponytail: sequential queue; raise concurrency only if field throughput requires it.
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

export async function syncPhotos(owner: string, db = reportStore, send: typeof fetch = fetch) {
  const reports = await db.reports.where("owner").equals(owner).toArray();
  for (const photo of await db.media.where("owner").equals(owner).toArray()) {
    if (photo.state === "failed" || photo.state === "conflict") continue;
    const report = reports.find(row => row.client_report_id === photo.reportId || row.canonical_id === photo.reportId);
    if (!report?.canonical_id || report.state !== "accepted_for_review") continue;
    let response: Response;
    try {
      response = await send(`/v1/field-reports/${report.canonical_id}/media/${photo.slot}`, {
        method: "PUT", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": photo.blob.type, "Idempotency-Key": photo.sha256,
          "X-Media-SHA256": photo.sha256, "X-Ner-Lens-Actor": owner }, body: photo.blob,
      });
    } catch {
      await db.media.update(photo.key, { state: "retry_pending", message: "Connection lost; photo retained." });
      break;
    }
    if (response.status === 401 || response.status === 403) {
      await db.media.update(photo.key, { state: "reauth_required", message: "Sign in as the original account; photo retained." });
      break;
    }
    if (!response.ok) {
      const state = response.status === 409 ? "conflict" : response.status >= 500 || response.status === 429 ? "retry_pending" : "failed";
      await db.media.update(photo.key, { state, message: `Upload returned ${response.status}; photo retained.` });
      if (state === "retry_pending") break;
      continue;
    }
    try {
      const ack = await response.json();
      if (ack.field_report_id !== report.canonical_id || ack.slot !== photo.slot || ack.sha256 !== photo.sha256 || ack.upload_state !== "received")
        throw new Error("Invalid photo acknowledgement");
      await db.media.delete(photo.key);
    } catch {
      await db.media.update(photo.key, { state: "retry_pending", message: "Acknowledgement uncertain; retry with the same checksum." });
      break;
    }
  }
}

