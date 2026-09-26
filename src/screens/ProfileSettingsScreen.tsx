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
import { Session, LanguageCode, CachedMission } from '../types';
import { clearCurrentAccountCache, getCachedMissions, getSettings, saveSettings } from '../services/storage';
import { setLanguage, getLanguage, t } from '../services/i18n';
import { SyncQueueManager } from '../services/syncQueue';
import { 
  User, 
  Truck, 
  Languages, 
  Radio, 
  Server, 
  Trash2, 
  LogOut, 
  Check, 
} from 'lucide-react-native';

interface Props {
  session: Session;
  onLogout: () => void;
  onOpenSos: () => void;
  onOpenOutbox?: () => void;
}

export const ProfileSettingsScreen: React.FC<Props> = ({ 
  session, 
  onLogout, 
  onOpenSos,
  onOpenOutbox 
}) => {
  const [lang, setLang] = useState<LanguageCode>(getLanguage());
  const [serverUrl, setServerUrl] = useState('https://ner-lens.yash7124ja.workers.dev/v1');
  const [assignedMission, setAssignedMission] = useState<CachedMission | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setLang(s.language);
      setServerUrl(s.serverUrl);
      const missions = await getCachedMissions(session.user.actor_id);
      setAssignedMission(missions.find(m => m.state === 'active') || missions[0] || null);
    })();
  }, [session.user.actor_id]);

  const handleLanguageChange = async (newLang: LanguageCode) => {
    setLang(newLang);
    setLanguage(newLang);
    await saveSettings({ language: newLang });
    Alert.alert('Language Updated', newLang === 'as' ? 'ভাষা অসমীয়ালৈ সলনি কৰা হৈছে।' : 'Language changed to English.');
  };

  const handleClearCache = async () => {
    if (await SyncQueueManager.getPendingCount(session.user.actor_id)) {
      Alert.alert('Pending work on device', 'Sync or resolve queued mission actions and alert decisions before clearing the trip cache.');
      return;
    }
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
        onSyncPress={onOpenOutbox}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.ribbon}>
          <Text style={styles.title}>DRIVER CONSOLE & SETTINGS</Text>
          <Text style={styles.subtitle}>
            Account identity, saved mission assignment, and offline outbox control.
          </Text>
        </View>

        {/* DRIVER IDENTITY CARD */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <User size={28} color="#FFFFFF" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.driverName}>{session.user.display_name}</Text>
              <Text style={styles.driverEmail}>{session.user.email || 'Authorized Corridor Operator'}</Text>
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

        {/* OFFLINE STORE-AND-FORWARD OUTBOX */}
        <Text style={styles.sectionHeader}>OFFLINE QUEUE & REPLAY ENGINE</Text>
        <View style={styles.card}>
          <View style={styles.specRow}>
            <Radio size={18} color={Colors.primary} />
            <Text style={styles.specLabel}>Local Queue Status:</Text>
            <Text style={styles.specValue}>Inspect outbox for pending work</Text>
          </View>
          {onOpenOutbox && (
            <TouchableOpacity 
              style={styles.outboxActionBtn} 
              onPress={onOpenOutbox}
              activeOpacity={0.8}
            >
              <Text style={styles.outboxActionText}>Inspect Outbox Queue & Sync</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Assignment from the latest saved server mission. */}
        <Text style={styles.sectionHeader}>SAVED VEHICLE ASSIGNMENT</Text>
        <View style={styles.card}>
          <View style={styles.specRow}>
            <Truck size={18} color={Colors.primary} />
            <Text style={styles.specLabel}>Assigned Unit:</Text>
            <Text style={styles.specValue}>{assignedMission?.vehicle_id || 'No vehicle assignment saved'}</Text>
          </View>
          <View style={styles.specRow}>
            <Truck size={18} color={Colors.primary} />
            <Text style={styles.specLabel}>Category:</Text>
            <Text style={styles.specValue}>{assignedMission?.vehicle_type || 'Vehicle type unavailable'}</Text>
          </View>
        </View>

        {/* MULTILINGUAL LANGUAGE SELECTOR */}
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
          <Trash2 size={16} color={Colors.warningDark} />
          <Text style={styles.purgeBtnText}>Purge Local Trip Cache</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <LogOut size={16} color={Colors.danger} />
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.govtNavy,
    borderWidth: 2,
    borderColor: '#93C5FD',
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
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  roleText: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs - 3,
    fontWeight: '800',
  },
  sectionHeader: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.xs,
    fontWeight: '800',
    letterSpacing: 0.6,
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
  outboxActionBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  outboxActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Typography.fontSizes.xs,
    letterSpacing: 0.5,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: Spacing.sm,
  },
  langRowSelected: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
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
    color: Colors.primary,
    fontSize: Typography.fontSizes.xs,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  purgeBtn: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  purgeBtnText: {
    color: '#B45309',
    fontWeight: '700',
    fontSize: Typography.fontSizes.sm,
  },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    height: TouchTargets.buttonMinHeight,
    borderRadius: TouchTargets.borderRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: Typography.fontSizes.sm,
  },
});
