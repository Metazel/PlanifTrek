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

/* ---------- Vues « pays » et « étape » ---------- */

export interface ViewPin {
  lat: number;
  lon: number;
  text: string;
  cls: string;
  aria: string;
}
export interface ViewSegment {
  from: [number, number];
  to: [number, number];
  color: string;
  kind: 'sol' | 'avion' | 'manquant';
}
export interface View {
  pins: ViewPin[];
  segments: ViewSegment[];
  unplaced: string[];
  legend: Array<{ color: string; label: string }>;
}

const MODE_ICON: Record<string, string> = { avion: '✈', train: '🚆', bus: '🚌', bateau: '⛴', voiture: '🚗', taxi: '🚕', marche: '🚶' };
const DAY_COLORS = ['#2563eb', '#d97706', '#059669', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];
type LL = { lat: number; lon: number };
const ll = (p: LL): [number, number] => [p.lon, p.lat];

/**
 * Vue pays : épingles des étapes, plus aéroports / gares (points de départ et d'arrivée des trajets)
 * et hébergements ; le chemin passe d'un point d'arrivée à l'hébergement, puis au point de départ suivant.
 */
export function countryView(trip: Trip): View {
  const base = mapModel(trip);
  const pins: ViewPin[] = base.pins.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    text: p.numbers.join(' · '),
    cls: `pt-marker pt-${p.role}`,
    aria: `${{ depart: 'Départ', arrivee: 'Arrivée', boucle: 'Départ et arrivée', etape: 'Étape' }[p.role]} : ${p.numbers.map((n, i) => `${n}. ${p.names[i]}`).join(', ')}`,
  }));
  type WP = { p: LL; leg?: 'avion' | 'sol'; gap?: boolean };
  const way: WP[] = [];
  let gap = false;
  const ordered = trip.stopOrder.map((id) => trip.stops[id]).filter((s) => !!s);
  ordered.forEach((s, i) => {
    const before = way.length;
    const prev = ordered[i - 1];
    const inT = prev ? legOf(trip, prev.id, s.id) : undefined;
    const nextStop = ordered[i + 1];
    const outT = nextStop ? legOf(trip, s.id, nextStop.id) : undefined;
    if (inT?.arrival?.point) {
      way.push({ p: inT.arrival.point });
      pins.push({ ...inT.arrival.point, text: MODE_ICON[inT.mode] ?? '•', cls: 'pt-marker pt-lieu', aria: `Arrivée en ${inT.mode} : ${inT.arrival.place}` });
    }
    const lodgings = trip.events
      .flatMap((e) => (e.stopId === s.id && e.kind === 'hebergement' && e.point ? [{ e, pt: e.point }] : []))
      .sort((a, b) => (a.e.checkIn ?? '').localeCompare(b.e.checkIn ?? ''));
    if (lodgings.length) {
      for (const { e: h, pt } of lodgings) {
        way.push({ p: pt });
        pins.push({ ...pt, text: '🛏', cls: 'pt-marker pt-lieu', aria: `Hébergement : ${h.title}` });
      }
    } else if (s.point) way.push({ p: s.point });
    if (outT?.departure?.point) {
      way.push({ p: outT.departure.point, leg: outT.mode === 'avion' ? 'avion' : 'sol' });
      pins.push({ ...outT.departure.point, text: MODE_ICON[outT.mode] ?? '•', cls: 'pt-marker pt-lieu', aria: `Départ en ${outT.mode} : ${outT.departure.place}` });
    } else if (outT?.mode === 'avion') {
      // Vol sans point de départ précis : le tronçon suivant reste en tirets.
      const last = way[way.length - 1];
      if (last) last.leg = 'avion';
    }
    // Étape sans aucun point : le tronçon qui la saute est signalé (gris pointillé).
    if (way.length === before) gap = true;
    else if (gap) {
      const first = way[before];
      if (first) first.gap = true;
      gap = false;
    }
  });
  const segs: Array<Omit<ViewSegment, 'color'>> = [];
  way.forEach((w, i) => {
    const prev = way[i - 1];
    if (prev) segs.push({ from: ll(prev.p), to: ll(w.p), kind: w.gap ? 'manquant' : prev.leg === 'avion' ? 'avion' : 'sol' });
  });
  const segments = segs.map((sg, i) => ({ ...sg, color: sg.kind === 'manquant' ? '#94a3b8' : rankColor(i, segs.length) }));
  for (const r of trip.rentals ?? []) {
    for (const [kind, e] of [['Prise', r.pickup], ['Retour', r.dropoff]] as const) {
      if (e.point) pins.push({ ...e.point, text: '🚙', cls: 'pt-marker pt-lieu', aria: `${kind} du véhicule ${r.agency} : ${e.place}` });
    }
  }
  return { pins, segments, unplaced: base.unplaced, legend: [] };
}

/**
 * Vue étape : chaque journée a sa couleur ; le trajet part de l'hébergement (ou de l'étape),
 * passe par les sous-étapes placées dans l'ordre, et revient à l'hébergement si on y dort.
 */
export function stopView(trip: Trip, stopId: string): View {
  const s = trip.stops[stopId];
  if (!s) return { pins: [], segments: [], unplaced: [], legend: [] };
  const pins: ViewPin[] = [];
  const segments: ViewSegment[] = [];
  const legend: View['legend'] = [];
  const unplaced: string[] = [];
  const lodgings = trip.events.filter((e) => e.stopId === stopId && e.kind === 'hebergement');
  for (const h of lodgings) if (h.point) pins.push({ ...h.point, text: '🛏', cls: 'pt-marker pt-lieu', aria: `Hébergement : ${h.title}` });
  const homeFor = (d: string) => lodgings.find((h) => h.point && (h.checkIn ?? '') <= d && d <= (h.checkOut ?? ''))?.point ?? s.point;
  const sleepsAt = (d: string) => lodgings.find((h) => h.point && (h.checkIn ?? '') <= d && d < (h.checkOut ?? ''))?.point;
  const days: string[] = [];
  for (let d = s.arrival; d <= s.departure; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) days.push(d);
  if (!lodgings.some((h) => h.point) && s.point) pins.push({ ...s.point, text: '◆', cls: 'pt-marker', aria: `Étape : ${s.name}` });
  days.forEach((d, di) => {
    const color = DAY_COLORS[di % DAY_COLORS.length] as string;
    const items = trip.events.filter((e) => e.stopId === stopId && e.kind !== 'hebergement' && e.date === d);
    if (!items.length) return;
    legend.push({ color, label: `Jour ${di + 1} (${d.slice(8, 10)}/${d.slice(5, 7)})` });
    const path: LL[] = [];
    const home = homeFor(d);
    if (home) path.push(home);
    items.forEach((e, k) => {
      if (!e.point) return void unplaced.push(e.title);
      path.push(e.point);
      pins.push({ ...e.point, text: `J${di + 1}·${k + 1}`, cls: 'pt-marker pt-jour', aria: `Jour ${di + 1}, ${k + 1} : ${e.title}` });
    });
    const night = sleepsAt(d);
    if (night) path.push(night);
    path.forEach((pt, i) => {
      const prev = path[i - 1];
      if (prev) segments.push({ from: ll(prev), to: ll(pt), color, kind: 'sol' });
    });
  });
  return { pins, segments, unplaced, legend };
}
