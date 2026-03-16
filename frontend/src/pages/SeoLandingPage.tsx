import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { asHttpError } from '../services/http';
import { categoriesService } from '../services/categories.service';
import { geoService } from '../services/geo.service';
import { listingsService } from '../services/listings.service';
import type { ListingSummary } from '../types/domain';
import { formatDate, formatMoney } from '../utils/format';

export function SeoLandingPage() {
  const { t } = useTranslation(['seo', 'home']);
  const params = useParams();
  const countryCode = (params.countryCode ?? '').toUpperCase();
  const cityId = Number(params.cityId);
  const categorySlug = params.categorySlug ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countryName, setCountryName] = useState('');
  const [countryId, setCountryId] = useState<number | null>(null);
  const [cityName, setCityName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [listings, setListings] = useState<ListingSummary[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!countryCode || !Number.isFinite(cityId) || cityId <= 0 || !categorySlug) {
        setError(t('seo:invalidRouteParams'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [geoResult, categories] = await Promise.all([
          geoService.listCountryCities(countryCode),
          categoriesService.listCategories(),
        ]);

        const city = geoResult.cities.find((item) => item.id === cityId);
        if (!city) {
          setError(t('seo:cityNotFound'));
          setLoading(false);
          return;
        }

        const category = categories.find((item) => item.slug === categorySlug);
        const selectedCategoryName = category?.name ?? categorySlug;

        const listingResult = await listingsService.list({
          page: 1,
          limit: 24,
          countryId: geoResult.country.id,
          cityId,
          categorySlug,
          sort: 'featured',
        });

        setCountryName(geoResult.country.name);
        setCountryId(geoResult.country.id);
        setCityName(city.name);
        setCategoryName(selectedCategoryName);
        setListings(listingResult.items);
      } catch (err) {
        setError(asHttpError(err).message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [categorySlug, cityId, countryCode, t]);

  const itemListJsonLd = useMemo(() => {
    if (listings.length === 0) {
      return null;
    }

    const baseUrl = window.location.origin;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${categoryName} in ${cityName}, ${countryName}`,
      numberOfItems: listings.length,
      itemListElement: listings.map((listing, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${baseUrl}/listings/${listing.id}`,
        name: listing.title,
      })),
    };
  }, [categoryName, cityName, countryName, listings]);

  if (loading) {
    return <p className="muted-text">{t('seo:loading')}</p>;
  }

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  return (
    <div className="stack">
      {itemListJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      ) : null}

      <section className="hero">
        <h1 className="page-title">{t('seo:title', { category: categoryName, city: cityName })}</h1>
        <p className="page-subtitle">
          {t('seo:subtitle', { category: categoryName, city: cityName, country: countryName })}
        </p>
        {countryId ? (
          <p className="muted-text">
            {t('seo:seoKey')} <code>{countryCode}-{cityId}-{categorySlug}</code>
          </p>
        ) : null}
      </section>

      <section className="card">
        <div className="card__header">
          <h2>{t('seo:listingsTitle')}</h2>
          <span className="muted-text">{t('home:itemsCount', { count: listings.length })}</span>
        </div>
        <div className="list">
          {listings.map((listing) => (
            <article key={listing.id} className="row">
              <div className="row__title">
                <Link to={`/listings/${listing.id}`}>
                  {listing.title}
                  {listing.isFeatured ? t('home:featuredLabel') : ''}
                </Link>
              </div>
              <p>{listing.description}</p>
              <div className="row__meta">
                {formatMoney(listing.priceAmount, listing.currency)} • {formatDate(listing.createdAt)}
              </div>
            </article>
          ))}
          {listings.length === 0 ? (
            <p className="muted-text">{t('seo:noListings')}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
