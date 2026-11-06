import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export function getFreshCartFirebaseMessaging() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are not configured.');
  }

  const app = getApps().find(item => item.name === 'freshcart-push-admin') ||
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    }, 'freshcart-push-admin');

  return getMessaging(app);
}
