import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { Button, EmptyStatePanel, ErrorStatePanel, LoadingState } from '../components/ui';
import { craftsmanProfileService } from '../services/craftsmanProfile.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { CompactListingSummary, CraftsmanProfileDto, PublicCraftsmanProfileDto } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

function mapListing(listing: CompactListingSummary) {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.priceAmount ?? 0,
    currency: listing.currency ?? 'USD',
    location: 'Craftsman Services',
    imageUrl: listing.coverImage ?? undefined,
  };
}

function normalizeWhatsAppPhone(value: string): string {
  return value.replace(/[^\d]/g, '');
}

export function CraftsmanPage() {
  const navigate = useNavigate();
  const { id: craftsmanIdParam } = useParams<{ id: string }>();
  const { locale, pick } = useLocaleSwitch();
  const user = useAuthStore((state) => state.user);
  const [profile, setProfile] = useState<CraftsmanProfileDto | PublicCraftsmanProfileDto | null>(null);
  const [listings, setListings] = useState<CompactListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const craftsmanId = craftsmanIdParam ? Number(craftsmanIdParam) : user?.id;
        if (!craftsmanId || Number.isNaN(craftsmanId)) {
          throw new Error(pick('معرّف الحرفي غير متوفر.', 'Craftsman id is not available.'));
        }

        const profileRequest = craftsmanIdParam
          ? craftsmanProfileService.getPublicProfile(craftsmanId)
          : craftsmanProfileService.me();
        const listingsRequest = craftsmanProfileService.listPublicListings(craftsmanId, 1, 12);
        const [profileResult, listingsResult] = await Promise.all([profileRequest, listingsRequest]);

        if (!active) {
          return;
        }

        setProfile(profileResult);
        setListings(listingsResult.items);
      } catch (error) {
        if (active) {
          setErrorMessage(asHttpError(error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [craftsmanIdParam, user?.id, pick]);

  const mappedListings = useMemo(() => listings.map(mapListing), [listings]);
  const publicPhone = profile && 'phone' in profile ? profile.phone : user?.phone ?? null;
  const whatsappPhone = profile && 'whatsappPhone' in profile ? profile.whatsappPhone : user?.phone ?? null;

  const handleLeadContact = async (source: 'phone' | 'whatsapp') => {
    if (!craftsmanIdParam) {
      return;
    }

    try {
      await craftsmanProfileService.trackLead(Number(craftsmanIdParam), { source });
    } catch {
      // Best-effort tracking only.
    }
  };

  if (loading) {
    return <LoadingState text={pick('جارٍ تحميل صفحة الحرفي...', 'Loading craftsman page...')} />;
  }

  if (!profile) {
    return (
      <ErrorStatePanel
        title={pick('ملف الحرفي غير متوفر', 'Craftsman Profile Unavailable')}
        message={errorMessage || pick('تعذر العثور على الملف المطلوب.', 'The requested profile could not be found.')}
        action={(
          <Button variant="secondary" onClick={() => navigate('/search')}>
            {pick('العودة إلى البحث', 'Back to Search')}
          </Button>
        )}
      />
    );
  }

  return (
    <section className="space-y-5">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <img
              src="https://picsum.photos/seed/souqly-craftsman-avatar/140/140"
              alt=""
              className="size-20 rounded-full object-cover"
            />
            <div>
              <h1 className="text-2xl font-black text-ink">
                {'fullName' in profile && profile.fullName ? profile.fullName : profile.profession}
              </h1>
              <p className="text-sm font-medium text-primary">{profile.profession}</p>
              <p className="text-sm text-muted">
                {pick('الخبرة', 'Experience')}: {profile.experienceYears ?? pick('غير محدد', 'Not specified')}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                profile.availableNow ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {profile.availableNow ? pick('متاح الآن', 'Available now') : pick('غير متاح الآن', 'Unavailable now')}
            </span>

            {publicPhone ? (
              <a
                href={`tel:${publicPhone}`}
                onClick={() => {
                  void handleLeadContact('phone');
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                {pick('الهاتف', 'Phone')}: {publicPhone}
              </a>
            ) : (
              <span className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-sm font-semibold text-muted">
                {pick('الهاتف غير متاح بعد', 'Phone not available yet')}
              </span>
            )}

            {whatsappPhone ? (
              <a
                href={`https://wa.me/${normalizeWhatsAppPhone(whatsappPhone)}`}
                onClick={() => {
                  void handleLeadContact('whatsapp');
                }}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
              >
                WhatsApp
              </a>
            ) : (
              <span className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-center text-sm font-semibold text-muted">
                {pick('واتساب غير متاح بعد', 'WhatsApp not available yet')}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-muted">
          <p>{pick('ساعات العمل', 'Working Hours')}: {profile.workingHours ?? pick('غير متاح', 'N/A')}</p>
          <p>
            {pick('مناطق العمل', 'Working Areas')}: {profile.workingAreas.length > 0
              ? profile.workingAreas.join(', ')
              : pick('غير متاح', 'N/A')}
          </p>
          <p>
            {pick('التحقق', 'Verification')}: {profile.verifiedByAdmin
              ? pick('تم التحقق', 'Verified')
              : pick('قيد المراجعة أو غير موثق', 'Pending or not verified')}
          </p>
        </div>
      </article>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="mb-4 text-lg font-bold text-ink">{pick('معرض الأعمال', 'Portfolio')}</h2>
        {profile.portfolio.length === 0 ? (
          <EmptyStatePanel
            title={pick('لا يوجد معرض أعمال', 'No Portfolio Yet')}
            description={pick('سيظهر معرض الأعمال هنا عند إضافة عناصر جديدة.', 'Portfolio items will appear here once added.')}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {profile.portfolio.map((image) => (
              <article key={image} className="group overflow-hidden rounded-xl">
                <img
                  src={image}
                  alt=""
                  className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="mb-4 text-lg font-bold text-ink">{pick('إعلانات وخدمات الحرفي', 'Craftsman Listings')}</h2>
        {mappedListings.length === 0 ? (
          <EmptyStatePanel
            title={pick('لا توجد إعلانات حالية', 'No Active Listings')}
            description={pick('لا توجد خدمات منشورة حاليًا لهذا الحرفي.', 'There are no published services for this craftsman yet.')}
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
                locale={locale}
                onOpen={(listingId) => navigate(`/listings/${listingId}`)}
              />
            ))}
          </div>
        )}
        {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
      </section>
    </section>
  );
}
