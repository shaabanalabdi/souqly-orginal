import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountShell } from '../components/AccountShell';
import { Button, EmptyStatePanel, ErrorStatePanel, LoadingState } from '../components/ui';
import { chatsService } from '../services/chats.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { OfferListItem, OfferStatus } from '../types/domain';
import { formatDate, formatMoney } from '../utils/format';
import { useLocaleSwitch } from '../utils/localeSwitch';

type OfferTab = '' | OfferStatus;

export function PriceOffersPage() {
  const navigate = useNavigate();
  const { pick } = useLocaleSwitch();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<OfferTab>('');
  const [items, setItems] = useState<OfferListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadOffers = async (status?: OfferStatus) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await chatsService.listOffers({ status, page: 1, limit: 50 });
      setItems(result.items);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOffers(activeTab || undefined);
  }, [activeTab]);

  return (
    <AccountShell
      title={pick('عروض الأسعار', 'Price Offers')}
      description={pick('متابعة كل العروض المرسلة والمستلمة مع حالتها الحالية.', 'Track all sent and received offers along with their current status.')}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap gap-2">
          <OfferTabButton active={activeTab === ''} onClick={() => setActiveTab('')} label={pick('الكل', 'All')} />
          <OfferTabButton active={activeTab === 'PENDING'} onClick={() => setActiveTab('PENDING')} label={pick('معلقة', 'Pending')} />
          <OfferTabButton active={activeTab === 'ACCEPTED'} onClick={() => setActiveTab('ACCEPTED')} label={pick('مقبولة', 'Accepted')} />
          <OfferTabButton active={activeTab === 'REJECTED'} onClick={() => setActiveTab('REJECTED')} label={pick('مرفوضة', 'Rejected')} />
          <OfferTabButton active={activeTab === 'COUNTERED'} onClick={() => setActiveTab('COUNTERED')} label={pick('مضادة', 'Countered')} />
        </div>
      </section>

      {loading ? (
        <LoadingState text={pick('جارٍ تحميل العروض...', 'Loading offers...')} />
      ) : errorMessage ? (
        <ErrorStatePanel
          title={pick('تعذر تحميل العروض', 'Failed to load offers')}
          message={errorMessage}
          action={<Button variant="secondary" onClick={() => void loadOffers(activeTab || undefined)}>{pick('إعادة المحاولة', 'Retry')}</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyStatePanel
          title={pick('لا توجد عروض', 'No Offers')}
          description={pick('ستظهر العروض هنا بعد إرسال عرض أو استلامه داخل المحادثات.', 'Offers will appear here after you send or receive them inside chats.')}
          action={<Button onClick={() => navigate('/chats')}>{pick('فتح المحادثات', 'Open Chats')}</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {items.map((offer) => {
            const isSentByMe = user?.id === offer.senderId;
            return (
              <article key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-4">
                    {offer.listing.coverImage ? (
                      <img src={offer.listing.coverImage} alt="" className="size-20 rounded-xl object-cover" />
                    ) : (
                      <div className="flex size-20 items-center justify-center rounded-xl bg-slate-100 text-xs text-muted">
                        {pick('بدون صورة', 'No image')}
                      </div>
                    )}
                    <div className="space-y-2">
                      <h2 className="text-base font-bold text-ink">{offer.listing.title}</h2>
                      <p className="text-sm text-muted">
                        {pick('قيمة العرض', 'Offer amount')}: <span className="font-semibold text-ink">{formatMoney(offer.amount, offer.listing.currency)}</span>
                      </p>
                      <p className="text-sm text-muted">
                        {pick('الكمية', 'Quantity')}: {offer.quantity}
                      </p>
                      {offer.counterAmount ? (
                        <p className="text-sm text-muted">
                          {pick('العرض المضاد', 'Counter amount')}: <span className="font-semibold text-ink">{formatMoney(offer.counterAmount, offer.listing.currency)}</span>
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-3 text-xs text-muted">
                        <span>{isSentByMe ? pick('مرسل', 'Sent') : pick('مستلم', 'Received')}</span>
                        <span>{pick('الحالة', 'Status')}: {offer.status}</span>
                        <span>{pick('التاريخ', 'Created')}: {formatDate(offer.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigate('/chats')}>
                      {pick('فتح المحادثة', 'Open Chat')}
                    </Button>
                    {offer.status === 'ACCEPTED' ? (
                      <Button size="sm" onClick={() => navigate('/deals')}>
                        {pick('متابعة الصفقة', 'Open Deal')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AccountShell>
  );
}

function OfferTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
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
