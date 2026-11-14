import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import { api, Property } from '../services/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PropertyDetail'>;
  route: RouteProp<RootStackParamList, 'PropertyDetail'>;
};

export default function PropertyDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [property, setProperty] = useState<Property | null>(null);

  useEffect(() => {
    api
      .getProperty(id)
      .then(setProperty)
      .catch(() => {
        setProperty({
          id,
          title: 'آپارتمان نمونه',
          city: 'تهران',
          address: 'سعادت‌آباد',
          price: 18500000000,
          area: 145,
          rooms: 3,
          floor: 5,
          description: 'نورگیر عالی، بازسازی کامل، دسترسی عالی به مترو.',
          status: 'published',
          views: 42,
          publicTourUrl: 'https://nama.ir/t/' + id,
          createdAt: new Date().toISOString(),
        });
      });
  }, [id]);

  if (!property) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>در حال بارگذاری...</Text>
      </SafeAreaView>
    );
  }

  const formatPrice = (p: number) => {
    if (p >= 1e9) return (p / 1e9).toFixed(1) + ' میلیارد تومان';
    return p.toLocaleString('fa-IR') + ' تومان';
  };

  const shareTour = async () => {
    const url = property.publicTourUrl || `https://nama.ir/t/${property.id}`;
    try {
      await Share.share({
        message: `تور مجازی ملک «${property.title}» را ببینید:\n${url}`,
        url,
      });
    } catch {}
  };

  const toggleStatus = async () => {
    try {
      if (property.status === 'published') {
        await api.setDraft(id);
        setProperty({ ...property, status: 'draft' });
      } else {
        await api.publishProperty(id);
        setProperty({ ...property, status: 'published' });
      }
    } catch {
      setProperty({
        ...property,
        status: property.status === 'published' ? 'draft' : 'published',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← بازگشت</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          جزئیات ملک
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{property.title}</Text>
        <View
          style={[
            styles.badge,
            property.status === 'published' ? styles.badgePub : styles.badgeDraft,
          ]}
        >
          <Text style={styles.badgeText}>
            {property.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}
          </Text>
        </View>

        <Text style={styles.price}>{formatPrice(property.price)}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{property.city}</Text>
          <Text style={styles.meta}>{property.area} متر</Text>
          <Text style={styles.meta}>{property.rooms} خواب</Text>
          <Text style={styles.meta}>طبقه {property.floor}</Text>
        </View>

        <Text style={styles.address}>{property.address}</Text>

        <Text style={styles.section}>توضیحات</Text>
        <Text style={styles.desc}>{property.description || '—'}</Text>

        <Text style={styles.views}>👁 {property.views || 0} بازدید تور</Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() =>
            navigation.navigate('TourViewer', {
              id: property.id,
              panoramaUrl: property.publicTourUrl,
            })
          }
        >
          <Text style={styles.primaryBtnText}>مشاهده تور ۳۶۰</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={shareTour}>
          <Text style={styles.secondaryBtnText}>اشتراک لینک عمومی تور</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={toggleStatus}>
          <Text style={styles.secondaryBtnText}>
            {property.status === 'published' ? 'تبدیل به پیش‌نویس' : 'انتشار ملک'}
          </Text>
        </TouchableOpacity>
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
  content: { padding: spacing.lg },
  loading: { color: colors.text, textAlign: 'center', marginTop: 40 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginBottom: 12,
  },
  badgePub: { backgroundColor: 'rgba(34,197,94,0.2)' },
  badgeDraft: { backgroundColor: 'rgba(245,158,11,0.2)' },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.text },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  meta: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    color: colors.textSecondary,
    fontSize: 13,
  },
  address: {
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 16,
    fontSize: 14,
  },
  section: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    marginBottom: 6,
  },
  desc: {
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: 16,
  },
  views: {
    color: colors.textMuted,
    textAlign: 'right',
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '600', fontSize: 15 },
});
