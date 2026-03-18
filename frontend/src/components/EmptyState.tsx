export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <section className={`rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center ${className}`}>
      <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        ∅
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
