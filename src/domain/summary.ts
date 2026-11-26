import { checkTrip, type Alert } from './coherence';
import { diffDays, daysBetween, nightsBetween } from './dates';
import { nightInTransit } from './plan';
import { tripRange } from './today';
import type { ISODate, Money, Trip } from './types';

export interface TripSummary {
  start: ISODate;
  end: ISODate;
  days: number;
  stops: number;
  nights: { total: number; covered: number };
  transports: { total: number; reserved: number };
  rentals: number;
  placed: { done: number; total: number };
  alerts: Alert[];
  /** Engagé par devise (réservations avec prix), en unités mineures. */
  committed: Record<string, number>;
  /** Alertes par jour, pour la colonne d'état du tableau. */
  alertDays: Set<ISODate>;
}

/** Synthèse « ai-je tout rempli ? », affichée en tête du tableau. */
export function summarize(trip: Trip): TripSummary | null {
  const r = tripRange(trip);
  if (!r) return null;
  const alerts = checkTrip(trip);
  const nights = nightsBetween(r.start, r.end);
  const lodgings = trip.events.filter((e) => e.kind === 'hebergement' && e.checkIn && e.checkOut);
  const covered = nights.filter((n) => nightInTransit(trip, n) || lodgings.some((e) => (e.checkIn as string) <= n && n < (e.checkOut as string))).length;
  const legs = trip.stopOrder.length - 1;
  const committed: Record<string, number> = {};
  const add = (m?: Money) => {
    if (m) committed[m.currency] = (committed[m.currency] ?? 0) + m.amountMinor;
  };
  trip.events.forEach((e) => add(e.price));
  trip.transports.forEach((t) => add(t.price));
  (trip.rentals ?? []).forEach((x) => add(x.price));
  const stops = trip.stopOrder.map((id) => trip.stops[id]).filter((s) => !!s);
  const alertDays = new Set<ISODate>();
  for (const a of alerts) {
    if (a.kind === 'nuit-sans-hebergement' || a.kind === 'hebergements-chevauchants') alertDays.add(a.night);
    if (a.kind === 'activite-hors-dates' || a.kind === 'hebergement-hors-etape') {
      const s = trip.stops[a.stopId];
      if (s) daysBetween(s.arrival, s.departure).forEach((d) => alertDays.add(d));
    }
  }
  return {
    start: r.start,
    end: r.end,
    days: diffDays(r.start, r.end) + 1,
    stops: stops.length,
    nights: { total: nights.length, covered },
    transports: { total: Math.max(0, legs), reserved: trip.transports.filter((t) => t.status === 'reserve').length },
    rentals: (trip.rentals ?? []).length,
    placed: { done: stops.filter((s) => s.point || s.kind === 'famille').length, total: stops.length },
    alerts,
    committed,
    alertDays,
  };
}
