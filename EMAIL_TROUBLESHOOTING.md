# E-posta Sorun Giderme Rehberi

## Hızlı Kontrol

1. **Sunucu loglarını kontrol edin**: Sunucu başlarken şu mesajları görmelisiniz:
   - ✅ Mailjet client başarıyla başlatıldı
   - 📧 FROM_EMAIL: ...
   - 👤 ADMIN_EMAIL: ...

2. **Diagnostic endpoint'i kullanın**: 
   ```
   GET /api/email-config
   ```
   Bu endpoint e-posta yapılandırmanızın durumunu gösterir.

## Yaygın Sorunlar ve Çözümleri

### 1. Environment Variables Eksik

**Kontrol:**
- `MAILJET_API_KEY` ayarlı mı?
- `MAILJET_API_SECRET` ayarlı mı?
- `ADMIN_EMAIL` ayarlı mı?
- `FROM_EMAIL` ayarlı mı? (opsiyonel, varsayılan kullanılabilir)

**Çözüm:**
- `.env` dosyasına veya deployment platform'unuzun environment variables ayarlarına ekleyin:
  ```env
  MAILJET_API_KEY=your_api_key_here
  MAILJET_API_SECRET=your_api_secret_here
  ADMIN_EMAIL=admin@example.com
  FROM_EMAIL=noreply@example.com
  FROM_NAME=Hairlogy Yasin Premium
  ```

### 2. FROM_EMAIL Mailjet'te Doğrulanmamış

**Sorun:** Mailjet, gönderen e-posta adresinin doğrulanmış olmasını gerektirir.

**Çözüm:**
1. Mailjet Dashboard'a giriş yapın
2. **Senders & Domain** > **Senders** sekmesine gidin
3. `FROM_EMAIL` adresinizi ekleyin ve doğrulayın
4. E-posta adresinize gelen doğrulama linkine tıklayın

### 3. API Key'ler Yanlış

**Kontrol:** Mailjet Dashboard'dan API Key ve Secret Key'i tekrar kontrol edin.

**Çözüm:**
1. Mailjet Dashboard > **Account Settings** > **API Keys**
2. Yeni bir API Key oluşturun veya mevcut olanı kontrol edin
3. Environment variables'ı güncelleyin

### 4. Mailjet Quota Aşıldı

**Kontrol:** Mailjet Dashboard'da günlük gönderim limitinizi kontrol edin (ücretsiz plan: 200 mail/gün).

**Çözüm:** Limit aşıldıysa bir sonraki gün bekleyin veya plan yükseltin.

## Test Etme

1. **Randevu oluşturun** ve sunucu loglarını izleyin:
   - `📧 Müşteri onay maili gönderiliyor...`
   - `📧 Admin bildirim maili gönderiliyor...`
   - `✅ Müşteriye mail başarıyla gönderildi!`
   - `✅ Admin'e mail başarıyla gönderildi!`

2. **Hata durumunda** loglarda şunları göreceksiniz:
   - `❌ Mailjet yapılandırması eksik`
   - `❌ Müşteriye mail gönderilirken hata oluştu!`
   - Hata detayları ve Mailjet response'u

## Log Örnekleri

### Başarılı Gönderim:
```
✅ Mailjet client başarıyla başlatıldı
📧 FROM_EMAIL: noreply@example.com
👤 ADMIN_EMAIL: admin@example.com
📧 Müşteri onay maili gönderiliyor...
   Alıcı: customer@example.com
📤 Mailjet'e istek gönderiliyor: customer@example.com
✅ Müşteriye mail başarıyla gönderildi!
```

### Hata Durumu:
```
⚠️ Mailjet yapılandırması eksik!
   MAILJET_API_KEY: ❌ Yok
   MAILJET_API_SECRET: ❌ Yok
```

## Production Deployment

### Railway/Render/Heroku:
Environment Variables'ı platform ayarlarından ekleyin.

### Netlify:
Backend ayrı bir serviste çalışıyorsa, backend'in environment variables'ını ayarlayın.

## İletişim

Sorun devam ederse:
1. Sunucu loglarını kontrol edin
2. `/api/email-config` endpoint'ini çağırın
3. Mailjet Dashboard'da mail gönderim loglarını kontrol edin


