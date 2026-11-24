import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, diffDays, isISODate, nightsBetween } from './dates';
import { formatDuration, isValidTimeZone, toInstant, travelDuration } from './time';
import { formatMoney, money, parseAmount, toBase } from './money';
import { applyReorder, closeLoop, moveItem, planTransports, previewReorder, requiredLegs } from './itinerary';
import { checkTrip, daysOfStop, describeAlert } from './coherence';
import { commit, createHistory, HISTORY_LIMIT, redo, undo } from './history';
import { israelTrip } from './fixtures';
import type { Trip } from './types';

let seq = 0;
const newId = () => `gen-${++seq}`;

describe('dates', () => {
  it('valide le format et le calendrier', () => {
    expect(isISODate('2027-08-10')).toBe(true);
    expect(isISODate('2027-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('10/08/2027')).toBe(false);
    expect(isISODate('')).toBe(false);
  });
  it('compte jours et nuits (CU1 : Jérusalem 10 → 13 août = 4 journées, 3 nuits)', () => {
    expect(daysBetween('2027-08-10', '2027-08-13')).toEqual(['2027-08-10', '2027-08-11', '2027-08-12', '2027-08-13']);
    expect(nightsBetween('2027-08-10', '2027-08-13')).toHaveLength(3);
    expect(nightsBetween('2027-08-13', '2027-08-10')).toEqual([]);
    expect(daysBetween('2027-08-13', '2027-08-10')).toEqual([]);
  });
  it('traverse les fins de mois et d’année', () => {
    expect(addDays('2027-12-31', 1)).toBe('2028-01-01');
    expect(diffDays('2027-02-27', '2027-03-01')).toBe(2);
  });
  it('refuse une date invalide', () => {
    expect(() => addDays('2027-13-01', 1)).toThrow(RangeError);
  });
});

describe('fuseaux et durées (CU3)', () => {
  it('Paris 10h → Tel Aviv 15h en août dure 4 h, pas 5 h', () => {
    const r = travelDuration(
      { at: '2027-08-08T10:00', timeZone: 'Europe/Paris' },
      { at: '2027-08-08T15:00', timeZone: 'Asia/Jerusalem' },
    );
    expect(r).toEqual({ ok: true, minutes: 240 });
    expect(formatDuration(240)).toBe('4 h 00');
    expect(formatDuration(45)).toBe('45 min');
  });
  it('refuse une arrivée antérieure au départ', () => {
    // Retour : Tel Aviv 16h → Paris 18h30 = 3 h 30 réelles (et non 2 h 30).
    const r = travelDuration(
      { at: '2027-08-19T16:00', timeZone: 'Asia/Jerusalem' },
      { at: '2027-08-19T18:30', timeZone: 'Europe/Paris' },
    );
    expect(r).toEqual({ ok: true, minutes: 210 });
    // Tel Aviv 15h → Paris 14h : même instant, donc refusé.
    const same = travelDuration(
      { at: '2027-08-08T15:00', timeZone: 'Asia/Jerusalem' },
      { at: '2027-08-08T14:00', timeZone: 'Europe/Paris' },
    );
    expect(same).toEqual({ ok: false, reason: 'arrivee-avant-depart' });
  });
  it('gère le passage à l’heure d’été (heure inexistante décalée vers l’avant)', () => {
    const before = toInstant('2027-03-28T01:30', 'Europe/Paris');
    const gap = toInstant('2027-03-28T02:30', 'Europe/Paris');
    expect(gap - before).toBeGreaterThanOrEqual(60 * 60_000);
  });
  it('rejette fuseau et format invalides sans planter', () => {
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    const r = travelDuration({ at: '2027-08-08 10h', timeZone: 'Europe/Paris' }, { at: '2027-08-08T12:00', timeZone: 'Nope/Nope' });
    expect(r).toEqual({ ok: false, reason: 'invalide' });
  });
});

describe('montants (CU6)', () => {
  it('lit les saisies françaises', () => {
    expect(parseAmount('12,5')).toBe(1250);
    expect(parseAmount('1 250,99')).toBe(125099);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('-3.10')).toBe(-310);
  });
  it('refuse les saisies douteuses', () => {
    for (const bad of ['', 'abc', '12,345', '1e5', '12..5', '<script>', '9999999999']) {
      expect(parseAmount(bad)).toBeNull();
    }
  });
  it('convertit au centime et refuse un taux absent', () => {
    expect(toBase(money(45000, 'ILS'), 'EUR', { ILS: 0.25 })).toBe(11250);
    expect(toBase(money(333, 'ILS'), 'EUR', { ILS: 0.25 })).toBe(83);
    expect(toBase(money(100, 'USD'), 'EUR', {})).toBeNull();
    expect(toBase(money(100, 'USD'), 'EUR', { USD: 0 })).toBeNull();
    expect(() => money(1.5, 'EUR')).toThrow();
    expect(() => money(1, 'euro')).toThrow();
    expect(formatMoney(money(125099, 'EUR')).replace(/\s/g, ' ')).toBe('1 250,99 €');
  });
});

describe('réorganisation (CU2)', () => {
  it('déplace sans muter la liste d’origine', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(list).toEqual(['a', 'b', 'c']);
    expect(() => moveItem(list, 0, 3)).toThrow(RangeError);
  });

  it('insère Mer Morte : crée les brouillons, signale le vol réservé, garde toutes les activités', () => {
    const trip = israelTrip();
    const p = previewReorder(trip, ['jer', 'net', 'mm', 'eil'], 'cascade');
    expect(p.transports.toCreate).toEqual([['net', 'mm'], ['mm', 'eil']]);
    expect(p.transports.toFlag).toEqual(['t-net-eil']);
    expect(p.transports.toDelete).toEqual([]);
    // Cascade : Mer Morte (1 nuit) décale Eilat d'un jour.
    expect(p.stops.mm).toMatchObject({ arrival: '2027-08-16', departure: '2027-08-17' });
    expect(p.stops.eil).toMatchObject({ arrival: '2027-08-17', departure: '2027-08-20' });
    // Rien n'est appliqué tant que l'utilisateur n'a pas validé.
    expect(trip.stopOrder).toEqual(['jer', 'net', 'eil']);

    const next = applyReorder(trip, p, newId);
    // La plongée (non réservée) suit Eilat d'un jour ; l'hôtel (réservé) ne bouge pas.
    expect(next.events.find((e) => e.id === 'a-recif')?.date).toBe('2027-08-18');
    expect(next.events.find((e) => e.id === 'h-eil')).toEqual(trip.events.find((e) => e.id === 'h-eil'));
    expect(next.transports.find((t) => t.id === 't-net-eil')?.status).toBe('a-verifier');
    expect(next.transports.filter((t) => t.status === 'brouillon')).toHaveLength(2);
    // Le décalage est détecté : l'hôtel d'Eilat ne colle plus à l'étape.
    const kinds = checkTrip(next).map((a) => a.kind);
    expect(kinds).toContain('hebergement-hors-etape');
    expect(kinds).toContain('nuit-sans-hebergement');
  });

  it('mode « conserver » : aucune date ne bouge, les conflits sont signalés', () => {
    const trip = israelTrip();
    const p = previewReorder(trip, ['jer', 'eil', 'net'], 'conserver');
    expect(p.dateChanges).toEqual([]);
    const next = applyReorder(trip, p, newId);
    expect(checkTrip(next).some((a) => a.kind === 'chevauchement-etapes')).toBe(true);
  });

  it('boucle complète Tel Aviv → … → Tel Aviv sans perte d’activité (cas limite 2)', () => {
    let trip: Trip = israelTrip();
    const p = previewReorder(trip, ['tlv', 'jer', 'mm', 'net', 'eil'], 'cascade');
    trip = applyReorder(trip, p, newId);
    trip = closeLoop(trip, newId);
    expect(trip.stopOrder).toHaveLength(6);
    const last = trip.stops[trip.stopOrder[5] as string];
    expect(last?.name).toBe('Tel Aviv (retour)');
    expect(trip.events.map((e) => e.id).sort()).toEqual(israelTrip().events.map((e) => e.id).sort());
    expect(planTransports(trip.stopOrder, trip.transports).toCreate.at(-1)).toEqual(['eil', trip.stopOrder[5]]);
  });

  it('cinq réorganisations successives : zéro activité perdue (indicateur de validation)', () => {
    let trip: Trip = israelTrip();
    const orders = [
      ['jer', 'net', 'mm', 'eil'],
      ['tlv', 'jer', 'mm', 'net', 'eil'],
      ['eil', 'tlv'],
      ['net', 'jer', 'eil', 'mm', 'tlv'],
      ['jer', 'net', 'eil'],
    ];
    for (const o of orders) trip = applyReorder(trip, previewReorder(trip, o, 'cascade'), newId);
    expect(trip.events).toHaveLength(israelTrip().events.length);
    // Retour à l'ordre initial : les trajets réservés redeviennent « réservé ».
    expect(trip.transports.filter((t) => t.status === 'reserve').map((t) => t.id).sort()).toEqual(['t-jer-net', 't-net-eil']);
    expect(trip.transports.filter((t) => t.status === 'brouillon')).toHaveLength(0);
  });

  it('refuse un ordre invalide (doublon, étape inconnue)', () => {
    const trip = israelTrip();
    expect(() => previewReorder(trip, ['jer', 'jer'], 'cascade')).toThrow(RangeError);
    expect(() => previewReorder(trip, ['jer', 'xxx'], 'cascade')).toThrow(RangeError);
  });

  it('gère les cas vides', () => {
    expect(requiredLegs([])).toEqual([]);
    expect(requiredLegs(['a'])).toEqual([]);
    const trip = { ...israelTrip(), stopOrder: ['jer'] };
    expect(closeLoop(trip, newId)).toBe(trip);
  });
});

describe('cohérence (CU4)', () => {
  it('voyage de référence : aucune alerte', () => {
    expect(checkTrip(israelTrip())).toEqual([]);
  });
  it('détecte 100 % des nuits sans hébergement', () => {
    const trip = israelTrip();
    trip.events = trip.events.filter((e) => e.id !== 'h-net');
    const nights = checkTrip(trip).filter((a) => a.kind === 'nuit-sans-hebergement');
    expect(nights.map((a) => (a.kind === 'nuit-sans-hebergement' ? a.night : ''))).toEqual([
      '2027-08-13',
      '2027-08-14',
      '2027-08-15',
    ]);
  });
  it('détecte deux hébergements la même nuit', () => {
    const trip = israelTrip();
    trip.events.push({ id: 'h-bis', stopId: 'jer', kind: 'hebergement', title: 'Airbnb', checkIn: '2027-08-12', checkOut: '2027-08-13' });
    expect(checkTrip(trip).some((a) => a.kind === 'hebergements-chevauchants')).toBe(true);
  });
  it('détecte trou entre étapes, activité hors dates et rattachement inconnu', () => {
    const trip = israelTrip();
    trip.stops.net = { ...trip.stops.net!, arrival: '2027-08-14' };
    trip.events.push({ id: 'x', stopId: 'jer', kind: 'visite', title: 'Hors dates', date: '2027-08-20' });
    trip.events.push({ id: 'y', stopId: 'nope', kind: 'visite', title: 'Orphelin' });
    const kinds = checkTrip(trip).map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(['trou-entre-etapes', 'activite-hors-dates', 'rattachement-inconnu']));
    for (const a of checkTrip(trip)) expect(describeAlert(a, trip)).toMatch(/\S/);
  });
  it('génère les journées d’une étape', () => {
    expect(daysOfStop(israelTrip().stops.jer!)).toHaveLength(4);
  });
});

describe('annulation (Ctrl+Z)', () => {
  it('annule et rétablit', () => {
    let h = createHistory(1);
    h = commit(h, 2);
    h = commit(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = redo(h);
    expect(h.present).toBe(3);
    h = undo(undo(undo(h)));
    expect(h.present).toBe(1);
  });
  it('borne l’historique et vide le futur après une nouvelle action', () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) h = commit(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    h = commit(undo(h), 999);
    expect(h.future).toEqual([]);
  });
});
