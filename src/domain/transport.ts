import { cleanText, LIMITS } from './edit';
import { travelDuration } from './time';
import type { Id, Money, PaymentStatus, Transport, TransportEndpoint, TransportMode, TransportStatus, Trip } from './types';

export interface TransportInput {
  mode: TransportMode;
  status: TransportStatus;
  departure?: TransportEndpoint;
  arrival?: TransportEndpoint;
  bookingRef?: string;
  price?: Money;
  paymentStatus?: PaymentStatus;
}

export type TransportError = 'arrivee-avant-depart' | 'horaire-invalide' | 'etape-inconnue';

export function validateTransport(input: TransportInput): TransportError[] {
  if (!input.departure || !input.arrival) return [];
  const d = travelDuration(input.departure, input.arrival);
  return d.ok ? [] : [d.reason === 'invalide' ? 'horaire-invalide' : 'arrivee-avant-depart'];
}

/** Durée en minutes si les deux horaires sont connus et cohérents. */
export function transportMinutes(t: Transport): number | null {
  if (!t.departure || !t.arrival) return null;
  const d = travelDuration(t.departure, t.arrival);
  return d.ok ? d.minutes : null;
}

const endpoint = (e: TransportEndpoint): TransportEndpoint => ({ ...e, place: cleanText(e.place, 120) });

export function addTransport(trip: Trip, id: Id, fromStopId: Id, toStopId: Id): Trip {
  if (!trip.stops[fromStopId] || !trip.stops[toStopId]) throw new RangeError('Étape inconnue');
  return { ...trip, transports: [...trip.transports, { id, fromStopId, toStopId, mode: 'voiture', status: 'brouillon' }] };
}

export function updateTransport(trip: Trip, id: Id, input: TransportInput): Trip {
  const t = trip.transports.find((x) => x.id === id);
  if (!t) throw new RangeError('Trajet inconnu');
  if (validateTransport(input).length) throw new RangeError('Trajet invalide');
  const next: Transport = { id, fromStopId: t.fromStopId, toStopId: t.toStopId, mode: input.mode, status: input.status };
  if (input.departure) next.departure = endpoint(input.departure);
  if (input.arrival) next.arrival = endpoint(input.arrival);
  const ref = input.bookingRef ? cleanText(input.bookingRef, LIMITS.bookingRef) : '';
  if (ref) next.bookingRef = ref;
  if (input.price) next.price = input.price;
  if (input.paymentStatus) next.paymentStatus = input.paymentStatus;
  return { ...trip, transports: trip.transports.map((x) => (x.id === id ? next : x)) };
}

export function removeTransport(trip: Trip, id: Id): Trip {
  return { ...trip, transports: trip.transports.filter((t) => t.id !== id) };
}

/** Trajet de l'étape `from` vers `to`, s'il existe. */
export const legOf = (trip: Trip, from: Id, to: Id) => trip.transports.find((t) => t.fromStopId === from && t.toStopId === to);
