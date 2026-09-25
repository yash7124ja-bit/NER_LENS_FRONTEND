import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import IncidentTypeButton from '../components/IncidentTypeButton';
import { submitIncidentReport } from '../services/api';
import { colors, card } from '../theme/colors';

const types = ['Road Blocked', 'Landslide', 'Heavy Rain', 'Accident', 'Bad Road', 'Vehicle Problem', 'Other'];
export default function ReportIncidentScreen({ navigation }) {
  const [selected, setSelected] = useState('');
  const [description, setDescription] = useState('');
  const submit = async () => { await submitIncidentReport({ type: selected, description }); Alert.alert('Report queued', 'Your report will be synced when online.'); navigation.goBack(); };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgLight }}><ScrollView contentContainerStyle={{ padding: 20 }}><Text onPress={() => navigation.goBack()} style={{ color: colors.accentBlue }}>‹ Back</Text><Text style={{ color: colors.text, fontSize: 25, fontWeight: '800', marginVertical: 14 }}>Report Incident</Text><Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 12 }}>What happened?</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>{types.map((type) => <IncidentTypeButton key={type} label={type} selected={selected === type} onPress={() => setSelected(type)} />)}</View>
    <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 12, marginBottom: 10 }}>Add Evidence</Text><View style={{ flexDirection: 'row' }}><Pressable style={[card, { padding: 14, marginRight: 10 }]}><Text>📷 Photo/Video</Text></Pressable><Pressable style={[card, { padding: 14 }]}><Text>📸 Use Camera</Text></Pressable></View><Text style={{ color: colors.muted, marginVertical: 16 }}>＋  Add thumbnails</Text>
    <View style={[card, { padding: 14, marginBottom: 14 }]}><Text style={{ color: colors.text, fontWeight: '700' }}>📍 GPS Location</Text><Text style={{ color: colors.muted, marginTop: 6 }}>25.6747° N, 94.1086° E · Auto-filled  ✎</Text></View>
    <TextInput multiline maxLength={300} value={description} onChangeText={setDescription} placeholder="Description (optional)" style={{ backgroundColor: '#FFF', minHeight: 100, borderRadius: 10, padding: 14, textAlignVertical: 'top' }} /><Text style={{ color: colors.muted, textAlign: 'right', marginTop: 4 }}>{description.length}/300</Text>
    <Pressable onPress={submit} style={{ backgroundColor: colors.accentBlue, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 18 }}><Text style={{ color: '#FFF', fontWeight: '800' }}>Submit Report</Text></Pressable><Text style={{ color: colors.muted, textAlign: 'center', marginTop: 10 }}>Offline mode — Report will be saved and synced later.</Text></ScrollView></SafeAreaView>;
}
