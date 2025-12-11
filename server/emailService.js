import mailjet from 'node-mailjet';

// Mailjet yapılandırması
const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const DEFAULT_FROM_EMAIL = 'noreply@hairologyyasinpremiumrandevu.com';
const FROM_EMAIL = process.env.FROM_EMAIL || DEFAULT_FROM_EMAIL || ADMIN_EMAIL;
const FROM_NAME = process.env.FROM_NAME || 'Hairlogy Yasin Premium';

// Mailjet client'ı başlat
let mailjetClient = null;
if (MAILJET_API_KEY && MAILJET_API_SECRET) {
  try {
    mailjetClient = mailjet.apiConnect(MAILJET_API_KEY, MAILJET_API_SECRET);
    // Only log once at startup
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Mailjet client başlatıldı');
    }
  } catch (error) {
    console.error('❌ Mailjet client başlatılırken hata:', error.message);
  }
} else {
  console.warn('⚠️ Mailjet yapılandırması eksik - email gönderilemeyecek');
}

/**
 * Müşteriye randevu onay maili gönderir
 * @param {Object} bookingData - Randevu bilgileri
 * @returns {Promise} Mailjet response
 */
export const sendCustomerConfirmationEmail = async (bookingData) => {
  if (!mailjetClient) {
    return null;
  }

  if (!bookingData.customerEmail) {
    return null;
  }

  if (!FROM_EMAIL) {
    console.error('❌ FROM_EMAIL ayarlanmamış. Mail gönderilemedi.');
    return null;
  }

  try {
    const request = mailjetClient.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: FROM_EMAIL,
            Name: FROM_NAME,
          },
          To: [
            {
              Email: bookingData.customerEmail,
              Name: bookingData.customerName,
            },
          ],
          Subject: `Randevu Onayı - ${bookingData.appointmentDate} ${bookingData.appointmentTime}`,
          HTMLPart: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #bc881b 0%, #8b6914 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #bc881b; }
                .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .info-row:last-child { border-bottom: none; }
                .label { font-weight: bold; color: #666; }
                .value { color: #333; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .button { display: inline-block; background: #bc881b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Hairlogy Yasin Premium</h1>
                  <p>Randevunuz Onaylandı!</p>
                </div>
                <div class="content">
                  <p>Sayın <strong>${bookingData.customerName}</strong>,</p>
                  <p>Randevunuz başarıyla oluşturulmuştur. Detaylar aşağıdadır:</p>
                  
                  <div class="info-box">
                    <div class="info-row">
                      <span class="label">Berber:</span>
                      <span class="value">${bookingData.barberName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Hizmet:</span>
                      <span class="value">${bookingData.serviceName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Tarih:</span>
                      <span class="value">${bookingData.appointmentDate}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Saat:</span>
                      <span class="value">${bookingData.appointmentTime}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Ücret:</span>
                      <span class="value"><strong>${bookingData.servicePrice}₺</strong></span>
                    </div>
                  </div>
                  
                  <p>Randevu tarihinizde salonumuza bekliyoruz. Herhangi bir değişiklik için lütfen bizimle iletişime geçin.</p>
                  
                  <div class="footer">
                    <p>Hairlogy Yasin Premium</p>
                    <p>Bu otomatik bir e-postadır, lütfen yanıtlamayın.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `,
          TextPart: `
            Hairlogy Yasin Premium - Randevu Onayı
            
            Sayın ${bookingData.customerName},
            
            Randevunuz başarıyla oluşturulmuştur.
            
            Berber: ${bookingData.barberName}
            Hizmet: ${bookingData.serviceName}
            Tarih: ${bookingData.appointmentDate}
            Saat: ${bookingData.appointmentTime}
            Ücret: ${bookingData.servicePrice}₺
            
            Randevu tarihinizde salonumuza bekliyoruz.
            
            Hairlogy Yasin Premium
          `,
        },
      ],
    });

    const result = await request;
    return result;
  } catch (error) {
    console.error('❌ Müşteriye mail gönderilirken hata:', error.message);
    if (error.response) {
      console.error('   Mailjet Response:', JSON.stringify(error.response.body, null, 2));
    }
    return null;
  }
};

/**
 * Admin'e yeni randevu bildirimi gönderir
 * @param {Object} bookingData - Randevu bilgileri
 * @returns {Promise} Mailjet response
 */
export const sendAdminNotificationEmail = async (bookingData) => {
  if (!mailjetClient) {
    return null;
  }

  if (!ADMIN_EMAIL) {
    console.error('❌ ADMIN_EMAIL ayarlanmamış. Admin maili gönderilemedi.');
    return null;
  }

  if (!FROM_EMAIL) {
    console.error('❌ FROM_EMAIL ayarlanmamış. Mail gönderilemedi.');
    return null;
  }

  try {
    const request = mailjetClient.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: FROM_EMAIL,
            Name: FROM_NAME,
          },
          To: [
            {
              Email: ADMIN_EMAIL,
              Name: 'Admin',
            },
          ],
          Subject: `Yeni Randevu - ${bookingData.customerName} - ${bookingData.appointmentDate} ${bookingData.appointmentTime}`,
          HTMLPart: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #bc881b 0%, #8b6914 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #bc881b; }
                .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .info-row:last-child { border-bottom: none; }
                .label { font-weight: bold; color: #666; }
                .value { color: #333; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Yeni Randevu Bildirimi</h1>
                </div>
                <div class="content">
                  <p>Yeni bir randevu oluşturuldu:</p>
                  
                  <div class="info-box">
                    <div class="info-row">
                      <span class="label">Müşteri Adı:</span>
                      <span class="value">${bookingData.customerName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Telefon:</span>
                      <span class="value">${bookingData.customerPhone}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Email:</span>
                      <span class="value">${bookingData.customerEmail || 'Belirtilmemiş'}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Berber:</span>
                      <span class="value">${bookingData.barberName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Hizmet:</span>
                      <span class="value">${bookingData.serviceName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Tarih:</span>
                      <span class="value">${bookingData.appointmentDate}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Saat:</span>
                      <span class="value">${bookingData.appointmentTime}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Ücret:</span>
                      <span class="value"><strong>${bookingData.servicePrice}₺</strong></span>
                    </div>
                  </div>
                  
                  <div class="footer">
                    <p>Hairlogy Yasin Premium - Admin Paneli</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `,
          TextPart: `
            Yeni Randevu Bildirimi
            
            Müşteri Adı: ${bookingData.customerName}
            Telefon: ${bookingData.customerPhone}
            Email: ${bookingData.customerEmail || 'Belirtilmemiş'}
            Berber: ${bookingData.barberName}
            Hizmet: ${bookingData.serviceName}
            Tarih: ${bookingData.appointmentDate}
            Saat: ${bookingData.appointmentTime}
            Ücret: ${bookingData.servicePrice}₺
          `,
        },
      ],
    });

    const result = await request;
    return result;
  } catch (error) {
    console.error('❌ Admin\'e mail gönderilirken hata:', error.message);
    if (error.response) {
      console.error('   Mailjet Response:', JSON.stringify(error.response.body, null, 2));
    }
    return null;
  }
};

/**
 * Müşteriye randevu hatırlatma maili gönderir
 * @param {Object} bookingData - Randevu bilgileri
 * @returns {Promise|null} Mailjet response
 */
export const sendBookingReminderEmail = async (bookingData) => {
  if (!mailjetClient) {
    return null;
  }

  if (!bookingData.customerEmail) {
    return null;
  }

  try {
    const request = mailjetClient.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: FROM_EMAIL,
            Name: FROM_NAME,
          },
          To: [
            {
              Email: bookingData.customerEmail,
              Name: bookingData.customerName,
            },
          ],
          Subject: `Randevu Hatırlatma - ${bookingData.appointmentDate} ${bookingData.appointmentTime}`,
          HTMLPart: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #bc881b 0%, #8b6914 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #bc881b; }
                .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .info-row:last-child { border-bottom: none; }
                .label { font-weight: bold; color: #666; }
                .value { color: #333; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Randevu Hatırlatma</h1>
                  <p>Hairlogy Yasin Premium</p>
                </div>
                <div class="content">
                  <p>Sayın <strong>${bookingData.customerName}</strong>,</p>
                  <p>${bookingData.appointmentDate} tarihinde ${bookingData.appointmentTime} saatinde randevunuz bulunmaktadır.</p>
                  
                  <div class="info-box">
                    <div class="info-row">
                      <span class="label">Berber:</span>
                      <span class="value">${bookingData.barberName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Hizmet:</span>
                      <span class="value">${bookingData.serviceName}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Tarih:</span>
                      <span class="value">${bookingData.appointmentDate}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Saat:</span>
                      <span class="value">${bookingData.appointmentTime}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Ücret:</span>
                      <span class="value"><strong>${bookingData.servicePrice}₺</strong></span>
                    </div>
                  </div>
                  
                  <p>Randevunuza zamanında gelmenizi rica ederiz. Değişiklik yapmanız gerekiyorsa lütfen bizimle iletişime geçin.</p>
                  
                  <div class="footer">
                    <p>Hairlogy Yasin Premium</p>
                    <p>Bu otomatik bir e-postadır, lütfen yanıtlamayın.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `,
          TextPart: `
            Randevu Hatırlatma - Hairlogy Yasin Premium
            
            Sayın ${bookingData.customerName},
            
            ${bookingData.appointmentDate} tarihinde ${bookingData.appointmentTime} saatinde randevunuz bulunmaktadır.
            
            Berber: ${bookingData.barberName}
            Hizmet: ${bookingData.serviceName}
            Tarih: ${bookingData.appointmentDate}
            Saat: ${bookingData.appointmentTime}
            Ücret: ${bookingData.servicePrice}₺
            
            Randevunuza zamanında gelmenizi rica ederiz.
          `,
        },
      ],
    });

    const result = await request;
    return result;
  } catch (error) {
    console.error('❌ Hatırlatma maili gönderilirken hata:', error.message);
    return null;
  }
};
