const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'index-mongodb.js');
let content = fs.readFileSync(filePath, 'utf8');

const target2 = `            appointment_time: appointmentTime,
            device_token: deviceToken,
            status: 'confirmed'
        });`;

const replace2 = `            appointment_time: appointmentTime,
            device_token: deviceToken,
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
        }`;

// Replace ignoring spaces/CRLF differences
const contentLines = content.split('\\n');
let replaced = false;
for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].includes("status: 'confirmed'") && contentLines[i-1].includes("device_token: deviceToken")) {
        contentLines[i-1] = "            device_token: deviceToken,\\n            deviceId: deviceId,";
        contentLines[i+1] = contentLines[i+1] + `\\n\\n        // Send Push Notification to Customer\\n        if (deviceId) {\\n            sendPushNotification({\\n                title: 'Randevunuz Onaylandı! ✅',\\n                body: \\\`Sayın \${customerName}, \${appointmentDate} \${appointmentTime} tarihindeki randevunuz başarıyla oluşturuldu.\\\`,\\n                icon: '/icon-192.png'\\n            }, deviceId);\\n        }`;
        replaced = true;
        break;
    }
}

if (replaced) {
    fs.writeFileSync(filePath, contentLines.join('\\n'), 'utf8');
    console.log('Fixed target 2 successfully via line-by-line');
} else {
    console.log('Target 2 not found');
}
