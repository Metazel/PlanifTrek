import { addDays } from './dates';
import { toInstant } from './time';
import type { GeoPoint, Id, LocalDateTime, Transport, Trip } from './types';

/* ---------- Heure de départ conseillée ---------- */

const CHECKIN: Record<string, number> = { avion: 180, bateau: 90, train: 20, bus: 15 };
const BUFFER: Record<string, number> = { avion: 60 };

/** Téléphone : chiffres, +, espaces, tirets, points, parenthèses. */
export const isPhone = (s: string) => /^\+?[0-9 ().-]{4,24}$/.test(s.trim());
/** Lien d'appel sans caractère superflu. */
export const telHref = (s: string) => `tel:${s.replace(/[^0-9+]/g, '')}`;

function km(a: GeoPoint, b: GeoPoint) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Estimation prudente du temps de route : distance × 1,3 à 60 km/h, arrondie aux 5 minutes supérieures. */
export const roadMinutes = (a: GeoPoint, b: GeoPoint) => Math.ceil(((km(a, b) * 1.3) / 60) * 60 / 5) * 5;

/** Dernier lieu connu avant le départ : sous-étape du jour, sinon hébergement, sinon l'étape. */
function originOf(trip: Trip, t: Transport): GeoPoint | undefined {
  const day = t.departure?.at.slice(0, 10);
  const stop = trip.stops[t.fromStopId];
  if (!day || !stop) return undefined;
  const sameDay = trip.events.filter((e) => e.stopId === stop.id && e.kind !== 'hebergement' && (e.date === day || e.date === addDays(day, -1)) && e.point);
  const lodging = trip.events.find((e) => e.stopId === stop.id && e.kind === 'hebergement' && e.point);
  return sameDay[sameDay.length - 1]?.point ?? lodging?.point ?? stop.point;
}

export interface DepartureAdvice {
  leaveAt: LocalDateTime;
  checkIn: number;
  buffer: number;
  travel: number | null;
  travelEstimated: boolean;
}

function localMinus(at: LocalDateTime, tz: string, minutes: number): LocalDateTime {
  const ms = toInstant(at, tz) - minutes * 60_000;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms));
  const g = (k: string) => parts.find((p) => p.type === k)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}

/** Heure à laquelle partir pour ne pas rater un trajet (vol de 5 h : enregistrement 3 h + battement 1 h + route). */
export function departureAdvice(trip: Trip, t: Transport): DepartureAdvice | null {
  if (!t.departure) return null;
  const checkIn = t.checkInMin ?? CHECKIN[t.mode] ?? 0;
  const buffer = t.bufferMin ?? BUFFER[t.mode] ?? 0;
  let travel: number | null = t.travelMin ?? null;
  let travelEstimated = false;
  if (travel === null) {
    const from = originOf(trip, t);
    if (from && t.departure.point) {
      travel = roadMinutes(from, t.departure.point);
      travelEstimated = true;
    }
  }
  if (!checkIn && !buffer && !travel) return null;
  try {
    return { leaveAt: localMinus(t.departure.at, t.departure.timeZone, checkIn + buffer + (travel ?? 0)), checkIn, buffer, travel, travelEstimated };
  } catch {
    return null;
  }
}

/* ---------- Rappels « à ne pas oublier » ---------- */

export interface Reminder {
  id: Id;
  title: string;
  at: LocalDateTime;
  timeZone: string;
  durationMin: number;
  place?: string;
  contact?: { name: string; phone?: string };
  detail?: string;
}

export function reminders(trip: Trip): Reminder[] {
  const list: Reminder[] = [];
  for (const e of trip.events) {
    const stop = trip.stops[e.stopId];
    if (!e.important || !stop || !e.date) continue;
    const r: Reminder = { id: e.id, title: e.title, at: `${e.date}T${e.time ?? '09:00'}`, timeZone: stop.timeZone, durationMin: 60 };
    // L'adresse privée d'une étape famille n'est jamais reprise.
    if (e.kind !== 'famille' && stop.kind !== 'famille') r.place = stop.name;
    if (e.contact) r.contact = e.contact;
    if (!e.time) r.detail = 'Heure à préciser';
    list.push(r);
  }
  for (const t of trip.transports) {
    if (!t.important || !t.departure) continue;
    const to = trip.stops[t.toStopId]?.name ?? '';
    const ref = t.bookingRef ? ` ${t.bookingRef}` : '';
    list.push({ id: t.id, title: `${t.mode === 'avion' ? 'Vol' : 'Départ'}${ref} vers ${to}`, at: t.departure.at, timeZone: t.departure.timeZone, durationMin: 30, place: t.departure.place });
    const adv = departureAdvice(trip, t);
    if (adv) {
      const parts = [adv.checkIn && `enregistrement ${adv.checkIn} min`, adv.buffer && `battement ${adv.buffer} min`, adv.travel && `route ${adv.travelEstimated ? '≈' : ''}${adv.travel} min`].filter(Boolean).join(' + ');
      list.push({ id: `${t.id}-partir`, title: `Partir pour${ref} vers ${to} (départ ${t.departure.at.slice(11)})`, at: adv.leaveAt, timeZone: t.departure.timeZone, durationMin: 15, detail: parts });
    }
  }
  for (const r of trip.rentals ?? []) {
    if (!r.important) continue;
    const v = r.vehicle ? ` (${r.vehicle})` : '';
    const ref = r.bookingRef ? `Réservation ${r.bookingRef}` : undefined;
    list.push(
      { id: `${r.id}-prise`, title: `Prendre le véhicule${v} — ${r.agency}`, at: r.pickup.at, timeZone: r.pickup.timeZone, durationMin: 30, place: r.pickup.place, ...(ref ? { detail: ref } : {}) },
      { id: `${r.id}-retour`, title: `Rendre le véhicule${v} — ${r.agency}`, at: r.dropoff.at, timeZone: r.dropoff.timeZone, durationMin: 30, place: r.dropoff.place, ...(ref ? { detail: ref } : {}) },
    );
  }
  return list.sort((a, b) => toInstant(a.at, a.timeZone) - toInstant(b.at, b.timeZone));
}

/* ---------- Agenda : lien Google Agenda et fichier .ics ---------- */

const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function googleCalendarUrl(r: Reminder): string {
  const start = toInstant(r.at, r.timeZone);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: r.title,
    dates: `${utc(start)}/${utc(start + r.durationMin * 60_000)}`,
    ctz: r.timeZone,
  });
  const details = [r.detail, r.contact && `${r.contact.name}${r.contact.phone ? ` ${r.contact.phone}` : ''}`].filter(Boolean).join('\n');
  if (details) q.set('details', details);
  if (r.place) q.set('location', r.place);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fichier iCalendar (RFC 5545) avec une alarme 30 min avant chaque rappel. */
export function toIcs(list: Reminder[], stamp = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PlanifTrek//FR', 'CALSCALE:GREGORIAN'];
  for (const r of list) {
    const start = toInstant(r.at, r.timeZone);
    const desc = [r.detail, r.contact && `${r.contact.name}${r.contact.phone ? ` ${r.contact.phone}` : ''}`].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}@planiftrek`,
      `DTSTAMP:${utc(stamp)}`,
      `DTSTART:${utc(start)}`,
      `DTEND:${utc(start + r.durationMin * 60_000)}`,
      `SUMMARY:${esc(r.title)}`,
      ...(r.place ? [`LOCATION:${esc(r.place)}`] : []),
      ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.title)}`,
      'TRIGGER:-PT30M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
