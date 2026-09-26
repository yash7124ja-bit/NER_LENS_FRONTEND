import React, { useState, useEffect } from 'react';
import { 
  StatusBar, 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from './src/theme';
import { Session } from './src/types';
import { getSession, saveSession, getSettings } from './src/services/storage';
import { setLanguage, t } from './src/services/i18n';
import { ApiClient } from './src/services/api';
import { SyncQueueManager } from './src/services/syncQueue';
import NetInfo from '@react-native-community/netinfo';

// Screens
import { LoginScreen } from './src/screens/LoginScreen';
import { MissionsHomeScreen } from './src/screens/MissionsHomeScreen';
import { TripNavigationScreen } from './src/screens/TripNavigationScreen';
import { RiskAlertsScreen } from './src/screens/RiskAlertsScreen';
import { FieldReportScreen } from './src/screens/FieldReportScreen';
import { SyncOutboxScreen } from './src/screens/SyncOutboxScreen';
import { ProfileSettingsScreen } from './src/screens/ProfileSettingsScreen';
import { EmergencySOSModal } from './src/screens/EmergencySOSModal';

// Icons
import { 
  Home, 
  Navigation, 
  AlertTriangle, 
  Camera, 
  User 
} from 'lucide-react-native';

function MainNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'trip' | 'alerts' | 'reports' | 'sync' | 'profile'>('home');
  const [showSosModal, setShowSosModal] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSession();
        const settings = await getSettings();
        setLanguage(settings.language);
        if (stored && new Date(stored.expires_at).getTime() > Date.now()) {
          try {
            const current = await ApiClient.session();
            await saveSession(current);
            setSession(current);
          } catch (error) {
            if (error instanceof Error && error.message === 'Unauthorized') {
              await saveSession(null);
            } else {
              setSession(stored); // Valid cached identity remains available offline.
            }
          }
        } else if (stored) {
          await saveSession(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!session) return;
    const owner = session.user.actor_id;
    void SyncQueueManager.syncAll(owner);
    return NetInfo.addEventListener(state => {
      if (state.isConnected) void SyncQueueManager.syncAll(owner);
    });
  }, [session]);

  const handleLogout = async () => {
    try { await ApiClient.logout(); } catch { /* Clear the local view even without a connection. */ }
    await saveSession(null);
    setSession(null);
    setActiveTab('home');
  };

  if (loading) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.govtNavy} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.splashTitle}>NER LENS</Text>
        <Text style={styles.splashText}>SIH 2026 · CORRIDOR LOGISTICS DEMO</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top, StatusBar.currentHeight || 0) }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.govtNavy} />
        <LoginScreen onLoginSuccess={setSession} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.govtNavy} />

      {/* Screen Body */}
      <View style={styles.content}>
        {activeTab === 'home' && (
          <MissionsHomeScreen 
            session={session}
            onNavigateTab={tab => setActiveTab(tab as any)}
            onOpenSos={() => setShowSosModal(true)}
          />
        )}
        {activeTab === 'trip' && (
          <TripNavigationScreen 
            session={session}
            onNavigateTab={tab => setActiveTab(tab as any)}
            onOpenSos={() => setShowSosModal(true)}
          />
        )}
        {activeTab === 'alerts' && (
          <RiskAlertsScreen 
            session={session}
            onNavigateTab={tab => setActiveTab(tab as any)}
            onOpenSos={() => setShowSosModal(true)}
          />
        )}
        {activeTab === 'reports' && (
          <FieldReportScreen 
            session={session}
            onNavigateTab={tab => setActiveTab(tab as any)}
            onOpenSos={() => setShowSosModal(true)}
          />
        )}
        {activeTab === 'sync' && (
          <SyncOutboxScreen 
            session={session}
            onNavigateTab={tab => setActiveTab(tab as any)}
            onOpenSos={() => setShowSosModal(true)}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileSettingsScreen 
            session={session}
            onLogout={handleLogout}
            onOpenSos={() => setShowSosModal(true)}
            onOpenOutbox={() => setActiveTab('sync')}
          />
        )}
      </View>

      {/* Bottom Government Navigation Bar (5 well-proportioned tabs) */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'home' && styles.navItemActive]}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.7}
        >
          <Home size={22} color={activeTab === 'home' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'trip' && styles.navItemActive]}
          onPress={() => setActiveTab('trip')}
          activeOpacity={0.7}
        >
          <Navigation size={22} color={activeTab === 'trip' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'trip' && styles.navTextActive]}>
            Route
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'alerts' && styles.navItemActive]}
          onPress={() => setActiveTab('alerts')}
          activeOpacity={0.7}
        >
          <AlertTriangle size={22} color={activeTab === 'alerts' ? Colors.warning : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'alerts' && styles.navTextActive]}>
            Alerts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'reports' && styles.navItemActive]}
          onPress={() => setActiveTab('reports')}
          activeOpacity={0.7}
        >
          <Camera size={22} color={activeTab === 'reports' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'reports' && styles.navTextActive]}>
            Report
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, (activeTab === 'profile' || activeTab === 'sync') && styles.navItemActive]}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.7}
        >
          <User size={22} color={(activeTab === 'profile' || activeTab === 'sync') ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, (activeTab === 'profile' || activeTab === 'sync') && styles.navTextActive]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODALS */}
      <EmergencySOSModal 
        visible={showSosModal}
        onClose={() => setShowSosModal(false)}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  splash: {
    flex: 1,
    backgroundColor: Colors.govtNavy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: Typography.fontSizes.xl,
    letterSpacing: 2,
    marginTop: Spacing.md,
  },
  splashText: {
    color: '#93C5FD',
    fontWeight: '700',
    fontSize: Typography.fontSizes.xs,
    letterSpacing: 1,
    marginTop: 6,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 6,
  },
  navItemActive: {
    backgroundColor: 'rgba(29, 78, 216, 0.08)',
  },
  navText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  navTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
});

