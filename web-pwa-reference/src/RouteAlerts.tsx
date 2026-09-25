import { useEffect, useState } from "react";
import { request, type Session } from "./api";
import { type CachedRouteAlert } from "./offline";
import { cacheRouteAlerts, cachedRouteAlerts, queueRouteAlertDecision, syncRouteAlertDecisions } from "./alertQueue";

export default function RouteAlerts({ session, authenticated }: { session: Session; authenticated: boolean }) {
  const owner = session.user.actor_id;
  const [alerts, setAlerts] = useState<CachedRouteAlert[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setAlerts(await cachedRouteAlerts(owner));
    if (!authenticated || !navigator.onLine) return;
    try {
      await syncRouteAlertDecisions(owner);
      const result = await request<{ alerts: Omit<CachedRouteAlert, "owner">[] }>("/v1/alerts");
      setAlerts(await cacheRouteAlerts(owner, result.alerts));
      setError("");
    } catch (cause) {
      setAlerts(await cachedRouteAlerts(owner));
      setError(cause instanceof Error ? cause.message : "Alert sync failed; saved decisions remain on this device.");
    }
  }

  useEffect(() => {
    void refresh();
    const onOnline = () => { void refresh(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [owner, authenticated]);

  async function decide(alertId: string, decision: "accept" | "decline") {
    setBusy(true); setError("");
    try {
      await queueRouteAlertDecision(owner, alertId, decision);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the alert decision.");
    } finally {
      setBusy(false);
    }
  }

  return <section id="route-alerts" className="card">
    <header className="card-hd"><div><p className="eyebrow">ASSIGNED DRIVER · IN-APP INBOX</p><h2>Route-change alerts</h2><p>English replay template. Assamese wording awaits native review. A candidate route is not road or vehicle clearance.</p></div></header>
    <div className="card-bd">
      {error && <p role="alert" className="notice error">{error}</p>}
      <button type="button" disabled={busy || !authenticated || !navigator.onLine} onClick={() => void refresh()}>Refresh alerts and send saved decisions</button>
      {alerts.length === 0 && <p className="help">No route-change alerts for this account are saved on this device.</p>}
      {alerts.map(alert => <article className="mission-row" key={alert.alert_id}>
        <div><h3>Mission {alert.mission_id}</h3><p>{alert.message}</p><p>Dispatcher reason: {alert.reason}</p><p>Candidate route {alert.route_id} · expires {new Date(alert.expires_at).toLocaleString()}</p>
          <p className="help">{alert.delivery_state.replaceAll("_", " ")} · {alert.acknowledgment ? `Driver ${alert.acknowledgment.decision === "accept" ? "accepted" : "declined"} this candidate` : alert.pending_decision ? `${alert.pending_decision} saved on device · ${alert.sync_state?.replaceAll("_", " ")}` : "Awaiting your decision"}</p>
          {alert.acknowledgment?.decision === "accept" && <p className="notice">The candidate replay baseline was selected after a fresh server check. Check current authority decisions before travel.</p>}
          {alert.sync_state === "conflict" && <p className="notice error">The server rejected this saved decision. Ask the dispatcher to reassess the route.</p>}
        </div>
        {!alert.acknowledgment && !alert.pending_decision && <div>
          <button type="button" disabled={busy || Date.now() >= Date.parse(alert.expires_at)} onClick={() => void decide(alert.alert_id, "accept")}>Acknowledge candidate</button>
          <button type="button" disabled={busy} onClick={() => void decide(alert.alert_id, "decline")}>Decline candidate</button>
        </div>}
      </article>)}
    </div>
  </section>;
}
