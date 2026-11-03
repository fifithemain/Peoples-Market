'use client';

import { useState } from 'react';
import { saveDeliveryZones } from '../actions';
import type { DeliveryZone } from '@/lib/delivery-pricing';
import type { Act } from '../_lib/types';

type Props = { initialZones: DeliveryZone[]; busy: boolean; act: Act };

export default function DeliveryPanel({ initialZones, busy, act }: Props) {
  // Edited locally so live refreshes never overwrite unsaved changes.
  const [zones, setZones] = useState(initialZones);
  const update = (id: string, patch: Partial<DeliveryZone>) => setZones(current => current.map(zone => zone.id === id ? { ...zone, ...patch } : zone));
  const add = () => setZones(current => [...current, { id: crypto.randomUUID(), city: '', province: '', latitude: -31.5889, longitude: 28.7844, maxRoadDistanceKm: 25, enabled: true }]);
  const save = async () => {
    await act(async credential => { setZones(await saveDeliveryZones(credential, zones)); }, 'Delivery areas saved.');
  };

  return <section className="admin-dashboard-content"><div className="panel">
    <h2>Delivery areas</h2>
    <p className="panel-intro">Only enabled areas accept orders. Distances are measured by driving route from each area’s reference point. The initial Mthatha CBD coordinate is approximate, not a shop address.</p>
    <div className="admin-product-list">{zones.map(zone => <article className="admin-product-card" key={zone.id}>
      <label>City<input required maxLength={100} value={zone.city} disabled={busy} onChange={e => update(zone.id, { city: e.target.value })} /></label>
      <label>Province<input required maxLength={100} value={zone.province} disabled={busy} onChange={e => update(zone.id, { province: e.target.value })} /></label>
      <label>Center latitude<input required type="number" min="-90" max="90" step="any" value={zone.latitude} disabled={busy} onChange={e => update(zone.id, { latitude: Number(e.target.value) })} /></label>
      <label>Center longitude<input required type="number" min="-180" max="180" step="any" value={zone.longitude} disabled={busy} onChange={e => update(zone.id, { longitude: Number(e.target.value) })} /></label>
      <label>Maximum road distance (km)<input required type="number" min="1" max="500" step="1" value={zone.maxRoadDistanceKm} disabled={busy} onChange={e => update(zone.id, { maxRoadDistanceKm: Number(e.target.value) })} /></label>
      <label className="admin-checkbox-label"><input type="checkbox" checked={zone.enabled} disabled={busy} onChange={e => update(zone.id, { enabled: e.target.checked })} /> Enabled</label>
      <button type="button" className="danger-admin-button" disabled={busy} onClick={() => setZones(current => current.filter(item => item.id !== zone.id))}>Remove area</button>
    </article>)}</div>
    <div className="admin-quick-links"><button type="button" disabled={busy} onClick={add}>＋ Add city / province</button><button type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save delivery areas'}</button></div>
  </div></section>;
}
