import type { Stop, Trip, TripEvent } from './types';

/** Scénario de référence du cadrage : circuit Israël, août. */
const TZ = 'Asia/Jerusalem';

const stop = (id: string, name: string, arrival: string, departure: string, kind: Stop['kind'] = 'ville'): Stop => ({
  id,
  name,
  kind,
  timeZone: TZ,
  arrival,
  departure,
});

const hotel = (id: string, stopId: string, title: string, checkIn: string, checkOut: string): TripEvent => ({
  id,
  stopId,
  kind: 'hebergement',
  title,
  checkIn,
  checkOut,
  paymentStatus: 'paye',
  price: { amountMinor: 45000, currency: 'ILS' },
});

export function israelTrip(): Trip {
  return {
    id: 'trip-israel',
    name: 'Israël — août',
    baseCurrency: 'EUR',
    stopOrder: ['jer', 'net', 'eil'],
    stops: {
      jer: stop('jer', 'Jérusalem', '2027-08-10', '2027-08-13'),
      net: stop('net', 'Netanya', '2027-08-13', '2027-08-16'),
      eil: stop('eil', 'Eilat', '2027-08-16', '2027-08-19'),
      mm: stop('mm', 'Mer Morte', '2027-08-16', '2027-08-17'),
      tlv: stop('tlv', 'Tel Aviv', '2027-08-08', '2027-08-10'),
    },
    events: [
      hotel('h-jer', 'jer', 'Hôtel à Jérusalem', '2027-08-10', '2027-08-13'),
      hotel('h-net', 'net', 'Appartement à Netanya', '2027-08-13', '2027-08-16'),
      hotel('h-eil', 'eil', 'Hôtel à Eilat', '2027-08-16', '2027-08-19'),
      { id: 'a-kotel', stopId: 'jer', kind: 'visite', title: 'Mur occidental', date: '2027-08-11' },
      { id: 'a-yad', stopId: 'jer', kind: 'visite', title: 'Yad Vashem', date: '2027-08-12' },
      { id: 'f-cousins', stopId: 'net', kind: 'famille', title: 'Dîner chez les cousins', date: '2027-08-14' },
      { id: 'a-recif', stopId: 'eil', kind: 'activite', title: 'Plongée récif', date: '2027-08-17' },
    ],
    transports: [
      { id: 't-jer-net', fromStopId: 'jer', toStopId: 'net', mode: 'train', status: 'reserve' },
      { id: 't-net-eil', fromStopId: 'net', toStopId: 'eil', mode: 'avion', status: 'reserve' },
    ],
  };
}
