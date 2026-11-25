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
import { useState, type ReactNode } from 'react';
import { daysOfStop } from '../domain/coherence';
import { diffDays } from '../domain/dates';
import type { EventInput, StopInput } from '../domain/edit';
import { alignLodgingToStop, alignStopToLodging, uncoveredNights } from '../domain/plan';
import { legOf, type TransportInput } from '../domain/transport';
import { LegRow } from './Transport';
import type { Id, Stop, Trip, TripEvent } from '../domain/types';
import { btn, field } from './Dialog';
import { EventForm, EVENT_ICONS, type EventPrefill } from './EventForm';
import { StopForm } from './StopForm';
import { fmtDate, fmtDay, nights } from './format';

export interface StopListProps {
  trip: Trip;
  onReorder: (order: Id[]) => void;
  onUpdateStop: (id: Id, input: StopInput) => void;
  onRemoveStop: (id: Id) => void;
  onAddEvent: (input: EventInput) => void;
  onRemoveEvent: (id: Id) => void;
  onResize: (id: Id, delta: number) => void;
  onMoveEvent: (id: Id, dir: -1 | 1) => void;
  onReorderDay: (ids: Id[]) => void;
  onTransferEvent: (id: Id, stopId: Id) => void;
  onAddTransport: (from: Id, to: Id) => void;
  onUpdateTransport: (id: Id, input: TransportInput) => void;
  onRemoveTransport: (id: Id) => void;
  onAlign: (fn: (t: Trip) => Trip) => void;
  onUpdateEvent: (id: Id, input: EventInput) => void;
}

/** Liste triable : souris, doigt (appui court) et clavier (Espace, flèches, Espace), avec annonces en français. */
function Sortable({ ids, label, onMove, children }: { ids: Id[]; label: (id: Id) => string; onMove: (ids: Id[]) => void; children: ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const n = (id: string | number) => label(String(id));
  const pos = (id: string | number) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${n(active.id)} saisie, position ${pos(active.id)}.`,
    onDragOver: ({ active, over }) => (!over ? `${n(active.id)} hors de la liste.` : over.id === active.id ? undefined : `${n(active.id)} au-dessus de ${n(over.id)}.`),
    onDragEnd: ({ active, over }) => (over ? `${n(active.id)} déposée à la place de ${n(over.id)}.` : `${n(active.id)} reposée.`),
    onDragCancel: ({ active }) => `Déplacement de ${n(active.id)} annulé.`,
  };
  const end = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={end}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: 'Espace pour saisir, flèches haut et bas pour déplacer, Espace pour déposer, Échap pour annuler.' },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

function useDrag(id: Id) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return {
    ref: setNodeRef,
    style: { transform: CSS.Transform.toString(transform), transition },
    isDragging,
    handle: { ...attributes, ...listeners },
  };
}

export function StopList(props: StopListProps) {
  const { trip, onReorder } = props;
  return (
    <Sortable ids={trip.stopOrder} label={(id) => trip.stops[id]?.name ?? ''} onMove={onReorder}>
      <ol className="flex flex-col gap-3" aria-label="Étapes du voyage">
        {trip.stopOrder.map((id, i) => {
          const s = trip.stops[id];
          return s ? <StopCard key={id} stop={s} index={i} {...props} /> : null;
        })}
      </ol>
    </Sortable>
  );
}

const KIND_ICON = { ville: '', famille: '👪 ', passage: '🚏 ' } as const;

function StopCard(p: StopListProps & { stop: Stop; index: number }) {
  const { stop, index, trip } = p;
  const drag = useDrag(stop.id);
  const [mode, setMode] = useState<'view' | 'edit' | 'add' | 'event'>('view');
  const [prefill, setPrefill] = useState<EventPrefill>({});
  const [editing, setEditing] = useState<TripEvent | null>(null);
  const editEvent = (e: TripEvent) => {
    setEditing(e);
    setMode('event');
  };
  const n = Math.max(0, diffDays(stop.arrival, stop.departure));
  const last = trip.stopOrder.length - 1;
  const move = (to: number) => p.onReorder(arrayMove(trip.stopOrder, index, to));
  const mine = trip.events.filter((e) => e.stopId === stop.id);
  const lodgings = mine.filter((e) => e.kind === 'hebergement');
  const missing = uncoveredNights(trip, stop.id);
  const openAdd = (pf: EventPrefill) => {
    setPrefill(pf);
    setMode('add');
  };
  const nextId = trip.stopOrder[index + 1];
  const next = nextId ? trip.stops[nextId] : undefined;
  const leg = next ? legOf(trip, stop.id, next.id) : undefined;
  const hours = [stop.arrivalTime && `arrivée ${stop.arrivalTime}`, stop.departureTime && `départ ${stop.departureTime}`].filter(Boolean).join(', ');

  return (
    <li
      ref={drag.ref}
      style={drag.style}
      className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${drag.isDragging ? 'z-10 border-blue-500 shadow-lg' : 'border-slate-200 dark:border-slate-800'}`}
    >
      <div className="flex flex-wrap items-start gap-1">
        <button type="button" className={`${btn.icon} cursor-grab touch-none text-slate-500`} aria-label={`Déplacer ${stop.name}`} {...drag.handle}>
          ⠿
        </button>
        <div className="min-w-0 flex-1 basis-48">
          <h3 className="font-medium">
            <span className="tabular mr-2 text-slate-500">{index + 1}.</span>
            {KIND_ICON[stop.kind]}
            {stop.name}
          </h3>
          <p className="tabular text-sm text-slate-600 dark:text-slate-300">
            {stop.kind === 'passage' ? `Passage le ${fmtDate(stop.arrival)}` : `${fmtDate(stop.arrival)} → ${fmtDate(stop.departure)} · ${daysOfStop(stop).length} jour(s), ${nights(n)}`}
            {hours && ` · ${hours}`}
            {!stop.point && (
              <button type="button" className="ml-2 underline" onClick={() => setMode('edit')}>
                📍 Pas sur la carte : placer
              </button>
            )}
            <span className="sr-only"> · fuseau {stop.timeZone}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
        {stop.kind !== 'passage' && (
          <div className="flex shrink-0 items-center rounded-xl border border-slate-200 dark:border-slate-700" role="group" aria-label={`Durée à ${stop.name}`}>
            <button type="button" className={btn.icon} disabled={n === 0} onClick={() => p.onResize(stop.id, -1)} aria-label={`Une nuit de moins à ${stop.name}`}>
              −
            </button>
            <span className="tabular px-1 text-sm" aria-hidden="true">
              {n}
            </span>
            <button type="button" className={btn.icon} onClick={() => p.onResize(stop.id, 1)} aria-label={`Une nuit de plus à ${stop.name}`}>
              +
            </button>
          </div>
        )}
        <button type="button" className={btn.icon} disabled={index === 0} onClick={() => move(index - 1)} aria-label={`Monter ${stop.name}`}>
          ↑
        </button>
        <button type="button" className={btn.icon} disabled={index === last} onClick={() => move(index + 1)} aria-label={`Descendre ${stop.name}`}>
          ↓
        </button>
        </div>
      </div>

      {(lodgings.length > 0 || missing.length > 0) && (
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          {lodgings.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                🛏<span className="sr-only"> Hébergement :</span> {e.title}
                <span className="tabular ml-2 text-slate-500">
                  {e.checkIn && fmtDate(e.checkIn)} → {e.checkOut && fmtDate(e.checkOut)}
                </span>
              </span>
              <span className="flex">
                <button type="button" className={`${btn.icon} text-slate-500`} onClick={() => editEvent(e)} aria-label={`Modifier ${e.title}`}>
                  ✎
                </button>
                <button type="button" className={`${btn.icon} text-slate-500`} onClick={() => p.onRemoveEvent(e.id)} aria-label={`Supprimer ${e.title}`}>
                  ✕
                </button>
              </span>
              {(e.checkIn !== stop.arrival || e.checkOut !== stop.departure) && (
                <div className="flex w-full flex-wrap gap-2 text-amber-800 dark:text-amber-300">
                  <span>⚠ Dates différentes de l’étape.</span>
                  <button type="button" className={btn.secondary} onClick={() => p.onAlign((t) => alignStopToLodging(t, e.id))}>
                    Ajuster l’étape à l’hébergement
                  </button>
                  <button type="button" className={btn.secondary} onClick={() => p.onAlign((t) => alignLodgingToStop(t, e.id))}>
                    Ajuster l’hébergement à l’étape
                  </button>
                </div>
              )}
            </div>
          ))}
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-amber-800 dark:text-amber-300">
              <span>⚠ {nights(missing.length)} sans hébergement</span>
              <button
                type="button"
                className={btn.secondary}
                onClick={() => openAdd({ kind: 'hebergement', checkIn: missing[0] ?? stop.arrival, checkOut: stop.departure })}
              >
                Ajouter un hébergement
              </button>
            </div>
          )}
        </div>
      )}

      <Days {...p} events={mine.filter((e) => e.kind !== 'hebergement')} onAddOnDay={(date) => openAdd({ date })} onEditEvent={editEvent} />

      {mode === 'edit' ? (
        <div className="mt-3">
          <StopForm
            initial={{
              name: stop.name,
              kind: stop.kind,
              timeZone: stop.timeZone,
              arrival: stop.arrival,
              departure: stop.departure,
              ...(stop.arrivalTime ? { arrivalTime: stop.arrivalTime } : {}),
              ...(stop.departureTime ? { departureTime: stop.departureTime } : {}),
              ...(stop.point ? { point: stop.point } : {}),
              ...(stop.privateAddress ? { privateAddress: stop.privateAddress } : {}),
            }}
            submitLabel="Enregistrer"
            onSubmit={(input) => {
              p.onUpdateStop(stop.id, input);
              setMode('view');
            }}
            onCancel={() => setMode('view')}
          />
        </div>
      ) : mode === 'event' && editing ? (
        <EventForm
          trip={trip}
          stop={stop}
          initial={editing}
          onSubmit={(input) => {
            p.onUpdateEvent(editing.id, input);
            setMode('view');
          }}
          onCancel={() => setMode('view')}
        />
      ) : mode === 'add' ? (
        <EventForm
          trip={trip}
          stop={stop}
          prefill={prefill}
          onSubmit={(input) => {
            p.onAddEvent(input);
            setMode('view');
          }}
          onCancel={() => setMode('view')}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <button type="button" className={btn.secondary} onClick={() => openAdd({})}>
            + Sous-étape
          </button>
          <button type="button" className={btn.secondary} onClick={() => setMode('edit')}>
            Modifier
          </button>
          <button type="button" className={btn.secondary} onClick={() => p.onRemoveStop(stop.id)}>
            Supprimer l’étape
          </button>
        </div>
      )}
      {next && (
        <LegRow
          trip={trip}
          from={stop}
          to={next}
          {...(leg ? { transport: leg } : {})}
          onAdd={() => p.onAddTransport(stop.id, next.id)}
          onSave={(input) => leg && p.onUpdateTransport(leg.id, input)}
          onRemove={() => leg && p.onRemoveTransport(leg.id)}
        />
      )}
    </li>
  );
}

/** Journées de l'étape et leurs sous-étapes, réorganisables et transférables. */
function Days(p: StopListProps & { stop: Stop; events: TripEvent[]; onAddOnDay: (d: string) => void; onEditEvent: (e: TripEvent) => void }) {
  const { stop, events, trip } = p;
  const days = daysOfStop(stop);
  const outside = events.filter((e) => !e.date || !days.includes(e.date));
  if (!events.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      {days.map((d) => {
        const list = events.filter((e) => e.date === d);
        if (!list.length) return null;
        return (
          <section key={d} aria-label={`${stop.name}, ${fmtDay(d)}`}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fmtDay(d)}</h4>
            <Sortable ids={list.map((e) => e.id)} label={(id) => trip.events.find((e) => e.id === id)?.title ?? ''} onMove={p.onReorderDay}>
              <ol className="mt-1 flex flex-col gap-1">
                {list.map((e, i) => (
                  <SubStep key={e.id} {...p} event={e} first={i === 0} last={i === list.length - 1} />
                ))}
              </ol>
            </Sortable>
          </section>
        );
      })}
      {outside.length > 0 && (
        <section aria-label={`${stop.name}, hors des dates`}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Hors des dates de l’étape</h4>
          <ol className="mt-1 flex flex-col gap-1">
            {outside.map((e) => (
              <SubStep key={e.id} {...p} event={e} first last />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function SubStep(p: StopListProps & { stop: Stop; event: TripEvent; first: boolean; last: boolean; onEditEvent: (e: TripEvent) => void }) {
  const { event: e, trip, stop } = p;
  const drag = useDrag(e.id);
  const [icon, label] = EVENT_ICONS[e.kind];
  return (
    <li ref={drag.ref} style={drag.style} className={`flex flex-wrap items-center gap-x-1 rounded-xl text-sm ${drag.isDragging ? 'z-10 bg-blue-50 dark:bg-slate-800' : ''}`}>
      <button type="button" className={`${btn.icon} cursor-grab touch-none text-slate-400`} aria-label={`Déplacer ${e.title}`} {...drag.handle}>
        ⠿
      </button>
      <span className="min-w-0 flex-1 basis-40">
        <span aria-hidden="true">{icon} </span>
        <span className="sr-only">{label} : </span>
        {e.time && <span className="tabular mr-1 text-slate-500">{e.time}</span>}
        {e.title}
        {e.point && <span className="ml-1" title="placé sur la carte" aria-label="placé sur la carte">📍</span>}
      </span>
      <span className="ml-auto flex items-center gap-1">
      <button type="button" className={btn.icon} disabled={p.first} onClick={() => p.onMoveEvent(e.id, -1)} aria-label={`Monter ${e.title}`}>
        ↑
      </button>
      <button type="button" className={btn.icon} disabled={p.last} onClick={() => p.onMoveEvent(e.id, 1)} aria-label={`Descendre ${e.title}`}>
        ↓
      </button>
      {trip.stopOrder.length > 1 && (
        <select
          className={`${field} w-auto max-w-32 text-xs`}
          aria-label={`Transférer ${e.title} vers une autre étape`}
          value=""
          onChange={(ev) => ev.target.value && p.onTransferEvent(e.id, ev.target.value)}
        >
          <option value="">Vers…</option>
          {trip.stopOrder
            .filter((id) => id !== stop.id)
            .map((id) => (
              <option key={id} value={id}>
                {trip.stops[id]?.name}
              </option>
            ))}
        </select>
      )}
      <button type="button" className={`${btn.icon} text-slate-500`} onClick={() => p.onEditEvent(e)} aria-label={`Modifier ${e.title}`}>
        ✎
      </button>
      <button type="button" className={`${btn.icon} text-slate-500`} onClick={() => p.onRemoveEvent(e.id)} aria-label={`Supprimer ${e.title}`}>
        ✕
      </button>
      </span>
    </li>
  );
}
