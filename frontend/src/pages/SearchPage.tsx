import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { ListingGridSkeleton } from '../components/ListingGridSkeleton';
import { EmptyState } from '../components/EmptyState';
import { categoriesService } from '../services/categories.service';
import { geoService } from '../services/geo.service';
import { listingsService } from '../services/listings.service';
import { asHttpError } from '../services/http';
import type { Category, Country, ListingCondition, ListingSummary } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

type ViewMode = 'list' | 'map';
type ConditionFilter = 'all' | ListingCondition;

const PAGE_SIZE = 12;

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

export function SearchPage() {
  const navigate = useNavigate();
  const { pick, locale } = useLocaleSwitch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [favorites, setFavorites] = useState<Array<number | string>>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<Array<{ id: number; name: string }>>([]);
  const [items, setItems] = useState<ListingSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  const q = searchParams.get('q') ?? '';
  const categorySlug = searchParams.get('category') ?? '';
  const condition = (searchParams.get('condition') as ConditionFilter | null) ?? 'all';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const countryId = searchParams.get('countryId') ?? '';
  const cityId = searchParams.get('cityId') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [categoriesResult, countriesResult] = await Promise.all([
          categoriesService.listCategories(),
          geoService.listCountries(),
        ]);
        setCategories(categoriesResult);
        setCountries(countriesResult);
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      }
    };

    void loadStatic();
  }, []);

  useEffect(() => {
    const loadCities = async () => {
      if (!countryId) {
        setCities([]);
        return;
      }
      const selectedCountry = countries.find((country) => String(country.id) === countryId);
      if (!selectedCountry) return;

      try {
        const result = await geoService.listCountryCities(selectedCountry.code);
        setCities(result.cities.map((city) => ({ id: city.id, name: city.name })));
      } catch {
        setCities([]);
      }
    };

    void loadCities();
  }, [countries, countryId]);

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const result = await listingsService.list({
          page,
          limit: PAGE_SIZE,
          q: q || undefined,
          categorySlug: categorySlug || undefined,
          countryId: countryId ? Number(countryId) : undefined,
          cityId: cityId ? Number(cityId) : undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          condition: condition === 'all' ? undefined : condition,
          sort: 'newest',
          withImages: true,
        });
        setItems(result.items);
        setTotalPages(Math.max(1, result.meta.totalPages));
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    void loadResults();
  }, [q, categorySlug, condition, minPrice, maxPrice, countryId, cityId, page]);

  const mappedListings = useMemo(() => items.map(mapListing), [items]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-ink">{pick('نتائج البحث', 'Search Results')}</h1>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-50"
            onClick={() => setViewMode((prev) => (prev === 'list' ? 'map' : 'list'))}
          >
            {viewMode === 'list' ? pick('عرض الخريطة', 'Map View') : pick('عرض القائمة', 'List View')}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:hidden">
          <input
            value={q}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder={pick('بحث', 'Search')}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <select
            value={categorySlug}
            onChange={(event) => setParam('category', event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">{pick('كل الفئات', 'All Categories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="hidden h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-soft lg:block">
          <h2 className="text-base font-bold text-ink">{pick('الفلاتر', 'Filters')}</h2>

          <label className="block space-y-2">
            <span className="text-sm text-muted">{pick('بحث', 'Search')}</span>
            <input
              value={q}
              onChange={(event) => setParam('q', event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-muted">{pick('الفئة', 'Category')}</span>
            <select
              value={categorySlug}
              onChange={(event) => setParam('category', event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">{pick('كل الفئات', 'All Categories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-muted">{pick('الحالة', 'Condition')}</span>
            <select
              value={condition}
              onChange={(event) => setParam('condition', event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="all">{pick('كل الحالات', 'All Conditions')}</option>
              <option value="NEW">{pick('جديد', 'New')}</option>
              <option value="USED">{pick('مستعمل', 'Used')}</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-2">
              <span className="text-sm text-muted">{pick('السعر من', 'Min Price')}</span>
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(event) => setParam('minPrice', event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-muted">{pick('السعر إلى', 'Max Price')}</span>
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(event) => setParam('maxPrice', event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-muted">{pick('الدولة', 'Country')}</span>
            <select
              value={countryId}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set('countryId', event.target.value);
                else next.delete('countryId');
                next.delete('cityId');
                next.set('page', '1');
                setSearchParams(next);
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">{pick('كل الدول', 'All Countries')}</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-muted">{pick('المدينة', 'City')}</span>
            <select
              value={cityId}
              onChange={(event) => setParam('cityId', event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              disabled={!countryId}
            >
              <option value="">{pick('كل المدن', 'All Cities')}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
        </aside>

        <div className="space-y-4">
          {viewMode === 'map' ? (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-muted shadow-soft">
              {pick('الخريطة ستظهر هنا', 'Map will be displayed here')}
            </div>
          ) : null}

          {loading ? (
            <ListingGridSkeleton />
          ) : mappedListings.length === 0 ? (
            <EmptyState
              title={pick('لا توجد نتائج', 'No Results')}
              description={pick('لا توجد إعلانات مطابقة للفلاتر الحالية.', 'No listings match the active filters.')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  isFavorite={favorites.includes(listing.id)}
                  onOpen={(id) => navigate(`/listings/${id}`)}
                  onToggleFavorite={(id, nextState) =>
                    setFavorites((prev) => (nextState ? [...prev, id] : prev.filter((favId) => favId !== id)))
                  }
                />
              ))}
            </div>
          )}

          {errorMessage ? <p className="text-sm text-amber-700">{errorMessage}</p> : null}

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setParam('page', String(Math.max(1, page - 1)))}
              disabled={page === 1}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
            >
              {pick('السابق', 'Prev')}
            </button>
            <span className="text-sm text-muted">
              {pick('صفحة', 'Page')} {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setParam('page', String(Math.min(totalPages, page + 1)))}
              disabled={page === totalPages}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-40"
            >
              {pick('التالي', 'Next')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
