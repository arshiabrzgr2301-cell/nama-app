import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import LogoMark from '../components/LogoMark';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

const FEATURES = [
  { icon: '⌂', label: 'تور فضایی ۳۶۰', tint: colors.primary },
  { icon: '◇', label: 'بازسازی سه‌بعدی', tint: colors.secondary },
  { icon: '✦', label: 'هوش مصنوعی', tint: colors.accent },
];

export default function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.glowBlue} />
      <View pointerEvents="none" style={styles.glowViolet} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <Text style={styles.toplineText}>SMART PROPERTY EXPERIENCE</Text>
          <View style={styles.liveDot} />
        </View>
        <View style={styles.hero}>
          <LogoMark size={112} showWordmark />
          <Text style={styles.eyebrow}>نسل جدید فناوری املاک</Text>
          <Text style={styles.title}>خانه را قبل از رفتن،{ '\n' }<Text style={styles.titleAccent}>زندگی کن.</Text></Text>
          <Text style={styles.subtitle}>از معرفی هوشمند ملک تا بازدید سه‌بعدی؛{ '\n' }همه‌چیز در یک پلتفرم یکپارچه.</Text>
        </View>

        <View style={styles.featureRow}>
          {FEATURES.map((item) => (
            <View key={item.label} style={styles.featureCard}>
              <Text style={[styles.featureIcon, { color: item.tint }]}>{item.icon}</Text>
              <Text style={styles.featureLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.ctaPanel}>
          <View style={styles.panelOrb} />
          <Text style={styles.panelTitle}>دفتر املاک شما، هوشمندتر</Text>
          <Text style={styles.panelText}>مدیریت فایل‌ها، مشاوران و تجربه مشتری در یک فضای امن و حرفه‌ای.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>ورود به NAMA  →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('ScanGuide')} activeOpacity={0.7}>
            <Text style={styles.ghostBtnText}>راهنمای اسکن و ساخت تور مجازی</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footer}>NAMA  ·  BUILD  •  CONNECT  •  GROW</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  glowBlue: { position: 'absolute', top: -130, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: '#087EB5', opacity: 0.18 },
  glowViolet: { position: 'absolute', top: 250, right: -150, width: 300, height: 300, borderRadius: 150, backgroundColor: '#7040D8', opacity: 0.13 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: spacing.xl },
  toplineText: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 2.5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  hero: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xl },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', marginTop: spacing.xl, letterSpacing: 1 },
  title: { color: colors.text, fontSize: 29, fontWeight: '900', textAlign: 'center', lineHeight: 43, marginTop: 12, writingDirection: 'rtl' },
  titleAccent: { color: colors.primary },
  subtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 25, marginTop: 12, writingDirection: 'rtl' },
  featureRow: { flexDirection: 'row-reverse', gap: 9, marginBottom: spacing.lg },
  featureCard: { flex: 1, minHeight: 86, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: borderRadius.lg, paddingHorizontal: 5 },
  featureIcon: { fontSize: 25, fontWeight: '700', marginBottom: 7 },
  featureLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  ctaPanel: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: 'rgba(39,200,244,0.25)', padding: spacing.lg, overflow: 'hidden' },
  panelOrb: { position: 'absolute', top: -65, right: -35, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.secondary, opacity: 0.12 },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' },
  panelText: { color: colors.textSecondary, fontSize: 13, textAlign: 'right', lineHeight: 22, marginTop: 7, marginBottom: spacing.lg },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: 16, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 7 },
  primaryBtnText: { color: '#04111E', fontSize: 16, fontWeight: '900' },
  ghostBtn: { paddingVertical: 14, alignItems: 'center' },
  ghostBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  footer: { color: colors.textMuted, textAlign: 'center', fontSize: 9, letterSpacing: 2, marginTop: spacing.xl },
});
