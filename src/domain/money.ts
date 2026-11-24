import type { Money } from './types';

const AMOUNT = /^\s*(-?)(\d{1,9})(?:[.,](\d{1,2}))?\s*$/;
const CURRENCY = /^[A-Z]{3}$/;

/** « 12,5 » → 1250. Refuse tout ce qui n'est pas un montant simple. */
export function parseAmount(input: string): number | null {
  const m = AMOUNT.exec(input.replace(/ |\s(?=\d)/g, ''));
  if (!m) return null;
  const units = Number(m[2]);
  const cents = Number((m[3] ?? '').padEnd(2, '0'));
  const value = units * 100 + cents;
  return m[1] === '-' ? -value : value;
}

export function money(amountMinor: number, currency: string): Money {
  if (!Number.isSafeInteger(amountMinor)) throw new RangeError('Montant non entier');
  if (!CURRENCY.test(currency)) throw new RangeError(`Devise invalide : ${currency}`);
  return { amountMinor, currency };
}

export function formatMoney({ amountMinor, currency }: Money, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 100);
}

/**
 * Convertit vers la devise de base.
 * rates : valeur d'une unité de la devise exprimée en devise de base (ex. ILS → 0,25 EUR).
 * Arrondi au centime le plus proche.
 */
export function toBase(m: Money, base: string, rates: Record<string, number>): number | null {
  if (m.currency === base) return m.amountMinor;
  const rate = rates[m.currency];
  if (rate === undefined || !(rate > 0)) return null;
  return Math.round(m.amountMinor * rate);
}
