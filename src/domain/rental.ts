import { cleanText } from './edit';
import { travelDuration } from './time';
import type { Id, ISODate, Rental, Trip } from './types';

export type RentalInput = Omit<Rental, 'id'>;
export type RentalError = 'agence-vide' | 'retour-avant-prise' | 'horaire-invalide';

export function validateRental(r: RentalInput): RentalError[] {
  const errors: RentalError[] = [];
  if (!cleanText(r.agency, 80)) errors.push('agence-vide');
  const d = travelDuration(r.pickup, r.dropoff);
  if (!d.ok) errors.push(d.reason === 'invalide' ? 'horaire-invalide' : 'retour-avant-prise');
  return errors;
}

function clean(id: Id, r: RentalInput): Rental {
  const out: Rental = {
    ...r,
    id,
    agency: cleanText(r.agency, 80),
    pickup: { ...r.pickup, place: cleanText(r.pickup.place, 120) },
    dropoff: { ...r.dropoff, place: cleanText(r.dropoff.place, 120) },
  };
  const vehicle = r.vehicle ? cleanText(r.vehicle, 80) : '';
  if (vehicle) out.vehicle = vehicle;
  else delete out.vehicle;
  const ref = r.bookingRef ? cleanText(r.bookingRef, 40) : '';
  if (ref) out.bookingRef = ref;
  else delete out.bookingRef;
  if (!r.important) delete out.important;
  return out;
}

export function saveRental(trip: Trip, id: Id, r: RentalInput): Trip {
  if (validateRental(r).length) throw new RangeError('Location invalide');
  const list = trip.rentals ?? [];
  if (!list.some((x) => x.id === id) && list.length >= 20) throw new RangeError('Trop de locations');
  const next = clean(id, r);
  const exists = list.some((x) => x.id === id);
  return { ...trip, rentals: exists ? list.map((x) => (x.id === id ? next : x)) : [...list, next] };
}

export function removeRental(trip: Trip, id: Id): Trip {
  return { ...trip, rentals: (trip.rentals ?? []).filter((r) => r.id !== id) };
}

/** Prises et retours de véhicule d'une journée, pour les afficher dans le planning. */
export function rentalMoments(trip: Trip, day: ISODate): Array<{ rental: Rental; kind: 'prise' | 'retour'; at: string }> {
  const out: Array<{ rental: Rental; kind: 'prise' | 'retour'; at: string }> = [];
  for (const r of trip.rentals ?? []) {
    if (r.pickup.at.slice(0, 10) === day) out.push({ rental: r, kind: 'prise', at: r.pickup.at });
    if (r.dropoff.at.slice(0, 10) === day) out.push({ rental: r, kind: 'retour', at: r.dropoff.at });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
