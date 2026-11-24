import { describe, expect, it } from 'vitest';
import {
  addEvent,
  addStop,
  cleanText,
  createTrip,
  defaultDates,
  defaultTimeZone,
  LIMITS,
  removeEvent,
  removeStop,
  renameTrip,
  stopDependencies,
  updateStop,
  validateEvent,
  validateStop,
  type StopInput,
} from './edit';
import { parseTrip } from './schema';
import { israelTrip } from './fixtures';
import { checkTrip } from './coherence';

const jer: StopInput = {
  name: 'Jérusalem',
  kind: 'ville',
  timeZone: 'Asia/Jerusalem',
  arrival: '2027-08-10',
  departure: '2027-08-13',
};

describe('saisie des étapes (CU1)', () => {
  it('crée un voyage et ajoute des étapes dans l’ordre', () => {
    let t = createTrip('t1', '  Israël   2027 ');
    expect(t.name).toBe('Israël 2027');
    t = addStop(t, 's1', jer);
    t = addStop(t, 's2', { ...jer, name: 'Netanya', arrival: '2027-08-13', departure: '2027-08-16' });
    t = addStop(t, 's0', { ...jer, name: 'Tel Aviv', arrival: '2027-08-08', departure: '2027-08-10' }, 0);
    expect(t.stopOrder).toEqual(['s0', 's1', 's2']);
    expect(checkTrip(t).filter((a) => a.kind === 'nuit-sans-hebergement')).toHaveLength(8);
  });

  it('refuse nom vide, dates incohérentes, fuseau inconnu', () => {
    expect(validateStop({ ...jer, name: '   ' })).toEqual(['nom-vide']);
    expect(validateStop({ ...jer, departure: '2027-08-09' })).toEqual(['depart-avant-arrivee']);
    expect(validateStop({ ...jer, arrival: '2027-02-30' })).toEqual(['date-invalide']);
    expect(validateStop({ ...jer, timeZone: 'Lune/Base' })).toEqual(['fuseau-invalide']);
    expect(() => addStop(createTrip('t', 'x'), 's', { ...jer, name: '' })).toThrow(RangeError);
    // Étape d'une seule journée (arrivée = départ) acceptée.
    expect(validateStop({ ...jer, departure: jer.arrival })).toEqual([]);
  });

  it('étape famille : adresse privée gardée, nettoyée ; ignorée pour une ville', () => {
    let t = addStop(createTrip('t', 'x'), 'f', { ...jer, kind: 'famille', name: 'Cousins', privateAddress: ' 12 rue X\n‮Haifa ' });
    expect(t.stops.f?.privateAddress).toBe('12 rue X Haifa');
    t = addStop(t, 'v', { ...jer, privateAddress: 'ne doit pas être gardée' });
    expect(t.stops.v?.privateAddress).toBeUndefined();
  });

  it('borne le nombre d’étapes et la longueur des textes', () => {
    let t = createTrip('t', 'x');
    for (let i = 0; i < LIMITS.stops; i++) t = addStop(t, `s${i}`, jer);
    expect(() => addStop(t, 'trop', jer)).toThrow(RangeError);
    expect(cleanText('a'.repeat(500), LIMITS.name)).toHaveLength(LIMITS.name);
  });

  it('modifie une étape existante seulement', () => {
    const t = updateStop(israelTrip(), 'jer', { ...jer, name: 'Yerushalayim' });
    expect(t.stops.jer?.name).toBe('Yerushalayim');
    expect(() => updateStop(israelTrip(), 'nope', jer)).toThrow(RangeError);
  });

  it('suppression : annonce ce qu’elle emporte, puis retire événements et trajets liés', () => {
    const trip = israelTrip();
    expect(stopDependencies(trip, 'net')).toEqual({ events: 2, reservedTransports: 2 });
    const t = removeStop(trip, 'net');
    expect(t.stopOrder).toEqual(['jer', 'eil']);
    expect(t.events.some((e) => e.stopId === 'net')).toBe(false);
    expect(t.transports).toEqual([]);
    expect(removeStop(trip, 'nope')).toBe(trip);
  });

  it('propose fuseau et dates par défaut à partir de la dernière étape', () => {
    expect(defaultTimeZone(israelTrip(), 'Europe/Paris')).toBe('Asia/Jerusalem');
    expect(defaultTimeZone(createTrip('t', 'x'), 'Europe/Paris')).toBe('Europe/Paris');
    expect(defaultTimeZone(createTrip('t', 'x'), 'n/importe')).toBe('Europe/Paris');
    expect(defaultDates(israelTrip(), '2027-01-01')).toEqual({ arrival: '2027-08-19', departure: '2027-08-20' });
    expect(defaultDates(createTrip('t', 'x'), '2027-12-31')).toEqual({ arrival: '2027-12-31', departure: '2028-01-01' });
  });

  it('renomme sans accepter un nom vide', () => {
    const t = israelTrip();
    expect(renameTrip(t, '  ')).toBe(t);
    expect(renameTrip(t, 'Été').name).toBe('Été');
  });
});

describe('saisie des événements', () => {
  it('ajoute un hébergement qui couvre les nuits', () => {
    let t = addStop(createTrip('t', 'x'), 's', jer);
    t = addEvent(t, 'h', { stopId: 's', kind: 'hebergement', title: 'Hôtel', checkIn: '2027-08-10', checkOut: '2027-08-13' });
    expect(checkTrip(t)).toEqual([]);
    expect(removeEvent(t, 'h').events).toEqual([]);
  });

  it('refuse titre vide, étape inconnue, hébergement sans nuit', () => {
    const t = israelTrip();
    expect(validateEvent(t, { stopId: 'jer', kind: 'visite', title: ' ' })).toEqual(['titre-vide']);
    expect(validateEvent(t, { stopId: 'x', kind: 'visite', title: 'a' })).toEqual(['etape-inconnue']);
    expect(validateEvent(t, { stopId: 'jer', kind: 'hebergement', title: 'a', checkIn: '2027-08-10', checkOut: '2027-08-10' })).toEqual(['depart-avant-arrivee']);
    expect(validateEvent(t, { stopId: 'jer', kind: 'hebergement', title: 'a' })).toEqual(['date-invalide']);
    expect(validateEvent(t, { stopId: 'jer', kind: 'visite', title: 'a', date: '2027-13-01' })).toEqual(['date-invalide']);
  });
});

describe('validation des données relues', () => {
  it('accepte le voyage de référence après aller-retour JSON', () => {
    const r = parseTrip(JSON.parse(JSON.stringify(israelTrip())));
    expect(r.ok).toBe(true);
  });
  it('rejette les données altérées ou malveillantes', () => {
    const bad = [
      null,
      'texte',
      { ...israelTrip(), stopOrder: ['jer', 'jer'] },
      { ...israelTrip(), stopOrder: ['inconnue'] },
      { ...israelTrip(), id: '../../etc' },
      { ...israelTrip(), name: 'x'.repeat(1000) },
      { ...israelTrip(), baseCurrency: 'euro' },
      { ...israelTrip(), extra: 'champ inattendu' },
      { ...israelTrip(), stops: { jer: { ...israelTrip().stops.jer, timeZone: 'Pas/Un' } } },
      { ...israelTrip(), events: [{ ...israelTrip().events[0], price: { amountMinor: 1.5, currency: 'EUR' } }] },
    ];
    for (const b of bad) expect(parseTrip(b).ok).toBe(false);
  });
});
