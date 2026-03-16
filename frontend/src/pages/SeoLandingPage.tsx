import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { asHttpError } from '../services/http';
import { categoriesService } from '../services/categories.service';
import { geoService } from '../services/geo.service';
import { listingsService } from '../services/listings.service';
import type { ListingSummary } from '../types/domain';
import { formatDate, formatMoney } from '../utils/format';

export function SeoLandingPage() {
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
        setError('Invalid SEO route parameters.');
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
          setError('City not found for this country.');
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
  }, [categorySlug, cityId, countryCode]);

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
    return <p className="muted-text">Loading SEO landing page...</p>;
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
        <h1 className="page-title">{categoryName} in {cityName}</h1>
        <p className="page-subtitle">
          Browse {categoryName} listings in {cityName}, {countryName}.
        </p>
        {countryId ? (
          <p className="muted-text">
            SEO key: <code>{countryCode}-{cityId}-{categorySlug}</code>
          </p>
        ) : null}
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Listings</h2>
          <span className="muted-text">{listings.length} items</span>
        </div>
        <div className="list">
          {listings.map((listing) => (
            <article key={listing.id} className="row">
              <div className="row__title">
                <Link to={`/listings/${listing.id}`}>
                  {listing.title}
                  {listing.isFeatured ? ' [FEATURED]' : ''}
                </Link>
              </div>
              <p>{listing.description}</p>
              <div className="row__meta">
                {formatMoney(listing.priceAmount, listing.currency)} • {formatDate(listing.createdAt)}
              </div>
            </article>
          ))}
          {listings.length === 0 ? (
            <p className="muted-text">No listings currently available for this landing page.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
