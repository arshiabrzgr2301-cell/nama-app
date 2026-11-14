import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScanGuide'>;
};

const steps = [
  {
    title: '۱. آماده‌سازی فضا',
    body: 'نور طبیعی یا مصنوعی کافی داشته باشید. پرده‌ها را باز کنید و وسایل اضافی را از وسط اتاق‌ها جمع کنید تا تور تمیزتر باشد.',
  },
  {
    title: '۲. انتخاب حالت اسکن',
    body: 'از دوربین گوشی در حالت پانوراما ۳۶۰ یا اپلیکیشن‌های مخصوص اسکن اتاق (مثل Google Street View یا اپ‌های اختصاصی) استفاده کنید.',
  },
  {
    title: '۳. حرکت آرام و یکنواخت',
    body: 'گوشی را در ارتفاع چشم نگه دارید و به آرامی ۳۶۰ درجه بچرخید. از حرکات سریع و لرزش خودداری کنید.',
  },
  {
    title: '۴. پوشش کامل اتاق‌ها',
    body: 'هر اتاق اصلی (پذیرایی، خواب‌ها، آشپزخانه، سرویس) را جداگانه اسکن کنید. درها را باز بگذارید تا ارتباط فضاها مشخص شود.',
  },
  {
    title: '۵. آپلود در NAMA',
    body: 'تصاویر پانوراما و ویدیوهای اسکن را در صفحه «افزودن ملک» آپلود کنید. سپس هات‌اسپات‌های راهنما اضافه کرده و ملک را منتشر کنید.',
  },
  {
    title: '۶. اشتراک با مشتری',
    body: 'لینک عمومی تور را برای مشتری ارسال کنید. مشتری می‌تواند قبل از بازدید حضوری، خانه را در موبایل یا هدست VR ببیند.',
  },
];

export default function ScanGuideScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← بازگشت</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>راهنمای اسکن خانه</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          با دنبال کردن این مراحل، تور مجازی باکیفیتی از ملک بسازید تا مشتری تجربه واقعی‌تری داشته باشد.
        </Text>

        {steps.map((step, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepBody}>{step.body}</Text>
          </View>
        ))}

        <View style={styles.tip}>
          <Text style={styles.tipTitle}>نکته حرفه‌ای</Text>
          <Text style={styles.tipBody}>
            برای بهترین نتیجه، از سه‌پایه کوچک یا گیمبال استفاده کنید و در ساعات روز با نور طبیعی اسکن کنید.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  content: { padding: spacing.lg, paddingBottom: 40 },
  intro: {
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
    marginBottom: 6,
  },
  stepBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 22,
  },
  tip: {
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: spacing.sm,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  tipBody: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
  },
});
