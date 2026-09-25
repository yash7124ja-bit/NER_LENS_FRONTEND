import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BrandLogo } from './BrandLogo';
import { Colors, Spacing, Typography } from '../theme';
import { Radio, RefreshCw, ShieldAlert } from 'lucide-react-native';

interface Props {
  driverName?: string;
  driverId?: string;
  pendingCount?: number;
  isOnline?: boolean;
  onSyncPress?: () => void;
  onSosPress?: () => void;
}

export const HeaderBar: React.FC<Props> = ({
  driverName = 'Driver DRV-042',
  pendingCount = 0,
  isOnline = true,
  onSyncPress,
  onSosPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Top Brand Line */}
      <View style={styles.brandRow}>
        <View style={styles.brandInfo}>
          <BrandLogo size={30} />
          <View style={styles.brandTextGroup}>
            <Text style={styles.brandTitle}>NER LENS</Text>
            <Text style={styles.corridorBadge}>NORTHEAST CORRIDOR LOGISTICS</Text>
          </View>
        </View>

        {onSosPress && (
          <TouchableOpacity 
            style={styles.sosQuickBtn} 
            onPress={onSosPress}
            activeOpacity={0.8}
          >
            <ShieldAlert size={16} color="#FFFFFF" />
            <Text style={styles.sosQuickText}>SOS</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Telemetry Status Strip */}
      <View style={styles.statusStrip}>
        {/* GPS Telemetry Pill */}
        <View style={styles.chipGps}>
          <Radio size={12} color={Colors.primary} />
          <Text style={styles.chipGpsText}>GPS LOCKED (NH-29)</Text>
        </View>

        {/* Sync / Offline Status Pill */}
        <TouchableOpacity 
          style={[styles.chipSync, pendingCount > 0 && styles.chipSyncAmber]}
          onPress={onSyncPress}
          activeOpacity={0.7}
        >
          <RefreshCw size={12} color={pendingCount > 0 ? Colors.warning : Colors.primary} />
          <Text style={[styles.chipSyncText, pendingCount > 0 && styles.chipSyncAmberText]}>
            {pendingCount > 0 ? `QUEUE: ${pendingCount} SAVED` : (isOnline ? 'LIVE CLOUD LINK' : 'OFFLINE MODE')}
          </Text>
        </TouchableOpacity>

        {/* Driver identity */}
        <View style={styles.chipDriver}>
          <Text style={styles.chipDriverText} numberOfLines={1}>{driverName}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgBase,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
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
  brandTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.lg,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  corridorBadge: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sosQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
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
  },
  chipGps: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  chipGpsText: {
    color: Colors.primaryBright,
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  chipSync: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  chipSyncAmber: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warningDim,
  },
  chipSyncText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  chipSyncAmberText: {
    color: Colors.warningBright,
  },
  chipDriver: {
    backgroundColor: Colors.bgSurfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipDriverText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '500',
  }
});
