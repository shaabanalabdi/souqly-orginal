import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'warning' | 'error' | 'info';

interface ToastEntry {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function toneClasses(tone: ToastTone): string {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (tone === 'error') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      push(message, tone = 'info') {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((prev) => [...prev, { id, message, tone }]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 3500);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed z-[500] flex max-w-sm flex-col gap-2 p-3 rtl:left-0 rtl:right-auto ltr:right-0 ltr:left-auto top-0">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-xl border px-3 py-2 text-sm font-medium shadow-sm ${toneClasses(toast.tone)}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider.');
  }
  return context;
}
