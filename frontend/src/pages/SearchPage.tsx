import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { ListingGridSkeleton } from '../components/ListingGridSkeleton';
import { EmptyState } from '../components/EmptyState';
import { Button, ErrorStatePanel, Tabs } from '../components/ui';
import { categoriesService } from '../services/categories.service';
import { geoService } from '../services/geo.service';
import { listingsService } from '../services/listings.service';
import { asHttpError } from '../services/http';
import type {
  Category,
  Country,
  ListingCondition,
  ListingQuery,
  ListingSummary,
  Subcategory,
} from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';
import { filterTargetMarketCountries } from '../constants/market';
import { addRecentlyViewedListingId } from '../utils/recentlyViewed';

type ViewMode = 'list' | 'map';
type ConditionFilter = 'all' | ListingCondition;
type SortFilter = NonNullable<ListingQuery['sort']>;

interface MapPoint {
  id: number | string;
  title: string;
  price: number;
  currency: string;
  location: string;
  imageUrl?: string;
  badge?: string;
  x: number;
  y: number;
}

interface MapCluster {
  key: string;
  x: number;
  y: number;
  points: MapPoint[];
}

const PAGE_SIZE = 12;

function mapListing(listing: ListingSummary) {
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

function seedFromId(id: number | string): number {
  const text = String(id);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pinPositionFromId(id: number | string): { x: number; y: number } {
  const seed = seedFromId(id);
  const x = 8 + (seed % 84);
  const y = 10 + (Math.floor(seed / 97) % 78);
  return { x, y };
}

export function SearchPage() {
  const navigate = useNavigate();
  const { pick, locale } = useLocaleSwitch();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [favorites, setFavorites] = useState<Array<number | string>>([]);
  const [selectedMapPointId, setSelectedMapPointId] = useState<number | string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<Array<{ id: number; name: string }>>([]);
  const [appendedItems, setAppendedItems] = useState<ListingSummary[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [autoLoadingNextPage, setAutoLoadingNextPage] = useState(false);
  const infiniteTriggerRef = useRef<HTMLDivElement | null>(null);

  const q = searchParams.get('q') ?? '';
  const categorySlug = searchParams.get('category') ?? '';
  const subcategoryId = searchParams.get('subcategory') ?? '';
  const condition = (searchParams.get('condition') as ConditionFilter | null) ?? 'all';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const countryId = searchParams.get('countryId') ?? '';
  const countryCode = (searchParams.get('countryCode') ?? '').toUpperCase();
  const cityId = searchParams.get('cityId') ?? '';
  const sort = (searchParams.get('sort') as SortFilter | null) ?? 'newest';
  const featuredOnly = searchParams.get('featured') === '1';
  const viewMode = (searchParams.get('view') as ViewMode | null) ?? 'list';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (countryCode) next.set('countryCode', countryCode);
    next.set('page', '1');
    next.set('sort', 'newest');
    if (viewMode !== 'list') next.set('view', viewMode);
    setSearchParams(next);
  };

  const applyCountryFilter = (rawCountryId: string) => {
    const next = new URLSearchParams(searchParams);
    if (rawCountryId) {
      next.set('countryId', rawCountryId);
      const selectedCountry = countries.find((country) => String(country.id) === rawCountryId);
      if (selectedCountry) next.set('countryCode', selectedCountry.code);
    } else {
      next.delete('countryId');
      next.delete('countryCode');
    }
    next.delete('cityId');
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleNearMe = async () => {
    if (!('geolocation' in navigator)) {
      setErrorMessage(pick('المتصفح لا يدعم تحديد الموقع.', 'Geolocation is not supported in this browser.'));
      return;
    }

    const resolvePosition = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

    setNearMeLoading(true);
    setErrorMessage('');
    try {
      const position = await resolvePosition();
      const nearest = await geoService.getNearestCity(position.coords.latitude, position.coords.longitude);

      const next = new URLSearchParams(searchParams);
      next.set('countryId', String(nearest.country.id));
      next.set('countryCode', nearest.country.code);
      next.set('cityId', String(nearest.city.id));
      next.set('page', '1');
      setSearchParams(next);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setNearMeLoading(false);
    }
  };

  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [categoriesResult, countriesResult] = await Promise.all([
          categoriesService.listCategories(),
          geoService.listCountries(),
        ]);
        setCategories(categoriesResult);
        setCountries(filterTargetMarketCountries(countriesResult));
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      }
    };

    void loadStatic();
  }, []);

  useEffect(() => {
    const loadSubcategories = async () => {
      if (!categorySlug) {
        setSubcategories([]);
        return;
      }
      try {
        const result = await categoriesService.listSubcategories(categorySlug);
        setSubcategories(result.subcategories);
      } catch {
        setSubcategories([]);
      }
    };

    void loadSubcategories();
  }, [categorySlug]);

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
    if (!countryCode || countries.length === 0) return;

    const matchedCountry = countries.find((country) => country.code === countryCode);
    if (!matchedCountry || countryId === String(matchedCountry.id)) return;

    const next = new URLSearchParams(searchParams);
    next.set('countryId', String(matchedCountry.id));
    next.delete('cityId');
    next.set('page', '1');
    setSearchParams(next);
  }, [countryCode, countries, countryId, searchParams, setSearchParams]);

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
          subcategoryId: subcategoryId ? Number(subcategoryId) : undefined,
          countryId: countryId ? Number(countryId) : undefined,
          cityId: cityId ? Number(cityId) : undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          condition: condition === 'all' ? undefined : condition,
          sort,
          withImages: true,
          featuredOnly: featuredOnly || undefined,
        });
        setAppendedItems((prev) => {
          if (page <= 1) return result.items;
          const currentIds = new Set(prev.map((item) => item.id));
          const toAppend = result.items.filter((item) => !currentIds.has(item.id));
          return [...prev, ...toAppend];
        });
        setTotalPages(Math.max(1, result.meta.totalPages));
        setTotalItems(result.meta.total);
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
        setAppendedItems([]);
        setTotalItems(0);
      } finally {
        setLoading(false);
        setAutoLoadingNextPage(false);
      }
    };

    void loadResults();
  }, [
    q,
    categorySlug,
    subcategoryId,
    condition,
    minPrice,
    maxPrice,
    countryId,
    cityId,
    sort,
    featuredOnly,
    page,
  ]);

  const mappedInfiniteListings = useMemo(() => appendedItems.map(mapListing), [appendedItems]);
  const hasMorePages = page < totalPages;

  const mapPoints = useMemo<MapPoint[]>(
    () =>
      mappedInfiniteListings.map((listing) => {
        const position = pinPositionFromId(listing.id);
        return {
          ...listing,
          x: position.x,
          y: position.y,
        };
      }),
    [mappedInfiniteListings],
  );

  const mapClusters = useMemo<MapCluster[]>(() => {
    const bucket = new Map<string, MapCluster>();
    mapPoints.forEach((point) => {
      const xCell = Math.floor(point.x / 12);
      const yCell = Math.floor(point.y / 12);
      const key = `${xCell}-${yCell}`;
      const existing = bucket.get(key);
      if (existing) {
        existing.points.push(point);
        return;
      }
      bucket.set(key, {
        key,
        x: point.x,
        y: point.y,
        points: [point],
      });
    });
    return Array.from(bucket.values());
  }, [mapPoints]);

  const selectedMapPoint = useMemo(() => {
    if (selectedMapPointId == null) return null;
    return mapPoints.find((point) => point.id === selectedMapPointId) ?? null;
  }, [mapPoints, selectedMapPointId]);

  const openListing = (id: number | string) => {
    const parsed = Number(id);
    if (Number.isInteger(parsed) && parsed > 0) {
      addRecentlyViewedListingId(parsed);
    }
    navigate(`/listings/${id}`);
  };

  useEffect(() => {
    if (viewMode !== 'map') return;
    if (mapPoints.length === 0) {
      setSelectedMapPointId(null);
      return;
    }

    if (selectedMapPointId == null) {
      setSelectedMapPointId(mapPoints[0].id);
      return;
    }

    const stillExists = mapPoints.some((point) => point.id === selectedMapPointId);
    if (!stillExists) {
      setSelectedMapPointId(mapPoints[0].id);
    }
  }, [mapPoints, selectedMapPointId, viewMode]);

  useEffect(() => {
    if (viewMode !== 'list') return;
    if (!hasMorePages) return;
    if (!infiniteTriggerRef.current) return;

    const target = infiniteTriggerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (loading || autoLoadingNextPage) return;

        setAutoLoadingNextPage(true);
        setParam('page', String(Math.min(totalPages, page + 1)));
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0.1,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [autoLoadingNextPage, hasMorePages, loading, page, totalPages, viewMode]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-ink">{pick('نتائج البحث', 'Search Results')}</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void handleNearMe()} isLoading={nearMeLoading}>
              {nearMeLoading ? pick('جارٍ التحديد...', 'Locating...') : pick('بالقرب مني', 'Near Me')}
            </Button>
            <Button variant="ghost" onClick={clearFilters}>
              {pick('تصفير الفلاتر', 'Clear Filters')}
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Tabs
            activeKey={viewMode}
            onChange={(key) => setParam('view', key as ViewMode)}
            items={[
              {
                key: 'list',
                label: pick('عرض القائمة', 'List View'),
                icon: <span className="material-symbols-outlined text-base">view_list</span>,
              },
              {
                key: 'map',
                label: pick('عرض الخريطة', 'Map View'),
                icon: <span className="material-symbols-outlined text-base">map</span>,
              },
            ]}
          />
        </div>

        <p className="mt-2 text-sm text-muted">
          {pick('عدد النتائج', 'Results')}: {totalItems}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:hidden">
          <input
            value={q}
            onChange={(event) => setParam('q', event.target.value)}
            placeholder={pick('بحث بالكلمات', 'Keyword')}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <select
            value={categorySlug}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set('category', event.target.value);
              else next.delete('category');
              next.delete('subcategory');
              next.set('page', '1');
              setSearchParams(next);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">{pick('كل الفئات', 'All Categories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setParam('sort', event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="newest">{pick('الأحدث', 'Newest')}</option>
            <option value="featured">{pick('المميزة', 'Featured')}</option>
            <option value="price_asc">{pick('السعر: الأقل أولًا', 'Price: Low to High')}</option>
            <option value="price_desc">{pick('السعر: الأعلى أولًا', 'Price: High to Low')}</option>
          </select>
          <select
            value={condition}
            onChange={(event) => setParam('condition', event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="all">{pick('كل الحالات', 'All Conditions')}</option>
            <option value="NEW">{pick('جديد', 'New')}</option>
            <option value="USED">{pick('مستعمل', 'Used')}</option>
          </select>
          <select
            value={countryId}
            onChange={(event) => applyCountryFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">{pick('كل الدول', 'All Countries')}</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
          <select
            value={cityId}
            onChange={(event) => setParam('cityId', event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            disabled={!countryId}
          >
            <option value="">{pick('كل المدن', 'All Cities')}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(event) => setParam('minPrice', event.target.value)}
            placeholder={pick('السعر من', 'Min Price')}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(event) => setParam('maxPrice', event.target.value)}
            placeholder={pick('السعر إلى', 'Max Price')}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(event) => setParam('featured', event.target.checked ? '1' : '')}
            />
            {pick('إعلانات مميزة فقط', 'Featured only')}
          </label>
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
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set('category', event.target.value);
                else next.delete('category');
                next.delete('subcategory');
                next.set('page', '1');
                setSearchParams(next);
              }}
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
            <span className="text-sm text-muted">{pick('الفئة الفرعية', 'Subcategory')}</span>
            <select
              value={subcategoryId}
              onChange={(event) => setParam('subcategory', event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              disabled={!categorySlug}
            >
              <option value="">{pick('كل الفئات الفرعية', 'All Subcategories')}</option>
              {subcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
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

          <label className="block space-y-2">
            <span className="text-sm text-muted">{pick('ترتيب النتائج', 'Sort')}</span>
            <select
              value={sort}
              onChange={(event) => setParam('sort', event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="newest">{pick('الأحدث', 'Newest')}</option>
              <option value="featured">{pick('المميزة', 'Featured')}</option>
              <option value="price_asc">{pick('السعر: الأقل أولًا', 'Price: Low to High')}</option>
              <option value="price_desc">{pick('السعر: الأعلى أولًا', 'Price: High to Low')}</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(event) => setParam('featured', event.target.checked ? '1' : '')}
            />
            {pick('إعلانات مميزة فقط', 'Featured only')}
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
              onChange={(event) => applyCountryFilter(event.target.value)}
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
            <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
              <div className="relative h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eff6ff_35%,#f8fafc_100%)]" />
                <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] [background-size:36px_36px]" />

                {mapClusters.map((cluster) => {
                  const isSingle = cluster.points.length === 1;
                  const primaryPoint = cluster.points[0];
                  const isSelected = isSingle && selectedMapPointId === primaryPoint.id;

                  return (
                    <button
                      key={cluster.key}
                      type="button"
                      onClick={() => {
                        setSelectedMapPointId(primaryPoint.id);
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border text-xs font-bold shadow transition ${
                        isSingle
                          ? isSelected
                            ? 'border-primary bg-primary text-white'
                            : 'border-blue-200 bg-white text-primary hover:bg-blue-50'
                          : 'border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}
                      style={{ left: `${cluster.x}%`, top: `${cluster.y}%`, width: isSingle ? '30px' : '38px', height: isSingle ? '30px' : '38px' }}
                      aria-label={isSingle ? primaryPoint.title : `${cluster.points.length} listings`}
                    >
                      {isSingle ? <span className="material-symbols-outlined text-sm">location_on</span> : cluster.points.length}
                    </button>
                  );
                })}

                {selectedMapPoint ? (
                  <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-slate-200 bg-white p-3 shadow-md">
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedMapPoint.imageUrl || 'https://picsum.photos/seed/souqly-map-fallback/120/90'}
                        alt=""
                        className="h-16 w-20 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{selectedMapPoint.title}</p>
                        <p className="text-xs text-muted">{selectedMapPoint.location}</p>
                        <p className="text-sm font-bold text-primary">
                          {new Intl.NumberFormat(locale, {
                            style: 'currency',
                            currency: selectedMapPoint.currency,
                            maximumFractionDigits: 0,
                          }).format(selectedMapPoint.price)}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => openListing(selectedMapPoint.id)}>
                        {pick('عرض', 'Open')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="h-[560px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
                <h3 className="mb-3 text-sm font-bold text-ink">{pick('نتائج على الخريطة', 'Map Results')}</h3>
                <div className="space-y-2">
                  {mapPoints.map((point) => (
                    <button
                      key={`map-side-${point.id}`}
                      type="button"
                      onClick={() => setSelectedMapPointId(point.id)}
                      className={`w-full rounded-xl border p-2 text-start transition ${selectedMapPointId === point.id ? 'border-primary bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <p className="truncate text-sm font-semibold text-ink">{point.title}</p>
                      <p className="text-xs text-muted">{point.location}</p>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          ) : null}

          {viewMode === 'list' && loading && page === 1 ? (
            <ListingGridSkeleton />
          ) : viewMode === 'list' && mappedInfiniteListings.length === 0 ? (
            <EmptyState
              title={pick('لا توجد نتائج', 'No Results')}
              description={pick('لا توجد إعلانات مطابقة للفلاتر الحالية.', 'No listings match the active filters.')}
            />
          ) : viewMode === 'list' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {mappedInfiniteListings.map((listing) => (
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
                  onOpen={openListing}
                  onToggleFavorite={(id, nextState) =>
                    setFavorites((prev) => (nextState ? [...prev, id] : prev.filter((favId) => favId !== id)))
                  }
                />
              ))}
            </div>
          ) : null}

          {errorMessage ? (
            <ErrorStatePanel
              title={pick('حدث خطأ في تحميل النتائج', 'Failed to load results')}
              message={errorMessage}
              action={(
                <Button variant="secondary" onClick={() => setParam('page', String(page))}>
                  {pick('إعادة المحاولة', 'Retry')}
                </Button>
              )}
            />
          ) : null}

          {viewMode === 'list' ? <div ref={infiniteTriggerRef} className="h-1 w-full" aria-hidden /> : null}

          {viewMode === 'list' && hasMorePages ? (
            <div className="flex items-center justify-center">
              <Button
                variant="secondary"
                onClick={() => {
                  setAutoLoadingNextPage(true);
                  setParam('page', String(Math.min(totalPages, page + 1)));
                }}
                isLoading={loading || autoLoadingNextPage}
                disabled={loading || autoLoadingNextPage}
              >
                {loading || autoLoadingNextPage ? pick('جارٍ التحميل...', 'Loading...') : pick('تحميل المزيد', 'Load More')}
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
