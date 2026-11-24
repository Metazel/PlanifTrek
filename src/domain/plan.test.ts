import { describe, expect, it } from 'vitest';
import { checkTrip } from './coherence';
import { addStop } from './edit';
import { israelTrip } from './fixtures';
import { moveEvent, reorderDay, resizeStop, transferEvent, uncoveredNights } from './plan';
import type { Trip } from './types';

const ids = (t: Trip, stopId: string) => t.events.filter((e) => e.stopId === stopId).map((e) => e.id);

describe('étape de passage et demi-journée', () => {
  it('passage TLV le matin puis Jérusalem l’après-midi : aucune nuit exigée à TLV', () => {
    let t = israelTrip();
    t = { ...t, stops: { ...t.stops } };
    t = addStop(t, 'pass', { name: 'Aéroport Ben Gourion', kind: 'passage', timeZone: 'Asia/Jerusalem', arrival: '2027-08-10', departure: '2027-08-12', arrivalTime: '09:30', departureTime: '11:00' }, 0);
    expect(t.stops.pass).toMatchObject({ departure: '2027-08-10', arrivalTime: '09:30' });
    expect(checkTrip(t)).toEqual([]);
  });
});

describe('+/- jours sur une étape', () => {
  it('+1 à Jérusalem : les étapes suivantes glissent, la visite famille suit, les hôtels réservés non', () => {
    const t = resizeStop(israelTrip(), 'jer', 1);
    expect(t.stops.jer?.departure).toBe('2027-08-14');
    expect(t.stops.net).toMatchObject({ arrival: '2027-08-14', departure: '2027-08-17' });
    expect(t.events.find((e) => e.id === 'f-cousins')?.date).toBe('2027-08-15');
    expect(t.events.find((e) => e.id === 'h-net')?.checkIn).toBe('2027-08-13');
    expect(checkTrip(t).some((a) => a.kind === 'nuit-sans-hebergement')).toBe(true);
  });
  it('-1 ramène la visite du dernier jour sur le nouveau dernier jour ; jamais sous 0 nuit', () => {
    let t = resizeStop(israelTrip(), 'jer', -1);
    expect(t.stops.jer?.departure).toBe('2027-08-12');
    t = resizeStop(t, 'jer', -10);
    expect(t.stops.jer?.departure).toBe('2027-08-10');
    expect(t.events.filter((e) => e.stopId === 'jer' && e.kind === 'visite').every((e) => e.date === '2027-08-10')).toBe(true);
    expect(resizeStop(t, 'jer', -1)).toBe(t);
    expect(resizeStop(t, 'inconnue', 1)).toBe(t);
  });
  it('signale les nuits d’une étape sans hébergement', () => {
    const t = { ...israelTrip(), events: israelTrip().events.filter((e) => e.id !== 'h-jer') };
    expect(uncoveredNights(t, 'jer')).toEqual(['2027-08-10', '2027-08-11', '2027-08-12']);
    expect(uncoveredNights(israelTrip(), 'jer')).toEqual([]);
  });
});

describe('sous-étapes', () => {
  const day = (t: Trip) => t.events.filter((e) => e.stopId === 'jer' && e.date === '2027-08-11').map((e) => e.id);
  const base = (): Trip => {
    const t = israelTrip();
    t.events.push(
      { id: 'brunch', stopId: 'jer', kind: 'repas', title: 'Brunch', date: '2027-08-11', time: '10:00' },
      { id: 'diner', stopId: 'jer', kind: 'repas', title: 'Dîner', date: '2027-08-11' },
    );
    return t;
  };
  it('monte et descend dans la journée, sans franchir les bornes', () => {
    let t = moveEvent(base(), 'brunch', -1);
    expect(day(t)).toEqual(['brunch', 'a-kotel', 'diner']);
    expect(moveEvent(t, 'brunch', -1)).toBe(t);
    t = moveEvent(t, 'brunch', 1);
    expect(day(t)).toEqual(['a-kotel', 'brunch', 'diner']);
  });
  it('réordonne une journée par glisser-déposer', () => {
    expect(day(reorderDay(base(), ['diner', 'a-kotel', 'brunch']))).toEqual(['diner', 'a-kotel', 'brunch']);
    expect(reorderDay(base(), ['diner', 'inconnu'])).toEqual(base());
  });
  it('transfère vers une autre étape, au jour demandé s’il en fait partie', () => {
    let t = transferEvent(base(), 'diner', 'net', '2027-08-14');
    expect(t.events.find((e) => e.id === 'diner')).toMatchObject({ stopId: 'net', date: '2027-08-14' });
    t = transferEvent(t, 'diner', 'eil', '2027-01-01');
    expect(t.events.find((e) => e.id === 'diner')).toMatchObject({ stopId: 'eil', date: '2027-08-16' });
    expect(transferEvent(t, 'h-jer', 'net')).toBe(t);
    expect(ids(t, 'jer')).not.toContain('diner');
  });
});
