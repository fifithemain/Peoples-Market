import { prisma } from '@/lib/prisma';
import { getFreshCartFirebaseMessaging } from '@/lib/firebase-admin';

const ORDER_PAID_EVENT = 'ORDER_PAID';

export async function queuePaidOrderNotification(orderId: string) {
  await prisma.notificationEvent.upsert({
    where: { orderId_eventType: { orderId, eventType: ORDER_PAID_EVENT } },
    create: { orderId, eventType: ORDER_PAID_EVENT, status: 'pending' },
    update: {},
  });
}

/**
 * Sends one notification per paid order event. The event row is an idempotency
 * guard, so repeated payment verification requests do not repeatedly alert staff.
 */
export async function sendPaidOrderNotification(orderId: string) {
  const event = await prisma.notificationEvent.findUnique({
    where: { orderId_eventType: { orderId, eventType: ORDER_PAID_EVENT } },
  });
  if (!event || event.status === 'sent' || event.status === 'skipped') return;

  const staleSendingBefore = new Date(Date.now() - 3 * 60 * 1000);
  const claim = await prisma.notificationEvent.updateMany({
    where: {
      id: event.id,
      OR: [
        { status: { in: ['pending', 'failed'] } },
        { status: 'sending', updatedAt: { lt: staleSendingBefore } },
      ],
    },
    data: { status: 'sending', attempts: { increment: 1 }, lastError: null },
  });
  if (claim.count !== 1) return;

  try {
    const [order, subscriptions] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, include: { items: true } }),
      prisma.pushSubscription.findMany({
        where: { role: { in: ['OWNER', 'ORDER_MANAGER'] } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!order) throw new Error('The order for this notification no longer exists.');
    if (!subscriptions.length) {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: { status: 'skipped', lastError: 'No owner or order-manager devices have enabled notifications.' },
      });
      return;
    }

    const orderNumber = order.id.slice(0, 8).toUpperCase();
    const response = await getFreshCartFirebaseMessaging().sendEachForMulticast({
      tokens: subscriptions.map(item => item.token),
      notification: {
        title: 'New FreshCart order #' + orderNumber,
        body: 'Payment confirmed · R' + Number(order.totalAmount).toFixed(2),
      },
      data: {
        type: ORDER_PAID_EVENT,
        orderId: order.id,
        orderNumber,
        url: '/admin',
      },
      webpush: {
        notification: {
          icon: '/icon.png',
          badge: '/icon.png',
          tag: 'freshcart-order-' + order.id,
          renotify: false,
          data: { url: '/admin' },
        },
      },
    });

    const invalidTokens = subscriptions
      .filter((item, index) => {
        const code = response.responses[index]?.error?.code;
        return code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token';
      })
      .map(item => item.token);

    if (invalidTokens.length) {
      await prisma.pushSubscription.deleteMany({ where: { token: { in: invalidTokens } } });
    }

    if (response.successCount > 0) {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          lastError: response.failureCount
            ? response.failureCount + ' device(s) could not receive this notification.'
            : null,
        },
      });
    } else {
      const firstError = response.responses.find(item => item.error)?.error;
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: 'failed',
          lastError: firstError?.message || 'Firebase could not deliver this notification to any registered device.',
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown notification delivery error.';
    console.error('FreshCart order notification failed:', message);
    await prisma.notificationEvent.update({
      where: { id: event.id },
      data: { status: 'failed', lastError: message.slice(0, 500) },
    }).catch(updateError => console.error('Could not update notification event:', updateError));
  }
}
