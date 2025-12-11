# Firebase Kurulum Rehberi

## 1. Firebase Projesi Oluşturma

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. "Add project" (Proje Ekle) butonuna tıklayın
3. Proje adını girin (örn: "hairlogy-yasin-premium")
4. Google Analytics'i isteğe bağlı olarak etkinleştirin
5. "Create project" (Proje Oluştur) butonuna tıklayın

## 2. Firestore Database Oluşturma

1. Firebase Console'da sol menüden "Firestore Database" seçin
2. "Create database" (Veritabanı Oluştur) butonuna tıklayın
3. "Start in test mode" (Test modunda başlat) seçeneğini seçin
4. Location (Konum) seçin (örn: europe-west1)
5. "Enable" (Etkinleştir) butonuna tıklayın

## 3. Service Account Key Oluşturma

1. Firebase Console'da sol üst köşedeki ⚙️ (Settings) ikonuna tıklayın
2. "Project settings" (Proje ayarları) seçin
3. "Service accounts" (Hizmet hesapları) sekmesine gidin
4. "Generate new private key" (Yeni özel anahtar oluştur) butonuna tıklayın
5. JSON dosyası indirilecek - bu dosyayı `server/serviceAccountKey.json` olarak kaydedin
6. **ÖNEMLİ**: Bu dosyayı `.gitignore`'a ekleyin ve asla commit etmeyin!

## 4. Backend Yapılandırması

### Seçenek 1: Service Account Dosyası Kullan (Önerilen)

1. İndirdiğiniz JSON dosyasını `server/serviceAccountKey.json` olarak kaydedin
2. `server/.env` dosyası oluşturun:
```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

### Seçenek 2: Environment Variables Kullan

`server/.env` dosyasına şunları ekleyin:
```env
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

Service Account JSON dosyasından bu değerleri alabilirsiniz.

## 5. Firestore Security Rules

Firebase Console > Firestore Database > Rules sekmesine gidin ve şu kuralları ekleyin:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Bookings - sadece admin yazabilir, herkes okuyabilir (gerekirse değiştirilebilir)
    match /bookings/{bookingId} {
      allow read: if true;
      allow write: if false; // Sadece backend API üzerinden yazılabilir
    }
    
    // Barbers - herkes okuyabilir
    match /barbers/{barberId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Services - herkes okuyabilir
    match /services/{serviceId} {
      allow read: if true;
      allow write: if false;
    }
    
    // Admin users - sadece backend erişebilir
    match /admin_users/{userId} {
      allow read, write: if false;
    }
  }
}
```

## 6. Backend Bağımlılıklarını Yükleme

```bash
cd server
npm install
```

## 7. Server'ı Başlatma

```bash
# SQLite versiyonu yerine Firebase versiyonunu kullan
node index-firebase.js
```

Veya `package.json`'da script'i güncelleyin:
```json
"scripts": {
  "start": "node index-firebase.js"
}
```

## 8. Test Etme

1. Backend'i başlatın: `cd server && npm start`
2. Frontend'i başlatın: `npm run dev`
3. Bir randevu oluşturun
4. Firebase Console > Firestore Database'de `bookings` koleksiyonunda randevunun göründüğünü kontrol edin

## Güvenlik Notları

- ✅ Service Account key dosyasını asla commit etmeyin
- ✅ `.env` dosyasını `.gitignore`'a ekleyin
- ✅ Production'da JWT_SECRET'ı güçlü bir değerle değiştirin
- ✅ Firestore Security Rules'ı production için sıkılaştırın
- ✅ Firebase Console'da API anahtarlarını kısıtlayın

## Avantajlar

- ✅ Real-time database
- ✅ Otomatik ölçeklenebilir
- ✅ Ücretsiz plan (Spark Plan)
- ✅ Kolay backup ve restore
- ✅ Firebase Console'dan veri görüntüleme
- ✅ Cloud hosting seçeneği


