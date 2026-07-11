import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();

// Handle Push Notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: 'Yeni Bildirim', body: event.data.text() };
    }

    const options = {
        body: data.body,
        icon: data.icon || '/Gemini_Generated_Image_ii78ufii78ufii78.png',
        badge: '/Gemini_Generated_Image_ii78ufii78ufii78.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle Notification Clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(event.notification.data.url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});
