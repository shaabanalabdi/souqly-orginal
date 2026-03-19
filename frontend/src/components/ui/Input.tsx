import type { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="grid gap-1.5">
      {label ? <span className="text-sm font-semibold text-ink">{label}</span> : null}
      <input
        id={fieldId}
        className={`h-11 rounded-xl border px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary ${error ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'} ${className}`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
