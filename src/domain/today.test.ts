import { describe, expect, it } from 'vitest';
import { israelTrip } from './fixtures';
import { dayPlan, defaultDay } from './today';
import { googleMapsDayLinks, googleMapsPlace, toCsv, toGeoJson, toKml } from './exports';
import { mapPlaces } from './places';
import type { Trip } from './types';

const trip = (): Trip => {
  const t = israelTrip();
  t.events = t.events.map((e) => (e.id === 'h-jer' ? { ...e, point: { lat: 31.77, lon: 35.22 } } : e.id === 'a-kotel' ? { ...e, time: '10:00', point: { lat: 31.7767, lon: 35.2345 } } : e));
  t.events.push(
    { id: 'brunch', stopId: 'jer', kind: 'repas', title: 'Brunch', date: '2027-08-11', time: '08:30', point: { lat: 31.78, lon: 35.21 } },
    { id: 'cousins-j', stopId: 'jer', kind: 'famille', title: 'Cousins', date: '2027-08-11', point: { lat: 31.8, lon: 35.2 } },
  );
  return t;
};

describe('vue Aujourd’hui', () => {
  it('jour affiché : aujourd’hui pendant le voyage, sinon premier ou dernier jour', () => {
    expect(defaultDay(israelTrip(), '2027-08-12')).toBe('2027-08-12');
    expect(defaultDay(israelTrip(), '2026-11-26')).toBe('2027-08-10');
    expect(defaultDay(israelTrip(), '2028-01-01')).toBe('2027-08-19');
  });
  it('programme : ordre choisi respecté, trajets insérés à leur heure, hébergement du soir', () => {
    const p = dayPlan(trip(), '2027-08-11');
    expect(p.stops.map((s) => s.name)).toEqual(['Jérusalem']);
    expect(p.lodging?.id).toBe('h-jer');
    expect(p.items.map((i) => i.key)).toEqual(['a-kotel', 'brunch', 'cousins-j']);
    const d13 = dayPlan(trip(), '2027-08-13');
    expect(d13.stops.map((s) => s.name)).toEqual(['Jérusalem', 'Netanya']);
    expect(d13.items.map((i) => i.kind)).toEqual(['partir', 'depart', 'arrivee']);
    expect(d13.items[0]?.time).toBe('09:55');
  });
});

describe('exports', () => {
  it('Google Maps : itinéraire du jour depuis l’hôtel, découpé au-delà de 3 étapes intermédiaires', () => {
    const links = googleMapsDayLinks(dayPlan(trip(), '2027-08-11'));
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('origin=31.770000%2C35.220000');
    expect(links[0]).toContain('waypoints=31.776700%2C35.234500');
    // Lieu d'une sous-étape famille : jamais envoyé à Google.
    expect(links[0]).not.toContain('31.800000');
    const t = trip();
    for (let i = 0; i < 6; i++) t.events.push({ id: `v${i}`, stopId: 'jer', kind: 'visite', title: `V${i}`, date: '2027-08-12', point: { lat: 31.7 + i / 100, lon: 35.2 } });
    expect(googleMapsDayLinks(dayPlan(t, '2027-08-12'))).toHaveLength(2);
    expect(googleMapsPlace({ lat: 1, lon: 2 })).toBe('https://www.google.com/maps/search/?api=1&query=1.000000%2C2.000000');
  });
  it('lieux exportés par calque ; rien de « famille »', () => {
    const places = mapPlaces(trip());
    expect(places.some((p) => p.name === 'Cousins')).toBe(false);
    expect(new Set(places.map((p) => p.layer))).toEqual(new Set(['Étapes', 'Hébergements', 'Visites et activités']));
  });
  it('KML échappé, GeoJSON valide, CSV protégé contre les formules', () => {
    const t = trip();
    t.events.push({ id: 'x', stopId: 'jer', kind: 'visite', title: '=HYPERLINK("x") <b>&', date: '2027-08-12', point: { lat: 31.7, lon: 35.2 } });
    const kml = toKml(t);
    expect(kml).toContain('<Folder><name>Hébergements</name>');
    expect(kml).toContain('=HYPERLINK(&quot;x&quot;) &lt;b&gt;&amp;');
    expect(JSON.parse(toGeoJson(t)).features.length).toBe(mapPlaces(t).length);
    const csv = toCsv(t);
    expect(csv.startsWith('﻿Nom,Latitude,Longitude,Calque,Description\r\n')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"") <b>&"`);
  });
});
