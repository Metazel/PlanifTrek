import type { StyleSpecification } from 'maplibre-gl';

/** Fond vectoriel OpenFreeMap (sans clé, sans traceur) : les noms peuvent s'afficher dans la langue choisie. */
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** Repli si OpenFreeMap ne répond pas : tuiles OSM (noms dans la langue locale uniquement). */
export const OSM_RASTER: StyleSpecification = {
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

export type MapLang = 'fr' | 'local' | 'en';
export const MAP_LANGS: Record<MapLang, string> = { fr: 'Français', local: 'Langue locale', en: 'English' };

/** Expression MapLibre du libellé : langue choisie, sinon transcription latine, sinon nom local. */
export function labelExpression(lang: MapLang): unknown[] {
  if (lang === 'local') return ['get', 'name'];
  return ['coalesce', ['get', `name:${lang}`], ['get', 'name:latin'], ['get', 'name']];
}
