const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'index-mongodb.js');
let content = fs.readFileSync(filePath, 'utf8');

const injectionCode = `
// Test push notification endpoint
app.post('/api/test-push', async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
        
        await sendPushNotification({
            title: 'Test Bildirimi 🚀',
            body: 'Bildirimleriniz sorunsuz çalışıyor!',
            icon: '/icon-192.png'
        }, deviceId);
        
        res.json({ message: 'Push sent to ' + deviceId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
`;

const targetString = '// Push notification helper function';

if (content.includes(targetString) && !content.includes('/api/test-push')) {
    content = content.replace(targetString, injectionCode + '\n' + targetString);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully injected test-push endpoint');
} else {
    console.log('Injection failed or already injected');
}
