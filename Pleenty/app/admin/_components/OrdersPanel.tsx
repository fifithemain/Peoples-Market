'use client';

import { updateOrderStatus } from '../actions';
import { money, orderStatuses, type Act, type Order } from '../_lib/types';

type TableProps = { orders: Order[]; canUpdate: boolean; busy: boolean; act: Act; emptyTitle?: string; emptyText?: string };

export function OrdersTable({ orders, canUpdate, busy, act, emptyTitle = 'No orders found', emptyText = 'New customer orders will appear here.' }: TableProps) {
  const changeStatus = async (order: Order, status: string) => {
    if (status === 'CANCELLED' && order.status !== 'CANCELLED' && !window.confirm('Cancel order ' + order.orderNumber + '? This will move it to Cancelled orders.')) return;
    await act(
      credential => updateOrderStatus(credential, order.id, status as typeof orderStatuses[number]),
      'Order ' + order.orderNumber + ' updated to ' + status.replaceAll('_', ' ').toLowerCase() + '.',
    );
  };

  if (!orders.length) return <div className="admin-empty"><b>{emptyTitle}</b><p>{emptyText}</p></div>;
  return <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Order</th><th>Customer & delivery</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th>{canUpdate && <th>Update status</th>}</tr></thead>
    <tbody>{orders.map(o => <tr key={o.id}>
      <td><b>{o.orderNumber}</b><small>{new Date(o.createdAt).toLocaleString('en-ZA')}</small></td>
      <td><b>{o.customerName}</b><small>{o.customerPhone}</small><small>{o.deliveryAddress}</small></td>
      <td>{o.items.map(i => i.quantity + ' × ' + i.name).join(', ') || 'No item details'}</td>
      <td><b>{money(o.totalAmount)}</b></td>
      <td><span className={'order-status status-' + o.paymentStatus.toLowerCase()}>{o.paymentStatus.replaceAll('_', ' ')}</span></td>
      <td><span className={'order-status status-' + o.status.toLowerCase()}>{o.status.replaceAll('_', ' ')}</span></td>
      {canUpdate && <td><select aria-label={'Status for order ' + o.orderNumber} value={o.status} disabled={busy} onChange={e => void changeStatus(o, e.target.value)}>{orderStatuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></td>}
    </tr>)}</tbody>
  </table></div>;
}

type PanelProps = {
  orders: Order[];
  cancelledOnly: boolean;
  canUpdate: boolean;
  busy: boolean;
  act: Act;
  search: string;
  onSearch: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
};

export default function OrdersPanel({ orders, cancelledOnly, canUpdate, busy, act, search, onSearch, status, onStatus }: PanelProps) {
  const source = cancelledOnly ? orders.filter(o => o.status === 'CANCELLED') : orders;
  const filtered = source.filter(o => (status === 'ALL' || cancelledOnly || o.status === status) &&
    (o.orderNumber + ' ' + o.customerName + ' ' + o.customerPhone + ' ' + o.deliveryAddress).toLowerCase().includes(search.toLowerCase()));

  return <section className="admin-dashboard-content"><div className="panel">
    <div className="admin-panel-heading"><div>
      <h2>{cancelledOnly ? 'Cancelled orders' : canUpdate ? 'Order management' : 'Orders'}</h2>
      <p className="panel-intro">{cancelledOnly
        ? 'A dedicated record of cancelled orders.' + (canUpdate ? ' You can restore an order by changing its status.' : '')
        : canUpdate ? 'Review customer details, delivery addresses, items and update each order status.' : 'New orders appear here automatically. Order managers can view orders but not change them.'}</p>
    </div></div>
    <div className="admin-filters">
      <input aria-label="Search orders" placeholder="Search order number, customer, phone…" value={search} onChange={e => onSearch(e.target.value)} />
      {!cancelledOnly && <select aria-label="Filter order status" value={status} onChange={e => onStatus(e.target.value)}><option value="ALL">All statuses</option>{orderStatuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select>}
    </div>
    <OrdersTable orders={filtered} canUpdate={canUpdate} busy={busy} act={act}
      emptyTitle={cancelledOnly ? 'No cancelled orders' : 'No orders found'}
      emptyText={cancelledOnly ? 'Orders that are cancelled will be listed here.' : 'New customer orders will appear here.'} />
  </div></section>;
}
