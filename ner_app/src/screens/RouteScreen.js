import React, { useEffect, useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { getRouteDetails } from '../services/api';
import { card, colors } from '../theme/colors';
export default function RouteScreen({ navigation }) {
  const [data, setData] = useState(null);
  useEffect(() => { getRouteDetails('ML-0176').then(setData); }, []);
  if (!data) return null;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgLight }}><View style={{ padding: 20 }}><Text onPress={() => navigation.goBack()} style={{ color: colors.accentBlue, marginBottom: 12 }}>‹ Back</Text><Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>Route & Navigation 🗺️</Text>
    <View style={{ height: 280, backgroundColor: '#B9D7C6', borderRadius: 12, marginVertical: 18, position: 'relative', justifyContent: 'space-between', padding: 18 }}><Text style={{ color: colors.good, fontWeight: '800' }}>📍 {data.pickup}</Text>{data.hazards.map((hazard) => <Text key={hazard.top} style={{ position: 'absolute', top: hazard.top, left: hazard.left, backgroundColor: colors.high, color: '#FFF', borderRadius: 15, padding: 6 }}>⚠</Text>)}<Text style={{ alignSelf: 'flex-end', color: colors.high, fontWeight: '800' }}>📍 {data.destination}</Text></View>
    <View style={[card, { padding: 16 }]}><Text style={{ fontSize: 17, color: colors.text, fontWeight: '800' }}>Why this route?</Text><Text style={{ marginTop: 12, color: colors.text }}>Recommended Route</Text><Text style={{ marginTop: 8, color: colors.good }}>Lower landslide risk (Good)</Text><Text style={{ marginTop: 8, color: colors.medium }}>Suitable for vehicle (OK)</Text><Text style={{ marginTop: 8, color: colors.text }}>Recent evidence available <Text style={{ color: colors.good }}>Fresh</Text> · Last update 2h ago</Text></View>
    <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 18 }}>ETA {data.eta}  ·  Distance {data.distance}</Text></View></SafeAreaView>;
}
