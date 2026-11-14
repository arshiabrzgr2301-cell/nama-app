import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors, spacing, borderRadius } from '../theme';
import { api, Property, Hotspot } from '../services/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TourViewer'>;
  route: RouteProp<RootStackParamList, 'TourViewer'>;
};

const PANNELLUM_HTML = (imageUrl: string, hotspots: Hotspot[]) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <style>html,body,#panorama{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style>
</head>
<body>
  <div id="panorama"></div>
  <script>
    const initialHotspots = ${JSON.stringify(hotspots.map(h => ({
      id: h.id, pitch: h.pitch, yaw: h.yaw, type: 'info', text: h.title,
      ...(h.description ? { description: h.description } : {})
    })))};
    const viewer = pannellum.viewer('panorama', {
      type: 'equirectangular',
      panorama: ${JSON.stringify(imageUrl)},
      autoLoad: true,
      showControls: true,
      compass: true,
      hotSpots: initialHotspots
    });
    window.viewer = viewer;
    let moved = false;
    document.getElementById('panorama').addEventListener('touchstart', () => { moved = false; }, {passive:true});
    document.getElementById('panorama').addEventListener('touchmove', () => { moved = true; }, {passive:true});
    document.getElementById('panorama').addEventListener('click', (event) => {
      if (window.ReactNativeWebView) {
        // Convert the exact screen tap into panorama coordinates (pitch, yaw).
        const coords = viewer.mouseEventToCoords(event);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type:'position', pitch:coords[0], yaw:coords[1]
        }));
      }
    });
    document.addEventListener('message', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'addHotspot') viewer.addHotSpot({
          pitch:data.pitch, yaw:data.yaw, type:'info', text:data.title
        });
      } catch(err) {}
    });
    window.addEventListener('message', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'addHotspot') viewer.addHotSpot({
          pitch:data.pitch, yaw:data.yaw, type:'info', text:data.title
        });
      } catch(err) {}
    });
  </script>
</body>
</html>
`;

export default function TourViewerScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHotspotModal, setShowHotspotModal] = useState(false);
  const [hotspotTitle, setHotspotTitle] = useState('');
  const [pendingPosition, setPendingPosition] = useState<{yaw:number; pitch:number} | null>(null);
  const [webRef, setWebRef] = useState<WebView | null>(null);

  useEffect(() => {
    let active = true;
    api.getProperty(id).then(value => {
      if (active) setProperty(value);
    }).catch((error: any) => {
      Alert.alert('خطا در دریافت تور', error?.message || 'اطلاعات ملک دریافت نشد.');
      navigation.goBack();
    }).finally(() => { if (active) setLoading(false); });
    api.incrementViews(id).catch(() => {});
    return () => { active = false; };
  }, [id, navigation]);

  const handleWebMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'position' && Number.isFinite(data.yaw) && Number.isFinite(data.pitch)) {
        setPendingPosition({ yaw: data.yaw, pitch: data.pitch });
        setShowHotspotModal(true);
      }
    } catch {}
  };

  const addHotspot = async () => {
    if (!hotspotTitle.trim()) {
      Alert.alert('خطا', 'عنوان هات‌اسپات را وارد کنید.');
      return;
    }
    if (!pendingPosition) {
      Alert.alert('موقعیت انتخاب نشده', 'ابتدا روی نقطه موردنظر در تصویر ۳۶۰ ضربه بزنید.');
      return;
    }
    try {
      const saved = await api.addHotspot(id, {
        ...pendingPosition, title: hotspotTitle.trim(),
      });
      setProperty(current => current
        ? { ...current, hotspots: [...(current.hotspots || []), saved] }
        : current);
      webRef?.injectJavaScript(`
        if (window.viewer) window.viewer.addHotSpot({
          pitch:${JSON.stringify(saved.pitch)},
          yaw:${JSON.stringify(saved.yaw)},
          type:'info',
          text:${JSON.stringify(saved.title)}
        });
        true;
      `);
      setShowHotspotModal(false);
      setHotspotTitle('');
      setPendingPosition(null);
      Alert.alert('موفق', 'هات‌اسپات در همین موقعیت ذخیره شد.');
    } catch (error: any) {
      Alert.alert('ذخیره هات‌اسپات ناموفق', error?.message || 'تغییری ذخیره نشد.');
    }
  };

  const panoramaUrl = property?.panoramaUrl;
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.toolBtn}>← بازگشت</Text>
        </TouchableOpacity>
        <Text style={styles.toolTitle}>تور ۳۶۰</Text>
        <View style={styles.toolRight}>
          <TouchableOpacity disabled={!panoramaUrl} onPress={() => {
            if (!panoramaUrl) return;
            Alert.alert('افزودن هات‌اسپات', 'روی نقطه موردنظر در تصویر ضربه بزنید تا موقعیت ثبت شود.');
          }}>
            <Text style={styles.toolBtn}>+ هات‌اسپات</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={!panoramaUrl} onPress={() => {
            if (panoramaUrl) navigation.navigate('VRMode', { id, panoramaUrl });
          }}>
            <Text style={[styles.toolBtn, { color: colors.primary }]}>تمام‌صفحه</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.message}><Text style={styles.messageText}>در حال بارگذاری تور...</Text></View>
      ) : panoramaUrl ? (
        <WebView
          ref={setWebRef}
          originWhitelist={['*']}
          source={{ html: PANNELLUM_HTML(panoramaUrl, property?.hotspots || []) }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          onMessage={handleWebMessage}
        />
      ) : (
        <View style={styles.message}>
          <Text style={styles.messageText}>برای این ملک هنوز تصویر پانورامای ۳۶۰ آپلود نشده است.</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>هات‌اسپات‌ها با موقعیت واقعی ذخیره می‌شوند.</Text>
      </View>

      <Modal visible={showHotspotModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>افزودن هات‌اسپات</Text>
            <Text style={styles.footerText}>موقعیت انتخاب‌شده: {pendingPosition ? `Yaw ${pendingPosition.yaw.toFixed(1)}° · Pitch ${pendingPosition.pitch.toFixed(1)}°` : '—'}</Text>
            <TextInput
              style={styles.modalInput}
              value={hotspotTitle}
              onChangeText={setHotspotTitle}
              placeholder="عنوان (مثلاً آشپزخانه)"
              placeholderTextColor={colors.textMuted}
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => {
                setShowHotspotModal(false); setPendingPosition(null);
              }}>
                <Text style={styles.modalCancelText}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={addHotspot}>
                <Text style={styles.modalOkText}>ذخیره</Text>
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
