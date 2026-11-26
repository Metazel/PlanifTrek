import { useState, type FormEvent } from 'react';
import { daysOfStop } from '../domain/coherence';
import { validateEvent, type EventError, type EventInput } from '../domain/edit';
import type { EventKind, GeoPoint, ISODate, Stop, Trip, TripEvent } from '../domain/types';
import { PlaceSearch } from './PlaceSearch';
import { isPhone } from '../domain/reminders';
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
  initial,
  onSubmit,
  onCancel,
}: {
  trip: Trip;
  stop: Stop;
  prefill?: EventPrefill;
  /** Sous-étape existante à modifier. */
  initial?: TripEvent;
  onSubmit: (e: EventInput) => void;
  onCancel: () => void;
}) {
  const src = initial ?? prefill;
  const [kind, setKind] = useState<EventKind>(src.kind ?? 'visite');
  const [title, setTitle] = useState(src.title ?? '');
  const [date, setDate] = useState(src.date ?? stop.arrival);
  const [time, setTime] = useState(initial?.time ?? '');
  const [checkIn, setCheckIn] = useState(src.checkIn ?? stop.arrival);
  const [checkOut, setCheckOut] = useState(src.checkOut ?? stop.departure);
  const [point, setPoint] = useState<GeoPoint | undefined>(initial?.point);
  const [pending, setPending] = useState(false);
  const [important, setImportant] = useState(initial?.important ?? false);
  const [contactName, setContactName] = useState(initial?.contact?.name ?? '');
  const [phone, setPhone] = useState(initial?.contact?.phone ?? '');
  const [phoneError, setPhoneError] = useState(false);
  const [errors, setErrors] = useState<EventError[]>([]);
  const lodging = kind === 'hebergement';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (phone.trim() && !isPhone(phone)) return setPhoneError(true);
    setPhoneError(false);
    // On garde les informations déjà saisies ailleurs (référence, prix, statut).
    const keep = initial ? { ...initial } : {};
    const base = { ...keep, stopId: stop.id, kind, title, ...(point ? { point } : {}) };
    const input: EventInput = lodging
      ? { ...base, checkIn, checkOut }
      : { ...base, date, ...(time ? { time } : {}) };
    if (!time) delete (input as { time?: string }).time;
    if (important) input.important = true;
    else delete input.important;
    if (contactName.trim()) input.contact = { name: contactName.trim().slice(0, 80), ...(phone.trim() ? { phone: phone.trim() } : {}) };
    else delete input.contact;
    if (!point) delete (input as { point?: GeoPoint }).point;
    delete (input as { id?: string }).id;
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
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
        ⭐ À ne pas oublier (rappel dans l’agenda)
      </label>
      {(
        <>
          <label className="flex flex-col gap-1 text-sm">
            {lodging ? 'Hôte / réception (facultatif)' : 'Contact (facultatif)'}
            <input className={field} value={contactName} maxLength={80} autoComplete="off" placeholder="ex. Yossi, guide" onChange={(e) => setContactName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Téléphone du contact
            <input className={field} type="tel" inputMode="tel" value={phone} maxLength={24} autoComplete="off" aria-invalid={phoneError} onChange={(e) => setPhone(e.target.value)} />
            {phoneError && <span role="alert" className="text-red-700 dark:text-red-400">Numéro invalide (chiffres, +, espaces).</span>}
          </label>
        </>
      )}
      {kind !== 'famille' && (
        <div className="sm:col-span-2">
          <PlaceSearch query={title} point={point} onPick={(p) => setPoint(p.point)} onPending={setPending} />
        </div>
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
          {initial ? 'Enregistrer' : 'Ajouter'}
        </button>
        <button type="button" className={btn.secondary} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
