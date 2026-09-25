import React from 'react';
import { Text, View } from 'react-native';
import { card, colors } from '../theme/colors';
export default function AlertCard({ alert }) {
  const color = alert.severity === 'High' ? colors.high : colors.medium;
  return <View style={[card, { padding: 14, marginBottom: 12, flexDirection: 'row' }]}><Text style={{ fontSize: 28, marginRight: 12 }}>{alert.image}</Text><View style={{ flex: 1 }}><Text style={{ color, fontWeight: '700' }}>{alert.severity} · {alert.distance}</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginVertical: 4 }}>{alert.title}</Text><Text style={{ color: colors.muted }}>{alert.source} · {alert.time}</Text></View></View>;
}
