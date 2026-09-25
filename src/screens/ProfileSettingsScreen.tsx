import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { HeaderBar } from '../components/HeaderBar';
import { Colors, Spacing, Typography, TouchTargets } from '../theme';
import { Session, LanguageCode } from '../types';
import { clearCurrentAccountCache, getSettings, saveSettings } from '../services/storage';
import { setLanguage, getLanguage, t } from '../services/i18n';
import { 
  User, 
  Truck, 
  Languages, 
  Radio, 
  Server, 
  Trash2, 
  LogOut, 
  Check, 
  ShieldCheck 
} from 'lucide-react-native';

interface Props {
  session: Session;
  onLogout: () => void;
  onOpenSos: () => void;
}

export const ProfileSettingsScreen: React.FC<Props> = ({ session, onLogout, onOpenSos }) => {
  const [lang, setLang] = useState<LanguageCode>(getLanguage());
  const [serverUrl, setServerUrl] = useState('https://ner-lens.yash7124ja.workers.dev/v1');

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setLang(s.language);
      setServerUrl(s.serverUrl);
    })();
  }, []);

  const handleLanguageChange = async (newLang: LanguageCode) => {
    setLang(newLang);
    setLanguage(newLang);
    await saveSettings({ language: newLang });
    Alert.alert('Language Updated', newLang === 'as' ? 'ভাষা অসমীয়ালৈ সলনি কৰা হৈছে।' : 'Language changed to English.');
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Purge Device Cache',
      'This will erase local copies of missions and alerts for this account, leaving server authority intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Purge Cache', 
          style: 'destructive',
          onPress: async () => {
            await clearCurrentAccountCache(session.user.actor_id);
            Alert.alert('Cache Purged', 'Local private cache cleared successfully.');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <HeaderBar 
        driverName={session.user.display_name}
        onSosPress={onOpenSos}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.ribbon}>
          <Text style={styles.title}>DRIVER CONSOLE & SETTINGS</Text>
          <Text style={styles.subtitle}>
            Vehicle profile, language preferences, and cryptographic cache control.
          </Text>
        </View>

        {/* DRIVER IDENTITY CARD */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <User size={28} color={Colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.driverName}>{session.user.display_name}</Text>
              <Text style={styles.driverEmail}>{session.user.email || 'Authenticated Driver'}</Text>
              <View style={styles.roleRow}>
                {session.user.roles.map(r => (
                  <View key={r} style={styles.rolePill}>
                    <Text style={styles.roleText}>{r.toUpperCase().replace('_', ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* VEHICLE TELEMETRY PROFILE */}
        <Text style={styles.sectionHeader}>ASSIGNED VEHICLE SPECIFICATIONS</Text>
        <View style={styles.card}>
          <View style={styles.specRow}>
            <Truck size={18} color={Colors.primary} />
            <Text style={styles.specLabel}>Assigned Unit:</Text>
            <Text style={styles.specValue}>NL-07-EA-3892</Text>
          </View>
          <View style={styles.specRow}>
            <ShieldCheck size={18} color={Colors.primary} />
            <Text style={styles.specLabel}>Category:</Text>
            <Text style={styles.specValue}>5T Heavy Utility (Cold Chain)</Text>
          </View>
          <View style={styles.specRow}>
            <Radio size={18} color={Colors.warningBright} />
            <Text style={styles.specLabel}>Clearance Profile:</Text>
            <Text style={styles.specValue}>3.4m Width · 3.8m Height</Text>
          </View>
        </View>

        {/* MULTILINGUAL LANGUAGE SELECTOR (SIH Requirement) */}
        <Text style={styles.sectionHeader}>LANGUAGE / ভাষা (MULTILINGUAL SUPPORT)</Text>
        <View style={styles.card}>
          <TouchableOpacity 
            style={[styles.langRow, lang === 'en' && styles.langRowSelected]}
            onPress={() => handleLanguageChange('en')}
          >
            <Languages size={18} color={lang === 'en' ? Colors.primary : Colors.textMuted} />
            <View style={styles.langTextGroup}>
              <Text style={styles.langTitle}>English (Operational Standard)</Text>
              <Text style={styles.langSub}>Official corridor logistics terminology</Text>
            </View>
            {lang === 'en' && <Check size={18} color={Colors.primary} />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.langRow, lang === 'as' && styles.langRowSelected, { borderBottomWidth: 0 }]}
            onPress={() => handleLanguageChange('as')}
          >
            <Languages size={18} color={lang === 'as' ? Colors.primary : Colors.textMuted} />
            <View style={styles.langTextGroup}>
              <Text style={styles.langTitle}>অসমীয়া (Assamese)</Text>
              <Text style={styles.langSub}>উত্তৰ-পূব আঞ্চলিক ভাষা সমৰ্থন</Text>
            </View>
            {lang === 'as' && <Check size={18} color={Colors.primary} />}
          </TouchableOpacity>
        </View>

        {/* SERVER GATEWAY CONNECTION */}
        <Text style={styles.sectionHeader}>BACKEND INTEGRATION GATEWAY</Text>
        <View style={styles.card}>
          <View style={styles.serverRow}>
            <Server size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.serverLabel}>Active Cloudflare API Gateway:</Text>
              <Text style={styles.serverUrl} numberOfLines={1}>{serverUrl}</Text>
            </View>
          </View>
        </View>

        {/* DATA PURGE & SIGN OUT */}
        <TouchableOpacity style={styles.purgeBtn} onPress={handleClearCache}>
          <Trash2 size={16} color={Colors.warningBright} />
          <Text style={styles.purgeBtnText}>Purge Local Trip Cache</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <LogOut size={16} color={Colors.dangerBright} />
          <Text style={styles.logoutBtnText}>{t('signOut')}</Text>
        </TouchableOpacity>
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
  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: TouchTargets.cardRadius,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.bgSurfaceRaised,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  driverName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.md,
    fontWeight: '800',
  },
  driverEmail: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
    marginTop: 2,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  rolePill: {
    backgroundColor: Colors.primaryDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  roleText: {
    color: Colors.primaryBright,
    fontSize: Typography.fontSizes.xs - 3,
    fontWeight: '800',
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 1,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  specLabel: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs,
  },
  specValue: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  langRowSelected: {
    backgroundColor: 'rgba(0, 229, 188, 0.05)',
  },
  langTextGroup: {
    flex: 1,
  },
  langTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
  },
  langSub: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  serverLabel: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
  },
  serverUrl: {
    color: Colors.primaryBright,
    fontSize: Typography.fontSizes.xs,
    fontFamily: 'monospace',
  },
  purgeBtn: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.warning,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  purgeBtnText: {
    color: Colors.warningBright,
    fontWeight: '700',
    fontSize: Typography.fontSizes.sm,
  },
  logoutBtn: {
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger,
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutBtnText: {
    color: Colors.dangerBright,
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
});
