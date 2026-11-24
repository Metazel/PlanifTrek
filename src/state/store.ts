import { create } from 'zustand';
import { commit, createHistory, redo, undo, type History } from '../domain/history';
import { createTrip } from '../domain/edit';
import type { Id, Trip } from '../domain/types';
import {
  consent,
  createLocalRepository,
  createMemoryRepository,
  requestPersistence,
  type TripRepository,
} from './storage';

export type StorageMode = 'inconnu' | 'local' | 'memoire';

interface State {
  mode: StorageMode;
  trips: Trip[];
  current: History<Trip> | null;
  notice: string | null;
  /** Démarrage : relit le consentement et les voyages. */
  init(): Promise<void>;
  acceptStorage(): Promise<void>;
  tryWithoutSaving(): void;
  newTrip(name: string): Promise<Id>;
  addTrip(trip: Trip): Promise<void>;
  openTrip(id: Id): void;
  closeTrip(): void;
  /** Toute modification du voyage ouvert passe par ici : historique + enregistrement. */
  update(fn: (trip: Trip) => Trip): void;
  undo(): void;
  redo(): void;
  deleteTrip(id: Id): Promise<void>;
  eraseAll(): Promise<void>;
  dismissNotice(): void;
}

let repo: TripRepository = createMemoryRepository();

const newId = () => crypto.randomUUID();
export { newId };

async function persist(trip: Trip, set: (s: Partial<State>) => void) {
  try {
    await repo.save(trip);
  } catch {
    set({ notice: 'Enregistrement impossible sur cet appareil : vos dernières modifications ne sont pas sauvegardées.' });
  }
}

function replaceTrip(trips: Trip[], trip: Trip): Trip[] {
  const i = trips.findIndex((t) => t.id === trip.id);
  return i < 0 ? [trip, ...trips] : trips.map((t) => (t.id === trip.id ? trip : t));
}

export const useStore = create<State>((set, get) => ({
  mode: 'inconnu',
  trips: [],
  current: null,
  notice: null,

  async init() {
    if (!consent.get()) return set({ mode: 'inconnu' });
    repo = createLocalRepository();
    try {
      const { trips, rejected } = await repo.list();
      set({
        mode: 'local',
        trips,
        notice: rejected ? `${rejected} voyage(s) illisible(s) ont été écartés (données altérées).` : null,
      });
    } catch {
      repo = createMemoryRepository();
      set({ mode: 'memoire', notice: 'Stockage indisponible sur cet appareil : rien ne sera enregistré.' });
    }
  },

  async acceptStorage() {
    consent.set();
    await requestPersistence();
    const pending = get().trips;
    repo = createLocalRepository();
    set({ mode: 'local' });
    for (const t of pending) await persist(t, set);
  },

  tryWithoutSaving() {
    repo = createMemoryRepository();
    set({ mode: 'memoire' });
  },

  async newTrip(name) {
    const trip = createTrip(newId(), name);
    await get().addTrip(trip);
    return trip.id;
  },

  async addTrip(trip) {
    set({ trips: replaceTrip(get().trips, trip), current: createHistory(trip) });
    await persist(trip, set);
  },

  openTrip(id) {
    const trip = get().trips.find((t) => t.id === id);
    if (trip) set({ current: createHistory(trip) });
  },

  closeTrip() {
    set({ current: null });
  },

  update(fn) {
    const h = get().current;
    if (!h) return;
    const next = fn(h.present);
    if (next === h.present) return;
    set({ current: commit(h, next), trips: replaceTrip(get().trips, next) });
    void persist(next, set);
  },

  undo() {
    const h = get().current;
    if (!h || !h.past.length) return;
    const next = undo(h);
    set({ current: next, trips: replaceTrip(get().trips, next.present) });
    void persist(next.present, set);
  },

  redo() {
    const h = get().current;
    if (!h || !h.future.length) return;
    const next = redo(h);
    set({ current: next, trips: replaceTrip(get().trips, next.present) });
    void persist(next.present, set);
  },

  async deleteTrip(id) {
    await repo.remove(id);
    const current = get().current;
    set({ trips: get().trips.filter((t) => t.id !== id), current: current?.present.id === id ? null : current });
  },

  async eraseAll() {
    await repo.clearAll();
    consent.clear();
    repo = createMemoryRepository();
    set({ mode: 'inconnu', trips: [], current: null, notice: 'Toutes vos données ont été effacées de cet appareil.' });
  },

  dismissNotice() {
    set({ notice: null });
  },
}));
