import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, StatusBar } from 'react-native';
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
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
    #panorama { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="panorama"></div>
  <script>
    pannellum.viewer('panorama', {
      type: 'equirectangular',
      panorama: '${imageUrl}',
      autoLoad: true,
      showControls: false,
      mouseZoom: false,
      draggable: true,
      compass: false
    });
  </script>
</body>
</html>
`;

export default function VRModeScreen({ navigation, route }: Props) {
  const { panoramaUrl } = route.params;
  const demoPanorama = 'https://pannellum.org/images/alma.jpg';

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <WebView
        originWhitelist={['*']}
        source={{ html: VR_HTML(panoramaUrl || demoPanorama) }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
      />
      <TouchableOpacity style={styles.exit} onPress={() => navigation.goBack()}>
        <Text style={styles.exitText}>خروج از VR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1 },
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
