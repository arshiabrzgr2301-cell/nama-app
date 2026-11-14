import React, { useCallback, useState, memo, useMemo } from 'react';
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

const formatPrice = (p: number) => {
  if (p >= 1e9) return (p / 1e9).toFixed(1) + ' میلیارد تومان';
  if (p >= 1e6) return (p / 1e6).toFixed(0) + ' میلیون تومان';
  return p.toLocaleString('fa-IR') + ' تومان';
};

type CardProps = {
  item: Property;
  onPress: (id: string) => void;
  onTour: (id: string, url?: string) => void;
};

const PropertyCard = memo(function PropertyCard({ item, onPress, onTour }: CardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item.id)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`ملک ${item.title}`}
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
          <Text
            style={[
              styles.badgeText,
              item.status === 'published' ? styles.badgeTextPublished : styles.badgeTextDraft,
            ]}
          >
            {item.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}
          </Text>
        </View>
      </View>

      <Text style={styles.cardMeta}>
        {item.city} · {item.area} متر · {item.rooms} خواب
      </Text>
      <Text style={styles.cardPrice}>{formatPrice(item.price)}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.views}>👁 {item.views || 0} بازدید</Text>
        <TouchableOpacity
          style={styles.tourBtn}
          onPress={() => onTour(item.id, item.panoramaUrl)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="مشاهده تور ۳۶۰"
        >
          <Text style={styles.tourLink}>مشاهده تور</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

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
    } catch (error: any) {
      setProperties([]);
      Alert.alert('خطا در دریافت املاک', error?.message || 'ارتباط با سرور برقرار نشد.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleLogout = useCallback(() => {
    Alert.alert('خروج', 'آیا مطمئن هستید از حساب خارج شوید؟', [
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
  }, [navigation]);

  const onCardPress = useCallback(
    (id: string) => navigation.navigate('PropertyDetail', { id }),
    [navigation]
  );

  const onTourPress = useCallback(
    (id: string, url?: string) =>
      navigation.navigate('TourViewer', { id, panoramaUrl: url }),
    [navigation]
  );

  const stats = useMemo(() => {
    const published = properties.filter((p) => p.status === 'published').length;
    const drafts = properties.length - published;
    const views = properties.reduce((s, p) => s + (p.views || 0), 0);
    return { published, drafts, views };
  }, [properties]);

  const renderItem = useCallback(
    ({ item }: { item: Property }) => (
      <PropertyCard item={item} onPress={onCardPress} onTour={onTourPress} />
    ),
    [onCardPress, onTourPress]
  );

  const keyExtractor = useCallback((item: Property) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting} numberOfLines={1}>
            سلام، {user?.name || 'مشاور'}
          </Text>
          <Text style={styles.office} numberOfLines={1}>
            {user?.officeName || 'دفتر املاک'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="خروج از حساب"
        >
          <Text style={styles.logout}>خروج</Text>
        </TouchableOpacity>
      </View>

      {/* خلاصه سریع */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statValue}>{properties.length}</Text>
          <Text style={styles.statLabel}>کل املاک</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: colors.success }]}>{stats.published}</Text>
          <Text style={styles.statLabel}>منتشر</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{stats.drafts}</Text>
          <Text style={styles.statLabel}>پیش‌نویس</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.views}</Text>
          <Text style={styles.statLabel}>بازدید</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddProperty')}
          activeOpacity={0.88}
          accessibilityRole="button"
        >
          <Text style={styles.addBtnText}>+ افزودن ملک</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.guideBtn}
          onPress={() => navigation.navigate('ScanGuide')}
          activeOpacity={0.88}
          accessibilityRole="button"
        >
          <Text style={styles.guideBtnText}>راهنما</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>املاک من</Text>

      <FlatList
        data={properties}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>هنوز ملکی ندارید</Text>
            <Text style={styles.emptyDesc}>
              اولین ملک را اضافه کنید و تور ۳۶۰ بسازید
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('AddProperty')}
            >
              <Text style={styles.emptyBtnText}>افزودن اولین ملک</Text>
            </TouchableOpacity>
          </View>
        }
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        showsVerticalScrollIndicator={false}
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
  headerText: { flex: 1, marginLeft: spacing.md },
  greeting: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  office: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  logoutBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  logout: { color: colors.error, fontSize: 14, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: spacing.lg,
    gap: 8,
    marginBottom: spacing.md,
  },
  statChip: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  addBtn: {
    flex: 1,
    minHeight: 48,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: colors.background, fontWeight: '800', fontSize: 15 },
  guideBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'right',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginLeft: 8,
  },
  badgePublished: { backgroundColor: 'rgba(34,197,94,0.18)' },
  badgeDraft: { backgroundColor: 'rgba(245,158,11,0.18)' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextPublished: { color: colors.success },
  badgeTextDraft: { color: colors.warning },
  cardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'right',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  views: { fontSize: 12, color: colors.textMuted },
  tourBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  tourLink: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  emptyBox: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  emptyBtn: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  emptyBtnText: {
    color: colors.background,
    fontWeight: '800',
    fontSize: 15,
  },
});
