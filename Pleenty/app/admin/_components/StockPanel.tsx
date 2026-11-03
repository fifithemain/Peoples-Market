'use client';

import { useMemo, useState } from 'react';
import { setProductAvailability } from '../actions';
import type { Act, Product } from '../_lib/types';

type Props = { products: Product[]; busy: boolean; act: Act };

/** Stock view for order managers: mark items sold out or back in stock, nothing else. */
export default function StockPanel({ products, busy, act }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  const visible = useMemo(() => products.filter(p =>
    (filter === 'all' || (filter === 'in') === p.inStock) &&
    (p.name + ' ' + p.slug + ' ' + p.categoryName).toLowerCase().includes(search.toLowerCase())), [products, filter, search]);
  const soldOut = products.filter(p => !p.inStock).length;

  const markSoldOut = (p: Product) => act(credential => setProductAvailability(credential, p.id, false), p.name + ' marked sold out. The shop is updated.');
  const restock = (p: Product, quantity: string) => {
    const value = Number(quantity);
    if (!Number.isInteger(value) || value < 1) return act(async () => { throw new Error('Enter how many are back in stock (a whole number of 1 or more).'); });
    return act(credential => setProductAvailability(credential, p.id, true, value), p.name + ' is back in stock. The shop is updated.');
  };

  return <section className="admin-dashboard-content"><div className="panel">
    <div className="admin-panel-heading"><div>
      <h2>Stock availability</h2>
      <p className="panel-intro">{products.length} products · {soldOut} sold out. Changes show on the live shop within seconds.</p>
    </div></div>
    <div className="admin-filters">
      <input aria-label="Search products" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Filter by availability" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
        <option value="all">All products</option><option value="in">In stock</option><option value="out">Sold out</option>
      </select>
    </div>
    {visible.length ? <div className="admin-product-list">{visible.map(p => <article className="admin-product-card" key={p.id}>
      <div className="admin-product-details">
        <b>{p.name}</b><small>{p.categoryName}</small>
        <span className={'order-status ' + (p.inStock ? 'status-delivered' : 'status-cancelled')}>{p.inStock ? 'IN STOCK · ' + p.stockQty + ' available' : 'SOLD OUT'}</span>
      </div>
      {p.inStock
        ? <button className="danger-admin-button" disabled={busy} onClick={() => void markSoldOut(p)}>Mark sold out</button>
        : <form className="admin-form" onSubmit={e => { e.preventDefault(); void restock(p, String(new FormData(e.currentTarget).get('qty') || '')); }}>
          <label>Quantity back in stock<input name="qty" type="number" min="1" step="1" defaultValue={p.stockQty > 0 ? p.stockQty : 10} key={p.id + ':' + p.stockQty} required /></label>
          <button type="submit" disabled={busy}>Back in stock</button>
        </form>}
    </article>)}</div> : <div className="admin-empty"><b>No products match</b><p>Clear the search or filter.</p></div>}
  </div></section>;
}
