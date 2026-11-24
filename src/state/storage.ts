import Dexie, { type Table } from 'dexie';
import { parseTrip } from '../domain/schema';
import type { Id, Trip } from '../domain/types';

/**
 * Stockage des voyages.
 * - « local » : IndexedDB, uniquement après consentement explicite ;
 * - « memoire » : rien n'est écrit sur l'appareil (essai sans enregistrer).
 * Toute donnée relue est revalidée (schéma strict) : une donnée altérée est écartée et signalée.
 */
export interface TripRepository {
  readonly kind: 'local' | 'memoire';
  list(): Promise<{ trips: Trip[]; rejected: number }>;
  save(trip: Trip): Promise<void>;
  remove(id: Id): Promise<void>;
  clearAll(): Promise<void>;
}

interface TripRow {
  id: Id;
  data: unknown;
  updatedAt: number;
}

const DB_NAME = 'planiftrek';
const CONSENT_KEY = 'planiftrek.consentement';

class PlanifTrekDb extends Dexie {
  trips!: Table<TripRow, Id>;
  constructor() {
    super(DB_NAME);
    this.version(1).stores({ trips: 'id, updatedAt' });
  }
}

export function createLocalRepository(): TripRepository {
  const db = new PlanifTrekDb();
  return {
    kind: 'local',
    async list() {
      const rows = await db.trips.orderBy('updatedAt').reverse().toArray();
      const trips: Trip[] = [];
      let rejected = 0;
      for (const row of rows) {
        const r = parseTrip(row.data);
        if (r.ok) trips.push(r.trip);
        else rejected++;
      }
      return { trips, rejected };
    },
    async save(trip) {
      const r = parseTrip(trip);
      if (!r.ok) throw new Error(`Voyage invalide : ${r.error}`);
      await db.trips.put({ id: trip.id, data: trip, updatedAt: Date.now() });
    },
    async remove(id) {
      await db.trips.delete(id);
    },
    async clearAll() {
      db.close();
      await Dexie.delete(DB_NAME);
    },
  };
}

export function createMemoryRepository(): TripRepository {
  const store = new Map<Id, Trip>();
  return {
    kind: 'memoire',
    async list() {
      return { trips: [...store.values()], rejected: 0 };
    },
    async save(trip) {
      store.set(trip.id, trip);
    },
    async remove(id) {
      store.delete(id);
    },
    async clearAll() {
      store.clear();
    },
  };
}

/** Consentement au stockage local. Information strictement nécessaire, sans traceur. */
export const consent = {
  get(): boolean {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'oui';
    } catch {
      return false;
    }
  },
  set(): void {
    try {
      localStorage.setItem(CONSENT_KEY, 'oui');
    } catch {
      /* stockage indisponible : le mode mémoire prendra le relais */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* rien à effacer */
    }
  },
};

/** Demande au navigateur de ne pas effacer les données en cas de manque d'espace. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
