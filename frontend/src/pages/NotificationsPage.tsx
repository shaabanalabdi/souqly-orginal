import { useEffect, useState } from 'react';
import { AccountShell } from '../components/AccountShell';
import { Button, EmptyStatePanel, ErrorStatePanel, LoadingState, useToast } from '../components/ui';
import { notificationsService } from '../services/notifications.service';
import { asHttpError } from '../services/http';
import type { AppNotification } from '../types/domain';
import { formatDate } from '../utils/format';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function NotificationsPage() {
  const { push } = useToast();
  const { pick } = useLocaleSwitch();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyId, setBusyId] = useState<number | 'all' | null>(null);

  const loadNotifications = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await notificationsService.list({ unreadOnly, page: 1, limit: 50 });
      setItems(result.items);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [unreadOnly]);

  return (
    <AccountShell
      title={pick('الإشعارات', 'Notifications')}
      description={pick('تابع الرسائل النظامية والتحديثات المهمة والإشعارات غير المقروءة.', 'Track system messages, important updates, and unread notifications.')}
    >
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
          <span>{pick('غير المقروءة فقط', 'Unread only')}</span>
        </label>
        <Button
          variant="secondary"
          isLoading={busyId === 'all'}
          onClick={async () => {
            setBusyId('all');
            try {
              await notificationsService.markAllRead();
              setItems((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() })));
              push(pick('تم تعليم كل الإشعارات كمقروءة.', 'All notifications marked as read.'), 'success');
            } catch (error) {
              push(asHttpError(error).message, 'error');
            } finally {
              setBusyId(null);
            }
          }}
        >
          {pick('تعليم الكل كمقروء', 'Mark All Read')}
        </Button>
      </section>

      {loading ? (
        <LoadingState text={pick('جارٍ تحميل الإشعارات...', 'Loading notifications...')} />
      ) : errorMessage ? (
        <ErrorStatePanel
          title={pick('تعذر تحميل الإشعارات', 'Failed to load notifications')}
          message={errorMessage}
          action={<Button variant="secondary" onClick={() => void loadNotifications()}>{pick('إعادة المحاولة', 'Retry')}</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyStatePanel
          title={pick('لا توجد إشعارات', 'No Notifications')}
          description={pick('عندما يصل تحديث جديد سيظهر هنا.', 'New updates will appear here when available.')}
        />
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-5 shadow-soft ${item.isRead ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50/50'}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-ink">{item.title}</h2>
                    {!item.isRead ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
                        {pick('جديد', 'New')}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted">{item.body}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted">
                    <span>{pick('النوع', 'Type')}: {item.type}</span>
                    <span>{pick('التاريخ', 'Created')}: {formatDate(item.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {item.link ? (
                    <a href={item.link} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-ink transition hover:bg-slate-50">
                      {pick('فتح', 'Open')}
                    </a>
                  ) : null}
                  {!item.isRead ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={busyId === item.id}
                      onClick={async () => {
                        setBusyId(item.id);
                        try {
                          const updated = await notificationsService.markRead(item.id);
                          setItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
                        } catch (error) {
                          push(asHttpError(error).message, 'error');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      {pick('تعليم كمقروء', 'Mark Read')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
