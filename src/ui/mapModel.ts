import { legOf } from '../domain/transport';
import type { Trip } from '../domain/types';

export type PinRole = 'depart' | 'arrivee' | 'boucle' | 'etape';
export interface Pin {
  lat: number;
  lon: number;
  numbers: number[];
  names: string[];
  role: PinRole;
}
export interface Segment {
  from: [number, number];
  to: [number, number];
  /** sol, avion, ou manquant (une étape intermédiaire n'a pas de position). */
  kind: 'sol' | 'avion' | 'manquant';
  /** Rang du segment dans le parcours (0 = premier), pour le dégradé départ → arrivée. */
  rank: number;
}

const NEAR_KM = 0.5;
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/**
 * Modèle de carte du parcours :
 * - épingles regroupées quand plusieurs étapes sont au même endroit (ex. aéroport d'arrivée et de départ : « 1 · 5 ») ;
 * - rôle départ / arrivée / boucle pour les distinguer ;
 * - un segment par paire d'étapes consécutives placées ; une étape sans position est sautée
 *   et signalée par un segment « manquant ».
 */
export function mapModel(trip: Trip): { pins: Pin[]; segments: Segment[]; unplaced: string[] } {
  const ordered = trip.stopOrder.map((id) => trip.stops[id]).filter((s) => !!s);
  const last = ordered.length;
  const pins: Pin[] = [];
  const unplaced: string[] = [];
  ordered.forEach((s, i) => {
    const pt = s.point;
    if (!pt) return void unplaced.push(s.name);
    const n = i + 1;
    const near = pins.find((p) => km(p, pt) < NEAR_KM);
    if (near) {
      near.numbers.push(n);
      near.names.push(s.name);
    } else pins.push({ lat: pt.lat, lon: pt.lon, numbers: [n], names: [s.name], role: 'etape' });
  });
  for (const p of pins) {
    const first = p.numbers.includes(1);
    const end = p.numbers.includes(last);
    p.role = first && end && last > 1 ? 'boucle' : first ? 'depart' : end && last > 1 ? 'arrivee' : 'etape';
  }

  const segments: Segment[] = [];
  let prev: (typeof ordered)[number] | null = null;
  let skipped = false;
  for (const s of ordered) {
    if (!s.point) {
      skipped = true;
      continue;
    }
    if (prev?.point) {
      const t = legOf(trip, prev.id, s.id);
      segments.push({
        from: [prev.point.lon, prev.point.lat],
        to: [s.point.lon, s.point.lat],
        kind: skipped ? 'manquant' : t?.mode === 'avion' ? 'avion' : 'sol',
        rank: segments.length,
      });
    }
    prev = s;
    skipped = false;
  }
  return { pins, segments, unplaced };
}

/** Couleur du segment : du vert (départ) au rouge (arrivée). */
export function rankColor(rank: number, total: number): string {
  const t = total <= 1 ? 0 : rank / (total - 1);
  const hue = Math.round(150 - 150 * t);
  return `hsl(${hue}, 70%, 38%)`;
}
