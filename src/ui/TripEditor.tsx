import { useEffect, useMemo, useState } from 'react';
import { checkTrip, describeAlert } from '../domain/coherence';
import { addEvent, addStop, defaultDates, defaultTimeZone, removeEvent, removeStop, renameTrip, stopDependencies, updateStop } from '../domain/edit';
import { applyReorder, closeLoop, previewReorder } from '../domain/itinerary';
import { moveEvent, reorderDay, resizeStop, transferEvent } from '../domain/plan';
import type { Id, Trip } from '../domain/types';
import { newId, useStore } from '../state/store';
import { btn, Dialog, field } from './Dialog';
import { ReorderDialog } from './ReorderDialog';
import { StopForm } from './StopForm';
import { StopList } from './StopList';
import { deviceTimeZone, todayISO } from './format';

export function TripEditor({ trip }: { trip: Trip }) {
  const { update, undo, redo, closeTrip, current, deleteTrip } = useStore();
  const [pendingOrder, setPendingOrder] = useState<Id[] | null>(null);
  const [removing, setRemoving] = useState<Id | null>(null);
  const [deletingTrip, setDeletingTrip] = useState(false);
  const [adding, setAdding] = useState(trip.stopOrder.length === 0);
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
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn.secondary} onClick={closeTrip}>
          ← Mes voyages
        </button>
        <label className="flex min-w-48 flex-1 items-center gap-2">
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

      <section aria-labelledby="etapes">
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
      </section>

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
