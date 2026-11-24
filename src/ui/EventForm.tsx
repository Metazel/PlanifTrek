import { useState, type FormEvent } from 'react';
import { daysOfStop } from '../domain/coherence';
import { validateEvent, type EventError, type EventInput } from '../domain/edit';
import type { EventKind, ISODate, Stop, Trip } from '../domain/types';
import { btn, field } from './Dialog';
import { fmtDay } from './format';

export const EVENT_ICONS: Record<EventKind, [string, string]> = {
  hebergement: ['🛏', 'Hébergement'],
  repas: ['🍽', 'Repas'],
  deplacement: ['🚗', 'Déplacement'],
  visite: ['🏛', 'Visite'],
  activite: ['🎯', 'Activité'],
  famille: ['👪', 'Famille / amis'],
  evenement: ['🎉', 'Événement (soirée, mariage…)'],
  'temps-libre': ['☀', 'Temps libre'],
};

const MESSAGES: Record<EventError, string> = {
  'titre-vide': 'Indiquez un titre.',
  'etape-inconnue': 'Étape inconnue.',
  'date-invalide': 'Date ou heure invalide.',
  'depart-avant-arrivee': 'Il faut au moins une nuit entre arrivée et départ.',
  'trop-d-evenements': 'Nombre maximal atteint.',
};

export interface EventPrefill {
  kind?: EventKind;
  title?: string;
  date?: ISODate;
  checkIn?: ISODate;
  checkOut?: ISODate;
}

export function EventForm({
  trip,
  stop,
  prefill = {},
  onSubmit,
  onCancel,
}: {
  trip: Trip;
  stop: Stop;
  prefill?: EventPrefill;
  onSubmit: (e: EventInput) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<EventKind>(prefill.kind ?? 'visite');
  const [title, setTitle] = useState(prefill.title ?? '');
  const [date, setDate] = useState(prefill.date ?? stop.arrival);
  const [time, setTime] = useState('');
  const [checkIn, setCheckIn] = useState(prefill.checkIn ?? stop.arrival);
  const [checkOut, setCheckOut] = useState(prefill.checkOut ?? stop.departure);
  const [errors, setErrors] = useState<EventError[]>([]);
  const lodging = kind === 'hebergement';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input: EventInput = lodging
      ? { stopId: stop.id, kind, title, checkIn, checkOut }
      : { stopId: stop.id, kind, title, date, ...(time ? { time } : {}) };
    const errs = validateEvent(trip, input);
    setErrors(errs);
    if (!errs.length) onSubmit(input);
  };

  return (
    <form onSubmit={submit} noValidate className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/50">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
          {Object.entries(EVENT_ICONS).map(([k, [icon, label]]) => (
            <option key={k} value={k}>
              {icon} {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Titre
        <input
          className={field}
          value={title}
          maxLength={120}
          placeholder={lodging ? 'ex. Hôtel, Airbnb, chez les cousins' : 'ex. Brunch, Vieille ville'}
          aria-invalid={errors.includes('titre-vide')}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      {lodging ? (
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
        <>
          <label className="flex flex-col gap-1 text-sm">
            Jour
            <select className={field} value={date} onChange={(e) => setDate(e.target.value)}>
              {daysOfStop(stop).map((d) => (
                <option key={d} value={d}>
                  {fmtDay(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Heure (facultatif)
            <input type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </>
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
