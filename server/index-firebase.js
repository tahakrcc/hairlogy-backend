import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { db } from './firebase-config.js';
import { FieldValue } from 'firebase-admin/firestore';
import { sendAdminNotificationEmail, sendBookingReminderEmail, sendCustomerConfirmationEmail, sendDailyReportEmail } from './emailService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const loginAttempts = {}; // { username: { count, lockUntil } }

// In-memory cache for frequently accessed data (reduces Firestore reads)
const cache = {
  barbers: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }, // 10 minutes (increased from 5)
  services: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }, // 10 minutes (increased from 5)
  closedDates: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 } // 5 minutes (increased from 1)
};

// Cache helper functions
function getCachedData(key) {
  const cached = cache[key];
  if (cached && cached.data && (Date.now() - cached.timestamp) < cached.ttl) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  cache[key] = {
    data,
    timestamp: Date.now(),
    ttl: cache[key]?.ttl || 5 * 60 * 1000
  };
}

function clearCache(key = null) {
  if (key) {
    cache[key] = { data: null, timestamp: 0, ttl: cache[key]?.ttl || 5 * 60 * 1000 };
  } else {
    Object.keys(cache).forEach(k => {
      cache[k] = { data: null, timestamp: 0, ttl: cache[k]?.ttl || 5 * 60 * 1000 };
    });
  }
}

// CORS configuration - allow production and dev frontends
app.use(cors({
  origin: [
    'https://hairologyyasinpremiumrandevu.com',
    'https://hairlogyyasinpremium.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173',
    /\.netlify\.app$/
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Hairlogy Yasin Premium Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      barbers: '/api/barbers',
      services: '/api/services',
      availableTimes: '/api/available-times',
      bookings: '/api/bookings',
      admin: '/api/admin'
    },
    timestamp: new Date().toISOString()
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Hairlogy Yasin Premium Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      barbers: '/api/barbers',
      services: '/api/services',
      availableTimes: '/api/available-times',
      bookings: '/api/bookings',
      admin: '/api/admin'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Email configuration diagnostic endpoint
app.get('/api/email-config', (req, res) => {
  const hasApiKey = !!process.env.MAILJET_API_KEY;
  const hasApiSecret = !!process.env.MAILJET_API_SECRET;
  const hasAdminEmail = !!process.env.ADMIN_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL || '❌ Ayarlanmamış';
  const fromEmail = process.env.FROM_EMAIL || 'noreply@hairologyyasinpremiumrandevu.com' || process.env.ADMIN_EMAIL;
  
  const config = {
    mailjet: {
      apiKey: hasApiKey ? '✅ Ayarlanmış' : '❌ Eksik',
      apiSecret: hasApiSecret ? '✅ Ayarlanmış' : '❌ Eksik',
      configured: hasApiKey && hasApiSecret
    },
    emails: {
      adminEmail: adminEmail,
      fromEmail: fromEmail || '❌ Ayarlanmamış',
      fromName: process.env.FROM_NAME || 'Hairlogy Yasin Premium'
    },
    status: hasApiKey && hasApiSecret && hasAdminEmail && fromEmail ? '✅ Yapılandırılmış' : '⚠️ Eksik ayarlar var',
    // Debug info (sadece ilk 3 karakteri göster, güvenlik için)
    debug: {
      adminEmailPreview: adminEmail !== '❌ Ayarlanmamış' ? adminEmail.substring(0, 3) + '***' : '❌',
      fromEmailPreview: fromEmail ? fromEmail.substring(0, 3) + '***' : '❌'
    }
  };
  
  res.json(config);
});

// Auto-confirm pending bookings (for old bookings that were created before auto-confirm)
async function autoConfirmPendingBookings() {
  try {
    // Only check if there are any pending bookings (limit 1 to save quota)
    // If quota is exceeded, skip this operation
    const pendingCheck = await db.collection('bookings')
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (pendingCheck.empty) {
      return;
    }

    // Only process a limited number to avoid quota issues
    // Process in batches of 50 max
    const pendingBookings = await db.collection('bookings')
      .where('status', '==', 'pending')
      .limit(50)
      .get();

    if (pendingBookings.empty) {
      return;
    }

    const batch = db.batch();
    let count = 0;

    pendingBookings.forEach(doc => {
      batch.update(doc.ref, {
        status: 'confirmed',
        updated_at: FieldValue.serverTimestamp()
      });
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Auto-confirmed ${count} pending bookings`);
    }
  } catch (error) {
    // If quota exceeded, just log and continue (don't crash server)
    if (error.message && error.message.includes('Quota exceeded')) {
      console.warn('Skipping auto-confirm due to quota limit');
      return;
    }
    console.error('Error auto-confirming pending bookings:', error);
  }
}

// Initialize default data
async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Auto-confirm any old pending bookings (with quota protection)
    try {
      await autoConfirmPendingBookings();
    } catch (error) {
      if (error.message && error.message.includes('Quota exceeded')) {
        console.warn('Skipping auto-confirm due to quota limit');
      } else {
        throw error; // Re-throw if it's not a quota error
      }
    }
    
    // Check if barbers exist
    const barbersSnapshot = await db.collection('barbers').limit(1).get();
    if (barbersSnapshot.empty) {
      const defaultBarbers = [
        {
          id: 1, // Add numeric id field
          name: 'Hıdır Yasin Gökçeoğlu',
          experience: '15+ Yıl Deneyim',
          specialty: 'Klasik & Modern Kesimler',
          image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
          active: true,
          created_at: FieldValue.serverTimestamp()
        },
        {
          id: 2, // Add numeric id field
          name: 'Emir Gökçeoğlu',
          experience: '10+ Yıl Deneyim',
          specialty: 'Fade & Sakal Tasarımı',
          image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
          active: true,
          created_at: FieldValue.serverTimestamp()
        }
      ];

      for (const barber of defaultBarbers) {
        await db.collection('barbers').add(barber);
      }
      clearCache('barbers'); // Clear cache when barbers are added
      console.log('Default barbers created');
    } else {
      // Update existing barbers to have id field if missing
      const allBarbers = await db.collection('barbers').get();
      const updatePromises = [];
      let idCounter = 1;
      
      allBarbers.forEach(doc => {
        const data = doc.data();
        if (!data.id) {
          updatePromises.push(
            db.collection('barbers').doc(doc.id).update({
              id: idCounter++
            })
          );
        }
      });
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        clearCache('barbers');
        console.log(`Updated ${updatePromises.length} barbers with id field`);
      }
    }

    // Check if admin users exist, if not create them
    // Optimize: Query specific users instead of getting all
    let yasinDoc = null;
    let emirDoc = null;
    const adminDocs = [];
    
    try {
      // Try to get specific users first (more efficient)
      const yasinQuery = await db.collection('admin_users')
        .where('username', '==', 'yasin')
        .limit(1)
        .get();
      if (!yasinQuery.empty) {
        yasinDoc = yasinQuery.docs[0];
      }

      const emirQuery = await db.collection('admin_users')
        .where('username', '==', 'emir')
        .limit(1)
        .get();
      if (!emirQuery.empty) {
        emirDoc = emirQuery.docs[0];
      }

      // Check for legacy admin user (only if needed)
      const adminQuery = await db.collection('admin_users')
        .where('username', '==', 'admin')
        .get();
      adminQuery.forEach(doc => {
        adminDocs.push(doc);
      });
    } catch (error) {
      // If quota exceeded or query fails, fall back to getting all (should rarely happen)
      if (error.message && error.message.includes('Quota exceeded')) {
        console.warn('Skipping admin user check due to quota limit');
        return; // Skip admin user initialization if quota exceeded
      }
      // Fallback: get all (only if query fails for other reasons)
      const adminUsersSnapshot = await db.collection('admin_users').get();
      adminUsersSnapshot.forEach(doc => {
        const user = doc.data();
        if (user.username?.toLowerCase() === 'yasin') yasinDoc = doc;
        if (user.username?.toLowerCase() === 'emir') emirDoc = doc;
        if (user.username?.toLowerCase() === 'admin') adminDocs.push(doc);
      });
    }
    
    // Upsert yasin/emir with stronger passwords, remove legacy "admin"
    const yasinHash = bcrypt.hashSync('Yasin@2025!', 10);
    const emirHash = bcrypt.hashSync('Emir@2025!', 10);
    const ops = [];
    
    if (yasinDoc) {
      ops.push(yasinDoc.ref.update({ password: yasinHash, barber_id: 1 }));
      console.log('Admin user updated: yasin (password reset)');
    } else {
      ops.push(db.collection('admin_users').add({
        username: 'yasin',
        password: yasinHash,
        barber_id: 1,
        created_at: FieldValue.serverTimestamp()
      }));
      console.log('Admin user created: yasin/Yasin@2025! (barber_id: 1)');
    }
    
    if (emirDoc) {
      ops.push(emirDoc.ref.update({ password: emirHash, barber_id: 2 }));
      console.log('Admin user updated: emir (password reset)');
    } else {
      ops.push(db.collection('admin_users').add({
        username: 'emir',
        password: emirHash,
        barber_id: 2,
        created_at: FieldValue.serverTimestamp()
      }));
      console.log('Admin user created: emir/Emir@2025! (barber_id: 2)');
    }
    
    if (adminDocs.length > 0) {
      adminDocs.forEach(doc => ops.push(doc.ref.delete()));
      console.log(`Removed legacy admin user count: ${adminDocs.length}`);
    }
    
    await Promise.all(ops);

    // Check if services exist
    const servicesSnapshot = await db.collection('services').limit(1).get();
    if (servicesSnapshot.empty) {
      const defaultServices = [
        { name: 'Saç & Sakal + Yıkama + Fön', duration: 60, price: 600, active: true },
        { name: 'Saç Kesimi + Yıkama + Fön', duration: 45, price: 500, active: true },
        { name: 'VIP Hizmet (Cilt bakımı, keratinli saç bakımı maskesi, profesyonel masaj)', duration: 120, price: 2500, active: true },
        { name: 'Profesyonel Buharlı Cilt Bakımı', duration: 60, price: 500, active: true },
        { name: 'Buharlı Keratinli Saç Bakımı Maskesi', duration: 60, price: 500, active: true },
        { name: 'VIP House Tıraş', duration: 90, price: 5000, active: true }
      ];

      for (const service of defaultServices) {
        await db.collection('services').add({
          ...service,
          created_at: FieldValue.serverTimestamp()
        });
      }
      clearCache('services'); // Clear cache when services are added
      console.log('Default services created');
    }

    // Check if admin exists
    // No default "admin" user is created anymore
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Database will be initialized when server starts

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    // Set both userId and user object for compatibility
    req.userId = decoded.userId;
    req.user = {
      userId: decoded.userId,
      username: decoded.username || null,
      barber_id: decoded.barber_id || null
    };
    next();
  });
};

// ============ PUBLIC ROUTES ============

// Get all barbers (with cache to reduce Firestore reads)
app.get('/api/barbers', async (req, res) => {
  try {
    let barbers = getCachedData('barbers');
    if (!barbers) {
      const snapshot = await db.collection('barbers')
        .where('active', '==', true)
        .get();
      
      barbers = [];
      let indexCounter = 1;
      snapshot.forEach(doc => {
        const data = doc.data();
        // Use data.id if exists, otherwise assign sequential number
        let numericId = data.id;
        if (!numericId || typeof numericId !== 'number') {
          // If id doesn't exist or is not a number, assign sequential number
          numericId = indexCounter++;
        }
        
        // Store both Firestore doc ID and numeric ID
        barbers.push({
          id: doc.id, // Firestore document ID (for frontend selection)
          numeric_id: numericId, // Numeric ID (for barber_id in bookings)
          ...data,
          id: numericId // Override id field with numeric value for compatibility
        });
      });
      setCachedData('barbers', barbers);
    }
    
    res.json(barbers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all services (with cache to reduce Firestore reads)
app.get('/api/services', async (req, res) => {
  try {
    let services = getCachedData('services');
    if (!services) {
      const snapshot = await db.collection('services')
        .where('active', '==', true)
        .get();
      
      services = [];
      snapshot.forEach(doc => {
        services.push({
          id: doc.id,
          ...doc.data()
        });
      });
      setCachedData('services', services);
    }
    
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available time slots for a date and barber
app.get('/api/available-times', async (req, res) => {
  try {
    const { barberId, date } = req.query;
    
    if (!barberId || !date) {
      return res.status(400).json({ error: 'barberId and date are required' });
    }

    // Check if date is in a closed date range (use cache to reduce Firestore reads)
    let closedDates = getCachedData('closedDates');
    if (!closedDates) {
      const closedDatesSnapshot = await db.collection('closed_dates').get();
      closedDates = [];
      closedDatesSnapshot.forEach(doc => {
        closedDates.push(doc.data());
      });
      setCachedData('closedDates', closedDates);
    }
    
    const selectedDate = new Date(date);
    let isClosed = false;
    let closedReason = '';

    closedDates.forEach(closedData => {
      const startDate = new Date(closedData.start_date);
      const endDate = new Date(closedData.end_date);
      
      // Set time to midnight for comparison
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      selectedDate.setHours(0, 0, 0, 0);
      
      if (selectedDate >= startDate && selectedDate <= endDate) {
        isClosed = true;
        closedReason = closedData.reason || 'Tatil günü';
      }
    });

    if (isClosed) {
      return res.json({ 
        availableTimes: [], 
        bookedTimes: [],
        isClosed: true,
        reason: closedReason
      });
    }

    // Convert barberId to number for comparison (Firestore stores it as number)
    const barberIdNum = parseInt(barberId, 10);
    const barberIdStr = String(barberId);

    // Optimize: Query by date first to reduce Firestore reads (quota optimization)
    // This significantly reduces the number of documents read from Firestore
    let bookingsSnapshot;
    try {
      // Query by appointment_date first (most selective filter, no index needed)
      // Filter status and barber_id in memory to avoid index requirements
      // Limit to 50 bookings per date to prevent excessive reads
      bookingsSnapshot = await db.collection('bookings')
        .where('appointment_date', '==', date)
        .limit(50) // Max 50 bookings per date to save quota
        .get();
    } catch (error) {
      // If query fails, fall back to getting all (should rarely happen)
      console.error('Date query failed:', error.message);
      return res.status(500).json({ 
        error: 'Veritabanı sorgusu başarısız oldu. Lütfen daha sonra tekrar deneyin.',
        details: error.message 
      });
    }
    
    // Filter in memory for barber_id and status (date already filtered by query)
    const bookedTimes = [];
    
    console.log('[Available Times] Checking bookings for barber:', {
      barberId: barberId,
      barberIdNum: barberIdNum,
      barberIdStr: barberIdStr,
      date: date,
      totalBookings: bookingsSnapshot.size
    });
    
    bookingsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Skip cancelled bookings
      if (data.status === 'cancelled') {
        return;
      }
      
      // Check barber_id (try both number and string)
      const dataBarberId = data.barber_id;
      const matchesBarber = dataBarberId === barberIdNum || 
                           dataBarberId === barberIdStr || 
                           String(dataBarberId) === String(barberIdNum) ||
                           String(dataBarberId) === barberIdStr ||
                           Number(dataBarberId) === barberIdNum;
      
      if (matchesBarber && data.appointment_time) {
        // Ensure time is a string and trim it
        const time = String(data.appointment_time).trim();
        if (time && !bookedTimes.includes(time)) {
          bookedTimes.push(time);
          console.log('[Available Times] Found booked time:', {
            time: time,
            barber_id: dataBarberId,
            barber_id_type: typeof dataBarberId,
            created_by_admin: data.created_by_admin || false,
            customer_name: data.customer_name
          });
        }
      } else if (data.appointment_time) {
        // Debug: Log why booking was not matched
        console.log('[Available Times] Booking not matched:', {
          dataBarberId: dataBarberId,
          dataBarberIdType: typeof dataBarberId,
          barberIdNum: barberIdNum,
          barberIdStr: barberIdStr,
          matchesBarber: matchesBarber,
          appointment_time: data.appointment_time,
          created_by_admin: data.created_by_admin || false
        });
      }
    });
    
    // All possible time slots (10:00 - 20:00, hourly)
    // Note: 16:00 is break time (yemek molası), 17:00 is active
    const allTimeSlots = [
      '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
    ];
    
    // Break time slot (yemek molası - not available for booking, only 16:00)
    const breakTimeSlots = ['16:00'];

    // Normalize booked times for comparison (trim and ensure string)
    const normalizedBookedTimes = bookedTimes.map(t => String(t).trim());
    
    // Filter available times (not in bookedTimes and not break time)
    const availableTimes = allTimeSlots.filter(time => {
      const normalizedTime = String(time).trim();
      // Exclude break time slots and booked times
      return !breakTimeSlots.includes(normalizedTime) && !normalizedBookedTimes.includes(normalizedTime);
    });
    
    // Debug log for admin panel
    if (req.query.debug || req.headers['x-debug']) {
      console.log(`[Available Times] Barber: ${barberId}, Date: ${date}`);
      console.log(`[Available Times] Booked times:`, bookedTimes);
      console.log(`[Available Times] Available times:`, availableTimes);
    }
    
    res.json({ availableTimes, bookedTimes });
  } catch (error) {
    console.error('Error fetching available times:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch available times endpoint (optimized for multiple dates)
app.get('/api/available-times-batch', async (req, res) => {
  try {
    const { barberId, dates } = req.query; // dates: "2024-01-01,2024-01-02,..."
    
    if (!barberId || !dates) {
      return res.status(400).json({ error: 'barberId and dates are required' });
    }

    const dateArray = dates.split(',');
    if (dateArray.length === 0 || dateArray.length > 14) {
      return res.status(400).json({ error: 'Dates array must have 1-14 dates' });
    }

    // Check closed dates (use cache)
    let closedDates = getCachedData('closedDates');
    if (!closedDates) {
      const closedDatesSnapshot = await db.collection('closed_dates').get();
      closedDates = [];
      closedDatesSnapshot.forEach(doc => {
        closedDates.push(doc.data());
      });
      setCachedData('closedDates', closedDates);
    }

    const barberIdNum = parseInt(barberId, 10);
    const barberIdStr = String(barberId);
    
    // Get all bookings for date range in single query
    const startDate = dateArray[0];
    const endDate = dateArray[dateArray.length - 1];
    
    let bookingsSnapshot;
    try {
      bookingsSnapshot = await db.collection('bookings')
        .where('appointment_date', '>=', startDate)
        .where('appointment_date', '<=', endDate)
        .limit(200) // Max 200 bookings for all dates
        .get();
    } catch (error) {
      console.error('Batch date query failed:', error.message);
      return res.status(500).json({ 
        error: 'Veritabanı sorgusu başarısız oldu.',
        details: error.message 
      });
    }
    
    // Process results for each date
    const result = {};
    const allTimeSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
    const breakTimeSlots = ['16:00'];
    
    dateArray.forEach(date => {
      // Check if date is closed
      const selectedDate = new Date(date);
      let isClosed = false;
      let closedReason = '';
      
      closedDates.forEach(closedData => {
        const startDate = new Date(closedData.start_date);
        const endDate = new Date(closedData.end_date);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        selectedDate.setHours(0, 0, 0, 0);
        
        if (selectedDate >= startDate && selectedDate <= endDate) {
          isClosed = true;
          closedReason = closedData.reason || 'Tatil günü';
        }
      });
      
      if (isClosed) {
        result[date] = {
          availableTimes: [],
          bookedTimes: [],
          isClosed: true,
          reason: closedReason
        };
        return;
      }
      
      // Filter bookings for this date and barber
      const bookedTimes = [];
      bookingsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'cancelled') return;
        
        const dataBarberId = data.barber_id;
        const matchesBarber = dataBarberId === barberIdNum || 
                             dataBarberId === barberIdStr || 
                             String(dataBarberId) === String(barberIdNum) ||
                             String(dataBarberId) === barberIdStr ||
                             Number(dataBarberId) === barberIdNum;
        
        if (matchesBarber && data.appointment_date === date && data.appointment_time) {
          const time = String(data.appointment_time).trim();
          if (time && !bookedTimes.includes(time)) {
            bookedTimes.push(time);
          }
        }
      });
      
      const normalizedBookedTimes = bookedTimes.map(t => String(t).trim());
      const availableTimes = allTimeSlots.filter(time => {
        const normalizedTime = String(time).trim();
        return !breakTimeSlots.includes(normalizedTime) && !normalizedBookedTimes.includes(normalizedTime);
      });
      
      result[date] = {
        availableTimes,
        bookedTimes
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching batch available times:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create booking
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      barberId,
      barberName,
      serviceName,
      servicePrice,
      customerName,
      customerPhone,
      customerEmail,
      appointmentDate,
      appointmentTime,
      deviceToken
    } = req.body;

    if (!barberId || !serviceName || !customerName || !customerPhone || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if time is during break time (only 16:00 - yemek molası, 17:00 is active)
    const normalizedAppointmentTime = String(appointmentTime).trim();
    const breakTimeSlots = ['16:00'];
    if (breakTimeSlots.includes(normalizedAppointmentTime)) {
      return res.status(400).json({ error: 'Bu saat yemek molası, randevu alınamaz.' });
    }

    // Check device token and booking limit (2 bookings per device, resets every 3 hours)
    if (deviceToken) {
      const deviceTokenDoc = await db.collection('device_tokens').doc(deviceToken).get();
      const now = new Date();
      
      if (deviceTokenDoc.exists) {
        const tokenData = deviceTokenDoc.data();
        const tokenCreatedAt = tokenData.created_at?.toDate ? tokenData.created_at.toDate() : new Date(tokenData.created_at);
        const hoursSinceCreation = (now - tokenCreatedAt) / (1000 * 60 * 60);
        
        // If 3 hours passed, reset the token
        if (hoursSinceCreation >= 3) {
          await db.collection('device_tokens').doc(deviceToken).set({
            booking_count: 0,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp()
          });
        } else {
          // Check if device has reached booking limit (2 bookings)
          if (tokenData.booking_count >= 2) {
            const hoursRemaining = (3 - hoursSinceCreation).toFixed(1);
            return res.status(429).json({ 
              error: 'Bu cihazdan maksimum 2 randevu alabilirsiniz. 3 saat sonra tekrar deneyebilirsiniz.',
              hoursRemaining: parseFloat(hoursRemaining),
              message: `Lütfen ${hoursRemaining} saat sonra tekrar deneyin.`
            });
          }
        }
      } else {
        // Create new token document
        await db.collection('device_tokens').doc(deviceToken).set({
          booking_count: 0,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp()
        });
      }
    }

    // Check if time slot is available - STRICT CHECK
    // Use single-field query (barber_id only) to avoid index requirements
    // Filter everything else in memory
    let isSlotBooked = false;
    try {
      // Convert barberId to number for comparison
      const barberIdNum = parseInt(barberId, 10);
      const barberIdStr = String(barberId);
      
      // Try number first
      let existingSnapshot = await db.collection('bookings')
        .where('barber_id', '==', barberIdNum)
      .get();

      // If no results, try string
      if (existingSnapshot.empty) {
        existingSnapshot = await db.collection('bookings')
          .where('barber_id', '==', barberIdStr)
          .get();
      }

      // Filter in memory for appointment_date, appointment_time and status
      existingSnapshot.forEach(doc => {
        const data = doc.data();
        const dataBarberId = data.barber_id;
        const matchesBarber = dataBarberId === barberIdNum || 
                             dataBarberId === barberIdStr || 
                             String(dataBarberId) === barberIdStr ||
                             Number(dataBarberId) === barberIdNum;
        
        if (matchesBarber &&
            data.appointment_date === appointmentDate && 
            data.appointment_time === appointmentTime && 
            data.status !== 'cancelled') {
          isSlotBooked = true;
        }
      });
    } catch (error) {
      // If query fails, block booking to prevent duplicates
      console.error('Error checking slot availability:', error.message);
      return res.status(500).json({ error: 'Randevu kontrolü yapılamadı. Lütfen tekrar deneyin.' });
    }

    if (isSlotBooked) {
      return res.status(400).json({ error: 'Bu saat dilimi zaten dolu. Lütfen başka bir saat seçin.' });
    }

    // Create booking - automatically confirmed
    // Ensure barber_id is stored as number for consistency
    const barberIdNum = parseInt(barberId, 10);
    const bookingRef = await db.collection('bookings').add({
      barber_id: barberIdNum,
      barber_name: barberName,
      service_name: serviceName,
      service_price: servicePrice,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      device_token: deviceToken || null,
      status: 'confirmed', // Automatically confirmed, no admin approval needed
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });

    const bookingId = bookingRef.id;
    
    // Update device token booking count
    if (deviceToken) {
      const deviceTokenDoc = await db.collection('device_tokens').doc(deviceToken).get();
      if (deviceTokenDoc.exists) {
        const tokenData = deviceTokenDoc.data();
        const tokenCreatedAt = tokenData.created_at?.toDate ? tokenData.created_at.toDate() : new Date(tokenData.created_at);
        const hoursSinceCreation = (new Date() - tokenCreatedAt) / (1000 * 60 * 60);
        
        // If 3 hours passed, reset count to 1, otherwise increment
        const newCount = hoursSinceCreation >= 3 ? 1 : (tokenData.booking_count || 0) + 1;
        
        await db.collection('device_tokens').doc(deviceToken).update({
          booking_count: newCount,
          updated_at: FieldValue.serverTimestamp(),
          ...(hoursSinceCreation >= 3 && { created_at: FieldValue.serverTimestamp() })
        });
      }
    }
    
    // Schedule reminder notifications (24 hours before appointment)
    // In production, use a job scheduler like node-cron or a cloud function
    // For now, we'll just store the reminder flag
    await bookingRef.update({
      reminder_sent: false,
      reminder_scheduled: true
    });

    // Müşteriye ve admin'e mail gönder (asenkron, hata olsa bile randevu oluşturulur)
    if (customerEmail) {
      sendCustomerConfirmationEmail({
        customerName,
        customerEmail,
        customerPhone,
        barberName,
        serviceName,
        servicePrice,
        appointmentDate,
        appointmentTime
      }).then(result => {
        if (result && result.body && result.body.Messages && result.body.Messages[0]) {
          const messageStatus = result.body.Messages[0];
          if (messageStatus.Status === 'success') {
            console.log('✅ Müşteri emaili Mailjet\'e başarıyla gönderildi:', customerEmail);
            console.log('   MessageID:', messageStatus.To[0]?.MessageID || 'N/A');
          } else {
            console.warn('⚠️ Müşteri emaili gönderilemedi. Durum:', messageStatus.Status);
            if (messageStatus.Errors) {
              console.error('   Hatalar:', JSON.stringify(messageStatus.Errors, null, 2));
            }
          }
        }
      }).catch(error => {
        console.error('❌ Müşteri maili gönderilirken hata:', error.message);
        if (error.response) {
          console.error('   Mailjet Response:', JSON.stringify(error.response.body, null, 2));
        }
      });
    }

    // Admin'e bildirim gönder (asenkron, hata olsa bile randevu oluşturulur)
    sendAdminNotificationEmail({
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      barberName,
      serviceName,
      servicePrice,
      appointmentDate,
      appointmentTime
    }).then(result => {
      if (result && result.body && result.body.Messages && result.body.Messages[0]) {
        const messageStatus = result.body.Messages[0];
        if (messageStatus.Status === 'success') {
          console.log('✅ Admin bildirim maili Mailjet\'e başarıyla gönderildi:', process.env.ADMIN_EMAIL);
          console.log('   MessageID:', messageStatus.To[0]?.MessageID || 'N/A');
        } else {
          console.warn('⚠️ Admin bildirim maili gönderilemedi. Durum:', messageStatus.Status);
          if (messageStatus.Errors) {
            console.error('   Hatalar:', JSON.stringify(messageStatus.Errors, null, 2));
          }
        }
      } else {
        console.warn('⚠️ Admin bildirim maili gönderilemedi. Mailjet yapılandırmasını kontrol edin.');
      }
    }).catch(error => {
      console.error('❌ Admin maili gönderilirken hata:', error.message);
      if (error.response) {
        console.error('   Mailjet Response:', JSON.stringify(error.response.body, null, 2));
      }
    });

    res.status(201).json({
      id: bookingId,
      message: 'Booking created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create booking (admin-only, bypasses device token limit)
app.post('/api/admin/bookings', verifyToken, async (req, res) => {
  try {
    let {
      barberId,
      barberName,
      serviceName,
      servicePrice,
      customerName,
      customerPhone,
      customerEmail,
      appointmentDate,
      appointmentTime
    } = req.body;

    // Detailed validation with logging
    const missingFields = [];
    if (!barberId || (typeof barberId === 'string' && barberId.trim() === '')) {
      missingFields.push('barberId');
    }
    if (!serviceName || (typeof serviceName === 'string' && serviceName.trim() === '')) {
      missingFields.push('serviceName');
    }
    if (!customerName || (typeof customerName === 'string' && customerName.trim() === '')) {
      missingFields.push('customerName');
    }
    if (!customerPhone || (typeof customerPhone === 'string' && customerPhone.trim() === '')) {
      missingFields.push('customerPhone');
    }
    if (!appointmentDate || (typeof appointmentDate === 'string' && appointmentDate.trim() === '')) {
      missingFields.push('appointmentDate');
    }
    if (!appointmentTime || (typeof appointmentTime === 'string' && appointmentTime.trim() === '')) {
      missingFields.push('appointmentTime');
    }

    if (missingFields.length > 0) {
      console.error('[Admin Create Booking] Missing fields:', missingFields);
      console.error('[Admin Create Booking] Received data:', {
        barberId: barberId ? String(barberId) : 'MISSING',
        serviceName: serviceName || 'MISSING',
        customerName: customerName || 'MISSING',
        customerPhone: customerPhone || 'MISSING',
        appointmentDate: appointmentDate || 'MISSING',
        appointmentTime: appointmentTime || 'MISSING'
      });
      return res.status(400).json({ 
        error: 'Missing required fields',
        missingFields: missingFields
      });
    }

    // Eğer barberName gönderilmemişse, barberId'den çek
    if (!barberName && barberId) {
      try {
        const barberIdNum = parseInt(barberId, 10);
        const barberIdStr = String(barberId);
        
        // Try by ID first
        let barberDoc = await db.collection('barbers').doc(barberIdStr).get();
        if (!barberDoc.exists) {
          // Try finding by ID in collection
          const barberSnapshot = await db.collection('barbers')
            .where('id', '==', barberIdNum)
            .limit(1)
            .get();
          
          if (!barberSnapshot.empty) {
            barberDoc = barberSnapshot.docs[0];
          } else {
            // Try finding by ID as string
            const barberSnapshot2 = await db.collection('barbers')
              .where('id', '==', barberIdStr)
              .limit(1)
              .get();
            
            if (!barberSnapshot2.empty) {
              barberDoc = barberSnapshot2.docs[0];
            }
          }
        }
        
        if (barberDoc.exists) {
          barberName = barberDoc.data().name;
        } else {
          // Fallback: get all barbers and find by ID
          const allBarbers = await db.collection('barbers').get();
          allBarbers.forEach(doc => {
            const data = doc.data();
            const dataId = data.id || doc.id;
            if (dataId === barberIdNum || dataId === barberIdStr || String(dataId) === barberIdStr || Number(dataId) === barberIdNum) {
              barberName = data.name;
            }
          });
        }
      } catch (error) {
        console.error('Error fetching barber name:', error);
        // Continue without barberName, will use barberId
      }
    }

    // Check if time is during break time
    const normalizedAppointmentTime = String(appointmentTime).trim();
    const breakTimeSlots = ['16:00'];
    if (breakTimeSlots.includes(normalizedAppointmentTime)) {
      return res.status(400).json({ error: 'Bu saat yemek molası, randevu alınamaz.' });
    }

    // Check if time slot is available
    const barberIdNum = parseInt(barberId, 10);
    const barberIdStr = String(barberId);
    
    let isSlotBooked = false;
    try {
      // Query by date first to reduce reads
      let existingSnapshot = await db.collection('bookings')
        .where('appointment_date', '==', appointmentDate)
        .get();

      existingSnapshot.forEach(doc => {
        const data = doc.data();
        const dataBarberId = data.barber_id;
        const matchesBarber = dataBarberId === barberIdNum || 
                             dataBarberId === barberIdStr || 
                             String(dataBarberId) === barberIdStr ||
                             Number(dataBarberId) === barberIdNum;
        
        if (matchesBarber &&
            data.appointment_time === appointmentTime && 
            data.status !== 'cancelled') {
          isSlotBooked = true;
        }
      });
    } catch (error) {
      console.error('Error checking slot availability:', error.message);
      return res.status(500).json({ error: 'Randevu kontrolü yapılamadı. Lütfen tekrar deneyin.' });
    }

    if (isSlotBooked) {
      return res.status(400).json({ error: 'Bu saat dilimi zaten dolu. Lütfen başka bir saat seçin.' });
    }

    // Create booking - admin bypasses device token limit
    // IMPORTANT: Store barber_id as the same format used in normal bookings
    // First, try to get the barber's numeric id from database
    let finalBarberId = barberIdNum;
    
    // If barberId is not a number, it's likely a Firestore doc ID
    // Find the barber and get its numeric id field (if exists)
    if (isNaN(barberIdNum)) {
      try {
        // Try by document ID first
        const barberDoc = await db.collection('barbers').doc(barberIdStr).get();
        if (barberDoc.exists) {
          const barberData = barberDoc.data();
          // If barber has id field, use it
          if (barberData.id !== undefined) {
            if (typeof barberData.id === 'number') {
              finalBarberId = barberData.id;
            } else if (typeof barberData.id === 'string') {
              const parsed = parseInt(barberData.id, 10);
              finalBarberId = isNaN(parsed) ? barberIdNum : parsed;
            }
          } else {
            // Barber doesn't have id field - use document index as fallback
            // Get all barbers and find index
            const allBarbers = await db.collection('barbers').get();
            let index = 1;
            let found = false;
            allBarbers.forEach((doc, idx) => {
              if (doc.id === barberIdStr) {
                finalBarberId = index;
                found = true;
              }
              index++;
            });
            if (!found) {
              finalBarberId = 1; // Ultimate fallback
            }
          }
        } else {
          // Try to find by id field (if barberId was actually a number string)
          const parsedId = parseInt(barberIdStr, 10);
          if (!isNaN(parsedId)) {
            const barberQuery = await db.collection('barbers')
              .where('id', '==', parsedId)
              .limit(1)
              .get();
            if (!barberQuery.empty) {
              const barberData = barberQuery.docs[0].data();
              finalBarberId = barberData.id || parsedId;
            } else {
              finalBarberId = parsedId;
            }
          } else {
            console.error('[Admin Create Booking] Cannot find barber with ID:', barberIdStr);
            finalBarberId = 1; // Fallback
          }
        }
      } catch (error) {
        console.error('[Admin Create Booking] Error fetching barber id:', error);
        finalBarberId = 1; // Fallback
      }
    }
    
    // Ensure finalBarberId is a number
    if (typeof finalBarberId !== 'number' || isNaN(finalBarberId)) {
      const parsed = parseInt(String(finalBarberId), 10);
      finalBarberId = isNaN(parsed) ? 1 : parsed;
    }
    
    console.log('[Admin Create Booking] Final barber_id:', {
      original: barberId,
      barberIdNum: barberIdNum,
      barberIdStr: barberIdStr,
      final: finalBarberId,
      finalType: typeof finalBarberId
    });
    
    const bookingData = {
      barber_id: finalBarberId,
      barber_name: barberName,
      service_name: serviceName,
      service_price: servicePrice,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || null,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      device_token: null, // Admin bookings don't use device tokens
      status: 'confirmed',
      created_by_admin: req.user?.username || 'unknown', // Store admin username
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    };

    console.log('[Admin Create Booking] Creating booking with data:', {
      barber_id: bookingData.barber_id,
      barber_id_type: typeof bookingData.barber_id,
      barber_name: bookingData.barber_name,
      appointment_date: bookingData.appointment_date,
      appointment_time: bookingData.appointment_time,
      customer_name: bookingData.customer_name,
      original_barberId: barberId,
      barberIdNum: barberIdNum,
      barberIdStr: barberIdStr
    });

    const bookingRef = await db.collection('bookings').add(bookingData);

    const bookingId = bookingRef.id;
    console.log('[Admin Create Booking] Booking created with ID:', bookingId);
    
    // Verify booking was created by reading it back
    const createdBooking = await bookingRef.get();
    if (createdBooking.exists) {
      console.log('[Admin Create Booking] Booking verified in database:', {
        id: createdBooking.id,
        barber_id: createdBooking.data().barber_id,
        appointment_date: createdBooking.data().appointment_date,
        appointment_time: createdBooking.data().appointment_time
      });
    } else {
      console.error('[Admin Create Booking] ERROR: Booking was not created!');
    }

    // Send emails (async, don't block response)
    if (customerEmail) {
      sendCustomerConfirmationEmail({
        customerName,
        customerEmail,
        customerPhone,
        barberName,
        serviceName,
        servicePrice,
        appointmentDate,
        appointmentTime
      }).catch(error => {
        console.error('❌ Müşteri maili gönderilirken hata:', error.message);
      });
    }

    sendAdminNotificationEmail({
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      barberName,
      serviceName,
      servicePrice,
      appointmentDate,
      appointmentTime
    }).catch(error => {
      console.error('❌ Admin maili gönderilirken hata:', error.message);
    });

    res.status(201).json({
      id: bookingId,
      message: 'Randevu başarıyla oluşturuldu'
    });
  } catch (error) {
    console.error('Error creating admin booking:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send reminder notification (admin-only, manual trigger)
app.post('/api/admin/bookings/:id/reminder', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const bookingDoc = await db.collection('bookings').doc(id).get();
    
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingDoc.data();

    if (!booking.customer_email) {
      return res.status(400).json({ error: 'Bu randevuda müşteri email adresi bulunmuyor.' });
    }

    // Send reminder email via Mailjet
    await sendBookingReminderEmail({
      customerName: booking.customer_name,
      customerEmail: booking.customer_email,
      barberName: booking.barber_name,
      serviceName: booking.service_name,
      servicePrice: booking.service_price,
      appointmentDate: booking.appointment_date,
      appointmentTime: booking.appointment_time
    });

    await db.collection('bookings').doc(id).update({
      reminder_sent: true,
      reminder_sent_at: FieldValue.serverTimestamp()
    });

    res.json({ message: 'Hatırlatma maili gönderildi' });
  } catch (error) {
    console.error('Hatırlatma gönderilirken hata:', error);
    res.status(500).json({ error: 'Hatırlatma gönderilemedi' });
  }
});

// ============ ADMIN ROUTES ============

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const now = Date.now();
    const key = username.toLowerCase();
    const attempt = loginAttempts[key] || { count: 0, lockUntil: 0 };
    if (attempt.lockUntil && attempt.lockUntil > now) {
      return res.status(429).json({ error: 'Çok fazla deneme. Lütfen 3 dakika sonra tekrar deneyin.' });
    }

    // Case-insensitive username lookup
    // Try exact match first (most common case, saves quota)
    let userDoc = null;
    let snapshot;
    
    try {
      // First try exact username match (case-sensitive, but faster)
      snapshot = await db.collection('admin_users')
        .where('username', '==', username)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        userDoc = snapshot.docs[0];
      } else {
        // If exact match fails, try lowercase version
        // (assuming username might be stored in lowercase)
        snapshot = await db.collection('admin_users')
          .where('username', '==', username.toLowerCase())
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          userDoc = snapshot.docs[0];
        } else {
          // Last resort: get all and filter (only if username format is inconsistent)
          // This should rarely happen if usernames are stored consistently
          snapshot = await db.collection('admin_users').get();
          userDoc = snapshot.docs.find(doc => {
            const userData = doc.data();
            return userData.username && userData.username.toLowerCase() === username.toLowerCase();
          }) || null;
        }
      }
    } catch (error) {
      // If query fails, fall back to getting all (should rarely happen)
      console.error('Admin user query failed:', error.message);
      snapshot = await db.collection('admin_users').get();
      userDoc = snapshot.docs.find(doc => {
        const userData = doc.data();
        return userData.username && userData.username.toLowerCase() === username.toLowerCase();
      }) || null;
    }

    if (!userDoc) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userDoc.data();

    if (!bcrypt.compareSync(password, user.password)) {
      const newCount = attempt.count + 1;
      loginAttempts[key] = {
        count: newCount,
        lockUntil: newCount >= 5 ? now + 3 * 60 * 1000 : 0
      };
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Successful login: reset attempts
    loginAttempts[key] = { count: 0, lockUntil: 0 };

    const token = jwt.sign({ 
      userId: userDoc.id, 
      username: user.username,
      barber_id: user.barber_id || null
    }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ 
      token, 
      username: user.username,
      barber_id: user.barber_id || null
    });
  } catch (error) {
    console.error('[Admin Login] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      name: error.name
    });
    
    // Firebase hatalarını daha iyi handle et
    let errorMessage = 'Giriş işlemi sırasında bir hata oluştu';
    
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      errorMessage = 'Firebase izin hatası: Veritabanı erişim izinlerini kontrol edin';
    } else if (error.code === 'unavailable' || error.code === 'UNAVAILABLE') {
      errorMessage = 'Firebase servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Get all bookings (admin only)
app.get('/api/admin/bookings', verifyToken, async (req, res) => {
  try {
    const { status, barberId, date, showAll } = req.query;
    // Safely get barber_id from JWT token
    const userBarberId = req.user?.barber_id || null;
    
    console.log('[Admin Bookings] Request params:', {
      status,
      barberId,
      date,
      showAll,
      showAllType: typeof showAll,
      showAllValue: showAll,
      userBarberId
    });

    // Apply filters
    // Note: We'll apply filters in memory to avoid index issues
    // First, get all bookings that match the basic filters we can query
    let baseQuery = db.collection('bookings');

    if (status) {
      baseQuery = baseQuery.where('status', '==', status);
    }
    if (date) {
      baseQuery = baseQuery.where('appointment_date', '==', date);
    }
    
    // For barberId, we'll filter in memory since it might be stored as number or string
    // Don't add barberId to query, filter in memory instead

    // OPTIMIZED: Add limit to prevent fetching too many documents (reduces Firestore reads)
    // Default limit: 200 bookings (increased to see more)
    const limit = parseInt(req.query.limit) || 200;
    
    // Try to use orderBy, but if index is missing, fetch all and sort in memory
    let snapshot;
    try {
      snapshot = await baseQuery.orderBy('appointment_date', 'desc')
      .orderBy('appointment_time', 'desc')
      .limit(limit)
      .get();
    } catch (indexError) {
      // If index error, fetch without orderBy and sort in memory
      if (indexError.message && indexError.message.includes('index')) {
        console.warn('Firestore index missing, fetching without orderBy and sorting in memory');
        snapshot = await baseQuery.limit(limit).get();
      } else {
        throw indexError;
      }
    }

    console.log('[Admin Bookings] Total documents from Firestore:', snapshot.size);

    const bookings = [];
    const now = new Date();
    const updatePromises = [];
    let skippedCount = 0;
    let skippedReasons = {};
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Filter by barberId from query parameter (if provided)
      if (barberId) {
        const dataBarberId = data.barber_id;
        const filterBarberIdNum = parseInt(barberId, 10);
        const filterBarberIdStr = String(barberId);
        // More flexible matching - try all combinations
        const matchesFilterBarber = 
          dataBarberId === filterBarberIdNum || 
          dataBarberId === filterBarberIdStr || 
          String(dataBarberId) === filterBarberIdStr ||
          String(dataBarberId) === String(filterBarberIdNum) ||
          Number(dataBarberId) === filterBarberIdNum ||
          Number(dataBarberId) === Number(filterBarberIdStr);
        
        if (!matchesFilterBarber) {
          skippedCount++;
          skippedReasons['barberId_filter'] = (skippedReasons['barberId_filter'] || 0) + 1;
          continue; // Skip this booking
        }
      }
      
      // Filter by user's barber_id if showAll is not true
      // IMPORTANT: If showAll is true, show all bookings regardless of barber_id
      // Also, if barberId filter is provided, it takes precedence over userBarberId
      if (!barberId && userBarberId && showAll !== 'true' && showAll !== true) {
        const dataBarberId = data.barber_id;
        const userBarberIdNum = parseInt(userBarberId, 10);
        const userBarberIdStr = String(userBarberId);
        // More flexible matching
        const matchesBarber = 
          dataBarberId === userBarberIdNum || 
          dataBarberId === userBarberIdStr || 
          String(dataBarberId) === userBarberIdStr ||
          String(dataBarberId) === String(userBarberIdNum) ||
          Number(dataBarberId) === userBarberIdNum ||
          Number(dataBarberId) === Number(userBarberIdStr);
        
        if (!matchesBarber) {
          skippedCount++;
          skippedReasons['userBarberId_filter'] = (skippedReasons['userBarberId_filter'] || 0) + 1;
          continue; // Skip this booking
        }
      }
      
      // Debug: Log first few bookings
      if (bookings.length < 5) {
        console.log('[Admin Bookings] Including booking:', {
          id: doc.id,
          barber_id: data.barber_id,
          barber_id_type: typeof data.barber_id,
          appointment_date: data.appointment_date,
          customer_name: data.customer_name,
          created_by_admin: data.created_by_admin || false,
          showAll: showAll,
          showAllType: typeof showAll,
          userBarberId: userBarberId,
          filterBarberId: barberId
        });
      }
      
      // Auto-complete past appointments that are still confirmed
      if (data.status === 'confirmed' && data.appointment_date && data.appointment_time) {
        try {
          // Parse appointment date and time
          const [year, month, day] = data.appointment_date.split('-').map(Number);
          const [hours, minutes] = data.appointment_time.split(':').map(Number);
          
          const appointmentDateTime = new Date(year, month - 1, day, hours, minutes);
          
          // If appointment time has passed, mark as completed
          if (appointmentDateTime < now) {
            // Save revenue to revenue_history before updating status
            if (data.service_price && data.status !== 'completed' && data.status !== 'cancelled') {
              updatePromises.push(
                db.collection('revenue_history').add({
                  booking_id: doc.id,
                  barber_id: data.barber_id,
                  service_price: data.service_price,
                  appointment_date: data.appointment_date,
                  appointment_time: data.appointment_time,
                  customer_name: data.customer_name,
                  service_name: data.service_name,
                  created_at: FieldValue.serverTimestamp()
                })
              );
            }
            
            // Update in Firestore
            updatePromises.push(
              db.collection('bookings').doc(doc.id).update({
                status: 'completed',
                updated_at: FieldValue.serverTimestamp()
              })
            );
            
            // Update data for response
            data.status = 'completed';
          }
        } catch (error) {
          console.error(`Error checking appointment time for booking ${doc.id}:`, error);
        }
      }
      
      bookings.push({
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
        updated_at: data.updated_at?.toDate?.()?.toISOString() || data.updated_at
      });
    }
    
    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      await Promise.allSettled(updatePromises);
      console.log(`Auto-completed ${updatePromises.length} past appointment(s)`);
    }

    // Sort in memory if orderBy failed
    if (bookings.length > 0 && (!snapshot.query || !snapshot.query._delegate)) {
      bookings.sort((a, b) => {
        const dateCompare = b.appointment_date.localeCompare(a.appointment_date);
        if (dateCompare !== 0) return dateCompare;
        return b.appointment_time.localeCompare(a.appointment_time);
      });
    }

    // Debug log
    console.log('[Admin Bookings] Summary:', {
      totalFromFirestore: snapshot.size,
      totalReturned: bookings.length,
      skipped: skippedCount,
      skippedReasons: skippedReasons,
      showAll: showAll,
      showAllType: typeof showAll,
      showAllIsTrue: showAll === 'true' || showAll === true,
      userBarberId: userBarberId,
      filterBarberId: barberId,
      status: req.query.status,
      date: req.query.date
    });
    
    console.log('[Admin Bookings] Sample bookings:', bookings.slice(0, 5).map(b => ({
      id: b.id,
      barber_id: b.barber_id,
      barber_id_type: typeof b.barber_id,
      appointment_date: b.appointment_date,
      customer_name: b.customer_name,
      created_by_admin: b.created_by_admin || false
    })));

    res.json(bookings);
  } catch (error) {
    console.error('[Admin Bookings] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      name: error.name
    });
    
    // Firebase specific error handling
    let errorMessage = error.message || 'Randevular yüklenirken bir hata oluştu';
    
    if (error.code === 'permission-denied' || error.code === 'PERMISSION_DENIED') {
      errorMessage = 'Firebase izin hatası: Veritabanı erişim izinlerini kontrol edin';
    } else if (error.code === 'unavailable' || error.code === 'UNAVAILABLE') {
      errorMessage = 'Firebase servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin';
    } else if (error.message && error.message.includes('index')) {
      errorMessage = 'Firestore index eksik. Lütfen Firebase Console\'da index oluşturun';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      code: error.code || 'UNKNOWN_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get booking by ID
app.get('/api/admin/bookings/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('bookings').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const data = doc.data();
    res.json({
      id: doc.id,
      ...data,
      created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
      updated_at: data.updated_at?.toDate?.()?.toISOString() || data.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status
app.patch('/api/admin/bookings/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const bookingData = doc.data();
    const oldStatus = bookingData.status;

    // If changing to completed, save revenue to revenue_history
    if (status === 'completed' && oldStatus !== 'completed' && oldStatus !== 'cancelled') {
      if (bookingData.service_price) {
        await db.collection('revenue_history').add({
          booking_id: id,
          barber_id: bookingData.barber_id,
          service_price: bookingData.service_price,
          appointment_date: bookingData.appointment_date,
          appointment_time: bookingData.appointment_time,
          customer_name: bookingData.customer_name,
          service_name: bookingData.service_name,
          created_at: FieldValue.serverTimestamp()
        });
      }
    }

    // If changing from completed to something else, remove from revenue_history
    if (oldStatus === 'completed' && status !== 'completed') {
      const revenueSnapshot = await db.collection('revenue_history')
        .where('booking_id', '==', id)
        .get();
      
      const deletePromises = revenueSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
    }

    await docRef.update({
      status,
      updated_at: FieldValue.serverTimestamp()
    });

    res.json({ message: 'Booking updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete booking
app.delete('/api/admin/bookings/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('bookings').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const bookingData = doc.data();
    
    // If booking is completed, keep revenue_history (don't delete revenue records)
    // Only delete the booking document, revenue_history stays intact
    if (bookingData.status === 'completed') {
      // Revenue is already saved in revenue_history, just delete the booking
      await docRef.delete();
    } else {
      // For non-completed bookings, delete normally
      // Also check if there's any revenue_history entry and remove it
      const revenueSnapshot = await db.collection('revenue_history')
        .where('booking_id', '==', id)
        .get();
      
      const deletePromises = revenueSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      await docRef.delete();
    }

    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
app.get('/api/admin/stats', verifyToken, async (req, res) => {
  try {
    const userBarberId = req.user?.barber_id || null;
    const { showAll } = req.query;
    const stats = {};

    // OPTIMIZED: Limit stats calculation to reduce Firestore reads
    // Only fetch bookings from last 30 days for stats (reduced from 90 to save quota)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    // Get bookings based on user's barber_id if showAll is not true
    let totalSnapshot;
    if (userBarberId && showAll !== 'true') {
      // OPTIMIZED: Query by date range instead of fetching all
      const allBookings = await db.collection('bookings')
        .where('appointment_date', '>=', thirtyDaysAgoStr)
        .limit(200) // Max 200 bookings for stats calculation (reduced from 1000)
        .get();
      const filteredDocs = [];
      allBookings.forEach(doc => {
        const data = doc.data();
        const dataBarberId = data.barber_id;
        const userBarberIdNum = parseInt(userBarberId, 10);
        const userBarberIdStr = String(userBarberId);
        const matchesBarber = dataBarberId === userBarberIdNum || 
                             dataBarberId === userBarberIdStr || 
                             String(dataBarberId) === userBarberIdStr ||
                             Number(dataBarberId) === userBarberIdNum;
        if (matchesBarber) {
          filteredDocs.push(doc);
        }
      });
      // Create a mock snapshot-like object
      totalSnapshot = { 
        size: filteredDocs.length, 
        forEach: (callback) => filteredDocs.forEach(callback) 
      };
    } else {
      // OPTIMIZED: Limit to last 30 days and max 200 bookings (reduced to save quota)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      totalSnapshot = await db.collection('bookings')
        .where('appointment_date', '>=', thirtyDaysAgoStr)
        .limit(200) // Reduced from 1000 to save quota
        .get();
    }
    
    stats.totalBookings = totalSnapshot.size;

    // Bookings by status
    const statusCounts = {};
    totalSnapshot.forEach(doc => {
      const data = doc.data();
      // Filter by barber_id if needed (already filtered in totalSnapshot, but double-check)
      if (userBarberId && showAll !== 'true') {
        const dataBarberId = data.barber_id;
        const userBarberIdNum = parseInt(userBarberId, 10);
        const userBarberIdStr = String(userBarberId);
        const matchesBarber = dataBarberId === userBarberIdNum || 
                             dataBarberId === userBarberIdStr || 
                             String(dataBarberId) === userBarberIdStr ||
                             Number(dataBarberId) === userBarberIdNum;
        if (!matchesBarber) {
          return; // Skip this booking
        }
      }
      const status = data.status || 'pending';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    stats.bookingsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));

    // Today's bookings
    const today = new Date().toISOString().split('T')[0];
    let todayCount = 0;
    
    try {
    const todaySnapshot = await db.collection('bookings')
      .where('appointment_date', '==', today)
      .get();
      
      // Filter by barber_id if needed
      if (userBarberId && showAll !== 'true') {
        todaySnapshot.forEach(doc => {
          const data = doc.data();
          const dataBarberId = data.barber_id;
          const userBarberIdNum = parseInt(userBarberId, 10);
          const userBarberIdStr = String(userBarberId);
          const matchesBarber = dataBarberId === userBarberIdNum || 
                               dataBarberId === userBarberIdStr || 
                               String(dataBarberId) === userBarberIdStr ||
                               Number(dataBarberId) === userBarberIdNum;
          if (matchesBarber) {
            todayCount++;
          }
        });
      } else {
        todayCount = todaySnapshot.size;
      }
    } catch (error) {
      // If index error, fetch all and filter in memory
      if (error.message && error.message.includes('index')) {
        const allSnapshot = await db.collection('bookings').get();
        allSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.appointment_date === today) {
            // Filter by barber_id if needed
            if (userBarberId && showAll !== 'true') {
              const dataBarberId = data.barber_id;
              const userBarberIdNum = parseInt(userBarberId, 10);
              const userBarberIdStr = String(userBarberId);
              const matchesBarber = dataBarberId === userBarberIdNum || 
                                   dataBarberId === userBarberIdStr || 
                                   String(dataBarberId) === userBarberIdStr ||
                                   Number(dataBarberId) === userBarberIdNum;
              if (matchesBarber) {
                todayCount++;
              }
            } else {
              todayCount++;
            }
          }
        });
      } else {
        throw error;
      }
    }
    
    stats.todayBookings = todayCount;

    // Total revenue - calculate from revenue_history (completed bookings) and non-cancelled bookings
    let totalRevenue = 0;
    
    // First, get revenue from revenue_history (completed bookings that may have been deleted)
    const revenueHistorySnapshot = await db.collection('revenue_history').get();
    revenueHistorySnapshot.forEach(doc => {
      const data = doc.data();
      // Filter by barber_id if needed
      if (userBarberId && showAll !== 'true') {
        const dataBarberId = data.barber_id;
        const userBarberIdNum = parseInt(userBarberId, 10);
        const userBarberIdStr = String(userBarberId);
        const matchesBarber = dataBarberId === userBarberIdNum || 
                             dataBarberId === userBarberIdStr || 
                             String(dataBarberId) === userBarberIdStr ||
                             Number(dataBarberId) === userBarberIdNum;
        if (!matchesBarber) {
          return; // Skip this revenue
        }
      }
      if (data.service_price) {
        totalRevenue += parseFloat(data.service_price) || 0;
      }
    });
    
    // Then, add revenue from non-completed, non-cancelled bookings (that are not in revenue_history)
    const bookingsInRevenueHistory = new Set();
    revenueHistorySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.booking_id) {
        bookingsInRevenueHistory.add(data.booking_id);
      }
    });
    
    totalSnapshot.forEach(doc => {
      const data = doc.data();
      // Skip if already counted in revenue_history
      if (bookingsInRevenueHistory.has(doc.id)) {
        return;
      }
      
      // Filter by barber_id if needed
      if (userBarberId && showAll !== 'true') {
        const dataBarberId = data.barber_id;
        const userBarberIdNum = parseInt(userBarberId, 10);
        const userBarberIdStr = String(userBarberId);
        const matchesBarber = dataBarberId === userBarberIdNum || 
                             dataBarberId === userBarberIdStr || 
                             String(dataBarberId) === userBarberIdStr ||
                             Number(dataBarberId) === userBarberIdNum;
        if (!matchesBarber) {
          return; // Skip this booking
        }
      }
      // Only count non-cancelled bookings (completed ones are already in revenue_history)
      if (data.status !== 'cancelled' && data.status !== 'completed' && data.service_price) {
        totalRevenue += parseFloat(data.service_price) || 0;
      }
    });
    
    stats.totalRevenue = totalRevenue;

    // Revenue by barber with daily trends
    const revenueByBarber = {
      1: { name: 'Hıdır Yasin Gökçeoğlu', total: 0, daily: {} },
      2: { name: 'Emir Gökçeoğlu', total: 0, daily: {} }
    };

    // First, calculate revenue from revenue_history (completed bookings)
    revenueHistorySnapshot.forEach(doc => {
      const data = doc.data();
      const barberId = data.barber_id;
      const date = data.appointment_date;
      
      // Filter by barber_id if needed
      if (userBarberId && showAll !== 'true') {
        const dataBarberId = barberId;
        const userBarberIdNum = parseInt(userBarberId, 10);
        const userBarberIdStr = String(userBarberId);
        const matchesBarber = dataBarberId === userBarberIdNum || 
                             dataBarberId === userBarberIdStr || 
                             String(dataBarberId) === userBarberIdStr ||
                             Number(dataBarberId) === userBarberIdNum;
        if (!matchesBarber) {
          return; // Skip this revenue
        }
      }
      
      if (data.service_price && date) {
        const price = parseFloat(data.service_price) || 0;
        
        // Check if barber_id is 1 or 2
        if (barberId === 1 || barberId === '1' || Number(barberId) === 1) {
          revenueByBarber[1].total += price;
          if (!revenueByBarber[1].daily[date]) {
            revenueByBarber[1].daily[date] = 0;
          }
          revenueByBarber[1].daily[date] += price;
        } else if (barberId === 2 || barberId === '2' || Number(barberId) === 2) {
          revenueByBarber[2].total += price;
          if (!revenueByBarber[2].daily[date]) {
            revenueByBarber[2].daily[date] = 0;
          }
          revenueByBarber[2].daily[date] += price;
        }
      }
    });

    // Then, add revenue from non-completed, non-cancelled bookings
    totalSnapshot.forEach(doc => {
      const data = doc.data();
      // Skip if already counted in revenue_history
      if (bookingsInRevenueHistory.has(doc.id)) {
        return;
      }
      
      const barberId = data.barber_id;
      const date = data.appointment_date;
      
      // Filter by barber_id if needed
      if (userBarberId && showAll !== 'true') {
        const dataBarberId = barberId;
        const userBarberIdNum = parseInt(userBarberId, 10);
        const userBarberIdStr = String(userBarberId);
        const matchesBarber = dataBarberId === userBarberIdNum || 
                             dataBarberId === userBarberIdStr || 
                             String(dataBarberId) === userBarberIdStr ||
                             Number(dataBarberId) === userBarberIdNum;
        if (!matchesBarber) {
          return; // Skip this booking
        }
      }
      
      // Only count non-cancelled, non-completed bookings
      if (data.status !== 'cancelled' && data.status !== 'completed' && data.service_price && date) {
        const price = parseFloat(data.service_price) || 0;
        
        // Check if barber_id is 1 or 2
        if (barberId === 1 || barberId === '1' || Number(barberId) === 1) {
          revenueByBarber[1].total += price;
          if (!revenueByBarber[1].daily[date]) {
            revenueByBarber[1].daily[date] = 0;
          }
          revenueByBarber[1].daily[date] += price;
        } else if (barberId === 2 || barberId === '2' || Number(barberId) === 2) {
          revenueByBarber[2].total += price;
          if (!revenueByBarber[2].daily[date]) {
            revenueByBarber[2].daily[date] = 0;
          }
          revenueByBarber[2].daily[date] += price;
        }
      }
    });

    // Convert daily revenue to array and sort by date
    const revenueTrends = {
      1: {
        name: revenueByBarber[1].name,
        total: revenueByBarber[1].total,
        trends: Object.entries(revenueByBarber[1].daily)
          .map(([date, revenue]) => ({ date, revenue }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30) // Last 30 days
      },
      2: {
        name: revenueByBarber[2].name,
        total: revenueByBarber[2].total,
        trends: Object.entries(revenueByBarber[2].daily)
          .map(([date, revenue]) => ({ date, revenue }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-30) // Last 30 days
      }
    };

    stats.revenueByBarber = revenueTrends;

    res.json(stats);
  } catch (error) {
    console.error('[Admin Stats] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'İstatistikler yüklenirken bir hata oluştu',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============ CLOSED DATES ROUTES ============

// Get all closed date ranges
app.get('/api/admin/closed-dates', verifyToken, async (req, res) => {
  try {
    let snapshot;
    try {
      // Try with orderBy first (requires index)
      snapshot = await db.collection('closed_dates')
        .orderBy('start_date', 'asc')
        .get();
    } catch (indexError) {
      // If index error, fetch all and sort in memory
      if (indexError.message && indexError.message.includes('index')) {
        console.warn('[Closed Dates] Index missing, fetching all and sorting in memory');
        snapshot = await db.collection('closed_dates').get();
      } else {
        throw indexError;
      }
    }

    const closedDates = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      closedDates.push({
        id: doc.id,
        ...data,
        start_date: data.start_date,
        end_date: data.end_date,
        created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
      });
    });

    // Sort by start_date if fetched without orderBy
    if (closedDates.length > 0 && !closedDates[0].start_date) {
      // Already sorted by Firestore
    } else {
      closedDates.sort((a, b) => {
        const dateA = new Date(a.start_date);
        const dateB = new Date(b.start_date);
        return dateA - dateB;
      });
    }

    res.json(closedDates);
  } catch (error) {
    console.error('[Admin Closed Dates] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ 
      error: error.message || 'Kapalı tarihler yüklenirken bir hata oluştu',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Create closed date range
app.post('/api/admin/closed-dates', verifyToken, async (req, res) => {
  try {
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Validate dates
    const start = new Date(start_date);
    const end = new Date(end_date);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start > end) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' });
    }

    // Check for overlapping ranges
    // OPTIMIZED: Use cache for closed dates check
    let existingClosedDates = getCachedData('closedDates');
    if (!existingClosedDates) {
      const existingSnapshot = await db.collection('closed_dates').get();
      existingClosedDates = [];
      existingSnapshot.forEach(doc => {
        existingClosedDates.push({ id: doc.id, ...doc.data() });
      });
      setCachedData('closedDates', existingClosedDates);
    }
    
    const existingSnapshot = { forEach: (callback) => existingClosedDates.forEach(callback) };
    const overlaps = [];
    existingSnapshot.forEach(doc => {
      const existing = doc.data();
      const existingStart = new Date(existing.start_date);
      const existingEnd = new Date(existing.end_date);
      
      // Check if ranges overlap
      if ((start <= existingEnd && end >= existingStart)) {
        overlaps.push({
        id: doc.id,
          start_date: existing.start_date,
          end_date: existing.end_date
        });
      }
    });

    if (overlaps.length > 0) {
      return res.status(400).json({ 
        error: 'This date range overlaps with existing closed dates',
        overlaps: overlaps
      });
    }

    const closedDateRef = await db.collection('closed_dates').add({
      start_date: start_date,
      end_date: end_date,
      reason: reason || '',
      created_at: FieldValue.serverTimestamp(),
      created_by: req.user?.username || 'unknown'
    });

    // Clear cache when closed date is added
    clearCache('closedDates');

    res.json({ 
      id: closedDateRef.id,
      start_date,
      end_date,
      reason: reason || '',
      message: 'Closed date range created successfully'
    });
  } catch (error) {
    console.error('Error creating closed date range:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete closed date range
app.delete('/api/admin/closed-dates/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection('closed_dates').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Closed date range not found' });
    }

    await db.collection('closed_dates').doc(id).delete();
    
    // Clear cache when closed date is deleted
    clearCache('closedDates');
    
    res.json({ message: 'Closed date range deleted successfully' });
  } catch (error) {
    console.error('Error deleting closed date range:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update services to new prices (admin-only, one-time migration)
app.post('/api/admin/update-services', verifyToken, async (req, res) => {
  try {
    const newServices = [
      { name: 'Saç & Sakal + Yıkama + Fön', duration: 60, price: 600, active: true },
      { name: 'Saç Kesimi + Yıkama + Fön', duration: 45, price: 500, active: true },
      { name: 'VIP Hizmet (Cilt bakımı, keratinli saç bakımı maskesi, profesyonel masaj)', duration: 120, price: 2500, active: true },
      { name: 'Profesyonel Buharlı Cilt Bakımı', duration: 60, price: 500, active: true },
      { name: 'Buharlı Keratinli Saç Bakımı Maskesi', duration: 60, price: 500, active: true },
      { name: 'VIP House Tıraş', duration: 90, price: 5000, active: true }
    ];

    console.log('🔄 Hizmetler güncelleniyor...');

    // Mevcut tüm hizmetleri pasif yap
    const existingSnapshot = await db.collection('services').get();
    const updatePromises = [];
    
    existingSnapshot.forEach(doc => {
      updatePromises.push(doc.ref.update({ active: false }));
    });
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`✅ ${updatePromises.length} eski hizmet pasif yapıldı`);
    }

    // Yeni hizmetleri ekle
    const addPromises = newServices.map(service => {
      return db.collection('services').add({
        ...service,
        created_at: FieldValue.serverTimestamp()
      });
    });

    await Promise.all(addPromises);
    console.log('✅ Yeni hizmetler eklendi');

    // Cache'i temizle
    clearCache('services');

    res.json({ 
      message: 'Hizmetler başarıyla güncellendi',
      services: newServices
    });
  } catch (error) {
    console.error('Error updating services:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send daily report email (admin-only)
app.post('/api/admin/daily-report', verifyToken, async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get all bookings for the selected date
    const bookingsSnapshot = await db.collection('bookings')
      .where('appointment_date', '==', date)
      .get();

    const bookings = [];
    bookingsSnapshot.forEach(doc => {
      const data = doc.data();
      bookings.push({
        id: doc.id,
        barber_id: data.barber_id,
        barber_name: data.barber_name,
        service_name: data.service_name,
        service_price: data.service_price,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        appointment_date: data.appointment_date,
        appointment_time: data.appointment_time,
        status: data.status
      });
    });

    // Send email with all bookings
    await sendDailyReportEmail({
      date,
      bookings
    });

    res.json({ 
      message: 'Günlük rapor emaili gönderildi',
      date,
      totalBookings: bookings.length
    });
  } catch (error) {
    console.error('Error sending daily report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clean up old bookings (older than 2 weeks)
async function cleanupOldBookings() {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

    console.log(`Cleaning up bookings older than ${twoWeeksAgoStr}...`);
    
    // OPTIMIZED: Query only old bookings instead of getting all
    // This reduces Firestore read operations significantly
    const oldBookingsQuery = db.collection('bookings')
      .where('appointment_date', '<', twoWeeksAgoStr)
      .limit(500); // Process max 500 at a time to avoid quota issues
    
    const snapshot = await oldBookingsQuery.get();
    
    if (snapshot.empty) {
      console.log('No old bookings to clean up');
      return;
    }

    let deletedCount = 0;
    const batch = db.batch();
    let batchCount = 0;

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
      batchCount++;

      // Firestore batch limit is 500, so commit in batches
      if (batchCount >= 500) {
        batch.commit();
        batchCount = 0;
      }
    });

    // Commit remaining deletes
    if (batchCount > 0) {
      await batch.commit();
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old bookings`);
    } else {
      console.log('No old bookings to clean up');
    }
  } catch (error) {
    // If quota exceeded, just log and continue (don't crash server)
    if (error.message && error.message.includes('Quota exceeded')) {
      console.log('Skipping cleanup due to quota limit');
    } else {
      console.error('Error cleaning up old bookings:', error);
    }
  }
}

// Run cleanup on startup and then daily
async function scheduleCleanup() {
  // DISABLED: Cleanup temporarily disabled to prevent quota issues
  // Firebase free tier has limited quota (50K reads/day)
  // Manual cleanup can be done via admin panel if needed
  
  console.log('Cleanup scheduling disabled to preserve Firestore quota');
  console.log('Note: Old bookings can be manually deleted via admin panel if needed');
  
  // Uncomment below to re-enable cleanup (not recommended for free tier)
  /*
  // Run daily at 2 AM
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0);
  
  const msUntilTomorrow = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    cleanupOldBookings();
    // Run every 24 hours
    setInterval(cleanupOldBookings, 24 * 60 * 60 * 1000);
  }, msUntilTomorrow);
  
  console.log(`Next cleanup scheduled for: ${tomorrow.toLocaleString()}`);
  */
}

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Using Firebase Firestore database');
  
  // Initialize database on startup
  // If quota exceeded, skip initialization (server will still work)
  try {
    await initializeDatabase();
    console.log('Database initialization completed');
  } catch (error) {
    if (error.message && error.message.includes('Quota exceeded')) {
      console.warn('Database initialization skipped due to quota limit. Server will continue.');
      console.warn('Quota will reset at midnight UTC. Server functionality may be limited until then.');
    } else {
      console.error('Database initialization failed:', error);
      console.error('Server will continue but some features may not work');
    }
  }

  // Schedule cleanup of old bookings - DISABLED to prevent quota issues
  // scheduleCleanup().catch(err => {
  //   console.error('Failed to schedule cleanup:', err);
  // });
  console.log('Cleanup scheduling disabled to preserve Firestore quota');
});

