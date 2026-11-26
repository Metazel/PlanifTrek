import { useEffect, useRef, useState } from 'react';
import type { Trip } from '../domain/types';
import { btn } from './Dialog';
import { deletePack, downloadPack, packEstimate, packStatus, type PackMeta } from './pack';

const mo = (b: number) => `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;

/** « Télécharger la carte pour le hors ligne » : estimation, progression, annulation, suppression. */
export function OfflinePanel({ trip }: { trip: Trip }) {
  const [meta, setMeta] = useState<PackMeta | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const supported = typeof caches !== 'undefined';
  const estimate = packEstimate(trip);

  useEffect(() => {
    void packStatus().then(setMeta);
  }, []);

  const start = async () => {
    setError('');
    abort.current = new AbortController();
    setProgress([0, 1]);
    try {
      setMeta(await downloadPack(trip, (d, t) => setProgress([d, t]), abort.current.signal));
    } catch (err) {
      setMeta(null);
      setError(err instanceof DOMException && err.name === 'AbortError' ? 'Téléchargement annulé.' : err instanceof Error ? err.message : 'Échec du téléchargement.');
    } finally {
      setProgress(null);
    }
  };

  if (!supported) return <p className="text-sm">Le hors-ligne n’est pas disponible dans ce navigateur.</p>;
  return (
    <div className="rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800" aria-live="polite">
      <p className="font-medium">🗺 Carte hors ligne</p>
      {meta && !progress && (
        <p className="mt-1 text-emerald-700 dark:text-emerald-400">
          ✓ Pack prêt : {meta.tiles} tuiles, {mo(meta.bytes)}, rues détaillées autour de chaque lieu
          {meta.tripId !== trip.id && ' (créé pour un autre voyage)'}
          {meta.failed > 0 && ` — ${meta.failed} éléments manquants`}.
        </p>
      )}
      {progress ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <progress className="h-2 flex-1" max={progress[1]} value={progress[0]} aria-label="Téléchargement du pack carte" />
          <span className="tabular">
            {progress[0]} / {progress[1]}
          </span>
          <button type="button" className={btn.secondary} onClick={() => abort.current?.abort()}>
            Annuler
          </button>
        </div>
      ) : estimate ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className={btn.secondary} onClick={() => void start()}>
            {meta ? 'Mettre à jour le pack' : 'Télécharger la carte du voyage'}
          </button>
          <span className="text-slate-600 dark:text-slate-400">≈ {estimate.tiles} tuiles, 50 Mo au plus</span>
          {meta && (
            <button type="button" className={btn.secondary} onClick={() => void deletePack().then(() => setMeta(null))}>
              Supprimer le pack
            </button>
          )}
        </div>
      ) : (
        <p className="mt-1">Placez au moins une étape sur la carte pour préparer le pack.</p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        L’application elle-même fonctionne sans réseau dès la première visite. Installez-la (menu ⋮ → « Ajouter à l’écran d’accueil »).
      </p>
    </div>
  );
}
