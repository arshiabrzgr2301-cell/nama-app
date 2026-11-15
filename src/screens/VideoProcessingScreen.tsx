import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import { api, VideoProcessingJob } from '../services/videoProcessing';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VideoProcessing'>;
  route: RouteProp<RootStackParamList, 'VideoProcessing'>;
};

const modeLabel: Record<VideoProcessingJob['processing_mode'], string> = {
  spatial: 'بازسازی محیط سه‌بعدی',
  stereo: 'تبدیل ویدیوی استریوسکوپی',
  both: 'هر دو خروجی',
};
const statusLabel: Record<VideoProcessingJob['status'], string> = {
  queued: 'در صف پردازش',
  processing: 'در حال پردازش',
  completed: 'پردازش کامل شده',
  failed: 'پردازش ناموفق',
};

export default function VideoProcessingScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [jobs, setJobs] = useState<VideoProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setJobs(await api.getVideoProcessingJobs(id));
    } catch (error: any) {
      Alert.alert('خطا', error?.message || 'وضعیت پردازش دریافت نشد.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const start = async (mode: VideoProcessingJob['processing_mode']) => {
    setSubmitting(true);
    try {
      await api.enqueueVideoProcessing(id, mode);
      await refresh();
      Alert.alert('درخواست ثبت شد', 'درخواست در صف پردازش قرار گرفت. تا زمان اتصال موتور پردازش GPU، وضعیت آن در انتظار می‌ماند.');
    } catch (error: any) {
      Alert.alert('ثبت درخواست ناموفق', error?.message || 'درخواست پردازش ثبت نشد.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← بازگشت</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>تبدیل ویدیوی ملک</Text>
        <TouchableOpacity onPress={refresh}><Text style={styles.back}>بروزرسانی</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>خروجی موردنظر را انتخاب کنید</Text>
        <Text style={styles.description}>ویدیوی معمولی گوشی روی سرور پردازش می‌شود. بازسازی محیط و ساخت ویدیوی استریوسکوپی دو پردازش مستقل هستند.</Text>
        <TouchableOpacity disabled={submitting} style={styles.primary} onPress={() => start('both')}>
          <Text style={styles.primaryText}>ساخت هر دو خروجی</Text>
          <Text style={styles.hint}>تور فضایی سه‌بعدی + ویدیوی مخصوص عینک</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={submitting} style={styles.secondary} onPress={() => start('spatial')}>
          <Text style={styles.secondaryText}>فقط بازسازی سه‌بعدی محیط</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={submitting} style={styles.secondary} onPress={() => start('stereo')}>
          <Text style={styles.secondaryText}>فقط ویدیوی استریوسکوپی</Text>
        </TouchableOpacity>
        {submitting ? <ActivityIndicator color={colors.primary} style={{ margin: 12 }} /> : null}
        <Text style={styles.section}>سوابق پردازش</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : jobs.length === 0 ? (
          <Text style={styles.empty}>هنوز درخواستی ثبت نشده است.</Text>
        ) : jobs.map(job => (
          <View key={job.id} style={styles.job}>
            <Text style={styles.jobTitle}>{modeLabel[job.processing_mode]}</Text>
            <Text style={styles.jobStatus}>{statusLabel[job.status]} · {job.progress}%</Text>
            <View style={styles.track}><View style={[styles.fill, { width: `${job.progress}%` }]} /></View>
            {job.status === 'queued' ? <Text style={styles.note}>موتور پردازش GPU هنوز به پروژه متصل نشده است؛ پس از راه‌اندازی worker این درخواست‌ها پردازش می‌شوند.</Text> : null}
            {job.status === 'failed' && job.error_message ? <Text style={styles.error}>{job.error_message}</Text> : null}
            {job.spatial_asset_path ? <Text style={styles.output}>خروجی سه‌بعدی آماده است.</Text> : null}
            {job.stereo_video_path ? <Text style={styles.output}>ویدیوی استریوسکوپی آماده است.</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { color: colors.primary, fontSize: 14 },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'right', marginBottom: 8 },
  description: { color: colors.textSecondary, textAlign: 'right', lineHeight: 23, marginBottom: spacing.lg },
  primary: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  primaryText: { color: colors.background, fontSize: 16, fontWeight: '800' },
  hint: { color: colors.background, fontSize: 12, marginTop: 5 },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  secondaryText: { color: colors.text, fontWeight: '700' },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'right', marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  job: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  jobTitle: { color: colors.text, fontWeight: '700', textAlign: 'right', marginBottom: 6 },
  jobStatus: { color: colors.primary, textAlign: 'right', fontSize: 13, marginBottom: 8 },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.primary },
  note: { color: colors.textMuted, textAlign: 'right', fontSize: 12, lineHeight: 19, marginTop: 8 },
  error: { color: '#f87171', textAlign: 'right', marginTop: 8 },
  output: { color: '#4ade80', textAlign: 'right', marginTop: 8 },
});
