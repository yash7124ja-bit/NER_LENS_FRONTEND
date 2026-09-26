import { reportStore, type CachedRouteAlert, type ReportStore } from "./offline.ts";

export async function cachedRouteAlerts(owner: string, db: ReportStore = reportStore) {
  return (await db.alerts.where("owner").equals(owner).toArray())
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function cacheRouteAlerts(owner: string, received: Omit<CachedRouteAlert, "owner">[], db: ReportStore = reportStore) {
  if (!owner) throw new Error("Sign in before loading alerts");
  await db.transaction("rw", db.alerts, async () => {
    const seen = new Set<string>();
    for (const alert of received) {
      if (!alert.alert_id || !alert.mission_id || !alert.route_id || !alert.created_at || !alert.expires_at)
        throw new Error("Invalid route alert received");
      const old = await db.alerts.get(alert.alert_id);
      if (old && old.owner !== owner) throw new Error("Route alert belongs to another account");
      seen.add(alert.alert_id);
      await db.alerts.put({ ...alert, owner,
        ...(old?.pending_decision && !alert.acknowledgment ? {
          pending_decision: old.pending_decision, idempotency_key: old.idempotency_key,
          sync_state: old.sync_state,
        } : {}),
      });
    }
    for (const old of await db.alerts.where("owner").equals(owner).toArray()) {
      if (!seen.has(old.alert_id) && !old.pending_decision) await db.alerts.delete(old.alert_id);
    }
  });
  return cachedRouteAlerts(owner, db);
}

export async function queueRouteAlertDecision(owner: string, alertId: string, decision: "accept" | "decline", db: ReportStore = reportStore) {
  const alert = await db.alerts.get(alertId);
  if (!alert || alert.owner !== owner) throw new Error("Alert is unavailable to this account");
  if (alert.acknowledgment) throw new Error("Alert was already acknowledged");
  if (alert.pending_decision) {
    if (alert.pending_decision !== decision) throw new Error("A different decision is already queued");
    return alert;
  }
  if (decision === "accept" && Date.now() >= Date.parse(alert.expires_at))
    throw new Error("Candidate route expired; ask the dispatcher to compare again");
  const queued = { ...alert, pending_decision: decision, idempotency_key: crypto.randomUUID(),
    sync_state: "saved_on_device" as const };
  await db.alerts.put(queued);
  return queued;
}

export async function syncRouteAlertDecisions(owner: string, db: ReportStore = reportStore, send: typeof fetch = fetch) {
  for (const alert of await cachedRouteAlerts(owner, db)) {
    if (!alert.pending_decision || !alert.idempotency_key || alert.sync_state === "conflict") continue;
    let response: Response;
    try {
      response = await send(`/v1/alerts/${alert.alert_id}/acknowledge`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "Idempotency-Key": alert.idempotency_key },
        body: JSON.stringify({ decision: alert.pending_decision }), signal: AbortSignal.timeout(30000),
      });
    } catch {
      await db.alerts.update(alert.alert_id, { sync_state: "retry_pending" });
      break;
    }
    if (response.status === 401 || response.status === 403) {
      await db.alerts.update(alert.alert_id, { sync_state: "reauth_required" });
      break;
    }
    if (!response.ok) {
      await db.alerts.update(alert.alert_id, { sync_state: response.status === 409 || response.status === 422 ? "conflict" : "retry_pending" });
      if (response.status >= 500 || response.status === 429) break;
      continue;
    }
    try {
      const ack = await response.json();
      if (ack.alert_id !== alert.alert_id || ack.decision !== alert.pending_decision ||
          (ack.decision === "accept" && !ack.selection_id)) throw new Error("Invalid acknowledgment");
      await db.alerts.put({ ...alert, pending_decision: undefined, idempotency_key: undefined,
        sync_state: undefined,
        acknowledgment: { decision: ack.decision, selection_id: ack.selection_id,
          acknowledged_at: new Date().toISOString() } });
    } catch {
      await db.alerts.update(alert.alert_id, { sync_state: "retry_pending" });
      break;
    }
  }
}
