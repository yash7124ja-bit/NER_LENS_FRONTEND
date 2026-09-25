import { useEffect, useState } from "react";
import { request, type Session } from "./api";
import { cacheDriverMissions, cachedDriverMissions, effectiveDriverState, queueDriverAction, syncDriverActions } from "./driverQueue";
import type { CachedDriverMission, DriverAction } from "./offline";

export default function DriverMissions({ session, corridorId, authenticated }: {
  session: Session; corridorId: string; authenticated: boolean;
}) {
  const owner = session.user.actor_id;
  const [missions, setMissions] = useState<CachedDriverMission[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setMissions(await cachedDriverMissions(owner, corridorId));
    if (!authenticated || !navigator.onLine) return;
    try {
      await syncDriverActions(owner, corridorId);
      const result = await request<{ missions: Parameters<typeof cacheDriverMissions>[2] }>(
        `/v1/missions?corridor_id=${encodeURIComponent(corridorId)}`,
      );
      setMissions(await cacheDriverMissions(owner, corridorId, result.missions));
      setError("");
    } catch (cause) {
      setMissions(await cachedDriverMissions(owner, corridorId));
      setError(cause instanceof Error ? cause.message : "Mission sync failed; saved actions remain on this device.");
    }
  }

  useEffect(() => {
    void refresh();
    const onOnline = () => { void refresh(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [owner, corridorId, authenticated]);

  async function act(missionId: string, action: DriverAction) {
    setBusy(true); setError("");
    try {
      await queueDriverAction(owner, missionId, action);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the mission action.");
    } finally {
      setBusy(false);
    }
  }

  return <section id="driver-missions" className="card">
    <header className="card-hd"><div><p className="eyebrow">ASSIGNED DRIVER · OFFLINE TRIP</p><h2>My deliveries</h2><p>Actions saved offline remain pending until the server confirms them. A delivery declaration still needs separate dispatcher confirmation.</p></div></header>
    <div className="card-bd">
      {error && <p role="alert" className="notice error">{error}</p>}
      <button type="button" disabled={busy || !authenticated || !navigator.onLine} onClick={() => void refresh()}>Refresh assignments and send saved actions</button>
      {!missions.length && <p className="help">No assigned missions for this corridor are saved on this device. Connect and refresh, or ask a dispatcher to assign one.</p>}
      {missions.map(mission => {
        const state = effectiveDriverState(mission);
        const blocked = mission.pending.some(item => item.state === "conflict" || item.state === "reauth_required");
        const deadlinePassed = Date.now() >= Date.parse(mission.delivery_window_end);
        return <article className="mission-row" key={mission.key}>
          <div><span className="status-tag">{state.replaceAll("_", " ")}{mission.pending.length ? " · pending sync" : ""}</span>
            <h3>{mission.cargo_class}</h3><p>{mission.priority} priority · Due {new Date(mission.delivery_window_end).toLocaleString()}</p>
            <p>Receiving: {mission.receiving_facility || "not recorded"} · Vehicle: {mission.vehicle_id || "not assigned"}</p>
            <p className="help">Saved {new Date(mission.saved_at).toLocaleString()} · Offline information may be stale. Check current corridor decisions before travel.</p>
            {mission.pending.map(item => <p className="help" key={item.idempotency_key}>{item.action.replaceAll("-", " ")} · {item.state.replaceAll("_", " ")}</p>)}
            {blocked && <p className="notice error">A saved action needs review or sign-in before this mission can continue. Refresh online; ask dispatch if the assignment changed.</p>}
            {state === "delivered" && <p className="notice">Driver delivery declared; dispatcher confirmation is separate.</p>}
          </div>
          <div>{state === "planned" && <>
            <button type="button" disabled={busy || blocked || deadlinePassed} onClick={() => void act(mission.mission_id, "accept")}>Accept mission</button>
            <button type="button" disabled={busy || blocked} onClick={() => void act(mission.mission_id, "reject")}>Reject mission</button>
          </>}
          {state === "accepted" && <button type="button" disabled={busy || blocked || deadlinePassed} onClick={() => void act(mission.mission_id, "start")}>Start mission</button>}
          {state === "active" && <button type="button" disabled={busy || blocked} onClick={() => void act(mission.mission_id, "declare-delivery")}>Declare delivery</button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
