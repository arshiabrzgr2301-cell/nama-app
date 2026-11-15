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
    body: 'نور یکنواخت فراهم کنید، درها را باز بگذارید و وسایل اضافی را از مسیر دید خارج کنید. دوربین باید در ارتفاع تقریباً یکسانی در تمام اتاق‌ها قرار بگیرد.',
  },
  {
    title: '۲. ثبت پانورامای کروی واقعی',
    body: 'از دوربین ۳۶۰ درجه یا اپلیکیشنی استفاده کنید که چند عکس را به یک تصویر کروی کامل (Equirectangular) با نسبت ۲ به ۱ تبدیل می‌کند. حالت Panorama معمولی آیفون یا یک عکس عریض، به‌تنهایی ۳۶۰ درجه کامل نیست.',
  },
  {
    title: '۳. محل ثبت هر اتاق',
    body: 'در هر اتاق یک نقطه ثابت و نزدیک مرکز فضا انتخاب کنید. دوربین را تا حد امکان ثابت نگه دارید و از سه‌پایه استفاده کنید تا تصویر نهایی تراز و بدون لرزش باشد.',
  },
  {
    title: '۴. پوشش همه بخش‌ها',
    body: 'برای پذیرایی، آشپزخانه، اتاق‌ها، سرویس و بالکن یک پانورامای جداگانه ثبت کنید. ورودی‌ها و درهای ارتباطی را در تصویر نگه دارید تا بتوانید بعداً مسیر حرکت بین اتاق‌ها را روی همان جهت تنظیم کنید.',
  },
  {
    title: '۵. ساخت تور در NAMA',
    body: 'ملک را ابتدا به‌صورت پیش‌نویس ذخیره کنید. وارد «مدیریت تور هدایت‌شده ۳۶۰» شوید، پانورامای هر اتاق را اضافه کنید، اتاق شروع را تعیین کنید و با لمس جهت درها، اتاق‌ها را به یکدیگر متصل کنید.',
  },
  {
    title: '۶. انتشار و اشتراک',
    body: 'پس از بررسی اتاق‌ها و مسیرها، ملک را منتشر کنید و لینک عمومی تور را برای مشتری بفرستید. مشتری می‌تواند اتاق‌ها را از فهرست انتخاب کند، با لمس هات‌اسپات‌ها جابه‌جا شود و در گوشی‌های سازگار حسگر حرکت را فعال کند.',
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
            برای بهترین نتیجه، از سه‌پایه استفاده کنید، افق تصویر را تراز نگه دارید و قبل از آپلود مطمئن شوید خروجی واقعاً کروی و کامل است؛ عکس معمولی یا ویدیوی معمولی جای پانورامای ۳۶۰ را نمی‌گیرد.
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
