import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import { api } from '../services/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddProperty'>;
};

export default function AddPropertyScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [rooms, setRooms] = useState('');
  const [floor, setFloor] = useState('');
  const [description, setDescription] = useState('');
  const [panoramaUri, setPanoramaUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('دسترسی', 'برای آپلود تصویر نیاز به دسترسی گالری است.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPanoramaUri(result.assets[0].uri);
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('دسترسی', 'برای آپلود ویدیو نیاز به دسترسی گالری است.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const handleSave = async (asDraft: boolean) => {
    if (!title.trim() || !city.trim()) {
      Alert.alert('خطا', 'عنوان و شهر الزامی است.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        city: city.trim(),
        address: address.trim(),
        price: Number(price) || 0,
        area: Number(area) || 0,
        rooms: Number(rooms) || 0,
        floor: Number(floor) || 0,
        description: description.trim(),
        status: asDraft ? ('draft' as const) : ('published' as const),
        panoramaUri: panoramaUri || undefined,
        videoUri: videoUri || undefined,
      };
      await api.createProperty(payload);
      Alert.alert('موفق', asDraft ? 'ملک به‌عنوان پیش‌نویس ذخیره شد.' : 'ملک منتشر شد.', [
        { text: 'باشه', onPress: () => navigation.goBack() },
      ]);
    } catch {
      // دمو
      Alert.alert('موفق (دمو)', 'ملک در حالت دمو ذخیره شد.', [
        { text: 'باشه', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← بازگشت</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>افزودن ملک جدید</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>عنوان ملک *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="مثال: آپارتمان ۲ خوابه نیاوران"
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />

        <Text style={styles.label}>شهر *</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="تهران"
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />

        <Text style={styles.label}>آدرس</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="خیابان، کوچه، پلاک"
          placeholderTextColor={colors.textMuted}
          textAlign="right"
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>قیمت (تومان)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>متراژ (متر)</Text>
            <TextInput
              style={styles.input}
              value={area}
              onChangeText={setArea}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>تعداد اتاق</Text>
            <TextInput
              style={styles.input}
              value={rooms}
              onChangeText={setRooms}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>طبقه</Text>
            <TextInput
              style={styles.input}
              value={floor}
              onChangeText={setFloor}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              textAlign="right"
            />
          </View>
        </View>

        <Text style={styles.label}>توضیحات</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="ویژگی‌های ملک را بنویسید..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          textAlign="right"
          textAlignVertical="top"
        />

        <Text style={styles.section}>رسانه تور مجازی</Text>

        <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
          <Text style={styles.uploadText}>
            {panoramaUri ? '✓ تصویر پانوراما انتخاب شد' : '📷 آپلود تصویر پانورامای ۳۶۰'}
          </Text>
        </TouchableOpacity>
        {panoramaUri && (
          <Image source={{ uri: panoramaUri }} style={styles.preview} resizeMode="cover" />
        )}

        <TouchableOpacity style={styles.uploadBtn} onPress={pickVideo}>
          <Text style={styles.uploadText}>
            {videoUri ? '✓ ویدیو اسکن انتخاب شد' : '🎬 آپلود ویدیوی اسکن خانه'}
          </Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => handleSave(false)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.btnPrimaryText}>انتشار ملک</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => handleSave(true)}
            disabled={loading}
          >
            <Text style={styles.btnSecondaryText}>ذخیره پیش‌نویس</Text>
          </TouchableOpacity>
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
  form: { padding: spacing.lg, paddingBottom: 40 },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    writingDirection: 'rtl',
  },
  textarea: { minHeight: 100 },
  row: { flexDirection: 'row-reverse', gap: spacing.sm },
  half: { flex: 1 },
  section: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  uploadBtn: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  uploadText: { color: colors.primary, fontSize: 14 },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
  btn: {
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: { color: colors.text, fontWeight: '600', fontSize: 15 },
});
