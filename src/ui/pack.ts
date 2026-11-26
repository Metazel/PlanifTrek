import { packPlan, PACK_MAX_BYTES, type Tile } from '../domain/pack';
import type { Trip } from '../domain/types';
import { OPENFREEMAP_STYLE } from './mapStyle';

/**
 * Téléchargement du pack carte hors ligne (lancé par l'utilisateur, conforme aux limites OpenFreeMap :
 * 3 000 tuiles et 50 Mo au plus, 4 requêtes en parallèle). Tout est rangé dans le cache « pt-pack »,
 * que le service worker sert en priorité, en ligne comme hors ligne.
 */
const PACK = 'pt-pack';
const META = new URL('pack-meta.json', new URL(import.meta.env.BASE_URL, location.origin)).href;
const PARALLEL = 4;
// Plages de caractères : latin, latin étendu, hébreu, arabe, ponctuation.
const GLYPH_RANGES = ['0-255', '256-511', '1280-1535', '1536-1791', '8192-8447'];

export interface PackMeta {
  tripId: string;
  createdAt: string;
  tiles: number;
  bytes: number;
  failed: number;
  detail: number;
}

export async function packStatus(): Promise<PackMeta | null> {
  try {
    const res = await caches.match(META, { cacheName: PACK });
    return res ? ((await res.json()) as PackMeta) : null;
  } catch {
    return null;
  }
}

export async function deletePack(): Promise<void> {
  await caches.delete(PACK);
}

export function packEstimate(trip: Trip): { tiles: number; detail: number } | null {
  const p = packPlan(trip);
  return p && { tiles: p.tiles.length, detail: p.detail };
}

async function json(url: string, cache: Cache): Promise<unknown> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`Service de carte indisponible (${res.status})`);
  await cache.put(url, res.clone());
  return res.json();
}

/** Lit le style pour trouver tuiles, polices et icônes à mettre de côté. */
async function resources(cache: Cache): Promise<{ tileUrl: string; extra: string[] }> {
  const style = (await json(OPENFREEMAP_STYLE, cache)) as {
    sources?: Record<string, { type?: string; url?: string; tiles?: string[] }>;
    glyphs?: string;
    sprite?: string | Array<{ url: string }>;
    layers?: Array<{ layout?: Record<string, unknown> }>;
  };
  const vector = Object.values(style.sources ?? {}).find((s) => s.type === 'vector');
  if (!vector) throw new Error('Style de carte inattendu');
  let tiles = vector.tiles;
  if (!tiles && vector.url) tiles = ((await json(vector.url, cache)) as { tiles?: string[] }).tiles;
  const tileUrl = tiles?.[0];
  if (!tileUrl || !tileUrl.startsWith('https://tiles.openfreemap.org/')) throw new Error('Source de tuiles inattendue');
  const extra: string[] = [];
  const fonts = new Set<string>();
  for (const l of style.layers ?? []) {
    const f = l.layout?.['text-font'];
    if (Array.isArray(f) && f.every((x) => typeof x === 'string')) fonts.add(f.join(','));
  }
  if (style.glyphs) for (const f of fonts) for (const r of GLYPH_RANGES) extra.push(style.glyphs.replace('{fontstack}', encodeURIComponent(f)).replace('{range}', r));
  const sprites = typeof style.sprite === 'string' ? [style.sprite] : (style.sprite ?? []).map((s) => s.url);
  for (const s of sprites) for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) extra.push(`${s}${suffix}`);
  return { tileUrl, extra: extra.filter((u) => u.startsWith('https://tiles.openfreemap.org/')) };
}

export async function downloadPack(trip: Trip, onProgress: (done: number, total: number) => void, signal: AbortSignal): Promise<PackMeta> {
  const plan = packPlan(trip);
  if (!plan) throw new Error('Aucun lieu placé sur la carte, ou zone trop grande.');
  await caches.delete(PACK);
  const cache = await caches.open(PACK);
  const { tileUrl, extra } = await resources(cache);
  const urls = [...extra, ...plan.tiles.map((t: Tile) => tileUrl.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y)))];
  let done = 0;
  let bytes = 0;
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      if (signal.aborted) throw new DOMException('Annulé', 'AbortError');
      if (bytes > PACK_MAX_BYTES) throw new Error('Pack trop lourd (plus de 50 Mo) : placez moins de lieux éloignés.');
      const url = urls[next++] as string;
      try {
        const res = await fetch(url, { credentials: 'omit', signal });
        if (res.ok) {
          const body = await res.arrayBuffer();
          bytes += body.byteLength;
          await cache.put(url, new Response(body, { headers: res.headers }));
        } else if (res.status !== 404) failed++;
      } catch (err) {
        if (signal.aborted) throw err;
        failed++;
      }
      onProgress(++done, urls.length);
    }
  };
  try {
    await Promise.all(Array.from({ length: PARALLEL }, worker));
  } catch (err) {
    await caches.delete(PACK);
    throw err;
  }
  const meta: PackMeta = { tripId: trip.id, createdAt: new Date().toISOString(), tiles: plan.tiles.length, bytes, failed, detail: plan.detail };
  await cache.put(META, new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
  return meta;
}
