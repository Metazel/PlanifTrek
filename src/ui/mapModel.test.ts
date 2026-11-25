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
