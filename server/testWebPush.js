import mongoose from 'mongoose';
import webpush from 'web-push';

const MONGODB_URI = 'mongodb+srv://ollamataha_db_user:689689tk@taha.karnmcv.mongodb.net/?appName=taha';

const VAPID_PUBLIC_KEY = 'BPVeG5kVqQfGdUrNpqjH8VuiWQCpatyh48LtS9apEBnu37iP_iPL2W9sYF6S3-n4OHmm8uDmZyXmrzG5dQiHovM';
const VAPID_PRIVATE_KEY = 'xeLdj8anR8PRnPjO-RMr0UPmLtHqD8Knh09_lk0Mr-w';

webpush.setVapidDetails(
    'mailto:hairlogyyasin@gmail.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

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
            
            const payload = {
                title: 'Lokal Test 🚀',
                body: 'Bu doğrudan yerel makineden gönderildi.',
                icon: '/icon-192.png'
            };
            
            console.log('Sending push to endpoint:', subs[0].subscription.endpoint);
            
            try {
                const result = await webpush.sendNotification(subs[0].subscription, JSON.stringify(payload));
                console.log('Success!', result.statusCode);
            } catch (pushErr) {
                console.error('Push error:', pushErr);
            }
        } else {
            console.log('No subscriptions found in DB!');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkSub();
