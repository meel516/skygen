// Push Service Worker for video render notifications
// This file must be in the public folder to be accessible at /push-sw.js

self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    console.log('[Push SW] Received push:', data);

    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: data.badge || '/icon.png',
      vibrate: [100, 50, 100],
      data: data.data,
      actions: [
        {
          action: 'download',
          title: 'Download Video'
        },
        {
          action: 'open',
          title: 'Open App'
        }
      ],
      tag: 'video-render-notification',
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('[Push SW] Error parsing push data:', error);
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Push SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'download' || !event.action) {
    // Open the app - the notification data contains jobId
    const jobId = event.notification.data?.jobId;
    const url = jobId ? `/?download=${jobId}` : '/';
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});

self.addEventListener('message', function(event) {
  console.log('[Push SW] Message received:', event.data);
});

console.log('[Push SW] Service worker loaded');
