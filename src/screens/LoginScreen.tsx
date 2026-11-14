import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import { api } from '../services/api';
import { saveToken, saveUser } from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('خطا', 'لطفاً ایمیل و رمز عبور را وارد کنید.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      await saveToken(res.token);
      await saveUser(res.user);
      navigation.replace('Dashboard');
    } catch (e: any) {
      // برای دمو بدون بک‌اند واقعی
      if (email.includes('@') && password.length >= 4) {
        await saveToken('demo-token-' + Date.now());
        await saveUser({ id: '1', name: 'مشاور دمو', email, officeName: 'دفتر نمونه' });
        navigation.replace('Dashboard');
      } else {
        Alert.alert('ورود ناموفق', e.message || 'اطلاعات ورود صحیح نیست.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>← بازگشت</Text>
          </TouchableOpacity>

          <Text style={styles.title}>ورود مشاور</Text>
          <Text style={styles.subtitle}>به حساب کاربری دفتر املاک خود وارد شوید</Text>

          <View style={styles.form}>
            <Text style={styles.label}>ایمیل</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@office.ir"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
            />

            <Text style={styles.label}>رمز عبور</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.btnText}>ورود</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.link}>حساب ندارید؟ ثبت‌نام کنید</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, flexGrow: 1 },
  back: { marginBottom: spacing.lg },
  backText: { color: colors.primary, fontSize: 15 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: spacing.xl,
  },
  form: { gap: spacing.md },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'right',
    marginBottom: -4,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    writingDirection: 'rtl',
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  link: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontSize: 14,
  },
});
