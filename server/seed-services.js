import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Service } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
}

const premiumServices = [
    { name: 'VIP Hizmet (Cilt bakımı, keratinli saç bakımı maskesi, profesyonel masaj)', duration: 90, price: 2500, active: true },
    { name: 'Saç Kesimi + Yıkama + Fön', duration: 45, price: 500, active: true },
    { name: 'Profesyonel Buharlı Cilt Bakımı', duration: 45, price: 500, active: true },
    { name: 'VIP House Tıraş', duration: 120, price: 5000, active: true },
    { name: 'Buharlı Keratinli Saç Bakım Maskesi', duration: 45, price: 500, active: true }
];

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check current services
        const currentServices = await Service.find();
        console.log(`Current services count: ${currentServices.length}`);

        // Update or Insert logic
        for (const service of premiumServices) {
            const existing = await Service.findOne({ name: service.name });
            if (existing) {
                console.log(`Updating existing service: ${service.name}`);
                await Service.updateOne({ _id: existing._id }, service);
            } else {
                console.log(`Creating new service: ${service.name}`);
                await Service.create(service);
            }
        }

        console.log('Seed completed successfully!');
    } catch (error) {
        console.error('Seed error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seed();
