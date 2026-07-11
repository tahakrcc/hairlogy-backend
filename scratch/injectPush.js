const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'index-mongodb.js');
let content = fs.readFileSync(filePath, 'utf8');

const injectionCode = `
// Push notification helper function
async function sendPushNotification(payload, deviceId = null) {
    try {
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            console.warn('VAPID keys not set. Skipping push notification.');
            return;
        }

        let subscriptions = [];
        if (deviceId) {
            subscriptions = await mongoose.model('PushSubscription').find({ deviceId });
        } else {
            console.warn('No deviceId provided for push notification.');
            return;
        }

        for (const sub of subscriptions) {
            try {
                const webpush = require('web-push');
                await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
            } catch (err) {
                console.error(\`Error sending push to device \${sub.deviceId}:\`, err.message);
                if (err.statusCode === 410) { // Gone (unsubscribed)
                    await mongoose.model('PushSubscription').deleteOne({ _id: sub._id });
                }
            }
        }
    } catch (err) {
        console.error('sendPushNotification error:', err);
    }
}
`;

const targetString = '// All other GET requests not handled before will return our React app';

if (content.includes(targetString) && !content.includes('async function sendPushNotification')) {
    content = content.replace(targetString, injectionCode + '\n' + targetString);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully injected sendPushNotification');
} else {
    console.log('Injection failed or already injected');
}
