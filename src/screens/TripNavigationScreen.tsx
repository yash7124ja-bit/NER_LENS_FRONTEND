import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Switch } from 'react-native';
import * as Location from 'expo-location';
import Svg, { Polyline } from 'react-native-svg';
import { HeaderBar } from '../components/HeaderBar';
import { Colors, Spacing } from '../theme';
import type { Session, CachedMission, RouteSelection } from '../types';
import { getCachedMissions, getCachedRoute, saveCachedRoute, getDeviceId, nextGpsSequence } from '../services/storage';
import { ApiClient } from '../services/api';
import { SyncQueueManager } from '../services/syncQueue';
import { AlertTriangle, Navigation, RefreshCw } from 'lucide-react-native';

interface Props {
  session: Session;
  onNavigateTab: (tabName: string) => void;
  onOpenSos: () => void;
}

function routePoints(coordinates: [number, number][]): string {
  if (coordinates.length < 2) return '';
  const lng = coordinates.map(c => c[0]);
  const lat = coordinates.map(c => c[1]);
  const minX = Math.min(...lng), maxX = Math.max(...lng);
  const minY = Math.min(...lat), maxY = Math.max(...lat);
  return coordinates.map(([x, y]) =>
    `${20 + 300 * (x - minX) / (maxX - minX || 1)},${200 - 180 * (y - minY) / (maxY - minY || 1)}`,
  ).join(' ');
}

export const TripNavigationScreen: React.FC<Props> = ({ session, onNavigateTab, onOpenSos }) => {
  const owner = session.user.actor_id;
  const [mission, setMission] = useState<CachedMission | null>(null);
  const [selection, setSelection] = useState<RouteSelection | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [gpsSharing, setGpsSharing] = useState(false);
  const [gpsNotice, setGpsNotice] = useState('Foreground location sharing is off.');
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const pendingPosition = useRef(Promise.resolve());

  const load = async () => {
    try {
      const missions = await getCachedMissions(owner);
      const selected = missions.find(m => m.state === 'active') || missions[0];
      setMission(selected || null);
      if (!selected) {
        setNotice('No assigned mission is saved. Open Missions while online to load assignments.');
        return;
      }
      setSelection(await getCachedRoute(owner, selected.mission_id));
      try {
        const current = await ApiClient.fetchRouteSelection(selected.mission_id);
        setCheckedAt(Date.now());
        setSelection(current);
        if (current) await saveCachedRoute(owner, selected.mission_id, current);
        setNotice(current ? '' : 'No approved planning baseline is selected for this mission.');
      } catch {
        setNotice('Offline or route service unavailable. Any saved baseline may be stale.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [owner]);
  useEffect(() => () => subscription.current?.remove(), []);

  const setSharing = async (enabled: boolean) => {
    if (!enabled) {
      subscription.current?.remove();
      subscription.current = null;
      setGpsSharing(false);
      setGpsNotice('Location sharing stopped. Saved positions remain in the outbox.');
      return;
    }
    if (!mission || mission.state !== 'active') {
      setGpsNotice('Start an assigned mission before sharing location.');
      return;
    }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setGpsNotice('Location permission denied. No positions are being collected.');
        return;
      }
      const deviceId = await getDeviceId();
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 25 },
        fix => {
          if (fix.coords.accuracy === null) return;
          pendingPosition.current = pendingPosition.current.then(async () => {
            const sequence = await nextGpsSequence(owner, mission.mission_id);
            await SyncQueueManager.queueGpsBatch(owner, mission.mission_id, [{
              sequence, captured_at: new Date(fix.timestamp).toISOString(),
              coordinates: [fix.coords.longitude, fix.coords.latitude],
              accuracy_m: fix.coords.accuracy!,
              ...(fix.coords.speed !== null && fix.coords.speed >= 0 ? { speed_mps: fix.coords.speed } : {}),
              ...(fix.coords.heading !== null && fix.coords.heading >= 0 ? { heading_deg: fix.coords.heading } : {}),
            }]);
          }).catch(() => setGpsNotice('Unable to save a location fix. Check device storage.'));
        },
        () => setGpsNotice('Location provider stopped. Turn sharing off and retry.'),
      );
      setGpsSharing(true);
      setGpsNotice(`Foreground sharing on for device ${deviceId.slice(0, 8)}. Positions queue locally before server receipt.`);
    } catch {
      setGpsNotice('Location tracking could not start. Check permission and device settings.');
    }
  };

  const expired = selection && new Date(selection.expires_at).getTime() <= checkedAt;
  const geometry = selection?.route?.geometry.coordinates || [];
  return <View style={styles.container}>
    <HeaderBar driverName={session.user.display_name} onSyncPress={() => onNavigateTab('sync')} onSosPress={onOpenSos} />
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.warning}>
        <AlertTriangle size={20} color={Colors.warning} />
        <Text style={styles.warningText}>Planning baseline only. This is not road navigation or vehicle clearance. Confirm current conditions with the authority before travel.</Text>
      </View>
      <View style={styles.titleRow}>
        <View><Text style={styles.eyebrow}>MISSION ROUTE</Text><Text style={styles.title}>{mission?.mission_id || 'No mission'}</Text></View>
        <TouchableOpacity onPress={() => { setLoading(true); void load(); }} accessibilityLabel="Refresh route selection"><RefreshCw size={20} color={Colors.primary} /></TouchableOpacity>
      </View>
      {loading && <ActivityIndicator color={Colors.primary} />}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      {mission && <View style={styles.card}>
        <Text style={styles.label}>Assigned journey</Text>
        <Text style={styles.value}>{mission.from_location || 'Origin unavailable'} → {mission.to_location || 'Destination unavailable'}</Text>
        <Text style={styles.muted}>Vehicle {mission.vehicle_id || 'not assigned'} · Mission {mission.state}</Text>
      </View>}
      {selection && <View style={styles.card}>
        <View style={styles.titleRow}><Navigation size={18} color={Colors.primary} /><Text style={styles.value}>Selected baseline</Text></View>
        <Text style={[styles.notice, expired && styles.expired]}>{expired ? 'Expired — do not rely on this baseline' : 'Unverified planning context'}</Text>
        {geometry.length >= 2 ? <View style={styles.map}>
          <Svg width="100%" height={220} viewBox="0 0 340 220">
            <Polyline points={routePoints(geometry)} fill="none" stroke={Colors.primary} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.muted}>Saved route geometry · no offline basemap or turn-by-turn guidance</Text>
        </View> : <Text style={styles.notice}>Route geometry unavailable.</Text>}
        <Text style={styles.label}>Distance</Text><Text style={styles.value}>{selection.route?.distance_m == null ? 'Unavailable' : `${(selection.route.distance_m / 1000).toFixed(1)} km`}</Text>
        <Text style={styles.label}>Source</Text><Text style={styles.muted}>{selection.source?.provider || 'Unavailable'} · retrieved {selection.source?.retrieved_at || 'unknown'}</Text>
        <Text style={styles.label}>Valid until</Text><Text style={styles.muted}>{selection.expires_at}</Text>
        <Text style={styles.label}>Linked road segments</Text>
        {(selection.route?.segment_ids || []).length ? selection.route!.segment_ids.map(id => <Text key={id} style={styles.segment}>{id}</Text>) : <Text style={styles.muted}>No linked segments recorded.</Text>}
      </View>}
      <View style={styles.card}>
        <View style={styles.titleRow}><Text style={styles.value}>Mission GPS sharing</Text><Switch value={gpsSharing} onValueChange={value => void setSharing(value)} /></View>
        <Text style={styles.muted}>{gpsNotice}</Text>
        <Text style={styles.muted}>Foreground only. Sharing stops when this screen closes, on logout, or when you switch it off. Offline positions remain queued until the server accepts them.</Text>
      </View>
    </ScrollView>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgBase },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  warning: { padding: Spacing.md, backgroundColor: Colors.bgSurface, borderColor: Colors.warning, borderWidth: 1, borderRadius: 10, flexDirection: 'row', gap: 10, marginBottom: 16 },
  warningText: { flex: 1, color: Colors.textPrimary, lineHeight: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { color: Colors.textMuted, fontSize: 11, letterSpacing: 1.5 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  card: { backgroundColor: Colors.bgSurface, padding: Spacing.md, borderRadius: 12, marginBottom: 16, gap: 8 },
  label: { color: Colors.textMuted, fontSize: 11, textTransform: 'uppercase', marginTop: 8 },
  value: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  notice: { color: Colors.warning, marginBottom: 10 },
  expired: { color: Colors.danger },
  map: { backgroundColor: Colors.bgBase, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
  segment: { color: Colors.textSecondary, paddingVertical: 3 },
  footer: { color: Colors.textMuted, lineHeight: 18, marginTop: 8 },
});
