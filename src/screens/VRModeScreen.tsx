import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'VRMode'>;
  route: RouteProp<RootStackParamList, 'VRMode'>;
};

const VR_HTML = (imageUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"><\/script>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}
    #toolbar{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#111827;color:#fff;font:13px system-ui}
    #toggle{border:0;border-radius:18px;padding:8px 14px;background:#22d3ee;color:#07111f;font-weight:700}
    #viewers{height:calc(100% - 48px);display:flex;width:100%}
    .pane{height:100%;width:100%;min-width:0}
    #right{display:none}
    #viewers.split .pane{width:50%}
    #viewers.split #right{display:block;border-right:1px solid #64748b}
    #note{position:absolute;bottom:8px;left:8px;right:8px;text-align:center;color:#e2e8f0;background:rgba(0,0,0,.55);padding:6px;border-radius:8px;font:11px system-ui;pointer-events:none}
  </style>
</head>
<body>
  <div id="toolbar">
    <span>نمایش پانورامای ۳۶۰ با حسگر حرکتی</span>
    <button id="toggle" type="button">حالت عینک</button>
  </div>
  <div id="viewers">
    <div id="left" class="pane"></div>
    <div id="right" class="pane"></div>
  </div>
  <div id="note">برای حالت عینک گوشی را افقی قرار دهید؛ تصویر ورودی تک‌چشمی است و عمق سه‌بعدی واقعی ندارد.</div>
  <script>
    const panorama = ${JSON.stringify(imageUrl)};
    const config = {
      type:'equirectangular',
      panorama,
      autoLoad:true,
      showControls:true,
      mouseZoom:false,
      draggable:true,
      compass:false,
      orientationOnByDefault:true
    };
    const left = pannellum.viewer('left', config);
    const right = pannellum.viewer('right', config);
    let syncing = false;
    function sync(source, target, method, value) {
      if (syncing || !Number.isFinite(value)) return;
      syncing = true;
      target[method](value, false);
      syncing = false;
    }
    left.on('yawchange', value => sync(left,right,'setYaw',value));
    right.on('yawchange', value => sync(right,left,'setYaw',value));
    left.on('pitchchange', value => sync(left,right,'setPitch',value));
    right.on('pitchchange', value => sync(right,left,'setPitch',value));
    document.getElementById('toggle').addEventListener('click', () => {
      const split = document.getElementById('viewers').classList.toggle('split');
      document.getElementById('toggle').textContent = split ? 'نمایش عادی' : 'حالت عینک';
      setTimeout(() => {
        left.resize();
        right.resize();
      }, 80);
    });
  </script>
</body>
</html>
`;

export default function VRModeScreen({ navigation, route }: Props) {
  const { panoramaUrl } = route.params;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {panoramaUrl ? (
        <WebView
          originWhitelist={['*']}
          source={{ html: VR_HTML(panoramaUrl) }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>تصویر پانورامای واقعی برای این ملک موجود نیست.</Text>
        </View>
      )}
      <TouchableOpacity style={styles.exit} onPress={() => navigation.goBack()}>
        <Text style={styles.exitText}>خروج از حالت حرکت ۳۶۰</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#fff', textAlign: 'center', fontSize: 15 },
  exit: {
    position: 'absolute',
    top: 48,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  exitText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
