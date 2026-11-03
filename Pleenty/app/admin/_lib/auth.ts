import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth-user';
import { can, type Permission, type Role } from './permissions';

export type StaffMember = { email: string; role: 'ORDER_MANAGER'; addedAt: string };
export type Actor = { role: Role; email: string };

const STAFF_SETTING_KEY = 'admin_staff';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function readStaff(): Promise<StaffMember[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: STAFF_SETTING_KEY } });
  if (!row || !Array.isArray(row.value)) return [];
  const members: StaffMember[] = [];
  for (const item of row.value as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const { email, addedAt } = item as { email?: unknown; addedAt?: unknown };
    if (typeof email !== 'string' || !email) continue;
    members.push({ email: email.toLowerCase(), role: 'ORDER_MANAGER', addedAt: typeof addedAt === 'string' ? addedAt : '' });
  }
  return members;
}

export async function writeStaff(members: StaffMember[]) {
  await prisma.appSetting.upsert({
    where: { key: STAFF_SETTING_KEY },
    create: { key: STAFF_SETTING_KEY, value: members },
    update: { value: members },
  });
}

/**
 * The credential is either the owner's ADMIN_ACCESS_KEY or a Supabase access token
 * belonging to a confirmed account that the owner has added as staff.
 */
export async function authenticate(credential: string): Promise<Actor | null> {
  if (!credential) return null;
  const ownerKey = process.env.ADMIN_ACCESS_KEY;
  if (ownerKey && safeEqual(credential, ownerKey)) return { role: 'OWNER', email: '' };

  const user = await getAuthenticatedUser(credential);
  if (!user?.email || !user.email_confirmed_at) return null;
  const email = user.email.toLowerCase();
  const member = (await readStaff()).find(item => item.email === email);
  return member ? { role: member.role, email } : null;
}

export async function requirePermission(credential: string, permission: Permission) {
  const actor = await authenticate(credential);
  if (!actor) throw new Error('Unauthorized. Please sign in again.');
  if (!can(actor.role, permission)) throw new Error('You do not have permission to do that.');
  return actor;
}
