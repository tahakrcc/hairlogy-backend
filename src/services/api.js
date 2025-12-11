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
    // Only log errors that are not network errors or expected errors
    // Skip logging for cancelled requests or network errors
    if (error.code === 'ERR_CANCELED' || error.code === 'ERR_NETWORK') {
      return Promise.reject(error);
    }
    
    // Log errors with more context, but less verbosely
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      
      // Only log non-4xx errors (client errors) or important 4xx errors
      if (status >= 500 || (status === 404 && error.config?.url?.includes('/available-times'))) {
        // Log in a cleaner format
        console.error(`API Error [${status}]: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
        if (errorMessage && errorMessage !== error.message) {
          console.error('Error message:', errorMessage);
        }
      }
    } else {
      // Request failed but no response (network error, timeout, etc.)
      console.error('API Network Error:', error.message);
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
};

export const adminAPI = {
  login: (username, password) => api.post('/admin/login', { username, password }),
  getBookings: (filters = {}) => api.get('/admin/bookings', { params: filters }),
  getBooking: (id) => api.get(`/admin/bookings/${id}`),
  updateBooking: (id, status) => api.patch(`/admin/bookings/${id}`, { status }),
  deleteBooking: (id) => api.delete(`/admin/bookings/${id}`),
  sendReminder: (id) => api.post(`/admin/bookings/${id}/reminder`),
  getStats: () => api.get('/admin/stats'),
  // Closed Dates API
  getClosedDates: () => api.get('/admin/closed-dates'),
  createClosedDate: (data) => api.post('/admin/closed-dates', data),
  deleteClosedDate: (id) => api.delete(`/admin/closed-dates/${id}`),
};

export default api;

