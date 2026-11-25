import { describe, expect, it } from 'vitest';
import { israelTrip } from '../domain/fixtures';
import { closeLoop } from '../domain/itinerary';
import type { Trip } from '../domain/types';
import { mapModel, rankColor } from './mapModel';

let n = 0;
const id = () => `g${++n}`;

describe('modèle de carte', () => {
  it('parcours linéaire : départ, étapes, arrivée ; un segment par paire', () => {
    const m = mapModel(israelTrip());
    expect(m.pins.map((p) => [p.numbers, p.role])).toEqual([[[1], 'depart'], [[2], 'etape'], [[3], 'arrivee']]);
    expect(m.segments.map((s) => s.kind)).toEqual(['sol', 'avion']);
  });
  it('boucle : départ et arrivée au même endroit fusionnés en « 1 · 4 »', () => {
    const m = mapModel(closeLoop(israelTrip(), id));
    expect(m.pins[0]).toMatchObject({ numbers: [1, 4], role: 'boucle' });
    expect(m.segments).toHaveLength(3);
  });
  it('étape sans position : sautée, signalée, segment « manquant »', () => {
    const t: Trip = israelTrip();
    t.stops = { ...t.stops, net: { ...t.stops.net!, point: undefined as never } };
    delete (t.stops.net as { point?: unknown }).point;
    const m = mapModel(t);
    expect(m.unplaced).toEqual(['Netanya']);
    expect(m.segments).toEqual([expect.objectContaining({ kind: 'manquant', rank: 0 })]);
    expect(m.pins.map((p) => p.numbers)).toEqual([[1], [3]]);
  });
  it('dégradé du vert au rouge', () => {
    expect(rankColor(0, 3)).toBe('hsl(150, 70%, 38%)');
    expect(rankColor(2, 3)).toBe('hsl(0, 70%, 38%)');
    expect(rankColor(0, 1)).toBe('hsl(150, 70%, 38%)');
  });
});

import { countryView, stopView } from './mapModel';

describe('vues pays et étape', () => {
  const trip = (): Trip => {
    const t = israelTrip();
    t.events = t.events.map((e) =>
      e.id === 'h-jer' ? { ...e, point: { lat: 31.77, lon: 35.22 } } : e.id === 'a-kotel' ? { ...e, point: { lat: 31.7767, lon: 35.2345 } } : e,
    );
    t.events.push({ id: 'brunch', stopId: 'jer', kind: 'repas', title: 'Brunch', date: '2027-08-11', point: { lat: 31.78, lon: 35.21 } });
    t.transports = t.transports.map((x) =>
      x.id === 't-jer-net' ? { ...x, departure: { ...x.departure!, point: { lat: 31.788, lon: 35.203 } }, arrival: { ...x.arrival!, point: { lat: 32.32, lon: 34.87 } } } : x,
    );
    return t;
  };
  it('pays : passe par l’hôtel, la gare de départ puis la gare d’arrivée', () => {
    const v = countryView(trip());
    const icons = v.pins.map((p) => p.text);
    expect(icons).toEqual(expect.arrayContaining(['🛏', '🚆']));
    expect(v.segments[0]?.from).toEqual([35.22, 31.77]);
    expect(v.segments[0]?.to).toEqual([35.203, 31.788]);
    expect(v.segments.some((s) => s.kind === 'avion')).toBe(true);
  });
  it('pays : une étape sans aucun point est sautée en gris pointillé', () => {
    const t = trip();
    t.stops = { ...t.stops, net: { ...t.stops.net!, point: undefined as never } };
    delete (t.stops.net as { point?: unknown }).point;
    t.transports = t.transports.filter((x) => x.id !== 't-jer-net');
    expect(countryView(t).segments.map((x) => x.kind)).toEqual(['manquant']);
  });
  it('étape : journée colorée, hôtel → sous-étapes → hôtel', () => {
    const v = stopView(trip(), 'jer');
    expect(v.legend.map((l) => l.label)).toEqual(['Jour 2 (11/08)', 'Jour 3 (12/08)']);
    expect(v.pins.filter((p) => p.cls.includes('pt-jour')).map((p) => p.text)).toEqual(['J2·1', 'J2·2']);
    expect(v.unplaced).toEqual(['Yad Vashem']);
    const day2 = v.segments.filter((s) => s.color === v.legend[0]?.color);
    expect(day2).toHaveLength(3);
    expect(day2[0]?.from).toEqual([35.22, 31.77]);
    expect(stopView(trip(), 'inconnue').pins).toEqual([]);
  });
});
