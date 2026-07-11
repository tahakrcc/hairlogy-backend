const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://ollamataha_db_user:689689tk@taha.karnmcv.mongodb.net/?appName=taha';

const pushSubscriptionSchema = new mongoose.Schema({
    deviceId: String,
    subscription: mongoose.Schema.Types.Mixed,
    createdAt: Date
});

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

async function checkSub() {
    try {
        await mongoose.connect(MONGODB_URI);
        const subs = await PushSubscription.find().sort({ createdAt: -1 }).limit(1);
        if (subs.length > 0) {
            console.log('Found subscription:', subs[0].deviceId);
            
            // Try to trigger the test push endpoint
            const res = await fetch('https://hairlogy-backend-8jfe.onrender.com/api/test-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: subs[0].deviceId })
            });
            const data = await res.text();
            console.log('Test push response:', res.status, data);
        } else {
            console.log('No subscriptions found in DB!');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        mongoose.disconnect();
    }
}

checkSub();
