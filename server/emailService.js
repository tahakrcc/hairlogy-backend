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
    
    // Log detailed response
    if (result && result.body) {
      console.log('📧 Müşteri Mailjet Response:', JSON.stringify(result.body, null, 2));
      if (result.body.Messages && result.body.Messages[0]) {
        const messageStatus = result.body.Messages[0];
        if (messageStatus.Status === 'success') {
          console.log('✅ Müşteri emaili başarıyla Mailjet\'e gönderildi. MessageID:', messageStatus.To[0]?.MessageID || 'N/A');
        } else {
          console.warn('⚠️ Müşteri email gönderim durumu:', messageStatus.Status);
          if (messageStatus.Errors) {
            console.error('❌ Mailjet Hataları:', JSON.stringify(messageStatus.Errors, null, 2));
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Müşteriye mail gönderilirken hata:', error.message);
    if (error.response) {
      console.error('   Mailjet Error Response:', JSON.stringify(error.response.body, null, 2));
    }
    if (error.statusCode) {
      console.error('   Status Code:', error.statusCode);
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
    
    // Log detailed response
    if (result && result.body) {
      console.log('📧 Mailjet Response:', JSON.stringify(result.body, null, 2));
      if (result.body.Messages && result.body.Messages[0]) {
        const messageStatus = result.body.Messages[0];
        if (messageStatus.Status === 'success') {
          console.log('✅ Email başarıyla Mailjet\'e gönderildi. MessageID:', messageStatus.To[0]?.MessageID || 'N/A');
        } else {
          console.warn('⚠️ Email gönderim durumu:', messageStatus.Status);
          if (messageStatus.Errors) {
            console.error('❌ Mailjet Hataları:', JSON.stringify(messageStatus.Errors, null, 2));
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Admin\'e mail gönderilirken hata:', error.message);
    if (error.response) {
      console.error('   Mailjet Error Response:', JSON.stringify(error.response.body, null, 2));
    }
    if (error.statusCode) {
      console.error('   Status Code:', error.statusCode);
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

/**
 * Admin'e günlük randevu raporu emaili gönderir
 * @param {Object} data - { date, bookings } formatında
 * @returns {Promise} Mailjet response
 */
export const sendDailyReportEmail = async (data) => {
  if (!mailjetClient) {
    return null;
  }

  if (!ADMIN_EMAIL) {
    console.error('❌ ADMIN_EMAIL ayarlanmamış. Günlük rapor maili gönderilemedi.');
    return null;
  }

  if (!FROM_EMAIL) {
    console.error('❌ FROM_EMAIL ayarlanmamış. Mail gönderilemedi.');
    return null;
  }

  const { date, bookings } = data;

  if (!date || !bookings || bookings.length === 0) {
    console.warn('⚠️ Günlük rapor için tarih veya randevu bulunamadı.');
    return null;
  }

  // Berber bazında grupla
  const bookingsByBarber = {};
  let totalRevenue = 0;

  bookings.forEach(booking => {
    if (booking.status !== 'cancelled') {
      totalRevenue += parseFloat(booking.service_price) || 0;
    }
    
    const barberName = booking.barber_name || 'Bilinmeyen Berber';
    if (!bookingsByBarber[barberName]) {
      bookingsByBarber[barberName] = [];
    }
    bookingsByBarber[barberName].push(booking);
  });

  // Saat bazında sırala
  const timeOrder = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  Object.keys(bookingsByBarber).forEach(barber => {
    bookingsByBarber[barber].sort((a, b) => {
      const timeA = timeOrder.indexOf(a.appointment_time) || 999;
      const timeB = timeOrder.indexOf(b.appointment_time) || 999;
      return timeA - timeB;
    });
  });

  // HTML tablo oluştur
  const bookingRows = bookings
    .sort((a, b) => {
      const timeA = timeOrder.indexOf(a.appointment_time) || 999;
      const timeB = timeOrder.indexOf(b.appointment_time) || 999;
      return timeA - timeB;
    })
    .map(booking => {
      const statusBadge = {
        'confirmed': '<span style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Onaylandı</span>',
        'completed': '<span style="background: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Tamamlandı</span>',
        'cancelled': '<span style="background: #f44336; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">İptal</span>',
        'pending': '<span style="background: #FF9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Beklemede</span>'
      }[booking.status] || booking.status;

      return `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; text-align: center;">${booking.appointment_time || '-'}</td>
          <td style="padding: 12px;">${booking.barber_name || '-'}</td>
          <td style="padding: 12px;">${booking.customer_name || '-'}</td>
          <td style="padding: 12px;">${booking.customer_phone || '-'}</td>
          <td style="padding: 12px;">${booking.service_name || '-'}</td>
          <td style="padding: 12px; text-align: right;">${booking.service_price || 0}₺</td>
          <td style="padding: 12px; text-align: center;">${statusBadge}</td>
        </tr>
      `;
    }).join('');

  // Berber özeti HTML
  const barberSummary = Object.keys(bookingsByBarber).map(barberName => {
    const barberBookings = bookingsByBarber[barberName];
    const barberRevenue = barberBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (parseFloat(b.service_price) || 0), 0);
    
    return `
      <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #bc881b;">
        <strong>${barberName}</strong>: ${barberBookings.length} randevu - ${barberRevenue}₺
      </div>
    `;
  }).join('');

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
          Subject: `${date} Tarihli Günlük Randevu Raporu`,
          HTMLPart: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 800px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #bc881b 0%, #8b6914 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .summary-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #bc881b; }
                table { width: 100%; border-collapse: collapse; background: white; margin: 20px 0; border-radius: 8px; overflow: hidden; }
                th { background: #bc881b; color: white; padding: 12px; text-align: left; font-weight: bold; }
                td { padding: 12px; }
                tr:nth-child(even) { background: #f9f9f9; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${date} Günlük Randevu Raporu</h1>
                </div>
                <div class="content">
                  <p>Sayın Admin,</p>
                  <p>${date} tarihi için randevu detayları aşağıdadır:</p>
                  
                  <div class="summary-box">
                    <h3 style="margin-top: 0;">Özet</h3>
                    <p><strong>Toplam Randevu:</strong> ${bookings.length}</p>
                    <p><strong>Toplam Gelir:</strong> ${totalRevenue.toFixed(2)}₺</p>
                    ${Object.keys(bookingsByBarber).length > 1 ? `<div style="margin-top: 15px;"><strong>Berber Bazında:</strong>${barberSummary}</div>` : ''}
                  </div>

                  <h3>Detaylı Randevu Listesi</h3>
                  <table>
                    <thead>
                      <tr>
                        <th style="text-align: center;">Saat</th>
                        <th>Berber</th>
                        <th>Müşteri</th>
                        <th>Telefon</th>
                        <th>Hizmet</th>
                        <th style="text-align: right;">Ücret</th>
                        <th style="text-align: center;">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${bookingRows}
                    </tbody>
                  </table>
                  
                  <div class="footer">
                    <p>Hairlogy Yasin Premium - Admin Paneli</p>
                    <p>Bu otomatik bir e-postadır.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `,
          TextPart: `
            ${date} Günlük Randevu Raporu
            
            Sayın Admin,
            
            ${date} tarihi için randevu detayları:
            
            Toplam Randevu: ${bookings.length}
            Toplam Gelir: ${totalRevenue.toFixed(2)}₺
            
            ${Object.keys(bookingsByBarber).length > 1 ? `\nBerber Bazında:\n${Object.keys(bookingsByBarber).map(barber => {
              const barberBookings = bookingsByBarber[barber];
              const barberRevenue = barberBookings
                .filter(b => b.status !== 'cancelled')
                .reduce((sum, b) => sum + (parseFloat(b.service_price) || 0), 0);
              return `${barber}: ${barberBookings.length} randevu - ${barberRevenue}₺`;
            }).join('\n')}\n` : ''}
            
            Detaylı Liste:
            ${bookings.map(booking => `
              Saat: ${booking.appointment_time || '-'}
              Berber: ${booking.barber_name || '-'}
              Müşteri: ${booking.customer_name || '-'}
              Telefon: ${booking.customer_phone || '-'}
              Hizmet: ${booking.service_name || '-'}
              Ücret: ${booking.service_price || 0}₺
              Durum: ${booking.status || '-'}
              ---
            `).join('\n')}
            
            Hairlogy Yasin Premium - Admin Paneli
          `,
        },
      ],
    });

    const result = await request;
    
    if (result && result.body) {
      console.log('📧 Günlük Rapor Mailjet Response:', JSON.stringify(result.body, null, 2));
      if (result.body.Messages && result.body.Messages[0]) {
        const messageStatus = result.body.Messages[0];
        if (messageStatus.Status === 'success') {
          console.log('✅ Günlük rapor emaili başarıyla Mailjet\'e gönderildi. MessageID:', messageStatus.To[0]?.MessageID || 'N/A');
        } else {
          console.warn('⚠️ Günlük rapor email gönderim durumu:', messageStatus.Status);
          if (messageStatus.Errors) {
            console.error('❌ Mailjet Hataları:', JSON.stringify(messageStatus.Errors, null, 2));
          }
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Günlük rapor maili gönderilirken hata:', error.message);
    if (error.response) {
      console.error('   Mailjet Error Response:', JSON.stringify(error.response.body, null, 2));
    }
    if (error.statusCode) {
      console.error('   Status Code:', error.statusCode);
    }
    return null;
  }
};
