import { describe, expect, it } from 'vitest';
import { israelTrip } from './fixtures';
import { lat2y, lon2x, packPlan, PACK_MAX_TILES, tilesIn, tripPoints } from './pack';
import { createTrip } from './edit';

describe('pack carte hors ligne', () => {
  it('conversion standard des coordonnées en tuiles', () => {
    expect([lon2x(0, 1), lat2y(0, 1)]).toEqual([1, 1]);
    expect([lon2x(35.2345, 14), lat2y(31.7767, 14)]).toEqual([9795, 6665]);
    expect(lat2y(89.9, 3)).toBe(0);
    expect(tilesIn({ west: -1, east: 1, south: -1, north: 1 }, 0)).toEqual([{ z: 0, x: 0, y: 0 }]);
  });
  it('voyage Israël : sous la limite OpenFreeMap, détail des rues autour des lieux', () => {
    const p = packPlan(israelTrip());
    expect(p).not.toBeNull();
    expect(p!.tiles.length).toBeLessThanOrEqual(PACK_MAX_TILES);
    expect(p!.detail).toBe(14);
    expect(p!.tiles.some((t) => t.z === 14 && t.x === 9795 && t.y === 6665)).toBe(true);
  });
  it('réduit le détail si la zone est immense ; rien à télécharger sans lieu placé', () => {
    const t = israelTrip();
    t.stops = { ...t.stops, ny: { ...t.stops.jer!, id: 'ny', point: { lat: 40.7, lon: -74 } } };
    const p = packPlan(t);
    expect(p === null || p.tiles.length <= PACK_MAX_TILES).toBe(true);
    expect(packPlan(createTrip('x', 'vide'))).toBeNull();
    expect(tripPoints(israelTrip())).toHaveLength(5);
  });
});
