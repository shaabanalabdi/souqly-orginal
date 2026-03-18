export interface ListingCardLabels {
  noImage: string;
  addFavorite: string;
  removeFavorite: string;
}

export interface ListingCardProps {
  id: number | string;
  title: string;
  price: number;
  currency?: string;
  location: string;
  imageUrl?: string;
  badge?: string;
  isFavorite?: boolean;
  loading?: boolean;
  className?: string;
  locale?: string;
  labels?: ListingCardLabels;
  onOpen?: (id: number | string) => void;
  onToggleFavorite?: (id: number | string, nextState: boolean) => void;
}

const DEFAULT_LABELS: ListingCardLabels = {
  noImage: 'لا توجد صورة',
  addFavorite: 'إضافة للمفضلة',
  removeFavorite: 'إزالة من المفضلة',
};

function formatPrice(value: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-5 ${active ? 'fill-rose-500 text-rose-500' : 'fill-none text-slate-500'}`}
      aria-hidden
    >
      <path
        stroke="currentColor"
        strokeWidth="1.8"
        d="M12 20.5s-7-4.35-9.17-8.2C.64 8.36 3.08 4 7.47 4c2.09 0 3.28 1.16 4.53 2.64C13.25 5.16 14.44 4 16.53 4c4.39 0 6.83 4.36 4.64 8.3C19 16.15 12 20.5 12 20.5Z"
      />
    </svg>
  );
}

function ListingSkeleton() {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
      <div className="aspect-[4/3] animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
      </div>
    </article>
  );
}

export function ListingCard({
  id,
  title,
  price,
  currency = 'SAR',
  location,
  imageUrl,
  badge,
  isFavorite = false,
  loading = false,
  className = '',
  locale = 'ar',
  labels = DEFAULT_LABELS,
  onOpen,
  onToggleFavorite,
}: ListingCardProps) {
  if (loading) {
    return <ListingSkeleton />;
  }

  const formattedPrice = formatPrice(price, currency, locale);
  const favoriteAriaLabel = isFavorite ? labels.removeFavorite : labels.addFavorite;

  return (
    <article
      className={`group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg ${className}`}
    >
      <div className="relative">
        <button
          type="button"
          className="block w-full text-start"
          onClick={() => onOpen?.(id)}
          aria-label={title}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={title} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-slate-100 text-sm text-muted">
              {labels.noImage}
            </div>
          )}
        </button>

        {badge ? (
          <span className="absolute start-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
        ) : null}

        <button
          type="button"
          aria-label={favoriteAriaLabel}
          aria-pressed={isFavorite}
          onClick={() => onToggleFavorite?.(id, !isFavorite)}
          className="absolute end-3 top-3 rounded-full bg-white/95 p-2 shadow transition hover:bg-white"
        >
          <HeartIcon active={isFavorite} />
        </button>
      </div>

      <div className="space-y-2 p-4">
        <h3 className="min-h-10 text-sm font-semibold leading-5 text-ink">{title}</h3>
        <p className="text-lg font-bold text-primary">{formattedPrice}</p>
        <p className="text-sm text-muted">{location}</p>
      </div>
    </article>
  );
}
