import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Le « worker » de MapLibre (calcul des tracés) est empaqueté par Vite et servi depuis le site.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);
import type { Trip } from '../domain/types';
import { countryView, stopView, type View } from './mapModel';
import { labelExpression, OPENFREEMAP_STYLE, OSM_RASTER, type MapLang } from './mapStyle';

/**
 * Carte en ligne : fond vectoriel OpenFreeMap (libellés dans la langue choisie), repli sur les tuiles OSM.
 * Épingles numérotées par étape, trajets (pointillés pour l'avion).
 * Marqueurs construits en DOM avec textContent : aucun HTML injecté.
 */
export default function MapView({ trip, lang, view }: { trip: Trip; lang: MapLang; view: 'pays' | string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = useState(false);
  // Le style peut être prêt alors que des tuiles chargent encore : on suit l'événement « load » une fois pour toutes.
  const ready = useRef(false);
  const drawLegs = useRef<(() => void) | null>(null);
  const applyLang = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!box.current) return;
    try {
      const m = new maplibregl.Map({ container: box.current, style: OPENFREEMAP_STYLE, center: [35, 31.5], zoom: 6, attributionControl: { compact: true },
        locale: { 'Map.Title': 'Carte du voyage', 'NavigationControl.ZoomIn': 'Zoomer', 'NavigationControl.ZoomOut': 'Dézoomer', 'AttributionControl.ToggleAttribution': 'Sources de la carte' },
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.on('error', () => undefined);
      m.once('load', () => {
        ready.current = true;
        applyLang.current?.();
        drawLegs.current?.();
      });
      // Repli : si le fond vectoriel n'arrive pas, tuiles OSM.
      const fallback = window.setTimeout(() => {
        if (!ready.current) {
          m.setStyle(OSM_RASTER);
          m.once('style.load', () => {
            ready.current = true;
            drawLegs.current?.();
          });
        }
      }, 8000);
      m.once('remove', () => window.clearTimeout(fallback));
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
    applyLang.current = () => {
      for (const layer of m.getStyle().layers) {
        if (layer.type === 'symbol' && layer.layout?.['text-field']) {
          m.setLayoutProperty(layer.id, 'text-field', labelExpression(lang) as maplibregl.ExpressionSpecification);
        }
      }
    };
    if (ready.current) applyLang.current();
  }, [lang]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const v: View = view === 'pays' ? countryView(trip) : stopView(trip, view);
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const bounds = new maplibregl.LngLatBounds();
    for (const p of v.pins) {
      const el = document.createElement('div');
      el.className = p.cls;
      el.textContent = p.text;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', p.aria);
      el.title = p.aria;
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(m));
      bounds.extend([p.lon, p.lat]);
    }
    const features = v.segments.map((sg) => ({
      type: 'Feature' as const,
      properties: { kind: sg.kind, color: sg.color },
      geometry: { type: 'LineString' as const, coordinates: [sg.from, sg.to] },
    }));
    const draw = () => {
      const data = { type: 'FeatureCollection' as const, features };
      const src = m.getSource('legs') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        m.addSource('legs', { type: 'geojson', data });
        const color: maplibregl.ExpressionSpecification = ['get', 'color'];
        m.addLayer({ id: 'legs-ground', type: 'line', source: 'legs', filter: ['==', ['get', 'kind'], 'sol'], layout: { 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 4 } });
        m.addLayer({ id: 'legs-air', type: 'line', source: 'legs', filter: ['==', ['get', 'kind'], 'avion'], paint: { 'line-color': color, 'line-width': 3, 'line-dasharray': [2, 2] } });
        m.addLayer({ id: 'legs-gap', type: 'line', source: 'legs', filter: ['==', ['get', 'kind'], 'manquant'], paint: { 'line-color': color, 'line-width': 2, 'line-dasharray': [1, 2] } });
      }
    };
    const fit = () => {
      m.resize();
      if (!bounds.isEmpty()) m.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 0 });
    };
    drawLegs.current = () => {
      draw();
      fit();
      // Repères pour la recette : trajets fournis, puis trajets réellement dessinés.
      box.current?.setAttribute('data-trajets', String(features.length));
      m.once('idle', () => {
        const drawn = m.queryRenderedFeatures({ layers: ['legs-ground', 'legs-air', 'legs-gap'] }).length;
        box.current?.setAttribute('data-traces', String(drawn));
      });
    };
    if (ready.current) drawLegs.current();
    else fit();
  }, [trip, view]);

  if (failed) return <p className="p-4 text-sm">Carte indisponible sur cet appareil (WebGL désactivé). La liste des étapes reste utilisable.</p>;
  return <div ref={box} className="h-full min-h-80 w-full rounded-2xl" />;
}
