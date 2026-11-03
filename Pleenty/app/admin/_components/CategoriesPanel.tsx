'use client';

import { useState } from 'react';
import { createCategory, deleteCategory, renameCategory } from '../actions';
import type { Act, Category, Product } from '../_lib/types';

type Props = { categories: Category[]; products: Product[]; busy: boolean; act: Act };

export default function CategoriesPanel({ categories, products, busy, act }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await act(credential => createCategory(credential, name, description), 'Category created. You can now assign products to it.')) { setName(''); setDescription(''); }
  };
  const save = async (id: string) => {
    if (await act(credential => renameCategory(credential, id, editName, editDescription), 'Category saved.')) setEditing(null);
  };

  return <section className="admin-dashboard-content">
    <div className="panel"><h2>Create a category</h2><p className="panel-intro">Categories organise the live shop, for example Produce, Pantry, Dairy or Household.</p>
      <form className="admin-form" onSubmit={add}>
        <label>Category name<input required placeholder="e.g. Fruit & Vegetables" value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Description (optional)<textarea placeholder="What belongs in this category?" value={description} onChange={e => setDescription(e.target.value)} /></label>
        <button disabled={busy} type="submit">{busy ? 'Saving…' : 'Create category'}</button>
      </form>
    </div>
    <div className="panel"><h2>Shop categories</h2><p className="panel-intro">Rename categories or see how many products are assigned to each one.</p>
      {categories.map(c => {
        const inUse = products.some(p => p.categoryId === c.id);
        return <div className="category-admin-row" key={c.id}>{editing === c.id
          ? <div className="category-edit-fields">
            <input aria-label="Category name" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Category name" />
            <input aria-label="Category description" value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Description (optional)" />
            <div><button disabled={busy} onClick={() => void save(c.id)}>Save</button><button className="secondary-admin-button" onClick={() => setEditing(null)}>Cancel</button></div>
          </div>
          : <>
            <div><b>{c.name}</b><small>/{c.slug} · {products.filter(p => p.categoryId === c.id).length} products</small>{c.description && <p>{c.description}</p>}</div>
            <div className="category-row-actions">
              <button className="secondary-admin-button" onClick={() => { setEditing(c.id); setEditName(c.name); setEditDescription(c.description); }}>Edit</button>
              <button className="danger-admin-button" disabled={busy || inUse} title={inUse ? 'Move products out of this category first' : 'Delete category'} onClick={() => { if (window.confirm('Delete category ' + c.name + '?')) void act(credential => deleteCategory(credential, c.id), 'Category deleted.'); }}>Delete</button>
            </div>
          </>}</div>;
      })}
    </div>
  </section>;
}
