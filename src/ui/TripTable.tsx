import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { daysBetween, diffDays } from '../domain/dates';
import { addEvent, addStop, defaultTimeZone, updateStop } from '../domain/edit';
import { formatMoney } from '../domain/money';
import { tripPoints } from '../domain/pack';
import { parseQuick } from '../domain/quick';
import { telHref } from '../domain/reminders';
import { summarize } from '../domain/summary';
import { dayPlan, type DayPlan } from '../domain/today';
import type { ISODate, Money, Stop, Trip } from '../domain/types';
import { newId, useStore } from '../state/store';
import { btn, field } from './Dialog';
import { deviceTimeZone, fmtDate, todayISO } from './format';
import { searchPlace } from './geocode';

const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const dayNum = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const d = (iso: ISODate) => new Date(`${iso}T00:00:00Z`);

/** Engagé d'une journée : réservations payables ce jour-là (arrivée à l'hébergement, départ du trajet, prise du véhicule, activités). */
function dayCost(trip: Trip, day: ISODate): Money[] {
  const out: Money[] = [];
  for (const e of trip.events) if (e.price && (e.kind === 'hebergement' ? e.checkIn === day : e.date === day)) out.push(e.price);
  for (const t of trip.transports) if (t.price && t.departure?.at.startsWith(day)) out.push(t.price);
  for (const r of trip.rentals ?? []) if (r.price && r.pickup.at.startsWith(day)) out.push(r.price);
  const sums: Record<string, number> = {};
  for (const m of out) sums[m.currency] = (sums[m.currency] ?? 0) + m.amountMinor;
  return Object.entries(sums).map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

/** Étape où ranger une ligne saisie : avant l'heure du trajet → étape de départ, sinon d'arrivée. */
function targetStop(trip: Trip, plan: DayPlan, time?: string): Stop | undefined {
  const [first, second] = plan.stops;
  if (!second) return first;
  const leg = trip.transports.find((t) => t.fromStopId === first?.id && t.toStopId === second.id);
  const dep = leg?.departure?.at.slice(11);
  return time && dep && time < dep ? first : second.kind === 'passage' ? first : second;
}

/**
 * Vue « Tableau » : une ligne par jour, comme un tableur — jour, lieu et transitions, programme,
 * hébergement, engagé — avec la synthèse du voyage en tête et la saisie rapide sur chaque ligne.
 */
export function TripTable({ trip, onOpenDetail }: { trip: Trip; onOpenDetail: () => void }) {
  const update = useStore((s) => s.update);
  const summary = summarize(trip);
  const days = summary ? daysBetween(summary.start, summary.end) : [];

  return (
    <div className="flex flex-col gap-4">
      {summary && <Summary s={summary} onOpenDetail={onOpenDetail} />}

      {days.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[6.5rem_11rem_minmax(0,1fr)_13rem_7rem] gap-3 border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid dark:border-slate-800"
          >
            <span>Jour</span>
            <span>Lieu</span>
            <span>Programme</span>
            <span>Nuit</span>
            <span className="text-right">Engagé</span>
          </div>
          <ol aria-label="Tableau du voyage, un jour par ligne">
            {days.map((day) => (
              <DayRow key={day} trip={trip} day={day} warn={summary?.alertDays.has(day) ?? false} update={update} />
            ))}
          </ol>
        </div>
      )}

      <QuickStop trip={trip} update={update} />
    </div>
  );
}

function Chip({ ok, children }: { ok?: boolean | undefined; children: React.ReactNode }) {
  const tone =
    ok === undefined
      ? 'border-slate-200 dark:border-slate-700'
      : ok
        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
        : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100';
  return <li className={`tabular rounded-full border px-3 py-1 text-sm ${tone}`}>{children}</li>;
}

function Summary({ s, onOpenDetail }: { s: NonNullable<ReturnType<typeof summarize>>; onOpenDetail: () => void }) {
  const committed = Object.entries(s.committed).map(([currency, amountMinor]) => formatMoney({ currency, amountMinor }));
  return (
    <section aria-labelledby="synthese" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 id="synthese" className="text-lg font-semibold">
        {fmtDate(s.start)} → {fmtDate(s.end)} · {s.days} jours · {s.stops} étape{s.stops > 1 ? 's' : ''}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Ce qui est prêt">
        <Chip ok={s.nights.covered === s.nights.total}>
          {s.nights.covered === s.nights.total ? '✓' : '⚠'} Nuits {s.nights.covered}/{s.nights.total}
        </Chip>
        <Chip ok={s.transports.total === 0 || s.transports.reserved >= s.transports.total}>
          {s.transports.reserved >= s.transports.total ? '✓' : '⚠'} Trajets réservés {Math.min(s.transports.reserved, s.transports.total)}/{s.transports.total}
        </Chip>
        <Chip ok={s.placed.done === s.placed.total}>
          {s.placed.done === s.placed.total ? '✓' : '⚠'} Sur la carte {s.placed.done}/{s.placed.total}
        </Chip>
        {s.rentals > 0 && <Chip>🚙 {s.rentals} location{s.rentals > 1 ? 's' : ''}</Chip>}
        {committed.length > 0 && <Chip>💶 Engagé : {committed.join(' + ')}</Chip>}
        <Chip ok={s.alerts.length === 0}>{s.alerts.length === 0 ? '✓ Aucune incohérence' : `⚠ ${s.alerts.length} point(s) à vérifier`}</Chip>
      </ul>
      {s.alerts.length > 0 && (
        <button type="button" className="mt-2 text-sm underline" onClick={onOpenDetail}>
          Voir le détail des points à vérifier
        </button>
      )}
    </section>
  );
}

function DayRow({ trip, day, warn, update }: { trip: Trip; day: ISODate; warn: boolean; update: (fn: (t: Trip) => Trip) => void }) {
  const plan = dayPlan(trip, day);
  const cost = dayCost(trip, day);
  const [line, setLine] = useState('');
  const [lodging, setLodging] = useState<string | null>(null);
  const isToday = day === todayISO();
  const lastStop = plan.stops[plan.stops.length - 1];
  const sleepsHere = lastStop && day < lastStop.departure;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const q = parseQuick(line);
    const stop = q && targetStop(trip, plan, q.time);
    if (!q || !stop) return;
    update((t) => addEvent(t, newId(), { stopId: stop.id, kind: q.kind, title: q.title, date: day, ...(q.time ? { time: q.time } : {}) }));
    setLine('');
  };
  const addLodging = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setLodging(null);
    if (e.key !== 'Enter' || !lodging?.trim() || !lastStop) return;
    e.preventDefault();
    update((t) => addEvent(t, newId(), { stopId: lastStop.id, kind: 'hebergement', title: lodging, checkIn: day, checkOut: lastStop.departure }));
    setLodging(null);
  };

  const place =
    plan.stops.length > 1 ? plan.stops.map((s) => s.name).join(' → ') : plan.stops[0]?.name ?? '—';
  return (
    <li
      className={`grid gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3 last:border-0 md:grid-cols-[6.5rem_11rem_minmax(0,1fr)_13rem_7rem] dark:border-slate-800 ${isToday ? 'bg-blue-50/60 dark:bg-blue-950/40' : ''}`}
    >
      <div className="flex items-baseline gap-2 md:block">
        <span className="font-semibold capitalize">{weekday.format(d(day))}</span>{' '}
        <span className="tabular">{dayNum.format(d(day))}</span>
        {warn && (
          <span className="ml-1 text-amber-700 dark:text-amber-300" role="img" aria-label="point à vérifier ce jour-là">
            ⚠
          </span>
        )}
        <span className="font-medium md:hidden"> · {place}</span>
      </div>
      <div className="hidden font-medium md:block">{place}</div>

      <div className="min-w-0">
        <span className="sr-only">Programme : </span>
        {plan.items.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-sm">
            {plan.items.map((it) => (
              <li key={it.key} className={it.kind === 'partir' ? 'font-medium text-blue-800 dark:text-blue-300' : ''}>
                <span className="tabular inline-block w-11 text-slate-500 dark:text-slate-400">{it.time ?? ''}</span>
                <span aria-hidden="true">{it.icon} </span>
                {it.title}
                {it.phone && (
                  <a className="ml-1 underline" href={telHref(it.phone)}>
                    📞
                    <span className="sr-only">Appeler {it.contact}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-1">
          <label className="sr-only" htmlFor={`q-${day}`}>
            Ajouter au programme du {dayNum.format(d(day))} (ex. 15:25 Débarquement)
          </label>
          <input
            id={`q-${day}`}
            className="min-h-9 w-full rounded-lg border border-transparent bg-transparent px-2 text-sm placeholder:text-slate-400 hover:border-slate-200 focus:border-slate-400 dark:hover:border-slate-700"
            placeholder="+ ajouter (ex. 15:25 Débarquement)"
            value={line}
            maxLength={140}
            onChange={(e) => setLine(e.target.value)}
          />
        </form>
      </div>

      <div className="text-sm">
        <span className="font-medium md:sr-only">Nuit : </span>
        {plan.lodging ? (
          <span>
            🛏 {plan.lodging.title}
            {plan.lodging.contact?.phone && (
              <a className="ml-1 underline" href={telHref(plan.lodging.contact.phone)}>
                📞 {plan.lodging.contact.name}
              </a>
            )}
          </span>
        ) : !sleepsHere ? (
          <span className="text-slate-500">—</span>
        ) : lodging !== null ? (
          <input
            autoFocus
            className={`${field} min-h-9 text-sm`}
            aria-label={`Hébergement du ${dayNum.format(d(day))} (Entrée pour valider)`}
            placeholder="Nom, puis Entrée"
            value={lodging}
            maxLength={120}
            onChange={(e) => setLodging(e.target.value)}
            onKeyDown={addLodging}
            onBlur={() => !lodging.trim() && setLodging(null)}
          />
        ) : (
          <button type="button" className="min-h-9 rounded-lg px-2 text-amber-800 underline dark:text-amber-300" onClick={() => setLodging('')}>
            ⚠ à prévoir — ajouter
          </button>
        )}
      </div>

      <div className="tabular text-sm md:text-right">
        {cost.length > 0 && (
          <>
            <span className="md:sr-only">Engagé : </span>
            {cost.map((m) => formatMoney(m)).join(' + ')}
          </>
        )}
      </div>
    </li>
  );
}

/** Ajout d'étape en une ligne : lieu, arrivée, nuits — le lieu est placé automatiquement sur la carte. */
function QuickStop({ trip, update }: { trip: Trip; update: (fn: (t: Trip) => Trip) => void }) {
  const lastId = trip.stopOrder[trip.stopOrder.length - 1];
  const last = lastId ? trip.stops[lastId] : undefined;
  const [name, setName] = useState('');
  const [arrival, setArrival] = useState(last?.departure ?? todayISO());
  const [nights, setNights] = useState(2);
  const [note, setNote] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(arrival)) return;
    const id = newId();
    const departure = new Date(Date.UTC(+arrival.slice(0, 4), +arrival.slice(5, 7) - 1, +arrival.slice(8, 10) + Math.max(0, nights))).toISOString().slice(0, 10);
    const tz = defaultTimeZone(trip, deviceTimeZone());
    update((t) => addStop(t, id, { name: n, kind: nights === 0 ? 'passage' : 'ville', timeZone: tz, arrival, departure }));
    setName('');
    setArrival(departure);
    setNote(`Recherche de « ${n} » sur la carte…`);
    // Placement automatique (une requête, sur l'action de l'utilisateur), en privilégiant la zone du voyage.
    try {
      const pts = tripPoints(trip);
      const bias = pts.length
        ? { west: Math.min(...pts.map((p) => p.lon)) - 3, east: Math.max(...pts.map((p) => p.lon)) + 3, south: Math.min(...pts.map((p) => p.lat)) - 3, north: Math.max(...pts.map((p) => p.lat)) + 3 }
        : undefined;
      const [best] = await searchPlace(n, undefined, bias);
      if (best) {
        update((t) => {
          const s = t.stops[id];
          return s ? updateStop(t, id, { ...s, point: best.point, timeZone: best.timeZone ?? s.timeZone }) : t;
        });
        setNote(`📍 « ${n} » placé : ${best.label}. Si ce n’est pas le bon lieu, corrigez-le dans « Détail ».`);
      } else setNote(`« ${n} » ajouté, mais lieu introuvable sur la carte : à placer dans « Détail ».`);
    } catch {
      setNote(`« ${n} » ajouté. Recherche indisponible : placez-le plus tard dans « Détail ».`);
    }
  };

  return (
    <section aria-labelledby="ajout-etape" className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
      <h2 id="ajout-etape" className="font-semibold">
        Ajouter une étape
      </h2>
      <form onSubmit={(e) => void submit(e)} className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_7rem_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          Lieu
          <input className={field} value={name} maxLength={80} placeholder="ex. Jérusalem" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Arrivée
          <input type="date" className={field} value={arrival} onChange={(e) => setArrival(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nuits
          <input type="number" min={0} max={60} className={field} value={nights} onChange={(e) => setNights(Math.max(0, Math.min(60, Number(e.target.value) || 0)))} />
        </label>
        <button type="submit" className={btn.primary}>
          Ajouter
        </button>
      </form>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">0 nuit = simple passage (aéroport, prise de voiture). Le lieu est placé automatiquement sur la carte.</p>
      {note && (
        <p role="status" className="mt-2 text-sm">
          {note}
        </p>
      )}
      {trip.stopOrder.length > 0 && last && diffDays(last.departure, arrival) > 0 && (
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">⚠ {diffDays(last.departure, arrival)} jour(s) entre la fin de {last.name} et cette arrivée.</p>
      )}
    </section>
  );
}
