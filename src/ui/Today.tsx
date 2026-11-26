import { useState } from 'react';
import { googleMapsDayLinks, googleMapsPlace } from '../domain/exports';
import { telHref } from '../domain/reminders';
import { dayPlan, defaultDay, nextDay, prevDay, tripRange } from '../domain/today';
import type { Trip } from '../domain/types';
import { btn } from './Dialog';
import { fmtDay, todayISO } from './format';

const link = `${btn.secondary} inline-flex items-center`;

/** Vue « Aujourd'hui » : ce qu'il faut faire, où et quand, utilisable d'une main et hors ligne. */
export function Today({ trip }: { trip: Trip }) {
  const today = todayISO();
  const range = tripRange(trip);
  const [day, setDay] = useState(() => defaultDay(trip, today));
  if (!range || !day) return <p>Ajoutez des étapes pour voir le programme de la journée.</p>;
  const plan = dayPlan(trip, day);
  const routes = googleMapsDayLinks(plan);
  const isToday = day === today;

  return (
    <section aria-labelledby="aujourdhui" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn.icon} disabled={day <= range.start} onClick={() => setDay(prevDay(day))} aria-label="Jour précédent">
          ◀
        </button>
        <h2 id="aujourdhui" className="min-w-0 flex-1 text-center text-xl font-semibold">
          {isToday ? 'Aujourd’hui, ' : ''}
          {fmtDay(day)}
        </h2>
        <button type="button" className={btn.icon} disabled={day >= range.end} onClick={() => setDay(nextDay(day))} aria-label="Jour suivant">
          ▶
        </button>
      </div>
      {!isToday && (today < range.start || today > range.end) && (
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">Aperçu : le voyage n’a pas lieu aujourd’hui.</p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="font-medium">📍 {plan.stops.map((s) => s.name).join(' → ') || 'Aucune étape ce jour-là'}</p>
        {plan.lodging ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            🛏 Ce soir : {plan.lodging.title}
            {plan.lodging.point && (
              <a className={link} href={googleMapsPlace(plan.lodging.point)} target="_blank" rel="noopener noreferrer">
                🧭 Y aller
              </a>
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">🛏 Pas d’hébergement prévu ce soir.</p>
        )}
      </div>

      {plan.items.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">Rien de prévu ce jour-là.</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Programme de la journée">
          {plan.items.map((it) => (
            <li
              key={it.key}
              className={`flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm dark:bg-slate-900 ${it.kind === 'partir' ? 'border-blue-500' : 'border-slate-200 dark:border-slate-800'}`}
            >
              <span className="tabular w-12 shrink-0 font-semibold">{it.time ?? ''}</span>
              <span aria-hidden="true">{it.icon}</span>
              <span className="min-w-0 flex-1 basis-40">{it.title}</span>
              {it.phone && (
                <a className={link} href={telHref(it.phone)}>
                  📞 {it.contact}
                </a>
              )}
              {it.point && it.event?.kind !== 'famille' && (
                <a className={link} href={googleMapsPlace(it.point)} target="_blank" rel="noopener noreferrer" aria-label={`Y aller : ${it.title} (Google Maps)`}>
                  🧭
                </a>
              )}
            </li>
          ))}
        </ol>
      )}

      {routes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {routes.map((r, i) => (
            <a key={r} className={link} href={r} target="_blank" rel="noopener noreferrer">
              🗺 Itinéraire de la journée{routes.length > 1 ? ` (${i + 1}/${routes.length})` : ''} dans Google Maps
            </a>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Les liens 🧭 et 🗺 ouvrent Google Maps (position envoyée à Google seulement sur clic ; jamais pour la famille).
      </p>
    </section>
  );
}
