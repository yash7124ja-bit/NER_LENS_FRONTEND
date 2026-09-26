import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from './BrandLogo';
import { Colors, Spacing, Typography } from '../theme';
import { RefreshCw, ShieldAlert } from 'lucide-react-native';
import { useNetInfo } from '@react-native-community/netinfo';

interface Props {
  driverName?: string;
  driverId?: string;
  pendingCount?: number;
  onSyncPress?: () => void;
  onSosPress?: () => void;
}

export const HeaderBar: React.FC<Props> = ({
  driverName = 'Signed-in operator',
  pendingCount = 0,
  onSyncPress,
  onSosPress,
}) => {
  const insets = useSafeAreaInsets();
  const network = useNetInfo();
  const networkLabel = network.isConnected === true ? 'NETWORK AVAILABLE'
    : network.isConnected === false ? 'OFFLINE' : 'NETWORK CHECKING';
  const topPadding = Math.max(insets.top, StatusBar.currentHeight || 0) + 8;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Top Brand Line */}
      <View style={styles.brandRow}>
        <View style={styles.brandInfo}>
          <BrandLogo size={32} color="#FFFFFF" />
          <View style={styles.brandTextGroup}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>NER LENS</Text>
              <View style={styles.govTag}>
                <Text style={styles.govTagText}>SIH DEMO</Text>
              </View>
            </View>
            <Text style={styles.corridorBadge}>NORTHEAST CORRIDOR LOGISTICS PORTAL</Text>
          </View>
        </View>

        {onSosPress && (
          <TouchableOpacity 
            style={styles.sosQuickBtn} 
            onPress={onSosPress}
            activeOpacity={0.85}
          >
            <ShieldAlert size={16} color="#FFFFFF" />
            <Text style={styles.sosQuickText}>112 HELP</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Telemetry Status Strip */}
      <View style={styles.statusStrip}>
        {/* Sync / Offline Status Pill */}
        <TouchableOpacity 
          style={[styles.chipSync, pendingCount > 0 && styles.chipSyncAmber]}
          onPress={onSyncPress}
          activeOpacity={0.7}
        >
          <RefreshCw size={12} color={pendingCount > 0 ? '#FDE68A' : '#93C5FD'} />
          <Text style={[styles.chipSyncText, pendingCount > 0 && styles.chipSyncAmberText]}>
            {pendingCount > 0 ? `QUEUE: ${pendingCount} · ${networkLabel}` : networkLabel}
          </Text>
        </TouchableOpacity>

        {/* Driver identity */}
        <View style={styles.chipDriver}>
          <Text style={styles.chipDriverText} numberOfLines={1}>{driverName}</Text>
        </View>
      </View>

      {/* Tricolor Indicator Line */}
      <View style={styles.tricolorBar}>
        <View style={[styles.tricolorStripe, { backgroundColor: '#FF9933' }]} />
        <View style={[styles.tricolorStripe, { backgroundColor: '#FFFFFF' }]} />
        <View style={[styles.tricolorStripe, { backgroundColor: '#138808' }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.govtNavy,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  brandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandTextGroup: {
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.lg,
    fontWeight: '900',
    letterSpacing: 1,
  },
  govTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  govTagText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  corridorBadge: {
    color: '#93C5FD',
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  sosQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    gap: 4,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  sosQuickText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: Typography.fontSizes.xs,
    letterSpacing: 0.5,
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chipGps: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 5,
  },
  chipGpsText: {
    color: '#86EFAC',
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  chipSync: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 5,
  },
  chipSyncAmber: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  chipSyncText: {
    color: '#E2E8F0',
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  chipSyncAmberText: {
    color: '#FDE68A',
  },
  chipDriver: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  chipDriverText: {
    color: '#CBD5E1',
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '600',
  },
  tricolorBar: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginTop: 2,
  },
  tricolorStripe: {
    flex: 1,
    height: 3,
  },
});

