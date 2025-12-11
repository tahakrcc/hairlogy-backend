# Hairlogy Yasin Premium - Randevu Sistemi

Modern ve kullanıcı dostu berber salonu randevu sistemi. Firebase Firestore veritabanı ve admin paneli ile tam özellikli bir uygulama.

## Özellikler

- 🎯 **Çoklu Berber Desteği**: Her berberin kendi ayrı randevu takvimi
- 📅 **Akıllı Tarih Seçimi**: Pazar günleri ve geçmiş tarihler otomatik filtrelenir
- ⏰ **Esnek Saat Seçimi**: Yemek molası (15:00-16:00) otomatik atlanır
- 💇 **Hizmet Seçimi**: Saç kesimi, sakal, çocuk tıraşı ve bakım hizmetleri
- 🔥 **Firebase Firestore**: Real-time veritabanı, otomatik ölçeklenebilir
- 🔐 **Admin Paneli**: Randevu yönetimi, istatistikler ve filtreleme
- 📱 **Responsive Tasarım**: Mobil ve masaüstü uyumlu

## Kurulum

### 1. Frontend Bağımlılıklarını Yükle

```bash
npm install
```

### 2. Firebase Kurulumu

Detaylı kurulum için `FIREBASE_SETUP.md` dosyasına bakın.

**Hızlı Başlangıç:**
1. [Firebase Console](https://console.firebase.google.com/)'da proje oluşturun
2. Firestore Database'i test modunda başlatın
3. Service Account Key'i indirin ve `server/serviceAccountKey.json` olarak kaydedin
4. `server/.env` dosyası oluşturun:
```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

### 3. Backend Bağımlılıklarını Yükle

```bash
cd server
npm install
cd ..
```

### 4. Çalıştırma

**Terminal 1 - Backend:**
```bash
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Backend: http://localhost:3001
Frontend: http://localhost:3000

## Admin Paneli

Admin paneline doğrudan URL ile erişebilirsiniz: `http://localhost:3000/admin`

**Varsayılan Giriş Bilgileri:**
- Kullanıcı Adı: `admin`
- Şifre: `admin123`

⚠️ **ÖNEMLİ**: 
- Admin paneli gizlidir ve ana sayfada görünmez
- Production ortamında mutlaka şifreyi değiştirin!
- Admin URL'ini güvenli tutun

## Veritabanı

Firebase Firestore kullanılmaktadır. Veriler Firebase Console'dan görüntülenebilir.

### Koleksiyonlar:
- `bookings`: Randevular
- `barbers`: Berberler
- `services`: Hizmetler
- `admin_users`: Admin kullanıcıları

## API Endpoints

### Public Endpoints
- `GET /api/barbers` - Tüm berberleri listele
- `GET /api/services` - Tüm hizmetleri listele
- `GET /api/available-times?barberId=1&date=2024-01-15` - Müsait saatleri getir
- `POST /api/bookings` - Yeni randevu oluştur

### Admin Endpoints (JWT Token gerekli)
- `POST /api/admin/login` - Admin girişi
- `GET /api/admin/bookings` - Tüm randevuları listele
- `GET /api/admin/bookings/:id` - Randevu detayı
- `PATCH /api/admin/bookings/:id` - Randevu durumunu güncelle
- `DELETE /api/admin/bookings/:id` - Randevu sil
- `GET /api/admin/stats` - İstatistikler

## Teknolojiler

### Frontend
- React 18
- React Router
- Vite
- Axios
- date-fns
- Lucide React (İkonlar)
- CSS3 (Modern tasarım)

### Backend
- Node.js
- Express
- Firebase Admin SDK
- JWT (Authentication)
- bcryptjs (Password hashing)
- CORS

## Firebase Avantajları

- ✅ Real-time database
- ✅ Otomatik ölçeklenebilir
- ✅ Ücretsiz plan (Spark Plan)
- ✅ Kolay backup ve restore
- ✅ Firebase Console'dan veri görüntüleme
- ✅ Cloud hosting seçeneği
- ✅ Güvenli ve güvenilir

## Notlar

- Randevular Firebase Firestore'da saklanır
- Pazar günleri randevu alınamaz
- Yemek molası: 15:00 - 16:00
- Randevu saatinden 10 dakika önce salonda bulunulması önerilir
- Admin token'ları 24 saat geçerlidir

## Geliştirme

Backend ve frontend'i aynı anda çalıştırmak için:

```bash
# Önce backend bağımlılıklarını yükleyin
cd server && npm install && cd ..

# Sonra her iki servisi başlatın
npm install -g concurrently
npm run dev:all
```

## Güvenlik

- ✅ Service Account key dosyasını asla commit etmeyin
- ✅ `.env` dosyasını `.gitignore`'a ekleyin
- ✅ Production'da JWT_SECRET'ı güçlü bir değerle değiştirin
- ✅ Firestore Security Rules'ı production için sıkılaştırın

## Lisans

Bu proje özel kullanım içindir.
