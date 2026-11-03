'use client';

import { useState } from 'react';

type Props = {
  busy: boolean;
  error: string;
  onOwner: (key: string) => void;
  onStaff: (email: string, password: string) => void;
};

export default function LoginPanel({ busy, error, onOwner, onStaff }: Props) {
  const [method, setMethod] = useState<'owner' | 'staff'>('owner');
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return <section className="admin-login">
    <h1>Admin access</h1>
    <div className="account-mode">
      <button type="button" className={method === 'owner' ? 'active' : ''} onClick={() => setMethod('owner')}>Owner</button>
      <button type="button" className={method === 'staff' ? 'active' : ''} onClick={() => setMethod('staff')}>Order manager</button>
    </div>
    {method === 'owner'
      ? <>
        <p>Sign in with your private admin access key to manage the shop.</p>
        <form onSubmit={e => { e.preventDefault(); onOwner(key); }}>
          <label>Admin access key<input type="password" autoComplete="current-password" value={key} onChange={e => setKey(e.target.value)} placeholder="Enter your admin access key" required /></label>
          <button type="submit" disabled={busy}>{busy ? 'Loading dashboard…' : 'Open dashboard'}</button>
        </form>
      </>
      : <>
        <p>Order managers sign in with their People&apos;s Market account email and password. The owner must add your email first.</p>
        <form onSubmit={e => { e.preventDefault(); onStaff(email, password); }}>
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
          <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </>}
    {error && <p className="admin-error">{error}</p>}
  </section>;
}
