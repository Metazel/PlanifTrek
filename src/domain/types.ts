/**
 * Modèle de données de PlanifTrek.
 *
 * Principes qui protègent les cas limites du cadrage :
 * - les activités sont rattachées à une étape (stopId), jamais à une position :
 *   réordonner ou fermer la boucle ne peut pas en perdre ;
 * - un trajet est identifié par (étape de départ, étape d'arrivée) ;
 * - les montants sont en unités mineures entières (centimes, agorot) ;
 * - les horaires sont en heure locale + fuseau IANA du lieu.
 */

export type Id = string;
/** Date calendaire locale, format AAAA-MM-JJ. */
export type ISODate = string;
/** Date et heure locales sans fuseau, format AAAA-MM-JJTHH:mm. */
export type LocalDateTime = string;

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** passage : simple transit dans la journée (aéroport, location de voiture), sans nuit. */
export type StopKind = 'ville' | 'famille' | 'passage';
/** Heure locale HH:mm. */
export type LocalTime = string;

export interface Stop {
  id: Id;
  name: string;
  kind: StopKind;
  /** Fuseau IANA, ex. « Asia/Jerusalem ». */
  timeZone: string;
  arrival: ISODate;
  departure: ISODate;
  /** Demi-journée : heures d'arrivée et de départ facultatives. */
  arrivalTime?: LocalTime;
  departureTime?: LocalTime;
  point?: GeoPoint;
  /**
   * Adresse privée (étape famille). Jamais envoyée à un service tiers,
   * exclue des exports Google Maps par défaut.
   */
  privateAddress?: string;
}

export interface Money {
  /** Montant en unités mineures (centimes). Entier. */
  amountMinor: number;
  /** Code ISO 4217, ex. EUR, ILS, USD. */
  currency: string;
}

export type PaymentStatus = 'paye' | 'acompte' | 'a-payer' | 'gratuit';

/** Sous-étapes d'une journée. L'ordre d'affichage d'une journée est l'ordre du tableau `events`. */
export type EventKind =
  | 'hebergement'
  | 'repas'
  | 'deplacement'
  | 'visite'
  | 'activite'
  | 'famille'
  | 'evenement'
  | 'temps-libre';

export interface TripEvent {
  id: Id;
  stopId: Id;
  kind: EventKind;
  title: string;
  /** Jour de l'activité (sauf hébergement). */
  date?: ISODate;
  /** Heure indicative, facultative. */
  time?: LocalTime;
  /** Hébergement : nuit d'arrivée (incluse). */
  checkIn?: ISODate;
  /** Hébergement : jour de départ (exclu des nuits). */
  checkOut?: ISODate;
  price?: Money;
  paymentStatus?: PaymentStatus;
  bookingRef?: string;
  point?: GeoPoint;
  /** « À ne pas oublier » : apparaît dans les rappels. */
  important?: boolean;
  /** Contact à joindre (guide, famille, chauffeur). */
  contact?: Contact;
}

export interface Contact {
  name: string;
  phone?: string;
}

export type TransportMode = 'avion' | 'train' | 'voiture' | 'bus' | 'bateau' | 'taxi' | 'marche';

/** brouillon : créé automatiquement ; reserve : confirmé ; a-verifier : devenu inutile après réorganisation. */
export type TransportStatus = 'brouillon' | 'reserve' | 'a-verifier';

export interface TransportEndpoint {
  place: string;
  at: LocalDateTime;
  timeZone: string;
  point?: GeoPoint;
}

export interface Transport {
  id: Id;
  fromStopId: Id;
  toStopId: Id;
  mode: TransportMode;
  status: TransportStatus;
  departure?: TransportEndpoint;
  arrival?: TransportEndpoint;
  bookingRef?: string;
  price?: Money;
  paymentStatus?: PaymentStatus;
  important?: boolean;
  /** Heure de départ conseillée : minutes d'enregistrement, de battement (rendre la voiture…), de route (vide = estimée). */
  checkInMin?: number;
  bufferMin?: number;
  travelMin?: number;
}

export interface Trip {
  id: Id;
  name: string;
  /** Ordre des étapes : la seule source de vérité de l'itinéraire. */
  stopOrder: Id[];
  stops: Record<Id, Stop>;
  events: TripEvent[];
  transports: Transport[];
  baseCurrency: string;
}
