import type { ISODate } from '../domain/types';

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const full = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const fmtDate = (d: ISODate) => dayMonth.format(new Date(`${d}T00:00:00Z`));
export const fmtDay = (d: ISODate) => full.format(new Date(`${d}T00:00:00Z`));

export function todayISO(): ISODate {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Europe/Paris';
  }
}

let zones: string[] | null = null;
export function timeZones(): string[] {
  if (!zones) {
    try {
      zones = Intl.supportedValuesOf('timeZone');
    } catch {
      zones = ['Europe/Paris', 'Asia/Jerusalem', 'UTC'];
    }
  }
  return zones;
}

export const nights = (n: number) => (n <= 1 ? `${n} nuit` : `${n} nuits`);
