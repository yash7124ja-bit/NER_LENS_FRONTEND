import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { BrandLogo } from '../components/BrandLogo';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';
import { ApiClient } from '../services/api';
import { saveSession } from '../services/storage';
import { Session } from '../types';
import { Truck, ShieldCheck, KeyRound, Server } from 'lucide-react-native';
import { t } from '../services/i18n';

interface Props {
  onLoginSuccess: (session: Session) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (overrideEmail?: string, overridePass?: string) => {
    const targetEmail = overrideEmail || email;
    const targetPass = overridePass || password || 'demo123';

    if (!targetEmail.trim()) {
      setError('Please provide Driver ID or email address');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await ApiClient.login(targetEmail, targetPass);
      await saveSession(session);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Login failed. Check server gateway connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Brand Header */}
        <View style={styles.header}>
          <BrandLogo size={56} />
          <Text style={styles.title}>NER LENS</Text>
          <Text style={styles.subtitle}>DRIVER & CORRIDOR CONSOLE</Text>
          <Text style={styles.tagline}>{t('appSubtitle')}</Text>
        </View>

        {/* Console Box */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('loginTitle')}</Text>
          <Text style={styles.cardDesc}>{t('loginSubtitle')}</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <Text style={styles.label}>{t('emailLabel')}</Text>
          <View style={styles.inputRow}>
            <Truck size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="e.g. driver-042 or driver.rehan@nerlens.org"
              placeholderTextColor={Colors.textDisabled}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
          <Text style={styles.label}>{t('passwordLabel')}</Text>
          <View style={styles.inputRow}>
            <KeyRound size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor={Colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Sign In CTA */}
          <TouchableOpacity 
            style={[styles.primaryBtn, loading && styles.btnDisabled]} 
            onPress={() => handleLogin()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.bgBase} />
            ) : (
              <Text style={styles.primaryBtnText}>{t('signInButton')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Driver Accounts */}
        <View style={styles.presetsBox}>
          <Text style={styles.presetTitle}>{t('quickPresets')}</Text>
          
          <TouchableOpacity 
            style={styles.presetBtn}
            onPress={() => handleLogin('driver.rehan@nerlens.org', 'rehan123')}
            activeOpacity={0.7}
          >
            <ShieldCheck size={18} color={Colors.primary} />
            <View style={styles.presetTextGroup}>
              <Text style={styles.presetName}>Rehan Verma (Driver DRV-042)</Text>
              <Text style={styles.presetDesc}>Assigned: Dimapur → Kohima (5T Refrigerator Truck)</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.presetBtn}
            onPress={() => handleLogin('driver.ao@nerlens.org', 'ao123')}
            activeOpacity={0.7}
          >
            <ShieldCheck size={18} color={Colors.warning} />
            <View style={styles.presetTextGroup}>
              <Text style={styles.presetName}>T. Ao (Senior Driver + Field Reporter)</Text>
              <Text style={styles.presetDesc}>Dual-Role Driver with Ground Truth Camera Access</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Offline Security Note */}
        <View style={styles.securityNote}>
          <Server size={14} color={Colors.textMuted} />
          <Text style={styles.securityNoteText}>{t('offlineModeNotice')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  scroll: {
    padding: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSizes.xxl,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 2,
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  tagline: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: TouchTargets.cardRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  errorBox: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger,
    borderWidth: 1,
    borderRadius: 6,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.dangerBright,
    fontSize: Typography.fontSizes.sm,
  },
  label: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgBase,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: TouchTargets.borderRadius,
    paddingHorizontal: Spacing.sm,
    height: TouchTargets.inputHeight,
    marginBottom: Spacing.md,
    gap: 8,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.md,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: Colors.bgBase,
    fontSize: Typography.fontSizes.md,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  presetsBox: {
    backgroundColor: Colors.bgSurfaceRaised,
    borderRadius: TouchTargets.cardRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  presetTitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: TouchTargets.borderRadius,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  presetTextGroup: {
    flex: 1,
  },
  presetName: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  presetDesc: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
  },
  securityNoteText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    flex: 1,
  },
});
