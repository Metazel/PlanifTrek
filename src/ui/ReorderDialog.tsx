import { useMemo, useState } from 'react';
import { previewReorder, type ScheduleMode } from '../domain/itinerary';
import type { Id, Trip } from '../domain/types';
import { btn, Dialog } from './Dialog';
import { fmtDate } from './format';

/**
 * Aperçu d'une réorganisation : rien n'est appliqué avant « Appliquer ».
 */
export function ReorderDialog({
  trip,
  order,
  onApply,
  onCancel,
}: {
  trip: Trip;
  order: Id[] | null;
  onApply: (order: Id[], mode: ScheduleMode) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<ScheduleMode>('cascade');
  const preview = useMemo(() => (order ? previewReorder(trip, order, mode) : null), [trip, order, mode]);
  const name = (id: Id) => trip.stops[id]?.name ?? '?';
  const transport = (id: Id) => {
    const t = trip.transports.find((x) => x.id === id);
    return t ? `${name(t.fromStopId)} → ${name(t.toStopId)}` : '?';
  };

  return (
    <Dialog
      open={!!order}
      title="Réorganiser le circuit"
      onClose={onCancel}
      actions={
        <>
          <button type="button" className={btn.secondary} onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className={btn.primary} onClick={() => order && onApply(order, mode)}>
            Appliquer
          </button>
        </>
      }
    >
      {preview && (
        <div className="flex flex-col gap-4">
          <p className="font-medium">{preview.order.map(name).join(' → ')}</p>
          <fieldset>
            <legend className="mb-1 font-medium">Dates des étapes</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="mode" checked={mode === 'cascade'} onChange={() => setMode('cascade')} />
              Recalculer en cascade (chaque étape garde sa durée)
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="mode" checked={mode === 'conserver'} onChange={() => setMode('conserver')} />
              Garder les dates actuelles (les conflits seront signalés)
            </label>
          </fieldset>
          <div aria-live="polite">
            <h3 className="font-medium">Ce qui va changer</h3>
            <ul className="mt-1 list-disc pl-5">
              {preview.dateChanges.map((c) => (
                <li key={c.stopId} className="tabular">
                  {name(c.stopId)} : {fmtDate(c.before.arrival)}–{fmtDate(c.before.departure)} → {fmtDate(c.after.arrival)}–
                  {fmtDate(c.after.departure)}
                </li>
              ))}
              {preview.transports.toCreate.map(([a, b]) => (
                <li key={`${a}-${b}`}>
                  Trajet à prévoir : {name(a)} → {name(b)} (brouillon)
                </li>
              ))}
              {preview.transports.toFlag.map((id) => (
                <li key={id}>⚠ Trajet réservé devenu inutile, gardé « à vérifier » : {transport(id)}</li>
              ))}
              {preview.transports.toDelete.map((id) => (
                <li key={id}>Brouillon supprimé : {transport(id)}</li>
              ))}
              {preview.transports.toRestore.map((id) => (
                <li key={id}>✓ Trajet réservé de nouveau utile : {transport(id)}</li>
              ))}
              {!preview.dateChanges.length &&
                !preview.transports.toCreate.length &&
                !preview.transports.toFlag.length &&
                !preview.transports.toDelete.length &&
                !preview.transports.toRestore.length && <li>Aucun autre changement.</li>}
            </ul>
            <p className="mt-2 text-slate-600 dark:text-slate-300">Toutes les activités restent dans leur étape.</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
