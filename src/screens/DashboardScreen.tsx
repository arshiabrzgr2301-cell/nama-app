import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing } from '../theme';
import { api, Property, Consultant, AppUser } from '../services/api';
import { clearAuth, getUser } from '../utils/storage';
import { scheduleDailyActivityReminder } from '../utils/notifications';
type Props={navigation:NativeStackNavigationProp<RootStackParamList,'Dashboard'>};
const isManager=(r?:string)=>r==='owner'||r==='manager';
const money=(n:number)=>n>=1e9?(n/1e9).toFixed(1)+' میلیارد تومان':Math.round(n/1e6).toLocaleString('fa-IR')+' میلیون تومان';
function Card({item,owner,onPress}:{item:Property;owner:string;onPress:()=>void}){
 return <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={.88}>
  {item.deal_status!=='active'&&<View style={[styles.ribbon,item.deal_status==='sold'?styles.sold:styles.deposit]}><Text style={styles.ribbonText}>{item.deal_status==='sold'?'فروخته شد':'بیعانه شد'}</Text></View>}
  <View style={styles.cardHead}><Text style={styles.cardTitle}>{item.title}</Text><Text style={[styles.status,item.status==='published'?styles.published:styles.draft]}>{item.status==='published'?'فعال':'پیش‌نویس'}</Text></View>
  <Text style={styles.meta}>{item.city} · {item.neighborhood||item.address} · {item.area} متر · {item.rooms} خواب</Text>
  <Text style={styles.price}>{money(Number(item.price||0))}</Text><Text style={styles.owner}>فایل {owner}</Text>
 </TouchableOpacity>;
}
export default function DashboardScreen({navigation}:Props){
 const [properties,setProperties]=useState<Property[]>([]),[consultants,setConsultants]=useState<Consultant[]>([]),[user,setUser]=useState<AppUser|null>(null),[refreshing,setRefreshing]=useState(false),[advisor,setAdvisor]=useState(''),[deal,setDeal]=useState('all'),[search,setSearch]=useState('');
 const load=useCallback(async()=>{const u=await getUser<AppUser>();setUser(u);if(u?.role==='consultant')scheduleDailyActivityReminder().catch(()=>{});const [p,c]=await Promise.all([api.getProperties(),api.getConsultants()]);setProperties(p);setConsultants(c);},[]);
 useFocusEffect(useCallback(()=>{load().catch(e=>Alert.alert('خطا',e.message));},[load]));
 const manager=isManager(user?.role);
 const filtered=useMemo(()=>properties.filter(p=>(!advisor||p.file_owner_id===advisor)&&(deal==='all'||p.deal_status===deal)&&(!search.trim()||[p.title,p.city,p.address,p.neighborhood].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase())))),[properties,advisor,deal,search]);
 const owner=(id:string)=>consultants.find(c=>c.id===id)?.fullName||(id===user?.id?user?.name:'مشاور');
 const logout=()=>Alert.alert('خروج','از حساب خارج شوید؟',[{text:'انصراف',style:'cancel'},{text:'خروج',style:'destructive',onPress:async()=>{await clearAuth();navigation.replace('Home');}}]);
 const refresh=async()=>{setRefreshing(true);try{await load();}finally{setRefreshing(false);}};
 return <SafeAreaView style={styles.container} edges={['top']}>
  <View style={styles.header}><View style={{flex:1}}><Text style={styles.greeting}>سلام، {user?.name||'کاربر NAMA'}</Text><Text style={styles.office}>{manager?'حساب مدیریت':'حساب مشاور'} · {user?.officeName}</Text></View><TouchableOpacity onPress={logout}><Text style={styles.logout}>خروج</Text></TouchableOpacity></View>
  <View style={styles.actions}>
   {manager&&<TouchableOpacity style={styles.primaryAction} onPress={()=>navigation.navigate('AddProperty')}><Text style={styles.primaryText}>+ ثبت فایل</Text></TouchableOpacity>}
   {manager&&<TouchableOpacity style={styles.action} onPress={()=>navigation.navigate('Team')}><Text style={styles.actionText}>مشاوران دفتر</Text></TouchableOpacity>}
   <TouchableOpacity style={styles.action} onPress={()=>navigation.navigate('Activity')}><Text style={styles.actionText}>{manager?'عملکرد مشاوران':'ثبت عملکرد امروز'}</Text></TouchableOpacity>
   <TouchableOpacity style={styles.action} onPress={()=>navigation.navigate('Reminders')}><Text style={styles.actionText}>یادآوری‌های من</Text></TouchableOpacity>
  </View>
  <View style={styles.stats}>
   {(['all','active','deposit','sold'] as const).map(s=><TouchableOpacity key={s} style={[styles.stat,deal===s&&styles.statSelected]} onPress={()=>setDeal(s)}><Text style={styles.statNumber}>{s==='all'?properties.length:properties.filter(p=>p.deal_status===s).length}</Text><Text style={styles.statLabel}>{s==='all'?'همه فایل‌ها':s==='active'?'فعال':s==='deposit'?'بیعانه':'فروخته'}</Text></TouchableOpacity>)}
  </View>
  <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="جست‌وجوی عنوان، محله یا شهر..." placeholderTextColor={colors.textMuted} textAlign="right"/>
  {manager&&<FlatList horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.advisors} data={[{id:'',fullName:'همه مشاوران',username:'',status:'active'},...consultants]} keyExtractor={x=>x.id||'all'} renderItem={({item})=><TouchableOpacity onPress={()=>setAdvisor(item.id)} style={[styles.filter,advisor===item.id&&styles.filterActive]}><Text style={[styles.filterText,advisor===item.id&&{color:colors.primary}]}>{item.fullName}</Text></TouchableOpacity>}/>}
  <Text style={styles.section}>فایل‌های دفتر</Text>
  <FlatList data={filtered} keyExtractor={x=>x.id} renderItem={({item})=><Card item={item} owner={owner(item.file_owner_id)} onPress={()=>navigation.navigate('PropertyDetail',{id:item.id})}/>} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary}/>} ListEmptyComponent={<Text style={styles.empty}>فایلی مطابق این فیلتر پیدا نشد.</Text>}/>
 </SafeAreaView>;
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.background},header:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.lg,paddingVertical:spacing.md},greeting:{color:colors.text,fontSize:20,fontWeight:'900',textAlign:'right'},office:{color:colors.textSecondary,fontSize:12,textAlign:'right',marginTop:3},logout:{color:colors.error,padding:8,fontWeight:'800'},actions:{flexDirection:'row-reverse',flexWrap:'wrap',gap:7,paddingHorizontal:spacing.lg,marginBottom:12},primaryAction:{backgroundColor:colors.primary,padding:11,borderRadius:10},primaryText:{color:colors.background,fontWeight:'900'},action:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,padding:11,borderRadius:10},actionText:{color:colors.text,fontSize:11,fontWeight:'800'},stats:{flexDirection:'row-reverse',gap:6,paddingHorizontal:spacing.lg,marginBottom:10},stat:{flex:1,backgroundColor:colors.surfaceElevated,borderRadius:10,padding:8,alignItems:'center'},statSelected:{borderWidth:1,borderColor:colors.primary},statNumber:{color:colors.text,fontWeight:'900',fontSize:17},statLabel:{color:colors.textMuted,fontSize:10,marginTop:2},search:{marginHorizontal:spacing.lg,marginBottom:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:10,padding:11,color:colors.text},advisors:{flexDirection:'row-reverse',gap:7,paddingHorizontal:spacing.lg,paddingBottom:8},filter:{borderWidth:1,borderColor:colors.border,borderRadius:18,paddingHorizontal:12,paddingVertical:7,backgroundColor:colors.surface},filterActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},filterText:{color:colors.textSecondary,fontSize:11},section:{color:colors.text,fontSize:15,fontWeight:'900',textAlign:'right',paddingHorizontal:spacing.lg,paddingVertical:7},list:{paddingHorizontal:spacing.lg,paddingBottom:30},card:{backgroundColor:colors.surfaceElevated,borderWidth:1,borderColor:colors.borderSoft,borderRadius:14,padding:14,marginBottom:11,overflow:'hidden'},ribbon:{marginHorizontal:-14,marginTop:-14,marginBottom:9,padding:5},deposit:{backgroundColor:'#D6A21D'},sold:{backgroundColor:'#C93636'},ribbonText:{color:'#fff',fontWeight:'900',textAlign:'center'},cardHead:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'center'},cardTitle:{flex:1,color:colors.text,textAlign:'right',fontWeight:'900',fontSize:15},status:{marginRight:7,paddingHorizontal:8,paddingVertical:4,borderRadius:12,fontSize:10,fontWeight:'800'},published:{color:colors.success,backgroundColor:'rgba(34,197,94,.15)'},draft:{color:colors.warning,backgroundColor:'rgba(245,158,11,.15)'},meta:{color:colors.textSecondary,textAlign:'right',fontSize:12,marginTop:8},price:{color:colors.primary,textAlign:'right',fontSize:15,fontWeight:'900',marginTop:7},owner:{color:colors.textMuted,textAlign:'right',fontSize:11,marginTop:8},empty:{color:colors.textMuted,textAlign:'center',marginTop:40}});
