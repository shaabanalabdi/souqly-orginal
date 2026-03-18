import { TrustBadge, type TrustBadgeLabels } from './TrustBadge';
import { TrustScore } from './TrustScore';

export interface SellerCardLabels {
  responseTimeLabel: string;
  message: string;
  requestPhone: string;
  sendOffer: string;
  whatsApp: string;
  ratingLabel: string;
  trustScoreLabel: string;
}

export interface SellerCardProps {
  name: string;
  avatarUrl?: string;
  trustScore: number;
  rating: number;
  reviewCount?: number;
  responseTime: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  trustBadgeLabels?: TrustBadgeLabels;
  labels?: SellerCardLabels;
  className?: string;
  loading?: boolean;
  onMessage?: () => void;
  onRequestPhone?: () => void;
  onSendOffer?: () => void;
  onWhatsApp?: () => void;
}

const DEFAULT_LABELS: SellerCardLabels = {
  responseTimeLabel: 'زمن الرد',
  message: 'مراسلة',
  requestPhone: 'طلب رقم الهاتف',
  sendOffer: 'إرسال عرض',
  whatsApp: 'واتساب',
  ratingLabel: 'التقييم',
  trustScoreLabel: 'درجة الثقة',
};

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="size-14 rounded-full border border-slate-200 object-cover"
        loading="lazy"
      />
    );
  }

  const initials = name.trim().slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
      {initials || 'S'}
    </span>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`size-4 ${filled ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
      aria-hidden
    >
      <path d="M10 1.5l2.47 5 5.53.8-4 3.9.94 5.5L10 14.1 5.06 16.7 6 11.2l-4-3.9 5.53-.8L10 1.5z" />
    </svg>
  );
}

function renderStars(rating: number) {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating)));
  return Array.from({ length: 5 }, (_, index) => (
    <Star key={`star-${index + 1}`} filled={index < safeRating} />
  ));
}

function SellerCardSkeleton() {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="size-14 animate-pulse rounded-full bg-slate-200" />
        <div className="w-full space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-4 h-20 animate-pulse rounded-xl bg-slate-100" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
      </div>
    </article>
  );
}

function ActionButton({
  label,
  onClick,
  variant = 'secondary',
}: {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'whatsapp';
}) {
  const baseClass = 'rounded-xl px-3 py-2 text-sm font-semibold transition';
  const variantClass =
    variant === 'primary'
      ? 'bg-primary text-white hover:bg-blue-900'
      : variant === 'whatsapp'
        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
        : 'border border-slate-200 text-ink hover:bg-slate-50';

  return (
    <button type="button" onClick={onClick} className={`${baseClass} ${variantClass}`}>
      {label}
    </button>
  );
}

export function SellerCard({
  name,
  avatarUrl,
  trustScore,
  rating,
  reviewCount,
  responseTime,
  emailVerified,
  phoneVerified,
  idVerified,
  trustBadgeLabels,
  labels = DEFAULT_LABELS,
  className = '',
  loading = false,
  onMessage,
  onRequestPhone,
  onSendOffer,
  onWhatsApp,
}: SellerCardProps) {
  if (loading) {
    return <SellerCardSkeleton />;
  }

  return (
    <article className={`rounded-xl border border-slate-200 bg-white p-4 shadow-soft ${className}`}>
      <div className="flex items-center gap-3">
        <Avatar name={name} avatarUrl={avatarUrl} />
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">{name}</h3>
          <div className="mt-1 flex items-center gap-1">
            {renderStars(rating)}
            <span className="ms-1 text-xs text-muted">
              {labels.ratingLabel}
              {': '}
              {Math.max(0, Math.min(5, rating)).toFixed(1)}
              {typeof reviewCount === 'number' ? ` (${reviewCount})` : ''}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        {labels.responseTimeLabel}
        {': '}
        <span className="font-semibold text-ink">{responseTime}</span>
      </p>

      <div className="mt-3">
        <TrustScore score={trustScore} label={labels.trustScoreLabel} className="p-3" />
      </div>

      <TrustBadge
        emailVerified={emailVerified}
        phoneVerified={phoneVerified}
        idVerified={idVerified}
        labels={trustBadgeLabels}
        className="mt-3"
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ActionButton label={labels.message} onClick={onMessage} variant="primary" />
        <ActionButton label={labels.requestPhone} onClick={onRequestPhone} />
        <ActionButton label={labels.sendOffer} onClick={onSendOffer} />
        <ActionButton label={labels.whatsApp} onClick={onWhatsApp} variant="whatsapp" />
      </div>
    </article>
  );
}
