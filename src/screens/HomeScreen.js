import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import MissionCard from '../components/MissionCard';
import QuickActionButton from '../components/QuickActionButton';
import { getActiveMission } from '../services/api';
import { card, colors } from '../theme/colors';

export default function HomeScreen({ navigation }) {
  const [mission, setMission] = useState(null);
  useEffect(() => { getActiveMission('demo-user').then(setMission); }, []);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgLight }}><ScrollView contentContainerStyle={{ padding: 20 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}><View><Text style={{ color: colors.text, fontSize: 25, fontWeight: '800' }}>Good Morning, Rehan</Text><Text style={{ color: colors.muted, marginTop: 4 }}>Stay safe. Your mission matters.</Text></View><Text style={{ fontSize: 25 }}>🔔</Text></View>
    {mission && <MissionCard mission={mission} />}
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>Quick Actions</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <QuickActionButton label="View Route" icon="🗺️" onPress={() => navigation.navigate('Map')} />
      <QuickActionButton label="Report Incident" icon="⚠️" onPress={() => navigation.navigate('ReportIncident')} />
      <QuickActionButton label="My Routes" icon="🛣️" onPress={() => {}} />
      <QuickActionButton label="Offline Reports" icon="📋" onPress={() => navigation.navigate('Reports')} />
    </View>
    <Pressable onPress={() => navigation.navigate('RiskAlerts')} style={[card, { padding: 16, marginTop: 8 }]}><Text style={{ color: colors.high, fontWeight: '800' }}>View Risk Alerts</Text><Text style={{ color: colors.muted, marginTop: 4 }}>Stay informed about hazards ahead →</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
