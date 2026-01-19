
import mongoose from 'mongoose';
import { Barber } from './models.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kuafor';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        const barbers = await Barber.find({});
        console.log('Barbers:');
        barbers.forEach(b => {
            console.log(`ID: ${b._id}, Name: ${b.name}, BarberID: ${b.barber_id}`);
        });
        await mongoose.disconnect();
    })
    .catch(err => console.error(err));
