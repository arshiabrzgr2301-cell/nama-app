import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import { api, Property } from '../services/api';
import { clearAuth, getUser } from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
};

export default function DashboardScreen({ navigation }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const u = await getUser();
      setUser(u);
      const list = await api.getProperties();
      setProperties(list);
    } catch {
      // داده دمو
      setProperties([
        {
          id: 'demo-1',
          title: 'آپارتمان ۳ خوابه سعادت‌آباد',
          city: 'تهران',
          address: 'سعادت‌آباد، خیابان سرو',
          price: 18500000000,
          area: 145,
          rooms: 3,
          floor: 5,
          description: 'نورگیر عالی، بازسازی کامل',
          status: 'published',
          views: 42,
          publicTourUrl: 'https://nama.ir/t/demo-1',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'demo-2',
          title: 'ویلای دوبلکس لواسان',
          city: 'لواسان',
          address: 'لواسان، جاده اوشان',
          price: 42000000000,
          area: 320,
          rooms: 4,
          floor: 0,
          description: 'استخر، روف‌گاردن',
          status: 'draft',
          views: 8,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('خروج', 'آیا مطمئن هستید؟', [
      { text: 'انصراف', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          navigation.replace('Home');
        },
      },
    ]);
  };

  const formatPrice = (p: number) => {
    if (p >= 1e9) return (p / 1e9).toFixed(1) + ' میلیارد تومان';
    if (p >= 1e6) return (p / 1e6).toFixed(0) + ' میلیون تومان';
    return p.toLocaleString('fa-IR') + ' تومان';
  };

  const renderItem = ({ item }: { item: Property }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('PropertyDetail', { id: item.id })}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View
          style={[
            styles.badge,
            item.status === 'published' ? styles.badgePublished : styles.badgeDraft,
          ]}
        >
          <Text style={styles.badgeText}>
            {item.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}
          </Text>
        </View>
      </View>
      <Text style={styles.cardMeta}>
        {item.city} · {item.area} متر · {item.rooms} خواب
      </Text>
      <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.views}>👁 {item.views || 0} بازدید تور</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('TourViewer', {
              id: item.id,
              panoramaUrl: item.publicTourUrl,
            })
          }
        >
          <Text style={styles.tourLink}>مشاهده تور ←</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            سلام، {user?.name || 'مشاور'}
          </Text>
          <Text style={styles.office}>{user?.officeName || 'دفتر املاک'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>خروج</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddProperty')}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnText}>+ افزودن ملک جدید</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.guideBtn}
          onPress={() => navigation.navigate('ScanGuide')}
        >
          <Text style={styles.guideBtnText}>راهنمای اسکن</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>املاک من</Text>

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>هنوز ملکی ثبت نشده است.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  office: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  logout: { color: colors.error, fontSize: 14 },
  actions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  addBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  addBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  guideBtn: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  guideBtnText: { color: colors.text, fontSize: 14 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'right',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginLeft: 8,
  },
  badgePublished: { backgroundColor: 'rgba(34,197,94,0.2)' },
  badgeDraft: { backgroundColor: 'rgba(245,158,11,0.2)' },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.text },
  cardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  views: { fontSize: 12, color: colors.textMuted },
  tourLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 40,
    fontSize: 15,
  },
});
