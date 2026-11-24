import { addDays, diffDays, nightsBetween } from './dates';
import type { Id, ISODate, Trip, TripEvent } from './types';

/** Réservé = un engagement existe : jamais déplacé automatiquement. */
export const isBooked = (e: TripEvent) => e.kind === 'hebergement' || !!e.bookingRef || !!e.paymentStatus;

/** Décale de `delta` jours les sous-étapes non réservées des étapes indiquées. */
export function shiftPlannedEvents(trip: Trip, deltas: Record<Id, number>): Trip {
  let changed = false;
  const events = trip.events.map((e) => {
    const d = deltas[e.stopId];
    if (!d || !e.date || isBooked(e)) return e;
    changed = true;
    return { ...e, date: addDays(e.date, d) };
  });
  return changed ? { ...trip, events } : trip;
}

/**
 * Bouton +/- : ajoute ou retire `delta` nuit(s) à une étape.
 * Les étapes suivantes glissent d'autant (durées gardées) ; leurs sous-étapes non réservées suivent.
 * Une étape ne descend pas sous 0 nuit.
 */
export function resizeStop(trip: Trip, id: Id, delta: number): Trip {
  const stop = trip.stops[id];
  if (!stop || !delta) return trip;
  const nights = diffDays(stop.arrival, stop.departure);
  const d = Math.max(-nights, delta);
  if (!d) return trip;
  const idx = trip.stopOrder.indexOf(id);
  const stops = { ...trip.stops, [id]: { ...stop, departure: addDays(stop.departure, d) } };
  const deltas: Record<Id, number> = {};
  for (const sid of trip.stopOrder.slice(idx + 1)) {
    const s = stops[sid];
    if (!s || s.arrival < stop.departure) continue;
    stops[sid] = { ...s, arrival: addDays(s.arrival, d), departure: addDays(s.departure, d) };
    deltas[sid] = d;
  }
  // Une sous-étape de la dernière journée retirée revient sur la nouvelle dernière journée.
  let next = shiftPlannedEvents({ ...trip, stops }, deltas);
  if (d < 0) {
    const last = addDays(stop.departure, d);
    next = {
      ...next,
      events: next.events.map((e) => (e.stopId === id && e.date && e.date > last && !isBooked(e) ? { ...e, date: last } : e)),
    };
  }
  return next;
}

/** Nuits d'une étape sans hébergement (pour proposer d'en ajouter un). */
export function uncoveredNights(trip: Trip, stopId: Id): ISODate[] {
  const s = trip.stops[stopId];
  if (!s) return [];
  const spans = trip.events.flatMap((e) => (e.kind === 'hebergement' && e.checkIn && e.checkOut ? [[e.checkIn, e.checkOut] as const] : []));
  return nightsBetween(s.arrival, s.departure).filter((n) => !spans.some(([a, b]) => a <= n && n < b));
}

const sameDay = (a: TripEvent, b: TripEvent) => a.stopId === b.stopId && a.kind !== 'hebergement' && b.kind !== 'hebergement' && a.date === b.date;

/** Monte (-1) ou descend (+1) une sous-étape au sein de sa journée. */
export function moveEvent(trip: Trip, id: Id, dir: -1 | 1): Trip {
  const i = trip.events.findIndex((e) => e.id === id);
  const ev = trip.events[i];
  if (!ev) return trip;
  let j = i + dir;
  while (j >= 0 && j < trip.events.length && !sameDay(ev, trip.events[j] as TripEvent)) j += dir;
  const other = trip.events[j];
  if (!other) return trip;
  const events = [...trip.events];
  events[i] = other;
  events[j] = ev;
  return { ...trip, events };
}

/** Réordonne les sous-étapes d'une journée selon `orderedIds` (glisser-déposer). */
export function reorderDay(trip: Trip, orderedIds: Id[]): Trip {
  const set = new Set(orderedIds);
  const slots = trip.events.map((e, i) => (set.has(e.id) ? i : -1)).filter((i) => i >= 0);
  if (slots.length !== orderedIds.length) return trip;
  const byId = new Map(trip.events.map((e) => [e.id, e]));
  const events = [...trip.events];
  for (const [k, slot] of slots.entries()) {
    const e = byId.get(orderedIds[k] ?? '');
    if (!e) return trip;
    events[slot] = e;
  }
  return { ...trip, events };
}

/** Transfère une sous-étape vers une autre étape (et un jour de cette étape), en fin de journée. */
export function transferEvent(trip: Trip, id: Id, stopId: Id, date?: ISODate): Trip {
  const ev = trip.events.find((e) => e.id === id);
  const target = trip.stops[stopId];
  if (!ev || !target || ev.kind === 'hebergement') return trip;
  const day = date && date >= target.arrival && date <= target.departure ? date : target.arrival;
  const moved = { ...ev, stopId, date: day };
  return { ...trip, events: [...trip.events.filter((e) => e.id !== id), moved] };
}
