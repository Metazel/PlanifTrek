import { describe, expect, it } from 'vitest';
import { israelTrip } from './fixtures';
import { rentalMoments, removeRental, saveRental, validateRental, type RentalInput } from './rental';
import { reminders } from './reminders';
import { parseTrip } from './schema';

const TZ = 'Asia/Jerusalem';
const car = (o: Partial<RentalInput> = {}): RentalInput => ({
  agency: ' Hertz  Ben-Gourion ',
  vehicle: 'Kia Picanto',
  pickup: { place: 'Aéroport Ben-Gourion', at: '2027-08-10T09:30', timeZone: TZ },
  dropoff: { place: 'Jérusalem, King David', at: '2027-08-13T10:00', timeZone: TZ },
  bookingRef: 'H-123',
  important: true,
  ...o,
});

describe('location de véhicule', () => {
  it('enregistre, nettoie, modifie et retire ; plusieurs locations possibles', () => {
    let t = saveRental(israelTrip(), 'r1', car());
    t = saveRental(t, 'r2', car({ agency: 'Eldan Eilat', pickup: { place: 'Eilat', at: '2027-08-16T12:00', timeZone: TZ }, dropoff: { place: 'Eilat', at: '2027-08-19T09:00', timeZone: TZ } }));
    expect(t.rentals?.map((r) => r.agency)).toEqual(['Hertz Ben-Gourion', 'Eldan Eilat']);
    t = saveRental(t, 'r1', car({ vehicle: '' }));
    expect(t.rentals?.[0]?.vehicle).toBeUndefined();
    expect(removeRental(t, 'r1').rentals).toHaveLength(1);
    expect(parseTrip(JSON.parse(JSON.stringify(t))).ok).toBe(true);
  });
  it('refuse agence vide et retour avant la prise', () => {
    expect(validateRental(car({ agency: ' ' }))).toEqual(['agence-vide']);
    expect(validateRental(car({ dropoff: { place: 'x', at: '2027-08-10T09:00', timeZone: TZ } }))).toEqual(['retour-avant-prise']);
    expect(() => saveRental(israelTrip(), 'x', car({ agency: '' }))).toThrow(RangeError);
  });
  it('apparaît dans le planning du jour et dans les rappels', () => {
    const t = saveRental(israelTrip(), 'r1', car());
    expect(rentalMoments(t, '2027-08-10').map((m) => m.kind)).toEqual(['prise']);
    expect(rentalMoments(t, '2027-08-13').map((m) => m.kind)).toEqual(['retour']);
    const r = reminders(t).map((x) => x.title);
    expect(r).toEqual(['Prendre le véhicule (Kia Picanto) — Hertz Ben-Gourion', 'Rendre le véhicule (Kia Picanto) — Hertz Ben-Gourion']);
  });
  it('anciens voyages sans locations : toujours lisibles', () => {
    const t = israelTrip();
    expect(t.rentals).toBeUndefined();
    expect(parseTrip(JSON.parse(JSON.stringify(t))).ok).toBe(true);
  });
});
