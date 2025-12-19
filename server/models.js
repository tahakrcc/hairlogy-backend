import mongoose from 'mongoose';

const barberSchema = new mongoose.Schema({
    barber_id: Number, // Compatibility with existing system (1 or 2)
    name: { type: String, required: true },
    experience: String,
    specialty: String,
    image_url: String,
    active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    duration: Number,
    price: Number,
    active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const adminUserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    barber_id: mongoose.Schema.Types.Mixed // Can be number or ObjectId string
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const bookingSchema = new mongoose.Schema({
    barber_id: { type: mongoose.Schema.Types.Mixed, required: true },
    barber_name: String,
    service_name: { type: String, required: true },
    service_price: Number,
    customer_name: { type: String, required: true },
    customer_phone: { type: String, required: true },
    customer_email: String,
    appointment_date: { type: String, required: true }, // YYYY-MM-DD
    appointment_time: { type: String, required: true }, // HH:mm
    device_token: String,
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'confirmed'
    },
    reminder_sent: { type: Boolean, default: false },
    reminder_scheduled: { type: Boolean, default: true },
    reminder_sent_at: Date
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const closedDateSchema = new mongoose.Schema({
    start_date: { type: String, required: true }, // YYYY-MM-DD
    end_date: { type: String, required: true }, // YYYY-MM-DD
    reason: String,
    created_by: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const deviceTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    booking_count: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const revenueHistorySchema = new mongoose.Schema({
    booking_id: String,
    barber_id: mongoose.Schema.Types.Mixed,
    service_price: Number,
    appointment_date: String,
    appointment_time: String,
    customer_name: String,
    service_name: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const systemSettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const Barber = mongoose.model('Barber', barberSchema);
export const Service = mongoose.model('Service', serviceSchema);
export const AdminUser = mongoose.model('AdminUser', adminUserSchema);
export const Booking = mongoose.model('Booking', bookingSchema);
export const ClosedDate = mongoose.model('ClosedDate', closedDateSchema);
export const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);
export const RevenueHistory = mongoose.model('RevenueHistory', revenueHistorySchema);
export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
