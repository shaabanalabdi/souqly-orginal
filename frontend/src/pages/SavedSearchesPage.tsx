import { useEffect, useState } from 'react';
import { AccountShell } from '../components/AccountShell';
import { Button, EmptyStatePanel, ErrorStatePanel, Input, LoadingState, useToast } from '../components/ui';
import { preferencesService, type SavedSearchPayload } from '../services/preferences.service';
import { asHttpError } from '../services/http';
import type { NotificationFrequency, SavedSearch } from '../types/domain';
import { formatDate } from '../utils/format';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function SavedSearchesPage() {
  const { push } = useToast();
  const { pick } = useLocaleSwitch();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; query: string; frequency: NotificationFrequency }>({
    name: '',
    query: '',
    frequency: 'daily',
  });

  const loadSavedSearches = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await preferencesService.listSavedSearches(1, 50);
      setItems(result.items);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSavedSearches();
  }, []);

  const createPayload = (): SavedSearchPayload => ({
    name: form.name.trim(),
    filters: { q: form.query.trim() },
    notificationFrequency: form.frequency,
  });

  return (
    <AccountShell
      title={pick('عمليات البحث المحفوظة', 'Saved Searches')}
      description={pick('احفظ استعلامات البحث لتكرارها بسرعة وتلقي التنبيهات.', 'Save search queries for quick reuse and alert delivery.')}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">{pick('إضافة بحث محفوظ', 'Add Saved Search')}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            label={pick('الاسم', 'Name')}
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            label={pick('كلمات البحث', 'Search Query')}
            value={form.query}
            onChange={(event) => setForm((prev) => ({ ...prev, query: event.target.value }))}
          />
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-ink">{pick('التكرار', 'Frequency')}</span>
            <select
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary"
              value={form.frequency}
              onChange={(event) => setForm((prev) => ({ ...prev, frequency: event.target.value as NotificationFrequency }))}
            >
              <option value="instant">{pick('فوري', 'Instant')}</option>
              <option value="daily">{pick('يومي', 'Daily')}</option>
              <option value="weekly">{pick('أسبوعي', 'Weekly')}</option>
            </select>
          </label>
        </div>

        <div className="mt-4">
          <Button
            onClick={async () => {
              try {
                const created = await preferencesService.createSavedSearch(createPayload());
                setItems((prev) => [created, ...prev]);
                setForm({ name: '', query: '', frequency: 'daily' });
                push(pick('تم حفظ البحث بنجاح.', 'Saved search created.'), 'success');
              } catch (error) {
                push(asHttpError(error).message, 'error');
              }
            }}
            disabled={!form.name.trim() || !form.query.trim()}
          >
            {pick('حفظ البحث', 'Save Search')}
          </Button>
        </div>
      </section>

      {loading ? (
        <LoadingState text={pick('جارٍ تحميل عمليات البحث المحفوظة...', 'Loading saved searches...')} />
      ) : errorMessage ? (
        <ErrorStatePanel
          title={pick('تعذر تحميل عمليات البحث', 'Failed to load saved searches')}
          message={errorMessage}
          action={<Button variant="secondary" onClick={() => void loadSavedSearches()}>{pick('إعادة المحاولة', 'Retry')}</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyStatePanel
          title={pick('لا توجد عمليات بحث محفوظة', 'No Saved Searches')}
          description={pick('أنشئ أول بحث محفوظ لتصلك التنبيهات عند ظهور نتائج جديدة.', 'Create your first saved search to receive alerts when new matches appear.')}
        />
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-ink">{item.name}</h3>
                  <p className="text-sm text-muted">
                    {pick('التكرار', 'Frequency')}: <span className="font-semibold">{item.notificationFrequency}</span>
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    {JSON.stringify(item.filters, null, 2)}
                  </pre>
                  <p className="text-xs text-muted">{pick('تاريخ الإنشاء', 'Created')}: {formatDate(item.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    isLoading={busyId === item.id}
                    onClick={async () => {
                      setBusyId(item.id);
                      try {
                        await preferencesService.deleteSavedSearch(item.id);
                        setItems((prev) => prev.filter((entry) => entry.id !== item.id));
                        push(pick('تم حذف البحث المحفوظ.', 'Saved search deleted.'), 'success');
                      } catch (error) {
                        push(asHttpError(error).message, 'error');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {pick('حذف', 'Delete')}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
