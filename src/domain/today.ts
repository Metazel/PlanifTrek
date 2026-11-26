import { addDays } from './dates';
import { departureAdvice } from './reminders';
import { rentalMoments } from './rental';
import type { GeoPoint, ISODate, Stop, Trip, TripEvent } from './types';

export type DayItemKind = 'evenement' | 'depart' | 'arrivee' | 'partir' | 'vehicule';
export interface DayItem {
  key: string;
  kind: DayItemKind;
  /** Heure locale HH:mm si connue. */
  time?: string;
  title: string;
  icon: string;
  point?: GeoPoint;
  event?: TripEvent;
  phone?: string;
  contact?: string;
}

export interface DayPlan {
  date: ISODate;
  stops: Stop[];
  lodging?: TripEvent;
  items: DayItem[];
}

const ICON: Record<string, string> = { repas: '🍽', deplacement: '🚗', visite: '🏛', activite: '🎯', famille: '👪', evenement: '🎉', 'temps-libre': '☀' };

export function tripRange(trip: Trip): { start: ISODate; end: ISODate } | null {
  const s = trip.stopOrder.map((id) => trip.stops[id]).filter((x): x is Stop => !!x);
  if (!s.length) return null;
  return { start: s.map((x) => x.arrival).reduce((a, b) => (a < b ? a : b)), end: s.map((x) => x.departure).reduce((a, b) => (a > b ? a : b)) };
}

/** Jour à montrer : aujourd'hui pendant le voyage, sinon le premier jour (ou le dernier une fois rentré). */
export function defaultDay(trip: Trip, today: ISODate): ISODate | null {
  const r = tripRange(trip);
  if (!r) return null;
  return today < r.start ? r.start : today > r.end ? r.end : today;
}

/**
 * Programme d'une journée : sous-étapes dans l'ordre choisi, avec les trajets, l'heure conseillée
 * pour partir et les prises/retours de véhicule insérés à leur heure.
 */
export function dayPlan(trip: Trip, date: ISODate): DayPlan {
  const stops = trip.stopOrder.map((id) => trip.stops[id]).filter((s): s is Stop => !!s && s.arrival <= date && date <= s.departure);
  const lodging = trip.events.find((e) => e.kind === 'hebergement' && e.checkIn && e.checkOut && e.checkIn <= date && date < e.checkOut);
  const timed: DayItem[] = [];
  const sub: DayItem[] = trip.events
    .filter((e) => e.kind !== 'hebergement' && e.date === date && stops.some((s) => s.id === e.stopId))
    .map((e) => ({
      key: e.id,
      kind: 'evenement' as const,
      title: e.title,
      icon: e.important ? '⭐' : (ICON[e.kind] ?? '•'),
      event: e,
      ...(e.time ? { time: e.time } : {}),
      ...(e.point ? { point: e.point } : {}),
      ...(e.contact?.phone ? { phone: e.contact.phone, contact: e.contact.name } : {}),
    }));
  for (const t of trip.transports) {
    const to = trip.stops[t.toStopId]?.name ?? '';
    const from = trip.stops[t.fromStopId]?.name ?? '';
    const icon = t.mode === 'avion' ? '✈' : t.mode === 'train' ? '🚆' : t.mode === 'bus' ? '🚌' : t.mode === 'bateau' ? '⛴' : '🚗';
    const adv = departureAdvice(trip, t);
    if (adv && adv.leaveAt.slice(0, 10) === date && adv.leaveAt !== t.departure?.at) {
      timed.push({ key: `${t.id}-partir`, kind: 'partir', time: adv.leaveAt.slice(11), title: `Partir pour ${t.departure?.place ?? to}`, icon: '⏰', ...(t.departure?.point ? { point: t.departure.point } : {}) });
    }
    if (t.departure?.at.slice(0, 10) === date) {
      timed.push({ key: `${t.id}-dep`, kind: 'depart', time: t.departure.at.slice(11), title: `Départ vers ${to}${t.bookingRef ? ` (${t.bookingRef})` : ''} — ${t.departure.place}`, icon, ...(t.departure.point ? { point: t.departure.point } : {}) });
    }
    if (t.arrival?.at.slice(0, 10) === date) {
      timed.push({ key: `${t.id}-arr`, kind: 'arrivee', time: t.arrival.at.slice(11), title: `Arrivée de ${from} — ${t.arrival.place}`, icon, ...(t.arrival.point ? { point: t.arrival.point } : {}) });
    }
  }
  for (const m of rentalMoments(trip, date)) {
    const e = m.kind === 'prise' ? m.rental.pickup : m.rental.dropoff;
    timed.push({ key: `${m.rental.id}-${m.kind}`, kind: 'vehicule', time: m.at.slice(11), title: `${m.kind === 'prise' ? 'Prendre' : 'Rendre'} le véhicule — ${m.rental.agency} (${e.place})`, icon: '🚙', ...(e.point ? { point: e.point } : {}) });
  }
  // Fusion : les éléments horaires s'insèrent avant la première sous-étape plus tardive ; l'ordre des sous-étapes est conservé.
  timed.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const items: DayItem[] = [];
  let i = 0;
  for (const s of sub) {
    while (i < timed.length && s.time && (timed[i]?.time ?? '') <= s.time) items.push(timed[i++] as DayItem);
    items.push(s);
  }
  while (i < timed.length) items.push(timed[i++] as DayItem);
  return { date, stops, ...(lodging ? { lodging } : {}), items };
}

export const prevDay = (d: ISODate) => addDays(d, -1);
export const nextDay = (d: ISODate) => addDays(d, 1);
