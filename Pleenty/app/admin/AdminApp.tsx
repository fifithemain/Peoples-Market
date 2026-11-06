'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { can, ROLE_LABELS, type Permission } from './_lib/permissions';
import { money, type Act, type AdminData } from './_lib/types';
import LoginPanel from './_components/LoginPanel';
import OrdersPanel, { OrdersTable } from './_components/OrdersPanel';
import StockPanel from './_components/StockPanel';
import TeamPanel from './_components/TeamPanel';
import ProductsPanel from './_components/ProductsPanel';
import CategoriesPanel from './_components/CategoriesPanel';
import DeliveryPanel from './_components/DeliveryPanel';
import MusicPanel from './_components/MusicPanel';
import NotificationSettings from './_components/NotificationSettings';

type Tab = 'overview' | 'products' | 'categories' | 'delivery' | 'music' | 'orders' | 'cancelled' | 'stock' | 'team';
type SessionKind = 'owner' | 'staff';
type HttpError = Error & { status?: number };

const OWNER_KEY_STORAGE = 'freshcart-admin-key';
const POLL_INTERVAL_MS = 4000;
const TABS: { id: Tab; label: string; permission: Permission }[] = [
  { id: 'overview', label: 'Overview', permission: 'catalogue:manage' },
  { id: 'products', label: 'Products', permission: 'catalogue:manage' },
  { id: 'categories', label: 'Categories', permission: 'categories:manage' },
  { id: 'delivery', label: 'Delivery areas', permission: 'delivery:manage' },
  { id: 'music', label: 'Storefront music', permission: 'music:manage' },
  { id: 'stock', label: 'Stock', permission: 'stock:update' },
  { id: 'orders', label: 'All orders', permission: 'orders:view' },
  { id: 'cancelled', label: 'Cancelled orders', permission: 'orders:view' },
  { id: 'team', label: 'Team', permission: 'staff:manage' },
];

export default function AdminApp() {
  const [session, setSession] = useState<SessionKind | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [live, setLive] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('ALL');

  const kindRef = useRef<SessionKind | null>(null);
  const ownerKeyRef = useRef('');
  const versionRef = useRef('');
  const knownOrdersRef = useRef<Set<string> | null>(null);
  const inFlightRef = useRef(false);

  const getCredential = useCallback(async () => {
    if (kindRef.current === 'owner') return ownerKeyRef.current;
    const { data: auth } = await createBrowserSupabaseClient().auth.getSession();
    return auth.session?.access_token || '';
  }, []);

  const applyData = useCallback((next: AdminData) => {
    const known = knownOrdersRef.current;
    if (known) {
      const fresh = next.orders.filter(o => !known.has(o.id));
      if (fresh.length) setMessage(fresh.length === 1 ? 'New order received: #' + fresh[0].orderNumber + ' from ' + fresh[0].customerName + '.' : fresh.length + ' new orders received.');
    }
    knownOrdersRef.current = new Set(next.orders.map(o => o.id));
    setData(next);
  }, []);

  const sync = useCallback(async (force = false) => {
    const credential = await getCredential();
    if (!credential) throw Object.assign(new Error('Unauthorized'), { status: 401 });
    const response = await fetch('/admin/api/live?since=' + (force ? '' : encodeURIComponent(versionRef.current)), {
      headers: { Authorization: 'Bearer ' + credential }, cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || 'Could not load the dashboard.'), { status: response.status });
    versionRef.current = body.version;
    if (body.changed) applyData(body.data as AdminData);
    setLastSync(new Date());
    setLive(true);
  }, [applyData, getCredential]);

  const clearSession = useCallback(() => {
    kindRef.current = null; ownerKeyRef.current = ''; versionRef.current = ''; knownOrdersRef.current = null;
    setSession(null); setData(null); setLive(false); setMessage('');
  }, []);

  const establish = useCallback(async (kind: SessionKind, key = '') => {
    kindRef.current = kind; ownerKeyRef.current = key; versionRef.current = ''; knownOrdersRef.current = null;
    try {
      await sync(true);
      setSession(kind);
      return true;
    } catch (e) {
      clearSession();
      throw e;
    }
  }, [clearSession, sync]);

  const describeAuthError = (e: HttpError, kind: SessionKind) => e.status === 401
    ? (kind === 'owner'
      ? 'Admin access key is invalid or ADMIN_ACCESS_KEY is not configured in Vercel.'
      : 'This account has not been added as an order manager, or its email is not confirmed yet.')
    : e.message || 'Could not load the dashboard.';

  // Restore a previous owner key or an existing staff sign-in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedKey = localStorage.getItem(OWNER_KEY_STORAGE);
      if (savedKey) {
        try { await establish('owner', savedKey); return; }
        catch (e) { if ((e as HttpError).status === 401) localStorage.removeItem(OWNER_KEY_STORAGE); }
      }
      try {
        const { data: auth } = await createBrowserSupabaseClient().auth.getSession();
        if (auth.session) await establish('staff');
      } catch { /* not staff or accounts not configured: show the login form */ }
    })().finally(() => { if (!cancelled) setBooting(false); });
    return () => { cancelled = true; };
  }, [establish]);

  // Live updates: poll cheaply and only download data when something changed.
  useEffect(() => {
    if (!session) return;
    const tick = async () => {
      if (document.hidden || inFlightRef.current) return;
      inFlightRef.current = true;
      try { await sync(); }
      catch (e) {
        if ((e as HttpError).status === 401) { clearSession(); setError('Your access has ended. Please sign in again.'); }
        else setLive(false);
      } finally { inFlightRef.current = false; }
    };
    const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [session, sync, clearSession]);

  const ownerLogin = async (key: string) => {
    setBusy(true); setError('');
    try { await establish('owner', key.trim()); localStorage.setItem(OWNER_KEY_STORAGE, key.trim()); setTab('overview'); }
    catch (e) { setError(describeAuthError(e as HttpError, 'owner')); }
    finally { setBusy(false); }
  };

  const staffLogin = async (email: string, password: string) => {
    setBusy(true); setError('');
    try {
      const { error: authError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      await establish('staff');
      setTab('orders');
    } catch (e) { setError(describeAuthError(e as HttpError, 'staff')); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    const kind = kindRef.current;
    localStorage.removeItem(OWNER_KEY_STORAGE);
    clearSession(); setError('');
    if (kind === 'staff') await createBrowserSupabaseClient().auth.signOut().catch(() => undefined);
  };

  const act: Act = useCallback(async (run, success) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await run(await getCredential());
      if (success) setMessage(success);
      await sync(true);
      return true;
    } catch (e) {
      const text = (e as Error)?.message || 'That did not work. Please try again.';
      if (text.includes('Unauthorized')) { clearSession(); setError('Your access has ended. Please sign in again.'); }
      else setError(text);
      return false;
    } finally { setBusy(false); }
  }, [clearSession, getCredential, sync]);

  const role = data?.role;
  const visibleTabs = useMemo(() => role ? TABS.filter(t => can(role, t.permission)) : [], [role]);
  const activeTab = visibleTabs.some(t => t.id === tab) ? tab : visibleTabs[0]?.id;
  const cancelled = data ? data.orders.filter(o => o.status === 'CANCELLED') : [];
  const soldOutCount = data ? data.products.filter(p => !p.inStock).length : 0;
  const counts: Partial<Record<Tab, number>> = data ? {
    products: data.products.length, categories: data.categories.length, orders: data.orders.length, cancelled: cancelled.length, stock: soldOutCount,
  } : {};
  const countLabel = (id: Tab) => counts[id] === undefined ? '' : id === 'stock' ? ' (' + counts[id] + ' sold out)' : ' (' + counts[id] + ')';

  if (booting) return <main className="admin-shell"><header className="admin-header"><div><b>FreshCart Admin</b><span>Loading…</span></div></header></main>;

  return <main className="admin-shell">
    <header className="admin-header">
      <div><b>FreshCart Admin</b><span>{data ? ROLE_LABELS[data.role] + (data.email ? ' · ' + data.email : '') : 'Store management'}</span></div>
      {data && <div className="admin-live" role="status" aria-live="polite"><small>{live ? '● Live' : '○ Reconnecting…'}{lastSync ? ' · updated ' + lastSync.toLocaleTimeString('en-ZA') : ''}</small><NotificationSettings getCredential={getCredential} /><button onClick={() => void signOut()}>Sign out</button></div>}
    </header>
    {!data || !role ? <LoginPanel busy={busy} error={error} onOwner={key => void ownerLogin(key)} onStaff={(email, password) => void staffLogin(email, password)} /> : <>
      <nav className="admin-nav">
        {visibleTabs.map(t => <button key={t.id} className={activeTab === t.id ? 'selected' : ''} onClick={() => setTab(t.id)}>{t.label}{countLabel(t.id)}</button>)}
        <button className="admin-refresh" disabled={busy} onClick={() => void act(async () => undefined)}>{busy ? 'Refreshing…' : '↻ Refresh now'}</button>
      </nav>
      {message && <div className="admin-message" role="status">{message}</div>}
      {error && <div className="admin-error" role="alert">{error}</div>}

      {activeTab === 'overview' && <section className="admin-dashboard-content">
        <div className="admin-grid">
          <div className="stat"><small>Total products</small><b>{data.products.length}</b><span>Across {data.categories.length} categories</span></div>
          <div className="stat"><small>In stock</small><b>{data.products.length - soldOutCount}</b><span>{soldOutCount} sold out</span></div>
          <div className="stat"><small>Orders to process</small><b>{data.orders.filter(o => o.status === 'PENDING').length}</b><span>{data.orders.length} orders loaded</span></div>
          <div className="stat"><small>Cancelled orders</small><b>{cancelled.length}</b><span>Kept in a separate dashboard</span></div>
          <div className="stat"><small>Order value (excluding cancelled)</small><b>{money(data.orders.filter(o => o.status !== 'CANCELLED').reduce((sum, o) => sum + o.totalAmount, 0))}</b><span>All loaded orders, not accounting revenue</span></div>
        </div>
        <div className="panel admin-quick-links"><h2>Quick actions</h2>
          <button onClick={() => setTab('products')}>＋ Add a product</button>
          <button onClick={() => setTab('categories')}>＋ Create a category</button>
          <button onClick={() => { setTab('orders'); setOrderStatus('PENDING'); }}>Review pending orders</button>
          <button onClick={() => setTab('team')}>Manage order managers</button>
        </div>
        <div className="panel"><h2>Latest orders</h2><OrdersTable orders={data.orders.slice(0, 5)} canUpdate busy={busy} act={act} /></div>
      </section>}

      {/* Panels stay mounted (hidden) so unsaved form edits survive tab switches and live refreshes. */}
      {can(role, 'catalogue:manage') && <div hidden={activeTab !== 'products'}><ProductsPanel products={data.products} categories={data.categories} busy={busy} act={act} /></div>}
      {can(role, 'categories:manage') && <div hidden={activeTab !== 'categories'}><CategoriesPanel categories={data.categories} products={data.products} busy={busy} act={act} /></div>}
      {can(role, 'delivery:manage') && data.deliveryZones && <div hidden={activeTab !== 'delivery'}><DeliveryPanel initialZones={data.deliveryZones} busy={busy} act={act} /></div>}
      {can(role, 'music:manage') && data.music && <div hidden={activeTab !== 'music'}><MusicPanel initial={data.music} busy={busy} act={act} /></div>}
      {can(role, 'staff:manage') && data.staff && activeTab === 'team' && <TeamPanel staff={data.staff} busy={busy} act={act} />}
      {can(role, 'stock:update') && activeTab === 'stock' && <StockPanel products={data.products} busy={busy} act={act} />}
      {can(role, 'orders:view') && (activeTab === 'orders' || activeTab === 'cancelled') &&
        <OrdersPanel orders={data.orders} cancelledOnly={activeTab === 'cancelled'} canUpdate={can(role, 'orders:update')} busy={busy} act={act}
          search={orderSearch} onSearch={setOrderSearch} status={orderStatus} onStatus={setOrderStatus} />}
    </>}
  </main>;
}
