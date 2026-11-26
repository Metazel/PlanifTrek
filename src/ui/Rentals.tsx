import { useState, type FormEvent } from 'react';
import { formatMoney, parseAmount } from '../domain/money';
import { removeRental, saveRental, validateRental, type RentalError, type RentalInput } from '../domain/rental';
import type { GeoPoint, PaymentStatus, Rental, Trip } from '../domain/types';
import { newId, useStore } from '../state/store';
import { btn, field } from './Dialog';
import { fmtDay } from './format';
import { PlaceSearch } from './PlaceSearch';

const ERR: Record<RentalError, string> = {
  'agence-vide': 'Indiquez l’agence.',
  'retour-avant-prise': 'Le retour doit être après la prise du véhicule.',
  'horaire-invalide': 'Date ou heure invalide.',
};

const when = (at: string) => `${fmtDay(at.slice(0, 10))} ${at.slice(11)}`;

/** Locations de véhicule : plusieurs par voyage, prise et retour dans des agences différentes possibles. */
export function Rentals({ trip }: { trip: Trip }) {
  const update = useStore((s) => s.update);
  const [editing, setEditing] = useState<Rental | 'new' | null>(null);
  const list = trip.rentals ?? [];
  return (
    <section aria-labelledby="locations" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="locations" className="font-semibold">
          🚙 Véhicules de location
        </h2>
        {editing === null && (
          <button type="button" className={btn.secondary} onClick={() => setEditing('new')}>
            + Location
          </button>
        )}
      </div>
      {list.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <span className="min-w-0 flex-1 basis-56">
                <span className="font-medium">
                  {r.agency}
                  {r.vehicle && ` · ${r.vehicle}`}
                </span>
                {r.important && <span aria-label="à ne pas oublier"> ⭐</span>}
                <span className="tabular block text-slate-600 dark:text-slate-300">
                  Prise {when(r.pickup.at)} — {r.pickup.place}
                </span>
                <span className="tabular block text-slate-600 dark:text-slate-300">
                  Retour {when(r.dropoff.at)} — {r.dropoff.place}
                </span>
                {(r.bookingRef || r.price) && (
                  <span className="block text-slate-500">
                    {r.bookingRef && `réf. ${r.bookingRef}`} {r.price && formatMoney(r.price)}
                  </span>
                )}
              </span>
              <button type="button" className={btn.secondary} onClick={() => setEditing(r)} aria-label={`Modifier la location ${r.agency}`}>
                Modifier
              </button>
              <button type="button" className={btn.secondary} onClick={() => update((t) => removeRental(t, r.id))} aria-label={`Supprimer la location ${r.agency}`}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing !== null && (
        <RentalForm
          trip={trip}
          {...(editing !== 'new' ? { initial: editing } : {})}
          onCancel={() => setEditing(null)}
          onSave={(input) => {
            const id = editing === 'new' ? newId() : editing.id;
            update((t) => saveRental(t, id, input));
            setEditing(null);
          }}
        />
      )}
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Photos d’état du véhicule et bon de location : avec les documents (prochaine étape).</p>
    </section>
  );
}

function RentalForm({ trip, initial, onSave, onCancel }: { trip: Trip; initial?: Rental; onSave: (r: RentalInput) => void; onCancel: () => void }) {
  const first = trip.stops[trip.stopOrder[0] ?? ''];
  const tz = initial?.pickup.timeZone ?? first?.timeZone ?? 'Europe/Paris';
  const [agency, setAgency] = useState(initial?.agency ?? '');
  const [vehicle, setVehicle] = useState(initial?.vehicle ?? '');
  const [pPlace, setPPlace] = useState(initial?.pickup.place ?? '');
  const [pAt, setPAt] = useState(initial?.pickup.at ?? `${first?.arrival ?? ''}T10:00`);
  const [pPoint, setPPoint] = useState<GeoPoint | undefined>(initial?.pickup.point);
  const [dPlace, setDPlace] = useState(initial?.dropoff.place ?? '');
  const [dAt, setDAt] = useState(initial?.dropoff.at ?? `${first?.departure ?? ''}T10:00`);
  const [dPoint, setDPoint] = useState<GeoPoint | undefined>(initial?.dropoff.point);
  const [ref, setRef] = useState(initial?.bookingRef ?? '');
  const [price, setPrice] = useState(initial?.price ? String(initial.price.amountMinor / 100).replace('.', ',') : '');
  const [currency, setCurrency] = useState(initial?.price?.currency ?? trip.baseCurrency);
  const [pay, setPay] = useState<PaymentStatus | ''>(initial?.paymentStatus ?? '');
  const [important, setImportant] = useState(initial?.important ?? true);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const amount = price.trim() ? parseAmount(price) : null;
    const input: RentalInput = {
      agency,
      pickup: { place: pPlace, at: pAt, timeZone: tz, ...(pPoint ? { point: pPoint } : {}) },
      dropoff: { place: dPlace, at: dAt, timeZone: tz, ...(dPoint ? { point: dPoint } : {}) },
      ...(vehicle.trim() ? { vehicle } : {}),
      ...(ref.trim() ? { bookingRef: ref } : {}),
      ...(amount !== null && amount >= 0 ? { price: { amountMinor: amount, currency } } : {}),
      ...(pay ? { paymentStatus: pay } : {}),
      ...(important ? { important } : {}),
    };
    const errs: string[] = validateRental(input).map((x) => ERR[x]);
    if (price.trim() && (amount === null || amount < 0)) errs.push('Prix invalide (ex. 120,50).');
    setErrors(errs);
    if (!errs.length) onSave(input);
  };

  const L = 'flex flex-col gap-1 text-sm';
  const place = (label: string, v: string, set: (s: string) => void, pt: GeoPoint | undefined, setPt: (p?: GeoPoint) => void) => (
    <div className={L}>
      <label className={L}>
        {label}
        <input
          className={field}
          value={v}
          maxLength={120}
          onChange={(e) => {
            set(e.target.value);
            setPt(undefined);
          }}
        />
      </label>
      <PlaceSearch query={v} point={pt} onPick={(p) => { set(p.name); setPt(p.point); }} onPending={setPending} />
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/50">
      <label className={L}>
        Agence (loueur)
        <input className={field} value={agency} maxLength={80} aria-invalid={errors.includes(ERR['agence-vide'])} onChange={(e) => setAgency(e.target.value)} />
      </label>
      <label className={L}>
        Type de véhicule
        <input className={field} value={vehicle} maxLength={80} placeholder="ex. citadine, 7 places" onChange={(e) => setVehicle(e.target.value)} />
      </label>
      {place('Lieu de prise', pPlace, setPPlace, pPoint, setPPoint)}
      <label className={L}>
        Prise le ({tz})
        <input type="datetime-local" className={field} value={pAt} onChange={(e) => setPAt(e.target.value)} />
      </label>
      {place('Lieu de retour', dPlace, setDPlace, dPoint, setDPoint)}
      <label className={L}>
        Retour le ({tz})
        <input type="datetime-local" className={field} value={dAt} onChange={(e) => setDAt(e.target.value)} />
      </label>
      <label className={L}>
        N° de réservation
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
          <option value="a-payer">À payer</option>
          <option value="acompte">Acompte versé</option>
          <option value="paye">Payé</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
        ⭐ Rappeler la prise et le retour
      </label>
      {errors.length > 0 && (
        <ul role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className={btn.primary}>
          Enregistrer la location
        </button>
        <button type="button" className={btn.secondary} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
