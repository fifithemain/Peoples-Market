import type { DeliveryZone } from '@/lib/delivery-pricing';
import type { Role } from './permissions';

export type Category = { id: string; name: string; slug: string; description: string; isActive: boolean };
export type Product = { id: string; name: string; slug: string; description: string; price: number; imageUrl: string; stockQty: number; inStock: boolean; categoryId: string; categoryName: string };
export type OrderItem = { quantity: number; price: number; name: string };
export type Order = { id: string; orderNumber: string; customerName: string; customerPhone: string; deliveryAddress: string; totalAmount: number; status: string; paymentStatus: string; createdAt: string; items: OrderItem[] };
export type Staff = { email: string; role: 'ORDER_MANAGER'; addedAt: string };

export type AdminData = {
  role: Role;
  email: string;
  products: Product[];
  orders: Order[];
  categories: Category[];
  // Owner-only sections; never sent to other roles.
  staff?: Staff[];
  music?: { enabled?: boolean; tracks?: string[] };
  deliveryZones?: DeliveryZone[];
};

export type Act = (run: (credential: string) => Promise<unknown>, success?: string) => Promise<boolean>;

export const money = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n);
export const orderStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const;
