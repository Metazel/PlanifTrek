import { describe, expect, it } from 'vitest';
import { parseQuick } from './quick';
import { summarize } from './summary';
import { israelTrip } from './fixtures';

describe('saisie rapide', () => {
  it('reconnaît l’heure en tête et devine le type', () => {
    expect(parseQuick('15:25 Débarquement TLV')).toEqual({ time: '15:25', title: 'Débarquement TLV', kind: 'deplacement' });
    expect(parseQuick('20h dîner chez Avi')).toEqual({ time: '20:00', title: 'dîner chez Avi', kind: 'repas' });
    expect(parseQuick('9h30 - Musée d’Israël')).toEqual({ time: '09:30', title: 'Musée d’Israël', kind: 'visite' });
    expect(parseQuick('Mariage de Léa')).toEqual({ title: 'Mariage de Léa', kind: 'evenement' });
    expect(parseQuick('Plongée')).toEqual({ title: 'Plongée', kind: 'activite' });
  });
  it('ignore les lignes vides et les fausses heures', () => {
    expect(parseQuick('   ')).toBeNull();
    expect(parseQuick('25h fête')).toEqual({ title: '25h fête', kind: 'evenement' });
    expect(parseQuick('2027 souvenirs')).toEqual({ title: '2027 souvenirs', kind: 'activite' });
  });
});

describe('synthèse du voyage', () => {
  it('exemple Israël : 10 jours, toutes les nuits couvertes, 2 trajets réservés, engagé par devise', () => {
    const s = summarize(israelTrip())!;
    expect(s).toMatchObject({ start: '2027-08-10', end: '2027-08-19', days: 10, stops: 3, nights: { total: 9, covered: 9 }, transports: { total: 2, reserved: 2 } });
    expect(s.committed).toEqual({ ILS: 3 * 45000 + 4400 });
    expect(s.alerts).toEqual([]);
  });
  it('signale les jours à problème', () => {
    const t = israelTrip();
    t.events = t.events.filter((e) => e.id !== 'h-net');
    const s = summarize(t)!;
    expect(s.nights.covered).toBe(6);
    expect([...s.alertDays]).toEqual(['2027-08-13', '2027-08-14', '2027-08-15']);
  });
});
