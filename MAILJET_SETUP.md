# Mailjet Kurulum Rehberi

## 1. Mailjet Hesabı Oluşturma

1. [Mailjet](https://www.mailjet.com/) adresine gidin
2. "Sign Up" butonuna tıklayın
3. Ücretsiz hesap oluşturun (200 mail/gün ücretsiz)
4. Email adresinizi doğrulayın

## 2. API Key ve Secret Key Alma

1. Mailjet Dashboard'a giriş yapın
2. Sol menüden **Account Settings** > **API Keys** seçin
3. **Create API Key** butonuna tıklayın
4. API Key ve Secret Key'i kopyalayın (Secret Key sadece bir kez gösterilir!)

## 3. Backend Environment Variables

`server/.env` dosyasına şu değişkenleri ekleyin:

```env
# Mailjet API Bilgileri
MAILJET_API_KEY=your_api_key_here
MAILJET_API_SECRET=your_api_secret_here

# Email Ayarları
ADMIN_EMAIL=admin@hairologyyasinpremiumrandevu.com
FROM_EMAIL=noreply@hairologyyasinpremiumrandevu.com
FROM_NAME=Hairlogy Yasin Premium
```

### Önemli Notlar:

- **MAILJET_API_KEY**: Mailjet dashboard'dan aldığınız API Key
- **MAILJET_API_SECRET**: Mailjet dashboard'dan aldığınız Secret Key
- **ADMIN_EMAIL**: Yeni randevu bildirimlerinin gönderileceği admin email adresi
- **FROM_EMAIL**: Mailjet'te doğrulanmış bir email adresi olmalı (Sender Email)
- **FROM_NAME**: Gönderen adı (opsiyonel, varsayılan: "Hairlogy Yasin Premium")

## 4. Mailjet'te Sender Email Doğrulama

1. Mailjet Dashboard > **Senders & Domain** > **Senders** sekmesine gidin
2. **Add Sender** butonuna tıklayın
3. Email adresinizi girin (FROM_EMAIL olarak kullanacağınız)
4. Email adresinize gelen doğrulama linkine tıklayın
5. Email adresiniz doğrulandıktan sonra kullanabilirsiniz

## 5. Test Etme

Randevu oluşturduğunuzda:
- ✅ Müşteriye email adresi varsa otomatik onay maili gönderilir
- ✅ Admin'e yeni randevu bildirimi gönderilir

## 6. Production Deployment

### Railway/Render/Heroku için:

Environment Variables'ı platform ayarlarından ekleyin:

```
MAILJET_API_KEY=your_api_key
MAILJET_API_SECRET=your_api_secret
ADMIN_EMAIL=admin@example.com
FROM_EMAIL=noreply@example.com
FROM_NAME=Hairlogy Yasin Premium
```

### Netlify için:

Frontend için gerekli değil (mail gönderimi backend'de yapılıyor).

## 7. Mailjet Özellikleri

- ✅ **200 mail/gün ücretsiz** (EmailJS: 200/ay)
- ✅ **Daha iyi deliverability** (mail teslim oranı)
- ✅ **Analytics** (mail açılma, tıklama istatistikleri)
- ✅ **Template yönetimi** (Mailjet dashboard'dan)
- ✅ **SMTP desteği**
- ✅ **Transactional email** için optimize

## 8. Sorun Giderme

### Mail gönderilmiyor:

1. **API Key kontrolü**: `MAILJET_API_KEY` ve `MAILJET_API_SECRET` doğru mu?
2. **Sender Email**: `FROM_EMAIL` Mailjet'te doğrulanmış mı?
3. **Admin Email**: `ADMIN_EMAIL` geçerli bir email adresi mi?
4. **Console logları**: Backend console'da hata mesajlarını kontrol edin

### Mail spam'e düşüyor:

1. Mailjet'te **SPF** ve **DKIM** kayıtlarını kontrol edin
2. Domain doğrulaması yapın (daha profesyonel görünüm için)
3. Mailjet'in **Reputation** durumunu kontrol edin

## 9. Mailjet Dashboard

Mailjet dashboard'dan:
- 📊 Mail gönderim istatistikleri
- 📈 Açılma ve tıklama oranları
- 📧 Template yönetimi
- 🔍 Email logları
- ⚙️ API ayarları

## 10. Güvenlik

- ⚠️ **ASLA** API Key ve Secret Key'i kod içine yazmayın
- ⚠️ `.env` dosyasını `.gitignore`'a ekleyin
- ⚠️ Production'da environment variables kullanın


