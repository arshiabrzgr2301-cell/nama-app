import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { colors, spacing } from '../theme';
import { api } from '../services/api';
type Props={navigation:NativeStackNavigationProp<RootStackParamList,'TourViewer'>;route:RouteProp<RootStackParamList,'TourViewer'>};
export default function TourViewerScreen({navigation,route}:Props){
 const {id}=route.params;const [headers,setHeaders]=useState<Record<string,string>|null>(null);
 useEffect(()=>{api.getTourHeaders().then(setHeaders);},[]);
 return <SafeAreaView style={styles.container} edges={['top']}>
  <View style={styles.toolbar}><TouchableOpacity onPress={()=>navigation.goBack()}><Text style={styles.back}>بازگشت</Text></TouchableOpacity><Text style={styles.title}>تور ۳۶۰ داخلی</Text><Text style={styles.lock}>🔒 خصوصی</Text></View>
  {headers?<WebView source={{uri:api.getTourUrl(id),headers}} style={{flex:1}} javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} originWhitelist={['https://*']}/>:<View style={styles.loading}><ActivityIndicator color={colors.primary}/><Text style={styles.loadingText}>در حال دریافت تور امن...</Text></View>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#000'},toolbar:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',padding:spacing.md,backgroundColor:colors.surface},back:{color:colors.primary},title:{color:colors.text,fontWeight:'900'},lock:{color:colors.success,fontSize:11},loading:{flex:1,justifyContent:'center',alignItems:'center',gap:12},loadingText:{color:colors.textSecondary}});
