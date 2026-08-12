// Firebase Messaging Service Worker for FCM Background Push Notifications
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Fetch config from firebase-applet-config or default fallback
fetch('/firebase-applet-config.json')
  .then(res => res.json())
  .then(config => {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message: ', payload);
      const notificationTitle = payload.notification?.title || payload.data?.title || '🚨 READY ALERT EMERGENCY';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Earthquake activity or alert broadcasted.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [300, 100, 300, 100, 500],
        requireInteraction: true,
        tag: 'readyalert-bg-push',
        data: payload.data
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  })
  .catch(err => {
    console.warn('FCM SW config load error:', err);
  });

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
