import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Mailjet = require('node-mailjet');
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
    SystemSetting
} from './models.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
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
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
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
                    experience: '15+ Yıl Deneyim',
                    specialty: 'Klasik & Modern Kesimler',
                    image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
                    active: true
                },
                {
                    barber_id: 2,
                    name: 'Emir Gökçeoğlu',
                    experience: '10+ Yıl Deneyim',
                    specialty: 'Fade & Sakal Tasarımı',
                    image_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
                    active: true
                }
            ];
            await Barber.insertMany(defaultBarbers);
            console.log('Default barbers created');
        }

        // Default Services
        const servicesCount = await Service.countDocuments();
        if (servicesCount === 0) {
            const defaultServices = [
                { name: 'Saç Kesimi', duration: 30, price: 150, active: true },
                { name: 'Saç ve Sakal', duration: 45, price: 200, active: true },
                { name: 'Sakal', duration: 20, price: 100, active: true },
                { name: 'Çocuk Tıraşı', duration: 25, price: 120, active: true },
                { name: 'Bakım/Mask', duration: 30, price: 180, active: true }
            ];
            await Service.insertMany(defaultServices);
            console.log('Default services created');
        }

        // Admin Users (yasin, emir, admin)
        const admins = [
            { username: 'yasin', password: 'Yasin@2025!', barber_id: 1 },
            { username: 'emir', password: 'emir01tk', barber_id: 2 },
            { username: 'admin', password: 'admin123' }
        ];

        for (const admin of admins) {
            const existingUser = await AdminUser.findOne({ username: admin.username });
            // Update if user doesn't exist OR if we want to enforce password reset (optional, but good for now)
            // To avoid re-hashing every restart, we could check, but for now enforcing is safer for the user request
            const hashedPassword = bcrypt.hashSync(admin.password, 10);

            await AdminUser.findOneAndUpdate(
                { username: admin.username },
                {
                    password: hashedPassword,
                    barber_id: admin.barber_id
                },
                { upsert: true }
            );
        }
        console.log('Admin users initialized/updated');

        // Default System Settings
        const maintenanceSetting = await SystemSetting.findOne({ key: 'maintenance_mode' });
        if (!maintenanceSetting) {
            await SystemSetting.create({ key: 'maintenance_mode', value: false });
            console.log('Default maintenance mode setting created (OFF)');
        }

        console.log('Database initialization completed');
        scheduleCleanup();
    } catch (error) {
        console.error('Database initialization error:', error);
    }
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

// ============ PUBLIC ROUTES ============

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

// Get available time slots
app.get('/api/available-times', async (req, res) => {
    try {
        const { barberId, date } = req.query;

        if (!barberId || !date) {
            return res.status(400).json({ error: 'barberId and date are required' });
        }

        // Check closed dates
        const checkDate = new Date(date);

        // Safer day detection: Parse YYYY-MM-DD manually to avoid any timezone ambiguity
        const [y, m, d] = date.split('-').map(Number);
        // Create UTC date: month is 0-indexed
        const utcDate = new Date(Date.UTC(y, m - 1, d));
        const dayOfWeek = utcDate.getUTCDay();

        const closedDate = await ClosedDate.findOne({
            start_date: { $lte: date },
            end_date: { $gte: date }
        });

        if (closedDate) {
            return res.json({
                availableTimes: [],
                bookedTimes: [],
                isClosed: true,
                reason: closedDate.reason || 'Tatil günü'
            });
        }

        const bookings = await Booking.find({
            barber_id: { $in: [Number(barberId), String(barberId)] },
            appointment_date: date,
            status: { $ne: 'cancelled' }
        });

        const bookedTimes = bookings.map(b => b.appointment_time.trim());

        // Time slots logic
        const allTimeSlots = [
            '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
        ];
        // If it's Saturday (dayOfWeek === 6), add 21:00 and 22:00
        if (dayOfWeek === 6) allTimeSlots.push('21:00', '22:00');

        const breakTimeSlots = ['16:00'];
        const availableTimes = allTimeSlots.filter(time =>
            !breakTimeSlots.includes(time) && !bookedTimes.includes(time)
        );

        res.json({ availableTimes, bookedTimes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available time slots (batch)
app.get('/api/available-times-batch', async (req, res) => {
    try {
        const { barberId, dates } = req.query;
        if (!barberId || !dates) return res.status(400).json({ error: 'Missing parameters' });

        const dateList = dates.split(',');
        const results = {};

        const closedDates = await ClosedDate.find({
            $or: dateList.map(date => ({
                start_date: { $lte: date },
                end_date: { $gte: date }
            }))
        });

        const bookings = await Booking.find({
            barber_id: { $in: [Number(barberId), String(barberId)] },
            appointment_date: { $in: dateList },
            status: { $ne: 'cancelled' }
        });

        for (const date of dateList) {
            const isClosed = closedDates.some(cd => date >= cd.start_date && date <= cd.end_date);
            if (isClosed) {
                results[date] = { availableTimes: [], bookedTimes: [], isClosed: true };
                continue;
            }

            const bookedTimes = bookings
                .filter(b => b.appointment_date === date)
                .map(b => b.appointment_time.trim());

            const allTimeSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

            // Safer day detection
            const [y, m, d] = date.split('-').map(Number);
            const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

            if (dayOfWeek === 6) allTimeSlots.push('21:00', '22:00');

            const availableTimes = allTimeSlots.filter(time => time !== '16:00' && !bookedTimes.includes(time));
            results[date] = { availableTimes, bookedTimes, isClosed: false };
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create booking
app.post('/api/bookings', async (req, res) => {
    try {
        const { barberId, barberName, serviceName, servicePrice, customerName, customerPhone, customerEmail, appointmentDate, appointmentTime, deviceToken } = req.body;

        if (!barberId || !serviceName || !customerName || !customerPhone || !appointmentDate || !appointmentTime) {
            return res.status(400).json({ error: 'Missing fields' });
        }

        // Break time check
        if (appointmentTime.trim() === '16:00') return res.status(400).json({ error: 'Yemek molası' });

        // Device token limit check
        if (deviceToken) {
            let tokenDoc = await DeviceToken.findOne({ token: deviceToken });
            const now = new Date();
            if (tokenDoc) {
                const hoursSinceUpdate = (now - tokenDoc.updated_at) / (1000 * 60 * 60);
                if (hoursSinceUpdate >= 3) {
                    tokenDoc.booking_count = 1;
                } else if (tokenDoc.booking_count >= 2) {
                    return res.status(429).json({ error: 'Maksimum randevu hakkı doldu.' });
                } else {
                    tokenDoc.booking_count += 1;
                }
                await tokenDoc.save();
            } else {
                await DeviceToken.create({ token: deviceToken, booking_count: 1 });
            }
        }

        // Availability check
        const existing = await Booking.findOne({
            barber_id: barberId,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            status: { $ne: 'cancelled' }
        });

        if (existing) return res.status(400).json({ error: 'Bu saat dolu' });

        const newBooking = await Booking.create({
            barber_id: barberId,
            barber_name: barberName,
            service_name: serviceName,
            service_price: servicePrice,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            device_token: deviceToken,
            status: 'confirmed'
        });

        // Send email notification
        // Send email notification (Customer & Admin)
        if (mailjet) {
            const messages = [];

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
        res.status(500).json({ error: error.message });
    }
});

// ============ ADMIN ROUTES ============

app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await AdminUser.findOne({ username: new RegExp(`^${username}$`, 'i') });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
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

        const bookings = await Booking.find(filter).sort({ appointment_date: -1, appointment_time: -1 });

        // Auto-complete past bookings
        const now = new Date();
        const updates = [];
        bookings.forEach(b => {
            if (b.status === 'confirmed') {
                const [year, month, day] = b.appointment_date.split('-').map(Number);
                const [hour, min] = b.appointment_time.split(':').map(Number);
                const appDate = new Date(year, month - 1, day, hour, min);
                if (appDate < now) {
                    b.status = 'completed';
                    updates.push(Booking.updateOne({ _id: b._id }, { status: 'completed' }));
                    if (b.service_price) {
                        updates.push(RevenueHistory.create({
                            booking_id: b._id,
                            barber_id: b.barber_id,
                            service_price: b.service_price,
                            appointment_date: b.appointment_date,
                            appointment_time: b.appointment_time,
                            customer_name: b.customer_name,
                            service_name: b.service_name
                        }));
                    }
                }
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
                await RevenueHistory.create({
                    booking_id: booking._id,
                    barber_id: booking.barber_id,
                    service_price: booking.service_price,
                    appointment_date: booking.appointment_date,
                    appointment_time: booking.appointment_time,
                    customer_name: booking.customer_name,
                    service_name: booking.service_name
                });
            }
        }

        await booking.save();
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

        const totalBookings = await Booking.countDocuments(filter);
        const bookingsByStatus = await Booking.aggregate([
            { $match: filter },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const today = new Date().toISOString().split('T')[0];
        const todayBookings = await Booking.countDocuments({ ...filter, appointment_date: today });

        const revenueRecords = await RevenueHistory.find(filter);

        // Filter out non-ObjectId strings to prevent CastError in $nin query
        // Some revenue records might reference old Firebase string IDs
        const revenueBookingIds = revenueRecords
            .map(r => r.booking_id)
            .filter(id => mongoose.Types.ObjectId.isValid(id));

        const activeBookings = await Booking.find({
            ...filter,
            status: 'confirmed',
            _id: { $nin: revenueBookingIds }
        });

        const totalRevenue = revenueRecords.reduce((sum, r) => sum + (r.service_price || 0), 0) +
            activeBookings.reduce((sum, b) => sum + (b.service_price || 0), 0);

        const trends = await RevenueHistory.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: { date: '$appointment_date', barberId: '$barber_id' },
                    revenue: { $sum: '$service_price' }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        res.json({
            totalBookings,
            bookingsByStatus: bookingsByStatus.map(s => ({ status: s._id, count: s.count })),
            todayBookings,
            totalRevenue,
            trends
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/closed-dates', verifyToken, async (req, res) => {
    try {
        const dates = await ClosedDate.find().sort({ start_date: 1 });
        res.json(dates.map(d => ({ id: d._id, ...d.toObject() })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/closed-dates', verifyToken, async (req, res) => {
    try {
        const { start_date, end_date, reason } = req.body;
        const newDate = await ClosedDate.create({
            start_date,
            end_date,
            reason,
            created_by: req.user.username
        });
        res.json({ id: newDate._id, message: 'Created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/closed-dates/:id', verifyToken, async (req, res) => {
    try {
        await ClosedDate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
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

// Cleanup logic
async function cleanupOldBookings() {
    try {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const dateStr = twoWeeksAgo.toISOString().split('T')[0];
        const result = await Booking.deleteMany({ appointment_date: { $lt: dateStr } });
        if (result.deletedCount > 0) console.log(`Cleaned up ${result.deletedCount} old bookings`);
    } catch (err) {
        console.error('Cleanup error:', err);
    }
}

function scheduleCleanup() {
    cleanupOldBookings();
    setInterval(cleanupOldBookings, 24 * 60 * 60 * 1000);
}

// All other GET requests not handled before will return our React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Server (MongoDB) running on port ${PORT}`));
