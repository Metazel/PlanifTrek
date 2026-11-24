import { useMemo, useState } from 'react';
import { checkTrip, daysOfStop, describeAlert } from '../domain/coherence';
import { israelTrip } from '../domain/fixtures';
import type { Trip } from '../domain/types';

/**
 * Coquille de l'incrément 1. Le voyage d'exemple est chargé en mémoire uniquement :
 * rien n'est stocké sur l'appareil tant que le consentement n'est pas recueilli
 * (écran de consentement : prochaine itération).
 */
export function App() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const alerts = useMemo(() => (trip ? checkTrip(trip) : []), [trip]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">PlanifTrek</h1>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Version de développement
        </span>
      </header>

      <main className="flex flex-col gap-6">
        {!trip ? (
          <section
            aria-labelledby="vide"
            className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 id="vide" className="text-lg font-medium">
              Aucun voyage
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Chargez le circuit d'exemple pour découvrir l'itinéraire et les contrôles de cohérence. Rien n'est
              enregistré sur cet appareil.
            </p>
            <button
              type="button"
              onClick={() => setTrip(israelTrip())}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
            >
              Charger l'exemple
            </button>
          </section>
        ) : (
          <>
            <section aria-labelledby="itineraire">
              <h2 id="itineraire" className="mb-3 text-lg font-medium">
                {trip.name}
              </h2>
              <ol className="flex flex-col gap-3">
                {trip.stopOrder.map((id, i) => {
                  const s = trip.stops[id];
                  if (!s) return null;
                  const events = trip.events.filter((e) => e.stopId === id);
                  return (
                    <li
                      key={id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-medium">
                          <span className="tabular mr-2 text-slate-500">{i + 1}.</span>
                          {s.name}
                        </h3>
                        <p className="tabular text-sm text-slate-600 dark:text-slate-300">
                          {s.arrival} → {s.departure} · {daysOfStop(s).length} jour(s)
                        </p>
                      </div>
                      {events.length > 0 && (
                        <ul className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                          {events.map((e) => (
                            <li key={e.id}>{e.title}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            <section aria-labelledby="alertes" aria-live="polite">
              <h2 id="alertes" className="mb-2 text-lg font-medium">
                Contrôles
              </h2>
              {alerts.length === 0 ? (
                <p className="text-emerald-700 dark:text-emerald-400">✓ Aucune incohérence détectée.</p>
              ) : (
                <ul className="list-disc pl-5 text-amber-800 dark:text-amber-300">
                  {alerts.map((a, i) => (
                    <li key={i}>{describeAlert(a, trip)}</li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto text-sm text-slate-500">
        Données stockées uniquement sur cet appareil. Code source sous licence MIT.
      </footer>
    </div>
  );
}
