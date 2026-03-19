import { useEffect, type ReactNode } from 'react';

export interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export function Modal({ isOpen, title, children, onClose, footer }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="max-h-[65vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <footer className="border-t border-slate-200 px-4 py-3">{footer}</footer> : null}
      </div>
    </div>
  );
}
