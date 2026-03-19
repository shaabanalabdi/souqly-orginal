import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { craftsmanProfileService } from '../services/craftsmanProfile.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { UpsertCraftsmanProfilePayload } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

interface CraftsmanFormState {
  profession: string;
  experienceYears: string;
  workingHours: string;
  workingAreasText: string;
  portfolioText: string;
  availableNow: boolean;
}

const INITIAL_FORM: CraftsmanFormState = {
  profession: '',
  experienceYears: '',
  workingHours: '',
  workingAreasText: '',
  portfolioText: '',
  availableNow: true,
};

function normalizeList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function toOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function CraftsmanProfilePage() {
  const { pick } = useLocaleSwitch();
  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState<CraftsmanFormState>(INITIAL_FORM);
  const [verifiedByAdmin, setVerifiedByAdmin] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      try {
        const profile = await craftsmanProfileService.me();
        if (profile) {
          setForm({
            profession: profile.profession,
            experienceYears: profile.experienceYears == null ? '' : String(profile.experienceYears),
            workingHours: profile.workingHours ?? '',
            workingAreasText: profile.workingAreas.join('\n'),
            portfolioText: profile.portfolio.join('\n'),
            availableNow: profile.availableNow,
          });
          setVerifiedByAdmin(profile.verifiedByAdmin);
          setVerifiedAt(profile.verifiedAt);
          setCreatedAt(profile.createdAt);
          setUpdatedAt(profile.updatedAt);
        }
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const canSubmit = useMemo(() => form.profession.trim().length >= 2, [form.profession]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setErrorMessage(pick('المهنة يجب أن تكون حرفين على الأقل.', 'Profession must be at least 2 characters.'));
      return;
    }

    const workingAreas = normalizeList(form.workingAreasText);
    const portfolio = normalizeList(form.portfolioText);
    const parsedYears = form.experienceYears.trim().length > 0 ? Number(form.experienceYears) : undefined;

    if (parsedYears != null && (!Number.isInteger(parsedYears) || parsedYears < 0 || parsedYears > 80)) {
      setErrorMessage(pick('سنوات الخبرة يجب أن تكون رقمًا صحيحًا بين 0 و 80.', 'Experience years must be an integer between 0 and 80.'));
      return;
    }

    const payload: UpsertCraftsmanProfilePayload = {
      profession: form.profession.trim(),
      experienceYears: parsedYears,
      workingHours: toOptional(form.workingHours),
      workingAreas,
      portfolio,
      availableNow: form.availableNow,
    };

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await craftsmanProfileService.upsert(payload);
      setForm({
        profession: result.profile.profession,
        experienceYears: result.profile.experienceYears == null ? '' : String(result.profile.experienceYears),
        workingHours: result.profile.workingHours ?? '',
        workingAreasText: result.profile.workingAreas.join('\n'),
        portfolioText: result.profile.portfolio.join('\n'),
        availableNow: result.profile.availableNow,
      });
      setVerifiedByAdmin(result.profile.verifiedByAdmin);
      setVerifiedAt(result.profile.verifiedAt);
      setCreatedAt(result.profile.createdAt);
      setUpdatedAt(result.profile.updatedAt);

      if (result.verificationReset) {
        setSuccessMessage(
          pick(
            'تم حفظ التعديلات. تم إعادة حالة التحقق للمراجعة لأن بيانات الملف تغيرت.',
            'Profile saved. Verification status was reset for review because profile data changed.',
          ),
        );
      } else {
        setSuccessMessage(pick('تم حفظ ملف الحرفي بنجاح.', 'Craftsman profile saved successfully.'));
      }
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <EmptyState
        title={pick('غير مصرح', 'Unauthorized')}
        description={pick('يجب تسجيل الدخول أولاً للوصول إلى صفحة ملف الحرفي.', 'Please sign in to access craftsman profile management.')}
      />
    );
  }

  if (user.accountType !== 'CRAFTSMAN') {
    return (
      <EmptyState
        title={pick('صفحة خاصة بالحرفيين', 'Craftsman Accounts Only')}
        description={pick('هذه الصفحة مخصصة لحسابات CRAFTSMAN فقط.', 'This page is available only for CRAFTSMAN accounts.')}
      />
    );
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-black text-ink">{pick('إدارة ملف الحرفي', 'Craftsman Profile Management')}</h1>
        <p className="mt-1 text-sm text-muted">
          {pick(
            'حدّث بيانات المهنة ومناطق العمل ومعرض الأعمال. أي تغيير قد يتطلب مراجعة تحقق جديدة.',
            'Update profession details, working areas, and portfolio. Any change can trigger a new verification review.',
          )}
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="grid gap-4">
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('المهنة', 'Profession')}</span>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.profession}
                onChange={(event) => setForm((prev) => ({ ...prev, profession: event.target.value }))}
                placeholder={pick('مثال: نجار - كهربائي - سباك', 'Example: Carpenter - Electrician - Plumber')}
                minLength={2}
                maxLength={120}
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('سنوات الخبرة', 'Years of Experience')}</span>
              <input
                type="number"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.experienceYears}
                onChange={(event) => setForm((prev) => ({ ...prev, experienceYears: event.target.value }))}
                min={0}
                max={80}
                placeholder={pick('اختياري', 'Optional')}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('ساعات العمل', 'Working Hours')}</span>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.workingHours}
                onChange={(event) => setForm((prev) => ({ ...prev, workingHours: event.target.value }))}
                placeholder={pick('مثال: 9:00 - 18:00', 'Example: 9:00 - 18:00')}
                maxLength={255}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('مناطق العمل (سطر لكل منطقة)', 'Working Areas (one per line)')}</span>
              <textarea
                className="min-h-28 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.workingAreasText}
                onChange={(event) => setForm((prev) => ({ ...prev, workingAreasText: event.target.value }))}
                placeholder={pick('دمشق\nريف دمشق\nحمص', 'Damascus\nRif Damascus\nHoms')}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('روابط معرض الأعمال (سطر لكل رابط)', 'Portfolio URLs (one per line)')}</span>
              <textarea
                className="min-h-32 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.portfolioText}
                onChange={(event) => setForm((prev) => ({ ...prev, portfolioText: event.target.value }))}
                placeholder={pick('https://example.com/work-1.jpg', 'https://example.com/work-1.jpg')}
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={form.availableNow}
                onChange={(event) => setForm((prev) => ({ ...prev, availableNow: event.target.checked }))}
              />
              {pick('متاح لاستقبال الطلبات الآن', 'Available to receive requests now')}
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || !canSubmit || loading}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? pick('جارٍ الحفظ...', 'Saving...') : pick('حفظ الملف', 'Save Profile')}
            </button>
            {loading ? <span className="text-sm text-muted">{pick('جارٍ تحميل البيانات...', 'Loading profile...')}</span> : null}
          </div>

          {errorMessage ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p> : null}
          {successMessage ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p> : null}
        </form>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <h2 className="text-base font-bold text-ink">{pick('حالة الملف', 'Profile Status')}</h2>
          <div className="mt-3 space-y-2 text-sm text-muted">
            <p>
              {pick('التحقق الإداري', 'Admin Verification')}:{' '}
              <span className={verifiedByAdmin ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                {verifiedByAdmin ? pick('موثق', 'Verified') : pick('قيد المراجعة', 'Under Review')}
              </span>
            </p>
            <p>{pick('الحالة الحالية', 'Availability')}: {form.availableNow ? pick('متاح الآن', 'Available now') : pick('غير متاح', 'Unavailable')}</p>
            <p>{pick('آخر تحديث', 'Last Update')}: {updatedAt ?? '-'}</p>
            <p>{pick('تاريخ الإنشاء', 'Created At')}: {createdAt ?? '-'}</p>
            <p>{pick('تاريخ التحقق', 'Verified At')}: {verifiedAt ?? '-'}</p>
          </div>
        </aside>
      </section>
    </section>
  );
}
