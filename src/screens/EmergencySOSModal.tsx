import React from 'react';
import { Alert, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PhoneCall, ShieldAlert, X } from 'lucide-react-native';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const EmergencySOSModal: React.FC<Props> = ({ visible, onClose }) => {
  const callEmergency = () => {
    Linking.openURL('tel:112').catch(() => {
      Alert.alert('Dial 112', 'The dialer could not be opened. Dial 112 directly for emergency help.');
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <ShieldAlert size={24} color={Colors.danger} />
            <Text style={styles.title}>EMERGENCY HELP</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close emergency help">
              <X size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.description}>
            For an immediate emergency in India, call 112. Tell the operator your location, nearby landmarks, and the nature of the incident.
          </Text>
          <TouchableOpacity style={styles.callButton} onPress={callEmergency} accessibilityRole="button">
            <PhoneCall size={24} color="#FFFFFF" />
            <Text style={styles.callText}>OPEN DIALER · 112</Text>
          </TouchableOpacity>
          <Text style={styles.notice}>This app opens your phone dialer. It does not send an SOS or your location to dispatch.</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  card: { backgroundColor: Colors.bgSurface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: 2, borderColor: Colors.danger, padding: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, color: Colors.danger, fontWeight: '900', fontSize: Typography.fontSizes.md },
  description: { color: Colors.textPrimary, fontSize: Typography.fontSizes.sm,
    lineHeight: 22, marginVertical: Spacing.lg },
  callButton: { backgroundColor: Colors.danger, borderRadius: TouchTargets.borderRadius,
    minHeight: TouchTargets.buttonMinHeight, flexDirection: 'row', gap: Spacing.sm,
    alignItems: 'center', justifyContent: 'center' },
  callText: { color: '#FFFFFF', fontWeight: '900', fontSize: Typography.fontSizes.md },
  notice: { color: Colors.textMuted, fontSize: Typography.fontSizes.xs, marginTop: Spacing.md, lineHeight: 18 },
});
