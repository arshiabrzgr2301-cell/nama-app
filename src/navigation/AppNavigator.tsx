import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens, enableFreeze } from 'react-native-screens';
import { I18nManager, ActivityIndicator, View } from 'react-native';
import { RootStackParamList } from '../types';
import { colors } from '../theme';
import { getToken } from '../utils/storage';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AddPropertyScreen from '../screens/AddPropertyScreen';
import PropertyDetailScreen from '../screens/PropertyDetailScreen';
import TourViewerScreen from '../screens/TourViewerScreen';
import VRModeScreen from '../screens/VRModeScreen';
import ScanGuideScreen from '../screens/ScanGuideScreen';

// بهینه‌سازی حافظه و رندر صفحه‌های غیر فعال
enableScreens(true);
enableFreeze(true);

// فعال‌سازی RTL برای فارسی
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      setInitialRoute(token ? 'Dashboard' : 'Home');
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_left',
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="AddProperty" component={AddPropertyScreen} />
        <Stack.Screen name="PropertyDetail" component={PropertyDetailScreen} />
        <Stack.Screen name="TourViewer" component={TourViewerScreen} />
        <Stack.Screen name="VRMode" component={VRModeScreen} options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="ScanGuide" component={ScanGuideScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
