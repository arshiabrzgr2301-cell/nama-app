import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import { api } from '../services/api';
import { saveToken, saveRefreshToken, saveUser } from '../utils/storage';
import LogoMark from '../components/LogoMark';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('خطا', 'لطفاً نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      await saveToken(res.token);
      await saveRefreshToken(res.refreshToken);
      await saveUser(res.user);
      navigation.replace('Dashboard');
    } catch (e: any) {
      Alert.alert('ورود ناموفق', e.message || 'نام کاربری یا رمز عبور نادرست است.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.glow} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>→ بازگشت</Text>
          </TouchableOpacity>
          <View style={styles.header}>
            <LogoMark size={76} showWordmark />
            <Text style={styles.title}>خوش برگشتی</Text>
            <Text style={styles.subtitle}>برای ورود به فضای کاری دفتر املاک، اطلاعات حسابت را وارد کن.</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.secureDot} />
              <Text style={styles.cardCaption}>ورود امن مشاوران NAMA</Text>
            </View>
            <Text style={styles.label}>نام کاربری</Text>
            <TextInput
              style={styles.input} value={username} onChangeText={setUsername}
              placeholder="نام کاربری دریافتی از مدیر دفتر" placeholderTextColor={colors.textMuted}
              autoCapitalize="none" textAlign="right" returnKeyType="next"
            />
            <Text style={styles.label}>رمز عبور</Text>
            <TextInput
              style={styles.input} value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={colors.textMuted}
              secureTextEntry textAlign="right" returnKeyType="go" onSubmitEditing={handleLogin}
            />
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.88}>
              {loading ? <ActivityIndicator color="#04111E" /> : <Text style={styles.btnText}>ورود به داشبورد  ←</Text>}
            </TouchableOpacity>
            <Text style={styles.footnote}>دسترسی سازمانی · اتصال رمزنگاری‌شده</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  glow: { position: 'absolute', top: -100, alignSelf: 'center', width: 280, height: 280, borderRadius: 140, backgroundColor: '#155C9C', opacity: 0.2 },
  scroll: { padding: spacing.lg, paddingBottom: 40, flexGrow: 1 },
  back: { minHeight: 42, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  header: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  title: { marginTop: spacing.xl, fontSize: 26, fontWeight: '900', color: colors.text, textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.sm },
  card: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(39,200,244,0.22)', gap: spacing.md },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 },
  secureDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  cardCaption: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  label: { color: colors.textSecondary, fontSize: 13, textAlign: 'right', marginBottom: -5, fontWeight: '700' },
  input: { backgroundColor: colors.backgroundAlt, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 15, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border, writingDirection: 'rtl' },
  btn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing.sm },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#04111E', fontSize: 16, fontWeight: '900' },
  footnote: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 4 },
});
