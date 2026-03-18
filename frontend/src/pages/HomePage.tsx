import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { ListingGridSkeleton } from '../components/ListingGridSkeleton';
import { EmptyState } from '../components/EmptyState';
import { categoriesService } from '../services/categories.service';
import { listingsService } from '../services/listings.service';
import { asHttpError } from '../services/http';
import type { Category, ListingSummary } from '../types/domain';
import { marketplaceCategories, marketplaceListings } from './marketplaceMockData';
import { useLocaleSwitch } from '../utils/localeSwitch';

function normalizeListing(listing: ListingSummary) {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.priceAmount ?? 0,
    currency: listing.currency ?? 'USD',
    location: `${listing.country.name} - ${listing.city.name}`,
    imageUrl: listing.coverImage ?? undefined,
    badge: listing.isFeatured ? 'Featured' : undefined,
  };
}

export function HomePage() {
  const navigate = useNavigate();
  const { locale, pick } = useLocaleSwitch();
  const [searchValue, setSearchValue] = useState('');
  const [favorites, setFavorites] = useState<Array<number | string>>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [featuredListings, setFeaturedListings] = useState<ListingSummary[]>([]);
  const [latestListings, setLatestListings] = useState<ListingSummary[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const [categoriesResult, featuredResult, latestResult] = await Promise.all([
          categoriesService.listCategories(),
          listingsService.list({ limit: 8, featuredOnly: true, sort: 'featured', withImages: true }),
          listingsService.list({ limit: 12, sort: 'newest', withImages: true }),
        ]);

        setApiCategories(categoriesResult);
        setFeaturedListings(featuredResult.items);
        setLatestListings(latestResult.items);
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const displayedCategories = useMemo(() => {
    if (apiCategories.length === 0) return marketplaceCategories;

    return apiCategories.slice(0, 8).map((category) => ({
      id: category.slug,
      icon: category.icon || '📦',
      nameAr: category.name,
      nameEn: category.name,
    }));
  }, [apiCategories]);

  const sourceFeatured = featuredListings.length > 0
    ? featuredListings.map(normalizeListing)
    : marketplaceListings.slice(0, 4).map((item) => ({
      id: item.id,
      title: pick(item.titleAr, item.titleEn),
      price: item.price,
      currency: item.currency,
      location: pick(item.locationAr, item.locationEn),
      imageUrl: item.imageUrl,
      badge: pick(item.badgeAr ?? '', item.badgeEn ?? '') || undefined,
    }));

  const sourceLatest = latestListings.length > 0
    ? latestListings.map(normalizeListing)
    : marketplaceListings.map((item) => ({
      id: item.id,
      title: pick(item.titleAr, item.titleEn),
      price: item.price,
      currency: item.currency,
      location: pick(item.locationAr, item.locationEn),
      imageUrl: item.imageUrl,
      badge: pick(item.badgeAr ?? '', item.badgeEn ?? '') || undefined,
    }));

  const filteredLatest = sourceLatest.filter((listing) =>
    listing.title.toLowerCase().includes(searchValue.toLowerCase()),
  );

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-l from-primary to-blue-700 p-6 text-white shadow-soft md:p-10">
        <h1 className="text-2xl font-black md:text-4xl">
          {pick('سوقلي: سوق الإعلانات الموثوق في الشرق الأوسط', 'Souqly: Trusted Classifieds for the Arab Middle East')}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-blue-100 md:text-base">
          {pick(
            'اعرض منتجاتك وخدماتك وتواصل مباشرة مع المشترين بطريقة آمنة وسريعة.',
            'List products and services, then connect directly with buyers in a safe and fast flow.',
          )}
        </p>

        <form
          className="mt-6 flex flex-col gap-3 rounded-xl bg-white/10 p-3 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const query = searchValue.trim();
            navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
          }}
        >
          <input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={pick('ابحث عن سيارة، شقة، خدمة...', 'Search cars, apartments, services...')}
            className="h-12 w-full rounded-xl border border-white/30 bg-white px-4 text-ink outline-none ring-accent transition focus:ring-2"
          />
          <button
            type="submit"
            className="h-12 rounded-xl bg-accent px-5 text-sm font-bold text-white transition hover:bg-amber-600"
          >
            {pick('ابدأ البحث', 'Start Search')}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">{pick('التصنيفات', 'Categories')}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {displayedCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => navigate(`/search?category=${encodeURIComponent(category.id)}`)}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-start shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-slate-100 text-xl">
                {category.icon}
              </span>
              <span className="font-semibold text-ink">{pick(category.nameAr, category.nameEn)}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">{pick('إعلانات مميزة', 'Featured Listings')}</h2>
        </div>

        {loading ? (
          <ListingGridSkeleton count={4} />
        ) : (
          <div className="flex snap-x gap-4 overflow-x-auto pb-2">
            {sourceFeatured.map((listing) => (
              <div key={listing.id} className="min-w-[280px] snap-start md:min-w-[320px]">
                <ListingCard
                  id={listing.id}
                  title={listing.title}
                  price={listing.price}
                  currency={listing.currency}
                  location={listing.location}
                  imageUrl={listing.imageUrl}
                  badge={listing.badge}
                  isFavorite={favorites.includes(listing.id)}
                  locale={locale}
                  onOpen={(nextId) => navigate(`/listings/${nextId}`)}
                  onToggleFavorite={(id, nextState) =>
                    setFavorites((prev) =>
                      nextState ? [...prev, id] : prev.filter((favId) => favId !== id),
                    )}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">{pick('أحدث الإعلانات', 'Latest Listings')}</h2>
        </div>

        {loading ? (
          <ListingGridSkeleton />
        ) : filteredLatest.length === 0 ? (
          <EmptyState
            title={pick('لا توجد نتائج', 'No Results')}
            description={pick('جرّب كلمات بحث مختلفة أو غيّر الفئة.', 'Try different keywords or adjust filters.')}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLatest.map((listing) => (
              <ListingCard
                key={listing.id}
                id={listing.id}
                title={listing.title}
                price={listing.price}
                currency={listing.currency}
                location={listing.location}
                imageUrl={listing.imageUrl}
                badge={listing.badge}
                isFavorite={favorites.includes(listing.id)}
                locale={locale}
                onOpen={(nextId) => navigate(`/listings/${nextId}`)}
                onToggleFavorite={(id, nextState) =>
                  setFavorites((prev) =>
                    nextState ? [...prev, id] : prev.filter((favId) => favId !== id),
                  )}
              />
            ))}
          </div>
        )}
        {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
      </section>
    </div>
  );
}
