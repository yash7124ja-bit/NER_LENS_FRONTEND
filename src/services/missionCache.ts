import type { CachedMission } from '../types';

export function reconcileMissions(fetched: CachedMission[], cached: CachedMission[]): CachedMission[] {
  const pending = cached.filter(mission => mission.pending.length);
  const fetchedIds = new Set(fetched.map(mission => mission.mission_id));
  return [
    ...fetched.map(mission => {
      const saved = pending.find(item => item.mission_id === mission.mission_id);
      return saved ? { ...mission, state: saved.state, pending: saved.pending } : mission;
    }),
    ...pending.filter(mission => !fetchedIds.has(mission.mission_id)),
  ];
}
