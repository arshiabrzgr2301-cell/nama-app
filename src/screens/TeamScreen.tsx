import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing } from '../theme';
import { api, Consultant, AppUser } from '../services/api';
import { getUser } from '../utils/storage';
type Props={navigation:NativeStackNavigationProp<RootStackParamList,'Team'>};
export default function TeamScreen({navigation}:Props){
 const [user,setUser]=useState<AppUser|null>(null),[team,setTeam]=useState<Consultant[]>([]),[show,setShow]=useState(false),[username,setUsername]=useState(''),[fullName,setFullName]=useState(''),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{const u=await getUser<AppUser>();setUser(u);setTeam(await api.getConsultants());},[]);
 useFocusEffect(useCallback(()=>{load().catch(e=>Alert.alert('خطا',e.message));},[load]));
 const add=async()=>{if(!/^[a-z0-9._-]{3,32}$/.test(username.trim().toLowerCase())||fullName.trim().length<2){Alert.alert('اطلاعات ناقص','نام کاربری انگلیسی ۳ تا ۳۲ کاراکتر و نام کامل را وارد کنید.');return;}
  setLoading(true);try{const result=await api.createConsultant(username.trim(),fullName.trim());setShow(false);setUsername('');setFullName('');Alert.alert('حساب مشاور ساخته شد','نام کاربری: '+result.consultant.username+'\\nرمز موقت: '+result.temporaryPassword+'\\nاین رمز را فقط یک‌بار به مشاور تحویل دهید.');await load();}
  catch(e:any){Alert.alert('ساخت حساب ناموفق بود',e.message||'امکان ساخت حساب وجود ندارد.');}finally{setLoading(false);}
 };
 if(user&&user.role!=='owner'&&user.role!=='manager')return <SafeAreaView style={styles.container}><Text style={styles.empty}>این بخش فقط برای مدیریت دفتر است.</Text></SafeAreaView>;
 return <SafeAreaView style={styles.container}>
  <View style={styles.header}><TouchableOpacity onPress={()=>navigation.goBack()}><Text style={styles.back}>بازگشت</Text></TouchableOpacity><Text style={styles.title}>مشاوران دفتر</Text><TouchableOpacity onPress={()=>setShow(true)}><Text style={styles.add}>+ افزودن</Text></TouchableOpacity></View>
  <FlatList data={team} keyExtractor={x=>x.id} contentContainerStyle={{padding:16}} renderItem={({item})=><View style={styles.card}><Text style={styles.name}>{item.fullName}</Text><Text style={styles.username}>@{item.username}</Text><Text style={styles.role}>مشاور · دسترسی مشاهده فایل‌ها و تور ۳۶۰</Text></View>} ListEmptyComponent={<Text style={styles.empty}>هنوز مشاوری برای این دفتر ثبت نشده است.</Text>}/>
  <Modal visible={show} transparent animationType="fade" onRequestClose={()=>setShow(false)}><View style={styles.overlay}><View style={styles.modal}>
   <Text style={styles.modalTitle}>ساخت حساب مشاور</Text><Text style={styles.label}>نام کامل مشاور</Text><TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="نام و نام خانوادگی" placeholderTextColor={colors.textMuted} textAlign="right"/>
   <Text style={styles.label}>نام کاربری انگلیسی</Text><TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="مثلاً ali.m" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.hint}>رمز عبور موقت به‌صورت امن ساخته می‌شود و پس از ثبت فقط یک‌بار نمایش داده خواهد شد.</Text>
   <TouchableOpacity style={styles.save} onPress={add} disabled={loading}>{loading?<ActivityIndicator color={colors.background}/>:<Text style={styles.saveText}>ساخت حساب و صدور رمز</Text>}</TouchableOpacity><TouchableOpacity style={styles.cancel} onPress={()=>setShow(false)}><Text style={styles.cancelText}>انصراف</Text></TouchableOpacity>
  </View></View></Modal>
 </SafeAreaView>;
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.background},header:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',padding:spacing.md,borderBottomWidth:1,borderColor:colors.border},back:{color:colors.primary},title:{color:colors.text,fontSize:17,fontWeight:'900'},add:{color:colors.primary,fontWeight:'900'},card:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.border,borderRadius:14,padding:15,marginBottom:10},name:{color:colors.text,textAlign:'right',fontWeight:'900',fontSize:16},username:{color:colors.primary,textAlign:'right',marginTop:4},role:{color:colors.textMuted,textAlign:'right',fontSize:11,marginTop:8},empty:{color:colors.textMuted,textAlign:'center',marginTop:40},overlay:{flex:1,backgroundColor:'rgba(0,0,0,.7)',justifyContent:'center',padding:22},modal:{backgroundColor:colors.surfaceElevated,borderRadius:18,padding:18},modalTitle:{color:colors.text,fontSize:18,fontWeight:'900',textAlign:'right',marginBottom:10},label:{color:colors.textSecondary,textAlign:'right',marginTop:12,marginBottom:5,fontSize:12},input:{backgroundColor:colors.background,borderWidth:1,borderColor:colors.border,borderRadius:10,padding:12,color:colors.text},hint:{color:colors.textMuted,textAlign:'right',fontSize:11,lineHeight:18,marginTop:12},save:{backgroundColor:colors.primary,padding:14,borderRadius:11,alignItems:'center',marginTop:18},saveText:{color:colors.background,fontWeight:'900'},cancel:{padding:12,alignItems:'center'},cancelText:{color:colors.textSecondary}});
