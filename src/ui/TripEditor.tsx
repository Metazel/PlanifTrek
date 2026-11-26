import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { checkTrip, describeAlert } from '../domain/coherence';
import { addEvent, addStop, updateEvent, defaultDates, defaultTimeZone, removeEvent, removeStop, renameTrip, stopDependencies, updateStop } from '../domain/edit';
import { applyReorder, closeLoop, previewReorder } from '../domain/itinerary';
import { moveEvent, reorderDay, resizeStop, transferEvent } from '../domain/plan';
import { addTransport, removeTransport, updateTransport } from '../domain/transport';
import { requiredLegs } from '../domain/itinerary';
import type { Id, Trip } from '../domain/types';
import { newId, useStore } from '../state/store';
import { btn, Dialog, field } from './Dialog';
import { ReorderDialog } from './ReorderDialog';
import { Reminders } from './Reminders';
import { Rentals } from './Rentals';
import { OfflinePanel } from './OfflinePanel';
import { Today } from './Today';
import { TripTable } from './TripTable';
import { Exports } from './Exports';
import { StopForm } from './StopForm';
import { StopList } from './StopList';
import { deviceTimeZone, todayISO } from './format';
import { MODES } from './Transport';
import { MAP_LANGS, type MapLang } from './mapStyle';
import { stopView } from './mapModel';

// La carte (MapLibre) est chargée à part, seulement quand elle s'affiche.
const MapView = lazy(() => import('./MapView'));

export function TripEditor({ trip }: { trip: Trip }) {
  const { update, undo, redo, closeTrip, current, deleteTrip } = useStore();
  const [pendingOrder, setPendingOrder] = useState<Id[] | null>(null);
  const [removing, setRemoving] = useState<Id | null>(null);
  const [deletingTrip, setDeletingTrip] = useState(false);
  const [adding, setAdding] = useState(trip.stopOrder.length === 0);
  const [tab, setTab] = useState<'tableau' | 'aujourdhui' | 'planning'>('tableau');
  const [lang, setLang] = useState<MapLang>('fr');
  const [view, setView] = useState<'pays' | string>('pays');
  const legend = view === 'pays' ? null : stopView(trip, view);
  const [showMap, setShowMap] = useState(() => window.matchMedia?.('(min-width: 1024px)').matches ?? false);
  const legKeys = new Set(requiredLegs(trip.stopOrder).map(([a, b]) => `${a}→${b}`));
  const offRoute = trip.transports.filter((t) => !legKeys.has(`${t.fromStopId}→${t.toStopId}`));
  const noPoint = trip.stopOrder.map((id) => trip.stops[id]).filter((s) => s && !s.point);
  const alerts = useMemo(() => checkTrip(trip), [trip]);
  const canUndo = !!current?.past.length;
  const canRedo = !!current?.future.length;

  // Ctrl+Z / Ctrl+Maj+Z / Ctrl+Y, hors des champs de saisie (où le navigateur gère l'annulation du texte).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const deps = removing ? stopDependencies(trip, removing) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 sm:gap-2">
        <button type="button" className={`${btn.secondary} shrink-0 px-3`} onClick={closeTrip} aria-label="Mes voyages">
          ←<span className="hidden sm:inline"> Mes voyages</span>
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="sr-only">Nom du voyage</span>
          <input
            className={`${field} text-lg font-semibold`}
            defaultValue={trip.name}
            key={trip.name}
            maxLength={80}
            onBlur={(e) => update((t) => renameTrip(t, e.target.value))}
          />
        </label>
        <button type="button" className={btn.icon} onClick={undo} disabled={!canUndo} aria-label="Annuler (Ctrl+Z)" title="Annuler (Ctrl+Z)">
          ↶
        </button>
        <button type="button" className={btn.icon} onClick={redo} disabled={!canRedo} aria-label="Rétablir (Ctrl+Maj+Z)" title="Rétablir (Ctrl+Maj+Z)">
          ↷
        </button>
      </div>

      <div role="group" aria-label="Affichage" className="sticky top-0 z-20 grid grid-cols-3 gap-2 bg-[#F8FAFC]/90 py-2 backdrop-blur dark:bg-[#0F172A]/90">
        {(
          [
            ['tableau', '▦ Tableau'],
            ['aujourdhui', '☀ Aujourd’hui'],
            ['planning', '✎ Détail & carte'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            className={`${tab === k ? btn.primary : btn.secondary} px-2 text-sm sm:text-base`}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'tableau' ? (
        <TripTable trip={trip} onOpenDetail={() => setTab('planning')} />
      ) : tab === 'aujourdhui' ? (
        <Today trip={trip} />
      ) : (
      <>
      <section aria-labelledby="controles" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 id="controles" className="font-semibold">
          Contrôles
        </h2>
        <div aria-live="polite">
          {alerts.length === 0 ? (
            <p className="mt-1 text-emerald-700 dark:text-emerald-400">✓ Aucune incohérence détectée.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5 text-sm text-amber-800 dark:text-amber-300">
              {alerts.map((a, i) => (
                <li key={i}>⚠ {describeAlert(a, trip)}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Reminders trip={trip} />

      <Rentals trip={trip} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,40%)]">
      <section aria-labelledby="etapes" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="etapes" className="text-lg font-semibold">
            Étapes
          </h2>
          {trip.stopOrder.length >= 2 && (
            <button type="button" className={btn.secondary} onClick={() => update((t) => closeLoop(t, newId))}>
              ⟲ Fermer la boucle
            </button>
          )}
        </div>
        <StopList
          trip={trip}
          onReorder={setPendingOrder}
          onUpdateStop={(id, input) => update((t) => updateStop(t, id, input))}
          onRemoveStop={setRemoving}
          onAddEvent={(input) => update((t) => addEvent(t, newId(), input))}
          onRemoveEvent={(id) => update((t) => removeEvent(t, id))}
          onResize={(id, d) => update((t) => resizeStop(t, id, d))}
          onMoveEvent={(id, dir) => update((t) => moveEvent(t, id, dir))}
          onReorderDay={(ids) => update((t) => reorderDay(t, ids))}
          onTransferEvent={(id, stopId) => update((t) => transferEvent(t, id, stopId))}
          onAddTransport={(from, to) => update((t) => addTransport(t, newId(), from, to))}
          onUpdateTransport={(id, input) => update((t) => updateTransport(t, id, input))}
          onRemoveTransport={(id) => update((t) => removeTransport(t, id))}
          onAlign={(fn) => update(fn)}
          onUpdateEvent={(id, input) => update((t) => updateEvent(t, id, input))}
        />
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
          {adding ? (
            <StopForm
              key={trip.stopOrder.length}
              initial={{ name: '', kind: 'ville', timeZone: defaultTimeZone(trip, deviceTimeZone()), ...defaultDates(trip, todayISO()) }}
              submitLabel="Ajouter l’étape"
              onSubmit={(input) => {
                update((t) => addStop(t, newId(), input));
              }}
              {...(trip.stopOrder.length ? { onCancel: () => setAdding(false) } : {})}
            />
          ) : (
            <button type="button" className={btn.secondary} onClick={() => setAdding(true)}>
              + Ajouter une étape
            </button>
          )}
        </div>

        {offRoute.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-300 p-4 text-sm dark:border-amber-700">
            <h3 className="font-semibold">Trajets hors circuit</h3>
            <ul className="mt-1">
              {offRoute.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span>
                    {MODES[t.mode][0]} {trip.stops[t.fromStopId]?.name} → {trip.stops[t.toStopId]?.name}
                    {t.bookingRef ? ` · réf. ${t.bookingRef}` : ''} · à annuler ou à garder
                  </span>
                  <button type="button" className={btn.secondary} onClick={() => update((x) => removeTransport(x, t.id))}>
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <aside aria-labelledby="carte" className="flex flex-col gap-2 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="carte" className="text-lg font-semibold">
            Carte
          </h2>
          <label className="flex items-center gap-2 text-sm sm:ml-auto">
            Vue
            <select className={`${field} w-auto`} value={view} onChange={(e) => setView(e.target.value)}>
              <option value="pays">Tout le voyage</option>
              {trip.stopOrder.map((id, i) => (
                <option key={id} value={id}>
                  Étape {i + 1} : {trip.stops[id]?.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Noms
            <select className={`${field} w-auto`} value={lang} onChange={(e) => setLang(e.target.value as MapLang)}>
              {Object.entries(MAP_LANGS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={btn.secondary} aria-expanded={showMap} onClick={() => setShowMap((v) => !v)}>
            {showMap ? 'Masquer la carte' : 'Afficher la carte'}
          </button>
        </div>
        {showMap && (
          <div className="h-80 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:h-auto dark:border-slate-800 dark:bg-slate-900">
            <Suspense fallback={<p className="p-4 text-sm">Chargement de la carte…</p>}>
              <MapView trip={trip} lang={lang} view={trip.stops[view] ? view : 'pays'} />
            </Suspense>
          </div>
        )}
        <OfflinePanel trip={trip} />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Même parcours que la liste des étapes : épingles numérotées dans l’ordre, ▶ départ (vert), ■ arrivée (rouge),
          ⟲ départ et arrivée au même endroit ; traits du vert au rouge dans le sens du voyage, tirets pour l’avion.
          {legend && legend.legend.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-x-3">
              {legend.legend.map((l) => (
                <span key={l.label} className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="inline-block h-1 w-5 rounded" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </span>
          )}
          {legend && legend.unplaced.length > 0 && (
            <strong className="mt-1 block text-amber-800 dark:text-amber-300">
              ⚠ Sous-étapes non placées : {legend.unplaced.join(', ')} (✎ puis « Chercher le lieu »).
            </strong>
          )}
          {noPoint.length > 0 && (
            <strong className="mt-1 block text-amber-800 dark:text-amber-300">
              ⚠ Pas sur la carte : {noPoint.map((s) => s?.name).join(', ')}. Le trait gris pointillé saute ces étapes : utilisez
              « 📍 placer » sur l’étape.
            </strong>
          )}
        </p>
      </aside>
      </div>

      <Exports trip={trip} />
      </>
      )}

      <div>
        <button type="button" className={`${btn.secondary} text-red-700 dark:text-red-400`} onClick={() => setDeletingTrip(true)}>
          Supprimer ce voyage
        </button>
      </div>

      <ReorderDialog
        trip={trip}
        order={pendingOrder}
        onCancel={() => setPendingOrder(null)}
        onApply={(order, mode) => {
          update((t) => applyReorder(t, previewReorder(t, order, mode), newId));
          setPendingOrder(null);
        }}
      />

      <Dialog
        open={!!removing}
        title={`Supprimer ${removing ? (trip.stops[removing]?.name ?? '') : ''} ?`}
        onClose={() => setRemoving(null)}
        actions={
          <>
            <button type="button" className={btn.secondary} onClick={() => setRemoving(null)}>
              Annuler
            </button>
            <button
              type="button"
              className={btn.danger}
              onClick={() => {
                if (removing) update((t) => removeStop(t, removing));
                setRemoving(null);
              }}
            >
              Supprimer
            </button>
          </>
        }
      >
        {deps && (deps.events || deps.reservedTransports) ? (
          <p>
            Seront aussi supprimés : {deps.events} événement(s) et {deps.reservedTransports} trajet(s) réservé(s). Vous pourrez annuler
            avec Ctrl+Z.
          </p>
        ) : (
          <p>Cette étape ne contient aucun événement. Vous pourrez annuler avec Ctrl+Z.</p>
        )}
      </Dialog>

      <Dialog
        open={deletingTrip}
        title={`Supprimer « ${trip.name} » ?`}
        onClose={() => setDeletingTrip(false)}
        actions={
          <>
            <button type="button" className={btn.secondary} onClick={() => setDeletingTrip(false)}>
              Annuler
            </button>
            <button type="button" className={btn.danger} onClick={() => void deleteTrip(trip.id)}>
              Supprimer définitivement
            </button>
          </>
        }
      >
        <p>Le voyage sera effacé de cet appareil. Cette action est définitive.</p>
      </Dialog>
    </div>
  );
}
