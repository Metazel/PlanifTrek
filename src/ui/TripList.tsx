import { useState, type FormEvent } from 'react';
import { israelTrip } from '../domain/fixtures';
import { checkTrip } from '../domain/coherence';
import type { Trip } from '../domain/types';
import { useStore, newId } from '../state/store';
import { btn, field } from './Dialog';
import { fmtDate } from './format';

function span(t: Trip): string {
  const stops = t.stopOrder.map((id) => t.stops[id]).filter((s) => !!s);
  if (!stops.length) return 'Aucune étape';
  const start = stops.map((s) => s.arrival).reduce((a, b) => (a < b ? a : b));
  const end = stops.map((s) => s.departure).reduce((a, b) => (a > b ? a : b));
  return `${fmtDate(start)} → ${fmtDate(end)} · ${stops.length} étape(s)`;
}

export function TripList() {
  const { trips, newTrip, openTrip, addTrip } = useStore();
  const [name, setName] = useState('');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await newTrip(name);
    setName('');
  };

  const loadExample = () => {
    const ex = israelTrip();
    // Copie avec un nouvel identifiant : l'exemple peut être chargé plusieurs fois.
    // Seules les étapes placées dans le parcours sont gardées.
    const stops = Object.fromEntries(ex.stopOrder.map((id) => [id, ex.stops[id]]).filter(([, s]) => !!s));
    void addTrip({ ...ex, id: newId(), name: `${ex.name} (exemple)`, stops });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="mes-voyages">
        <h2 id="mes-voyages" className="mb-3 text-lg font-semibold">
          Mes voyages
        </h2>
        {trips.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-300">Aucun voyage pour l'instant.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {trips.map((t) => {
              const alerts = checkTrip(t).length;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openTrip(t.id)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span className="block font-medium">{t.name}</span>
                    <span className="tabular block text-sm text-slate-600 dark:text-slate-300">{span(t)}</span>
                    <span className="mt-1 block text-sm">
                      {alerts ? `⚠ ${alerts} point(s) à vérifier` : '✓ Cohérent'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="nouveau"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 id="nouveau" className="mb-3 font-semibold">
          Nouveau voyage
        </h2>
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
            Nom du voyage
            <input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit" className={btn.primary}>
            Créer
          </button>
          <button type="button" className={btn.secondary} onClick={loadExample}>
            Charger l'exemple
          </button>
        </form>
      </section>
    </div>
  );
}
