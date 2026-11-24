import { diffDays, isISODate } from './dates';
import { isValidTimeZone } from './time';
import type { Id, ISODate, Stop, StopKind, Trip, TripEvent } from './types';

/** Limites de saisie : bornent la taille des données stockées et affichées. */
export const LIMITS = {
  name: 80,
  title: 120,
  address: 200,
  bookingRef: 40,
  stops: 60,
  events: 500,
} as const;

/** Supprime les caractères de contrôle et de direction, réduit les espaces, tronque. */
export function cleanText(input: string, max: number): string {
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function createTrip(id: Id, name: string, baseCurrency = 'EUR'): Trip {
  return {
    id,
    name: cleanText(name, LIMITS.name) || 'Nouveau voyage',
    stopOrder: [],
    stops: {},
    events: [],
    transports: [],
    baseCurrency,
  };
}

export interface StopInput {
  name: string;
  kind: StopKind;
  timeZone: string;
  arrival: ISODate;
  departure: ISODate;
  privateAddress?: string;
}

export type StopError = 'nom-vide' | 'date-invalide' | 'depart-avant-arrivee' | 'fuseau-invalide' | 'trop-d-etapes';

/** Valide une saisie d'étape. Renvoie la liste des erreurs (vide si tout va bien). */
export function validateStop(input: StopInput): StopError[] {
  const errors: StopError[] = [];
  if (!cleanText(input.name, LIMITS.name)) errors.push('nom-vide');
  if (!isISODate(input.arrival) || !isISODate(input.departure)) errors.push('date-invalide');
  else if (diffDays(input.arrival, input.departure) < 0) errors.push('depart-avant-arrivee');
  if (!isValidTimeZone(input.timeZone)) errors.push('fuseau-invalide');
  return errors;
}

function toStop(id: Id, input: StopInput): Stop {
  const stop: Stop = {
    id,
    name: cleanText(input.name, LIMITS.name),
    kind: input.kind,
    timeZone: input.timeZone,
    arrival: input.arrival,
    departure: input.departure,
  };
  const address = input.privateAddress ? cleanText(input.privateAddress, LIMITS.address) : '';
  if (input.kind === 'famille' && address) stop.privateAddress = address;
  return stop;
}

/** Ajoute une étape en fin de parcours (ou à l'index donné). */
export function addStop(trip: Trip, id: Id, input: StopInput, index = trip.stopOrder.length): Trip {
  if (validateStop(input).length) throw new RangeError('Étape invalide');
  if (trip.stopOrder.length >= LIMITS.stops) throw new RangeError('Trop d’étapes');
  const order = [...trip.stopOrder];
  order.splice(Math.max(0, Math.min(index, order.length)), 0, id);
  return { ...trip, stopOrder: order, stops: { ...trip.stops, [id]: toStop(id, input) } };
}

export function updateStop(trip: Trip, id: Id, input: StopInput): Trip {
  if (!trip.stops[id]) throw new RangeError('Étape inconnue');
  if (validateStop(input).length) throw new RangeError('Étape invalide');
  return { ...trip, stops: { ...trip.stops, [id]: toStop(id, input) } };
}

/** Ce que la suppression d'une étape emporterait : à montrer avant confirmation. */
export function stopDependencies(trip: Trip, id: Id): { events: number; reservedTransports: number } {
  return {
    events: trip.events.filter((e) => e.stopId === id).length,
    reservedTransports: trip.transports.filter(
      (t) => (t.fromStopId === id || t.toStopId === id) && t.status !== 'brouillon',
    ).length,
  };
}

/** Supprime une étape, ses événements et les trajets qui la touchent (après confirmation). */
export function removeStop(trip: Trip, id: Id): Trip {
  if (!trip.stops[id]) return trip;
  const stops = Object.fromEntries(Object.entries(trip.stops).filter(([k]) => k !== id));
  return {
    ...trip,
    stopOrder: trip.stopOrder.filter((s) => s !== id),
    stops,
    events: trip.events.filter((e) => e.stopId !== id),
    transports: trip.transports.filter((t) => t.fromStopId !== id && t.toStopId !== id),
  };
}

export type EventInput = Omit<TripEvent, 'id'>;
export type EventError = 'titre-vide' | 'etape-inconnue' | 'date-invalide' | 'depart-avant-arrivee' | 'trop-d-evenements';

export function validateEvent(trip: Trip, input: EventInput): EventError[] {
  const errors: EventError[] = [];
  if (!cleanText(input.title, LIMITS.title)) errors.push('titre-vide');
  if (!trip.stops[input.stopId]) errors.push('etape-inconnue');
  if (input.kind === 'hebergement') {
    if (!input.checkIn || !input.checkOut || !isISODate(input.checkIn) || !isISODate(input.checkOut)) {
      errors.push('date-invalide');
    } else if (diffDays(input.checkIn, input.checkOut) <= 0) errors.push('depart-avant-arrivee');
  } else if (input.date !== undefined && !isISODate(input.date)) errors.push('date-invalide');
  return errors;
}

export function addEvent(trip: Trip, id: Id, input: EventInput): Trip {
  if (validateEvent(trip, input).length) throw new RangeError('Événement invalide');
  if (trip.events.length >= LIMITS.events) throw new RangeError('Trop d’événements');
  const event: TripEvent = { ...input, id, title: cleanText(input.title, LIMITS.title) };
  if (event.bookingRef !== undefined) event.bookingRef = cleanText(event.bookingRef, LIMITS.bookingRef);
  return { ...trip, events: [...trip.events, event] };
}

export function removeEvent(trip: Trip, id: Id): Trip {
  return { ...trip, events: trip.events.filter((e) => e.id !== id) };
}

export function renameTrip(trip: Trip, name: string): Trip {
  const clean = cleanText(name, LIMITS.name);
  return clean ? { ...trip, name: clean } : trip;
}

/** Fuseau proposé par défaut pour une nouvelle étape : celui de la dernière étape, sinon celui de l'appareil. */
export function defaultTimeZone(trip: Trip, deviceTz: string): string {
  const lastId = trip.stopOrder[trip.stopOrder.length - 1];
  const last = lastId ? trip.stops[lastId] : undefined;
  return last?.timeZone ?? (isValidTimeZone(deviceTz) ? deviceTz : 'Europe/Paris');
}

/** Dates proposées par défaut : départ de la dernière étape, une nuit. */
export function defaultDates(trip: Trip, today: ISODate): { arrival: ISODate; departure: ISODate } {
  const lastId = trip.stopOrder[trip.stopOrder.length - 1];
  const start = (lastId && trip.stops[lastId]?.departure) || today;
  const [y, m, d] = start.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { arrival: start, departure: next };
}
