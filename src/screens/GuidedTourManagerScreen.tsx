import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {View,Text,StyleSheet,TouchableOpacity,ScrollView,Alert,ActivityIndicator,Image,TextInput} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../types';
import {colors,spacing,borderRadius} from '../theme';
import {guidedTourApi,TourScene,TourLink} from '../services/api';

type Props={navigation:NativeStackNavigationProp<RootStackParamList,'GuidedTourManager'>;route:RouteProp<RootStackParamList,'GuidedTourManager'>};
type Point={yaw:number;pitch:number};
const ROOMS=['ورودی','پذیرایی','آشپزخانه','اتاق خواب ۱','اتاق خواب ۲','سرویس بهداشتی','حمام','بالکن','سایر'];

function editorHtml(imageUrl:string){
 const image=JSON.stringify(imageUrl).replace(/</g,'\\u003c');
 return '<!doctype html><html lang="fa"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"><style>html,body,#pano{margin:0;width:100%;height:100%;background:#07111f}#hint{position:absolute;z-index:5;top:8px;left:8px;right:8px;text-align:center;color:#fff;background:#07111fbb;border-radius:8px;padding:7px;font:12px sans-serif;pointer-events:none}</style></head><body><div id="pano"></div><div id="hint">برای تعیین محل اتصال، روی جهت درِ اتاق مقصد ضربه بزنید</div><script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script><script>const image='+image+';let viewer;let marker="nama-link-point";function send(data){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data))}viewer=pannellum.viewer("pano",{type:"equirectangular",panorama:image,autoLoad:true,showControls:true,compass:true,mouseZoom:true});viewer.on("mousedown",function(event){try{const c=viewer.mouseEventToCoords(event);const pitch=Number(c[0].toFixed(2));const yaw=Number(c[1].toFixed(2));try{viewer.removeHotSpot(marker)}catch(e){}viewer.addHotSpot({id:marker,pitch:pitch,yaw:yaw,type:"info",text:"نقطه اتصال"});send({type:"point",pitch:pitch,yaw:yaw})}catch(e){send({type:"error",message:"خواندن موقعیت تصویر ناموفق بود"})}});viewer.on("error",function(e){send({type:"error",message:String(e)})});</script></body></html>';
}

export default function GuidedTourManagerScreen({navigation,route}:Props){
 const {id,title}=route.params;
 const [scenes,setScenes]=useState<TourScene[]>([]);
 const [links,setLinks]=useState<TourLink[]>([]);
 const [room,setRoom]=useState('پذیرایی');
 const [sourceSceneId,setSourceSceneId]=useState('');
 const [targetSceneId,setTargetSceneId]=useState('');
 const [point,setPoint]=useState<Point|null>(null);
 const [label,setLabel]=useState('رفتن به اتاق بعدی');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);

 const refresh=useCallback(async()=>{
  try{
   const [nextScenes,nextLinks]=await Promise.all([guidedTourApi.listScenes(id),guidedTourApi.listLinks(id)]);
   setScenes(nextScenes);setLinks(nextLinks);
   setSourceSceneId(current=>nextScenes.some(s=>s.id===current)?current:(nextScenes[0]?.id||''));
   setTargetSceneId(current=>nextScenes.some(s=>s.id===current)?current:(nextScenes.find(s=>s.id!==nextScenes[0]?.id)?.id||''));
  }catch(e:any){Alert.alert('خطا',e?.message||'دریافت اطلاعات تور ناموفق بود.');}
  finally{setLoading(false);}
 },[id]);
 useEffect(()=>{refresh();},[refresh]);

 const sourceScene=useMemo(()=>scenes.find(s=>s.id===sourceSceneId),[scenes,sourceSceneId]);
 const targets=scenes.filter(s=>s.id!==sourceSceneId);
 const add=async()=>{
  const p=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(p.status!=='granted'){Alert.alert('دسترسی گالری','برای انتخاب تصویر دسترسی لازم است.');return;}
  const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:1});
  if(r.canceled||!r.assets[0])return;
  setBusy(true);
  try{await guidedTourApi.addScene(id,room,r.assets[0].uri,scenes.length,scenes.length===0);await refresh();Alert.alert('ذخیره شد','پانوراما به تور اضافه شد.');}
  catch(e:any){Alert.alert('آپلود ناموفق',e?.message||'تصویر ذخیره نشد.');}
  finally{setBusy(false);}
 };
 const entry=async(s:TourScene)=>{try{await guidedTourApi.setEntryScene(id,s.id);await refresh();}catch(e:any){Alert.alert('خطا',e?.message||'تغییر نقطه شروع ناموفق بود.');}};
 const del=(s:TourScene)=>Alert.alert('حذف بخش','این اتاق و اتصال‌های مرتبط با آن حذف شوند؟',[{text:'انصراف',style:'cancel'},{text:'حذف',style:'destructive',onPress:async()=>{setBusy(true);try{await guidedTourApi.deleteScene(s);await refresh();}catch(e:any){Alert.alert('خطا',e?.message||'حذف ناموفق بود.');}finally{setBusy(false);}}}]);
 const saveLink=async()=>{
  if(!sourceSceneId||!targetSceneId||sourceSceneId===targetSceneId){Alert.alert('انتخاب اتاق','اتاق مبدأ و مقصد را درست انتخاب کنید.');return;}
  if(!point){Alert.alert('تعیین نقطه','روی تصویر ۳۶۰ ضربه بزنید و محل درِ اتاق مقصد را مشخص کنید.');return;}
  if(links.some(l=>l.fromSceneId===sourceSceneId&&l.toSceneId===targetSceneId)){Alert.alert('اتصال تکراری','این دو اتاق از قبل به هم متصل شده‌اند. ابتدا اتصال قبلی را حذف کنید.');return;}
  setBusy(true);
  try{await guidedTourApi.addLink(id,sourceSceneId,targetSceneId,point.yaw,point.pitch,label);setPoint(null);await refresh();Alert.alert('اتصال ذخیره شد','در تور عمومی، این نقطه بازدیدکننده را به اتاق مقصد می‌برد.');}
  catch(e:any){Alert.alert('ذخیره اتصال ناموفق',e?.message||'اتصال ذخیره نشد.');}
  finally{setBusy(false);}
 };
 const removeLink=(link:TourLink)=>Alert.alert('حذف اتصال','این مسیر بین دو اتاق حذف شود؟',[{text:'انصراف',style:'cancel'},{text:'حذف',style:'destructive',onPress:async()=>{setBusy(true);try{await guidedTourApi.deleteLink(link.id);await refresh();}catch(e:any){Alert.alert('خطا',e?.message||'حذف اتصال ناموفق بود.');}finally{setBusy(false);}}}]);

 return <SafeAreaView style={st.root}>
  <View style={st.header}><TouchableOpacity onPress={()=>navigation.goBack()}><Text style={st.back}>بازگشت ←</Text></TouchableOpacity><Text style={st.headTitle}>مدیریت تور ۳۶۰</Text><View style={{width:54}}/></View>
  <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
   <Text style={st.title}>{title}</Text>
   <Text style={st.desc}>برای هر اتاق یک تصویر پانورامای کروی ۳۶۰ درجه اضافه کنید. بازدیدکننده می‌تواند با چرخاندن گوشی یا هدست اطراف را ببیند و از مسیرهای مشخص‌شده بین اتاق‌ها حرکت کند.</Text>
   <Text style={st.label}>نام اتاق یا بخش</Text>
   <View style={st.chips}>{ROOMS.map(x=><TouchableOpacity key={x} onPress={()=>setRoom(x)} style={[st.chip,room===x&&st.chipOn]}><Text style={[st.chipText,room===x&&st.chipTextOn]}>{x}</Text></TouchableOpacity>)}</View>
   <TouchableOpacity style={st.add} onPress={add} disabled={busy}>{busy?<ActivityIndicator color={colors.background}/>:<Text style={st.addText}>＋ افزودن پانورامای ۳۶۰ از گالری</Text>}</TouchableOpacity>
   <Text style={st.note}>عکس معمولی، پانورامای کامل نیست. فایل باید تصویر کروی ۳۶۰ درجه (Equirectangular) باشد. فرمت JPG، PNG و WebP پشتیبانی می‌شود.</Text>

   <View style={st.listHead}><Text style={st.section}>اتاق‌های این تور</Text><Text style={st.count}>{scenes.length} اتاق</Text></View>
   {loading?<ActivityIndicator color={colors.primary}/>:scenes.length===0?<View style={st.empty}><Text style={st.itemTitle}>هنوز اتاقی اضافه نشده</Text><Text style={st.note}>با افزودن پانورامای ورودی یا پذیرایی شروع کنید.</Text></View>:scenes.map((s,i)=><View key={s.id} style={st.card}>
    {s.panoramaUrl?<Image source={{uri:s.panoramaUrl}} style={st.thumb}/>:<View style={st.thumb}/>}
    <View style={st.info}><Text style={st.itemTitle}>{i+1}. {s.title}</Text><Text style={st.meta}>{links.filter(l=>l.fromSceneId===s.id).length} مسیر خروجی</Text>
     {s.isEntry?<Text style={st.entry}>نقطه شروع بازدید</Text>:<TouchableOpacity onPress={()=>entry(s)}><Text style={st.link}>تنظیم به‌عنوان نقطه شروع</Text></TouchableOpacity>}
     <TouchableOpacity onPress={()=>{setSourceSceneId(s.id);setTargetSceneId(scenes.find(x=>x.id!==s.id)?.id||'');setPoint(null);}}><Text style={st.link}>ساخت اتصال از این اتاق</Text></TouchableOpacity>
     <TouchableOpacity onPress={()=>del(s)}><Text style={st.delete}>حذف اتاق</Text></TouchableOpacity>
    </View>
   </View>)}

   {scenes.length>=2?<View style={st.editor}>
    <Text style={st.section}>اتصال تصویری اتاق‌ها</Text>
    <Text style={st.descSmall}>۱) اتاق مبدأ را انتخاب کنید. ۲) اتاق مقصد را مشخص کنید. ۳) روی تصویر ۳۶۰، جهت در یا راهروی مقصد را لمس کنید.</Text>
    <Text style={st.label}>اتاق مبدأ</Text>
    <View style={st.chips}>{scenes.map(s=><TouchableOpacity key={s.id} onPress={()=>{setSourceSceneId(s.id);setTargetSceneId(current=>current===s.id?(scenes.find(x=>x.id!==s.id)?.id||''):current);setPoint(null);}} style={[st.chip,sourceSceneId===s.id&&st.chipOn]}><Text style={[st.chipText,sourceSceneId===s.id&&st.chipTextOn]}>{s.title}</Text></TouchableOpacity>)}</View>
    <Text style={st.label}>اتاق مقصد</Text>
    <View style={st.chips}>{targets.map(s=><TouchableOpacity key={s.id} onPress={()=>setTargetSceneId(s.id)} style={[st.chip,targetSceneId===s.id&&st.chipOn]}><Text style={[st.chipText,targetSceneId===s.id&&st.chipTextOn]}>{s.title}</Text></TouchableOpacity>)}</View>
    {sourceScene?.panoramaUrl?<View style={st.preview}><WebView key={sourceScene.id+sourceScene.panoramaUrl} source={{html:editorHtml(sourceScene.panoramaUrl)}} originWhitelist={['*']} javaScriptEnabled domStorageEnabled scrollEnabled={false} onMessage={event=>{try{const data=JSON.parse(event.nativeEvent.data);if(data.type==='point')setPoint({yaw:Number(data.yaw),pitch:Number(data.pitch)});else if(data.type==='error')Alert.alert('نمایش پانوراما',data.message||'بارگذاری تصویر ناموفق بود.');}catch{}}}/></View>:<View style={st.empty}><Text style={st.note}>برای این اتاق تصویر پانورامای قابل نمایش وجود ندارد.</Text></View>}
    {point?<Text style={st.point}>نقطه انتخاب‌شده: زاویه افقی {point.yaw}°، عمودی {point.pitch}°</Text>:<Text style={st.note}>هنوز نقطه‌ای انتخاب نشده است؛ روی تصویر ضربه بزنید.</Text>}
    <TextInput value={label} onChangeText={setLabel} placeholder="متن روی نقطه اتصال" placeholderTextColor={colors.textMuted} style={st.input}/>
    <TouchableOpacity style={[st.add,!point&&st.disabled]} onPress={saveLink} disabled={busy||!point}>{busy?<ActivityIndicator color={colors.background}/>:<Text style={st.addText}>ذخیره اتصال اتاق‌ها</Text>}</TouchableOpacity>
   </View>:null}

   <View style={st.listHead}><Text style={st.section}>مسیرهای ذخیره‌شده</Text><Text style={st.count}>{links.length} اتصال</Text></View>
   {links.length===0?<Text style={st.note}>هنوز اتاق‌ها به هم متصل نشده‌اند.</Text>:links.map(link=>{
    const from=scenes.find(s=>s.id===link.fromSceneId),to=scenes.find(s=>s.id===link.toSceneId);
    return <View key={link.id} style={st.linkCard}><View style={st.linkInfo}><Text style={st.itemTitle}>{from?.title||'اتاق حذف‌شده'} ← {to?.title||'اتاق حذف‌شده'}</Text><Text style={st.meta}>{link.label} · زاویه {link.yaw}° / {link.pitch}°</Text></View><TouchableOpacity onPress={()=>removeLink(link)}><Text style={st.delete}>حذف</Text></TouchableOpacity></View>;
   })}
  </ScrollView>
 </SafeAreaView>;
}

const st=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.background},
 header:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',padding:spacing.lg,borderBottomWidth:1,borderBottomColor:colors.border},
 back:{color:colors.primary},headTitle:{fontSize:17,fontWeight:'700',color:colors.text},body:{padding:spacing.lg,paddingBottom:48},
 title:{fontSize:21,fontWeight:'800',color:colors.text,textAlign:'right'},
 desc:{fontSize:13,color:colors.textSecondary,textAlign:'right',lineHeight:22,marginVertical:10},
 descSmall:{fontSize:12,color:colors.textSecondary,textAlign:'right',lineHeight:21,marginBottom:12},
 label:{color:colors.textSecondary,textAlign:'right',marginBottom:8,marginTop:10},
 chips:{flexDirection:'row-reverse',flexWrap:'wrap',gap:7,marginBottom:13},
 chip:{padding:9,borderRadius:18,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
 chipOn:{borderColor:colors.primary,backgroundColor:'rgba(59,130,246,0.16)'},
 chipText:{color:colors.textSecondary,fontSize:12},chipTextOn:{color:colors.primary,fontWeight:'700'},
 add:{backgroundColor:colors.primary,padding:15,borderRadius:borderRadius.lg,alignItems:'center',marginTop:8},
 addText:{color:colors.background,fontWeight:'800'},disabled:{opacity:0.45},
 note:{fontSize:11,color:colors.textMuted,textAlign:'right',lineHeight:19,marginTop:9},
 listHead:{flexDirection:'row-reverse',justifyContent:'space-between',marginTop:23,marginBottom:12},
 section:{fontSize:16,fontWeight:'700',color:colors.text},count:{color:colors.textMuted},
 empty:{padding:22,backgroundColor:colors.surface,borderRadius:12,alignItems:'center'},
 card:{flexDirection:'row-reverse',gap:12,padding:10,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:12,marginBottom:9},
 thumb:{width:82,height:75,borderRadius:8,backgroundColor:'#17243a'},
 info:{flex:1,alignItems:'flex-end',gap:6},itemTitle:{fontSize:14,fontWeight:'700',color:colors.text},
 meta:{fontSize:10,color:colors.textMuted,textAlign:'right'},entry:{fontSize:11,color:'#34d399'},
 link:{fontSize:11,color:colors.primary},delete:{fontSize:11,color:'#f87171'},
 editor:{marginTop:20,padding:13,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:14},
 preview:{height:260,overflow:'hidden',borderRadius:10,marginTop:10,backgroundColor:'#07111f'},
 point:{fontSize:12,color:'#34d399',textAlign:'right',marginTop:10},
 input:{backgroundColor:colors.background,borderColor:colors.border,borderWidth:1,borderRadius:9,padding:12,color:colors.text,textAlign:'right',marginTop:12},
 linkCard:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:10,padding:12,backgroundColor:colors.surface,borderRadius:10,marginBottom:8},
 linkInfo:{flex:1,alignItems:'flex-end',gap:5},
});
