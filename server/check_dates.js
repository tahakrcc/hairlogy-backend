
import mongoose from 'mongoose';
import { ClosedDate } from './models.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kuafor';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        const dates = await ClosedDate.find({});
        console.log('Closed Dates:');
        dates.forEach(d => {
            console.log(`ID: ${d._id}, Start: ${d.start_date}, End: ${d.end_date}, BarberID: ${d.barber_id} (Type: ${typeof d.barber_id})`);
        });
        await mongoose.disconnect();
    })
    .catch(err => console.error(err));
