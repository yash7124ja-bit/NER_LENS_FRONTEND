import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import AlertCard from '../components/AlertCard';
import { getRiskAlerts } from '../services/api';
import { colors, card } from '../theme/colors';
export default function RiskAlertsScreen({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => { getRiskAlerts('ML-0176').then(setAlerts); }, []);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgLight }}><ScrollView contentContainerStyle={{ padding: 20 }}><Text onPress={() => navigation.goBack()} style={{ color: colors.accentBlue }}>‹ Back</Text><Text style={{ color: colors.text, fontSize: 25, fontWeight: '800', marginVertical: 14 }}>Risk Alerts 🔍</Text><View style={{ flexDirection: 'row', marginBottom: 16 }}>{['All (4)', 'High (2)', 'Medium (1)', 'Low (1)'].map((filter) => <Text key={filter} style={[card, { padding: 8, marginRight: 6, color: colors.text }]}>{filter}</Text>)}</View>{alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)}<View style={[card, { padding: 14, marginTop: 4 }]}><Text style={{ color: colors.good, fontWeight: '700' }}>Evidence freshness</Text><Text style={{ color: colors.muted, marginTop: 4 }}>All alerts are up to date</Text></View></ScrollView></SafeAreaView>;
}
