import { useState, type FormEvent } from 'react';
import { formatMoney, parseAmount } from '../domain/money';
import { formatDuration } from '../domain/time';
import { transportMinutes, validateTransport, type TransportError, type TransportInput } from '../domain/transport';
import type { PaymentStatus, Stop, Transport, TransportMode, TransportStatus, Trip } from '../domain/types';
import { btn, field } from './Dialog';
import { PlaceSearch } from './PlaceSearch';
import { departureAdvice } from '../domain/reminders';
import type { GeoPoint } from '../domain/types';

export const MODES: Record<TransportMode, [string, string]> = {
  avion: ['✈', 'Avion'],
  train: ['🚆', 'Train'],
  voiture: ['🚗', 'Voiture'],
  bus: ['🚌', 'Bus'],
  bateau: ['⛴', 'Bateau'],
  taxi: ['🚕', 'Taxi / VTC'],
  marche: ['🚶', 'Marche'],
};
const STATUS: Record<TransportStatus, string> = { brouillon: 'À prévoir', reserve: 'Réservé', 'a-verifier': '⚠ À vérifier' };
const PAY: Record<PaymentStatus, string> = { 'a-payer': 'À payer', acompte: 'Acompte versé', paye: 'Payé', gratuit: 'Gratuit' };
const ERR: Record<TransportError, string> = {
  'arrivee-avant-depart': 'L’arrivée doit être après le départ (heures locales de chaque lieu).',
  'horaire-invalide': 'Horaire invalide.',
  'etape-inconnue': 'Étape inconnue.',
};

const hm = (at?: string) => at?.slice(11) ?? '';
const minutes = (k: 'checkInMin' | 'bufferMin' | 'travelMin', v: string) => (v.trim() ? { [k]: Math.min(2880, Number(v)) } : {});

/** Ligne de trajet entre deux étapes, avec ajout ou modification sur place. */
export function LegRow({
  trip,
  from,
  to,
  transport,
  onAdd,
  onSave,
  onRemove,
}: {
  trip: Trip;
  from: Stop;
  to: Stop;
  transport?: Transport;
  onAdd: () => void;
  onSave: (input: TransportInput) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!transport) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-3 text-sm dark:border-slate-700">
        <span className="text-slate-500">↓ Trajet vers {to.name} : non renseigné</span>
        <button type="button" className={btn.secondary} onClick={onAdd}>
          + Trajet
        </button>
      </div>
    );
  }
  const minutes = transportMinutes(transport);
  const adv = departureAdvice(trip, transport);
  const [icon, label] = MODES[transport.mode];
  return (
    <div className="mt-3 border-t border-dashed border-slate-200 pt-3 text-sm dark:border-slate-700">
      {editing ? (
        <TransportForm
          trip={trip}
          from={from}
          to={to}
          transport={transport}
          onCancel={() => setEditing(false)}
          onSave={(input) => {
            onSave(input);
            setEditing(false);
          }}
          onRemove={onRemove}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[var(--color-transport)]" aria-hidden="true">
            {icon}
          </span>
          <span className="flex-1">
            <span className="sr-only">Trajet en {label} vers {to.name} : </span>
            <span aria-hidden="true">
              {label} → {to.name}
            </span>
            {transport.departure && transport.arrival && (
              <span className="tabular ml-2 text-slate-600 dark:text-slate-300">
                {hm(transport.departure.at)} – {hm(transport.arrival.at)}
                {minutes !== null && ` (${formatDuration(minutes)})`}
              </span>
            )}
            {transport.important && <span className="ml-1" aria-label="à ne pas oublier">⭐</span>}
            {transport.bookingRef && <span className="ml-2 text-slate-500">réf. {transport.bookingRef}</span>}
            {transport.price && <span className="tabular ml-2">{formatMoney(transport.price)}</span>}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${transport.status === 'reserve' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100' : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'}`}>
              {STATUS[transport.status]}
            </span>
          </span>
          <button type="button" className={btn.secondary} onClick={() => setEditing(true)}>
            Modifier le trajet
          </button>
          {adv && (
            <p className="w-full font-medium text-blue-800 dark:text-blue-300">
              ⏰ Partir à {adv.leaveAt.slice(11)}
              {adv.leaveAt.slice(0, 10) !== transport.departure?.at.slice(0, 10) && ' la veille'}
              <span className="font-normal text-slate-600 dark:text-slate-300">
                {' '}
                ({[adv.checkIn && `enregistrement ${adv.checkIn} min`, adv.buffer && `battement ${adv.buffer} min`, adv.travel && `route ${adv.travelEstimated ? '≈' : ''}${adv.travel} min`].filter(Boolean).join(' + ')})
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TransportForm({
  trip,
  from,
  to,
  transport,
  onSave,
  onCancel,
  onRemove,
}: {
  trip: Trip;
  from: Stop;
  to: Stop;
  transport: Transport;
  onSave: (i: TransportInput) => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const [mode, setMode] = useState(transport.mode);
  const [status, setStatus] = useState<TransportStatus>(transport.status === 'a-verifier' ? 'reserve' : transport.status);
  const [depPlace, setDepPlace] = useState(transport.departure?.place ?? from.name);
  const [depAt, setDepAt] = useState(transport.departure?.at ?? `${from.departure}T${from.departureTime ?? '10:00'}`);
  const [arrPlace, setArrPlace] = useState(transport.arrival?.place ?? to.name);
  const [arrAt, setArrAt] = useState(transport.arrival?.at ?? `${to.arrival}T${to.arrivalTime ?? '12:00'}`);
  const [ref, setRef] = useState(transport.bookingRef ?? '');
  const [price, setPrice] = useState(transport.price ? String(transport.price.amountMinor / 100).replace('.', ',') : '');
  const [currency, setCurrency] = useState(transport.price?.currency ?? trip.baseCurrency);
  const [pay, setPay] = useState<PaymentStatus | ''>(transport.paymentStatus ?? '');
  const [depPoint, setDepPoint] = useState<GeoPoint | undefined>(transport.departure?.point);
  const [arrPoint, setArrPoint] = useState<GeoPoint | undefined>(transport.arrival?.point);
  const [pending, setPending] = useState(false);
  const [important, setImportant] = useState(transport.important ?? false);
  const [checkIn, setCheckIn] = useState(transport.checkInMin?.toString() ?? '');
  const [buffer, setBuffer] = useState(transport.bufferMin?.toString() ?? '');
  const [travel, setTravel] = useState(transport.travelMin?.toString() ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const amount = price.trim() ? parseAmount(price) : null;
    const input: TransportInput = {
      mode,
      status,
      departure: { place: depPlace, at: depAt, timeZone: from.timeZone, ...(depPoint ? { point: depPoint } : {}) },
      arrival: { place: arrPlace, at: arrAt, timeZone: to.timeZone, ...(arrPoint ? { point: arrPoint } : {}) },
      ...(ref.trim() ? { bookingRef: ref } : {}),
      ...(amount !== null && amount >= 0 ? { price: { amountMinor: amount, currency } } : {}),
      ...(pay ? { paymentStatus: pay } : {}),
      ...(important ? { important } : {}),
      ...minutes('checkInMin', checkIn),
      ...minutes('bufferMin', buffer),
      ...minutes('travelMin', travel),
    };
    const errs: string[] = validateTransport(input).map((x) => ERR[x]);
    if (price.trim() && (amount === null || amount < 0)) errs.push('Prix invalide (ex. 44,50).');
    setErrors(errs);
    if (!errs.length) onSave(input);
  };

  const L = 'flex flex-col gap-1 text-sm';
  const delay = (label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <label className={L}>
      {label}
      <input className={field} inputMode="numeric" value={value} placeholder={placeholder} onChange={(e) => set(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} />
    </label>
  );
  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/50">
      <label className={L}>
        Mode
        <select className={field} value={mode} onChange={(e) => setMode(e.target.value as TransportMode)}>
          {Object.entries(MODES).map(([k, [i, l]]) => (
            <option key={k} value={k}>
              {i} {l}
            </option>
          ))}
        </select>
      </label>
      <label className={L}>
        Statut
        <select className={field} value={status} onChange={(e) => setStatus(e.target.value as TransportStatus)}>
          <option value="brouillon">À prévoir</option>
          <option value="reserve">Réservé</option>
        </select>
      </label>
      <div className={L}>
        <label className={L}>
          Départ de (gare, aéroport, adresse)
          <input className={field} value={depPlace} maxLength={120} onChange={(e) => { setDepPlace(e.target.value); setDepPoint(undefined); }} />
        </label>
          <PlaceSearch query={depPlace} point={depPoint} onPick={(p) => { setDepPlace(p.name); setDepPoint(p.point); }} onPending={setPending} />
      </div>
      <label className={L}>
        Départ le ({from.timeZone})
        <input type="datetime-local" className={field} value={depAt} onChange={(e) => setDepAt(e.target.value)} />
      </label>
      <div className={L}>
        <label className={L}>
          Arrivée à
          <input className={field} value={arrPlace} maxLength={120} onChange={(e) => { setArrPlace(e.target.value); setArrPoint(undefined); }} />
        </label>
          <PlaceSearch query={arrPlace} point={arrPoint} onPick={(p) => { setArrPlace(p.name); setArrPoint(p.point); }} onPending={setPending} />
      </div>
      <label className={L}>
        Arrivée le ({to.timeZone})
        <input type="datetime-local" className={field} value={arrAt} onChange={(e) => setArrAt(e.target.value)} />
      </label>
      <label className={L}>
        N° de vol, de train ou de réservation
        <input className={field} value={ref} maxLength={40} autoComplete="off" onChange={(e) => setRef(e.target.value)} />
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className={L}>
          Prix
          <input className={field} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className={L}>
          Devise
          <select className={field} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {[...new Set([trip.baseCurrency, 'EUR', 'ILS', 'USD'])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label className={L}>
        Paiement
        <select className={field} value={pay} onChange={(e) => setPay(e.target.value as PaymentStatus | '')}>
          <option value="">Non précisé</option>
          {Object.entries(PAY).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
        ⭐ À ne pas oublier (rappel du départ et de l’heure à laquelle partir)
      </label>
      <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-medium">Heure de départ conseillée (minutes ; vide = valeur par défaut)</legend>
        {delay('Enregistrement avant le départ', checkIn, setCheckIn, mode === 'avion' ? '180' : mode === 'bateau' ? '90' : mode === 'train' ? '20' : mode === 'bus' ? '15' : '0')}
        {delay('Battement (rendre la voiture, terminal)', buffer, setBuffer, mode === 'avion' ? '60' : '0')}
        {delay('Route jusqu’au départ', travel, setTravel, 'estimée')}
      </fieldset>
      {errors.length > 0 && (
        <ul role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className={btn.primary}>
          Enregistrer le trajet
        </button>
        <button type="button" className={btn.secondary} onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className={`${btn.secondary} text-red-700 dark:text-red-400`} onClick={onRemove}>
          Supprimer le trajet
        </button>
      </div>
    </form>
  );
}
