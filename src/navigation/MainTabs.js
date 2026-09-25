import React from 'react';
import { Button, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import RouteScreen from '../screens/RouteScreen';
import OfflineReportsScreen from '../screens/OfflineReportsScreen';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
function MoreScreen() {
  const { logout } = useAuth();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ marginBottom: 20 }}>More</Text><Button title="Log out" onPress={logout} /></View>;
}

export default function MainTabs() {
  const options = (label, icon) => ({ title: label, tabBarIcon: ({ color, size }) => <Ionicons name={icon} size={size} color={color} /> });
  return <Tab.Navigator screenOptions={{ tabBarActiveTintColor: colors.accentBlue, headerShown: false }}>
    <Tab.Screen name="Home" component={HomeScreen} options={options('Home', 'home-outline')} />
    <Tab.Screen name="Map" component={RouteScreen} options={options('Map', 'map-outline')} />
    <Tab.Screen name="Reports" component={OfflineReportsScreen} options={options('Reports', 'document-text-outline')} />
    <Tab.Screen name="More" component={MoreScreen} options={options('More', 'menu-outline')} />
  </Tab.Navigator>;
}
