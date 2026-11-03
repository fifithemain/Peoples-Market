export type Role = 'OWNER' | 'ORDER_MANAGER';

export type Permission =
  | 'orders:view'
  | 'orders:update'
  | 'stock:update'
  | 'catalogue:manage'
  | 'categories:manage'
  | 'delivery:manage'
  | 'music:manage'
  | 'staff:manage';

const OWNER_PERMISSIONS: Permission[] = [
  'orders:view', 'orders:update', 'stock:update', 'catalogue:manage',
  'categories:manage', 'delivery:manage', 'music:manage', 'staff:manage',
];

// Order managers can only read orders and flip products between sold out and available.
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: OWNER_PERMISSIONS,
  ORDER_MANAGER: ['orders:view', 'stock:update'],
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ORDER_MANAGER: 'Order manager',
};

export function can(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
