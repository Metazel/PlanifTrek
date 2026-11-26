import type { EventKind } from './types';

/**
 * Saisie rapide d'une ligne, comme dans un tableur : « 15:25 Débarquement », « 20h dîner chez Avi »,
 * « Musée d'Israël ». L'heure est reconnue en tête de ligne ; le type est deviné par mots-clés.
 */
export interface QuickItem {
  time?: string;
  title: string;
  kind: EventKind;
}

const RULES: Array<[RegExp, EventKind]> = [
  [/\b(petit[- ]d[ée]j|brunch|d[ée]jeuner|d[îi]ner|resto|restaurant|caf[ée]|pique-nique|repas)/i, 'repas'],
  [/\b(mariage|bar[- ]?mitsva|f[êe]te|soir[ée]e|concert|spectacle|c[ée]r[ée]monie)/i, 'evenement'],
  [/\b(mus[ée]e|visite|vieille ville|mur|basilique|synagogue|mosqu[ée]e|[ée]glise|site|parc national|plage)/i, 'visite'],
  [/\b(famille|cousins?|tante|oncle|parents|chez )/i, 'famille'],
  [/\b(trajet|route|bus|taxi|train|navette|d[ée]barquement|embarquement|transfert)/i, 'deplacement'],
  [/\b(libre|repos|piscine|shopping|march[ée]|courses)/i, 'temps-libre'],
];

export function parseQuick(line: string): QuickItem | null {
  const text = line.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const m = /^(\d{1,2})\s*[:hH]\s*(\d{2})?\s*[-–—]?\s*(.*)$/.exec(text);
  let time: string | undefined;
  let title = text;
  if (m && Number(m[1]) < 24 && (!m[2] || Number(m[2]) < 60) && m[3]) {
    time = `${(m[1] ?? '').padStart(2, '0')}:${m[2] ?? '00'}`;
    title = m[3];
  }
  const kind = RULES.find(([re]) => re.test(title))?.[1] ?? 'activite';
  return { title: title.slice(0, 120), kind, ...(time ? { time } : {}) };
}
