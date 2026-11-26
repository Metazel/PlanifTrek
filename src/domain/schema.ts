import { z } from 'zod';
import { isISODate } from './dates';
import { isValidTimeZone } from './time';
import type { Trip } from './types';

/**
 * Validation stricte de toute donnée relue (stockage local, fichier importé).
 * Une donnée qui ne passe pas n'est jamais utilisée telle quelle.
 */
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const isoDate = z.string().refine(isISODate, 'date invalide');
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timeZone = z.string().max(64).refine(isValidTimeZone, 'fuseau invalide');
const text = (max: number) => z.string().max(max);
const currency = z.string().regex(/^[A-Z]{3}$/);
const point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const moneySchema = z.object({ amountMinor: z.number().int().safe(), currency });
const paymentStatus = z.enum(['paye', 'acompte', 'a-payer', 'gratuit']);

const stopSchema = z.strictObject({
  id,
  name: text(80),
  kind: z.enum(['ville', 'famille', 'passage']),
  timeZone,
  arrival: isoDate,
  departure: isoDate,
  arrivalTime: localTime.optional(),
  departureTime: localTime.optional(),
  point: point.optional(),
  privateAddress: text(200).optional(),
});

const eventSchema = z.strictObject({
  id,
  stopId: id,
  kind: z.enum(['hebergement', 'repas', 'deplacement', 'visite', 'activite', 'famille', 'evenement', 'temps-libre']),
  title: text(120),
  date: isoDate.optional(),
  time: localTime.optional(),
  checkIn: isoDate.optional(),
  checkOut: isoDate.optional(),
  price: moneySchema.optional(),
  paymentStatus: paymentStatus.optional(),
  bookingRef: text(40).optional(),
  point: point.optional(),
  important: z.boolean().optional(),
  contact: z.strictObject({ name: text(80), phone: z.string().regex(/^\+?[0-9 ().-]{4,24}$/).optional() }).optional(),
});

const endpoint = z.strictObject({ place: text(120), at: localDateTime, timeZone, point: point.optional() });

const transportSchema = z.strictObject({
  id,
  fromStopId: id,
  toStopId: id,
  mode: z.enum(['avion', 'train', 'voiture', 'bus', 'bateau', 'taxi', 'marche']),
  status: z.enum(['brouillon', 'reserve', 'a-verifier']),
  departure: endpoint.optional(),
  arrival: endpoint.optional(),
  bookingRef: text(40).optional(),
  price: moneySchema.optional(),
  paymentStatus: paymentStatus.optional(),
  important: z.boolean().optional(),
  checkInMin: z.number().int().min(0).max(720).optional(),
  bufferMin: z.number().int().min(0).max(720).optional(),
  travelMin: z.number().int().min(0).max(2880).optional(),
});

export const tripSchema = z
  .strictObject({
    id,
    name: text(80),
    stopOrder: z.array(id).max(60),
    stops: z.record(id, stopSchema),
    events: z.array(eventSchema).max(500),
    transports: z.array(transportSchema).max(200),
    rentals: z
      .array(
        z.strictObject({
          id,
          agency: text(80),
          vehicle: text(80).optional(),
          pickup: endpoint,
          dropoff: endpoint,
          bookingRef: text(40).optional(),
          price: moneySchema.optional(),
          paymentStatus: paymentStatus.optional(),
          important: z.boolean().optional(),
        }),
      )
      .max(20)
      .optional(),
    baseCurrency: currency,
  })
  .superRefine((t, ctx) => {
    const ids = new Set(Object.keys(t.stops));
    if (new Set(t.stopOrder).size !== t.stopOrder.length) ctx.addIssue({ code: 'custom', message: 'ordre en double' });
    for (const s of t.stopOrder) if (!ids.has(s)) ctx.addIssue({ code: 'custom', message: 'étape inconnue' });
    for (const [k, s] of Object.entries(t.stops)) if (s.id !== k) ctx.addIssue({ code: 'custom', message: 'clé d’étape' });
  });

export type ParseResult = { ok: true; trip: Trip } | { ok: false; error: string };

export function parseTrip(data: unknown): ParseResult {
  const r = tripSchema.safeParse(data);
  // Les types zod et le type métier sont identiques ; la conversion passe par le schéma validé.
  return r.success ? { ok: true, trip: r.data as Trip } : { ok: false, error: r.error.issues[0]?.message ?? 'invalide' };
}
