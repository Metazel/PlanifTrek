import type { GeoPoint, Trip } from './types';

/** Tuile « slippy map » z/x/y. */
export interface Tile {
  z: number;
  x: number;
  y: number;
}
export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Limites imposées par OpenFreeMap pour un téléchargement hors ligne lancé par l'utilisateur. */
export const PACK_MAX_TILES = 3000;
export const PACK_MAX_BYTES = 50 * 1024 * 1024;

const clampLat = (lat: number) => Math.max(-85.0511, Math.min(85.0511, lat));
export const lon2x = (lon: number, z: number) => Math.min(2 ** z - 1, Math.max(0, Math.floor(((lon + 180) / 360) * 2 ** z)));
export function lat2y(lat: number, z: number): number {
  const r = (clampLat(lat) * Math.PI) / 180;
  return Math.min(2 ** z - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)));
}

export function tilesIn(b: BBox, z: number): Tile[] {
  const out: Tile[] = [];
  for (let x = lon2x(b.west, z); x <= lon2x(b.east, z); x++) for (let y = lat2y(b.north, z); y <= lat2y(b.south, z); y++) out.push({ z, x, y });
  return out;
}

/** Tous les lieux placés du voyage (étapes, sous-étapes, gares, agences). Les adresses privées n'ont pas de position. */
export function tripPoints(trip: Trip): GeoPoint[] {
  const pts: Array<GeoPoint | undefined> = [
    ...Object.values(trip.stops).map((s) => s.point),
    ...trip.events.map((e) => e.point),
    ...trip.transports.flatMap((t) => [t.departure?.point, t.arrival?.point]),
    ...(trip.rentals ?? []).flatMap((r) => [r.pickup.point, r.dropoff.point]),
  ];
  return pts.filter((p): p is GeoPoint => !!p);
}

const around = (p: GeoPoint, km: number): BBox => {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
  return { west: p.lon - dLon, east: p.lon + dLon, south: p.lat - dLat, north: p.lat + dLat };
};

const key = (t: Tile) => `${t.z}/${t.x}/${t.y}`;

/**
 * Plan du pack : vue d'ensemble de la zone du voyage (zoom 0 à `overview`), puis détail des rues
 * autour de chaque lieu placé (rayon 3 km, jusqu'au zoom `detail`). Réduit automatiquement pour
 * rester sous la limite de tuiles.
 */
export function packPlan(trip: Trip, overview = 11, detail = 14): { tiles: Tile[]; overview: number; detail: number } | null {
  const pts = tripPoints(trip);
  if (!pts.length) return null;
  const m = 0.15;
  const area: BBox = {
    west: Math.min(...pts.map((p) => p.lon)) - m,
    east: Math.max(...pts.map((p) => p.lon)) + m,
    south: Math.min(...pts.map((p) => p.lat)) - m,
    north: Math.max(...pts.map((p) => p.lat)) + m,
  };
  const build = (ov: number, dt: number) => {
    const set = new Map<string, Tile>();
    for (let z = 0; z <= ov; z++) for (const t of tilesIn(area, z)) set.set(key(t), t);
    for (let z = ov + 1; z <= dt; z++) for (const p of pts) for (const t of tilesIn(around(p, 3), z)) set.set(key(t), t);
    return [...set.values()];
  };
  let ov = overview;
  let dt = detail;
  let tiles = build(ov, dt);
  while (tiles.length > PACK_MAX_TILES && (dt > ov + 1 || ov > 6)) {
    if (dt > ov + 1) dt--;
    else ov--;
    tiles = build(ov, dt);
  }
  return tiles.length > PACK_MAX_TILES ? null : { tiles, overview: ov, detail: dt };
}
