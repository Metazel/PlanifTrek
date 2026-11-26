import { mapPlaces } from './places';
import type { GeoPoint, Trip } from './types';
import type { DayPlan } from './today';

const ll = (p: GeoPoint) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;

/**
 * Liens Google Maps « itinéraire » d'une journée : hébergement → lieux de la journée.
 * Google limite à 3 étapes intermédiaires sur mobile : au-delà, plusieurs liens qui s'enchaînent.
 */
export function googleMapsDayLinks(plan: DayPlan, start?: GeoPoint): string[] {
  const pts = [start ?? plan.lodging?.point, ...plan.items.filter((i) => i.event?.kind !== 'famille').map((i) => i.point)].filter((p): p is GeoPoint => !!p);
  const dedup = pts.filter((p, i) => i === 0 || ll(p) !== ll(pts[i - 1] as GeoPoint));
  if (dedup.length < 2) return [];
  const links: string[] = [];
  for (let i = 0; i < dedup.length - 1; i += 4) {
    const chunk = dedup.slice(i, i + 5);
    const q = new URLSearchParams({ api: '1', origin: ll(chunk[0] as GeoPoint), destination: ll(chunk[chunk.length - 1] as GeoPoint), travelmode: 'driving' });
    if (chunk.length > 2) q.set('waypoints', chunk.slice(1, -1).map(ll).join('|'));
    links.push(`https://www.google.com/maps/dir/?${q.toString()}`);
  }
  return links;
}

export const googleMapsPlace = (p: GeoPoint) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ll(p))}`;

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** KML compatible Google My Maps : un dossier (calque) par type de lieu. */
export function toKml(trip: Trip): string {
  const places = mapPlaces(trip);
  const layers = [...new Set(places.map((p) => p.layer))];
  const folders = layers
    .map((layer) => {
      const marks = places
        .filter((p) => p.layer === layer)
        .map((p) => `      <Placemark><name>${xml(p.name)}</name><description>${xml(p.description)}</description><Point><coordinates>${p.point.lon},${p.point.lat},0</coordinates></Point></Placemark>`)
        .join('\n');
      return `    <Folder><name>${xml(layer)}</name>\n${marks}\n    </Folder>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document><name>${xml(trip.name)}</name>\n${folders}\n  </Document>\n</kml>\n`;
}

export function toGeoJson(trip: Trip): string {
  const features = mapPlaces(trip).map((p) => ({
    type: 'Feature',
    properties: { nom: p.name, calque: p.layer, description: p.description },
    geometry: { type: 'Point', coordinates: [p.point.lon, p.point.lat] },
  }));
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

const csvCell = (s: string) => {
  // Neutralise les formules à l'ouverture dans un tableur (=, +, -, @).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV pour Google My Maps (colonnes Latitude / Longitude) et tableur. */
export function toCsv(trip: Trip): string {
  const rows = [['Nom', 'Latitude', 'Longitude', 'Calque', 'Description']];
  for (const p of mapPlaces(trip)) rows.push([p.name, String(p.point.lat), String(p.point.lon), p.layer, p.description]);
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
