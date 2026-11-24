import { btn } from './Dialog';

export function ConsentScreen({ onAccept, onTry }: { onAccept: () => void; onTry: () => void }) {
  return (
    <section
      aria-labelledby="consentement"
      className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 id="consentement" className="text-xl font-semibold">
        Où garder vos voyages ?
      </h2>
      <p className="mt-3 text-slate-700 dark:text-slate-300">
        PlanifTrek fonctionne sans compte et sans serveur. Pour retrouver vos voyages, y compris sans réseau, ils
        doivent être enregistrés <strong>dans ce navigateur, sur cet appareil</strong>. Rien n'est envoyé ailleurs.
      </p>
      <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
        <li>Vous pouvez tout effacer à tout instant (« Mes données »).</li>
        <li>Aucun traceur, aucune mesure d'audience.</li>
        <li>Ne saisissez pas de pièce d'identité : l'application n'en a pas besoin.</li>
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className={btn.primary} onClick={onAccept}>
          Enregistrer mes voyages sur cet appareil
        </button>
        <button type="button" className={btn.secondary} onClick={onTry}>
          Essayer sans enregistrer
        </button>
      </div>
    </section>
  );
}
