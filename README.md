# NAMA — پلتفرم بازدید مجازی املاک

**NAMA** یک اپلیکیشن موبایل برای دفاتر املاک ایران است که امکان اسکن خانه با گوشی و نمایش تور سه‌بعدی / VR به مشتری قبل از بازدید حضوری را فراهم می‌کند.

> شعار: **خانه را قبل از رفتن، ببین.**

## مشخصات فنی

| مورد | مقدار |
|------|--------|
| نام اپ | NAMA |
| Package | `ir.nama.app` |
| فریم‌ورک | React Native + Expo (SDK 51) |
| زبان UI | فارسی (RTL) |
| رنگ اصلی | فیروزه‌ای `#22d3ee` |
| تم | تیره و مدرن |

## قابلیت‌ها

- صفحه اصلی با لوگو و شعار
- ثبت‌نام دفتر املاک و ورود مشاور
- داشبورد مشاور با لیست املاک
- افزودن ملک جدید (عنوان، شهر، آدرس، قیمت، متراژ، اتاق، طبقه، توضیحات)
- آپلود تصویر پانورامای ۳۶۰ و ویدیوی اسکن
- نمایش تور ۳۶۰ قابل‌چرخش (با Pannellum در WebView)
- افزودن Hotspot روی تور
- انتشار / پیش‌نویس کردن ملک
- لینک عمومی تور + شمارش بازدید
- حالت VR تمام‌صفحه برای هدست
- راهنمای اسکن خانه
- ذخیره توکن در AsyncStorage
- اتصال به API از طریق `EXPO_PUBLIC_API_URL`

## راه‌اندازی محلی

```bash
# کلون
git clone https://github.com/arshiabrzgr2301-cell/nama-app.git
cd nama-app

# نصب وابستگی‌ها
npm install

# کپی فایل محیط
cp .env.example .env
# سپس EXPO_PUBLIC_API_URL را تنظیم کنید (پیش‌فرض: http://localhost:8000)

# اجرا
npx expo start
```

برای ساخت APK دیباگ محلی:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

خروجی در مسیر تقریبی زیر قرار می‌گیرد:

`android/app/build/outputs/apk/debug/app-debug.apk`

## GitHub Actions — ساخت خودکار APK

با هر push به شاخه `main`، workflow زیر اجرا می‌شود:

`.github/workflows/build-android.yml`

- Node.js 20
- Expo prebuild
- Gradle `assembleDebug`
- آپلود Artifact با نام **`nama-debug.apk`**

### دانلود APK

1. به صفحه Actions بروید:  
   https://github.com/arshiabrzgr2301-cell/nama-app/actions
2. روی آخرین workflow موفق کلیک کنید.
3. در بخش **Artifacts** فایل `nama-debug.apk` را دانلود کنید.

## ساختار پروژه

```
nama-app/
├── App.tsx
├── app.json
├── package.json
├── src/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   ├── theme/
│   ├── types/
│   └── utils/
├── assets/
├── .github/workflows/build-android.yml
├── .env.example
└── README.md
```

## متغیرهای محیطی

| متغیر | توضیح | پیش‌فرض |
|--------|--------|----------|
| `EXPO_PUBLIC_API_URL` | آدرس بک‌اند NAMA | `http://localhost:8000` |

## لایسنس

این پروژه برای استفاده در دفاتر املاک ایران توسعه یافته است.
