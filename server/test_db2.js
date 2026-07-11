import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({}, { strict: false, collection: 'bookings' });
const Booking = mongoose.model('Booking', bookingSchema);

async function run() {
  await mongoose.connect('mongodb+srv://ollamataha_db_user:689689tk@taha.karnmcv.mongodb.net/test?appName=taha');
  console.log('Connected');
  
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
  console.log('Customers typeof:', typeof customers);
  console.log('Customers isArray:', Array.isArray(customers));
  console.log('Customers length:', customers.length);
  
  mongoose.disconnect();
}
run().catch(console.error);
