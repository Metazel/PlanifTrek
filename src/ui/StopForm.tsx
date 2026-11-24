import { useId, useState, type FormEvent } from 'react';
import { validateStop, type StopError, type StopInput } from '../domain/edit';
import { btn, field } from './Dialog';
import { timeZones } from './format';

const MESSAGES: Record<StopError, string> = {
  'nom-vide': 'Indiquez le nom de l’étape.',
  'date-invalide': 'Dates invalides.',
  'depart-avant-arrivee': 'Le départ doit être le même jour ou après l’arrivée.',
  'fuseau-invalide': 'Fuseau horaire inconnu.',
  'trop-d-etapes': 'Nombre maximal d’étapes atteint.',
};

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
  const errId = useId();
  const kindName = useId();
  const set = <K extends keyof StopInput>(k: K, value: StopInput[K]) => setV((s) => ({ ...s, [k]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateStop(v);
    setErrors(errs);
    if (!errs.length) onSubmit(v);
  };
  const invalid = (k: 'name' | 'dates' | 'tz') =>
    errors.some((e) =>
      k === 'name' ? e === 'nom-vide' : k === 'tz' ? e === 'fuseau-invalide' : e.startsWith('date') || e === 'depart-avant-arrivee',
    );

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Nom de l’étape
        <input
          className={field}
          value={v.name}
          maxLength={80}
          aria-invalid={invalid('name')}
          aria-describedby={errors.length ? errId : undefined}
          onChange={(e) => set('name', e.target.value)}
        />
      </label>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">Type</legend>
        <div className="flex gap-4">
          {(['ville', 'famille'] as const).map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2">
              <input type="radio" name={kindName} checked={v.kind === k} onChange={() => set('kind', k)} />
              {k === 'ville' ? '🏙 Ville / étape' : '👪 Visite famille'}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        Arrivée
        <input type="date" className={field} value={v.arrival} aria-invalid={invalid('dates')} onChange={(e) => set('arrival', e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Départ
        <input type="date" className={field} value={v.departure} aria-invalid={invalid('dates')} onChange={(e) => set('departure', e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Fuseau horaire
        <select className={field} value={v.timeZone} aria-invalid={invalid('tz')} onChange={(e) => set('timeZone', e.target.value)}>
          {timeZones().map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </label>
      {v.kind === 'famille' && (
        <label className="flex flex-col gap-1 text-sm">
          Adresse privée (reste sur cet appareil)
          <input
            className={field}
            value={v.privateAddress ?? ''}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => set('privateAddress', e.target.value)}
          />
        </label>
      )}
      {errors.length > 0 && (
        <ul id={errId} role="alert" className="text-sm text-red-700 sm:col-span-2 dark:text-red-400">
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
