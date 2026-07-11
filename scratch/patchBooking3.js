const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'index-mongodb.js');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /device_token:\s*deviceToken,[\s\r\n]*status:\s*'confirmed'[\s\r\n]*\}\);/g;

if (regex.test(content)) {
    content = content.replace(regex, `device_token: deviceToken,
            deviceId: deviceId,
            status: 'confirmed'
        });

        // Send Push Notification to Customer
        if (deviceId) {
            sendPushNotification({
                title: 'Randevunuz Onaylandı! ✅',
                body: \`Sayın \${customerName}, \${appointmentDate} \${appointmentTime} tarihindeki randevunuz başarıyla oluşturuldu.\`,
                icon: '/icon-192.png'
            }, deviceId);
        }`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched index-mongodb.js with regex');
} else {
    console.log('Regex did not match');
}
