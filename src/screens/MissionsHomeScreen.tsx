import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { HeaderBar } from '../components/HeaderBar';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';
import { CachedMission, Session, CachedRouteAlert } from '../types';
import { getCachedMissions, saveCachedMissions, getCachedAlerts } from '../services/storage';
import { ApiClient } from '../services/api';
import { SyncQueueManager } from '../services/syncQueue';
import { t } from '../services/i18n';
import { 
  Truck, 
  Clock, 
  Navigation, 
  AlertTriangle, 
  Camera, 
  FolderSync, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight, 
  Mountain, 
  Gauge, 
  FileCheck2,
  MapPin
} from 'lucide-react-native';

interface Props {
  session: Session;
  onNavigateTab: (tabName: string) => void;
  onOpenPreTripCheck: () => void;
  onOpenSos: () => void;
}

export const MissionsHomeScreen: React.FC<Props> = ({ 
  session, 
  onNavigateTab, 
  onOpenPreTripCheck, 
  onOpenSos 
}) => {
  const owner = session.user.actor_id;
  const [missions, setMissions] = useState<CachedMission[]>([]);
  const [alerts, setAlerts] = useState<CachedRouteAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const cached = await getCachedMissions(owner);
      if (cached.length > 0) {
        setMissions(cached);
      } else {
        const fetched = await ApiClient.fetchMissions(owner, 'corridor-dimapur-kohima');
        await saveCachedMissions(owner, fetched);
        setMissions(fetched);
      }

      const cachedAlerts = await getCachedAlerts(owner);
      if (cachedAlerts.length > 0) {
        setAlerts(cachedAlerts);
      } else {
        const fetchedAlerts = await ApiClient.fetchAlerts(owner);
        setAlerts(fetchedAlerts);
      }

      const count = await SyncQueueManager.getPendingCount(owner);
      setPendingCount(count);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = SyncQueueManager.subscribe(status => {
      setPendingCount(status.pendingCount);
    });
    return unsub;
  }, [owner]);

  const handleAction = async (missionId: string, action: 'accept' | 'reject' | 'start' | 'declare-delivery') => {
    setBusyAction(action);
    try {
      const updated = await SyncQueueManager.queueMissionAction(owner, missionId, action);
      const newMissions = missions.map(m => m.mission_id === missionId ? updated : m);
      setMissions(newMissions);
      const count = await SyncQueueManager.getPendingCount(owner);
      setPendingCount(count);
    } catch (err: any) {
      Alert.alert('Action Error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const activeMission = missions.find(m => m.state === 'active') || missions[0];
  const criticalAlert = alerts.find(a => a.severity === 'critical') || alerts[0];

  return (
    <View style={styles.container}>
      <HeaderBar 
        driverName={session.user.display_name}
        pendingCount={pendingCount}
        onSyncPress={() => onNavigateTab('sync')}
        onSosPress={onOpenSos}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Welcome Driver Ribbon */}
        <View style={styles.driverRibbon}>
          <View>
            <Text style={styles.driverGreeting}>Active Mountain Shift</Text>
            <Text style={styles.driverName}>{session.user.display_name}</Text>
          </View>
          <View style={styles.shiftBadge}>
            <Clock size={12} color={Colors.primary} />
            <Text style={styles.shiftText}>03h 40m</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : activeMission ? (
          <>
            {/* HERO MISSION CARD */}
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View>
                  <Text style={styles.missionLabel}>MISSION CODE</Text>
                  <Text style={styles.missionCode}>{activeMission.mission_id}</Text>
                </View>

                {/* State Tag */}
                <View style={[
                  styles.stateBadge, 
                  activeMission.state === 'active' && styles.stateActive,
                  activeMission.state === 'planned' && styles.statePlanned,
                  activeMission.state === 'delivered' && styles.stateDelivered
                ]}>
                  <Text style={styles.stateBadgeText}>
                    {t(activeMission.state as any) || activeMission.state.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Corridor Route */}
              <View style={styles.routeBox}>
                <View style={styles.routeEndpoint}>
                  <MapPin size={16} color={Colors.primary} />
                  <Text style={styles.routeLoc} numberOfLines={1}>{activeMission.from_location || 'Dimapur'}</Text>
                </View>
                <ArrowRight size={16} color={Colors.textMuted} />
                <View style={styles.routeEndpoint}>
                  <MapPin size={16} color={Colors.danger} />
                  <Text style={styles.routeLoc} numberOfLines={1}>{activeMission.to_location || 'Kohima'}</Text>
                </View>
              </View>

              {/* Cargo & Vehicle */}
              <View style={styles.cargoInfo}>
                <Text style={styles.cargoTitle}>{activeMission.cargo_class}</Text>
                <Text style={styles.vehicleInfo}>
                  {activeMission.vehicle_id} · {activeMission.cargo_weight_tonnes || 4.2}T Net Payload
                </Text>
              </View>

              {/* Glanceable Telemetry HUD Grid */}
              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryCell}>
                  <Clock size={16} color={Colors.primary} />
                  <Text style={styles.telemetryValue}>6h 20m</Text>
                  <Text style={styles.telemetryLabel}>EST. DURATION</Text>
                </View>
                <View style={styles.telemetryCell}>
                  <Navigation size={16} color={Colors.primary} />
                  <Text style={styles.telemetryValue}>178 km</Text>
                  <Text style={styles.telemetryLabel}>REMAINING</Text>
                </View>
                <View style={styles.telemetryCell}>
                  <Mountain size={16} color={Colors.warning} />
                  <Text style={styles.telemetryValue}>1,440m</Text>
                  <Text style={styles.telemetryLabel}>ALTITUDE</Text>
                </View>
                <View style={styles.telemetryCell}>
                  <Gauge size={16} color={Colors.primary} />
                  <Text style={styles.telemetryValue}>35 km/h</Text>
                  <Text style={styles.telemetryLabel}>MTN SPEED CAP</Text>
                </View>
              </View>

              {/* Milestone Progress Bar */}
              <View style={styles.milestoneBox}>
                <View style={styles.milestoneRow}>
                  <Text style={styles.milestoneActive}>Dimapur</Text>
                  <Text style={styles.milestoneCurrent}>Pagla Pahar (Km 34)</Text>
                  <Text style={styles.milestonePending}>Medziphema</Text>
                  <Text style={styles.milestonePending}>Kohima</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: '42%' }]} />
                </View>
              </View>

              {/* Mission Actions */}
              <View style={styles.actionRow}>
                {activeMission.state === 'planned' && (
                  <>
                    <TouchableOpacity 
                      style={[styles.btnAction, styles.btnPrimary]}
                      onPress={() => handleAction(activeMission.mission_id, 'accept')}
                      disabled={busyAction !== null}
                    >
                      <Text style={styles.btnPrimaryText}>{t('acceptMission')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.btnAction, styles.btnSecondary]}
                      onPress={() => handleAction(activeMission.mission_id, 'reject')}
                      disabled={busyAction !== null}
                    >
                      <Text style={styles.btnSecondaryText}>{t('rejectMission')}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {activeMission.state === 'accepted' && (
                  <>
                    <TouchableOpacity 
                      style={[styles.btnAction, styles.btnOutline]}
                      onPress={onOpenPreTripCheck}
                    >
                      <FileCheck2 size={16} color={Colors.primary} />
                      <Text style={styles.btnOutlineText}>{t('preTripCheck')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.btnAction, styles.btnPrimary]}
                      onPress={() => handleAction(activeMission.mission_id, 'start')}
                      disabled={busyAction !== null}
                    >
                      <Text style={styles.btnPrimaryText}>{t('startMission')}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {activeMission.state === 'active' && (
                  <>
                    <TouchableOpacity 
                      style={[styles.btnAction, styles.btnOutline]}
                      onPress={() => onNavigateTab('trip')}
                    >
                      <Navigation size={16} color={Colors.primary} />
                      <Text style={styles.btnOutlineText}>View HUD Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.btnAction, styles.btnSuccess]}
                      onPress={() => handleAction(activeMission.mission_id, 'declare-delivery')}
                      disabled={busyAction !== null}
                    >
                      <CheckCircle2 size={16} color="#FFFFFF" />
                      <Text style={styles.btnSuccessText}>{t('declareDelivery')}</Text>
                    </TouchableOpacity>
                  </>
                )}

                {activeMission.state === 'delivered' && (
                  <View style={styles.deliveredNotice}>
                    <CheckCircle2 size={18} color={Colors.success} />
                    <Text style={styles.deliveredNoticeText}>
                      Delivery declared on device. Dispatcher confirmation pending.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* LIVE HAZARD WARNING FEED (NH-29) */}
            {criticalAlert && (
              <TouchableOpacity 
                style={styles.hazardCard}
                onPress={() => onNavigateTab('alerts')}
                activeOpacity={0.8}
              >
                <View style={styles.hazardHeader}>
                  <AlertTriangle size={18} color={Colors.danger} />
                  <Text style={styles.hazardTitle}>
                    {criticalAlert.severity === 'critical' ? t('landslideRisk') : 'CORRIDOR ALERT'}
                  </Text>
                  <Text style={styles.hazardDist}>{criticalAlert.distance_ahead_km} km Ahead</Text>
                </View>
                <Text style={styles.hazardMessage} numberOfLines={2}>
                  {criticalAlert.message}
                </Text>
                <View style={styles.hazardFooter}>
                  <Text style={styles.hazardActionText}>Review Candidate Detour & Reroute →</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* TACTICAL QUICK ACTIONS GRID */}
            <Text style={styles.sectionHeader}>TACTICAL CONTROLS</Text>
            <View style={styles.quickGrid}>
              {/* Report Incident */}
              <TouchableOpacity 
                style={styles.gridCard}
                onPress={() => onNavigateTab('reports')}
                activeOpacity={0.7}
              >
                <View style={[styles.gridIconBox, { backgroundColor: Colors.dangerDim }]}>
                  <Camera size={24} color={Colors.danger} />
                </View>
                <Text style={styles.gridLabel}>{t('reportIncident')}</Text>
                <Text style={styles.gridSub}>Photo & Geo-tag</Text>
              </TouchableOpacity>

              {/* My Routes / Detour */}
              <TouchableOpacity 
                style={styles.gridCard}
                onPress={() => onNavigateTab('trip')}
                activeOpacity={0.7}
              >
                <View style={[styles.gridIconBox, { backgroundColor: Colors.primaryDim }]}>
                  <Navigation size={24} color={Colors.primary} />
                </View>
                <Text style={styles.gridLabel}>{t('myRoutes')}</Text>
                <Text style={styles.gridSub}>NH-29 Live Telemetry</Text>
              </TouchableOpacity>

              {/* Offline Reports / Outbox */}
              <TouchableOpacity 
                style={styles.gridCard}
                onPress={() => onNavigateTab('sync')}
                activeOpacity={0.7}
              >
                <View style={[styles.gridIconBox, { backgroundColor: Colors.warningDim }]}>
                  <FolderSync size={24} color={Colors.warning} />
                </View>
                <Text style={styles.gridLabel}>{t('offlineReports')}</Text>
                <Text style={styles.gridSub}>{pendingCount} Stored locally</Text>
              </TouchableOpacity>

              {/* Emergency SOS */}
              <TouchableOpacity 
                style={[styles.gridCard, styles.gridCardSos]}
                onPress={onOpenSos}
                activeOpacity={0.7}
              >
                <View style={[styles.gridIconBox, { backgroundColor: '#FFFFFF' }]}>
                  <ShieldAlert size={24} color={Colors.danger} />
                </View>
                <Text style={[styles.gridLabel, { color: '#FFFFFF' }]}>{t('emergencySOS')}</Text>
                <Text style={[styles.gridSub, { color: '#FFE0DD' }]}>BRO & Police 112</Text>
              </TouchableOpacity>
            </View>

            {/* CHECKPOINT WIDGET */}
            <View style={styles.checkpointCard}>
              <View style={styles.checkpointHeader}>
                <FileCheck2 size={16} color={Colors.primary} />
                <Text style={styles.checkpointTitle}>{t('weighbridgeNext')} (in 8.4 km)</Text>
              </View>
              <Text style={styles.checkpointText}>
                5T Gross limit compliance verified at Chumukedima gate. {t('checkpointClearance')}.
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>No assigned missions for this driver account.</Text>
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
  driverRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  driverGreeting: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  driverName: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  shiftText: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: TouchTargets.cardRadius,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  missionLabel: {
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  missionCode: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: '900',
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  stateActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
  },
  statePlanned: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  stateDelivered: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  stateBadgeText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  routeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: Spacing.sm,
    borderRadius: TouchTargets.borderRadius,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.sm,
    gap: 8,
  },
  routeEndpoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeLoc: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: '700',
  },
  cargoInfo: {
    marginBottom: Spacing.md,
  },
  cargoTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.md,
    fontWeight: '700',
  },
  vehicleInfo: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
    marginTop: 2,
  },
  telemetryGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: TouchTargets.borderRadius,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    justifyContent: 'space-between',
  },
  telemetryCell: {
    alignItems: 'center',
    flex: 1,
  },
  telemetryValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  telemetryLabel: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '600',
    marginTop: 2,
  },
  milestoneBox: {
    marginBottom: Spacing.md,
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  milestoneActive: {
    color: '#15803D',
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '700',
  },
  milestoneCurrent: {
    color: '#D97706',
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '700',
  },
  milestonePending: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#15803D',
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btnAction: {
    flex: 1,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
  btnSecondary: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnSecondaryText: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: Typography.fontSizes.sm,
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  btnOutlineText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: Typography.fontSizes.sm,
  },
  btnSuccess: {
    backgroundColor: Colors.success,
  },
  btnSuccessText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
  deliveredNotice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: Spacing.sm,
    borderRadius: TouchTargets.borderRadius,
    gap: Spacing.sm,
  },
  deliveredNoticeText: {
    color: '#15803D',
    fontSize: Typography.fontSizes.xs,
    fontWeight: '600',
    flex: 1,
  },
  hazardCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: TouchTargets.cardRadius,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  hazardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  hazardTitle: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
    flex: 1,
  },
  hazardDist: {
    color: '#991B1B',
    fontSize: Typography.fontSizes.xs,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  hazardMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
    marginBottom: 6,
    lineHeight: 18,
  },
  hazardFooter: {
    alignItems: 'flex-end',
  },
  hazardActionText: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
  },
  sectionHeader: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  gridCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: TouchTargets.cardRadius,
    padding: Spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  gridCardSos: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  gridIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  gridLabel: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
  gridSub: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
    marginTop: 2,
  },
  checkpointCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: TouchTargets.cardRadius,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  checkpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  checkpointTitle: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '800',
  },
  checkpointText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.xs,
    marginTop: 2,
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  }
});
