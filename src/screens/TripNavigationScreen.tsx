import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Modal 
} from 'react-native';
import { HeaderBar } from '../components/HeaderBar';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';
import { Session, Waypoint } from '../types';
import { SyncQueueManager } from '../services/syncQueue';
import Svg, { Path, Circle, Line, Text as SvgText, Rect, G } from 'react-native-svg';
import { 
  AlertTriangle, 
  Layers, 
  MapPin, 
  Navigation, 
  Compass, 
  Mountain, 
  Gauge, 
  Radio, 
  X, 
  CheckCircle2, 
  Clock 
} from 'lucide-react-native';
import { t } from '../services/i18n';

interface Props {
  session: Session;
  onNavigateTab: (tabName: string) => void;
  onOpenSos: () => void;
}

const NH29_WAYPOINTS: Waypoint[] = [
  { id: 'wp-1', name: 'Dimapur Medical Depot', km_mark: 0.0, status: 'passed' },
  { id: 'wp-2', name: 'Chumukedima Foothill Gate', km_mark: 18.2, status: 'passed' },
  { id: 'wp-3', name: 'Pagla Pahar (Debris Hazard)', km_mark: 34.2, status: 'current', hazard: 'Landslide Risk < 15km/h' },
  { id: 'wp-4', name: 'Medziphema Weighbridge', km_mark: 48.0, status: 'upcoming', is_checkpoint: true },
  { id: 'wp-5', name: 'Dzüdza River Bridge', km_mark: 60.5, status: 'upcoming', hazard: 'Single-Lane Transit' },
  { id: 'wp-6', name: 'Kohima Bypass & Naga Hospital', km_mark: 74.0, status: 'upcoming' },
];

export const TripNavigationScreen: React.FC<Props> = ({ session, onNavigateTab, onOpenSos }) => {
  const [gpsSharing, setGpsSharing] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showLayers, setShowLayers] = useState(false);
  const [layerHazards, setLayerHazards] = useState(true);
  const [layerWeather, setLayerWeather] = useState(true);
  const [layerFieldReports, setLayerFieldReports] = useState(true);
  const [layerAlternatives, setLayerAlternatives] = useState(false);

  useEffect(() => {
    const unsub = SyncQueueManager.subscribe(status => {
      setPendingCount(status.pendingCount);
    });
    return unsub;
  }, []);

  return (
    <View style={styles.container}>
      <HeaderBar 
        driverName={session.user.display_name}
        pendingCount={pendingCount}
        onSyncPress={() => onNavigateTab('sync')}
        onSosPress={onOpenSos}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* MANDATORY PLANNING BASELINE DISCLAIMER (SOW Requirement) */}
        <View style={styles.disclaimerBanner}>
          <AlertTriangle size={18} color={Colors.warning} />
          <View style={styles.disclaimerTextGroup}>
            <Text style={styles.disclaimerTitle}>{t('baselineWarning')}</Text>
            <Text style={styles.disclaimerText}>{t('baselineDisclaimer')}</Text>
          </View>
        </View>

        {/* MAP & HUD TELEMETRY CANVAS */}
        <View style={styles.mapCard}>
          <View style={styles.mapToolbar}>
            <View style={styles.mapHeaderInfo}>
              <Text style={styles.mapTitle}>NH-29 MOUNTAIN CORRIDOR</Text>
              <Text style={styles.mapSub}>Dimapur (Km 0) → Kohima (Km 74)</Text>
            </View>

            <TouchableOpacity 
              style={styles.layerBtn} 
              onPress={() => setShowLayers(true)}
              activeOpacity={0.8}
            >
              <Layers size={16} color={Colors.primary} />
              <Text style={styles.layerBtnText}>Layers</Text>
            </TouchableOpacity>
          </View>

          {/* HIGH-CONTRAST VECTOR MOUNTAIN ROAD HUD */}
          <View style={styles.canvasContainer}>
            <Svg width="100%" height={220} viewBox="0 0 340 220">
              {/* Background mountain terrain mesh contours */}
              <Path d="M 0 160 Q 90 90 180 150 T 340 100 L 340 220 L 0 220 Z" fill="#0E1724" opacity={0.6} />
              <Path d="M 0 130 Q 120 70 240 120 T 340 70 L 340 220 L 0 220 Z" fill="#0A111A" opacity={0.4} />

              {/* Alternative Route B (Dashed Niuland Pass) */}
              {layerAlternatives && (
                <Path 
                  d="M 30 190 Q 70 120 160 80 T 310 30" 
                  stroke={Colors.warning} 
                  strokeWidth={3} 
                  strokeDasharray="6, 6" 
                  fill="none" 
                />
              )}

              {/* Main NH-29 Mountain Highway Polyline */}
              <Path 
                d="M 30 190 Q 80 170 110 140 T 170 110 T 230 70 T 310 30" 
                stroke="#1E293B" 
                strokeWidth={14} 
                strokeLinecap="round" 
                fill="none" 
              />
              <Path 
                d="M 30 190 Q 80 170 110 140 T 170 110 T 230 70 T 310 30" 
                stroke={Colors.primary} 
                strokeWidth={5} 
                strokeLinecap="round" 
                fill="none" 
              />

              {/* Waypoint 1: Dimapur Origin */}
              <Circle cx={30} cy={190} r={6} fill={Colors.success} />
              <SvgText x={25} y={210} fill={Colors.textSecondary} fontSize={10} fontWeight="700">Dimapur</SvgText>

              {/* Active Truck Position (Km 31.9 - before Pagla Pahar) */}
              <Circle cx={100} cy={148} r={16} fill="rgba(0, 229, 188, 0.2)" />
              <Circle cx={100} cy={148} r={8} fill={Colors.primaryBright} stroke="#0C141F" strokeWidth={2} />
              <SvgText x={85} y={135} fill={Colors.primaryBright} fontSize={10} fontWeight="900">YOU (NL-07)</SvgText>

              {/* Hazard: Landslide Risk Zone (Km 34 Pagla Pahar) */}
              {layerHazards && (
                <G>
                  <Circle cx={125} cy={135} r={14} fill="rgba(239, 68, 68, 0.25)" />
                  <Circle cx={125} cy={135} r={6} fill={Colors.danger} />
                  <SvgText x={140} y={138} fill={Colors.dangerBright} fontSize={9} fontWeight="700">Landslide Risk (Km 34)</SvgText>
                </G>
              )}

              {/* Waypoint 4: Medziphema Weighbridge */}
              <Rect x={164} y={104} width={12} height={12} rx={2} fill={Colors.warning} />
              <SvgText x={180} y={112} fill={Colors.textSecondary} fontSize={9} fontWeight="600">Medziphema (Km 48)</SvgText>

              {/* Waypoint 5: Dzüdza River Bridge */}
              <Circle cx={230} cy={70} r={5} fill={Colors.warningBright} />
              <SvgText x={240} y={75} fill={Colors.textMuted} fontSize={9}>Dzüdza Br.</SvgText>

              {/* Waypoint 6: Kohima Delivery Destination */}
              <Circle cx={310} cy={30} r={7} fill={Colors.danger} />
              <SvgText x={265} y={22} fill={Colors.textPrimary} fontSize={10} fontWeight="800">Kohima Hospital</SvgText>
            </Svg>

            {/* Inset GPS Telemetry Cluster */}
            <View style={styles.hudOverlayCluster}>
              <View style={styles.hudPill}>
                <Mountain size={12} color={Colors.warning} />
                <Text style={styles.hudPillValue}>1,440 m MSL</Text>
              </View>
              <View style={styles.hudPill}>
                <Gauge size={12} color={Colors.primary} />
                <Text style={styles.hudPillValue}>28 km/h</Text>
              </View>
              <View style={styles.hudPill}>
                <Compass size={12} color={Colors.primary} />
                <Text style={styles.hudPillValue}>042° NE</Text>
              </View>
            </View>
          </View>

          {/* GPS Tracking Consent Control */}
          <View style={styles.consentRow}>
            <View style={styles.consentInfo}>
              <Radio size={16} color={gpsSharing ? Colors.primary : Colors.textMuted} />
              <View>
                <Text style={styles.consentTitle}>Mission GPS Beacon</Text>
                <Text style={styles.consentSub}>Broadcasting encrypted 15s breadcrumbs to Control</Text>
              </View>
            </View>
            <Switch
              value={gpsSharing}
              onValueChange={setGpsSharing}
              trackColor={{ false: Colors.border, true: Colors.primaryDark }}
              thumbColor={gpsSharing ? Colors.primary : Colors.textMuted}
            />
          </View>
        </View>

        {/* ACCESSIBILITY TABLE: TURN-BY-TURN / OFFLINE TEXT ALTERNATIVE */}
        <Text style={styles.sectionTitle}>CORRIDOR SEGMENTS & TEXT ALTERNATIVE</Text>
        <Text style={styles.sectionSubtitle}>
          Offline readable road log. Check passability before proceeding through high-risk gradients.
        </Text>

        <View style={styles.tableCard}>
          {NH29_WAYPOINTS.map((wp, idx) => (
            <View 
              key={wp.id} 
              style={[
                styles.tableRow, 
                wp.status === 'current' && styles.tableRowCurrent,
                idx === NH29_WAYPOINTS.length - 1 && { borderBottomWidth: 0 }
              ]}
            >
              <View style={styles.tableStatusCol}>
                {wp.status === 'passed' && <CheckCircle2 size={16} color={Colors.success} />}
                {wp.status === 'current' && <Navigation size={16} color={Colors.primary} />}
                {wp.status === 'upcoming' && <Clock size={16} color={Colors.textMuted} />}
              </View>

              <View style={styles.tableInfoCol}>
                <View style={styles.tableNameRow}>
                  <Text style={[styles.tableName, wp.status === 'current' && styles.tableNameCurrent]}>
                    {wp.name}
                  </Text>
                  <Text style={styles.tableKm}>Km {wp.km_mark.toFixed(1)}</Text>
                </View>

                {wp.hazard && (
                  <View style={styles.tableHazardTag}>
                    <AlertTriangle size={12} color={Colors.danger} />
                    <Text style={styles.tableHazardText}>{wp.hazard}</Text>
                  </View>
                )}

                {wp.is_checkpoint && (
                  <View style={styles.tableCheckpointTag}>
                    <Text style={styles.tableCheckpointText}>MANDATORY WEIGHBRIDGE CHECK</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* MAP LAYERS MODAL */}
      <Modal visible={showLayers} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Corridor Map Layers</Text>
              <TouchableOpacity onPress={() => setShowLayers(false)}>
                <X size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.layerRow}>
              <Text style={styles.layerLabel}>Geological Hazard Points (GSI)</Text>
              <Switch 
                value={layerHazards} 
                onValueChange={setLayerHazards} 
                trackColor={{ false: Colors.border, true: Colors.dangerDark }}
                thumbColor={layerHazards ? Colors.danger : Colors.textMuted}
              />
            </View>

            <View style={styles.layerRow}>
              <Text style={styles.layerLabel}>Monsoon Rain & Fog Radar</Text>
              <Switch 
                value={layerWeather} 
                onValueChange={setLayerWeather}
                trackColor={{ false: Colors.border, true: Colors.warningDark }}
                thumbColor={layerWeather ? Colors.warning : Colors.textMuted}
              />
            </View>

            <View style={styles.layerRow}>
              <Text style={styles.layerLabel}>Field Observation Reports</Text>
              <Switch 
                value={layerFieldReports} 
                onValueChange={setLayerFieldReports}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={layerFieldReports ? Colors.primary : Colors.textMuted}
              />
            </View>

            <View style={styles.layerRow}>
              <Text style={styles.layerLabel}>Show Alternative Passes (Niuland Bypass)</Text>
              <Switch 
                value={layerAlternatives} 
                onValueChange={setLayerAlternatives}
                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                thumbColor={layerAlternatives ? Colors.primary : Colors.textMuted}
              />
            </View>

            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setShowLayers(false)}
            >
              <Text style={styles.modalCloseBtnText}>Apply Layers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  disclaimerBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: TouchTargets.borderRadius,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  disclaimerTextGroup: {
    flex: 1,
  },
  disclaimerTitle: {
    color: '#B45309',
    fontWeight: '800',
    fontSize: Typography.fontSizes.xs,
    letterSpacing: 0.5,
  },
  disclaimerText: {
    color: '#92400E',
    fontSize: Typography.fontSizes.xs - 1,
    marginTop: 2,
    lineHeight: 16,
  },
  mapCard: {
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
  mapToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  mapHeaderInfo: {
    flex: 1,
  },
  mapTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
    letterSpacing: 0.5,
  },
  mapSub: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
  },
  layerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  layerBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
  },
  canvasContainer: {
    backgroundColor: '#0F294A',
    borderRadius: TouchTargets.borderRadius,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  hudOverlayCluster: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-start',
  },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 41, 74, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  hudPillValue: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs - 1,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  consentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  consentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  consentTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
  },
  consentSub: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
    marginBottom: Spacing.sm,
    marginTop: 2,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: TouchTargets.cardRadius,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tableRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tableRowCurrent: {
    backgroundColor: '#EFF6FF',
  },
  tableStatusCol: {
    width: 28,
  },
  tableInfoCol: {
    flex: 1,
  },
  tableNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableName: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: '600',
  },
  tableNameCurrent: {
    color: Colors.primary,
    fontWeight: '800',
  },
  tableKm: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
    fontFamily: 'monospace',
  },
  tableHazardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  tableHazardText: {
    color: '#DC2626',
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '700',
  },
  tableCheckpointTag: {
    marginTop: 4,
  },
  tableCheckpointText: {
    color: '#D97706',
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.md,
    fontWeight: '800',
  },
  layerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  layerLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
  },
  modalCloseBtn: {
    backgroundColor: Colors.primary,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
});
