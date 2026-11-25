import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Trip } from '../domain/types';

/**
 * Carte en ligne : tuiles OpenStreetMap en consultation interactive (aucun préchargement),
 * épingles numérotées par étape, trajets (pointillés pour l'avion).
 * Marqueurs construits en DOM avec textContent : aucun HTML injecté.
 */
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export default function MapView({ trip }: { trip: Trip }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = useState(false);
  // Le style peut être prêt alors que des tuiles chargent encore : on suit l'événement « load » une fois pour toutes.
  const ready = useRef(false);
  const drawLegs = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!box.current) return;
    try {
      const m = new maplibregl.Map({ container: box.current, style: STYLE, center: [35, 31.5], zoom: 6, attributionControl: { compact: true },
        locale: { 'Map.Title': 'Carte du voyage', 'NavigationControl.ZoomIn': 'Zoomer', 'NavigationControl.ZoomOut': 'Dézoomer', 'AttributionControl.ToggleAttribution': 'Sources de la carte' },
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.on('error', () => undefined);
      m.once('load', () => {
        ready.current = true;
        drawLegs.current?.();
      });
      map.current = m;
    } catch {
      setFailed(true);
    }
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const stops = trip.stopOrder.map((id) => trip.stops[id]).filter((s) => !!s);
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const bounds = new maplibregl.LngLatBounds();
    stops.forEach((s, i) => {
      if (!s.point) return;
      const el = document.createElement('div');
      el.className = 'pt-marker';
      el.textContent = String(i + 1);
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', `${i + 1}. ${s.name}`);
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([s.point.lon, s.point.lat]).addTo(m));
      bounds.extend([s.point.lon, s.point.lat]);
    });
    const features = trip.transports.flatMap((t) => {
      const a = trip.stops[t.fromStopId]?.point;
      const b = trip.stops[t.toStopId]?.point;
      return a && b ? [{ type: 'Feature' as const, properties: { air: t.mode === 'avion' }, geometry: { type: 'LineString' as const, coordinates: [[a.lon, a.lat], [b.lon, b.lat]] } }] : [];
    });
    const draw = () => {
      const data = { type: 'FeatureCollection' as const, features };
      const src = m.getSource('legs') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        m.addSource('legs', { type: 'geojson', data });
        m.addLayer({ id: 'legs-ground', type: 'line', source: 'legs', filter: ['!', ['get', 'air']], paint: { 'line-color': '#2563eb', 'line-width': 3 } });
        m.addLayer({ id: 'legs-air', type: 'line', source: 'legs', filter: ['get', 'air'], paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-dasharray': [2, 2] } });
      }
    };
    const fit = () => {
      m.resize();
      if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 0 });
    };
    drawLegs.current = () => {
      draw();
      fit();
      // Repère pour la recette : nombre de trajets tracés.
      box.current?.setAttribute('data-trajets', String(features.length));
    };
    if (ready.current) drawLegs.current();
    else fit();
  }, [trip]);

  if (failed) return <p className="p-4 text-sm">Carte indisponible sur cet appareil (WebGL désactivé). La liste des étapes reste utilisable.</p>;
  return <div ref={box} className="h-full min-h-80 w-full rounded-2xl" />;
}
