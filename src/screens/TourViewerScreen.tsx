import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import { api } from '../services/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TourViewer'>;
  route: RouteProp<RootStackParamList, 'TourViewer'>;
};

// یک تور ۳۶۰ ساده با Pannellum (open source) از طریق WebView
const PANNELLUM_HTML = (imageUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <style>
    body { margin: 0; background: #000; }
    #panorama { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="panorama"></div>
  <script>
    const viewer = pannellum.viewer('panorama', {
      type: 'equirectangular',
      panorama: '${imageUrl}',
      autoLoad: true,
      showControls: true,
      compass: true,
      hotSpots: []
    });
    window.viewer = viewer;
    document.addEventListener('message', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'addHotspot') {
          viewer.addHotSpot({
            pitch: data.pitch,
            yaw: data.yaw,
            type: 'info',
            text: data.title
          });
        }
      } catch(err) {}
    });
  </script>
</body>
</html>
`;

export default function TourViewerScreen({ navigation, route }: Props) {
  const { id, panoramaUrl } = route.params;
  const [showHotspotModal, setShowHotspotModal] = useState(false);
  const [hotspotTitle, setHotspotTitle] = useState('');
  const [webRef, setWebRef] = useState<WebView | null>(null);

  // تصویر نمونه پانوراما برای دمو (یک equirectangular عمومی)
  const demoPanorama =
    'https://pannellum.org/images/alma.jpg';

  useEffect(() => {
    api.incrementViews(id).catch(() => {});
  }, [id]);

  const addHotspot = () => {
    if (!hotspotTitle.trim()) {
      Alert.alert('خطا', 'عنوان هات‌اسپات را وارد کنید.');
      return;
    }
    // در دمو، هات‌اسپات در موقعیت پیش‌فرض اضافه می‌شود
    webRef?.injectJavaScript(`
      if (window.viewer) {
        window.viewer.addHotSpot({
          pitch: 0,
          yaw: 0,
          type: 'info',
          text: ${JSON.stringify(hotspotTitle.trim())}
        });
      }
      true;
    `);
    api.addHotspot(id, { yaw: 0, pitch: 0, title: hotspotTitle.trim() }).catch(() => {});
    setShowHotspotModal(false);
    setHotspotTitle('');
    Alert.alert('موفق', 'هات‌اسپات اضافه شد.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.toolBtn}>← بازگشت</Text>
        </TouchableOpacity>
        <Text style={styles.toolTitle}>تور ۳۶۰</Text>
        <View style={styles.toolRight}>
          <TouchableOpacity onPress={() => setShowHotspotModal(true)}>
            <Text style={styles.toolBtn}>+ هات‌اسپات</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('VRMode', { id, panoramaUrl: panoramaUrl || demoPanorama })
            }
          >
            <Text style={[styles.toolBtn, { color: colors.primary }]}>VR</Text>
          </TouchableOpacity>
        </View>
      </View>

      <WebView
        ref={setWebRef}
        originWhitelist={['*']}
        source={{ html: PANNELLUM_HTML(panoramaUrl || demoPanorama) }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          لینک عمومی تور برای مشتری در دسترس است.
        </Text>
      </View>

      <Modal visible={showHotspotModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>افزودن هات‌اسپات</Text>
            <TextInput
              style={styles.modalInput}
              value={hotspotTitle}
              onChangeText={setHotspotTitle}
              placeholder="عنوان (مثلاً آشپزخانه)"
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowHotspotModal(false)}
              >
                <Text style={styles.modalCancelText}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={addHotspot}>
                <Text style={styles.modalOkText}>افزودن</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  toolbar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  toolBtn: { color: colors.text, fontSize: 14 },
  toolTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  toolRight: { flexDirection: 'row-reverse', gap: 16 },
  webview: { flex: 1 },
  footer: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  footerText: { color: colors.textMuted, fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    writingDirection: 'rtl',
  },
  modalActions: { flexDirection: 'row-reverse', gap: spacing.sm },
  modalCancel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: { color: colors.text },
  modalOk: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  modalOkText: { color: colors.background, fontWeight: '700' },
});
