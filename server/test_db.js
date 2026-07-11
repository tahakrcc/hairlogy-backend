import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const bookingSchema = new mongoose.Schema({}, { strict: false, collection: 'bookings' });
const Booking = mongoose.model('Booking', bookingSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
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
  console.log('Customers count:', customers.length);
  console.log('First customer:', customers[0]);
  
  mongoose.disconnect();
}
run().catch(console.error);
