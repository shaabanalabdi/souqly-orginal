import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { Button, EmptyStatePanel, ErrorStatePanel, LoadingState } from '../components/ui';
import { businessProfileService } from '../services/businessProfile.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { BusinessProfileDto, CompactListingSummary, PublicStoreProfileDto, StoreAnalyticsDto } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

type StoreTab = 'listings' | 'reviews' | 'about' | 'analytics';

function mapListing(listing: CompactListingSummary) {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.priceAmount ?? 0,
    currency: listing.currency ?? 'USD',
    location: 'Souqly Store',
    imageUrl: listing.coverImage ?? undefined,
    badge: undefined,
  };
}

export function StorePage() {
  const navigate = useNavigate();
  const { storeId: storeIdParam } = useParams<{ storeId: string }>();
  const { pick, locale } = useLocaleSwitch();
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<StoreTab>('listings');
  const [profile, setProfile] = useState<BusinessProfileDto | PublicStoreProfileDto | null>(null);
  const [listings, setListings] = useState<CompactListingSummary[]>([]);
  const [analytics, setAnalytics] = useState<StoreAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    const loadStore = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const storeId = storeIdParam ? Number(storeIdParam) : user?.id;
        if (!storeId || Number.isNaN(storeId)) {
          throw new Error(pick('معرّف المتجر غير متوفر.', 'Store id is not available.'));
        }

        const profileRequest = storeIdParam ? businessProfileService.getStore(storeId) : businessProfileService.me();
        const listingsRequest = businessProfileService.listStoreListings(storeId, 1, 12);
        const canViewAnalytics = Boolean(user && user.id === storeId);

        const [profileResult, listingsResult, analyticsResult] = await Promise.all([
          profileRequest,
          listingsRequest,
          canViewAnalytics ? businessProfileService.getStoreAnalytics(storeId).catch(() => null) : Promise.resolve(null),
        ]);

        if (!active) {
          return;
        }

        setProfile(profileResult);
        setListings(listingsResult.items);
        setAnalytics(analyticsResult);
      } catch (error) {
        if (active) {
          setErrorMessage(asHttpError(error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadStore();
    return () => {
      active = false;
    };
  }, [storeIdParam, user?.id]);

  const mappedListings = useMemo(() => listings.map(mapListing), [listings]);
  const companyName = profile?.companyName || pick('المتجر الرسمي', 'Official Store');
  const subtitle = 'website' in (profile ?? {}) ? profile?.website : null;
  const showAnalyticsTab = Boolean(analytics);

  if (loading) {
    return <LoadingState text={pick('جارٍ تحميل صفحة المتجر...', 'Loading store page...')} />;
  }

  if (errorMessage && !profile) {
    return (
      <ErrorStatePanel
        title={pick('تعذر تحميل المتجر', 'Failed to load store')}
        message={errorMessage}
        action={<Button variant="secondary" onClick={() => navigate('/search')}>{pick('العودة إلى البحث', 'Back to Search')}</Button>}
      />
    );
  }

  return (
    <section className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="h-36 bg-gradient-to-r from-primary to-blue-700" />
        <div className="p-4">
          <div className="-mt-14 flex flex-wrap items-end gap-4">
            <img src="https://picsum.photos/seed/souqly-store-logo/120/120" alt="" className="size-24 rounded-2xl border-4 border-white object-cover shadow" />
            <div>
              <h1 className="text-2xl font-black text-ink">{companyName}</h1>
              <p className="text-sm text-muted">
                {subtitle || pick('صفحة المتجر وعروضه الحالية.', 'Store profile and active listings.')}
              </p>
              {'verifiedByAdmin' in (profile ?? {}) && profile?.verifiedByAdmin ? (
                <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {pick('متجر موثّق', 'Verified Store')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex flex-wrap gap-2">
          <TabButton active={tab === 'listings'} onClick={() => setTab('listings')} label={pick('الإعلانات', 'Listings')} />
          <TabButton active={tab === 'reviews'} onClick={() => setTab('reviews')} label={pick('التقييمات', 'Reviews')} />
          <TabButton active={tab === 'about'} onClick={() => setTab('about')} label={pick('حول المتجر', 'About')} />
          {showAnalyticsTab ? (
            <TabButton active={tab === 'analytics'} onClick={() => setTab('analytics')} label={pick('التحليلات', 'Analytics')} />
          ) : null}
        </div>

        {tab === 'listings' ? (
          mappedListings.length === 0 ? (
            <EmptyStatePanel
              title={pick('لا توجد إعلانات', 'No Listings')}
              description={pick('لم يتم العثور على إعلانات حالية لهذا المتجر.', 'No active listings were found for this store.')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mappedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  id={listing.id}
                  title={listing.title}
                  price={listing.price}
                  currency={listing.currency}
                  location={listing.location}
                  imageUrl={listing.imageUrl}
                  badge={listing.badge}
                  locale={locale}
                  onOpen={(id) => navigate(`/listings/${id}`)}
                />
              ))}
            </div>
          )
        ) : null}

        {tab === 'reviews' ? (
          <EmptyStatePanel
            title={pick('لا توجد تقييمات بعد', 'No Reviews Yet')}
            description={pick('ستظهر تقييمات العملاء هنا.', 'Customer reviews will appear here.')}
          />
        ) : null}

        {tab === 'about' ? (
          <article className="rounded-xl bg-surface p-4 text-sm leading-7 text-muted">
            {profile ? (
              <>
                <p>{pick('اسم الشركة', 'Company')}: {profile.companyName}</p>
                {'commercialRegister' in profile ? (
                  <>
                    <p>{pick('السجل التجاري', 'Commercial Register')}: {profile.commercialRegister ?? pick('غير متاح', 'N/A')}</p>
                    <p>{pick('الرقم الضريبي', 'Tax Number')}: {profile.taxNumber ?? pick('غير متاح', 'N/A')}</p>
                  </>
                ) : null}
                <p>{pick('الموقع الإلكتروني', 'Website')}: {subtitle ?? pick('غير متاح', 'N/A')}</p>
              </>
            ) : (
              pick('تعذر تحميل معلومات المتجر.', 'Failed to load store info.')
            )}
          </article>
        ) : null}

        {tab === 'analytics' && analytics ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label={pick('الإعلانات النشطة', 'Active Listings')} value={analytics.metrics.activeListings} />
            <MetricCard label={pick('إجمالي الإعلانات', 'Total Listings')} value={analytics.metrics.totalListings} />
            <MetricCard label={pick('بدايات المحادثة', 'Chat Starts')} value={analytics.metrics.chatStarts} />
            <MetricCard label={pick('العروض المستلمة', 'Offers Received')} value={analytics.metrics.offersReceived} />
            <MetricCard label={pick('الصفقات', 'Deals Created')} value={analytics.metrics.dealsCreated} />
          </div>
        ) : null}

        {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
      </section>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-2xl font-black text-ink">{value}</p>
    </article>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active ? 'bg-primary text-white' : 'border border-slate-200 text-ink hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}
