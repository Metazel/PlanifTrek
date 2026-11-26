import { toCsv, toGeoJson, toKml } from '../domain/exports';
import { mapPlaces } from '../domain/places';
import type { Trip } from '../domain/types';
import { btn } from './Dialog';

function save(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'voyage';

/** Exports des lieux placés pour Google My Maps (KML, CSV) et les outils cartographiques (GeoJSON). */
export function Exports({ trip }: { trip: Trip }) {
  const n = mapPlaces(trip).length;
  const base = `planiftrek-${slug(trip.name)}`;
  return (
    <section aria-labelledby="exports" className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
      <h2 id="exports" className="font-semibold">
        Exporter les lieux ({n})
      </h2>
      {n === 0 ? (
        <p className="mt-1">Placez des lieux sur la carte pour pouvoir les exporter.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} onClick={() => save(toKml(trip), `${base}.kml`, 'application/vnd.google-earth.kml+xml')}>
            KML (Google My Maps, par calques)
          </button>
          <button type="button" className={btn.secondary} onClick={() => save(toCsv(trip), `${base}.csv`, 'text/csv;charset=utf-8')}>
            CSV
          </button>
          <button type="button" className={btn.secondary} onClick={() => save(toGeoJson(trip), `${base}.geojson`, 'application/geo+json')}>
            GeoJSON
          </button>
        </div>
      )}
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Les lieux « famille » ne sont jamais exportés. Calques : étapes, hébergements, visites, transports, véhicules.</p>
    </section>
  );
}
