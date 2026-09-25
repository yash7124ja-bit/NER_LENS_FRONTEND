import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView 
} from 'react-native';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';
import { 
  FileCheck2, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  Truck, 
  Weight, 
  X 
} from 'lucide-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const PreTripCheckModal: React.FC<Props> = ({ visible, onClose, onConfirm }) => {
  const [check1, setCheck1] = useState(true);
  const [check2, setCheck2] = useState(true);
  const [check3, setCheck3] = useState(false);
  const [check4, setCheck4] = useState(true);
  const [check5, setCheck5] = useState(false);

  const allPassed = check1 && check2 && check3 && check4 && check5;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <FileCheck2 size={20} color={Colors.primary} />
              <Text style={styles.title}>PRE-TRIP RISK INSPECTION</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.desc}>
            Verify critical vehicle and mountain road parameters before starting journey on NH-29.
          </Text>

          <ScrollView style={styles.list}>
            {/* 1. Vehicle Compatible */}
            <TouchableOpacity 
              style={[styles.checkItem, check1 && styles.checkItemActive]}
              onPress={() => setCheck1(!check1)}
            >
              <Truck size={18} color={check1 ? Colors.primary : Colors.textMuted} />
              <View style={styles.checkTextGroup}>
                <Text style={styles.checkTitle}>Vehicle Compatible (5T Heavy Truck)</Text>
                <Text style={styles.checkSub}>Engine brake & 4WD mountain clearance verified</Text>
              </View>
              <CheckCircle2 size={18} color={check1 ? Colors.primary : Colors.border} />
            </TouchableOpacity>

            {/* 2. Weight Limits */}
            <TouchableOpacity 
              style={[styles.checkItem, check2 && styles.checkItemActive]}
              onPress={() => setCheck2(!check2)}
            >
              <Weight size={18} color={check2 ? Colors.primary : Colors.textMuted} />
              <View style={styles.checkTextGroup}>
                <Text style={styles.checkTitle}>Weight Restriction Within Limit</Text>
                <Text style={styles.checkSub}>4.2T net payload &lt; 5T corridor bridge limit</Text>
              </View>
              <CheckCircle2 size={18} color={check2 ? Colors.primary : Colors.border} />
            </TouchableOpacity>

            {/* 3. Hazard Awareness */}
            <TouchableOpacity 
              style={[styles.checkItem, check3 && styles.checkItemActive]}
              onPress={() => setCheck3(!check3)}
            >
              <AlertTriangle size={18} color={check3 ? Colors.warningBright : Colors.textMuted} />
              <View style={styles.checkTextGroup}>
                <Text style={styles.checkTitle}>Active Landslide Hazard Acknowledged</Text>
                <Text style={styles.checkSub}>Km 34 Pagla Pahar caution zone briefed</Text>
              </View>
              <CheckCircle2 size={18} color={check3 ? Colors.primary : Colors.border} />
            </TouchableOpacity>

            {/* 4. Recent Ground Truth */}
            <TouchableOpacity 
              style={[styles.checkItem, check4 && styles.checkItemActive]}
              onPress={() => setCheck4(!check4)}
            >
              <FileCheck2 size={18} color={check4 ? Colors.primary : Colors.textMuted} />
              <View style={styles.checkTextGroup}>
                <Text style={styles.checkTitle}>Recent Ground Evidence Verified</Text>
                <Text style={styles.checkSub}>BRO report timestamped within last 2 hours</Text>
              </View>
              <CheckCircle2 size={18} color={check4 ? Colors.primary : Colors.border} />
            </TouchableOpacity>

            {/* 5. Connectivity Gaps */}
            <TouchableOpacity 
              style={[styles.checkItem, check5 && styles.checkItemActive]}
              onPress={() => setCheck5(!check5)}
            >
              <Radio size={18} color={check5 ? Colors.primary : Colors.textMuted} />
              <View style={styles.checkTextGroup}>
                <Text style={styles.checkTitle}>Connectivity Gaps (Km 60-80 Blindspot)</Text>
                <Text style={styles.checkSub}>Offline store-and-forward outbox armed</Text>
              </View>
              <CheckCircle2 size={18} color={check5 ? Colors.primary : Colors.border} />
            </TouchableOpacity>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity 
            style={[styles.confirmBtn, !allPassed && styles.confirmBtnDisabled]}
            onPress={() => {
              if (allPassed) {
                onConfirm();
                onClose();
              }
            }}
            disabled={!allPassed}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>
              {allPassed ? 'Confirm & Start Mission' : 'Complete All 5 Checks to Proceed'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: Typography.fontSizes.sm,
    letterSpacing: 0.8,
  },
  desc: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
    marginBottom: Spacing.md,
  },
  list: {
    marginBottom: Spacing.md,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: TouchTargets.borderRadius,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  checkItemActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  checkTextGroup: {
    flex: 1,
  },
  checkTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
  },
  checkSub: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
    marginTop: 2,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: Typography.fontSizes.sm,
  },
});
