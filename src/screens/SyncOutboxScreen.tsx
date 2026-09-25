import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { HeaderBar } from '../components/HeaderBar';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';
import { Session, CachedMission, CachedRouteAlert, FieldReport, PositionBatchQueueItem } from '../types';
import { getCachedMissions, getCachedAlerts, getFieldReports, getGpsQueue } from '../services/storage';
import { SyncQueueManager } from '../services/syncQueue';
import { t } from '../services/i18n';
import { 
  FolderSync, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Radio, 
  Navigation, 
  ShieldCheck 
} from 'lucide-react-native';

interface Props {
  session: Session;
  onNavigateTab: (tabName: string) => void;
  onOpenSos: () => void;
}

export const SyncOutboxScreen: React.FC<Props> = ({ session, onNavigateTab, onOpenSos }) => {
  const owner = session.user.actor_id;
  const [missions, setMissions] = useState<CachedMission[]>([]);
  const [alerts, setAlerts] = useState<CachedRouteAlert[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [gpsBatches, setGpsBatches] = useState<PositionBatchQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const loadAll = async () => {
    const m = await getCachedMissions(owner);
    const a = await getCachedAlerts(owner);
    const r = await getFieldReports(owner);
    const g = await getGpsQueue(owner);

    setMissions(m);
    setAlerts(a);
    setReports(r);
    setGpsBatches(g);

    const count = await SyncQueueManager.getPendingCount(owner);
    setPendingCount(count);
  };

  useEffect(() => {
    loadAll();
    const unsub = SyncQueueManager.subscribe(status => {
      setIsSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);
      loadAll();
    });
    return unsub;
  }, [owner]);

  const handleManualReplay = async () => {
    setIsSyncing(true);
    try {
      await SyncQueueManager.syncAll(owner);
      await loadAll();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar 
        driverName={session.user.display_name}
        pendingCount={pendingCount}
        onSosPress={onOpenSos}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.ribbon}>
          <Text style={styles.title}>{t('syncTitle')}</Text>
          <Text style={styles.subtitle}>{t('syncDesc')}</Text>
        </View>

        {/* REPLAY HERO CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroInfo}>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{pendingCount}</Text>
            </View>
            <View style={styles.heroTextGroup}>
              <Text style={styles.heroTitle}>{t('itemsQueued')}</Text>
              <Text style={styles.heroDesc}>
                {pendingCount === 0 ? t('allSynced') : 'Durable local state preserved across restarts'}
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.replayBtn, isSyncing && { opacity: 0.6 }]}
            onPress={handleManualReplay}
            disabled={isSyncing}
            activeOpacity={0.8}
          >
            {isSyncing ? (
              <ActivityIndicator color={Colors.bgBase} />
            ) : (
              <>
                <RefreshCw size={16} color={Colors.bgBase} />
                <Text style={styles.replayBtnText}>{t('retryNow')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* QUEUED SECTIONS */}
        <Text style={styles.sectionHeader}>MISSION ACTIONS IN DEPENDENCY CHAIN</Text>
        {missions.flatMap(m => m.pending).length === 0 ? (
          <View style={styles.emptyRow}>
            <CheckCircle2 size={16} color={Colors.success} />
            <Text style={styles.emptyText}>All mission lifecycle actions acknowledged by server</Text>
          </View>
        ) : (
          missions.flatMap(m => m.pending.map(p => ({ ...p, mission_id: m.mission_id }))).map(p => (
            <View key={p.idempotency_key} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Navigation size={16} color={Colors.primary} />
                <Text style={styles.itemName}>Mission {p.mission_id} → {p.action.toUpperCase()}</Text>
                <View style={[styles.statusBadge, p.state === 'conflict' ? styles.statusConflict : styles.statusPending]}>
                  <Text style={styles.statusText}>{p.state.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.itemMeta}>UUID Key: {p.idempotency_key.slice(0, 16)}... · Queued {new Date(p.created_at).toLocaleTimeString()}</Text>
            </View>
          ))
        )}

        <Text style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>ROUTE ALERT DECISIONS</Text>
        {alerts.filter(a => a.pending_decision && a.sync_state !== 'acknowledged').length === 0 ? (
          <View style={styles.emptyRow}>
            <CheckCircle2 size={16} color={Colors.success} />
            <Text style={styles.emptyText}>No pending reroute decisions awaiting dispatch acknowledgment</Text>
          </View>
        ) : (
          alerts.filter(a => a.pending_decision && a.sync_state !== 'acknowledged').map(a => (
            <View key={a.alert_id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <AlertCircle size={16} color={Colors.warning} />
                <Text style={styles.itemName}>Alert {a.alert_id} → {a.pending_decision?.toUpperCase()}</Text>
                <View style={[styles.statusBadge, styles.statusPending]}>
                  <Text style={styles.statusText}>{a.sync_state?.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.itemMeta}>Candidate: {a.candidate_route_id} · Key: {a.idempotency_key?.slice(0, 16)}...</Text>
            </View>
          ))
        )}

        <Text style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>FIELD EVIDENCE PHOTOGRAPHS & REPORTS</Text>
        {reports.length === 0 ? (
          <View style={styles.emptyRow}>
            <CheckCircle2 size={16} color={Colors.success} />
            <Text style={styles.emptyText}>No ground truth reports waiting in outbox</Text>
          </View>
        ) : (
          reports.map(r => (
            <View key={r.client_report_id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <FileText size={16} color={Colors.primary} />
                <Text style={styles.itemName}>{r.incident_type.toUpperCase().replace('_', ' ')} Observation</Text>
                <View style={[styles.statusBadge, r.sync_state === 'acknowledged' ? styles.statusAck : styles.statusPending]}>
                  <Text style={styles.statusText}>{r.sync_state.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.itemMeta}>{r.photo_uris.length} photos attached · {r.coordinates[1].toFixed(4)}°N, {r.coordinates[0].toFixed(4)}°E</Text>
            </View>
          ))
        )}

        <Text style={[styles.sectionHeader, { marginTop: Spacing.lg }]}>GPS CORRIDOR TRACK BATCHES</Text>
        {gpsBatches.filter(g => g.state !== 'acknowledged').length === 0 ? (
          <View style={styles.emptyRow}>
            <Radio size={16} color={Colors.success} />
            <Text style={styles.emptyText}>GPS position stream synced with vehicle control</Text>
          </View>
        ) : (
          gpsBatches.filter(g => g.state !== 'acknowledged').map(g => (
            <View key={g.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Radio size={16} color={Colors.primary} />
                <Text style={styles.itemName}>{g.points.length} GPS Breadcrumbs (Mission {g.mission_id})</Text>
                <View style={[styles.statusBadge, styles.statusPending]}>
                  <Text style={styles.statusText}>{g.state.replace('_', ' ')}</Text>
                </View>
              </View>
              <Text style={styles.itemMeta}>Batch Seq {g.points[0]?.sequence} · Retry count: {g.retry_count}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  scroll: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  ribbon: {
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: Typography.fontSizes.md,
    letterSpacing: 0.8,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  heroCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: TouchTargets.cardRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  heroInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  countBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.bgSurfaceRaised,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    color: Colors.primaryBright,
    fontSize: Typography.fontSizes.xl,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  heroTextGroup: {
    flex: 1,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: '800',
  },
  heroDesc: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
    marginTop: 2,
  },
  replayBtn: {
    backgroundColor: Colors.primary,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  replayBtnText: {
    color: Colors.bgBase,
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgSurface,
    borderRadius: TouchTargets.borderRadius,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
  },
  itemCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: TouchTargets.borderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  itemName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: Colors.warningDim,
  },
  statusAck: {
    backgroundColor: Colors.successDim,
  },
  statusConflict: {
    backgroundColor: Colors.dangerDim,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  itemMeta: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
    fontFamily: 'monospace',
  }
});
