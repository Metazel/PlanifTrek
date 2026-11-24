import { useState, type FormEvent } from 'react';
import { validateEvent, type EventError, type EventInput } from '../domain/edit';
import type { EventKind, Stop, Trip } from '../domain/types';
import { btn, field } from './Dialog';

export const EVENT_LABELS: Record<EventKind, string> = {
  hebergement: '🛏 Hébergement',
  visite: '🏛 Visite',
  activite: '🎯 Activité',
  famille: '👪 Famille / amis',
  'temps-libre': '☀ Temps libre',
};

const MESSAGES: Record<EventError, string> = {
  'titre-vide': 'Indiquez un titre.',
  'etape-inconnue': 'Étape inconnue.',
  'date-invalide': 'Dates invalides.',
  'depart-avant-arrivee': 'Il faut au moins une nuit entre arrivée et départ.',
  'trop-d-evenements': 'Nombre maximal d’événements atteint.',
};

export function EventForm({ trip, stop, onSubmit, onCancel }: { trip: Trip; stop: Stop; onSubmit: (e: EventInput) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<EventKind>('visite');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(stop.arrival);
  const [checkIn, setCheckIn] = useState(stop.arrival);
  const [checkOut, setCheckOut] = useState(stop.departure);
  const [errors, setErrors] = useState<EventError[]>([]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input: EventInput =
      kind === 'hebergement' ? { stopId: stop.id, kind, title, checkIn, checkOut } : { stopId: stop.id, kind, title, date };
    const errs = validateEvent(trip, input);
    setErrors(errs);
    if (!errs.length) onSubmit(input);
  };

  return (
    <form onSubmit={submit} noValidate className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/50">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
          {Object.entries(EVENT_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Titre
        <input className={field} value={title} maxLength={120} aria-invalid={errors.includes('titre-vide')} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {kind === 'hebergement' ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Arrivée (check-in)
            <input type="date" className={field} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Départ (check-out)
            <input type="date" className={field} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Jour
          <input type="date" className={field} value={date} min={stop.arrival} max={stop.departure} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{MESSAGES[e]}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={btn.primary}>
          Ajouter
        </button>
        <button type="button" className={btn.secondary} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
