import admin from 'firebase-admin';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import {
    Barber,
    Service,
    AdminUser,
    Booking,
    ClosedDate,
    DeviceToken,
    RevenueHistory
} from './models.js';

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
}

// Initialize Firebase
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Helper to migrate collection
        const migrateCollection = async (firebaseColl, MongoModel, transform = (data) => data) => {
            console.log(`Migrating ${firebaseColl}...`);
            const snapshot = await db.collection(firebaseColl).get();
            const docs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Ensure ID is handled if needed
                docs.push(transform({ ...data, firebase_id: doc.id }));
            });

            if (docs.length > 0) {
                // Clear existing or avoid duplicates? 
                // Let's clear to have a fresh start with firebase data
                await MongoModel.deleteMany({});
                await MongoModel.insertMany(docs);
                console.log(`${firebaseColl} migrated: ${docs.length} items`);
            } else {
                console.log(`${firebaseColl} is empty in Firebase`);
            }
        };

        // 1. Barbers
        await migrateCollection('barbers', Barber, (data) => ({
            barber_id: data.id || (data.name?.includes('Hıdır') ? 1 : 2),
            name: data.name,
            experience: data.experience,
            specialty: data.specialty,
            image_url: data.image_url,
            active: data.active !== undefined ? data.active : true
        }));

        // 2. Services
        await migrateCollection('services', Service, (data) => ({
            name: data.name,
            duration: data.duration,
            price: data.price,
            active: data.active !== undefined ? data.active : true
        }));

        // 3. Admin Users
        await migrateCollection('admin_users', AdminUser, (data) => ({
            username: data.username,
            password: data.password,
            barber_id: data.barber_id,
            created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at
        }));

        // 4. Bookings
        await migrateCollection('bookings', Booking, (data) => ({
            barber_id: data.barber_id,
            barber_name: data.barber_name,
            service_name: data.service_name,
            service_price: data.service_price,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            customer_email: data.customer_email,
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            device_token: data.device_token,
            status: data.status,
            created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
            updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at
        }));

        // 5. Closed Dates
        await migrateCollection('closed_dates', ClosedDate, (data) => ({
            start_date: data.start_date,
            end_date: data.end_date,
            reason: data.reason,
            created_by: data.created_by,
            created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at
        }));

        // 6. Device Tokens
        await migrateCollection('device_tokens', DeviceToken, (data) => ({
            token: data.token,
            booking_count: data.booking_count,
            created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
            updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at
        }));

        // 7. Revenue History
        await migrateCollection('revenue_history', RevenueHistory, (data) => ({
            booking_id: data.booking_id,
            barber_id: data.barber_id,
            service_price: data.service_price,
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            customer_name: data.customer_name,
            service_name: data.service_name,
            created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at
        }));

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

migrate();
