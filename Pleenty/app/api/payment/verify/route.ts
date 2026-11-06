import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getYocoCheckout } from '@/lib/yoco';
import { queuePaidOrderNotification, sendPaidOrderNotification } from '@/lib/notifications';

async function notifyPaidOrder(orderId: string) {
  try {
    await queuePaidOrderNotification(orderId);
    await sendPaidOrderNotification(orderId);
  } catch (error) {
    // Push delivery must never turn a verified customer payment into a failed checkout.
    console.error('FreshCart could not queue the paid-order notification:', error);
  }
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order');
  if (!orderId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return NextResponse.json({ error: 'Invalid order reference.' }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (['paid', 'succeeded', 'completed'].includes(order.paymentStatus.toLowerCase())) {
    let status = order.status;
    if (['pending', 'confirmed'].includes(status.toLowerCase())) {
      const updated = await prisma.order.update({ where: { id: order.id }, data: { status: 'preparing' } });
      status = updated.status;
    }
    await notifyPaidOrder(order.id);
    return NextResponse.json({ paid: true, orderNumber: order.id.slice(0, 8).toUpperCase(), status });
  }
  if (!order.yocoCheckoutId) return NextResponse.json({ paid: false, status: order.status, paymentStatus: order.paymentStatus });
  try {
    const checkout = await getYocoCheckout(order.yocoCheckoutId);
    const state = String(checkout.status || '').toLowerCase();
    const paid = ['completed', 'succeeded', 'paid'].includes(state);
    if (paid) {
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'paid', status: 'preparing' } });
      await notifyPaidOrder(order.id);
      return NextResponse.json({ paid: true, orderNumber: order.id.slice(0, 8).toUpperCase(), status: 'preparing' });
    }
    return NextResponse.json({ paid: false, status: order.status, paymentStatus: order.paymentStatus, providerStatus: state });
  } catch {
    return NextResponse.json({ paid: false, status: order.status, paymentStatus: order.paymentStatus, message: 'Payment verification is temporarily unavailable.' });
  }
}
