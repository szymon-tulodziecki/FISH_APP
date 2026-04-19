import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/fishlog/icons';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/utils/fishlog-constants';

type Props = { onAuth: (user: any) => void };

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onAuth(data.user);
      } else {
        const { data: signUpData, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username || email.split('@')[0] } },
        });
        if (err) throw err;
        if (signUpData.user && signUpData.session) {
          onAuth(signUpData.user);
        } else {
          const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
          if (loginErr) {
            setSuccess('Konto utworzone. Potwierdź email, a następnie się zaloguj.');
          } else {
            onAuth(loginData.user);
          }
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Wystąpił błąd logowania.');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <View style={styles.logoIcon}>
          <Icon.Fish size={36} color="#fff" />
        </View>
        <Text style={styles.title}>FishLog</Text>
        <Text style={styles.subtitle}>Twój dziennik połowów</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.tabs}>
          {(['login', 'register'] as const).map((m) => (
            <Pressable key={m} style={[styles.tab, mode === m && styles.tabActive]} onPress={() => setMode(m)}>
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === 'login' ? 'Logowanie' : 'Rejestracja'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'register' && (
          <TextInput
            placeholder="Nazwa użytkownika"
            placeholderTextColor={COLORS.textTertiary}
            value={username}
            onChangeText={setUsername}
            style={styles.input}
          />
        )}
        <TextInput
          placeholder="Email"
          placeholderTextColor={COLORS.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          placeholder="Hasło"
          placeholderTextColor={COLORS.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
        {!!success && <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View>}

        <Pressable style={[styles.submit, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>{mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 24,
  },
  logoWrap: { alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: COLORS.brandMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F4F2EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: COLORS.brandDark, fontWeight: '800' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E3D8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAF7',
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  errorBox: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FACDCD', borderRadius: 10, padding: 10 },
  errorText: { color: COLORS.danger, fontSize: 13 },
  successBox: { backgroundColor: '#F0FBF6', borderWidth: 1, borderColor: '#9FE1CB', borderRadius: 10, padding: 10 },
  successText: { color: COLORS.brandGreen, fontSize: 13 },
  submit: {
    backgroundColor: COLORS.brandMid,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.brandMid,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
