import { z } from 'zod';
import type { GeoPoint } from '../domain/types';

/**
 * Recherche de lieu via Nominatim (OpenStreetMap), conforme à sa politique d'usage :
 * uniquement sur clic (pas d'autocomplétion), 1 requête par seconde au plus, résultats gardés en mémoire.
 * Jamais utilisée pour une adresse privée (étape famille).
 */
export interface Place {
  label: string;
  name: string;
  point: GeoPoint;
  timeZone?: string;
}

const result = z.array(
  z.object({
    lat: z.string(),
    lon: z.string(),
    name: z.string().max(200).optional(),
    display_name: z.string().max(500),
    address: z.object({ country_code: z.string().max(3).optional() }).optional(),
  }),
);

// Fuseau principal par pays (pays à fuseau unique ou dominant) ; sinon l'utilisateur choisit.
const TZ: Record<string, string> = {
  fr: 'Europe/Paris', il: 'Asia/Jerusalem', ps: 'Asia/Hebron', gb: 'Europe/London', ie: 'Europe/Dublin',
  es: 'Europe/Madrid', pt: 'Europe/Lisbon', it: 'Europe/Rome', de: 'Europe/Berlin', be: 'Europe/Brussels',
  nl: 'Europe/Amsterdam', ch: 'Europe/Zurich', at: 'Europe/Vienna', gr: 'Europe/Athens', tr: 'Europe/Istanbul',
  cy: 'Asia/Nicosia', ma: 'Africa/Casablanca', tn: 'Africa/Tunis', dz: 'Africa/Algiers', eg: 'Africa/Cairo',
  jo: 'Asia/Amman', ae: 'Asia/Dubai', jp: 'Asia/Tokyo', th: 'Asia/Bangkok', in: 'Asia/Kolkata',
  pl: 'Europe/Warsaw', cz: 'Europe/Prague', hu: 'Europe/Budapest', hr: 'Europe/Zagreb', se: 'Europe/Stockholm',
  no: 'Europe/Oslo', dk: 'Europe/Copenhagen', fi: 'Europe/Helsinki', is: 'Atlantic/Reykjavik', mt: 'Europe/Malta',
};

const cache = new Map<string, Place[]>();
let last = 0;

/** bias : zone à privilégier (lieux déjà placés du voyage), sans exclure le reste. */
export async function searchPlace(query: string, signal?: AbortSignal, bias?: { west: number; south: number; east: number; north: number }): Promise<Place[]> {
  const q = query.trim().slice(0, 120);
  if (q.length < 2) return [];
  const ck = `${q.toLowerCase()}|${bias ? [bias.west, bias.south, bias.east, bias.north].map((n) => n.toFixed(1)).join(',') : ''}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const vb = bias ? `&viewbox=${[bias.west, bias.north, bias.east, bias.south].map((n) => n.toFixed(3)).join(',')}&bounded=0` : '';
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=fr${vb}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: signal ?? null, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
  if (!res.ok) throw new Error(`Recherche indisponible (${res.status})`);
  const parsed = result.safeParse(await res.json());
  if (!parsed.success) throw new Error('Réponse inattendue du service de recherche');
  const places = parsed.data
    .map((r): Place | null => {
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
      const tz = TZ[r.address?.country_code ?? ''];
      return {
        label: r.display_name.slice(0, 160),
        name: (r.name || r.display_name.split(',')[0] || q).slice(0, 80),
        point: { lat, lon },
        ...(tz ? { timeZone: tz } : {}),
      };
    })
    .filter((p): p is Place => !!p);
  cache.set(ck, places);
  return places;
}
