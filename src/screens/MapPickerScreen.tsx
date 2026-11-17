import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing } from '../theme';
type Props={navigation:NativeStackNavigationProp<RootStackParamList,'MapPicker'>;route:RouteProp<RootStackParamList,'MapPicker'>};
const MAP_HTML=(lat?:number,lng?:number)=>['<!doctype html><html lang="fa"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#0b1220}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const start=[',String(lat??35.7219),',',String(lng??51.3347),'];const map=L.map("map").setView(start,15);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);let marker=L.marker(start,{draggable:true}).addTo(map);function send(){const p=marker.getLatLng();window.ReactNativeWebView.postMessage(JSON.stringify({lat:p.lat,lng:p.lng}))}map.on("click",e=>{marker.setLatLng(e.latlng);send()});marker.on("dragend",send);send();</script></body></html>'].join('');
export default function MapPickerScreen({navigation,route}:Props){
 const [point,setPoint]=useState<{lat:number;lng:number}|null>(route.params?.latitude&&route.params?.longitude?{lat:route.params.latitude,lng:route.params.longitude}:null);
 return <SafeAreaView style={styles.container}><View style={styles.header}><TouchableOpacity onPress={()=>navigation.goBack()}><Text style={styles.cancel}>انصراف</Text></TouchableOpacity><Text style={styles.title}>انتخاب موقعیت دقیق ملک</Text><View style={{width:50}}/></View>
 <WebView source={{html:MAP_HTML(route.params?.latitude,route.params?.longitude)}} onMessage={e=>{try{setPoint(JSON.parse(e.nativeEvent.data))}catch{}}} javaScriptEnabled domStorageEnabled style={{flex:1}}/>
 <View style={styles.footer}><Text style={styles.coords}>{point?'عرض: '+point.lat.toFixed(6)+' | طول: '+point.lng.toFixed(6):'روی نقشه لمس کنید یا نشانگر را جابه‌جا کنید.'}</Text><TouchableOpacity style={[styles.save,!point&&{opacity:.5}]} disabled={!point} onPress={()=>point&&navigation.navigate('AddProperty',{latitude:point.lat,longitude:point.lng,propertyId:route.params?.propertyId})}><Text style={styles.saveText}>ثبت موقعیت ملک</Text></TouchableOpacity></View></SafeAreaView>;
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.background},header:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',padding:spacing.md,borderBottomWidth:1,borderColor:colors.border},title:{color:colors.text,fontWeight:'800',fontSize:16},cancel:{color:colors.primary,fontWeight:'700'},footer:{padding:spacing.md,backgroundColor:colors.surface,gap:10},coords:{color:colors.textSecondary,textAlign:'center',fontSize:12},save:{backgroundColor:colors.primary,borderRadius:12,padding:14,alignItems:'center'},saveText:{color:colors.background,fontWeight:'900',fontSize:15}});
