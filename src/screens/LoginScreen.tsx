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
import { saveSession, saveUser } from '../utils/storage';
import LogoMark from '../components/LogoMark';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('ورود', 'نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setLoading(true);
    try {
      const session = await api.login(username, password);
      await saveSession(session.token, session.refreshToken);
      const user = await api.getMe(session.userId);
      await saveUser(user);
      navigation.replace('Dashboard');
    } catch (error: any) {
      Alert.alert('ورود ناموفق', error?.message || 'اطلاعات ورود صحیح نیست.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>→ بازگشت</Text>
          </TouchableOpacity>
          <View style={styles.header}>
            <LogoMark size={64} />
            <Text style={styles.title}>ورود به NAMA</Text>
            <Text style={styles.subtitle}>مدیریت دفتر و مشاوران با حساب اختصاصی خود وارد شوند</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>نام کاربری</Text>
            <TextInput
              style={styles.input} value={username} onChangeText={setUsername}
              placeholder="نام کاربری دریافتی از مدیریت" placeholderTextColor={colors.textMuted}
              autoCapitalize="none" autoCorrect={false} textAlign="right"
            />
            <Text style={styles.label}>رمز عبور</Text>
            <TextInput
              style={styles.input} value={password} onChangeText={setPassword}
              placeholder="رمز عبور" placeholderTextColor={colors.textMuted}
              secureTextEntry textAlign="right"
            />
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.btnText}>ورود امن</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>ثبت‌نام عمومی غیرفعال است. نام کاربری و رمز عبور توسط مدیریت صادر می‌شود.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  back: { marginBottom: spacing.md },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  title: { marginTop: spacing.md, fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderSoft, gap: spacing.md },
  label: { color: colors.textSecondary, fontSize: 13, textAlign: 'right', fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 14, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border, writingDirection: 'rtl' },
  btn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing.sm },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  hint: { marginTop: spacing.lg, textAlign: 'center', color: colors.textMuted, fontSize: 12, lineHeight: 20 },
});
