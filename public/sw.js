// Service Worker for Ready Alert Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push events (for Web Push / Server-sent triggers)
self.addEventListener('push', (event) => {
  let data = { title: 'READY ALERT - EMERGENCY', body: 'Earthquake alert triggered!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Earthquake shaking or status update detected.',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [300, 100, 300, 100, 400],
    tag: 'earthquake-alert',
    requireInteraction: true,
    data: {
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'READY ALERT', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' || client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
