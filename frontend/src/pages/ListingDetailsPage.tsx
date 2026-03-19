import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { SellerCard } from '../components/SellerCard';
import { EmptyState } from '../components/EmptyState';
import { Button, Input, Modal } from '../components/ui';
import { listingsService } from '../services/listings.service';
import { chatsService } from '../services/chats.service';
import { reportsService } from '../services/reports.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { DeliveryMethod, ListingDetails, ListingSummary, ReportReason } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';
import { addRecentlyViewedListingId } from '../utils/recentlyViewed';

function toCardListing(listing: ListingSummary) {
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

function getSellerProfilePath(listing: ListingDetails): string {
  if (listing.seller.accountType === 'STORE') {
    return `/stores/${listing.seller.id}`;
  }
  if (listing.seller.accountType === 'CRAFTSMAN') {
    return `/craftsmen/${listing.seller.id}`;
  }
  return `/users/${listing.seller.id}`;
}

function getResponseTimeLabel(hours: number | null, pick: (ar: string, en: string) => string): string {
  if (hours === null) {
    return pick('غير متوفر', 'Not available');
  }
  if (hours < 1) {
    return pick('أقل من ساعة', 'Less than 1 hour');
  }
  if (hours === 1) {
    return pick('خلال ساعة', 'Within 1 hour');
  }
  return pick(`خلال ${hours} ساعات`, `Within ${hours} hours`);
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
  const [requestPhoneOpen, setRequestPhoneOpen] = useState(false);
  const [sendOfferOpen, setSendOfferOpen] = useState(false);
  const [phoneRequestNote, setPhoneRequestNote] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('FRAUD');
  const [reportDescription, setReportDescription] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  const [dealQuantity, setDealQuantity] = useState('1');
  const [dealMeetingPlace, setDealMeetingPlace] = useState('');
  const [dealDeliveryMethod, setDealDeliveryMethod] = useState<DeliveryMethod>('PICKUP');
  const [dealError, setDealError] = useState('');

  const listingId = Number(id);

  useEffect(() => {
    if (Number.isInteger(listingId) && listingId > 0) {
      addRecentlyViewedListingId(listingId);
    }
  }, [listingId]);

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

  const handleRequestPhone = async (requestMessage?: string) => {
    if (!listing) return;
    if (handleRequireAuth()) return;

    try {
      const nextThreadId = await ensureThread();
      if (!nextThreadId) return;
      await chatsService.requestPhone(
        nextThreadId,
        requestMessage || pick('يرجى مشاركة رقم الهاتف.', 'Please share your phone number.'),
      );
      setActionMessage(pick('تم إرسال طلب رقم الهاتف.', 'Phone request sent.'));
      setRequestPhoneOpen(false);
      setPhoneRequestNote('');
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
      setSendOfferOpen(false);
    } catch (error) {
      setActionMessage(asHttpError(error).message);
    }
  };

  const handleReportListing = async () => {
    if (!listing) return;
    if (handleRequireAuth()) return;

    try {
      await reportsService.create({
        reportableType: 'LISTING',
        reportableId: listing.id,
        listingId: listing.id,
        reason: reportReason,
        description: reportDescription.trim() || undefined,
      });
      setReportOpen(false);
      setReportDescription('');
      setActionMessage(pick('تم إرسال البلاغ للإدارة.', 'Report was submitted successfully.'));
    } catch (error) {
      setActionMessage(asHttpError(error).message);
    }
  };

  const handleCreateDealIntent = async () => {
    if (!listing) return;
    if (handleRequireAuth()) return;

    const parsedAmount = Number(dealAmount);
    const parsedQuantity = Number(dealQuantity);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setDealError(pick('قيمة الصفقة غير صالحة.', 'Deal amount is invalid.'));
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setDealError(pick('الكمية يجب أن تكون أكبر من صفر.', 'Quantity must be greater than zero.'));
      return;
    }

    setDealError('');

    try {
      const nextThreadId = await ensureThread();
      if (!nextThreadId) return;

      const dealContext = [
        `${pick('طلب صفقة', 'Deal request')}`,
        `${pick('طريقة التسليم', 'Delivery method')}: ${dealDeliveryMethod}`,
        dealMeetingPlace.trim().length > 0 ? `${pick('مكان اللقاء', 'Meeting place')}: ${dealMeetingPlace.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      await chatsService.createOffer(nextThreadId, {
        amount: parsedAmount,
        quantity: parsedQuantity,
        message: dealContext,
      });

      setCreateDealOpen(false);
      setDealAmount('');
      setDealQuantity('1');
      setDealMeetingPlace('');
      setDealDeliveryMethod('PICKUP');
      setActionMessage(
        pick(
          'تم إرسال عرض الصفقة. بعد قبول العرض سيتم إنشاء Deal رسميًا.',
          'Deal offer was sent. The formal deal will be created after seller acceptance.',
        ),
      );
    } catch (error) {
      setActionMessage(asHttpError(error).message);
    }
  };

  const images = listing?.images ?? [];
  const attributes = listing?.attributes ?? [];

  const cardListings = useMemo(() => similarListings.map(toCardListing), [similarListings]);

  const openListing = (id: number | string) => {
    const parsed = Number(id);
    if (Number.isInteger(parsed) && parsed > 0) {
      addRecentlyViewedListingId(parsed);
    }
    navigate(`/listings/${id}`);
  };

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
                  currency: listing.currency ?? 'USD',
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
            onRequestPhone={() => setRequestPhoneOpen(true)}
            onSendOffer={() => setSendOfferOpen(true)}
            onWhatsApp={() => {
              if (handleRequireAuth()) return;
              window.open('https://wa.me', '_blank', 'noopener,noreferrer');
            }}
          />
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{listing.seller.name}</p>
                <p className="text-xs text-muted">
                  {listing.seller.accountType} · {getResponseTimeLabel(listing.seller.avgResponseHours, pick)}
                </p>
              </div>
              <Button variant="secondary" onClick={() => navigate(getSellerProfilePath(listing))}>
                {pick('عرض الملف العام', 'View Profile')}
              </Button>
            </div>
            {listing.contact.whatsappNumber ? (
              <div className="mt-3">
                <Button
                  onClick={() => window.open(`https://wa.me/${listing.contact.whatsappNumber?.replace(/[^\d]/g, '')}`, '_blank', 'noopener,noreferrer')}
                >
                  WhatsApp
                </Button>
              </div>
            ) : null}
          </section>
          {actionMessage ? <p className="text-sm text-emerald-700">{actionMessage}</p> : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <h3 className="text-sm font-bold text-ink">{pick('إجراءات إضافية', 'Additional Actions')}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setCreateDealOpen(true)}>
                {pick('إنشاء صفقة', 'Create Deal')}
              </Button>
              <Button variant="ghost" onClick={() => setReportOpen(true)}>
                {pick('الإبلاغ عن الإعلان', 'Report Listing')}
              </Button>
            </div>
          </section>
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
                onOpen={openListing}
              />
            ))}
          </div>
        )}
      </section>

      <Modal
        isOpen={requestPhoneOpen}
        onClose={() => setRequestPhoneOpen(false)}
        title={pick('طلب رقم الهاتف', 'Request Phone Number')}
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setRequestPhoneOpen(false)}>
              {pick('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={() => void handleRequestPhone(phoneRequestNote)}>
              {pick('إرسال الطلب', 'Send Request')}
            </Button>
          </div>
        )}
      >
        <p className="mb-3 text-sm text-muted">
          {pick(
            'يمكنك إضافة رسالة قصيرة توضح سبب طلب الرقم.',
            'You can include a short note explaining why you need the phone number.',
          )}
        </p>
        <textarea
          value={phoneRequestNote}
          onChange={(event) => setPhoneRequestNote(event.target.value)}
          placeholder={pick('مثال: أريد تأكيد موقع الاستلام قبل الشراء', 'Example: I want to confirm pickup location before purchase')}
          className="min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary"
        />
      </Modal>

      <Modal
        isOpen={sendOfferOpen}
        onClose={() => setSendOfferOpen(false)}
        title={pick('إرسال عرض سعر', 'Send Offer')}
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setSendOfferOpen(false)}>
              {pick('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={() => void handleSendOffer()}>
              {pick('إرسال العرض', 'Send Offer')}
            </Button>
          </div>
        )}
      >
        <div className="space-y-2">
          <Input
            type="number"
            min={1}
            value={offerValue}
            onChange={(event) => setOfferValue(event.target.value)}
            label={pick('قيمة العرض', 'Offer amount')}
            placeholder={pick('أدخل السعر المقترح', 'Enter your proposed price')}
            error={offerError || undefined}
          />
          {listing ? (
            <p className="text-xs text-muted">
              {pick('السعر الحالي', 'Current price')}: {new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: listing.currency ?? 'USD',
                maximumFractionDigits: 0,
              }).format(listing.priceAmount ?? 0)}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        title={pick('الإبلاغ عن الإعلان', 'Report Listing')}
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              {pick('إلغاء', 'Cancel')}
            </Button>
            <Button variant="danger" onClick={() => void handleReportListing()}>
              {pick('إرسال البلاغ', 'Submit Report')}
            </Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-ink">{pick('سبب البلاغ', 'Reason')}</span>
            <select
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value as ReportReason)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="FRAUD">FRAUD</option>
              <option value="INAPPROPRIATE">INAPPROPRIATE</option>
              <option value="DUPLICATE">DUPLICATE</option>
              <option value="SPAM">SPAM</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-ink">{pick('تفاصيل إضافية', 'Additional details')}</span>
            <textarea
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              placeholder={pick('اشرح المشكلة باختصار', 'Explain the issue briefly')}
              className="min-h-28 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={createDealOpen}
        onClose={() => setCreateDealOpen(false)}
        title={pick('إنشاء صفقة', 'Create Deal')}
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateDealOpen(false)}>
              {pick('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={() => void handleCreateDealIntent()}>
              {pick('إرسال طلب الصفقة', 'Submit Deal Request')}
            </Button>
          </div>
        )}
      >
        <div className="grid gap-3">
          <Input
            type="number"
            min={1}
            value={dealAmount}
            onChange={(event) => setDealAmount(event.target.value)}
            label={pick('السعر النهائي المقترح', 'Proposed final price')}
            placeholder={pick('أدخل السعر', 'Enter amount')}
          />

          <Input
            type="number"
            min={1}
            value={dealQuantity}
            onChange={(event) => setDealQuantity(event.target.value)}
            label={pick('الكمية', 'Quantity')}
          />

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-ink">{pick('طريقة التسليم', 'Delivery method')}</span>
            <select
              value={dealDeliveryMethod}
              onChange={(event) => setDealDeliveryMethod(event.target.value as DeliveryMethod)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="PICKUP">{pick('استلام مباشر', 'Pickup')}</option>
              <option value="COURIER">{pick('شركة شحن', 'Courier')}</option>
            </select>
          </label>

          <Input
            value={dealMeetingPlace}
            onChange={(event) => setDealMeetingPlace(event.target.value)}
            label={pick('مكان اللقاء (اختياري)', 'Meeting place (optional)')}
            placeholder={pick('مثال: مول المدينة - البوابة 2', 'Example: City Mall - Gate 2')}
          />

          {dealError ? <p className="text-xs text-red-600">{dealError}</p> : null}
          <p className="text-xs text-muted">
            {pick(
              'ملاحظة: في هذا الإصدار يتم بدء الصفقة عبر إرسال Offer منظم داخل المحادثة، وتُنشأ Deal رسميًا بعد القبول.',
              'Note: in this version, deal flow starts by sending a structured offer in chat, and the formal deal is created after acceptance.',
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
}
