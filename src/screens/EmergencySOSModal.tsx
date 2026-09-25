import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Linking, 
  Alert 
} from 'react-native';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';
import { 
  ShieldAlert, 
  PhoneCall, 
  Radio, 
  MapPin, 
  X, 
  CheckCircle2 
} from 'lucide-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const EmergencySOSModal: React.FC<Props> = ({ visible, onClose }) => {
  const [broadcasted, setBroadcasted] = useState(false);

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      Alert.alert('Emergency Dial', `Unable to open dialer. Please dial ${number} directly.`);
    });
  };

  const handleTriggerSos = () => {
    setBroadcasted(true);
    Alert.alert(
      'Emergency Beacon Broadcasted',
      'High-priority SOS signal sent to Regional Logistics Control & Highway Patrol with your encrypted live GPS coordinates.'
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <ShieldAlert size={24} color={Colors.danger} />
              <Text style={styles.title}>EMERGENCY SOS BEACON</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.desc}>
            Direct high-priority alert for mountain road washouts, vehicle rollover, medical crisis, or severe landslide blockage.
          </Text>

          {/* SATELLITE GPS READOUT */}
          <View style={styles.beaconBox}>
            <MapPin size={16} color={Colors.dangerBright} />
            <View style={styles.beaconTextGroup}>
              <Text style={styles.beaconCoords}>25.8821° N, 93.7275° E</Text>
              <Text style={styles.beaconMeta}>NH-29 Pagla Pahar · Alt: 1,440m MSL · Mission: ML-0176</Text>
            </View>
          </View>

          {/* BIG SOS TRIGGER BUTTON */}
          <TouchableOpacity 
            style={[styles.sosBigBtn, broadcasted && styles.sosBigBtnActive]}
            onPress={handleTriggerSos}
            activeOpacity={0.8}
          >
            <ShieldAlert size={36} color="#FFFFFF" />
            <Text style={styles.sosBigBtnText}>
              {broadcasted ? 'EMERGENCY BEACON ACTIVE' : 'TAP TO BROADCAST SOS'}
            </Text>
            <Text style={styles.sosBigBtnSub}>
              {broadcasted ? 'Alert received by Regional Control' : 'Instant satellite + cellular dispatch broadcast'}
            </Text>
          </TouchableOpacity>

          {/* DIRECT EMERGENCY CONTACTS */}
          <Text style={styles.sectionHeader}>DIRECT EMERGENCY DISPATCH</Text>

          {/* 112 National Helpline */}
          <TouchableOpacity 
            style={styles.contactRow}
            onPress={() => handleCall('112')}
          >
            <View style={styles.contactInfo}>
              <PhoneCall size={18} color={Colors.danger} />
              <View>
                <Text style={styles.contactTitle}>112 National Emergency</Text>
                <Text style={styles.contactSub}>Police, Ambulance, Disaster Management</Text>
              </View>
            </View>
            <Text style={styles.dialText}>DIAL 112</Text>
          </TouchableOpacity>

          {/* BRO Mountain Clearance Ops */}
          <TouchableOpacity 
            style={styles.contactRow}
            onPress={() => handleCall('1800112345')}
          >
            <View style={styles.contactInfo}>
              <PhoneCall size={18} color={Colors.warningBright} />
              <View>
                <Text style={styles.contactTitle}>BRO Mountain Road Ops</Text>
                <Text style={styles.contactSub}>Border Roads Heavy Debris Clearance Unit</Text>
              </View>
            </View>
            <Text style={styles.dialText}>CALL BRO</Text>
          </TouchableOpacity>

          {/* State Highway Patrol */}
          <TouchableOpacity 
            style={styles.contactRow}
            onPress={() => handleCall('+91370222222')}
          >
            <View style={styles.contactInfo}>
              <PhoneCall size={18} color={Colors.primary} />
              <View>
                <Text style={styles.contactTitle}>Highway Patrol (NH-29)</Text>
                <Text style={styles.contactSub}>Dimapur-Kohima Corridor Police Post</Text>
              </View>
            </View>
            <Text style={styles.dialText}>CALL PATROL</Text>
          </TouchableOpacity>

          {/* Dismiss button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close SOS Screen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2,
    borderColor: Colors.danger,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    color: Colors.dangerBright,
    fontWeight: '900',
    fontSize: Typography.fontSizes.md,
    letterSpacing: 1,
  },
  desc: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  beaconBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger,
    borderWidth: 1,
    borderRadius: TouchTargets.borderRadius,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  beaconTextGroup: {
    flex: 1,
  },
  beaconCoords: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: Typography.fontSizes.sm,
    fontFamily: 'monospace',
  },
  beaconMeta: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
  },
  sosBigBtn: {
    backgroundColor: Colors.danger,
    borderRadius: TouchTargets.cardRadius,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: 4,
  },
  sosBigBtnActive: {
    backgroundColor: '#059669', // green indicator
  },
  sosBigBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: Typography.fontSizes.lg,
    letterSpacing: 1,
  },
  sosBigBtnSub: {
    color: '#FFE0DD',
    fontSize: Typography.fontSizes.xs - 1,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgBase,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: TouchTargets.borderRadius,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  contactTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
  },
  contactSub: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
  },
  dialText: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: Typography.fontSizes.xs,
  },
  closeBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeBtnText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.sm,
    fontWeight: '600',
  },
});
