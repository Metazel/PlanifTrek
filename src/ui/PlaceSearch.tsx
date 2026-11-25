import { useState } from 'react';
import type { GeoPoint } from '../domain/types';
import { btn } from './Dialog';
import { searchPlace, type Place } from './geocode';

/**
 * Bouton « Chercher » + liste de lieux à choisir (Nominatim, sur clic uniquement).
 * Un seul résultat : retenu directement. Tant qu'un choix est attendu, `onPending(true)`.
 */
export function PlaceSearch({
  query,
  point,
  onPick,
  onPending,
}: {
  query: string;
  point?: GeoPoint | undefined;
  onPick: (p: Place) => void;
  onPending?: (pending: boolean) => void;
}) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const show = (list: Place[] | null) => {
    setPlaces(list);
    onPending?.(!!list?.length);
  };
  const pick = (p: Place) => {
    show(null);
    onPick(p);
  };
  const search = async () => {
    setBusy(true);
    setError('');
    try {
      const found = await searchPlace(query);
      if (found.length === 1 && found[0]) pick(found[0]);
      else show(found);
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'Recherche impossible'}. Saisissez le nom à la main.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn.secondary} disabled={busy || query.trim().length < 2} onClick={() => void search()}>
          {busy ? 'Recherche…' : '📍 Chercher le lieu'}
        </button>
        {point && <span className="text-emerald-700 dark:text-emerald-400">✓ placé sur la carte</span>}
      </div>
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {places && (
        <div role="region" aria-label="Lieux trouvés" aria-live="polite">
          {places.length === 0 ? (
            <p>Aucun lieu trouvé : gardez votre saisie.</p>
          ) : (
            <>
              <p className="font-medium">Choisissez le lieu correspondant :</p>
              <ul className="mt-1 flex flex-col gap-1 rounded-xl border-2 border-blue-600 p-1">
                {places.map((p) => (
                  <li key={`${p.point.lat},${p.point.lon}`}>
                    <button type="button" className="min-h-11 w-full rounded-xl px-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => pick(p)}>
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-1 min-h-11 underline" onClick={() => show(null)}>
                Garder ma saisie sans position
              </button>
            </>
          )}
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Recherche © OpenStreetMap contributors (Nominatim)</p>
        </div>
      )}
    </div>
  );
}
