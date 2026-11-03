import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { DEFAULT_DELIVERY_ZONES, validateDeliveryZones } from '@/lib/delivery-pricing';
import { readStaff, type Actor } from './auth';
import { can } from './permissions';
import type { AdminData } from './types';

/** Cheap fingerprint of everything the dashboard shows; changes whenever any of it changes. */
export async function getAdminVersion() {
  const [orders, products, categories, settings] = await Promise.all([
    prisma.order.aggregate({ _count: true, _max: { updatedAt: true } }),
    prisma.product.aggregate({ _count: true, _max: { updatedAt: true } }),
    prisma.category.findMany({ select: { id: true, name: true, description: true, isActive: true }, orderBy: { id: 'asc' } }),
    prisma.appSetting.aggregate({ _count: true, _max: { updatedAt: true } }),
  ]);
  return createHash('sha1').update(JSON.stringify([orders, products, categories, settings])).digest('hex').slice(0, 16);
}

function describeAddress(address: unknown) {
  return typeof address === 'object' && address !== null
    ? Object.values(address).filter((v): v is string => typeof v === 'string').join(', ')
    : String(address);
}

export async function loadAdminData(actor: Actor): Promise<AdminData> {
  const isOwner = can(actor.role, 'categories:manage');
  const [products, categories, orders, musicSetting, deliverySetting, staff] = await Promise.all([
    prisma.product.findMany({ include: { category: true }, orderBy: { name: 'asc' } }),
    isOwner ? prisma.category.findMany({ orderBy: { name: 'asc' } }) : Promise.resolve([]),
    prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' }, take: 250 }),
    isOwner ? prisma.appSetting.findUnique({ where: { key: 'storefront_music' } }) : Promise.resolve(null),
    isOwner ? prisma.appSetting.findUnique({ where: { key: 'delivery_zones' } }) : Promise.resolve(null),
    isOwner ? readStaff() : Promise.resolve(undefined),
  ]);

  const data: AdminData = {
    role: actor.role,
    email: actor.email,
    products: products.map(p => ({
      id: p.id, name: p.name, slug: p.slug, description: p.description || '',
      price: Number(p.price), imageUrl: p.imageUrl || '', stockQty: p.stockQty,
      inStock: p.inStock && p.stockQty > 0, categoryId: p.categoryId || '',
      categoryName: p.category?.name || 'Uncategorized',
    })),
    categories: categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, description: c.description || '', isActive: c.isActive })),
    orders: orders.map(o => ({
      id: o.id, orderNumber: o.id.slice(0, 8).toUpperCase(), customerName: o.customerName,
      customerPhone: o.customerPhone, deliveryAddress: describeAddress(o.deliveryAddress),
      totalAmount: Number(o.totalAmount), status: o.status.toUpperCase(), paymentStatus: o.paymentStatus.toUpperCase(),
      createdAt: o.createdAt.toISOString(),
      items: o.items.map(i => ({ quantity: i.quantity, price: Number(i.price), name: i.productName })),
    })),
  };
  if (isOwner) {
    data.staff = staff;
    data.music = (musicSetting?.value as { enabled?: boolean; tracks?: string[] } | null) || { enabled: false, tracks: [] };
    data.deliveryZones = deliverySetting ? validateDeliveryZones(deliverySetting.value) : DEFAULT_DELIVERY_ZONES;
  }
  return data;
}
