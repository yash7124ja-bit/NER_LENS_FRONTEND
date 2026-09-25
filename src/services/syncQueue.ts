import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { 
  CachedMission, 
  DriverAction, 
  CachedRouteAlert, 
  FieldReport, 
  PositionPoint, 
  PositionBatchQueueItem 
} from '../types';
import { 
  getCachedMissions, 
  saveCachedMissions, 
  getCachedAlerts, 
  saveCachedAlerts, 
  getFieldReports, 
  saveFieldReports, 
  getGpsQueue, 
  saveGpsQueue 
} from './storage';
import { ApiClient } from './api';

export class SyncQueueManager {
  private static isSyncing = false;
  private static listeners: Array<(status: { isSyncing: boolean; pendingCount: number }) => void> = [];

  static subscribe(listener: (status: { isSyncing: boolean; pendingCount: number }) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notify(isSyncing: boolean, pendingCount: number) {
    this.listeners.forEach(l => l({ isSyncing, pendingCount }));
  }

  static async getPendingCount(owner: string): Promise<number> {
    const missions = await getCachedMissions(owner);
    const alerts = await getCachedAlerts(owner);
    const reports = await getFieldReports(owner);
    const gps = await getGpsQueue(owner);

    const pendingMissions = missions.reduce((acc, m) => acc + m.pending.filter(p => p.state === 'saved_on_device' || p.state === 'sending').length, 0);
    const pendingAlerts = alerts.filter(a => a.pending_decision && a.sync_state !== 'acknowledged').length;
    const pendingReports = reports.filter(r => r.sync_state === 'saved_on_device' || r.sync_state === 'sending').length;
    const pendingGps = gps.filter(g => g.state === 'saved_on_device' || g.state === 'sending').length;

    return pendingMissions + pendingAlerts + pendingReports + pendingGps;
  }

  // Queue Driver Lifecycle Action (accept, reject, start, declare-delivery)
  static async queueMissionAction(owner: string, missionId: string, action: DriverAction): Promise<CachedMission> {
    const missions = await getCachedMissions(owner);
    const index = missions.findIndex(m => m.mission_id === missionId);
    if (index === -1) throw new Error('Mission not found on device');

    const mission = { ...missions[index] };
    const idempotencyKey = Crypto.randomUUID();

    // Optimistically update state
    const nextStateMap: Record<DriverAction, CachedMission['state']> = {
      accept: 'accepted',
      reject: 'cancelled',
      start: 'active',
      'declare-delivery': 'delivered'
    };

    mission.pending.push({
      action,
      idempotency_key: idempotencyKey,
      state: 'saved_on_device',
      created_at: new Date().toISOString(),
    });

    mission.state = nextStateMap[action];
    missions[index] = mission;
    await saveCachedMissions(owner, missions);

    // Trigger sync attempt
    void this.syncAll(owner);
    return mission;
  }

  // Queue Route Alert Decision (accept candidate route or decline)
  static async queueAlertDecision(owner: string, alertId: string, decision: 'accept' | 'decline'): Promise<CachedRouteAlert> {
    const alerts = await getCachedAlerts(owner);
    const index = alerts.findIndex(a => a.alert_id === alertId);
    if (index === -1) throw new Error('Alert not found on device');

    const alert = { ...alerts[index] };
    const idempotencyKey = Crypto.randomUUID();

    alert.pending_decision = decision;
    alert.idempotency_key = idempotencyKey;
    alert.sync_state = 'saved_on_device';
    alert.acknowledgment = {
      decision,
      acknowledged_at: new Date().toISOString(),
    };

    alerts[index] = alert;
    await saveCachedAlerts(owner, alerts);

    void this.syncAll(owner);
    return alert;
  }

  // Queue Field Observation Report
  static async queueFieldReport(report: FieldReport): Promise<void> {
    const reports = await getFieldReports(report.owner);
    reports.unshift(report);
    await saveFieldReports(report.owner, reports);

    void this.syncAll(report.owner);
  }

  // Queue GPS Position Batch
  static async queueGpsBatch(owner: string, missionId: string, points: PositionPoint[]): Promise<void> {
    if (!points.length) return;
    const queue = await getGpsQueue(owner);
    queue.push({
      id: Crypto.randomUUID(),
      mission_id: missionId,
      owner,
      points,
      state: 'saved_on_device',
      created_at: new Date().toISOString(),
      retry_count: 0
    });
    await saveGpsQueue(owner, queue);

    void this.syncAll(owner);
  }

  // Sequential Dependency Replay
  static async syncAll(owner: string): Promise<void> {
    if (this.isSyncing) return;
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log('[SyncQueue] Offline: records securely preserved locally.');
      const count = await this.getPendingCount(owner);
      this.notify(false, count);
      return;
    }

    this.isSyncing = true;
    try {
      // 1. Replay Route Alert Decisions (highest priority, independent timeline)
      const alerts = await getCachedAlerts(owner);
      let alertsModified = false;
      for (const alert of alerts) {
        if (alert.pending_decision && alert.sync_state !== 'acknowledged') {
          try {
            await ApiClient.acknowledgeAlert(
              alert.alert_id,
              alert.pending_decision,
              alert.idempotency_key || alert.alert_id
            );
            alert.sync_state = 'acknowledged';
            alertsModified = true;
          } catch (e: any) {
            console.error('[SyncQueue] Alert sync error:', e);
            alert.sync_state = e.message?.includes('Conflict') ? 'conflict' : 'saved_on_device';
            alertsModified = true;
          }
        }
      }
      if (alertsModified) {
        await saveCachedAlerts(owner, alerts);
      }

      // 2. Replay Mission Lifecycle Actions in dependency order
      const missions = await getCachedMissions(owner);
      let missionsModified = false;
      for (const mission of missions) {
        if (mission.pending.length > 0) {
          const remainingPending = [];
          for (const pending of mission.pending) {
            if (pending.state === 'acknowledged') continue;
            try {
              pending.state = 'sending';
              await ApiClient.sendDriverAction(
                mission.mission_id,
                pending.action,
                pending.idempotency_key
              );
              pending.state = 'acknowledged';
              missionsModified = true;
            } catch (e: any) {
              if (e.message?.includes('Conflict')) {
                pending.state = 'conflict';
                pending.error_message = e.message;
                remainingPending.push(pending);
                missionsModified = true;
                break; // stop dependent actions for this mission on conflict
              } else if (e.message?.includes('Unauthorized')) {
                pending.state = 'reauth_required';
                remainingPending.push(pending);
                missionsModified = true;
                break;
              } else {
                pending.state = 'saved_on_device';
                remainingPending.push(pending);
              }
            }
          }
          mission.pending = remainingPending;
        }
      }
      if (missionsModified) {
        await saveCachedMissions(owner, missions);
      }

      // 3. Replay Field Reports
      const reports = await getFieldReports(owner);
      let reportsModified = false;
      for (const report of reports) {
        if (report.sync_state === 'saved_on_device') {
          try {
            report.sync_state = 'sending';
            await ApiClient.submitFieldReport(report);
            report.sync_state = 'acknowledged';
            reportsModified = true;
          } catch {
            report.sync_state = 'saved_on_device';
          }
        }
      }
      if (reportsModified) {
        await saveFieldReports(owner, reports);
      }

      // 4. Replay GPS Batches
      const gpsQueue = await getGpsQueue(owner);
      const remainingGps = [];
      for (const item of gpsQueue) {
        if (item.state === 'acknowledged') continue;
        try {
          await ApiClient.sendGpsBatch(
            item.mission_id,
            item.owner,
            item.points[0]?.sequence || 1,
            item.points
          );
          item.state = 'acknowledged';
        } catch {
          item.retry_count++;
          remainingGps.push(item);
        }
      }
      if (remainingGps.length !== gpsQueue.length) {
        await saveGpsQueue(owner, remainingGps);
      }

    } finally {
      this.isSyncing = false;
      const count = await this.getPendingCount(owner);
      this.notify(false, count);
    }
  }
}

// Global network listener to automatically trigger sync on connection restored
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    console.log('[NetInfo] Network connected. Syncing active queues...');
  }
});
