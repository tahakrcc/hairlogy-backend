const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'index-mongodb.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add deviceId to destructuring
const target1 = "const { barberId, barberName, serviceName, servicePrice, customerName, customerPhone, customerEmail, appointmentDate, appointmentTime, deviceToken } = req.body;";
const replace1 = "const { barberId, barberName, serviceName, servicePrice, customerName, customerPhone, customerEmail, appointmentDate, appointmentTime, deviceToken, deviceId } = req.body;";

if (content.includes(target1)) {
    content = content.replace(target1, replace1);
    console.log('Fixed target 1');
}

// 2. Add deviceId to Booking.create and call sendPushNotification
const target2 = `            appointment_date: actualAppointmentDate,
            appointment_time: appointmentTime,
            device_token: deviceToken,
            status: 'confirmed'
        });`;

const replace2 = `            appointment_date: actualAppointmentDate,
            appointment_time: appointmentTime,
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

if (content.includes(target2)) {
    content = content.replace(target2, replace2);
    console.log('Fixed target 2');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched index-mongodb.js for booking push notifications');
