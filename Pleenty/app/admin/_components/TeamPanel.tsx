'use client';

import { useState } from 'react';
import { addOrderManager, removeOrderManager } from '../actions';
import type { Act, Staff } from '../_lib/types';

type Props = { staff: Staff[]; busy: boolean; act: Act };

export default function TeamPanel({ staff, busy, act }: Props) {
  const [email, setEmail] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (await act(credential => addOrderManager(credential, address), address + ' can now sign in as an order manager.')) setEmail('');
  };

  return <section className="admin-dashboard-content">
    <div className="panel">
      <h2>Add an order manager</h2>
      <p className="panel-intro">Order managers can see orders and mark products sold out or back in stock. They cannot change orders, products, prices, categories, delivery areas, music or team members. They sign in on this page using the <b>Order manager</b> option with their People&apos;s Market account, so they need to create an account with this email and confirm it first.</p>
      <form className="admin-form" onSubmit={add}>
        <label>Account email address<input type="email" required placeholder="manager@example.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add order manager'}</button>
      </form>
    </div>
    <div className="panel">
      <h2>Order managers ({staff.length})</h2>
      {staff.length ? staff.map(member => <div className="category-admin-row" key={member.email}>
        <div><b>{member.email}</b><small>Order manager{member.addedAt ? ' · added ' + new Date(member.addedAt).toLocaleDateString('en-ZA') : ''}</small></div>
        <div className="category-row-actions"><button className="danger-admin-button" disabled={busy} onClick={() => { if (window.confirm('Remove ' + member.email + '? They will lose access immediately.')) void act(credential => removeOrderManager(credential, member.email), member.email + ' removed.'); }}>Remove</button></div>
      </div>) : <div className="admin-empty"><b>No order managers yet</b><p>Add an email above to give someone limited access.</p></div>}
    </div>
  </section>;
}
