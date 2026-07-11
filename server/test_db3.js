import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({}, { strict: false, collection: 'bookings' });
const Booking = mongoose.model('Booking', bookingSchema);
const RevenueHistorySchema = new mongoose.Schema({}, { strict: false, collection: 'revenuehistory' });
const RevenueHistory = mongoose.model('RevenueHistory', RevenueHistorySchema);

async function run() {
  await mongoose.connect('mongodb+srv://ollamataha_db_user:689689tk@taha.karnmcv.mongodb.net/test?appName=taha');
  console.log('Connected');
  
  const trends = await RevenueHistory.aggregate([
                  {
                      $group: {
                          _id: { date: '$appointment_date', barberId: '$barber_id' },
                          revenue: { $sum: '$service_price' },
                          count: { $sum: 1 }
                      }
                  },
                  { $sort: { '_id.date': 1 } }
              ]);
  console.log('Trends sample:', trends[0]);

  const bookingTrends = await Booking.aggregate([
                  {
                      $group: {
                          _id: '$appointment_date',
                          count: { $sum: 1 }
                      }
                  },
                  { $sort: { _id: 1 } }
              ]);
  console.log('BookingTrends sample:', bookingTrends[0]);
  
  mongoose.disconnect();
}
run().catch(console.error);
