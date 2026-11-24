import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { ConsentScreen } from './ConsentScreen';
import { btn, Dialog } from './Dialog';
import { TripEditor } from './TripEditor';
import { TripList } from './TripList';

export function App() {
  const { mode, current, notice, init, acceptStorage, tryWithoutSaving, eraseAll, dismissNotice } = useStore();
  const [ready, setReady] = useState(false);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    void init().finally(() => setReady(true));
  }, [init]);

  useEffect(() => {
    document.title = current ? `${current.present.name} · PlanifTrek` : 'PlanifTrek';
  }, [current]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 p-4 md:p-8">
      <a href="#contenu" className="sr-only focus:not-sr-only">
        Aller au contenu
      </a>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">PlanifTrek</h1>
        {mode !== 'inconnu' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 dark:border-slate-600 dark:text-slate-300">
              {mode === 'local' ? '💾 Enregistré sur cet appareil' : '⏳ Essai : rien n’est enregistré'}
            </span>
            <button type="button" className={btn.secondary} onClick={() => setErasing(true)}>
              Mes données
            </button>
          </div>
        )}
      </header>

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <p>{notice}</p>
          <button type="button" className={btn.icon} onClick={dismissNotice} aria-label="Fermer le message">
            ✕
          </button>
        </div>
      )}

      <main id="contenu" className="flex flex-col gap-6">
        {!ready ? (
          <p>Chargement…</p>
        ) : mode === 'inconnu' ? (
          <ConsentScreen onAccept={() => void acceptStorage()} onTry={tryWithoutSaving} />
        ) : current ? (
          <TripEditor trip={current.present} />
        ) : (
          <TripList />
        )}
      </main>

      <Dialog
        open={erasing}
        title="Mes données"
        onClose={() => setErasing(false)}
        actions={
          <>
            <button type="button" className={btn.secondary} onClick={() => setErasing(false)}>
              Fermer
            </button>
            <button
              type="button"
              className={btn.danger}
              onClick={() => {
                void eraseAll();
                setErasing(false);
              }}
            >
              Effacer toutes mes données
            </button>
          </>
        }
      >
        <p>
          {mode === 'local'
            ? 'Vos voyages sont enregistrés uniquement dans ce navigateur, sur cet appareil. Rien n’est envoyé à un serveur.'
            : 'Mode essai : vos voyages ne sont gardés que tant que la page est ouverte.'}
        </p>
        <p className="mt-2">
          « Effacer toutes mes données » supprime définitivement tous les voyages et votre choix d’enregistrement sur cet appareil.
        </p>
      </Dialog>

      <footer className="mt-auto text-sm text-slate-600 dark:text-slate-400">
        Données stockées uniquement sur cet appareil, après votre accord. Aucun traceur. Code source sous licence MIT.
      </footer>
    </div>
  );
}
