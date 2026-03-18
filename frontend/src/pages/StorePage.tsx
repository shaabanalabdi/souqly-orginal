import { useEffect, useMemo, useState } from 'react';
import { ListingCard } from '../components/ListingCard';
import { EmptyState } from '../components/EmptyState';
import { businessProfileService } from '../services/businessProfile.service';
import { listingsService } from '../services/listings.service';
import { asHttpError } from '../services/http';
import type { BusinessProfileDto, ListingSummary } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

type StoreTab = 'listings' | 'reviews' | 'about';

function mapListing(listing: ListingSummary) {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.priceAmount ?? 0,
    currency: listing.currency ?? 'SAR',
    location: `${listing.country.name} - ${listing.city.name}`,
    imageUrl: listing.coverImage ?? undefined,
    badge: listing.isFeatured ? 'Featured' : undefined,
  };
}

export function StorePage() {
  const { pick, locale } = useLocaleSwitch();
  const [tab, setTab] = useState<StoreTab>('listings');
  const [profile, setProfile] = useState<BusinessProfileDto | null>(null);
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadStore = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const [profileResult, listingsResult] = await Promise.all([
          businessProfileService.me(),
          listingsService.list({ page: 1, limit: 12, sort: 'featured', withImages: true }),
        ]);
        setProfile(profileResult);
        setListings(listingsResult.items);
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadStore();
  }, []);

  const mappedListings = useMemo(() => listings.map(mapListing), [listings]);

  return (
    <section className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="h-36 bg-gradient-to-r from-primary to-blue-700" />
        <div className="p-4">
          <div className="-mt-14 flex flex-wrap items-end gap-4">
            <img src="https://picsum.photos/seed/souqly-store-logo/120/120" alt="" className="size-24 rounded-2xl border-4 border-white object-cover shadow" />
            <div>
              <h1 className="text-2xl font-black text-ink">
                {profile?.companyName || pick('المتجر الرسمي', 'Official Store')}
              </h1>
              <p className="text-sm text-muted">
                {profile?.website || pick('صفحة المتجر وعروضه الحالية.', 'Store profile and active listings.')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex flex-wrap gap-2">
          <TabButton active={tab === 'listings'} onClick={() => setTab('listings')} label={pick('الإعلانات', 'Listings')} />
          <TabButton active={tab === 'reviews'} onClick={() => setTab('reviews')} label={pick('التقييمات', 'Reviews')} />
          <TabButton active={tab === 'about'} onClick={() => setTab('about')} label={pick('حول المتجر', 'About')} />
        </div>

        {tab === 'listings' ? (
          loading ? (
            <p className="text-sm text-muted">{pick('جارٍ التحميل...', 'Loading...')}</p>
          ) : mappedListings.length === 0 ? (
            <EmptyState
              title={pick('لا توجد إعلانات', 'No Listings')}
              description={pick('لم يتم العثور على إعلانات حالية.', 'No active listings were found.')}
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
                />
              ))}
            </div>
          )
        ) : null}

        {tab === 'reviews' ? (
          <EmptyState
            title={pick('لا توجد تقييمات بعد', 'No Reviews Yet')}
            description={pick('ستظهر تقييمات العملاء هنا.', 'Customer reviews will appear here.')}
          />
        ) : null}

        {tab === 'about' ? (
          <article className="rounded-xl bg-surface p-4 text-sm leading-7 text-muted">
            {profile ? (
              <>
                <p>
                  {pick('اسم الشركة', 'Company')}: {profile.companyName}
                </p>
                <p>
                  {pick('السجل التجاري', 'Commercial Register')}: {profile.commercialRegister ?? pick('غير متاح', 'N/A')}
                </p>
                <p>
                  {pick('الرقم الضريبي', 'Tax Number')}: {profile.taxNumber ?? pick('غير متاح', 'N/A')}
                </p>
                <p>
                  {pick('الموقع الإلكتروني', 'Website')}: {profile.website ?? pick('غير متاح', 'N/A')}
                </p>
              </>
            ) : (
              pick(
                'يمكنك إكمال ملف النشاط التجاري من صفحة حسابك.',
                'You can complete your business profile from your account page.',
              )
            )}
          </article>
        ) : null}
        {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
      </section>
    </section>
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
