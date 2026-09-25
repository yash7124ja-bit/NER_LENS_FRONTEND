import React from 'react';
import { Text, View } from 'react-native';
import { card, colors } from '../theme/colors';

export default function MissionCard({ mission }) {
  return <View style={[card, { padding: 16, marginBottom: 20 }]}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Active Mission · {mission.id}</Text><Text style={{ color: colors.good, fontWeight: '700' }}>{mission.status}</Text></View>
    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginVertical: 12 }}>{mission.route}</Text>
    <Text style={{ color: colors.muted }}>{mission.vehicle}  ·  ETA {mission.eta}  ·  {mission.distance}</Text>
    <View style={{ height: 6, backgroundColor: '#DCE8F7', borderRadius: 4, marginTop: 16 }}><View style={{ width: `${mission.progress * 100}%`, height: 6, backgroundColor: colors.accentBlue, borderRadius: 4 }} /></View>
  </View>;
}
