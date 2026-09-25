import { reportStore, type CachedDriverMission, type DriverAction, type ReportStore } from "./offline.ts";

type MissionSnapshot = {
  mission_id: string; corridor_id: string; driver_actor_id: string | null; state: string;
  cargo_class: string; priority: string; delivery_window: { end: string };
  receiving_facility: string | null; vehicle_id: string | null;
};

const resultState: Record<DriverAction, string> = {
  accept: "accepted", reject: "rejected", start: "active", "declare-delivery": "delivered",
};
const requiredState: Record<DriverAction, string> = {
  accept: "planned", reject: "planned", start: "accepted", "declare-delivery": "active",
};
function actionPath(missionId: string, action: DriverAction) {
  const id = encodeURIComponent(missionId);
  switch (action) {
    case "accept": return `/v1/missions/${id}/accept`;
    case "reject": return `/v1/missions/${id}/reject`;
    case "start": return `/v1/missions/${id}/start`;
    case "declare-delivery": return `/v1/missions/${id}/declare-delivery`;
  }
}

export async function cachedDriverMissions(owner: string, corridorId: string, db: ReportStore = reportStore) {
  return (await db.missions.where("owner").equals(owner).toArray())
    .filter(mission => mission.corridor_id === corridorId)
    .sort((a, b) => a.delivery_window_end.localeCompare(b.delivery_window_end));
}

export async function cacheDriverMissions(owner: string, corridorId: string, received: MissionSnapshot[], db: ReportStore = reportStore) {
  if (!owner || !corridorId) throw new Error("Sign in and choose a corridor before loading missions");
  const seen = new Set<string>();
  for (const mission of received) {
    if (!mission.mission_id || mission.corridor_id !== corridorId || mission.driver_actor_id !== owner ||
      !mission.delivery_window?.end || !Number.isFinite(Date.parse(mission.delivery_window.end)) ||
      !mission.cargo_class || !mission.priority) throw new Error("Invalid assigned mission received");
    const key = `${owner}:${mission.mission_id}`;
    seen.add(key);
    const previous = await db.missions.get(key);
    await db.missions.put({ key, owner, mission_id: mission.mission_id, corridor_id: corridorId,
      state: mission.state, cargo_class: mission.cargo_class, priority: mission.priority,
      delivery_window_end: mission.delivery_window.end, receiving_facility: mission.receiving_facility,
      vehicle_id: mission.vehicle_id, saved_at: new Date().toISOString(), pending: previous?.pending ?? [] });
  }
  for (const stale of await cachedDriverMissions(owner, corridorId, db)) {
    if (!seen.has(stale.key) && !stale.pending.length) await db.missions.delete(stale.key);
  }
  return cachedDriverMissions(owner, corridorId, db);
}

export function effectiveDriverState(mission: CachedDriverMission) {
  return mission.pending.reduce((state, item) => resultState[item.action], mission.state);
}

export async function queueDriverAction(owner: string, missionId: string, action: DriverAction, db: ReportStore = reportStore) {
  const key = `${owner}:${missionId}`;
  return db.transaction("rw", db.missions, async () => {
    const mission = await db.missions.get(key);
    if (!mission || mission.owner !== owner) throw new Error("Mission is unavailable to this account");
    if (mission.pending.some(item => item.state === "conflict" || item.state === "reauth_required"))
      throw new Error("Resolve the saved mission action before adding another");
    if (effectiveDriverState(mission) !== requiredState[action])
      throw new Error("This action does not match the mission's current state");
    if ((action === "accept" || action === "start") && Date.now() >= Date.parse(mission.delivery_window_end))
      throw new Error("The delivery window has ended; refresh the mission");
    mission.pending.push({ action, idempotency_key: crypto.randomUUID(), state: "saved_on_device" });
    await db.missions.put(mission);
    return mission;
  });
}

export async function syncDriverActions(owner: string, corridorId: string, db: ReportStore = reportStore, send: typeof fetch = fetch) {
  for (const mission of await cachedDriverMissions(owner, corridorId, db)) {
    while (mission.pending.length) {
      const item = mission.pending[0];
      if (item.state === "conflict") break;
      let response: Response;
      try {
        response = await send(actionPath(mission.mission_id, item.action), {
          method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30000),
          headers: { "Idempotency-Key": item.idempotency_key },
        });
      } catch {
        item.state = "retry_pending";
        await db.missions.put(mission);
        return;
      }
      if (response.status === 401 || response.status === 403) {
        item.state = "reauth_required";
        await db.missions.put(mission);
        return;
      }
      if (!response.ok) {
        item.state = response.status >= 500 || response.status === 429 ? "retry_pending" : "conflict";
        await db.missions.put(mission);
        if (item.state === "retry_pending") return;
        break;
      }
      try {
        const ack = await response.json();
        if (ack.mission_id !== mission.mission_id || ack.state !== resultState[item.action] || !ack.request_id)
          throw new Error("Invalid mission acknowledgment");
        mission.state = ack.state;
        mission.pending.shift();
        await db.missions.put(mission);
      } catch {
        item.state = "retry_pending";
        await db.missions.put(mission);
        return;
      }
    }
  }
}
