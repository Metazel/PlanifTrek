import { daysBetween, diffDays, nightsBetween } from './dates';
import type { Id, ISODate, Stop, Trip, TripEvent } from './types';

export type Alert =
  | { kind: 'dates-etape-invalides'; stopId: Id }
  | { kind: 'trou-entre-etapes'; fromStopId: Id; toStopId: Id; days: number }
  | { kind: 'chevauchement-etapes'; fromStopId: Id; toStopId: Id; days: number }
  | { kind: 'nuit-sans-hebergement'; night: ISODate }
  | { kind: 'hebergements-chevauchants'; night: ISODate; eventIds: Id[] }
  | { kind: 'hebergement-hors-etape'; eventId: Id; stopId: Id }
  | { kind: 'activite-hors-dates'; eventId: Id; stopId: Id }
  | { kind: 'rattachement-inconnu'; eventId: Id };

const isLodging = (e: TripEvent) => e.kind === 'hebergement' && !!e.checkIn && !!e.checkOut;

/**
 * Contrôles de cohérence de l'itinéraire. Fonction pure, sans effet de bord :
 * appelée après chaque modification pour afficher les alertes.
 */
export function checkTrip(trip: Trip): Alert[] {
  const alerts: Alert[] = [];
  const ordered = trip.stopOrder.map((id) => trip.stops[id]).filter((s): s is Stop => !!s);

  // 1. Dates de chaque étape, puis enchaînement des étapes.
  for (const s of ordered) {
    if (diffDays(s.arrival, s.departure) < 0) alerts.push({ kind: 'dates-etape-invalides', stopId: s.id });
  }
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1] as Stop;
    const cur = ordered[i] as Stop;
    const gap = diffDays(prev.departure, cur.arrival);
    if (gap > 0) alerts.push({ kind: 'trou-entre-etapes', fromStopId: prev.id, toStopId: cur.id, days: gap });
    if (gap < 0) alerts.push({ kind: 'chevauchement-etapes', fromStopId: prev.id, toStopId: cur.id, days: -gap });
  }

  // 2. Rattachement et dates des événements.
  for (const e of trip.events) {
    const stop = trip.stops[e.stopId];
    if (!stop) {
      alerts.push({ kind: 'rattachement-inconnu', eventId: e.id });
      continue;
    }
    if (isLodging(e)) {
      if ((e.checkIn as ISODate) < stop.arrival || (e.checkOut as ISODate) > stop.departure) {
        alerts.push({ kind: 'hebergement-hors-etape', eventId: e.id, stopId: stop.id });
      }
    } else if (e.date && (e.date < stop.arrival || e.date > stop.departure)) {
      alerts.push({ kind: 'activite-hors-dates', eventId: e.id, stopId: stop.id });
    }
  }

  // 3. Chaque nuit du voyage : exactement un hébergement.
  if (ordered.length) {
    const start = ordered.map((s) => s.arrival).reduce((a, b) => (a < b ? a : b));
    const end = ordered.map((s) => s.departure).reduce((a, b) => (a > b ? a : b));
    const lodgings = trip.events.filter((e) => isLodging(e) && trip.stops[e.stopId]);
    for (const night of nightsBetween(start, end)) {
      const covering = lodgings.filter((e) => (e.checkIn as ISODate) <= night && night < (e.checkOut as ISODate));
      if (covering.length === 0) alerts.push({ kind: 'nuit-sans-hebergement', night });
      else if (covering.length > 1) {
        alerts.push({ kind: 'hebergements-chevauchants', night, eventIds: covering.map((e) => e.id) });
      }
    }
  }
  return alerts;
}

/** Journées générées automatiquement pour une étape (bornes incluses). */
export function daysOfStop(stop: Stop): ISODate[] {
  return daysBetween(stop.arrival, stop.departure);
}

/** Message lisible d'une alerte, pour l'affichage et les lecteurs d'écran. */
export function describeAlert(a: Alert, trip: Trip): string {
  const name = (id: Id) => trip.stops[id]?.name ?? 'étape inconnue';
  const title = (id: Id) => trip.events.find((e) => e.id === id)?.title ?? 'événement';
  const fmt = (d: ISODate) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  switch (a.kind) {
    case 'dates-etape-invalides':
      return `${name(a.stopId)} : le départ est avant l'arrivée.`;
    case 'trou-entre-etapes':
      return `${a.days} jour(s) non planifié(s) entre ${name(a.fromStopId)} et ${name(a.toStopId)}.`;
    case 'chevauchement-etapes':
      return `${name(a.fromStopId)} et ${name(a.toStopId)} se chevauchent de ${a.days} jour(s).`;
    case 'nuit-sans-hebergement':
      return `Nuit du ${fmt(a.night)} sans hébergement.`;
    case 'hebergements-chevauchants':
      return `Nuit du ${fmt(a.night)} : ${a.eventIds.length} hébergements se chevauchent.`;
    case 'hebergement-hors-etape':
      return `« ${title(a.eventId)} » ne correspond plus aux dates de ${name(a.stopId)}.`;
    case 'activite-hors-dates':
      return `« ${title(a.eventId)} » est hors des dates de ${name(a.stopId)}.`;
    case 'rattachement-inconnu':
      return `« ${title(a.eventId)} » n'est rattaché à aucune étape.`;
  }
}
