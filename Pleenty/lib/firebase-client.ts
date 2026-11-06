import { getApps, initializeApp } from 'firebase/app';
import type { Messaging, Unsubscribe } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseMessagingConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  );
}

/** Called only after a manager or owner explicitly enables notifications. */
export async function getBrowserMessagingFid(requestPermission: boolean): Promise<{
  fid: string;
  messaging: Messaging;
}> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('This browser does not support web push notifications.');
  }
  if (!isFirebaseMessagingConfigured()) {
    throw new Error('Firebase notifications are not configured yet. Please contact the store owner.');
  }

  const { isSupported, getMessaging, onRegistered, register } = await import('firebase/messaging');
  if (!(await isSupported())) {
    throw new Error('Push notifications are not supported by this browser.');
  }

  if (Notification.permission !== 'granted') {
    if (!requestPermission) throw new Error('Notifications have not been enabled on this browser.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');
  }

  const app = getApps().find(item => item.name === 'freshcart-push') ||
    initializeApp(firebaseConfig, 'freshcart-push');
  const messaging = getMessaging(app);
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  const fid = await new Promise<string>((resolve, reject) => {
    let settled = false;
    let unsubscribe: Unsubscribe = () => undefined;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error('Firebase registration timed out. Please try again.'));
    }, 15000);

    unsubscribe = onRegistered(messaging, installationId => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(installationId);
    });

    void register(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    }).catch(error => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      reject(error);
    });
  });

  if (!fid) throw new Error('Firebase did not return a device installation ID.');
  return { fid, messaging };
}
