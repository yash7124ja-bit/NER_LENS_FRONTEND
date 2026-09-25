import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import ReportCard from '../components/ReportCard';
import { getQueuedReports, syncReports } from '../services/api';
import { card, colors } from '../theme/colors';

export default function OfflineReportsScreen() {
  const [reports, setReports] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { getQueuedReports().then(setReports); }, []);
  const sync = async () => { setSyncing(true); const result = await syncReports(); setSyncing(false); setMessage(`${result.synced} reports synced successfully`); };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgLight }}><ScrollView contentContainerStyle={{ padding: 20 }}><Text style={{ color: colors.text, fontSize: 25, fontWeight: '800', marginBottom: 16 }}>Offline & Ground Reports</Text><View style={[card, { padding: 14, backgroundColor: '#FFF4E9', marginBottom: 14 }]}><Text style={{ color: colors.medium, fontWeight: '800' }}>📶 Offline Mode — No internet connection</Text></View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View style={[card, { padding: 14, width: '48%' }]}><Text style={{ color: colors.text, fontWeight: '800' }}>3 Reports Queued</Text><Text style={{ color: colors.muted, marginTop: 5 }}>Waiting to sync</Text></View><View style={[card, { padding: 14, width: '48%' }]}><Text style={{ color: colors.text, fontWeight: '800' }}>Last Sync</Text><Text style={{ color: colors.muted, marginTop: 5 }}>2h ago (when online)</Text></View></View><Pressable onPress={sync} style={{ backgroundColor: colors.accentBlue, padding: 15, borderRadius: 10, alignItems: 'center', marginVertical: 20 }}>{syncing ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>Sync Now</Text>}</Pressable>{message ? <Text style={{ color: colors.good, textAlign: 'center', marginBottom: 16 }}>{message}</Text> : null}<Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 }}>Recent Field Reports</Text>{reports.map((report) => <ReportCard key={report.id} report={report} />)}</ScrollView></SafeAreaView>;
}
