import { useEffect, useMemo, useState } from 'react';
import { ListingCard } from '../components/ListingCard';
import { TrustBadge } from '../components/TrustBadge';
import { TrustScore } from '../components/TrustScore';
import { EmptyState } from '../components/EmptyState';
import { preferencesService } from '../services/preferences.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { FavoriteSummary } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

type ProfileTab = 'listings' | 'reviews';

function trustScoreFromTier(tier: string): number {
  if (tier === 'TOP_SELLER') return 95;
  if (tier === 'TRUSTED') return 82;
  if (tier === 'VERIFIED') return 68;
  return 45;
}

export function ProfilePage() {
  const { pick, locale } = useLocaleSwitch();
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<ProfileTab>('listings');
  const [favorites, setFavorites] = useState<FavoriteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadFavorites = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const result = await preferencesService.listFavorites(1, 24);
        setFavorites(result.items);
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadFavorites();
  }, []);

  const listings = useMemo(
    () =>
      favorites.map((favorite) => ({
        id: favorite.listing.id,
        title: favorite.listing.title,
        price: favorite.listing.priceAmount ?? 0,
        currency: favorite.listing.currency ?? 'USD',
        location: `${favorite.listing.countryName} - ${favorite.listing.cityName}`,
        imageUrl: favorite.listing.coverImage ?? undefined,
      })),
    [favorites],
  );

  const reviews = [
    { id: 'r1', authorAr: 'خالد', authorEn: 'Khalid', textAr: 'تجربة ممتازة وسرعة في الرد.', textEn: 'Great experience and fast response.' },
    { id: 'r2', authorAr: 'ريم', authorEn: 'Reem', textAr: 'التعامل احترافي جدًا.', textEn: 'Very professional communication.' },
  ];

  if (!user) {
    return (
      <EmptyState
        title={pick('الملف غير متاح', 'Profile Unavailable')}
        description={pick('يجب تسجيل الدخول أولًا.', 'Please login first.')}
      />
    );
  }

  return (
    <section className="space-y-6">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src="https://picsum.photos/seed/souqly-profile/140/140" alt="" className="size-20 rounded-full object-cover" />
            <div>
              <h1 className="text-2xl font-black text-ink">{user.fullName ?? user.email ?? `#${user.id}`}</h1>
              <p className="text-sm text-muted">{pick('حساب موثّق', 'Verified Account')}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label={pick('المفضلة', 'Favorites')} value={String(favorites.length)} />
            <Stat label={pick('نوع الحساب', 'Account Type')} value={user.accountType} />
            <Stat label={pick('الدور', 'Role')} value={user.role} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
          <TrustBadge
            emailVerified={user.emailVerified}
            phoneVerified={user.phoneVerified}
            idVerified={user.identityVerificationStatus === 'VERIFIED'}
            labels={{
              email: pick('البريد موثق', 'Email Verified'),
              phone: pick('الهاتف موثق', 'Phone Verified'),
              id: pick('الهوية موثقة', 'ID Verified'),
              sectionLabel: pick('مؤشرات التوثيق', 'Verification indicators'),
            }}
          />
          <TrustScore score={trustScoreFromTier(user.trustTier)} label={pick('درجة الثقة', 'Trust Score')} />
        </div>
      </article>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('listings')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === 'listings' ? 'bg-primary text-white' : 'border border-slate-200 text-ink hover:bg-slate-50'
            }`}
          >
            {pick('المفضلة', 'Favorites')}
          </button>
          <button
            type="button"
            onClick={() => setTab('reviews')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === 'reviews' ? 'bg-primary text-white' : 'border border-slate-200 text-ink hover:bg-slate-50'
            }`}
          >
            {pick('التقييمات', 'Reviews')}
          </button>
        </div>

        {tab === 'listings' ? (
          loading ? (
            <p className="text-sm text-muted">{pick('جارٍ التحميل...', 'Loading...')}</p>
          ) : listings.length === 0 ? (
            <EmptyState
              title={pick('لا توجد عناصر مفضلة', 'No Favorites Yet')}
              description={pick('أضف إعلانات إلى المفضلة لتظهر هنا.', 'Add listings to favorites to show them here.')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  title={listing.title}
                  price={listing.price}
                  currency={listing.currency}
                  location={listing.location}
                  imageUrl={listing.imageUrl}
                  locale={locale}
                />
              ))}
            </div>
          )
        ) : reviews.length === 0 ? (
          <EmptyState
            title={pick('لا توجد تقييمات', 'No Reviews Yet')}
            description={pick('التقييمات ستظهر هنا بعد أول عملية بيع.', 'Reviews will appear after the first completed deal.')}
          />
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-ink">{pick(review.authorAr, review.authorEn)}</p>
                <p className="mt-1 text-sm text-muted">{pick(review.textAr, review.textEn)}</p>
              </article>
            ))}
          </div>
        )}
        {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
      </section>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface px-3 py-2 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
