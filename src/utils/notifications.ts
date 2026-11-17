import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_ID_KEY = '@nama_daily_report_notification';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('nama-reminders', {
      name: 'یادآوری‌های NAMA',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 150, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
  return permission.status === 'granted';
}

export async function scheduleDailyActivityReminder(): Promise<void> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) return;
  const previous = await AsyncStorage.getItem(DAILY_ID_KEY);
  if (previous) await Notifications.cancelScheduledNotificationAsync(previous).catch(() => {});
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'NAMA | ثبت عملکرد روزانه',
      body: 'ساعت ثبت عملکرد امروز رسیده است. لطفاً گزارش فعالیت‌های امروزتان را ثبت کنید.',
      sound: 'default',
      data: { screen: 'Activity' },
    },
    trigger: { hour: 22, minute: 0, repeats: true, channelId: 'nama-reminders' } as any,
  });
  await AsyncStorage.setItem(DAILY_ID_KEY, id);
}

export async function scheduleReminderNotification(title: string, notes: string, dueAt: string): Promise<string | null> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) return null;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error('زمان یادآوری باید در آینده باشد.');
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'NAMA | ' + title,
      body: notes || 'زمان انجام یادآوری فرا رسیده است.',
      sound: 'default',
      data: { screen: 'Reminders' },
    },
    trigger: { date, channelId: 'nama-reminders' } as any,
  });
}

export async function cancelReminderNotification(id?: string | null): Promise<void> {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
