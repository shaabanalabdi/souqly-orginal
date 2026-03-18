import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { SellerCard } from '../components/SellerCard';
import { EmptyState } from '../components/EmptyState';
import { listingsService } from '../services/listings.service';
import { chatsService } from '../services/chats.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { ListingDetails, ListingSummary } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

function toCardListing(listing: ListingSummary) {
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

export function ListingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pick, locale } = useLocaleSwitch();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [listing, setListing] = useState<ListingDetails | null>(null);
  const [similarListings, setSimilarListings] = useState<ListingSummary[]>([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [offerValue, setOfferValue] = useState('');
  const [offerError, setOfferError] = useState('');
  const [threadId, setThreadId] = useState<number | null>(null);

  const listingId = Number(id);

  useEffect(() => {
    const loadDetails = async () => {
      if (!Number.isFinite(listingId) || listingId <= 0) {
        setErrorMessage(pick('رقم الإعلان غير صالح.', 'Invalid listing id.'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const result = await listingsService.details(listingId);
        setListing(result);
        setSelectedImage(result.images[0]?.url ?? '');

        const similar = await listingsService.list({
          subcategoryId: result.subcategory.id,
          withImages: true,
          limit: 8,
          sort: 'newest',
        });
        setSimilarListings(similar.items.filter((item) => item.id !== result.id).slice(0, 4));
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadDetails();
  }, [listingId, pick]);

  const ensureThread = async () => {
    if (!listing) return null;
    if (threadId) return threadId;
    const thread = await chatsService.createOrGetThread(listing.id);
    setThreadId(thread.thread.id);
    return thread.thread.id;
  };

  const handleRequireAuth = () => {
    if (isAuthenticated) return false;
    navigate(`/login?redirect=${encodeURIComponent(`/listings/${listingId}`)}`);
    return true;
  };

  const handleMessage = async () => {
    if (!listing) return;
    if (handleRequireAuth()) return;

    try {
      const nextThreadId = await ensureThread();
      if (nextThreadId) navigate(`/chats?thread=${nextThreadId}`);
    } catch (error) {
      setActionMessage(asHttpError(error).message);
    }
  };

  const handleRequestPhone = async () => {
    if (!listing) return;
    if (handleRequireAuth()) return;

    try {
      const nextThreadId = await ensureThread();
      if (!nextThreadId) return;
      await chatsService.requestPhone(nextThreadId, pick('يرجى مشاركة رقم الهاتف.', 'Please share your phone number.'));
      setActionMessage(pick('تم إرسال طلب رقم الهاتف.', 'Phone request sent.'));
    } catch (error) {
      setActionMessage(asHttpError(error).message);
    }
  };

  const handleSendOffer = async () => {
    if (!listing) return;
    if (handleRequireAuth()) return;

    const parsed = Number(offerValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setOfferError(pick('أدخل قيمة عرض صحيحة.', 'Enter a valid offer amount.'));
      return;
    }

    setOfferError('');
    try {
      const nextThreadId = await ensureThread();
      if (!nextThreadId) return;
      await chatsService.createOffer(nextThreadId, { amount: parsed, quantity: 1 });
      setOfferValue('');
      setActionMessage(pick('تم إرسال العرض بنجاح.', 'Offer sent successfully.'));
    } catch (error) {
      setActionMessage(asHttpError(error).message);
    }
  };

  const images = listing?.images ?? [];
  const attributes = listing?.attributes ?? [];

  const cardListings = useMemo(() => similarListings.map(toCardListing), [similarListings]);

  if (loading) {
    return <div className="space-y-4"><div className="h-72 animate-pulse rounded-2xl bg-slate-200" /></div>;
  }

  if (!listing) {
    return (
      <EmptyState
        title={pick('تعذر تحميل الإعلان', 'Failed to load listing')}
        description={errorMessage || pick('حاول مرة أخرى لاحقًا.', 'Please try again later.')}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            {selectedImage ? (
              <img src={selectedImage} alt={listing.title} className="h-[420px] w-full object-cover" />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-muted">
                {pick('لا توجد صور', 'No images available')}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3">
            {images.map((image) => (
              <button
                key={`${image.url}-${image.sortOrder}`}
                type="button"
                onClick={() => setSelectedImage(image.url)}
                className={`overflow-hidden rounded-xl border transition ${
                  selectedImage === image.url ? 'border-primary' : 'border-slate-200 hover:border-primary/40'
                }`}
              >
                <img src={image.url} alt="" className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
            <h1 className="text-2xl font-black text-ink">{listing.title}</h1>
            <div className="mt-3 flex items-center gap-2">
              <p className="text-3xl font-black text-primary">
                {new Intl.NumberFormat(locale, {
                  style: 'currency',
                  currency: listing.currency ?? 'SAR',
                  maximumFractionDigits: 0,
                }).format(listing.priceAmount ?? 0)}
              </p>
              {listing.negotiable ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                  {pick('قابل للتفاوض', 'Negotiable')}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-muted">{`${listing.country.name} - ${listing.city.name}`}</p>

            <dl className="mt-5 grid gap-2 rounded-xl bg-surface p-4">
              {attributes.length > 0 ? (
                attributes.map((attribute) => (
                  <div key={`${attribute.attributeId}-${attribute.name}`} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
                    <dt className="text-sm text-muted">{attribute.name}</dt>
                    <dd className="text-sm font-semibold text-ink">{attribute.value}</dd>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted">{pick('لا توجد خصائص إضافية.', 'No extra attributes.')}</div>
              )}
            </dl>

            <div className="mt-5 space-y-2">
              <h2 className="text-base font-bold text-ink">{pick('الوصف', 'Description')}</h2>
              <p className="text-sm leading-6 text-muted">{listing.description}</p>
            </div>

            <div className="mt-5 flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-muted">
              {listing.location.lat && listing.location.lng
                ? `${pick('الإحداثيات', 'Coordinates')}: ${listing.location.lat}, ${listing.location.lng}`
                : pick('خريطة الموقع ستظهر هنا', 'Location map will appear here')}
            </div>
          </article>
        </div>

        <div className="space-y-4">
          <SellerCard
            name={pick('البائع', 'Seller')}
            trustScore={listing.contact.phoneVisible || listing.contact.whatsappVisible ? 75 : 55}
            rating={4.5}
            reviewCount={41}
            responseTime={pick('خلال 10 دقائق', 'Within 10 minutes')}
            emailVerified={true}
            phoneVerified={listing.contact.phoneVisible}
            idVerified={false}
            labels={{
              responseTimeLabel: pick('زمن الرد', 'Response Time'),
              message: pick('مراسلة', 'Message'),
              requestPhone: pick('طلب الهاتف', 'Request Phone'),
              sendOffer: pick('إرسال عرض', 'Send Offer'),
              whatsApp: 'WhatsApp',
              ratingLabel: pick('التقييم', 'Rating'),
              trustScoreLabel: pick('درجة الثقة', 'Trust Score'),
            }}
            trustBadgeLabels={{
              email: pick('البريد موثق', 'Email Verified'),
              phone: pick('الهاتف موثق', 'Phone Verified'),
              id: pick('الهوية موثقة', 'ID Verified'),
              sectionLabel: pick('حالة التوثيق', 'Verification Status'),
            }}
            onMessage={() => void handleMessage()}
            onRequestPhone={() => void handleRequestPhone()}
            onSendOffer={() => void handleSendOffer()}
            onWhatsApp={() => {
              if (handleRequireAuth()) return;
              window.open('https://wa.me', '_blank', 'noopener,noreferrer');
            }}
          />

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <h3 className="text-sm font-bold text-ink">{pick('إرسال عرض سعر', 'Send an Offer')}</h3>
            <div className="mt-3 space-y-2">
              <input
                type="number"
                min={1}
                value={offerValue}
                onChange={(event) => setOfferValue(event.target.value)}
                placeholder={pick('قيمة العرض', 'Offer amount')}
                className={`h-11 w-full rounded-xl border px-3 text-sm outline-none ${
                  offerError ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'
                }`}
              />
              {offerError ? <p className="text-xs text-rose-600">{offerError}</p> : null}
              <button
                type="button"
                onClick={() => void handleSendOffer()}
                className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900"
              >
                {pick('إرسال', 'Submit')}
              </button>
            </div>
          </section>
          {actionMessage ? <p className="text-sm text-emerald-700">{actionMessage}</p> : null}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-ink">{pick('إعلانات مشابهة', 'Similar Listings')}</h2>
        {cardListings.length === 0 ? (
          <EmptyState
            title={pick('لا توجد إعلانات مشابهة', 'No Similar Listings')}
            description={pick('سيتم إضافة المزيد قريبًا.', 'More similar listings will be available soon.')}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cardListings.map((item) => (
              <ListingCard
                key={item.id}
                id={item.id}
                title={item.title}
                price={item.price}
                currency={item.currency}
                location={item.location}
                imageUrl={item.imageUrl}
                badge={item.badge}
                locale={locale}
                onOpen={(nextId) => navigate(`/listings/${nextId}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
