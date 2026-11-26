import { googleCalendarUrl, reminders, telHref, toIcs, type Reminder } from '../domain/reminders';
import type { Trip } from '../domain/types';
import { btn } from './Dialog';
import { fmtDay } from './format';

function download(list: Reminder[], name: string) {
  const url = URL.createObjectURL(new Blob([toIcs(list)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** « À ne pas oublier » : rappels triés, appel du contact, ajout à l'agenda. */
export function Reminders({ trip }: { trip: Trip }) {
  const list = reminders(trip);
  return (
    <section aria-labelledby="rappels" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="rappels" className="font-semibold">
          ⭐ À ne pas oublier
        </h2>
        {list.length > 1 && (
          <button type="button" className={btn.secondary} onClick={() => download(list, 'planiftrek-rappels.ics')}>
            Tout ajouter à l’agenda (.ics)
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Cochez « À ne pas oublier » sur une sous-étape ou un trajet (mariage, rendez-vous avec un guide, vol retour…).
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <span className="min-w-0 flex-1 basis-56">
                <span className="tabular font-medium">
                  {fmtDay(r.at.slice(0, 10))} {r.at.slice(11)}
                </span>{' '}
                {r.title}
                {r.place && <span className="text-slate-500"> · {r.place}</span>}
                {r.detail && <span className="block text-slate-500">{r.detail}</span>}
              </span>
              {r.contact?.phone && (
                <a className={`${btn.secondary} inline-flex items-center`} href={telHref(r.contact.phone)}>
                  📞 Appeler {r.contact.name}
                </a>
              )}
              <a
                className={`${btn.secondary} inline-flex items-center`}
                href={googleCalendarUrl(r)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ajouter à Google Agenda : ${r.title} (nouvel onglet)`}
              >
                📅 Google Agenda
              </a>
              <button type="button" className={btn.secondary} onClick={() => download([r], 'planiftrek-rappel.ics')} aria-label={`Fichier agenda .ics : ${r.title}`}>
                .ics
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
        Les rappels s’ajoutent à votre agenda avec une alerte 30 min avant (.ics) ; aucune donnée n’est envoyée tant que vous ne cliquez pas.
      </p>
    </section>
  );
}
