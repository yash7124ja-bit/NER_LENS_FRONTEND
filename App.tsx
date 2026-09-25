import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  StatusBar, 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { Colors, Spacing, Typography, TouchTargets } from './src/theme';
import { Session } from './src/types';
import { getSession, saveSession, getSettings } from './src/services/storage';
import { setLanguage, t } from './src/services/i18n';

// Screens
import { LoginScreen } from './src/screens/LoginScreen';
import { MissionsHomeScreen } from './src/screens/MissionsHomeScreen';
import { TripNavigationScreen } from './src/screens/TripNavigationScreen';
import { RiskAlertsScreen } from './src/screens/RiskAlertsScreen';
import { FieldReportScreen } from './src/screens/FieldReportScreen';
import { SyncOutboxScreen } from './src/screens/SyncOutboxScreen';
import { ProfileSettingsScreen } from './src/screens/ProfileSettingsScreen';
import { PreTripCheckModal } from './src/screens/PreTripCheckModal';
import { EmergencySOSModal } from './src/screens/EmergencySOSModal';

// Icons
import { 
  Home, 
  Navigation, 
  AlertTriangle, 
  Camera, 
  FolderSync, 
  User 
} from 'lucide-react-native';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'trip' | 'alerts' | 'reports' | 'sync' | 'profile'>('home');
  const [showPreTripModal, setShowPreTripModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSession();
        const settings = await getSettings();
        setLanguage(settings.language);
        if (stored) {
          setSession(stored);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    await saveSession(null);
    setSession(null);
    setActiveTab('home');
  };

  if (loading) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bgBase} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.splashText}>NER LENS DRIVER</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bgBase} />
        <LoginScreen onLoginSuccess={setSession} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgBase} />

      {/* Screen Body */}
      <View style={styles.content}>
        {activeTab === 'home' && (
          <MissionsHomeScreen 
            session={session}
            onNavigateTab={tab => setActiveTab(tab as any)}
            onOpenPreTripCheck={() => setShowPreTripModal(true)}
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
          />
        )}
      </View>

      {/* Bottom Tactical Navigation HUD */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'home' && styles.navItemActive]}
          onPress={() => setActiveTab('home')}
        >
          <Home size={20} color={activeTab === 'home' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>
            {t('tabHome')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'trip' && styles.navItemActive]}
          onPress={() => setActiveTab('trip')}
        >
          <Navigation size={20} color={activeTab === 'trip' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'trip' && styles.navTextActive]}>
            {t('tabTrip')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'alerts' && styles.navItemActive]}
          onPress={() => setActiveTab('alerts')}
        >
          <AlertTriangle size={20} color={activeTab === 'alerts' ? Colors.warningBright : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'alerts' && styles.navTextActive]}>
            {t('tabAlerts')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'reports' && styles.navItemActive]}
          onPress={() => setActiveTab('reports')}
        >
          <Camera size={20} color={activeTab === 'reports' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'reports' && styles.navTextActive]}>
            {t('tabReports')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'sync' && styles.navItemActive]}
          onPress={() => setActiveTab('sync')}
        >
          <FolderSync size={20} color={activeTab === 'sync' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'sync' && styles.navTextActive]}>
            Outbox
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <User size={20} color={activeTab === 'profile' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>
            {t('tabSettings')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODALS */}
      <PreTripCheckModal 
        visible={showPreTripModal}
        onClose={() => setShowPreTripModal(false)}
        onConfirm={() => {
          setShowPreTripModal(false);
        }}
      />

      <EmergencySOSModal 
        visible={showSosModal}
        onClose={() => setShowSosModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  splash: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashText: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: Typography.fontSizes.lg,
    letterSpacing: 2,
    marginTop: Spacing.md,
  },
  content: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSurface,
    borderTopWidth: 1.5,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingBottom: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  navItemActive: {
    backgroundColor: 'rgba(0, 229, 188, 0.08)',
  },
  navText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizes.xs - 2,
    fontWeight: '600',
    marginTop: 2,
  },
  navTextActive: {
    color: Colors.primaryBright,
    fontWeight: '800',
  },
});
