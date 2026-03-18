type TrustTier = 'low' | 'medium' | 'high';

export interface TrustScoreProps {
  score: number;
  label?: string;
  className?: string;
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function resolveTier(score: number): TrustTier {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function resolveTierClasses(tier: TrustTier): { bar: string; text: string; bg: string } {
  if (tier === 'high') {
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-700',
      bg: 'bg-emerald-50',
    };
  }

  if (tier === 'medium') {
    return {
      bar: 'bg-accent',
      text: 'text-amber-700',
      bg: 'bg-amber-50',
    };
  }

  return {
    bar: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
  };
}

export function TrustScore({ score, label = 'درجة الثقة', className = '' }: TrustScoreProps) {
  const normalized = clampScore(score);
  const tier = resolveTier(normalized);
  const tierClasses = resolveTierClasses(tier);

  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-soft ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${tierClasses.text} ${tierClasses.bg}`}
          aria-label={`${label} ${normalized}%`}
        >
          {normalized}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalized}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div className={`h-full rounded-full transition-all ${tierClasses.bar}`} style={{ width: `${normalized}%` }} />
      </div>
    </section>
  );
}
