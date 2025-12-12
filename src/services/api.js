import axios from 'axios';

// API Base URL Configuration
// Production için: Netlify'da Environment Variable olarak VITE_API_URL ayarlayın
const getApiBaseUrl = () => {
  // 1. Öncelik: Environment variable (Netlify'da ayarlanmalı)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. Production modunda ve environment variable yoksa
  if (import.meta.env.PROD) {
    // ⚠️ UYARI: Backend URL'i ayarlanmamış!
    // Netlify Dashboard → Site settings → Environment variables
    // Key: VITE_API_URL
    // Value: https://your-backend.onrender.com/api (veya backend URL'iniz)
    console.error('⚠️ VITE_API_URL environment variable ayarlanmamış!');
    console.error('Netlify Dashboard\'dan VITE_API_URL environment variable\'ını ekleyin.');
    // Fallback: placeholder URL (hata mesajı için)
    return 'https://your-backend-url.com/api';
  }
  
  // 3. Development için localhost proxy
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Production'da API URL'ini console'a yazdır (debug için)
if (import.meta.env.PROD) {
  console.log('🔗 API Base URL:', API_BASE_URL);
  if (API_BASE_URL.includes('your-backend-url.com')) {
    console.error('❌ VITE_API_URL environment variable ayarlanmamış!');
    console.error('Netlify Dashboard → Site settings → Environment variables');
    console.error('Key: VITE_API_URL');
    console.error('Value: https://hairlogy-backend.onrender.com/api');
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 saniye timeout
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network errors ve timeout'ları daha iyi handle et
    if (!error.response) {
      // Request failed but no response (network error, timeout, etc.)
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        error.userMessage = 'Backend sunucusuna bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.';
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        error.userMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
      } else if (error.code === 'ERR_CANCELED') {
        // Canceled requests - ignore
        return Promise.reject(error);
      } else {
        error.userMessage = `Bağlantı hatası: ${error.message || 'Bilinmeyen hata'}`;
      }
      console.error('API Network Error:', {
        code: error.code,
        message: error.message,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      });
      return Promise.reject(error);
    }
    
    // Server responded with error status
    const status = error.response.status;
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    
    // User-friendly error messages
    if (status === 401) {
      error.userMessage = 'Yetkilendirme hatası. Lütfen tekrar giriş yapın.';
    } else if (status === 403) {
      error.userMessage = 'Bu işlem için yetkiniz yok.';
    } else if (status === 404) {
      error.userMessage = 'İstenen kaynak bulunamadı.';
    } else if (status === 429) {
      error.userMessage = 'Çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.';
    } else if (status >= 500) {
      error.userMessage = errorMessage || 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.';
    } else {
      error.userMessage = errorMessage || error.message || 'Bir hata oluştu.';
    }
    
    // Only log non-4xx errors (client errors) or important 4xx errors
    if (status >= 500 || (status === 404 && error.config?.url?.includes('/available-times'))) {
      console.error(`API Error [${status}]: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
      if (errorMessage && errorMessage !== error.message) {
        console.error('Error message:', errorMessage);
      }
    }
    
    return Promise.reject(error);
  }
);

// API functions
export const barbersAPI = {
  getAll: () => api.get('/barbers'),
};

export const servicesAPI = {
  getAll: () => api.get('/services'),
};

export const bookingsAPI = {
  create: (bookingData) => api.post('/bookings', bookingData),
  getAvailableTimes: (barberId, date) => 
    api.get('/available-times', { params: { barberId, date } }),
  getAvailableTimesBatch: (barberId, dates) => 
    api.get('/available-times-batch', { params: { barberId, dates: dates.join(',') } }),
};

export const adminAPI = {
  login: (username, password) => api.post('/admin/login', { username, password }),
  getBookings: (filters = {}) => api.get('/admin/bookings', { params: filters }),
  getBooking: (id) => api.get(`/admin/bookings/${id}`),
  createBooking: (bookingData) => api.post('/admin/bookings', bookingData),
  updateBooking: (id, status) => api.patch(`/admin/bookings/${id}`, { status }),
  deleteBooking: (id) => api.delete(`/admin/bookings/${id}`),
  sendReminder: (id) => api.post(`/admin/bookings/${id}/reminder`),
  getStats: () => api.get('/admin/stats'),
  // Closed Dates API
  getClosedDates: () => api.get('/admin/closed-dates'),
  createClosedDate: (data) => api.post('/admin/closed-dates', data),
  deleteClosedDate: (id) => api.delete(`/admin/closed-dates/${id}`),
  // Available times for admin
  getAvailableTimes: (barberId, date) => api.get('/available-times', { params: { barberId, date } }),
  // Daily Report API
  sendDailyReport: (date) => api.post('/admin/daily-report', { date }),
  // Update Services API
  updateServices: () => api.post('/admin/update-services'),
};

export default api;

