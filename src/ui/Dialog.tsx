import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Boîte de dialogue modale accessible, basée sur <dialog> (piège du focus, Échap, rôle natif).
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <div className="text-sm">{children}</div>
          <div className="flex flex-wrap justify-end gap-2">{actions}</div>
        </div>
      )}
    </dialog>
  );
}

export const btn = {
  primary:
    'min-h-11 rounded-xl bg-slate-900 px-4 font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
  secondary:
    'min-h-11 rounded-xl border border-slate-300 px-4 font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800',
  danger: 'min-h-11 rounded-xl bg-red-700 px-4 font-medium text-white hover:bg-red-800',
  icon: 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800',
};

export const field =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100';
