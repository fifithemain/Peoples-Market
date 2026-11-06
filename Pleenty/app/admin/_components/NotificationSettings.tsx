'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBrowserMessagingFid, isFirebaseMessagingConfigured } from '@/lib/firebase-client';
import type { Unsubscribe } from 'firebase/messaging';

type Props = { getCredential: () => Promise<string> };
type Status = 'checking' | 'enabled' | 'disabled' | 'denied' | 'unsupported' | 'error';

export default function NotificationSettings({ getCredential }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const messageListener = useRef<Unsubscribe | null>(null);

  const registerDevice = useCallback(async (requestPermission: boolean) => {
    setBusy(true);
    setMessage('');
    try {
      if (!isFirebaseMessagingConfigured()) {
        throw new Error('Firebase notifications have not been configured yet.');
      }

      const { fid, messaging } = await getBrowserMessagingFid(requestPermission);
      const credential = await getCredential();
      if (!credential) throw new Error('Your admin session has expired. Please sign in again.');

      const response = await fetch('/api/admin/push-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + credential,
        },
        body: JSON.stringify({ fid }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not register this device.');

      if (messageListener.current) messageListener.current();
      const { onMessage } = await import('firebase/messaging');
      messageListener.current = onMessage(messaging, payload => {
        const title = payload.notification?.title || 'New FreshCart order';
        const body = payload.notification?.body || 'A new paid order needs your attention.';
        void navigator.serviceWorker.ready.then(registration =>
          registration.showNotification(title, {
            body,
            icon: '/icon.png',
            badge: '/icon.png',
            tag: payload.data?.orderId ? 'freshcart-order-' + payload.data.orderId : 'freshcart-order',
            data: { url: '/admin' },
          })
        );
      });

      setStatus('enabled');
      setMessage('This device is registered for new paid-order alerts.');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not enable notifications.';
      setMessage(text);
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setStatus('denied');
      else if (text.toLowerCase().includes('not supported')) setStatus('unsupported');
      else setStatus('error');
    } finally {
      setBusy(false);
    }
  }, [getCredential]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    if (!isFirebaseMessagingConfigured()) {
      setStatus('disabled');
      setMessage('Firebase setup is still required.');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      setMessage('Notifications are blocked in this browser. Change the site permission in browser settings.');
      return;
    }
    if (Notification.permission === 'granted') {
      void registerDevice(false);
    } else {
      setStatus('disabled');
    }
    return () => {
      if (messageListener.current) messageListener.current();
    };
  }, [registerDevice]);

  return (
    <div className="admin-notifications" aria-live="polite">
      {status === 'enabled' ? (
        <span className="admin-notifications-enabled">● Notifications enabled</span>
      ) : (
        <button type="button" onClick={() => void registerDevice(true)} disabled={busy || status === 'unsupported' || status === 'denied'}>
          {busy ? 'Enabling…' : 'Enable notifications'}
        </button>
      )}
      {message && <small>{message}</small>}
    </div>
  );
}
