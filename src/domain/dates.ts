import type { ISODate } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Vrai si la chaîne est une date calendaire réelle au format AAAA-MM-JJ. */
export function isISODate(value: string): value is ISODate {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d;
}

function toUtcMs(date: ISODate): number {
  if (!isISODate(date)) throw new RangeError(`Date invalide : ${date}`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Nombre de jours de a à b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** Jours calendaires de start à end, bornes incluses. */
export function daysBetween(start: ISODate, end: ISODate): ISODate[] {
  const n = diffDays(start, end);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

/** Nuits de start à end : chaque date de nuit, end exclu. */
export function nightsBetween(start: ISODate, end: ISODate): ISODate[] {
  const n = diffDays(start, end);
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}
