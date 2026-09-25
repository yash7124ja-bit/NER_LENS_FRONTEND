import React from 'react';
import { Text, View } from 'react-native';
import { card, colors } from '../theme/colors';
export default function ReportCard({ report }) {
  return <View style={[card, { padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }]}><Text style={{ fontSize: 25, marginRight: 12 }}>{report.icon}</Text><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{report.title}</Text><Text style={{ color: colors.muted, marginTop: 4 }}>{report.detail}</Text></View><Text style={{ color: colors.good, fontSize: 12 }}>{report.freshness}</Text><Text style={{ color: colors.muted, fontSize: 20, marginLeft: 8 }}>›</Text></View>;
}
