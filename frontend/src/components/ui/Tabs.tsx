import type { ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tabs({ items, activeKey, onChange }: TabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-primary text-white' : 'text-ink hover:bg-slate-50'}`}
            aria-pressed={isActive}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
