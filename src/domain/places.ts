import type { GeoPoint, Trip } from './types';

export interface MapPlace {
  name: string;
  layer: 'Étapes' | 'Hébergements' | 'Visites et activités' | 'Transports' | 'Véhicules';
  point: GeoPoint;
  description: string;
}

/**
 * Tous les lieux placés du voyage, rangés par calque, pour les exports.
 * Les étapes et sous-étapes « famille » ne sont jamais exportées (lieux privés).
 */
export function mapPlaces(trip: Trip): MapPlace[] {
  const out: MapPlace[] = [];
  trip.stopOrder.forEach((id, i) => {
    const s = trip.stops[id];
    if (s?.point && s.kind !== 'famille') out.push({ name: `${i + 1}. ${s.name}`, layer: 'Étapes', point: s.point, description: `${s.arrival} → ${s.departure}` });
  });
  for (const e of trip.events) {
    const stop = trip.stops[e.stopId];
    if (!e.point || e.kind === 'famille' || stop?.kind === 'famille') continue;
    if (e.kind === 'hebergement') out.push({ name: e.title, layer: 'Hébergements', point: e.point, description: `${e.checkIn ?? ''} → ${e.checkOut ?? ''}` });
    else out.push({ name: e.title, layer: 'Visites et activités', point: e.point, description: `${e.date ?? ''} ${e.time ?? ''}`.trim() });
  }
  for (const t of trip.transports) {
    for (const [k, ep] of [['Départ', t.departure], ['Arrivée', t.arrival]] as const) {
      if (ep?.point) out.push({ name: `${k} ${t.mode} — ${ep.place}`, layer: 'Transports', point: ep.point, description: ep.at.replace('T', ' ') });
    }
  }
  for (const r of trip.rentals ?? []) {
    for (const [k, ep] of [['Prise', r.pickup], ['Retour', r.dropoff]] as const) {
      if (ep.point) out.push({ name: `${k} véhicule ${r.agency}`, layer: 'Véhicules', point: ep.point, description: `${ep.place} ${ep.at.replace('T', ' ')}` });
    }
  }
  return out;
}
