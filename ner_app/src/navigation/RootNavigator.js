import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import RiskAlertsScreen from '../screens/RiskAlertsScreen';
import ReportIncidentScreen from '../screens/ReportIncidentScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.accentBlue} /></View>;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isLoggedIn ? <Stack.Screen name="Auth" component={AuthStack} /> : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="RiskAlerts" component={RiskAlertsScreen} />
          <Stack.Screen name="ReportIncident" component={ReportIncidentScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
