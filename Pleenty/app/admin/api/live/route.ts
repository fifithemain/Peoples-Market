import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth';
import { getAdminVersion, loadAdminData } from '../../_lib/data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * Powers the dashboard's live updates. The client polls with the last version it saw;
 * full (role-filtered) data is only returned when something has actually changed.
 */
export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  const actor = await authenticate(header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });

  try {
    const version = await getAdminVersion();
    if (request.nextUrl.searchParams.get('since') === version) {
      return NextResponse.json({ changed: false, version }, { headers: noStore });
    }
    return NextResponse.json({ changed: true, version, data: await loadAdminData(actor) }, { headers: noStore });
  } catch (error) {
    console.error('Admin live data failed:', error);
    return NextResponse.json({ error: 'Could not load dashboard data.' }, { status: 500, headers: noStore });
  }
}
