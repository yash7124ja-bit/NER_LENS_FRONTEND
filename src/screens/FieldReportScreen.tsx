import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Image, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { HeaderBar } from '../components/HeaderBar';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';
import { Session, FieldReport, IncidentType } from '../types';
import { getFieldReports } from '../services/storage';
import { SyncQueueManager } from '../services/syncQueue';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { 
  Camera, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Lock, 
  ImagePlus, 
  Send 
} from 'lucide-react-native';
import { t } from '../services/i18n';

interface Props {
  session: Session;
  onNavigateTab: (tabName: string) => void;
  onOpenSos: () => void;
}

const INCIDENT_TYPES: { id: IncidentType; label: string; icon: string }[] = [
  { id: 'landslide', label: 'Landslide', icon: '⛰️' },
  { id: 'road_blocked', label: 'Road Blocked', icon: '🚧' },
  { id: 'heavy_rain', label: 'Heavy Rain', icon: '🌧️' },
  { id: 'accident', label: 'Accident', icon: '⚠️' },
  { id: 'bad_road', label: 'Bad Road', icon: '🕳️' },
  { id: 'vehicle_problem', label: 'Breakdown', icon: '🚚' },
  { id: 'other', label: 'Other Hazard', icon: 'ℹ️' },
];

export const FieldReportScreen: React.FC<Props> = ({ session, onNavigateTab, onOpenSos }) => {
  const owner = session.user.actor_id;
  const isReporter = session.user.roles.includes('field_reporter') || session.user.roles.includes('driver');

  const [incidentType, setIncidentType] = useState<IncidentType>('landslide');
  const [condition, setCondition] = useState<FieldReport['condition']>('impassable');
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<[number, number]>([93.7275, 25.8821]); // Pagla Pahar approx [lon, lat]
  const [accuracy, setAccuracy] = useState(12);
  const [photos, setPhotos] = useState<string[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReports();
    // Try to get fresh location fix
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setCoords([loc.coords.longitude, loc.coords.latitude]);
          setAccuracy(loc.coords.accuracy || 15);
        }
      } catch {
        // Use default corridor coords
      }
    })();
  }, [owner]);

  const loadReports = async () => {
    const cached = await getFieldReports(owner);
    setReports(cached);
    const count = await SyncQueueManager.getPendingCount(owner);
    setPendingCount(count);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        if (photos.length >= 4) {
          Alert.alert('Slot Limit', 'Maximum 4 evidence photographs per report.');
          return;
        }
        setPhotos([...photos, result.assets[0].uri]);
      }
    } catch {
      Alert.alert('Permission', 'Photo access permission required.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera Permission', 'Camera access is required to capture field evidence.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        if (photos.length >= 4) {
          Alert.alert('Slot Limit', 'Maximum 4 evidence photographs per report.');
          return;
        }
        setPhotos([...photos, result.assets[0].uri]);
      }
    } catch {
      Alert.alert('Camera', 'Unable to open camera.');
    }
  };

  const handleSubmit = async () => {
    if (!note.trim()) {
      Alert.alert('Description Required', 'Please enter a brief note describing the field condition.');
      return;
    }

    setSubmitting(true);
    try {
      const newReport: FieldReport = {
        client_report_id: Crypto.randomUUID(),
        owner,
        mission_id: 'ML-0176',
        sequence: reports.length + 1,
        observed_time: new Date().toISOString(),
        segment_id: 'segment-nh29-km34',
        coordinates: coords,
        accuracy_m: accuracy,
        incident_type: incidentType,
        condition,
        note: note.trim(),
        device_id: `device-${Crypto.randomUUID().slice(0, 8)}`,
        photo_uris: photos,
        sync_state: 'saved_on_device',
        created_at: new Date().toISOString(),
      };

      await SyncQueueManager.queueFieldReport(newReport);
      setNote('');
      setPhotos([]);
      await loadReports();
      Alert.alert('Report Saved', 'Evidence saved to offline outbox. Will upload automatically when in network range.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReporter) {
    return (
      <View style={styles.container}>
        <HeaderBar driverName={session.user.display_name} />
        <View style={styles.unauthorizedBox}>
          <Lock size={48} color={Colors.warning} />
          <Text style={styles.unauthorizedTitle}>ROLE RESTRICTION</Text>
          <Text style={styles.unauthorizedDesc}>
            Field observation reporting is strictly reserved for accounts with the field_reporter role. Please contact Regional Logistics Control to enable evidence reporting privileges.
          </Text>
        </View>
      </View>
    );
  }

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
          <Text style={styles.title}>GEO-TAGGED FIELD REPORT</Text>
          <Text style={styles.subtitle}>
            Submit verifiable ground truth observations along NH-29. Photographs are hashed locally for integrity.
          </Text>
        </View>

        {/* INCIDENT TYPE GRID */}
        <Text style={styles.inputLabel}>WHAT HAPPENED? (INCIDENT TYPE)</Text>
        <View style={styles.typeGrid}>
          {INCIDENT_TYPES.map(item => (
            <TouchableOpacity 
              key={item.id}
              style={[
                styles.typeCard,
                incidentType === item.id && styles.typeCardSelected
              ]}
              onPress={() => setIncidentType(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.typeEmoji}>{item.icon}</Text>
              <Text style={[
                styles.typeLabel,
                incidentType === item.id && styles.typeLabelSelected
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* PASSABILITY CONDITION */}
        <Text style={styles.inputLabel}>ROAD PASSABILITY CONDITION</Text>
        <View style={styles.conditionRow}>
          <TouchableOpacity 
            style={[styles.condBtn, condition === 'passable_with_caution' && styles.condCaution]}
            onPress={() => setCondition('passable_with_caution')}
          >
            <Text style={styles.condText}>Caution</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.condBtn, condition === 'single_lane' && styles.condSingle]}
            onPress={() => setCondition('single_lane')}
          >
            <Text style={styles.condText}>Single-Lane</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.condBtn, condition === 'impassable' && styles.condBlocked]}
            onPress={() => setCondition('impassable')}
          >
            <Text style={styles.condText}>Impassable</Text>
          </TouchableOpacity>
        </View>

        {/* GEOLOCATION FIX DISPLAY */}
        <View style={styles.geoBox}>
          <MapPin size={16} color={Colors.primary} />
          <View style={styles.geoTextGroup}>
            <Text style={styles.geoTitle}>Geo-Fix: {coords[1].toFixed(5)}°N, {coords[0].toFixed(5)}°E</Text>
            <Text style={styles.geoAccuracy}>Accuracy: ±{accuracy}m · Segment: NH-29 Pagla Pahar</Text>
          </View>
        </View>

        {/* DESCRIPTION NOTE */}
        <Text style={styles.inputLabel}>DESCRIPTION / REMARKS</Text>
        <TextInput
          style={styles.textArea}
          placeholder="e.g. Sludge and boulders blocking northbound carriageway. Excavator deployed by BRO..."
          placeholderTextColor={Colors.textDisabled}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
        />

        {/* EVIDENCE PHOTO ATTACHMENT */}
        <Text style={styles.inputLabel}>EVIDENCE PHOTOGRAPHS ({photos.length}/4 SLOTS)</Text>
        <View style={styles.photoRow}>
          {photos.map((uri, idx) => (
            <View key={idx} style={styles.photoThumb}>
              <Image source={{ uri }} style={styles.photoImg} />
            </View>
          ))}

          {photos.length < 4 && (
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
                <Camera size={20} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={handlePickImage}>
                <ImagePlus size={20} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* SUBMIT CTA */}
        <TouchableOpacity 
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.bgBase} />
          ) : (
            <>
              <Send size={18} color={Colors.bgBase} />
              <Text style={styles.submitBtnText}>Submit Field Evidence</Text>
            </>
          )}
        </TouchableOpacity>

        {/* LOCAL REPORTS FEED */}
        <Text style={[styles.inputLabel, { marginTop: Spacing.xl }]}>LOCAL EVIDENCE OUTBOX ({reports.length})</Text>
        {reports.length === 0 ? (
          <Text style={styles.emptyText}>No field reports logged yet.</Text>
        ) : (
          reports.map(rep => (
            <View key={rep.client_report_id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportType}>{rep.incident_type.toUpperCase().replace('_', ' ')}</Text>
                <View style={[
                  styles.syncBadge,
                  rep.sync_state === 'acknowledged' ? styles.syncAck : styles.syncPending
                ]}>
                  {rep.sync_state === 'acknowledged' ? (
                    <CheckCircle2 size={12} color={Colors.success} />
                  ) : (
                    <Clock size={12} color={Colors.warning} />
                  )}
                  <Text style={styles.syncBadgeText}>
                    {rep.sync_state === 'acknowledged' ? 'VERIFIED SYNC' : 'OFFLINE STORED'}
                  </Text>
                </View>
              </View>
              <Text style={styles.reportNote}>{rep.note}</Text>
              <Text style={styles.reportMeta}>
                Condition: {rep.condition.replace('_', ' ')} · {new Date(rep.observed_time).toLocaleTimeString()}
              </Text>
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
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  typeCard: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: TouchTargets.borderRadius,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  typeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDim,
  },
  typeEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  typeLabel: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '700',
  },
  typeLabelSelected: {
    color: Colors.primaryBright,
    fontWeight: '800',
  },
  conditionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  condBtn: {
    flex: 1,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: TouchTargets.borderRadius,
    paddingVertical: 10,
    alignItems: 'center',
  },
  condCaution: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warningDim,
  },
  condSingle: {
    borderColor: Colors.warningBright,
    backgroundColor: 'rgba(255, 185, 95, 0.15)',
  },
  condBlocked: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerDim,
  },
  condText: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.fontSizes.xs,
  },
  geoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurfaceRaised,
    borderRadius: TouchTargets.borderRadius,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  geoTextGroup: {
    flex: 1,
  },
  geoTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  geoAccuracy: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
  },
  textArea: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: TouchTargets.borderRadius,
    padding: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.sm,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
    minHeight: 80,
  },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    flexWrap: 'wrap',
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoBtn: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  photoBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '700',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: Colors.bgBase,
    fontWeight: '900',
    fontSize: Typography.fontSizes.sm,
  },
  reportCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: TouchTargets.borderRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportType: {
    color: Colors.primaryBright,
    fontWeight: '800',
    fontSize: Typography.fontSizes.xs,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  syncAck: {
    backgroundColor: Colors.successDim,
  },
  syncPending: {
    backgroundColor: Colors.warningDim,
  },
  syncBadgeText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '700',
  },
  reportNote: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.xs,
    marginBottom: 4,
  },
  reportMeta: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
  },
  unauthorizedBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  unauthorizedTitle: {
    color: Colors.warningBright,
    fontWeight: '900',
    fontSize: Typography.fontSizes.md,
    marginTop: Spacing.md,
    letterSpacing: 1,
  },
  unauthorizedDesc: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  }
});
