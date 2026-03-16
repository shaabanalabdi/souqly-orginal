import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { asHttpError } from '../services/http';
import { categoriesService } from '../services/categories.service';
import { geoService } from '../services/geo.service';
import { listingsService } from '../services/listings.service';
import type { Category, Country, ListingSummary, Subcategory } from '../types/domain';
import type { PaginationMeta } from '../types/api';
import { formatDate, formatMoney } from '../utils/format';

interface FiltersState {
  q: string;
  categorySlug: string;
  subcategoryId: string;
  countryId: string;
  cityId: string;
  minPrice: string;
  maxPrice: string;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'featured';
  featuredOnly: boolean;
}

const initialFilters: FiltersState = {
  q: '',
  categorySlug: '',
  subcategoryId: '',
  countryId: '',
  cityId: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
  featuredOnly: false,
};

export function HomePage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<Array<{ id: number; name: string }>>([]);
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCountryCode = useMemo(() => {
    const countryId = Number(filters.countryId);
    if (!countryId) return '';
    return countries.find((country) => country.id === countryId)?.code ?? '';
  }, [countries, filters.countryId]);

  const loadListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listingsService.list({
        q: filters.q || undefined,
        categorySlug: filters.categorySlug || undefined,
        subcategoryId: filters.subcategoryId ? Number(filters.subcategoryId) : undefined,
        countryId: filters.countryId ? Number(filters.countryId) : undefined,
        cityId: filters.cityId ? Number(filters.cityId) : undefined,
        minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        sort: filters.sort,
        featuredOnly: filters.featuredOnly || undefined,
      });
      setListings(result.items);
      setMeta(result.meta);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
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
        setCountries(countriesResult);
      } catch (err) {
        setError(asHttpError(err).message);
      }
    };

    void loadStatic();
    void loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filters.categorySlug) {
      setSubcategories([]);
      setFilters((prev) => ({ ...prev, subcategoryId: '' }));
      return;
    }

    const loadSubcategories = async () => {
      try {
        const result = await categoriesService.listSubcategories(filters.categorySlug);
        setSubcategories(result.subcategories);
      } catch (err) {
        setError(asHttpError(err).message);
      }
    };

    void loadSubcategories();
  }, [filters.categorySlug]);

  useEffect(() => {
    if (!selectedCountryCode) {
      setCities([]);
      setFilters((prev) => ({ ...prev, cityId: '' }));
      return;
    }

    const loadCities = async () => {
      try {
        const result = await geoService.listCountryCities(selectedCountryCode);
        setCities(result.cities);
      } catch (err) {
        setError(asHttpError(err).message);
      }
    };

    void loadCities();
  }, [selectedCountryCode]);

  return (
    <div className="stack">
      <section className="hero">
        <h1 className="page-title">{t('home.title')}</h1>
        <p className="page-subtitle">
          {t('home.subtitle')}
        </p>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>{t('home.searchListings')}</h2>
          <button type="button" className="button button--secondary" onClick={loadListings} disabled={loading}>
            {t('home.refresh')}
          </button>
        </div>

        <div className="grid grid--3">
          <label className="field">
            <span className="label">{t('home.keyword')}</span>
            <input
              className="input"
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder={t('home.keywordPlaceholder')}
            />
          </label>

          <label className="field">
            <span className="label">{t('home.category')}</span>
            <select
              className="select"
              value={filters.categorySlug}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, categorySlug: event.target.value, subcategoryId: '' }))
              }
            >
              <option value="">{t('home.allCategories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">{t('home.subcategory')}</span>
            <select
              className="select"
              value={filters.subcategoryId}
              onChange={(event) => setFilters((prev) => ({ ...prev, subcategoryId: event.target.value }))}
              disabled={subcategories.length === 0}
            >
              <option value="">{t('home.allSubcategories')}</option>
              {subcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">{t('home.country')}</span>
            <select
              className="select"
              value={filters.countryId}
              onChange={(event) => setFilters((prev) => ({ ...prev, countryId: event.target.value, cityId: '' }))}
            >
              <option value="">{t('home.allCountries')}</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">{t('home.city')}</span>
            <select
              className="select"
              value={filters.cityId}
              onChange={(event) => setFilters((prev) => ({ ...prev, cityId: event.target.value }))}
              disabled={cities.length === 0}
            >
              <option value="">{t('home.allCities')}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">{t('home.minPrice')}</span>
            <input
              className="input"
              type="number"
              min={0}
              value={filters.minPrice}
              onChange={(event) => setFilters((prev) => ({ ...prev, minPrice: event.target.value }))}
            />
          </label>

          <label className="field">
            <span className="label">{t('home.maxPrice')}</span>
            <input
              className="input"
              type="number"
              min={0}
              value={filters.maxPrice}
              onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
            />
          </label>

          <label className="field">
            <span className="label">{t('home.sort')}</span>
            <select
              className="select"
              value={filters.sort}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, sort: event.target.value as FiltersState['sort'] }))
              }
            >
              <option value="newest">{t('home.sortNewest')}</option>
              <option value="featured">{t('home.sortFeatured')}</option>
              <option value="price_asc">{t('home.sortPriceAsc')}</option>
              <option value="price_desc">{t('home.sortPriceDesc')}</option>
            </select>
          </label>

          <label className="field">
            <span className="label">{t('home.featuredOnly')}</span>
            <select
              className="select"
              value={filters.featuredOnly ? 'true' : 'false'}
              onChange={(event) => setFilters((prev) => ({ ...prev, featuredOnly: event.target.value === 'true' }))}
            >
              <option value="false">{t('home.no')}</option>
              <option value="true">{t('home.yes')}</option>
            </select>
          </label>
        </div>

        <div className="button-row">
          <button type="button" className="button button--primary" onClick={loadListings} disabled={loading}>
            {loading ? t('home.searching') : t('home.search')}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              setFilters(initialFilters);
              setSubcategories([]);
              setCities([]);
            }}
          >
            {t('home.clear')}
          </button>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="card">
        <div className="card__header">
          <h2>{t('home.results')}</h2>
          <span className="muted-text">
            {meta ? t('home.itemsCount', { count: meta.total }) : t('home.itemsCount', { count: listings.length })}
          </span>
        </div>

        <div className="list">
          {listings.map((listing) => (
            <article key={listing.id} className="row">
              <div className="row__title">
                <Link to={`/listings/${listing.id}`}>
                  {listing.title}
                  {listing.isFeatured ? t('home.featuredLabel') : ''}
                </Link>
              </div>
              <p>{listing.description}</p>
              <div className="row__meta">
                {formatMoney(listing.priceAmount, listing.currency)} • {listing.country.name} /{' '}
                {listing.city.name} • {formatDate(listing.createdAt)}
              </div>
            </article>
          ))}
          {!loading && listings.length === 0 ? <p className="muted-text">{t('home.noActiveListings')}</p> : null}
        </div>
      </section>
    </div>
  );
}
