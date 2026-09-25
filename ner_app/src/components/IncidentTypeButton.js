import React from 'react';
import { Pressable, Text } from 'react-native';
import { colors } from '../theme/colors';
export default function IncidentTypeButton({ label, selected, onPress }) {
  return <Pressable onPress={onPress} style={{ width: '48%', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: selected ? colors.accentBlue : colors.border, backgroundColor: selected ? '#EAF3FF' : colors.cardBg, marginBottom: 10 }}><Text style={{ color: selected ? colors.accentBlue : colors.text, fontWeight: '600' }}>{label}</Text></Pressable>;
}
