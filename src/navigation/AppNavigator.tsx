import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens, enableFreeze } from 'react-native-screens';
import { I18nManager, ActivityIndicator, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { RootStackParamList } from '../types';
import { colors } from '../theme';
import { getToken } from '../utils/storage';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AddPropertyScreen from '../screens/AddPropertyScreen';
import PropertyDetailScreen from '../screens/PropertyDetailScreen';
import TourViewerScreen from '../screens/TourViewerScreen';
import VRModeScreen from '../screens/VRModeScreen';
import ScanGuideScreen from '../screens/ScanGuideScreen';
import MapPickerScreen from '../screens/MapPickerScreen';
import ActivityScreen from '../screens/ActivityScreen';
import RemindersScreen from '../screens/RemindersScreen';
import TeamScreen from '../screens/TeamScreen';
enableScreens(true);enableFreeze(true);
if(!I18nManager.isRTL){I18nManager.allowRTL(true);I18nManager.forceRTL(true);}
const Stack=createNativeStackNavigator<RootStackParamList>();
export default function AppNavigator({onReady}:{onReady?:()=>void}){
 const [initialRoute,setInitialRoute]=useState<keyof RootStackParamList|null>(null);
 const navigationRef=useNavigationContainerRef<RootStackParamList>();
 useEffect(()=>{(async()=>{const token=await getToken();setInitialRoute(token?'Dashboard':'Home')})();},[]);
 useEffect(()=>{
  const sub=Notifications.addNotificationResponseReceivedListener(response=>{
   const screen=response.notification.request.content.data?.screen;
   if(!navigationRef.isReady())return;
   if(screen==='Activity')navigationRef.navigate('Activity');
   if(screen==='Reminders')navigationRef.navigate('Reminders');
  });
  return()=>sub.remove();
 },[navigationRef]);
 if(!initialRoute)return <View style={{flex:1,backgroundColor:colors.background,justifyContent:'center',alignItems:'center'}}><ActivityIndicator size="large" color={colors.primary}/></View>;
 return <NavigationContainer ref={navigationRef} onReady={onReady}>
  <Stack.Navigator initialRouteName={initialRoute} screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.background},animation:'slide_from_left',freezeOnBlur:true}}>
   <Stack.Screen name="Home" component={HomeScreen}/><Stack.Screen name="Login" component={LoginScreen}/><Stack.Screen name="Dashboard" component={DashboardScreen}/>
   <Stack.Screen name="AddProperty" component={AddPropertyScreen}/><Stack.Screen name="MapPicker" component={MapPickerScreen}/><Stack.Screen name="PropertyDetail" component={PropertyDetailScreen}/>
   <Stack.Screen name="TourViewer" component={TourViewerScreen}/><Stack.Screen name="VRMode" component={VRModeScreen} options={{presentation:'fullScreenModal'}}/><Stack.Screen name="ScanGuide" component={ScanGuideScreen}/>
   <Stack.Screen name="Activity" component={ActivityScreen}/><Stack.Screen name="Reminders" component={RemindersScreen}/><Stack.Screen name="Team" component={TeamScreen}/>
  </Stack.Navigator>
 </NavigationContainer>;
}
