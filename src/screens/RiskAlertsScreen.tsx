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
import { Session, CachedRouteAlert } from '../types';
import { getCachedAlerts, saveCachedAlerts } from '../services/storage';
import { ApiClient } from '../services/api';
import { SyncQueueManager } from '../services/syncQueue';
import { reconcileAlerts } from '../services/alertCache';
import { t } from '../services/i18n';
import { 
  AlertTriangle, 
  CloudRain, 
  Construction, 
  Check, 
  X, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2 
} from 'lucide-react-native';

interface Props {
  session: Session;
  onNavigateTab: (tabName: string) => void;
  onOpenSos: () => void;
}

export const RiskAlertsScreen: React.FC<Props> = ({ session, onNavigateTab, onOpenSos }) => {
  const owner = session.user.actor_id;
  const [alerts, setAlerts] = useState<CachedRouteAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const loadAlerts = async () => {
    try {
      const cached = await getCachedAlerts(owner);
      setAlerts(cached);
      try {
        const fetched = await ApiClient.fetchAlerts(owner);
        const merged = reconcileAlerts(fetched, cached);
        await saveCachedAlerts(owner, merged);
        setAlerts(merged);
        setLoadError('');
      } catch {
        setLoadError(cached.length ? 'Offline: showing saved alerts; decisions remain queued.' : 'Alerts unavailable. Check your connection and session.');
      }
      const count = await SyncQueueManager.getPendingCount(owner);
      setPendingCount(count);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const unsub = SyncQueueManager.subscribe(status => {
      setPendingCount(status.pendingCount);
      void getCachedAlerts(owner).then(setAlerts);
    });
    return unsub;
  }, [owner]);

  const handleDecision = async (alertId: string, decision: 'accept' | 'decline') => {
    setBusyAlertId(alertId);
    try {
      const updated = await SyncQueueManager.queueAlertDecision(owner, alertId, decision);
      const newAlerts = alerts.map(a => a.alert_id === alertId ? updated : a);
      setAlerts(newAlerts);
      const count = await SyncQueueManager.getPendingCount(owner);
      setPendingCount(count);
    } catch (err: any) {
      Alert.alert('Decision Error', err.message);
    } finally {
      setBusyAlertId(null);
    }
  };

  const getSeverityIcon = (sev: CachedRouteAlert['severity']) => {
    switch (sev) {
      case 'critical': return <AlertTriangle size={20} color={Colors.danger} />;
      case 'high': return <Construction size={20} color={Colors.warningBright} />;
      case 'moderate': return <CloudRain size={20} color={Colors.primary} />;
      default: return <AlertTriangle size={20} color={Colors.warning} />;
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar 
        driverName={session.user.display_name}
        pendingCount={pendingCount}
        onSyncPress={() => onNavigateTab('sync')}
        onSosPress={onOpenSos}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.ribbon}>
          <Text style={styles.title}>CORRIDOR RISK INBOX</Text>
          <Text style={styles.subtitle}>
            Server-delivered route-change notices for your assigned missions. Review each candidate before deciding.
          </Text>
        </View>

        {!!loadError && <Text style={styles.emptyText}>{loadError}</Text>}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : alerts.length === 0 ? (
          <Text style={styles.emptyText}>No active alerts along current corridor.</Text>
        ) : (
          alerts.map(alert => (
            <View key={alert.alert_id} style={styles.alertCard}>
              {/* Alert Header */}
              <View style={styles.alertHeader}>
                <View style={styles.alertIconGroup}>
                  {getSeverityIcon(alert.severity)}
                  <View>
                    <Text style={styles.alertLocation}>{alert.location_name || 'Corridor Hazard'}</Text>
                    {alert.distance_ahead_km !== undefined && (
                      <Text style={styles.alertDistance}>{alert.distance_ahead_km} km ahead</Text>
                    )}
                  </View>
                </View>

                {/* Severity pill */}
                <View style={[
                  styles.severityPill,
                  alert.severity === 'critical' && styles.pillCritical,
                  alert.severity === 'high' && styles.pillHigh,
                  alert.severity === 'moderate' && styles.pillModerate,
                ]}>
                  <Text style={styles.severityText}>{alert.severity?.toUpperCase() || 'ROUTE NOTICE'}</Text>
                </View>
              </View>

              {/* Message & Dispatcher Reason */}
              <Text style={styles.messageText}>{alert.message}</Text>
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>AUTHORITY REASON:</Text>
                <Text style={styles.reasonText}>{alert.reason}</Text>
              </View>

              <View style={styles.comparisonBox}>
                <Text style={styles.comparisonTitle}>DISPATCHER-APPROVED CANDIDATE</Text>
                <Text style={styles.routeCompStats}>Route ID: {alert.route_id}</Text>
                <Text style={styles.candidateNotesText}>Planning baseline only. Vehicle and road clearance are not established here.</Text>
              </View>

              {/* Status / Decision Bar */}
              <View style={styles.decisionBar}>
                {alert.acknowledgment ? (
                  <View style={styles.ackNotice}>
                    <CheckCircle2 size={16} color={Colors.success} />
                    <Text style={styles.ackNoticeText}>
                      Driver {alert.acknowledgment.decision === 'accept' ? 'accepted' : 'declined'} this route candidate.
                    </Text>
                  </View>
                ) : alert.pending_decision ? (
                  <View style={styles.pendingNotice}>
                    <Clock size={16} color={Colors.warning} />
                    <Text style={styles.pendingNoticeText}>
                      Decision “{alert.pending_decision}” queued on device. Replaying on reconnect.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <TouchableOpacity 
                      style={[styles.btnDecision, styles.btnDecline]}
                      onPress={() => handleDecision(alert.alert_id, 'decline')}
                      disabled={busyAlertId !== null}
                    >
                      <X size={16} color={Colors.textMuted} />
                      <Text style={styles.btnDeclineText}>Decline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.btnDecision, styles.btnAccept]}
                      onPress={() => handleDecision(alert.alert_id, 'accept')}
                      disabled={busyAlertId !== null}
                    >
                      <Check size={16} color={Colors.bgBase} />
                      <Text style={styles.btnAcceptText}>Adopt Candidate</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: TouchTargets.cardRadius,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  alertIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  alertLocation: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
  alertDistance: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
    fontFamily: 'monospace',
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  pillCritical: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  pillHigh: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  pillModerate: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  severityText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  messageText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  reasonBox: {
    backgroundColor: '#FFFBEB',
    padding: Spacing.sm,
    borderRadius: TouchTargets.borderRadius,
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
    marginBottom: Spacing.sm,
  },
  reasonLabel: {
    color: '#B45309',
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '800',
    marginBottom: 2,
  },
  reasonText: {
    color: '#78350F',
    fontSize: Typography.fontSizes.xs,
    lineHeight: 16,
  },
  comparisonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: TouchTargets.borderRadius,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  comparisonTitle: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  routeCompRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.sm,
    borderRadius: 6,
    marginBottom: Spacing.xs,
  },
  routeCompCol: {
    flex: 1,
  },
  routeCompName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
  },
  routeCompStats: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  routeCompTag: {
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '700',
    marginTop: 2,
  },
  candidateNotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  candidateNotesText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
    flex: 1,
  },
  decisionBar: {
    marginTop: Spacing.xs,
  },
  ackNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: Spacing.sm,
    borderRadius: TouchTargets.borderRadius,
    gap: 6,
  },
  ackNoticeText: {
    color: '#15803D',
    fontSize: Typography.fontSizes.xs,
    fontWeight: '600',
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: Spacing.sm,
    borderRadius: TouchTargets.borderRadius,
    gap: 6,
  },
  pendingNoticeText: {
    color: '#D97706',
    fontSize: Typography.fontSizes.xs,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btnDecision: {
    flex: 1,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  btnDecline: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnDeclineText: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: Typography.fontSizes.sm,
  },
  btnAccept: {
    backgroundColor: '#15803D',
  },
  btnAcceptText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
  emptyText: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  }
});
