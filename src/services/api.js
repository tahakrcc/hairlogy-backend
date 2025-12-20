import axios from 'axios';

// API Base URL Configuration
// Production için: Netlify'da Environment Variable olarak VITE_API_URL ayarlayın
// Veya geçici olarak aşağıdaki satırda backend URL'inizi yazın
const getApiBaseUrl = () => {
  // 1. Öncelik: Environment variable (Netlify'da ayarlanmalı)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2. Production modunda ve environment variable yoksa
  if (import.meta.env.PROD) {
    // Frontend Netlify'da, Backend Render'da olduğu için Full URL veriyoruz
    return 'https://hairlogy-backend.onrender.com/api';
  }

  // 3. Development için localhost proxy
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
  getAvailableTimesBatch: (barberId, dates) =>
    api.get('/available-times-batch', { params: { barberId, dates: dates.join(',') } }),
};

export const adminAPI = {
  login: (username, password) => api.post('/admin/login', { username, password }),
  getBookings: (filters = {}) => api.get('/admin/bookings', { params: filters }),
  getBooking: (id) => api.get(`/admin/bookings/${id}`),
  updateBooking: (id, status) => api.patch(`/admin/bookings/${id}`, { status }),
  deleteBooking: (id) => api.delete(`/admin/bookings/${id}`),
  getAvailableTimes: (barberId, date) => api.get('/available-times', { params: { barberId, date } }),
  createBooking: (bookingData) => api.post('/bookings', bookingData),
  getStats: () => api.get('/admin/stats'),
  sendReminder: (id) => api.post(`/admin/bookings/${id}/reminder`),
  sendDailyReport: (date) => api.post('/admin/daily-report', { date }),
  // Closed Dates API
  getClosedDates: () => api.get('/admin/closed-dates'),
  createClosedDate: (data) => api.post('/admin/closed-dates', data),
  deleteClosedDate: (id) => api.delete(`/admin/closed-dates/${id}`),
  // Maintenance Settings
  toggleMaintenanceMode: (value) => api.post('/admin/settings/maintenance', { value }),
};

export const settingsAPI = {
  getMaintenanceMode: () => api.get('/settings/maintenance'),
};

export default api;

