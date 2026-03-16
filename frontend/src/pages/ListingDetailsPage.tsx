import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { chatsService } from '../services/chats.service';
import { listingsService } from '../services/listings.service';
import { preferencesService } from '../services/preferences.service';
import { reportsService } from '../services/reports.service';
import { asHttpError } from '../services/http';
import type { ListingDetails, ReportReason } from '../types/domain';
import { formatDate, formatMoney } from '../utils/format';
import { useAuthStore } from '../store/authStore';

export function ListingDetailsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const listingId = Number(params.id);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [listing, setListing] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>('FRAUD');
  const [reportDescription, setReportDescription] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const listingJsonLd = useMemo(() => {
    if (!listing) {
      return null;
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listing.title,
      description: listing.description,
      sku: `souqly-listing-${listing.id}`,
      image: listing.images.map((item) => item.url),
      offers: {
        '@type': 'Offer',
        priceCurrency: listing.currency ?? 'USD',
        price: listing.priceAmount ?? 0,
        availability: listing.status === 'ACTIVE' ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability',
      },
      areaServed: `${listing.country.name}, ${listing.city.name}`,
    };
  }, [listing]);

  useEffect(() => {
    const loadListing = async () => {
      if (!Number.isFinite(listingId) || listingId <= 0) {
        setError('Invalid listing id.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await listingsService.details(listingId);
        setListing(result);
      } catch (err) {
        setError(asHttpError(err).message);
      } finally {
        setLoading(false);
      }
    };

    void loadListing();
  }, [listingId]);

  const handleAddFavorite = async () => {
    if (!listing) return;
    try {
      await preferencesService.addFavorite(listing.id);
      setActionMessage('Listing was added to favorites.');
    } catch (err) {
      setActionMessage(asHttpError(err).message);
    }
  };

  const handleMessageSeller = async () => {
    if (!listing) return;
    try {
      const result = await chatsService.createOrGetThread(listing.id);
      navigate(`/chats?thread=${result.thread.id}`);
    } catch (err) {
      setActionMessage(asHttpError(err).message);
    }
  };

  const handleReport = async () => {
    if (!listing) return;
    try {
      await reportsService.create({
        reportableType: 'LISTING',
        reportableId: listing.id,
        reason: reportReason,
        description: reportDescription || undefined,
      });
      setActionMessage('Report submitted successfully.');
      setReportDescription('');
    } catch (err) {
      setActionMessage(asHttpError(err).message);
    }
  };

  if (loading) {
    return <p className="muted-text">Loading listing...</p>;
  }

  if (error || !listing) {
    return (
      <div className="card">
        <p className="error-text">{error ?? 'Listing not found.'}</p>
        <Link to="/" className="button button--secondary">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="stack">
      {listingJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(listingJsonLd) }}
        />
      ) : null}

      <section className="card">
        <h1 className="page-title">{listing.title}</h1>
        <p className="page-subtitle">
          {listing.country.name} / {listing.city.name} • {formatDate(listing.createdAt)}
        </p>
        <p>{listing.description}</p>
        <p>
          <strong>Price:</strong> {formatMoney(listing.priceAmount, listing.currency)}
        </p>
        <p>
          <strong>Status:</strong> {listing.status} • <strong>Condition:</strong>{' '}
          {listing.condition ?? 'N/A'}
        </p>
        <p>
          <strong>Featured:</strong> {listing.isFeatured ? `Yes (until ${formatDate(listing.featuredUntil)})` : 'No'}
        </p>
        <p>
          <strong>Contact visibility:</strong> Phone: {listing.contact.phoneVisible ? 'Visible' : 'Hidden'} / WhatsApp:{' '}
          {listing.contact.whatsappVisible ? 'Visible' : 'Hidden'}
        </p>
      </section>

      <section className="card">
        <h2>Images</h2>
        <div className="grid grid--3">
          {listing.images.length > 0 ? (
            listing.images.map((image) => (
              <a key={`${image.url}-${image.sortOrder}`} href={image.url} target="_blank" rel="noreferrer">
                {image.url}
              </a>
            ))
          ) : (
            <p className="muted-text">No images.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Attributes</h2>
        <div className="list">
          {listing.attributes.length > 0 ? (
            listing.attributes.map((attribute) => (
              <div key={attribute.attributeId} className="row">
                <div className="row__title">{attribute.name}</div>
                <div>{attribute.value}</div>
              </div>
            ))
          ) : (
            <p className="muted-text">No custom attributes.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Actions</h2>
        {!isAuthenticated ? <p className="muted-text">Login to favorite, chat, or report this listing.</p> : null}

        {isAuthenticated ? (
          <>
            <div className="button-row">
              <button type="button" className="button button--primary" onClick={handleAddFavorite}>
                Add to favorites
              </button>
              <button type="button" className="button button--secondary" onClick={handleMessageSeller}>
                Message seller
              </button>
            </div>

            <div className="grid grid--2" style={{ marginTop: '0.85rem' }}>
              <label className="field">
                <span className="label">Report reason</span>
                <select
                  className="select"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value as ReportReason)}
                >
                  <option value="FRAUD">FRAUD</option>
                  <option value="INAPPROPRIATE">INAPPROPRIATE</option>
                  <option value="DUPLICATE">DUPLICATE</option>
                  <option value="SPAM">SPAM</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Description (optional)</span>
                <input
                  className="input"
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value)}
                />
              </label>
            </div>

            <div className="button-row">
              <button type="button" className="button button--danger" onClick={handleReport}>
                Submit report
              </button>
            </div>
          </>
        ) : null}

        {actionMessage ? <p className="muted-text">{actionMessage}</p> : null}
      </section>
    </div>
  );
}
