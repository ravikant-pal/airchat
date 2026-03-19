/**
 * src/sw.js — Custom Service Worker
 *
 * VitePWA injectManifest strategy:
 *  - Workbox injects precache manifest into self.__WB_MANIFEST
 *  - We add push + notificationclick on top
 *  - VitePWA compiles this → public/sw.js on build
 */

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

// Workbox precache — handles app shell caching (injected by VitePWA)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'AirChat', body: 'New message' };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'AirChat', {
      body: payload.body || 'You have a new message',
      icon: '/airchat/web-app-manifest-192x192.png',
      badge: '/airchat/favicon-96x96.png',
      tag: payload.tag || 'airchat', // collapses multiple from same peer
      renotify: true,
      data: payload.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const pubkey = event.notification.data?.pubkey;
  const url = pubkey ? `/airchat/?chat=${pubkey}` : '/airchat/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        // App already open — focus and tell it which chat to open
        for (const win of wins) {
          if (win.url.includes('/airchat') && 'focus' in win) {
            win.focus();
            if (pubkey) win.postMessage({ type: 'OPEN_CHAT', pubkey });
            return;
          }
        }
        // App closed — open it
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
