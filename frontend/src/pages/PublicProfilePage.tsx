import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { TrustBadge } from '../components/TrustBadge';
import { TrustScore } from '../components/TrustScore';
import { Button, EmptyStatePanel, ErrorStatePanel, LoadingState, Tabs } from '../components/ui';
import { usersService } from '../services/users.service';
import { asHttpError } from '../services/http';
import type { PublicUserListing, PublicUserProfileDto, PublicUserReview } from '../types/domain';
import { formatDate } from '../utils/format';
import { useLocaleSwitch } from '../utils/localeSwitch';

type PublicProfileTab = 'listings' | 'reviews' | 'about';

function toListingCard(listing: PublicUserListing) {
  return {
    id: listing.id,
    title: listing.title,
    price: listing.priceAmount ?? 0,
    currency: listing.currency ?? 'USD',
    location: `${listing.countryName} - ${listing.cityName}`,
    imageUrl: listing.coverImage ?? undefined,
  };
}

export function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale, pick } = useLocaleSwitch();
  const [tab, setTab] = useState<PublicProfileTab>('listings');
  const [profile, setProfile] = useState<PublicUserProfileDto | null>(null);
  const [listings, setListings] = useState<PublicUserListing[]>([]);
  const [reviews, setReviews] = useState<PublicUserReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const userId = Number(id);
      if (!Number.isFinite(userId) || userId <= 0) {
        setErrorMessage(pick('معرّف المستخدم غير صالح.', 'Invalid user id.'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const [profileResult, listingsResult, reviewsResult] = await Promise.all([
          usersService.getPublicProfile(userId),
          usersService.listPublicListings(userId, 1, 12),
          usersService.listPublicReviews(userId, 1, 12),
        ]);

        if (!active) {
          return;
        }

        setProfile(profileResult);
        setListings(listingsResult.items);
        setReviews(reviewsResult.items);
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
  }, [id, pick]);

  const cardListings = useMemo(() => listings.map(toListingCard), [listings]);

  if (loading) {
    return <LoadingState text={pick('جارٍ تحميل الملف العام...', 'Loading public profile...')} />;
  }

  if (!profile) {
    return (
      <ErrorStatePanel
        title={pick('تعذر تحميل الملف العام', 'Failed to load public profile')}
        message={errorMessage || pick('الملف المطلوب غير متاح.', 'The requested profile is unavailable.')}
        action={(
          <Button variant="secondary" onClick={() => navigate('/search')}>
            {pick('العودة إلى البحث', 'Back to Search')}
          </Button>
        )}
      />
    );
  }

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="size-20 rounded-full object-cover" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-primary text-xl font-black text-white">
                {(profile.fullName ?? profile.username ?? 'S').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black text-ink">{profile.fullName ?? profile.username ?? `#${profile.id}`}</h1>
              <p className="text-sm text-muted">{profile.accountType}</p>
              <p className="text-sm text-muted">{pick('منذ', 'Member since')} {formatDate(profile.memberSince)}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label={pick('الإعلانات', 'Listings')} value={profile.stats.activeListings} />
            <Metric label={pick('التقييمات', 'Reviews')} value={profile.stats.reviewsReceived} />
            <Metric label={pick('الصفقات المكتملة', 'Completed Deals')} value={profile.stats.completedDeals} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
          <TrustBadge
            emailVerified={profile.emailVerified}
            phoneVerified={profile.phoneVerified}
            idVerified={profile.identityVerified}
            labels={{
              email: pick('البريد موثّق', 'Email verified'),
              phone: pick('الهاتف موثّق', 'Phone verified'),
              id: pick('الهوية موثّقة', 'ID verified'),
              sectionLabel: pick('مؤشرات الثقة', 'Trust indicators'),
            }}
          />
          <TrustScore score={profile.trustScore} label={pick('درجة الثقة', 'Trust score')} />
        </div>
      </article>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as PublicProfileTab)}
          items={[
            { key: 'listings', label: pick('الإعلانات', 'Listings') },
            { key: 'reviews', label: pick('التقييمات', 'Reviews') },
            { key: 'about', label: pick('حول', 'About') },
          ]}
        />

        <div className="mt-5">
          {tab === 'listings' ? (
            cardListings.length === 0 ? (
              <EmptyStatePanel
                title={pick('لا توجد إعلانات نشطة', 'No active listings')}
                description={pick('سيظهر محتوى هذا القسم عند نشر الإعلانات.', 'Listings will appear here once published.')}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cardListings.map((listing) => (
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
            )
          ) : null}

          {tab === 'reviews' ? (
            reviews.length === 0 ? (
              <EmptyStatePanel
                title={pick('لا توجد تقييمات بعد', 'No reviews yet')}
                description={pick('ستظهر التقييمات هنا بعد الصفقات المكتملة.', 'Reviews appear here after completed deals.')}
              />
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <article key={review.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {review.reviewer.fullName ?? review.reviewer.username ?? `#${review.reviewer.id}`}
                        </p>
                        <p className="text-xs text-muted">{formatDate(review.createdAt)}</p>
                      </div>
                      <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {review.rating.toFixed(1)} / 5
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {review.comment ?? pick('لا توجد ملاحظة مكتوبة.', 'No written comment.')}
                    </p>
                  </article>
                ))}
              </div>
            )
          ) : null}

          {tab === 'about' ? (
            <article className="rounded-xl bg-surface p-4 text-sm leading-7 text-muted">
              <p>{profile.bio ?? pick('لا توجد نبذة إضافية متاحة حاليًا.', 'No additional bio is available yet.')}</p>
              <p className="mt-3">
                {pick('متوسط زمن الرد', 'Average response time')}: {' '}
                <span className="font-semibold text-ink">
                  {profile.avgResponseHours !== null
                    ? pick(`${profile.avgResponseHours} ساعة`, `${profile.avgResponseHours}h`)
                    : pick('غير متوفر', 'N/A')}
                </span>
              </p>
              <p className="mt-2">
                {pick('متوسط التقييم', 'Average rating')}: {' '}
                <span className="font-semibold text-ink">
                  {profile.rating !== null ? profile.rating.toFixed(1) : pick('غير متوفر', 'N/A')}
                </span>
              </p>
            </article>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface px-3 py-2 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-black text-ink">{value}</p>
    </div>
  );
}
