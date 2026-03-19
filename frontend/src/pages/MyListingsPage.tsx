import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountShell } from '../components/AccountShell';
import { ListingCard } from '../components/ListingCard';
import { Button, EmptyStatePanel, ErrorStatePanel, LoadingState, useToast } from '../components/ui';
import { listingsService } from '../services/listings.service';
import { asHttpError } from '../services/http';
import type { ListingStatus, ListingSummary } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

type ListingTab = 'DRAFT' | 'ACTIVE' | 'PENDING' | 'REJECTED' | 'EXPIRED' | 'SOLD';

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

export function MyListingsPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const { locale, pick } = useLocaleSwitch();
  const [activeTab, setActiveTab] = useState<ListingTab>('ACTIVE');
  const [items, setItems] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadItems = async (status: ListingStatus) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await listingsService.listMine({ status, page: 1, limit: 48 });
      setItems(result.items);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems(activeTab);
  }, [activeTab]);

  const cards = useMemo(() => items.map(mapListing), [items]);

  return (
    <AccountShell
      title={pick('إعلاناتي', 'My Listings')}
      description={pick('إدارة الإعلانات النشطة والمعلقة والمرفوضة والمنتهية والمباعة.', 'Manage your active, pending, rejected, expired, and sold listings.')}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap gap-2">
          <ListingTabButton active={activeTab === 'DRAFT'} onClick={() => setActiveTab('DRAFT')} label={pick('مسودات', 'Drafts')} />
          <ListingTabButton active={activeTab === 'ACTIVE'} onClick={() => setActiveTab('ACTIVE')} label={pick('نشطة', 'Active')} />
          <ListingTabButton active={activeTab === 'PENDING'} onClick={() => setActiveTab('PENDING')} label={pick('معلقة', 'Pending')} />
          <ListingTabButton active={activeTab === 'REJECTED'} onClick={() => setActiveTab('REJECTED')} label={pick('مرفوضة', 'Rejected')} />
          <ListingTabButton active={activeTab === 'EXPIRED'} onClick={() => setActiveTab('EXPIRED')} label={pick('منتهية', 'Expired')} />
          <ListingTabButton active={activeTab === 'SOLD'} onClick={() => setActiveTab('SOLD')} label={pick('مباعة', 'Sold')} />
        </div>
      </section>

      {loading ? (
        <LoadingState text={pick('جارٍ تحميل الإعلانات...', 'Loading listings...')} />
      ) : errorMessage ? (
        <ErrorStatePanel
          title={pick('تعذر تحميل الإعلانات', 'Failed to load listings')}
          message={errorMessage}
          action={<Button variant="secondary" onClick={() => void loadItems(activeTab)}>{pick('إعادة المحاولة', 'Retry')}</Button>}
        />
      ) : cards.length === 0 ? (
        <EmptyStatePanel
          title={pick('لا توجد إعلانات في هذا القسم', 'No Listings in This Tab')}
          description={pick('عند إنشاء إعلان أو تغيير حالته سيظهر هنا.', 'Listings will appear here after you create them or their status changes.')}
          action={<Button onClick={() => navigate('/listings/create')}>{pick('إنشاء إعلان جديد', 'Create Listing')}</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((listing) => (
            <div key={listing.id} className="space-y-3">
              <ListingCard
                id={listing.id}
                title={listing.title}
                price={listing.price}
                currency={listing.currency}
                location={listing.location}
                imageUrl={listing.imageUrl}
                badge={listing.badge}
                locale={locale}
                onOpen={(id) => navigate(`/listings/${id}`)}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => navigate(`/listings/${listing.id}/edit`)}>
                  {pick('تعديل', 'Edit')}
                </Button>
                {activeTab === 'DRAFT' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    isLoading={busyId === listing.id}
                    onClick={async () => {
                      setBusyId(Number(listing.id));
                      try {
                        await listingsService.publish(Number(listing.id));
                        setItems((prev) => prev.filter((item) => item.id !== listing.id));
                        push(pick('تم نشر المسودة.', 'Draft published.'), 'success');
                      } catch (error) {
                        push(asHttpError(error).message, 'error');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {pick('نشر', 'Publish')}
                  </Button>
                ) : activeTab === 'EXPIRED' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    isLoading={busyId === listing.id}
                    onClick={async () => {
                      setBusyId(Number(listing.id));
                      try {
                        await listingsService.renew(Number(listing.id));
                        setItems((prev) => prev.filter((item) => item.id !== listing.id));
                        push(pick('تم تجديد الإعلان.', 'Listing renewed.'), 'success');
                      } catch (error) {
                        push(asHttpError(error).message, 'error');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {pick('تجديد', 'Renew')}
                  </Button>
                ) : activeTab !== 'SOLD' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    isLoading={busyId === listing.id}
                    onClick={async () => {
                      setBusyId(Number(listing.id));
                      try {
                        await listingsService.markSold(Number(listing.id));
                        setItems((prev) => prev.filter((item) => item.id !== listing.id));
                        push(pick('تم تعليم الإعلان كمباع.', 'Listing marked as sold.'), 'success');
                      } catch (error) {
                        push(asHttpError(error).message, 'error');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {pick('تعليم كمباع', 'Mark Sold')}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={busyId === -Number(listing.id)}
                  onClick={async () => {
                    setBusyId(-Number(listing.id));
                    try {
                      await listingsService.remove(Number(listing.id));
                      setItems((prev) => prev.filter((item) => item.id !== listing.id));
                      push(pick('تمت أرشفة الإعلان.', 'Listing archived.'), 'success');
                    } catch (error) {
                      push(asHttpError(error).message, 'error');
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {pick('أرشفة', 'Archive')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountShell>
  );
}

function ListingTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active ? 'bg-primary text-white' : 'border border-slate-200 text-ink hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}
