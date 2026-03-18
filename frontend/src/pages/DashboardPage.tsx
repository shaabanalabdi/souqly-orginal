import { useEffect, useMemo, useState } from 'react';
import { adminService } from '../services/admin.service';
import { chatsService } from '../services/chats.service';
import { listingsService } from '../services/listings.service';
import { preferencesService } from '../services/preferences.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function DashboardPage() {
  const { pick } = useLocaleSwitch();
  const user = useAuthStore((state) => state.user);

  const [stats, setStats] = useState({
    listings: 0,
    unreadChats: 0,
    favorites: 0,
    pendingReports: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const [listingsResult, unreadResult, favoritesResult] = await Promise.all([
          listingsService.list({ page: 1, limit: 1 }),
          chatsService.unreadCount(),
          preferencesService.listFavorites(1, 1),
        ]);

        let pendingReports = 0;
        if (user?.staffRole === 'ADMIN' || user?.staffRole === 'MODERATOR') {
          try {
            const adminResult = await adminService.dashboard();
            pendingReports = adminResult.reports.pending;
          } catch {
            pendingReports = 0;
          }
        }

        setStats({
          listings: listingsResult.meta.total,
          unreadChats: unreadResult.unreadCount,
          favorites: favoritesResult.meta.total,
          pendingReports,
        });
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [user?.staffRole]);

  const cards = useMemo(
    () => [
      { id: 'listings', labelAr: 'إجمالي الإعلانات', labelEn: 'Total Listings', value: stats.listings },
      { id: 'unread', labelAr: 'رسائل غير مقروءة', labelEn: 'Unread Chats', value: stats.unreadChats },
      { id: 'favorites', labelAr: 'المفضلة', labelEn: 'Favorites', value: stats.favorites },
      { id: 'reports', labelAr: 'بلاغات معلقة', labelEn: 'Pending Reports', value: stats.pendingReports },
    ],
    [stats],
  );

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-black text-ink">{pick('لوحة التحكم', 'Dashboard')}</h1>
        <p className="text-sm text-muted">{pick('نظرة سريعة على نشاط حسابك.', 'Quick overview of your account activity.')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
            <p className="text-xs text-muted">{pick(card.labelAr, card.labelEn)}</p>
            <p className="mt-1 text-2xl font-black text-primary">{loading ? '...' : card.value}</p>
          </article>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <h2 className="mb-3 text-base font-bold text-ink">{pick('نشاط الحساب', 'Account Activity')}</h2>
          <div className="space-y-2 text-sm text-muted">
            <p>
              {pick('نوع الحساب', 'Account Type')}: {user?.accountType ?? pick('غير متاح', 'N/A')}
            </p>
            <p>
              {pick('الدور', 'Role')}: {user?.role ?? pick('غير متاح', 'N/A')}
            </p>
            <p>
              {pick('مستوى الثقة', 'Trust Tier')}: {user?.trustTier ?? pick('غير متاح', 'N/A')}
            </p>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
          <h2 className="mb-3 text-base font-bold text-ink">{pick('ملخص سريع', 'Quick Summary')}</h2>
          <div className="space-y-3">
            <ProgressRow label={pick('التفاعل', 'Engagement')} value={Math.min(100, stats.favorites * 4)} />
            <ProgressRow label={pick('الردود', 'Responses')} value={Math.min(100, stats.unreadChats * 7)} />
            <ProgressRow label={pick('الإدارة', 'Moderation')} value={Math.min(100, stats.pendingReports * 12)} />
          </div>
        </article>
      </section>

      {errorMessage ? <p className="text-sm text-amber-700">{errorMessage}</p> : null}
    </section>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-semibold text-muted">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
