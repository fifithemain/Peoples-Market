'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { validateDeliveryZones } from '@/lib/delivery-pricing';
import { readStaff, requirePermission, writeStaff } from './_lib/auth';

const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const refreshStorefront = () => revalidatePath('/');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STAFF = 50;

export async function createProduct(
  credential: string,
  input: { name: string; slug: string; description?: string; price: number; comparePrice?: number; unit?: string; imageUrl?: string; stockQty: number; categoryId: string },
) {
  await requirePermission(credential, 'catalogue:manage');
  if (!input.categoryId) throw new Error('Choose a category before adding this product.');
  const product = await prisma.product.create({
    data: {
      name: input.name.trim(), slug: input.slug.trim(), description: input.description?.trim() || null,
      price: input.price, imageUrl: input.imageUrl || null, stockQty: input.stockQty,
      inStock: input.stockQty > 0, categoryId: input.categoryId,
    },
  });
  refreshStorefront();
  return { id: product.id };
}

export async function updateProduct(
  credential: string, id: string,
  input: Partial<{ name: string; slug: string; description: string; price: number; imageUrl: string; stockQty: number; inStock: boolean; categoryId: string | null }>,
) {
  await requirePermission(credential, 'catalogue:manage');
  const data = { ...input } as typeof input & { stockQty?: number; inStock?: boolean };
  if (data.stockQty !== undefined) data.inStock = data.stockQty > 0;
  if (data.categoryId === '') data.categoryId = null;
  await prisma.product.update({ where: { id }, data });
  refreshStorefront();
}

/** Available to order managers: toggles a product between sold out and available, nothing else. */
export async function setProductAvailability(credential: string, id: string, available: boolean, quantity?: number) {
  await requirePermission(credential, 'stock:update');
  if (!available) {
    await prisma.product.update({ where: { id }, data: { inStock: false } });
  } else {
    const product = await prisma.product.findUnique({ where: { id }, select: { stockQty: true } });
    if (!product) throw new Error('That product no longer exists.');
    const stockQty = quantity === undefined ? product.stockQty : quantity;
    if (!Number.isInteger(stockQty) || stockQty < 1 || stockQty > 100000) {
      throw new Error('Enter how many are back in stock (a whole number of 1 or more).');
    }
    await prisma.product.update({ where: { id }, data: { inStock: true, stockQty } });
  }
  refreshStorefront();
}

export async function deleteProduct(credential: string, id: string) {
  await requirePermission(credential, 'catalogue:manage');
  await prisma.product.delete({ where: { id } });
  refreshStorefront();
}

export async function createCategory(credential: string, name: string, description = '') {
  await requirePermission(credential, 'categories:manage');
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Enter a category name.');
  const slug = slugify(cleanName);
  if (!slug) throw new Error('Enter a valid category name.');
  const category = await prisma.category.create({ data: { name: cleanName, slug, description: description.trim() || null, isActive: true } });
  refreshStorefront();
  return { id: category.id };
}

export async function renameCategory(credential: string, id: string, name: string, description = '') {
  await requirePermission(credential, 'categories:manage');
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Category name cannot be empty.');
  await prisma.category.update({ where: { id }, data: { name: cleanName, slug: slugify(cleanName), description: description.trim() || null } });
  refreshStorefront();
}

export async function deleteCategory(credential: string, id: string) {
  await requirePermission(credential, 'categories:manage');
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) throw new Error('Move this category’s products to another category before deleting it.');
  await prisma.category.delete({ where: { id } });
  refreshStorefront();
}

export async function updateOrderStatus(
  credential: string, id: string,
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED',
) {
  await requirePermission(credential, 'orders:update');
  await prisma.order.update({ where: { id }, data: { status: status.toLowerCase() } });
  refreshStorefront();
}

export async function saveMusicSettings(credential: string, tracks: string[], enabled: boolean) {
  await requirePermission(credential, 'music:manage');
  const cleanTracks = tracks.map(track => track.trim()).filter(Boolean);
  if (cleanTracks.length > 30) throw new Error('Please add no more than 30 songs.');
  for (const track of cleanTracks) {
    let url: URL;
    try { url = new URL(track); } catch { throw new Error('Each song must be a valid HTTPS audio URL.'); }
    if (url.protocol !== 'https:') throw new Error('Each song must use HTTPS.');
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
      throw new Error('YouTube and YouTube Music page links cannot be played by the store music player. Upload an audio file or enter a direct audio-file URL.');
    }
  }
  const value = { enabled: Boolean(enabled) && cleanTracks.length > 0, tracks: cleanTracks };
  await prisma.appSetting.upsert({
    where: { key: 'storefront_music' },
    create: { key: 'storefront_music', value },
    update: { value },
  });
  refreshStorefront();
  return value;
}

export async function saveDeliveryZones(credential: string, zones: unknown) {
  await requirePermission(credential, 'delivery:manage');
  const value = validateDeliveryZones(zones);
  await prisma.appSetting.upsert({
    where: { key: 'delivery_zones' },
    create: { key: 'delivery_zones', value },
    update: { value },
  });
  return value;
}

export async function addOrderManager(credential: string, email: string) {
  await requirePermission(credential, 'staff:manage');
  const clean = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(clean) || clean.length > 254) throw new Error('Enter a valid email address.');
  const staff = await readStaff();
  if (staff.some(member => member.email === clean)) throw new Error(clean + ' is already an order manager.');
  if (staff.length >= MAX_STAFF) throw new Error('You can add up to ' + MAX_STAFF + ' order managers.');
  await writeStaff([...staff, { email: clean, role: 'ORDER_MANAGER', addedAt: new Date().toISOString() }]);
}

export async function removeOrderManager(credential: string, email: string) {
  await requirePermission(credential, 'staff:manage');
  const clean = email.trim().toLowerCase();
  const staff = await readStaff();
  await writeStaff(staff.filter(member => member.email !== clean));
}
