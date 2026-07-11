import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Mailjet = require('node-mailjet');
const webpush = require('web-push');
const cron = require('node-cron');
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
    Barber,
    Service,
    AdminUser,
    Booking,
    ClosedDate,
    DeviceToken,
    RevenueHistory,
    SystemSetting,
    DailyStats,
    SpecialWorkingHours,
    WebPushSubscription
} from './models.js';

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set!');
    process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kuafor';
const MJ_APIKEY_PUBLIC = process.env.MJ_APIKEY_PUBLIC;
const MJ_APIKEY_PRIVATE = process.env.MJ_APIKEY_PRIVATE;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'info@hairologyyasinpremiumrandevu.com';

let mailjet;
if (MJ_APIKEY_PUBLIC && MJ_APIKEY_PRIVATE) {
    mailjet = Mailjet.apiConnect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);
} else {
    console.warn('Mailjet keys missing. Email sending disabled.');
}

// Setup web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:' + (process.env.SENDER_EMAIL || 'info@hairology.com'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.warn('VAPID keys missing. Push notifications disabled.');
}

// CORS configuration
app.use(cors({
    origin: [
        'https://hairologyyasinpremiumrandevu.com',
        'https://hairlogyyasinpremium.netlify.app',
        'http://localhost:3000',
        /\.netlify\.app$/
    ],
    credentials: true
}));
app.use(express.json());

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// MongoDB Connection
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB successfully');
        initializeDatabase();

        // Start listening ONLY after successful DB connection
        app.listen(PORT, () => console.log(`Server (MongoDB) running on port ${PORT}`));
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1); // Exit if we can't connect to DB
    });

// Root endpoint
app.get('/', (req, res) => {
    res.send('Hairlogy Backend (MongoDB) is running!');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server (MongoDB) is running',
        timestamp: new Date().toISOString()
    });
});

// Initialize default data
async function initializeDatabase() {
    try {
        console.log('Initializing database data...');

        // Auto-confirm old pending bookings
        const result = await Booking.updateMany(
            { status: 'pending' },
            { $set: { status: 'confirmed' } }
        );
        if (result.modifiedCount > 0) {
            console.log(`Auto-confirmed ${result.modifiedCount} pending bookings`);
        }

        // Default Barbers
        const barbersCount = await Barber.countDocuments();
        if (barbersCount === 0) {
            const defaultBarbers = [
                {
                    barber_id: 1,
                    name: 'Hıdır Yasin Gökçeoğlu',
                    experience: '7 Yıl Deneyim',
                    specialty: 'Klasik & Modern Kesimler',
                    image_url: '/yasin-new.jpg',
                    social_links: {
                        instagram: 'https://www.instagram.com/hairology_yasin?igsh=eWZlN3c4emF2bTRu&utm_source=qr',
                        tiktok: 'https://www.tiktok.com/@hidir_yasin?_r=1&_t=ZS-9281Gzsz8VQ',
                        youtube: 'https://youtube.com/@hdrgokceoglu5095?si=lL8J2m-HA_r6tK1H'
                    },
                    active: true
                },
                {
                    barber_id: 2,
                    name: 'Emir Gökçeoğlu',
                    experience: '2 Yıl Deneyim',
                    specialty: 'Fade & Sakal Tasarımı',
                    image_url: '/WhatsApp%20Image%202025-12-09%20at%2012.00.59.jpeg',
                    social_links: {
                        instagram: 'https://www.instagram.com/emirgokceoglu1?igsh=YjBjYm1tYWVheTR4',
                        tiktok: 'https://www.tiktok.com/@emirgokceoglu?_r=1&_t=ZS-9284iyXxzcq'
                    },
                    active: true
                }
            ];
            await Barber.insertMany(defaultBarbers);
            console.log('Default barbers created');
        } else {
            // Update existing barbers with social_links if missing
            const barbersToUpdate = await Barber.find({ social_links: { $exists: false } });
            const socialLinksMap = {
                1: {
                    instagram: 'https://www.instagram.com/hairology_yasin?igsh=eWZlN3c4emF2bTRu&utm_source=qr',
                    tiktok: 'https://www.tiktok.com/@hidir_yasin?_r=1&_t=ZS-9281Gzsz8VQ',
                    youtube: 'https://youtube.com/@hdrgokceoglu5095?si=lL8J2m-HA_r6tK1H'
                },
                2: {
                    instagram: 'https://www.instagram.com/emirgokceoglu1?igsh=YjBjYm1tYWVheTR4',
                    tiktok: 'https://www.tiktok.com/@emirgokceoglu?_r=1&_t=ZS-9284iyXxzcq'
                }
            };
            const imageMap = {
                1: '/yasin-new.jpg',
                2: '/WhatsApp%20Image%202025-12-09%20at%2012.00.59.jpeg'
            };
            for (const barber of barbersToUpdate) {
                const updates = {};
                if (socialLinksMap[barber.barber_id]) {
                    updates.social_links = socialLinksMap[barber.barber_id];
                }
                if (barber.image_url && barber.image_url.includes('unsplash') && imageMap[barber.barber_id]) {
                    updates.image_url = imageMap[barber.barber_id];
                }
                if (Object.keys(updates).length > 0) {
                    await Barber.updateOne({ _id: barber._id }, { $set: updates });
                }
            }
        }

        // Default Services
        const servicesCount = await Service.countDocuments();
        if (servicesCount === 0) {
            const defaultServices = [
                { name: 'VIP Hizmet (Cilt bakımı, keratinli saç bakımı maskesi, profesyonel masaj)', duration: 90, price: 2500, active: true },
                { name: 'Saç Kesimi + Yıkama + Fön', duration: 45, price: 500, active: true },
                { name: 'Profesyonel Buharlı Cilt Bakımı', duration: 45, price: 500, active: true },
                { name: 'VIP House Tıraş', duration: 120, price: 5000, active: true },
                { name: 'Buharlı Keratinli Saç Bakım Maskesi', duration: 45, price: 500, active: true }
            ];
            await Service.insertMany(defaultServices);
            console.log('Default services created');
        }

        // Admin Users (yasin, emir, admin) - Only create if not exists
        const admins = [
            { username: 'yasin', password: 'Yasin@2025!', barber_id: 1 },
            { username: 'emir', password: 'Emir@2025!', barber_id: 2 },
            { username: 'admin', password: 'admin123' }
        ];

        let createdCount = 0;
        for (const admin of admins) {
            const existingUser = await AdminUser.findOne({ username: admin.username });
            // Only create if user doesn't exist - don't reset passwords on restart
            if (!existingUser) {
                const hashedPassword = bcrypt.hashSync(admin.password, 10);
                await AdminUser.create({
                    username: admin.username.toLowerCase(),
                    password: hashedPassword,
                    barber_id: admin.barber_id
                });
                createdCount++;
                console.log(`Admin user created: ${admin.username}`);
            }
        }
        if (createdCount === 0) {
            console.log('Admin users already exist, skipping creation');
        }

        // Default System Settings
        const maintenanceSetting = await SystemSetting.findOne({ key: 'maintenance_mode' });
        if (!maintenanceSetting) {
            await SystemSetting.create({ key: 'maintenance_mode', value: false });
            console.log('Default maintenance mode setting created (OFF)');
        }

        console.log('Database initialization completed');
        scheduleCleanup();
        setupCronJobs();
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Setup cron jobs for push notifications (1 hour before)
function setupCronJobs() {
    if (!process.env.VAPID_PUBLIC_KEY) return;
    
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            // Calculate time 60 minutes from now
            const targetTime = new Date(now.getTime() + 60 * 60 * 1000);
            
            const targetDateStr = targetTime.toISOString().split('T')[0];
            const hourStr = targetTime.getHours().toString().padStart(2, '0');
            const minStr = targetTime.getMinutes().toString().padStart(2, '0');
            const targetTimeStr = `${hourStr}:${minStr}`;

            const upcomingBookings = await Booking.find({
                appointment_date: targetDateStr,
                appointment_time: targetTimeStr,
                status: 'confirmed',
                reminder_sent: false
            });

            for (const booking of upcomingBookings) {
                if (booking.deviceId) {
                    const subDoc = await WebPushSubscription.findOne({ deviceId: booking.deviceId });
                    if (subDoc && subDoc.subscription) {
                        const payload = JSON.stringify({
                            title: 'Randevunuza 1 Saat Kaldı!',
                            body: `${booking.barber_name} ile randevunuz saat ${booking.appointment_time}'da başlıyor.`,
                            icon: '/Gemini_Generated_Image_ii78ufii78ufii78.png'
                        });
                        try {
                            await webpush.sendNotification(subDoc.subscription, payload);
                            console.log(`Reminder push sent for booking ${booking._id}`);
                            booking.reminder_sent = true;
                            booking.reminder_sent_at = new Date();
                            await booking.save();
                        } catch (err) {
                            console.error(`Failed to send reminder push for booking ${booking._id}:`, err.message);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Cron job error:', error);
        }
    });
    console.log('Cron jobs scheduled');
}

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
        req.userId = decoded.userId;
        req.user = {
            userId: decoded.userId,
            username: decoded.username || null,
            barber_id: decoded.barber_id || null
        };
        next();
    });
};

// ============ CACHE (IN-MEMORY) ============
// Cache system settings to prevent hitting DB on every calendar date
let systemSettingsCache = {};
let systemSettingsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedSetting = async (key, defaultVal) => {
    const now = Date.now();
    // Refresh cache if expired
    if (!systemSettingsCache[key] || (now - systemSettingsCacheTime) > CACHE_TTL) {
        const setting = await SystemSetting.findOne({ key });
        if (setting) {
            systemSettingsCache[key] = setting.value;
            systemSettingsCacheTime = now;
        } else {
            return defaultVal;
        }
    }
    return systemSettingsCache[key];
};

// ============ PUBLIC ROUTES ============

// Add a simple speed measuring middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 2000 && req.url.startsWith('/api')) { // Slower than 2000ms
            console.warn(`[SLOW API] ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
    });
    next();
});


app.delete('/api/admin/bookings/:id', verifyToken, async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        await RevenueHistory.deleteMany({ booking_id: req.params.id });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/stats', verifyToken, async (req, res) => {
    try {
        const userBarberId = req.user?.barber_id;
        const { showAll } = req.query;
        const filter = {};
        if (userBarberId && showAll !== 'true') filter.barber_id = userBarberId;

        // Run all heavy queries in parallel
        const [
            totalBookings,
            bookingsByStatus,
            todayBookings,
            revenueRecords,
            trends,
            bookingTrends,
            siteVisits
        ] = await Promise.all([
            Booking.countDocuments(filter),
            Booking.aggregate([
                { $match: filter },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Booking.countDocuments({ ...filter, appointment_date: new Date().toISOString().split('T')[0] }),
            RevenueHistory.find(filter),
            RevenueHistory.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: { date: '$appointment_date', barberId: '$barber_id' },
                        revenue: { $sum: '$service_price' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.date': 1 } }
            ]),
            Booking.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: '$appointment_date',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            DailyStats.find().sort({ date: -1 }).limit(90)
        ]);

        const activeBookings = await Booking.find({
            ...filter,
            status: 'confirmed'
        });
        
        const allRevenueBookings = [...revenueRecords, ...activeBookings];

        const totalRevenue = allRevenueBookings.reduce((sum, b) => sum + (b.service_price || 0), 0);

        // Calculate Revenue for specific periods (Weekly, Monthly, 3-Monthly)
        const nowMs = new Date().getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        
        let weeklyRevenue = 0;
        let monthlyRevenue = 0;
        let threeMonthlyRevenue = 0;
        
        allRevenueBookings.forEach(b => {
            const bDate = new Date(b.appointment_date).getTime();
            const diffDays = (nowMs - bDate) / oneDay;
            const price = b.service_price || 0;
            
            if (diffDays >= 0) {
                if (diffDays <= 7) weeklyRevenue += price;
                if (diffDays <= 30) monthlyRevenue += price;
                if (diffDays <= 90) threeMonthlyRevenue += price;
            }
        });

        res.json({
            totalBookings,
            bookingsByStatus: bookingsByStatus.map(s => ({ status: s._id, count: s.count })),
            todayBookings,
            totalRevenue,
            weeklyRevenue,
            monthlyRevenue,
            threeMonthlyRevenue,
            trends,
            bookingTrends,
            siteVisits: siteVisits.map(v => ({ date: v.date, visits: v.visits }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CUSTOMERS ENDPOINT ============
app.get('/api/admin/customers', verifyToken, async (req, res) => {
    try {
        const customers = await Booking.aggregate([
            {
                $group: {
                    _id: '$customer_phone',
                    name: { $first: '$customer_name' },
                    phone: { $first: '$customer_phone' },
                    email: { $first: '$customer_email' },
                    total_bookings: { $sum: 1 },
                    last_booking: { $max: '$appointment_date' }
                }
            },
            { $sort: { last_booking: -1 } }
        ]);
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Track site visit
app.post('/api/visit', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        await DailyStats.findOneAndUpdate(
            { date: today },
            { $inc: { visits: 1 } },
            { upsert: true, new: true }
        );
        res.json({ message: 'Visit recorded' });
    } catch (error) {
        // Silent fail for analytics
        res.status(500).json({ error: error.message });
    }
});

// Subscribe to push notifications
app.post('/api/notifications/subscribe', async (req, res) => {
    try {
        const { deviceId, subscription } = req.body;
        if (!deviceId || !subscription) {
            return res.status(400).json({ error: 'deviceId and subscription required' });
        }
        await WebPushSubscription.findOneAndUpdate(
            { deviceId },
            { deviceId, subscription },
            { upsert: true, new: true }
        );
        res.status(201).json({ message: 'Subscribed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get maintenance mode status
app.get('/api/settings/maintenance', async (req, res) => {
    try {
        const setting = await SystemSetting.findOne({ key: 'maintenance_mode' });
        res.json({ maintenanceMode: setting ? setting.value : false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all barbers
app.get('/api/barbers', async (req, res) => {
    try {
        const barbers = await Barber.find({ active: true });
        res.json(barbers.map(b => ({ id: b._id, ...b.toObject() })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all services
app.get('/api/services', async (req, res) => {
    try {
        const services = await Service.find({ active: true });
        res.json(services.map(s => ({ id: s._id, ...s.toObject() })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const isTimeInRange = (time, start, end) => {
    if (!start || !end || start === '' || end === '') return false;
    if (start < end) {
        return time >= start && time < end;
    } else {
        // Overnight range (e.g., 22:00 to 04:00)
        return time >= start || time < end;
    }
};

// Get available time slots
app.get('/api/available-times', async (req, res) => {
    try {
        const { barberId, date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }

        const isAllBarbers = !barberId || barberId === 'all';
        let targetBarbers = [];
        let barbersData = [];
        if (isAllBarbers) {
            barbersData = await Barber.find({ active: true }).select('barber_id name working_hours');
            targetBarbers = barbersData.flatMap(b => [Number(b.barber_id), String(b.barber_id)]);
        } else {
            barbersData = await Barber.find({ barber_id: Number(barberId), active: true }).select('barber_id name working_hours');
            targetBarbers = [Number(barberId), String(barberId)];
        }
        const barbersMap = new Map(barbersData.map(b => [Number(b.barber_id), b]));

        const numericTargetBarbers = targetBarbers.map(Number).filter(n => !isNaN(n));

        const [y, m, d] = date.split('-').map(Number);
        const utcDate = new Date(Date.UTC(y, m - 1, d));
        const dayOfWeek = utcDate.getUTCDay();

        const closedDates = await ClosedDate.find({
            start_date: { $lte: date },
            end_date: { $gte: date }
        });

        // Global full day closure
        const globalFullDayClosure = closedDates.find(c =>
            (!c.barber_id || c.barber_id === 'undefined') && ((!c.start_time && !c.end_time) || c.start_time === '' || c.end_time === '')
        );

        if (globalFullDayClosure) {
            return res.json({
                availableTimes: [],
                bookedTimes: [],
                isClosed: true,
                reason: globalFullDayClosure.reason || 'Tatil günü',
                barberAvailability: {}
            });
        }

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        const bookings = await Booking.find({
            barber_id: { $in: targetBarbers },
            appointment_date: { $in: [date, nextDayStr] },
            status: { $ne: 'cancelled' }
        });

        const [specialHours] = await SpecialWorkingHours.find({ date, barber_id: null });

        if (specialHours && specialHours.is_closed) {
            return res.json({
                availableTimes: [],
                bookedTimes: [],
                isClosed: true,
                reason: 'Bugün kapalı (Özel ayar)',
                barberAvailability: {}
            });
        }

        let startHour, endHour;
        let dayBreaks = [];

        if (specialHours) {
            startHour = parseInt(specialHours.start?.split(':')[0]) || 9;
            endHour = parseInt(specialHours.end?.split(':')[0]) || 20;
            dayBreaks = specialHours.breaks || [];
        } else {
            // Get working hours from Cache
            const cachedWorkingHours = await getCachedSetting('working_hours', null);
            const workingHours = cachedWorkingHours || {
                weekday: { start: '09:00', end: '20:00' },
                saturday: { start: '09:00', end: '22:00' },
                sunday: { closed: true },
                slotDuration: 60
            };

            const sundaySettings = workingHours.sunday || {};
            const isSundayClosed = String(sundaySettings.closed) === 'true';

            if (dayOfWeek === 0 && isSundayClosed) {
                return res.json({
                    availableTimes: [],
                    bookedTimes: [],
                    isClosed: true,
                    reason: 'Pazar günü kapalı',
                    barberAvailability: {}
                });
            }

            if (dayOfWeek === 0) {
                startHour = parseInt(workingHours.sunday?.start?.split(':')[0]) || 10;
                endHour = parseInt(workingHours.sunday?.end?.split(':')[0]) || 18;
                dayBreaks = workingHours.sunday?.breaks || [];
            } else if (dayOfWeek === 6) {
                startHour = parseInt(workingHours.saturday?.start?.split(':')[0]) || 9;
                endHour = parseInt(workingHours.saturday?.end?.split(':')[0]) || 22;
                dayBreaks = workingHours.saturday?.breaks || [];
            } else {
                startHour = parseInt(workingHours.weekday?.start?.split(':')[0]) || 9;
                endHour = parseInt(workingHours.weekday?.end?.split(':')[0]) || 20;
                dayBreaks = workingHours.weekday?.breaks || [];
            }
        }

        
        let minStartHour = 24;
        let maxEndHour = 0;
        let anyOpen = false;

        numericTargetBarbers.forEach(bId => {
            const barber = barbersMap.get(Number(bId));
            let bStartHour = startHour;
            let bEndHour = endHour;
            let bClosed = false;
            
            if (barber && barber.working_hours) {
                let daySettings;
                if (dayOfWeek === 0) daySettings = barber.working_hours.sunday;
                else if (dayOfWeek === 6) daySettings = barber.working_hours.saturday;
                else daySettings = barber.working_hours.weekday;

                if (daySettings) {
                    if (String(daySettings.closed) === 'true') bClosed = true;
                    else {
                        if (daySettings.start) bStartHour = parseInt(daySettings.start.split(':')[0]);
                        if (daySettings.end) bEndHour = parseInt(daySettings.end.split(':')[0]);
                    }
                }
            }
            if (!bClosed) {
                anyOpen = true;
                if (bStartHour < minStartHour) minStartHour = bStartHour;
                let bEffEnd = bEndHour;
                if (bEffEnd <= bStartHour && bEffEnd !== 0) bEffEnd += 24;
                else if (bEffEnd === 0) bEffEnd = 24;
                if (bEffEnd > maxEndHour) maxEndHour = bEffEnd;
            }
        });

        if (anyOpen) {
            startHour = minStartHour;
            endHour = maxEndHour;
        }

        const slotDuration = (await getCachedSetting('working_hours', null))?.slotDuration || 60;
        const allTimeSlots = [];
        let effectiveEndHour = endHour;
        // endHour is already effective from maxEndHour, but just in case:
        if (effectiveEndHour <= startHour && effectiveEndHour !== 0) {
            effectiveEndHour += 24;
        } else if (effectiveEndHour === 0) {
            effectiveEndHour = 24;
        }


        for (let hour = startHour; hour < effectiveEndHour; hour++) {
            const displayHour = hour % 24;
            if (slotDuration === 30) {
                allTimeSlots.push(`${displayHour.toString().padStart(2, '0')}:00`, `${displayHour.toString().padStart(2, '0')}:30`);
            } else if (slotDuration === 90) {
                if ((hour - startHour) % 1.5 === 0 || allTimeSlots.length === 0) {
                    allTimeSlots.push(`${displayHour.toString().padStart(2, '0')}:00`);
                } else {
                    allTimeSlots.push(`${displayHour.toString().padStart(2, '0')}:30`);
                }
            } else {
                allTimeSlots.push(`${displayHour.toString().padStart(2, '0')}:00`);
            }
        }

        // Breaks already set in the specialHours/default check above


        const globalBlockedRanges = [
            ...closedDates.filter(c => (!c.barber_id || c.barber_id === 'undefined') && c.start_time && c.end_time && c.start_time !== '' && c.end_time !== '')
                .map(c => ({ start: c.start_time, end: c.end_time }))
        ];

        const barberAvailability = {};
        const finalAvailableTimes = [];
        const allBookedTimes = [];

        allTimeSlots.forEach(time => {
            // Check if globally blocked
            let isGloballyBlocked = false;
            for (let range of globalBlockedRanges) {
                if (isTimeInRange(time, range.start, range.end)) {
                    isGloballyBlocked = true;
                    break;
                }
            }

            if (isGloballyBlocked) return;

            const availableBarbersForSlot = [];

            numericTargetBarbers.forEach(bId => {
                const barberFullDayClosure = closedDates.find(c =>
                    (String(c.barber_id) === String(bId)) && ((!c.start_time && !c.end_time) || c.start_time === '' || c.end_time === '')
                );
                if (barberFullDayClosure) return;

                const barberBlockedRanges = closedDates.filter(c =>
                    (String(c.barber_id) === String(bId)) && c.start_time && c.end_time && c.start_time !== '' && c.end_time !== ''
                ).map(c => ({ start: c.start_time, end: c.end_time }));

                let isBarberBlocked = false;
                for (let range of barberBlockedRanges) {
                    if (isTimeInRange(time, range.start, range.end)) {
                        isBarberBlocked = true; break;
                    }
                }
                if (isBarberBlocked) return;

                const hourInt = parseInt(time.split(':')[0]);
                const targetDate = hourInt < 9 ? nextDayStr : date;

                const isBooked = bookings.some(b => b.appointment_date === targetDate && b.appointment_time.trim() === time && String(b.barber_id) === String(bId));
                if (isBooked) return;

                if (!availableBarbersForSlot.includes(Number(bId))) {
                    availableBarbersForSlot.push(Number(bId));
                }
            });

            if (availableBarbersForSlot.length > 0) {
                finalAvailableTimes.push(time);
                barberAvailability[time] = availableBarbersForSlot;
            } else {
                allBookedTimes.push(time);
            }
        });

        res.json({
            availableTimes: finalAvailableTimes,
            bookedTimes: allBookedTimes,
            allSlots: allTimeSlots,
            barberAvailability
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available time slots (batch)
app.get('/api/available-times-batch', async (req, res) => {
    try {
        const { barberId, dates } = req.query;
        if (!dates) return res.status(400).json({ error: 'Missing parameters' });

        const isAllBarbers = !barberId || barberId === 'all';
        let targetBarbers = [];
        let barbersData = [];
        if (isAllBarbers) {
            barbersData = await Barber.find({ active: true }).select('barber_id name working_hours');
            targetBarbers = barbersData.flatMap(b => [Number(b.barber_id), String(b.barber_id)]);
        } else {
            barbersData = await Barber.find({ barber_id: Number(barberId), active: true }).select('barber_id name working_hours');
            targetBarbers = [Number(barberId), String(barberId)];
        }
        const barbersMap = new Map(barbersData.map(b => [Number(b.barber_id), b]));

        const numericTargetBarbers = targetBarbers.map(Number).filter(n => !isNaN(n));

        const dateList = dates.split(',');
        const results = {};

        // Get working hours from Cache
        const cachedWorkingHoursBatch = await getCachedSetting('working_hours', null);
        const workingHours = cachedWorkingHoursBatch || {
            weekday: { start: '09:00', end: '20:00' },
            saturday: { start: '09:00', end: '22:00' },
            sunday: { closed: true },
            slotDuration: 60
        };

        const sundaySettings = workingHours.sunday || {};
        const isSundayClosed = String(sundaySettings.closed) === 'true';

        const minDate = dateList.reduce((min, d) => d < min ? d : min, dateList[0]);
        const maxDate = dateList.reduce((max, d) => d > max ? d : max, dateList[0]);

        const closedDates = await ClosedDate.find({
            start_date: { $lte: maxDate },
            end_date: { $gte: minDate }
        });

        const expandedDateList = [...new Set(dateList.flatMap(d => {
            const nextD = new Date(d);
            nextD.setDate(nextD.getDate() + 1);
            return [d, nextD.toISOString().split('T')[0]];
        }))];

        const bookings = await Booking.find({
            barber_id: { $in: targetBarbers },
            appointment_date: { $in: expandedDateList },
            status: { $ne: 'cancelled' }
        });

        const specialHoursList = await SpecialWorkingHours.find({
            date: { $in: dateList },
            barber_id: null
        });

        for (const date of dateList) {
            const [y, m, d] = date.split('-').map(Number);
            const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

            let startHour, endHour;
            let dayBreaks = [];
            const specialHours = specialHoursList.find(sh => sh.date === date);

            if (specialHours && specialHours.is_closed) {
                results[date] = { availableTimes: [], bookedTimes: [], isClosed: true, reason: 'Bugün kapalı (Özel ayar)', barberAvailability: {} };
                continue;
            }

            if (specialHours) {
                startHour = parseInt(specialHours.start?.split(':')[0]) || 9;
                endHour = parseInt(specialHours.end?.split(':')[0]) || 20;
                dayBreaks = specialHours.breaks || [];
            } else {
                if (dayOfWeek === 0 && isSundayClosed) {
                    results[date] = { availableTimes: [], bookedTimes: [], isClosed: true, reason: 'Pazar günü kapalı', barberAvailability: {} };
                    continue;
                }

                const h = workingHours;
                if (dayOfWeek === 0) {
                    startHour = parseInt(h.sunday?.start?.split(':')[0]) || 10;
                    endHour = parseInt(h.sunday?.end?.split(':')[0]) || 18;
                    dayBreaks = h.sunday?.breaks || [];
                } else if (dayOfWeek === 6) {
                    startHour = parseInt(h.saturday?.start?.split(':')[0]) || 9;
                    endHour = parseInt(h.saturday?.end?.split(':')[0]) || 22;
                    dayBreaks = h.saturday?.breaks || [];
                } else {
                    startHour = parseInt(h.weekday?.start?.split(':')[0]) || 9;
                    endHour = parseInt(h.weekday?.end?.split(':')[0]) || 20;
                    dayBreaks = h.weekday?.breaks || [];
                }
            }

            
            let minStartHour = 24;
            let maxEndHour = 0;
            let anyOpen = false;

            numericTargetBarbers.forEach(bId => {
                const barber = barbersMap.get(Number(bId));
                let bStartHour = startHour;
                let bEndHour = endHour;
                let bClosed = false;
                
                if (barber && barber.working_hours) {
                    let daySettings;
                    if (dayOfWeek === 0) daySettings = barber.working_hours.sunday;
                    else if (dayOfWeek === 6) daySettings = barber.working_hours.saturday;
                    else daySettings = barber.working_hours.weekday;

                    if (daySettings) {
                        if (String(daySettings.closed) === 'true') bClosed = true;
                        else {
                            if (daySettings.start) bStartHour = parseInt(daySettings.start.split(':')[0]);
                            if (daySettings.end) bEndHour = parseInt(daySettings.end.split(':')[0]);
                        }
                    }
                }
                if (!bClosed) {
                    anyOpen = true;
                    if (bStartHour < minStartHour) minStartHour = bStartHour;
                    let bEffEnd = bEndHour;
                    if (bEffEnd <= bStartHour && bEffEnd !== 0) bEffEnd += 24;
                    else if (bEffEnd === 0) bEffEnd = 24;
                    if (bEffEnd > maxEndHour) maxEndHour = bEffEnd;
                }
            });

            if (anyOpen) {
                startHour = minStartHour;
                endHour = maxEndHour;
            }

            const slotDuration = workingHours.slotDuration || 60;
            const allTimeSlots = [];
            let effectiveEndHour = endHour;

            // Customer Email
            if (customerEmail) {
                messages.push({
                    "From": { "Email": SENDER_EMAIL, "Name": "Hairlogy Yasin Premium" },
                    "To": [{ "Email": customerEmail, "Name": customerName }],
                    "Subject": "Randevunuz Onaylandı - Hairlogy Yasin Premium",
                    "HTMLPart": `
                        <h3>Sayın ${customerName},</h3>
                        <p>Randevunuz başarıyla oluşturulmuştur.</p>
                        <ul>
                            <li><strong>Berber:</strong> ${barberName}</li>
                            <li><strong>Hizmet:</strong> ${serviceName}</li>
                            <li><strong>Tarih:</strong> ${appointmentDate}</li>
                            <li><strong>Saat:</strong> ${appointmentTime}</li>
                        </ul>
                        <p>Teşekkür ederiz.</p>
                    `
                });
            }

            // Admin Email
            messages.push({
                "From": { "Email": SENDER_EMAIL, "Name": "Hairlogy Sistem" },
                "To": [{ "Email": SENDER_EMAIL, "Name": "Yönetici" }],
                "Subject": "Yeni Randevu - " + customerName,
                "HTMLPart": `
                    <h3>Yeni Randevu Alındı!</h3>
                    <ul>
                        <li><strong>Müşteri:</strong> ${customerName}</li>
                        <li><strong>Telefon:</strong> ${customerPhone}</li>
                        <li><strong>Berber:</strong> ${barberName}</li>
                        <li><strong>Hizmet:</strong> ${serviceName}</li>
                        <li><strong>Tarih:</strong> ${appointmentDate}</li>
                        <li><strong>Saat:</strong> ${appointmentTime}</li>
                    </ul>
                `
            });

            try {
                await mailjet.post('send', { 'version': 'v3.1' }).request({ "Messages": messages });
                console.log(`Emails sent for booking ${newBooking._id}`);
            } catch (err) {
                console.error('Failed to send emails:', err.message);
            }
        }

        res.status(201).json({ id: newBooking._id, message: 'Success' });
    } catch (error) {
        // Handle duplicate key error (race condition - same slot booked simultaneously)
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Bu saat dolu. Lütfen başka bir saat seçin.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ============ ADMIN ROUTES ============

app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await AdminUser.findOne({ username: username.toLowerCase() });

        if (!user) {
            // User not found
            // Using 401 with specific message is safer generally, but user asked for specific feedback
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }

        const isPasswordValid = bcrypt.compareSync(password, user.password);


        if (!isPasswordValid) {

            return res.status(401).json({ error: 'Şifre hatalı' });
        }

        const token = jwt.sign({
            userId: user._id,
            username: user.username,
            barber_id: user.barber_id
        }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ token, username: user.username, barber_id: user.barber_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/bookings', verifyToken, async (req, res) => {
    try {
        const { status, barberId, date, showAll } = req.query;
        const userBarberId = req.user?.barber_id;

        const filter = {};
        if (status) filter.status = status;
        if (date) filter.appointment_date = date;

        // Barber filter
        if (barberId) {
            filter.barber_id = { $in: [Number(barberId), String(barberId)] };
        } else if (userBarberId && showAll !== 'true') {
            filter.barber_id = { $in: [Number(userBarberId), String(userBarberId)] };
        }

        const bookings = await Booking.find(filter).sort({ appointment_date: -1, appointment_time: -1 }).limit(1000);

        // Auto-complete ONLY past confirmed bookings, don't loop through all history
        const now = new Date();
        const pastDateStr = now.toISOString().split('T')[0];
        const [hour, min] = [now.getHours(), now.getMinutes()];
        const pastTimeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

        // Find only those that need updating
        const bookingsToComplete = bookings.filter(b =>
            b.status === 'confirmed' &&
            (b.appointment_date < pastDateStr || (b.appointment_date === pastDateStr && b.appointment_time < pastTimeStr))
        );

        const updates = [];
        bookingsToComplete.forEach(b => {
            b.status = 'completed'; // Update for current request response
            updates.push(Booking.updateOne({ _id: b._id }, { status: 'completed' }));

            if (b.service_price) {
                // Check if revenue already exists
                updates.push((async () => {
                    const existingRevenue = await RevenueHistory.findOne({ booking_id: b._id.toString() });
                    if (!existingRevenue) {
                        await RevenueHistory.create({
                            booking_id: b._id.toString(),
                            barber_id: b.barber_id,
                            service_price: b.service_price,
                            appointment_date: b.appointment_date,
                            appointment_time: b.appointment_time,
                            customer_name: b.customer_name,
                            service_name: b.service_name
                        });
                    }
                })());
            }
        });

        if (updates.length > 0) await Promise.all(updates);

        res.json(bookings.map(b => ({ id: b._id, ...b.toObject() })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/bookings/:id', verifyToken, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ error: 'Not found' });
        res.json({ id: booking._id, ...booking.toObject() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/admin/bookings/:id', verifyToken, async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ error: 'Not found' });

        const oldStatus = booking.status;
        booking.status = status;
        booking.updated_at = Date.now();

        if (status === 'completed' && oldStatus !== 'completed' && oldStatus !== 'cancelled') {
            if (booking.service_price) {
                // Check if revenue already exists to prevent duplicates
                const existingRevenue = await RevenueHistory.findOne({ booking_id: booking._id.toString() });
                if (!existingRevenue) {
                    await RevenueHistory.create({
                        booking_id: booking._id.toString(),
                        barber_id: booking.barber_id,
                        service_price: booking.service_price,
                        appointment_date: booking.appointment_date,
                        appointment_time: booking.appointment_time,
                        customer_name: booking.customer_name,
                        service_name: booking.service_name
                    });
                }
            }
        }

        await booking.save();
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/bookings/:id/transfer', verifyToken, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ error: 'Randevu bulunamadı' });

        const currentBarberId = Number(booking.barber_id);
        const targetBarberId = currentBarberId === 1 ? 2 : 1;
        
        const targetBarber = await Barber.findOne({ barber_id: targetBarberId });
        if (!targetBarber) return res.status(404).json({ error: 'Hedef berber bulunamadı' });

        // Check if target barber is free
        const existing = await Booking.findOne({
            barber_id: targetBarberId,
            appointment_date: booking.appointment_date,
            appointment_time: booking.appointment_time,
            status: { $ne: 'cancelled' }
        });

        if (existing) {
            return res.status(400).json({ error: `${targetBarber.name} bu saatte dolu!` });
        }

        booking.barber_id = targetBarberId;
        booking.barber_name = targetBarber.name;
        booking.updated_at = Date.now();
        await booking.save();

        res.json({ message: `Randevu ${targetBarber.name} berberine aktarıldı`, targetBarber: targetBarber.name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Control: Toggle Maintenance Mode
app.post('/api/admin/settings/maintenance', verifyToken, async (req, res) => {
    try {
        const { value } = req.body;
        if (typeof value !== 'boolean') return res.status(400).json({ error: 'Value must be boolean' });

        await SystemSetting.findOneAndUpdate(
            { key: 'maintenance_mode' },
            { value, updated_at: Date.now() },
            { upsert: true }
        );
        res.json({ message: `Maintenance mode turned ${value ? 'ON' : 'OFF'}`, maintenanceMode: value });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ GENERAL SETTINGS ============

// Get all general settings (admin)
app.get('/api/admin/settings/general', verifyToken, async (req, res) => {
    try {
        const keys = ['booking_horizon', 'auto_confirm'];
        const settings = await SystemSetting.find({ key: { $in: keys } });
        const result = {};
        const defaults = {
            booking_horizon: 14,
            auto_confirm: true
        };
        keys.forEach(k => {
            const found = settings.find(s => s.key === k);
            result[k] = found ? found.value : defaults[k];
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update general settings (admin)
app.put('/api/admin/settings/general', verifyToken, async (req, res) => {
    try {
        const allowedKeys = ['booking_horizon', 'auto_confirm'];
        const updates = req.body;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedKeys.includes(key)) {
                await SystemSetting.findOneAndUpdate(
                    { key },
                    { value, updated_at: Date.now() },
                    { upsert: true }
                );
            }
        }
        res.json({ message: 'Settings updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Public: Get booking horizon (no auth needed)
app.get('/api/settings/booking-horizon', async (req, res) => {
    try {
        const setting = await SystemSetting.findOne({ key: 'booking_horizon' });
        res.json({ booking_horizon: setting?.value || 14 });
    } catch (error) {
        res.json({ booking_horizon: 14 });
    }
});

// Send reminder email for a booking
app.post('/api/admin/bookings/:id/reminder', verifyToken, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ error: 'Randevu bulunamadı' });

        if (!booking.customer_email) {
            return res.status(400).json({ error: 'Bu randevuda email adresi yok' });
        }

        if (!mailjet) {
            return res.status(500).json({ error: 'Email servisi yapılandırılmamış' });
        }

        await mailjet.post('send', { 'version': 'v3.1' }).request({
            "Messages": [{
                "From": { "Email": SENDER_EMAIL, "Name": "Hairlogy Yasin Premium" },
                "To": [{ "Email": booking.customer_email, "Name": booking.customer_name }],
                "Subject": "Randevu Hatırlatması - Hairlogy Yasin Premium",
                "HTMLPart": `
                    <h3>Sayın ${booking.customer_name},</h3>
                    <p>Randevunuzu hatırlatmak istiyoruz.</p>
                    <ul>
                        <li><strong>Berber:</strong> ${booking.barber_name}</li>
                        <li><strong>Hizmet:</strong> ${booking.service_name}</li>
                        <li><strong>Tarih:</strong> ${booking.appointment_date}</li>
                        <li><strong>Saat:</strong> ${booking.appointment_time}</li>
                    </ul>
                    <p>Sizi bekliyoruz!</p>
                `
            }]
        });

        booking.reminder_sent = true;
        booking.reminder_sent_at = new Date();
        await booking.save();

        res.json({ message: 'Hatırlatma emaili gönderildi' });
    } catch (error) {
        console.error('Reminder email error:', error.message);
        res.status(500).json({ error: 'Email gönderilemedi: ' + error.message });
    }
});

// Send daily report email
app.post('/api/admin/daily-report', verifyToken, async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.status(400).json({ error: 'Tarih gereklidir' });

        if (!mailjet) {
            return res.status(500).json({ error: 'Email servisi yapılandırılmamış' });
        }

        const bookings = await Booking.find({ appointment_date: date }).sort({ appointment_time: 1 });

        let tableRows = '';
        let totalRevenue = 0;
        bookings.forEach(b => {
            tableRows += `<tr>
                <td>${b.appointment_time}</td>
                <td>${b.customer_name}</td>
                <td>${b.customer_phone}</td>
                <td>${b.barber_name || '-'}</td>
                <td>${b.service_name}</td>
                <td>${b.service_price || 0}₺</td>
                <td>${b.status}</td>
            </tr>`;
            if (b.status !== 'cancelled') totalRevenue += (b.service_price || 0);
        });

        await mailjet.post('send', { 'version': 'v3.1' }).request({
            "Messages": [{
                "From": { "Email": SENDER_EMAIL, "Name": "Hairlogy Sistem" },
                "To": [{ "Email": SENDER_EMAIL, "Name": "Yönetici" }],
                "Subject": `Günlük Rapor - ${date} (${bookings.length} randevu)`,
                "HTMLPart": `
                    <h2>Günlük Rapor: ${date}</h2>
                    <p><strong>Toplam Randevu:</strong> ${bookings.length}</p>
                    <p><strong>Toplam Gelir:</strong> ${totalRevenue}₺</p>
                    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
                        <tr style="background:#333;color:#fff">
                            <th>Saat</th><th>Müşteri</th><th>Telefon</th><th>Berber</th><th>Hizmet</th><th>Fiyat</th><th>Durum</th>
                        </tr>
                        ${tableRows}
                    </table>
                `
            }]
        });

        res.json({ message: 'Rapor gönderildi', totalBookings: bookings.length, totalRevenue });
    } catch (error) {
        console.error('Daily report error:', error.message);
        res.status(500).json({ error: 'Rapor gönderilemedi: ' + error.message });
    }
});

// Cleanup logic (Disabled as per request)
async function cleanupOldBookings() {
    // try {
    //     const twoWeeksAgo = new Date();
    //     twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    //     const dateStr = twoWeeksAgo.toISOString().split('T')[0];
    //     // Only delete completed or cancelled old bookings
    //     const result = await Booking.deleteMany({
    //         appointment_date: { $lt: dateStr },
    //         status: { $in: ['completed', 'cancelled'] }
    //     });
    //     if (result.deletedCount > 0) console.log(\`Cleaned up \${result.deletedCount} old bookings\`);
    // } catch (err) {
    //     console.error('Cleanup error:', err);
    // }
}

function scheduleCleanup() {
    // cleanupOldBookings();
    // setInterval(cleanupOldBookings, 24 * 60 * 60 * 1000);
}

// All other GET requests not handled before will return our React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});
