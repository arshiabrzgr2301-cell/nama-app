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

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !officeName.trim() || !email.trim() || !password) {
      Alert.alert('خطا', 'لطفاً فیلدهای ضروری را پر کنید.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({
        name: name.trim(),
        officeName: officeName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });
      await saveToken(res.token);
      await saveRefreshToken(res.refreshToken);
      await saveUser(res.user);
      navigation.replace('Dashboard');
    } catch (e: any) {
      if (e.code === 'EMAIL_CONFIRMATION_REQUIRED') {
        Alert.alert('ثبت‌نام انجام شد', e.message, [
          { text: 'رفتن به ورود', onPress: () => navigation.replace('Login') },
        ]);
      } else {
        Alert.alert('ثبت‌نام ناموفق', e.message || 'ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
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

          <Text style={styles.title}>ثبت‌نام دفتر املاک</Text>
          <Text style={styles.subtitle}>حساب کاربری دفتر خود را ایجاد کنید</Text>

          <View style={styles.form}>
            <Text style={styles.label}>نام کامل</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="نام و نام خانوادگی"
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />

            <Text style={styles.label}>نام دفتر املاک</Text>
            <TextInput
              style={styles.input}
              value={officeName}
              onChangeText={setOfficeName}
              placeholder="مثال: املاک آریا"
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />

            <Text style={styles.label}>ایمیل</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="office@example.ir"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="right"
            />

            <Text style={styles.label}>شماره تماس (اختیاری)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="۰۹۱۲۱۲۳۴۵۶۷"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              textAlign="right"
            />

            <Text style={styles.label}>رمز عبور</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="حداقل ۶ کاراکتر"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              textAlign="right"
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.btnText}>ثبت‌نام و ورود</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>قبلاً ثبت‌نام کرده‌اید؟ ورود</Text>
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
