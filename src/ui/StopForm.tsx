import { useId, useState, type FormEvent } from 'react';
import { validateStop, type StopError, type StopInput } from '../domain/edit';
import { btn, field } from './Dialog';
import { timeZones } from './format';
import { searchPlace, type Place } from './geocode';

const MESSAGES: Record<StopError, string> = {
  'nom-vide': 'Indiquez le nom de l’étape.',
  'date-invalide': 'Dates invalides.',
  'depart-avant-arrivee': 'Le départ doit être après l’arrivée.',
  'fuseau-invalide': 'Fuseau horaire inconnu.',
  'heure-invalide': 'Heure invalide (format HH:MM).',
  'trop-d-etapes': 'Nombre maximal d’étapes atteint.',
};

const KINDS = [
  ['ville', '🏙 Séjour'],
  ['passage', '🚏 Passage (sans nuit)'],
  ['famille', '👪 Visite famille'],
] as const;

export function StopForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: StopInput;
  submitLabel: string;
  onSubmit: (input: StopInput) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<StopInput>(initial);
  const [errors, setErrors] = useState<StopError[]>([]);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const uid = useId();
  const set = <K extends keyof StopInput>(k: K, value: StopInput[K]) => setV((s) => ({ ...s, [k]: value }));
  const passage = v.kind === 'passage';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (places?.length) {
      setSearchError('Choisissez un lieu dans la liste, ou « Garder ma saisie sans position ».');
      return;
    }
    const input: StopInput = passage ? { ...v, departure: v.arrival } : v;
    const errs = validateStop(input);
    setErrors(errs);
    if (!errs.length) onSubmit(input);
  };

  const search = async () => {
    setSearching(true);
    setSearchError('');
    try {
      const found = await searchPlace(v.name);
      // Un seul résultat : il est retenu directement.
      if (found.length === 1 && found[0]) pick(found[0]);
      else setPlaces(found);
    } catch (err) {
      setSearchError(`${err instanceof Error ? err.message : 'Recherche impossible'}. Saisissez le nom à la main.`);
    } finally {
      setSearching(false);
    }
  };

  const pick = (p: Place) => {
    setSearchError('');
    setV((s) => ({ ...s, name: p.name, point: p.point, ...(p.timeZone ? { timeZone: p.timeZone } : {}) }));
    setPlaces(null);
  };

  const has = (...keys: StopError[]) => errors.some((e) => keys.includes(e));
  const dateField = (label: string, k: 'arrival' | 'departure') => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input type="date" className={field} value={v[k]} aria-invalid={has('date-invalide', 'depart-avant-arrivee')} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  const timeField = (label: string, k: 'arrivalTime' | 'departureTime') => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input type="time" className={field} value={v[k] ?? ''} aria-invalid={has('heure-invalide')} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
      <fieldset className="text-sm sm:col-span-2">
        <legend className="mb-1">Type d’étape</legend>
        <div className="flex flex-wrap gap-x-4">
          {KINDS.map(([k, label]) => (
            <label key={k} className="flex min-h-11 items-center gap-2">
              <input type="radio" name={`${uid}-kind`} checked={v.kind === k} onChange={() => set('kind', k)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1 text-sm sm:col-span-2">
        <label htmlFor={`${uid}-nom`}>
          Nom de l’étape {v.point && <span className="text-emerald-700 dark:text-emerald-400">· 📍 lieu trouvé</span>}
        </label>
        <div className="flex gap-2">
          <input
            id={`${uid}-nom`}
            className={field}
            value={v.name}
            maxLength={80}
            placeholder={passage ? 'ex. Aéroport Ben Gourion' : 'ex. Jérusalem'}
            aria-invalid={has('nom-vide')}
            aria-describedby={errors.length ? `${uid}-err` : undefined}
            onChange={(e) =>
              setV((s) => {
                // Le nom change : la position trouvée ne correspond plus.
                const { point: _drop, ...rest } = s;
                void _drop;
                return { ...rest, name: e.target.value };
              })
            }
          />
          {v.kind !== 'famille' && (
            <button type="button" className={btn.secondary} disabled={searching || v.name.trim().length < 2} onClick={() => void search()}>
              {searching ? 'Recherche…' : 'Chercher'}
            </button>
          )}
        </div>
        {searchError && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {searchError}
          </p>
        )}
        {places && (
          <div role="region" aria-label="Lieux trouvés" aria-live="polite">
            {places.length === 0 ? (
              <p>Aucun lieu trouvé : gardez votre saisie.</p>
            ) : (
              <>
              <p className="font-medium">Choisissez le lieu correspondant :</p>
              <ul className="mt-1 flex flex-col gap-1 rounded-xl border-2 border-blue-600 p-1">
                {places.map((p) => (
                  <li key={`${p.point.lat},${p.point.lon}`}>
                    <button type="button" className="min-h-11 w-full rounded-xl px-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => pick(p)}>
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-1 min-h-11 underline" onClick={() => setPlaces(null)}>
                Garder ma saisie sans position
              </button>
              </>
            )}
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Recherche © OpenStreetMap contributors (Nominatim)</p>
          </div>
        )}
      </div>

      {dateField(passage ? 'Jour' : 'Arrivée', 'arrival')}
      {!passage && dateField('Départ', 'departure')}
      {timeField('Heure d’arrivée (facultatif)', 'arrivalTime')}
      {timeField('Heure de départ (facultatif)', 'departureTime')}
      <label className="flex flex-col gap-1 text-sm">
        Fuseau horaire
        <select className={field} value={v.timeZone} aria-invalid={has('fuseau-invalide')} onChange={(e) => set('timeZone', e.target.value)}>
          {timeZones().map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </label>
      {v.kind === 'famille' && (
        <label className="flex flex-col gap-1 text-sm">
          Adresse privée (reste sur cet appareil, jamais recherchée en ligne)
          <input className={field} value={v.privateAddress ?? ''} maxLength={200} autoComplete="off" onChange={(e) => set('privateAddress', e.target.value)} />
        </label>
      )}
      {errors.length > 0 && (
        <ul id={`${uid}-err`} role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{MESSAGES[e]}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={btn.primary}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={btn.secondary} onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
