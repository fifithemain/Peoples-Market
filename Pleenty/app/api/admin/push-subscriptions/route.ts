import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/app/admin/_lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };

async function getActor(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const credential = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  return credential ? authenticate(credential) : null;
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });

  let body: { fid?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400, headers: noStore });
  }

  const fid = typeof body.fid === 'string' ? body.fid.trim() : '';
  if (fid.length < 20 || fid.length > 4096) {
    return NextResponse.json({ error: 'Invalid Firebase installation ID.' }, { status: 400, headers: noStore });
  }

  await prisma.pushSubscription.upsert({
    where: { fid },
    create: {
      fid,
      role: actor.role,
      email: actor.email || null,
      userAgent: (request.headers.get('user-agent') || '').slice(0, 512) || null,
      lastSeenAt: new Date(),
    },
    update: {
      role: actor.role,
      email: actor.email || null,
      userAgent: (request.headers.get('user-agent') || '').slice(0, 512) || null,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ success: true }, { headers: noStore });
}

export async function DELETE(request: NextRequest) {
  const actor = await getActor(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });

  let body: { fid?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400, headers: noStore });
  }

  const fid = typeof body.fid === 'string' ? body.fid.trim() : '';
  if (fid.length < 20 || fid.length > 4096) {
    return NextResponse.json({ error: 'Invalid Firebase installation ID.' }, { status: 400, headers: noStore });
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      fid,
      role: actor.role,
      email: actor.email || null,
    },
  });

  return NextResponse.json({ success: true }, { headers: noStore });
}
