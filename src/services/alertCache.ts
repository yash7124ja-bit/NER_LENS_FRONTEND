import type { CachedRouteAlert } from '../types';

export function reconcileAlerts(fetched: CachedRouteAlert[], cached: CachedRouteAlert[]): CachedRouteAlert[] {
  const pending = cached.filter(alert => alert.pending_decision);
  const fetchedIds = new Set(fetched.map(alert => alert.alert_id));
  return [
    ...fetched.map(alert => pending.find(saved => saved.alert_id === alert.alert_id) || alert),
    ...pending.filter(alert => !fetchedIds.has(alert.alert_id)),
  ];
}
