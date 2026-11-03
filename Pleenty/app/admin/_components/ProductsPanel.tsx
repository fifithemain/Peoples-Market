'use client';

import { useMemo, useState } from 'react';
import { createProduct, deleteProduct, updateProduct } from '../actions';
import { money, type Act, type Category, type Product } from '../_lib/types';

type Props = { products: Product[]; categories: Category[]; busy: boolean; act: Act };

export default function ProductsPanel({ products, categories, busy, act }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState({ name: '', slug: '', description: '', price: '', imageUrl: '', stockQty: '10', categoryId: '' });
  const categoryId = form.categoryId || categories[0]?.id || '';

  const filtered = useMemo(() => products.filter(p =>
    (categoryFilter === 'all' || p.categoryId === categoryFilter) &&
    (p.name + ' ' + p.slug + ' ' + p.categoryName).toLowerCase().includes(search.toLowerCase())), [products, categoryFilter, search]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await act(
      credential => createProduct(credential, { ...form, price: Number(form.price), stockQty: Number(form.stockQty), categoryId }),
      'Product added. It is now in your catalogue.',
    );
    if (ok) setForm(old => ({ ...old, name: '', slug: '', description: '', price: '', imageUrl: '', stockQty: '10' }));
  };

  const saveStock = (p: Product, value: string) => {
    const qty = Number(value);
    if (!Number.isInteger(qty) || qty < 0) return act(async () => { throw new Error('Quantity must be a whole number of 0 or more.'); });
    if (qty === p.stockQty && p.inStock === (qty > 0)) return;
    return act(credential => updateProduct(credential, p.id, { stockQty: qty, inStock: qty > 0 }), qty === 0 ? p.name + ' marked sold out.' : p.name + ' stock saved.');
  };

  return <section className="admin-dashboard-content">
    <div className="panel"><h2>Add a product</h2><p className="panel-intro">Fill in the details below. Choose a category so shoppers can find the product in the right section.</p>
      <form onSubmit={add} className="admin-form">
        <label>Product name<input required placeholder="e.g. Ripe Avocados" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>Product URL slug<input required placeholder="e.g. ripe-avocados (lowercase, hyphens)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></label>
        <label>Product description<textarea placeholder="Short description customers will see" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label>Selling price (R)<input required type="number" min="0" step="0.01" placeholder="e.g. 29.99" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label>
        <label>Product image URL or emoji<input placeholder="Paste a product-only image URL, or enter 🥑" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} /></label>
        <label>Available stock quantity<input required type="number" min="0" step="1" placeholder="Enter 0 if sold out" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value })} /><small>Set to 0 to show SOLD OUT on the live shop.</small></label>
        <label>Product category<select required value={categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Choose a category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {!categories.length && <p className="admin-error">Create a category first in the Categories tab.</p>}
        <button type="submit" disabled={busy || !categories.length}>{busy ? 'Saving…' : 'Add product to catalogue'}</button>
      </form>
    </div>
    <div className="panel"><div className="admin-panel-heading"><div><h2>Product catalogue</h2><p className="panel-intro">{products.length} products, updated live from the database.</p></div></div>
      <div className="admin-filters"><input aria-label="Search products" placeholder="Search products or categories…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Filter by category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      {filtered.length ? <div className="admin-product-list">{filtered.map(p => <article className="admin-product-card" key={p.id}>
        <div className="admin-product-details"><b>{p.name}</b><small>{p.slug}</small><span className={'order-status ' + (p.stockQty > 0 && p.inStock ? 'status-delivered' : 'status-cancelled')}>{p.stockQty > 0 && p.inStock ? 'IN STOCK' : 'SOLD OUT'} · {p.stockQty} available</span><strong>{money(p.price)}</strong></div>
        <label>Category<select aria-label={'Category for ' + p.name} value={p.categoryId} disabled={busy} onChange={e => void act(credential => updateProduct(credential, p.id, { categoryId: e.target.value }), p.name + ' moved to ' + (categories.find(c => c.id === e.target.value)?.name || 'the selected category') + '.')}><option value="">Uncategorized</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Stock quantity<input aria-label={'Stock quantity for ' + p.name} type="number" min="0" step="1" defaultValue={p.stockQty} key={p.id + ':' + p.stockQty} disabled={busy} onBlur={e => void saveStock(p, e.currentTarget.value)} /><small>0 = sold out</small></label>
        <button className="danger-admin-button" disabled={busy} onClick={() => { if (window.confirm('Delete ' + p.name + '? This cannot be undone.')) void act(credential => deleteProduct(credential, p.id), p.name + ' deleted.'); }}>Delete</button>
      </article>)}</div> : <div className="admin-empty"><b>No products match these filters</b><p>Clear the search or select All categories.</p><button className="secondary-admin-button" onClick={() => { setSearch(''); setCategoryFilter('all'); }}>Clear filters</button></div>}
    </div>
  </section>;
}
