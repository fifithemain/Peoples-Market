export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!Object.values(config).every(Boolean)) {
    return new Response('// FreshCart push notifications are not configured.', {
      status: 503,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const source = [
    "self.addEventListener('notificationclick', function(event) {",
    '  event.notification.close();',
    "  var target = new URL((event.notification.data && event.notification.data.url) || '/admin', self.location.origin).href;",
    '  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(windows) {',
    '    for (var i = 0; i < windows.length; i++) {',
    '      if ("focus" in windows[i]) {',
    '        windows[i].navigate(target);',
    '        return windows[i].focus();',
    '      }',
    '    }',
    '    return self.clients.openWindow(target);',
    '  }));',
    '});',
    "importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-app-compat.js');",
    "importScripts('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging-compat.js');",
    'firebase.initializeApp(' + JSON.stringify(config) + ');',
    'firebase.messaging();',
  ].join('\n');

  return new Response(source, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
