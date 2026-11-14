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
import { saveToken, saveRefreshToken, saveUser } from '../utils/storage';
import LogoMark from '../components/LogoMark';

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
      await saveRefreshToken(res.refreshToken);
      await saveUser(res.user);
      navigation.replace('Dashboard');
    } catch (e: any) {
      if (e.code === 'email_not_confirmed') {
        Alert.alert(
          'ایمیل هنوز تأیید نشده',
          'برای فعال شدن حساب، لینک تأیید ارسال‌شده به ایمیلتان را باز کنید. اگر ایمیل را پیدا نمی‌کنید، می‌توانید دوباره ارسالش کنید.',
          [
            {
              text: 'ارسال مجدد ایمیل',
              onPress: async () => {
                try {
                  await api.resendSignupConfirmation(email.trim());
                  Alert.alert('ارسال شد', 'درخواست ارسال مجدد ثبت شد. پوشه Inbox و Spam ایمیل را بررسی کنید.');
                } catch (error: any) {
                  Alert.alert('ارسال ناموفق', error?.message || 'ارسال ایمیل تأیید انجام نشد. کمی بعد دوباره تلاش کنید.');
                }
              },
            },
            { text: 'باشه', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('ورود ناموفق', e.message || 'ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlow} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>→ بازگشت</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <LogoMark size={64} />
            <Text style={styles.title}>ورود مشاور</Text>
            <Text style={styles.subtitle}>
              به حساب کاربری دفتر املاک خود وارد شوید
            </Text>
          </View>

          <View style={styles.card}>
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
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.btnText}>ورود به داشبورد</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>حساب ندارید؟ ثبت‌نام دفتر املاک</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bgGlow: {
    position: 'absolute',
    top: -40,
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.primaryGlow,
    opacity: 0.2,
  },
  scroll: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  back: { marginBottom: spacing.md },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    marginTop: spacing.md,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'right',
    marginBottom: -4,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  link: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
