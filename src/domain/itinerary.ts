import { addDays, diffDays } from './dates';
import { shiftPlannedEvents } from './plan';
import type { Id, ISODate, Stop, Transport, Trip } from './types';

/** Déplace l'élément d'index `from` à l'index `to`. Renvoie un nouveau tableau. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) {
    throw new RangeError('Index hors limites');
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** Paires d'étapes consécutives = trajets inter-villes nécessaires. */
export function requiredLegs(order: readonly Id[]): Array<[Id, Id]> {
  const legs: Array<[Id, Id]> = [];
  for (let i = 1; i < order.length; i++) legs.push([order[i - 1] as Id, order[i] as Id]);
  return legs;
}

export interface TransportPlan {
  /** Paires sans trajet : un brouillon sera créé. */
  toCreate: Array<[Id, Id]>;
  /** Brouillons devenus inutiles : supprimés. */
  toDelete: Id[];
  /** Trajets réservés devenus inutiles : conservés, marqués « à vérifier ». */
  toFlag: Id[];
  /** Trajets « à vérifier » redevenus utiles : repassent en « réservé ». */
  toRestore: Id[];
}

/**
 * Rapproche les trajets existants de l'ordre des étapes.
 * Règle : un trajet réservé n'est jamais supprimé automatiquement.
 */
export function planTransports(order: readonly Id[], transports: readonly Transport[]): TransportPlan {
  const legs = requiredLegs(order);
  const key = (a: Id, b: Id) => `${a}→${b}`;
  const needed = new Set(legs.map(([a, b]) => key(a, b)));
  const covered = new Set<string>();
  const plan: TransportPlan = { toCreate: [], toDelete: [], toFlag: [], toRestore: [] };

  for (const t of transports) {
    const k = key(t.fromStopId, t.toStopId);
    if (needed.has(k)) {
      covered.add(k);
      if (t.status === 'a-verifier') plan.toRestore.push(t.id);
    } else if (t.status === 'brouillon') {
      plan.toDelete.push(t.id);
    } else if (t.status === 'reserve') {
      plan.toFlag.push(t.id);
    }
  }
  for (const [a, b] of legs) if (!covered.has(key(a, b))) plan.toCreate.push([a, b]);
  return plan;
}

export type ScheduleMode = 'conserver' | 'cascade';

/**
 * Dates des étapes dans le nouvel ordre.
 * - conserver : chaque étape garde ses dates (les conflits seront signalés) ;
 * - cascade : chaque étape garde sa durée et commence au départ de la précédente,
 *   à partir de la date de début du voyage (`start`).
 */
export function reschedule(
  stops: readonly Stop[],
  mode: ScheduleMode,
  start: ISODate,
): Stop[] {
  if (mode === 'conserver') return stops.map((s) => ({ ...s }));
  let cursor = start;
  return stops.map((s) => {
    const nights = Math.max(0, diffDays(s.arrival, s.departure));
    const next = { ...s, arrival: cursor, departure: addDays(cursor, nights) };
    cursor = next.departure;
    return next;
  });
}

export interface DateChange {
  stopId: Id;
  before: { arrival: ISODate; departure: ISODate };
  after: { arrival: ISODate; departure: ISODate };
}

export interface ReorderPreview {
  order: Id[];
  stops: Record<Id, Stop>;
  dateChanges: DateChange[];
  transports: TransportPlan;
}

function tripStart(trip: Trip): ISODate | null {
  const dates = trip.stopOrder.map((id) => trip.stops[id]?.arrival).filter((d): d is ISODate => !!d);
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
}

/** Calcule, sans rien appliquer, les impacts d'un nouvel ordre d'étapes. */
export function previewReorder(trip: Trip, newOrder: readonly Id[], mode: ScheduleMode): ReorderPreview {
  const known = new Set(Object.keys(trip.stops));
  if (newOrder.length !== new Set(newOrder).size || newOrder.some((id) => !known.has(id))) {
    throw new RangeError('Ordre d’étapes invalide');
  }
  const ordered = newOrder.map((id) => trip.stops[id] as Stop);
  const start = tripStart(trip) ?? ordered[0]?.arrival;
  const scheduled = start ? reschedule(ordered, mode, start) : ordered;

  const stops: Record<Id, Stop> = { ...trip.stops };
  const dateChanges: DateChange[] = [];
  for (const s of scheduled) {
    const old = trip.stops[s.id] as Stop;
    if (old.arrival !== s.arrival || old.departure !== s.departure) {
      dateChanges.push({
        stopId: s.id,
        before: { arrival: old.arrival, departure: old.departure },
        after: { arrival: s.arrival, departure: s.departure },
      });
    }
    stops[s.id] = s;
  }
  return { order: [...newOrder], stops, dateChanges, transports: planTransports(newOrder, trip.transports) };
}

/**
 * Applique un aperçu validé par l'utilisateur.
 * Les sous-étapes restent rattachées à leur étape ; seules les non réservées glissent avec elle.
 */
export function applyReorder(trip: Trip, preview: ReorderPreview, newId: () => Id): Trip {
  const { toCreate, toDelete, toFlag, toRestore } = preview.transports;
  const del = new Set(toDelete);
  const flag = new Set(toFlag);
  const restore = new Set(toRestore);
  const transports: Transport[] = trip.transports
    .filter((t) => !del.has(t.id))
    .map((t) =>
      flag.has(t.id) ? { ...t, status: 'a-verifier' } : restore.has(t.id) ? { ...t, status: 'reserve' } : t,
    );
  for (const [from, to] of toCreate) {
    transports.push({ id: newId(), fromStopId: from, toStopId: to, mode: 'voiture', status: 'brouillon' });
  }
  // Les sous-étapes non réservées suivent leur étape ; les réservations restent et sont signalées.
  const deltas = Object.fromEntries(
    preview.dateChanges.map((c) => [c.stopId, diffDays(c.before.arrival, c.after.arrival)]),
  );
  return shiftPlannedEvents({ ...trip, stopOrder: [...preview.order], stops: preview.stops, transports }, deltas);
}

/**
 * « Fermer la boucle » : ajoute en fin de parcours une étape de retour
 * sur le lieu de la première étape (sans nuit par défaut).
 */
export function closeLoop(trip: Trip, newId: () => Id): Trip {
  const firstId = trip.stopOrder[0];
  const lastId = trip.stopOrder[trip.stopOrder.length - 1];
  if (!firstId || !lastId || trip.stopOrder.length < 2) return trip;
  const first = trip.stops[firstId] as Stop;
  const last = trip.stops[lastId] as Stop;
  const id = newId();
  const back: Stop = {
    ...first,
    id,
    name: `${first.name} (retour)`,
    arrival: last.departure,
    departure: last.departure,
  };
  return { ...trip, stopOrder: [...trip.stopOrder, id], stops: { ...trip.stops, [id]: back } };
}
