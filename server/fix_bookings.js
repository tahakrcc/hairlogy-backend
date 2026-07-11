import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://ollamataha_db_user:689689tk@taha.karnmcv.mongodb.net/?appName=taha';

async function fixBookings() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    
    // Find all bookings with barber_id = 0
    const brokenBookings = await bookingsCollection.find({ barber_id: 0 }).toArray();
    console.log(`Found ${brokenBookings.length} bookings with barber_id = 0`);
    
    for (const booking of brokenBookings) {
        // Assign to barber 1 (first available)
        const result = await bookingsCollection.updateOne(
            { _id: booking._id },
            { $set: { barber_id: 1, barber_name: 'Yasin' } }
        );
        console.log(`Fixed booking ${booking._id}: ${booking.customer_name} (${booking.appointment_date} ${booking.appointment_time}) -> barber_id: 1`);
    }
    
    console.log('Done fixing bookings!');
    await mongoose.disconnect();
}

fixBookings().catch(console.error);
