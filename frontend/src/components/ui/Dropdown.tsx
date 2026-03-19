import { useMemo, useState, type ReactNode } from 'react';

export interface DropdownOption {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
}

export interface DropdownProps {
  triggerLabel: string;
  options: DropdownOption[];
  onSelect: (key: string) => void;
  disabled?: boolean;
}

export function Dropdown({ triggerLabel, options, onSelect, disabled = false }: DropdownProps) {
  const [open, setOpen] = useState(false);

  const triggerIcon = useMemo(
    () => <span className="material-symbols-outlined text-base">expand_more</span>,
    [],
  );

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {triggerLabel}
        {triggerIcon}
      </button>

      {open ? (
        <div className="absolute z-[120] mt-2 min-w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-md">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                onSelect(option.key);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-start transition hover:bg-slate-50 ${option.tone === 'danger' ? 'text-red-600' : 'text-ink'}`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
