// Backend bağlantı testi
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

async function testBackend() {
  console.log('🔍 Backend bağlantı testi başlatılıyor...\n');

  // 1. Health check
  try {
    console.log('1. Health check testi...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check başarılı:', health.data);
  } catch (error) {
    console.error('❌ Health check başarısız:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Backend çalışmıyor! Lütfen backend\'i başlatın: cd server && npm start');
      return;
    }
  }

  // 2. Barbers endpoint
  try {
    console.log('\n2. Barbers endpoint testi...');
    const barbers = await axios.get(`${API_URL}/barbers`);
    console.log('✅ Barbers endpoint çalışıyor:', barbers.data.length, 'berber bulundu');
  } catch (error) {
    console.error('❌ Barbers endpoint hatası:', error.response?.data || error.message);
  }

  // 3. Admin login testi (başarısız olması normal, sadece endpoint çalışıyor mu kontrol ediyoruz)
  try {
    console.log('\n3. Admin login endpoint testi...');
    await axios.post(`${API_URL}/admin/login`, { username: 'test', password: 'test' });
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Admin login endpoint çalışıyor (401 beklenen hata)');
    } else if (error.response?.status === 500) {
      console.error('❌ Admin login endpoint 500 hatası:', error.response?.data);
    } else {
      console.error('❌ Admin login endpoint hatası:', error.response?.data || error.message);
    }
  }

  console.log('\n✅ Test tamamlandı!');
}

testBackend().catch(console.error);

