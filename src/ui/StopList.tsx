import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { daysOfStop } from '../domain/coherence';
import { diffDays } from '../domain/dates';
import type { EventInput, StopInput } from '../domain/edit';
import type { Id, Stop, Trip } from '../domain/types';
import { btn } from './Dialog';
import { EventForm, EVENT_LABELS } from './EventForm';
import { StopForm } from './StopForm';
import { fmtDate, fmtDay, nights } from './format';

interface Props {
  trip: Trip;
  onReorder: (order: Id[]) => void;
  onUpdateStop: (id: Id, input: StopInput) => void;
  onRemoveStop: (id: Id) => void;
  onAddEvent: (input: EventInput) => void;
  onRemoveEvent: (id: Id) => void;
}

export function StopList(props: Props) {
  const { trip, onReorder } = props;
  const sensors = useSensors(
    // Délai au toucher : le défilement au doigt reste possible.
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const name = (id: string | number) => trip.stops[String(id)]?.name ?? '';
  const pos = (id: string | number) => trip.stopOrder.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${name(active.id)} saisie, position ${pos(active.id)}.`,
    onDragOver: ({ active, over }) =>
      !over ? `${name(active.id)} hors de la liste.` : over.id === active.id ? undefined : `${name(active.id)} au-dessus de ${name(over.id)}.`,
    onDragEnd: ({ active, over }) => (over ? `${name(active.id)} déposée à la place de ${name(over.id)}.` : `${name(active.id)} reposée.`),
    onDragCancel: ({ active }) => `Déplacement de ${name(active.id)} annulé.`,
  };

  const end = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = trip.stopOrder.indexOf(String(active.id));
    const to = trip.stopOrder.indexOf(String(over.id));
    onReorder(arrayMove(trip.stopOrder, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={end}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Pour déplacer une étape : Espace pour la saisir, flèches haut et bas pour la déplacer, Espace pour la déposer, Échap pour annuler.',
        },
      }}
    >
      <SortableContext items={trip.stopOrder} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-3" aria-label="Étapes du voyage">
          {trip.stopOrder.map((id, i) => {
            const s = trip.stops[id];
            return s ? <StopCard key={id} stop={s} index={i} {...props} /> : null;
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function StopCard({ stop, index, trip, onReorder, onUpdateStop, onRemoveStop, onAddEvent, onRemoveEvent }: Props & { stop: Stop; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const events = trip.events
    .filter((e) => e.stopId === stop.id)
    .sort((a, b) => (a.checkIn ?? a.date ?? '').localeCompare(b.checkIn ?? b.date ?? ''));
  const last = trip.stopOrder.length - 1;
  const move = (to: number) => onReorder(arrayMove(trip.stopOrder, index, to));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${isDragging ? 'z-10 border-blue-500 shadow-lg' : 'border-slate-200 dark:border-slate-800'}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className={`${btn.icon} cursor-grab touch-none text-slate-500`}
          aria-label={`Déplacer ${stop.name}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">
            <span className="tabular mr-2 text-slate-500">{index + 1}.</span>
            {stop.kind === 'famille' ? '👪 ' : ''}
            {stop.name}
          </h3>
          <p className="tabular text-sm text-slate-600 dark:text-slate-300">
            {fmtDate(stop.arrival)} → {fmtDate(stop.departure)} · {daysOfStop(stop).length} jour(s), {nights(Math.max(0, diffDays(stop.arrival, stop.departure)))}
            <span className="sr-only"> · fuseau {stop.timeZone}</span>
          </p>
        </div>
        <div className="flex shrink-0">
          <button type="button" className={btn.icon} disabled={index === 0} onClick={() => move(index - 1)} aria-label={`Monter ${stop.name}`}>
            ↑
          </button>
          <button type="button" className={btn.icon} disabled={index === last} onClick={() => move(index + 1)} aria-label={`Descendre ${stop.name}`}>
            ↓
          </button>
        </div>
      </div>

      {events.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <span>
                <span className="mr-1">{EVENT_LABELS[e.kind].split(' ')[0]}</span>
                <span className="sr-only">{EVENT_LABELS[e.kind].slice(2)} : </span>
                {e.title}
                <span className="tabular ml-2 text-slate-500">
                  {e.kind === 'hebergement' && e.checkIn && e.checkOut ? `${fmtDate(e.checkIn)} → ${fmtDate(e.checkOut)}` : e.date ? fmtDay(e.date) : ''}
                </span>
              </span>
              <button type="button" className={`${btn.icon} text-slate-500`} onClick={() => onRemoveEvent(e.id)} aria-label={`Supprimer ${e.title}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="mt-3">
          <StopForm
            initial={{
              name: stop.name,
              kind: stop.kind,
              timeZone: stop.timeZone,
              arrival: stop.arrival,
              departure: stop.departure,
              ...(stop.privateAddress ? { privateAddress: stop.privateAddress } : {}),
            }}
            submitLabel="Enregistrer"
            onSubmit={(input) => {
              onUpdateStop(stop.id, input);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : adding ? (
        <EventForm
          trip={trip}
          stop={stop}
          onSubmit={(input) => {
            onAddEvent(input);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <button type="button" className={btn.secondary} onClick={() => setAdding(true)}>
            + Événement
          </button>
          <button type="button" className={btn.secondary} onClick={() => setEditing(true)}>
            Modifier
          </button>
          <button type="button" className={btn.secondary} onClick={() => onRemoveStop(stop.id)}>
            Supprimer l’étape
          </button>
        </div>
      )}
    </li>
  );
}
