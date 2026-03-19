/**
 * notificationService.js
 *
 * Handles Web Push subscription registration on the client side.
 * Call registerPushNotifications() once on app load (in NostrContext).
 *
 * Flow:
 *  1. Ask user for notification permission
 *  2. Register Service Worker (sw.js)
 *  3. Subscribe to Web Push via browser
 *  4. POST subscription + nostr pubkey to your push server
 *
 * After this: push server listens on Nostr relays and wakes the app
 * via the browser's push infrastructure when a DM arrives.
 */

const PUSH_SERVER =
  import.meta.env.VITE_PUSH_SERVER_URL || 'https://airpush.onrender.com';

export async function registerPushNotifications(nostrPubkey) {
  try {
    // 1. Check support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[push] not supported in this browser');
      return false;
    }

    // 2. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[push] permission denied');
      return false;
    }

    // 3. Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // 4. Get VAPID public key from push server
    const vapidRes = await fetch(`${PUSH_SERVER}/vapid-public-key`);
    const { key: vapidPublicKey } = await vapidRes.json();

    // 5. Subscribe to Web Push
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true, // required by browsers
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // 6. Register with push server
    await fetch(`${PUSH_SERVER}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pubkey: nostrPubkey,
        subscription: subscription.toJSON(),
      }),
    });

    console.log('[push] registered successfully');
    return true;
  } catch (err) {
    console.error('[push] registration failed:', err);
    return false;
  }
}

export async function unregisterPushNotifications(nostrPubkey) {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return;

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(`${PUSH_SERVER}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey: nostrPubkey, endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch (err) {
    console.error('[push] unregister failed:', err);
  }
}

// Utility — Web Push requires this exact format for the VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
