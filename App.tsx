import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import './src/utils/notifications';
const SPLASH_BACKGROUND = '#07152f';
export default function App() {
  const [navigationReady, setNavigationReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!navigationReady) return;
    Animated.timing(splashOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShowSplash(false);
    });
  }, [navigationReady, splashOpacity]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" hidden={showSplash} />
        <AppNavigator onReady={() => setNavigationReady(true)} />
        {showSplash && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.splash, { opacity: splashOpacity }]}>
          <Image source={require('./assets/IMG_0931.jpeg')} style={styles.splashImage} resizeMode="contain" fadeDuration={0}/>
        </Animated.View>}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:SPLASH_BACKGROUND},splash:{zIndex:1000,elevation:1000,backgroundColor:SPLASH_BACKGROUND,alignItems:'center',justifyContent:'center'},splashImage:{width:'100%',height:'100%'}});
