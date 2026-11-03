import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await prisma.product.findMany({ select: { id: true, slug: true, stockQty: true, inStock: true } });
    return NextResponse.json(
      { items: items.map((i) => ({ id: i.id, slug: i.slug, stockQty: i.stockQty, inStock: i.inStock && i.stockQty > 0 })) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ items: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
