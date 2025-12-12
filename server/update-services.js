// Services güncelleme scripti
// Kullanım: node update-services.js

import dotenv from 'dotenv';
import { db } from './firebase-config.js';

dotenv.config();

const newServices = [
  { name: 'Saç & Sakal + Yıkama + Fön', duration: 60, price: 600, active: true },
  { name: 'Saç Kesimi + Yıkama + Fön', duration: 45, price: 500, active: true },
  { name: 'VIP Hizmet (Cilt bakımı, keratinli saç bakımı maskesi, profesyonel masaj)', duration: 120, price: 2500, active: true },
  { name: 'Profesyonel Buharlı Cilt Bakımı', duration: 60, price: 500, active: true },
  { name: 'Buharlı Keratinli Saç Bakımı Maskesi', duration: 60, price: 500, active: true },
  { name: 'VIP House Tıraş', duration: 90, price: 5000, active: true }
];

async function updateServices() {
  try {
    console.log('🔄 Hizmetler güncelleniyor...\n');

    // Mevcut tüm hizmetleri pasif yap
    const existingSnapshot = await db.collection('services').get();
    const updatePromises = [];
    
    existingSnapshot.forEach(doc => {
      updatePromises.push(doc.ref.update({ active: false }));
    });
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`✅ ${updatePromises.length} eski hizmet pasif yapıldı\n`);
    }

    // Yeni hizmetleri ekle
    const addPromises = newServices.map(service => {
      return db.collection('services').add({
        ...service,
        created_at: new Date()
      });
    });

    await Promise.all(addPromises);
    console.log('✅ Yeni hizmetler eklendi:\n');
    newServices.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service.name} - ${service.price}₺`);
    });

    console.log('\n✅ Hizmetler başarıyla güncellendi!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

updateServices();

