import type { LocalDateTime } from './types';

const LOCAL_DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Vrai si le fuseau IANA est reconnu par le moteur du navigateur. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Décalage du fuseau par rapport à UTC, en ms, à l'instant donné. */
function offsetMs(tz: string, utcMs: number): number {
  const parts = formatterFor(tz).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Convertit une heure locale d'un lieu en instant absolu (ms epoch).
 * Heure inexistante (passage à l'heure d'été) : décalée vers l'avant.
 */
export function toInstant(local: LocalDateTime, tz: string): number {
  const m = LOCAL_DT.exec(local);
  if (!m) throw new RangeError(`Date et heure invalides : ${local}`);
  if (!isValidTimeZone(tz)) throw new RangeError(`Fuseau inconnu : ${tz}`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) {
    throw new RangeError(`Date et heure invalides : ${local}`);
  }
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const first = naive - offsetMs(tz, naive);
  const second = naive - offsetMs(tz, first);
  return Math.max(first, second);
}

export type DurationResult =
  | { ok: true; minutes: number }
  | { ok: false; reason: 'arrivee-avant-depart' | 'invalide' };

/** Durée réelle d'un trajet, fuseaux horaires compris. */
export function travelDuration(
  departure: { at: LocalDateTime; timeZone: string },
  arrival: { at: LocalDateTime; timeZone: string },
): DurationResult {
  let start: number;
  let end: number;
  try {
    start = toInstant(departure.at, departure.timeZone);
    end = toInstant(arrival.at, arrival.timeZone);
  } catch {
    return { ok: false, reason: 'invalide' };
  }
  if (end <= start) return { ok: false, reason: 'arrivee-avant-depart' };
  return { ok: true, minutes: Math.round((end - start) / 60_000) };
}

/** « 4 h 05 » */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}
