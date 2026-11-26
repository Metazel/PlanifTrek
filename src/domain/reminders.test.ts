import { describe, expect, it } from 'vitest';
import { israelTrip } from './fixtures';
import { departureAdvice, googleCalendarUrl, isPhone, reminders, roadMinutes, telHref, toIcs } from './reminders';
import type { Transport, Trip } from './types';

const flight = (extra: Partial<Transport> = {}): Transport => ({
  id: 'vol',
  fromStopId: 'eil',
  toStopId: 'jer',
  mode: 'avion',
  status: 'reserve',
  important: true,
  bookingRef: 'LY 080',
  departure: { place: 'Aéroport Ben-Gourion', at: '2027-08-20T05:00', timeZone: 'Asia/Jerusalem', point: { lat: 32.0055, lon: 34.8854 } },
  ...extra,
});

describe('heure de départ conseillée', () => {
  it('vol de 5 h : 3 h d’enregistrement + 1 h de battement + route estimée depuis l’hôtel', () => {
    const t: Trip = israelTrip();
    t.events = t.events.map((e) => (e.id === 'h-eil' ? { ...e, point: { lat: 31.78, lon: 35.22 } } : e));
    const a = departureAdvice(t, flight());
    expect(a).toMatchObject({ checkIn: 180, buffer: 60, travelEstimated: true });
    expect(a?.travel).toBeGreaterThan(40);
    expect(a?.travel).toBe(55);
    expect(a?.leaveAt).toBe('2027-08-20T00:05');
  });
  it('valeurs saisies prioritaires ; sans délai ni route : pas de conseil', () => {
    const a = departureAdvice(israelTrip(), flight({ checkInMin: 120, bufferMin: 30, travelMin: 45 }));
    expect(a?.leaveAt).toBe('2027-08-20T01:45');
    expect(departureAdvice(israelTrip(), { ...flight(), mode: 'voiture', departure: { ...flight().departure!, point: undefined as never } })).toBeNull();
    expect(departureAdvice(israelTrip(), { ...flight(), departure: undefined as never })).toBeNull();
  });
  it('estimation de route prudente, arrondie à 5 min', () => {
    expect(roadMinutes({ lat: 31.78, lon: 35.22 }, { lat: 32.0055, lon: 34.8854 })).toBe(55);
  });
});

describe('rappels', () => {
  const trip = () => {
    const t = israelTrip();
    t.events.push(
      { id: 'mariage', stopId: 'jer', kind: 'evenement', title: 'Mariage à la synagogue', date: '2027-08-12', time: '18:30', important: true },
      { id: 'guide', stopId: 'jer', kind: 'visite', title: 'Guide Vieille ville', date: '2027-08-11', important: true, contact: { name: 'Yossi', phone: '+972 50 123 4567' } },
    );
    t.transports.push(flight());
    return t;
  };
  it('liste triée : guide, mariage, partir, vol ; l’adresse famille n’apparaît jamais', () => {
    const r = reminders(trip());
    expect(r.map((x) => x.id)).toEqual(['guide', 'mariage', 'vol-partir', 'vol']);
    expect(r[0]).toMatchObject({ detail: 'Heure à préciser', place: 'Jérusalem', contact: { phone: '+972 50 123 4567' } });
    const t = trip();
    t.events.push({ id: 'cousins', stopId: 'net', kind: 'famille', title: 'Cousins', date: '2027-08-14', important: true });
    expect(reminders(t).find((x) => x.id === 'cousins')?.place).toBeUndefined();
  });
  it('lien Google Agenda : dates UTC, fuseau, texte encodé', () => {
    const url = googleCalendarUrl(reminders(trip())[1]!);
    expect(url).toContain('dates=20270812T153000Z%2F20270812T163000Z');
    expect(url).toContain('ctz=Asia%2FJerusalem');
    expect(url).toContain('text=Mariage+%C3%A0+la+synagogue');
  });
  it('fichier .ics valide : CRLF, échappement, alarme 30 min', () => {
    const ics = toIcs([{ id: 'x', title: 'Dîner; famille, amis', at: '2027-08-12T20:00', timeZone: 'Asia/Jerusalem', durationMin: 60 }], Date.UTC(2027, 0, 1));
    expect(ics).toContain('SUMMARY:Dîner\; famille\\, amis\r\n');
    expect(ics).toContain('DTSTART:20270812T170000Z');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('téléphone : validation et lien d’appel', () => {
    expect(isPhone('+972 50 123 4567')).toBe(true);
    expect(isPhone('javascript:alert(1)')).toBe(false);
    expect(telHref('+972 (50) 123-4567')).toBe('tel:+972501234567');
  });
});
