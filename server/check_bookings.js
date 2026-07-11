import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://ollamataha_db_user:689689tk@taha.karnmcv.mongodb.net/?appName=taha';

async function checkBookings() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Find bookings collection
    const bookingsCollection = db.collection('bookings');
    
    // Get all bookings
    const allBookings = await bookingsCollection.find({}).toArray();
    console.log(`\nTotal bookings: ${allBookings.length}`);
    
    allBookings.forEach(b => {
        console.log(`  ID: ${b._id}, Date: ${b.appointment_date}, Time: ${b.appointment_time}, Barber ID: ${b.barber_id}, Customer: ${b.customer_name}, Status: ${b.status}`);
    });
    
    // Specifically check August 10 bookings
    const aug10 = await bookingsCollection.find({ appointment_date: '2026-08-10' }).toArray();
    console.log(`\nAugust 10 bookings: ${aug10.length}`);
    aug10.forEach(b => {
        console.log(`  ID: ${b._id}, Time: ${b.appointment_time}, Barber ID: ${b.barber_id} (type: ${typeof b.barber_id}), Customer: ${b.customer_name}, Status: ${b.status}`);
    });
    
    await mongoose.disconnect();
}

checkBookings().catch(console.error);
