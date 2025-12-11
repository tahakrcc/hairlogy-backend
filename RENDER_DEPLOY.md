# Render.com Backend Deploy Rehberi

## 1. Render.com'a Giriş ve Proje Oluşturma

1. [Render.com](https://render.com) adresine gidin ve hesap oluşturun (GitHub ile giriş yapabilirsiniz)
2. Dashboard'da "New +" butonuna tıklayın
3. "Web Service" seçin
4. GitHub repository'nizi bağlayın veya "Public Git repository" URL'inizi girin

## 2. Render Service Ayarları

### Basic Settings:
- **Name**: `hairlogy-backend` (veya istediğiniz isim)
- **Region**: `Frankfurt` (veya size yakın bir bölge)
- **Branch**: `master` (veya `main`)
- **Root Directory**: `server` (önemli!)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Advanced Settings:
- **Auto-Deploy**: `Yes` (otomatik deploy için)

## 3. Environment Variables (ÖNEMLİ!)

Render Dashboard'da "Environment" sekmesine gidin ve şu değişkenleri ekleyin:

### Firebase Credentials (3 seçenekten biri):

**Seçenek 1: Service Account Key JSON (Önerilen)**
```
Key: FIREBASE_SERVICE_ACCOUNT_KEY
Value: [serviceAccountKey.json dosyasının TÜM içeriği - JSON string olarak]
```

**Seçenek 2: Environment Variables (Ayrı ayrı)**
```
Key: FIREBASE_PROJECT_ID
Value: [Firebase proje ID'niz]

Key: FIREBASE_PRIVATE_KEY
Value: [Firebase private key - \n karakterlerini koruyun]

Key: FIREBASE_CLIENT_EMAIL
Value: [Firebase client email]
```

### Diğer Environment Variables:
```
Key: NODE_ENV
Value: production

Key: PORT
Value: 10000

Key: JWT_SECRET
Value: [Güçlü bir secret key - örn: openssl rand -base64 32]
```

## 4. Firebase Service Account Key Nasıl Alınır?

1. [Firebase Console](https://console.firebase.google.com/) → Projeniz
2. ⚙️ Settings → Project settings
3. "Service accounts" sekmesi
4. "Generate new private key" butonuna tıklayın
5. İndirilen JSON dosyasını açın
6. Tüm içeriği kopyalayın ve Render'da `FIREBASE_SERVICE_ACCOUNT_KEY` olarak yapıştırın

## 5. Deploy

1. "Create Web Service" butonuna tıklayın
2. Render otomatik olarak build ve deploy yapacak
3. Deploy tamamlandığında size bir URL verecek (örn: `https://hairlogy-backend.onrender.com`)

## 6. Backend URL'ini Netlify'a Ekleme

1. Render'dan aldığınız backend URL'ini kopyalayın (örn: `https://hairlogy-backend.onrender.com`)
2. Netlify Dashboard → Environment variables
3. Yeni variable ekleyin:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://hairlogy-backend.onrender.com/api` (URL'nin sonuna `/api` ekleyin)
4. Netlify'da "Trigger deploy" yapın

## 7. Test

1. Netlify frontend'inizi açın
2. Console'da hata olmamalı
3. Randevu alma sayfası çalışmalı

## Notlar:

- Render free plan'da uygulama 15 dakika kullanılmazsa "sleep" moduna geçer
- İlk istek 30-60 saniye sürebilir (cold start)
- Production için Render'in paid plan'ını düşünebilirsiniz veya Railway.app kullanabilirsiniz

