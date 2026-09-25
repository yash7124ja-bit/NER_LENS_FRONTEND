import React, { useState } from 'react';
import { Button, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = async () => { await loginUser(email, password); await login(); };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy, padding: 24, justifyContent: 'center' }}>
    <Text style={{ color: '#FFF', fontSize: 42, fontWeight: '800' }}>🏔️ NER-LENS</Text><Text style={{ color: '#C7D8EE', fontSize: 16, marginTop: 8, marginBottom: 40 }}>Smarter Routes. Safer Journeys.</Text>
    <TextInput placeholder="Email" placeholderTextColor="#9AA9BC" value={email} onChangeText={setEmail} style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 14, marginBottom: 12 }} />
    <TextInput placeholder="Password" placeholderTextColor="#9AA9BC" secureTextEntry value={password} onChangeText={setPassword} style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 14, marginBottom: 18 }} />
    <Button title="Login" color={colors.accentBlue} onPress={submit} />
    <Pressable onPress={submit} style={{ padding: 18, alignItems: 'center' }}><Text style={{ color: '#FFF', fontWeight: '700' }}>Continue as Demo Driver</Text></Pressable>
  </SafeAreaView>;
}
