import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import LogoMark from '../components/LogoMark';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };
const FEATURES = [
  { icon: '🏠', label: 'تور ۳۶۰ داخلی' },
  { icon: '👓', label: 'حالت VR' },
  { icon: '📍', label: 'موقعیت ملک' },
];

export default function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />
      <View style={styles.content}>
        <View style={styles.hero}>
          <LogoMark size={100} showWordmark />
          <Text style={styles.slogan}>دنیای ملک با نگاهی متفاوت</Text>
          <Text style={styles.subtitle}>سامانه اختصاصی مدیریت فایل و بازدید مجازی دفاتر املاک</Text>
          <View style={styles.chips}>
            {FEATURES.map(f => (
              <View key={f.label} style={styles.chip}>
                <Text style={styles.chipIcon}>{f.icon}</Text>
                <Text style={styles.chipText}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.primaryBtnText}>ورود مدیریت و مشاوران</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('ScanGuide')}>
            <Text style={styles.ghostBtnText}>راهنمای اسکن خانه ←</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footer}>دسترسی فقط با حساب صادرشده توسط مدیریت NAMA یا دفتر املاک</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bgGlowTop: { position: 'absolute', top: -80, alignSelf: 'center', width: 280, height: 280, borderRadius: 140, backgroundColor: colors.primaryGlow, opacity: 0.25 },
  bgGlowBottom: { position: 'absolute', bottom: -100, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.primarySoft, opacity: 0.4 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xl },
  slogan: { marginTop: spacing.xl, fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center', writingDirection: 'rtl' },
  subtitle: { marginTop: spacing.sm, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.md },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: spacing.xl },
  chip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: borderRadius.full },
  chipIcon: { fontSize: 14 },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  buttons: { width: '100%', gap: spacing.md, paddingBottom: spacing.sm },
  primaryBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: borderRadius.lg, alignItems: 'center' },
  primaryBtnText: { color: colors.background, fontSize: 17, fontWeight: '800' },
  ghostBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  ghostBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 11, marginTop: spacing.sm },
});
