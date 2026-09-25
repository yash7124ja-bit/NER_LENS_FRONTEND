import React from 'react';
import { Pressable, Text } from 'react-native';
import { card, colors } from '../theme/colors';
export default function QuickActionButton({ label, icon, onPress }) {
  return <Pressable onPress={onPress} style={[card, { width: '48%', padding: 16, marginBottom: 12 }]}><Text style={{ fontSize: 22 }}>{icon}</Text><Text style={{ color: colors.text, fontWeight: '700', marginTop: 8 }}>{label}</Text></Pressable>;
}
