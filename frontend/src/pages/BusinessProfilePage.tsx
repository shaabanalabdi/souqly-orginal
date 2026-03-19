import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { businessProfileService } from '../services/businessProfile.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { UpsertBusinessProfilePayload } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

interface BusinessFormState {
  companyName: string;
  commercialRegister: string;
  taxNumber: string;
  website: string;
}

const INITIAL_FORM: BusinessFormState = {
  companyName: '',
  commercialRegister: '',
  taxNumber: '',
  website: '',
};

function toOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function BusinessProfilePage() {
  const { pick } = useLocaleSwitch();
  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState<BusinessFormState>(INITIAL_FORM);
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
        const profile = await businessProfileService.me();
        if (profile) {
          setForm({
            companyName: profile.companyName,
            commercialRegister: profile.commercialRegister ?? '',
            taxNumber: profile.taxNumber ?? '',
            website: profile.website ?? '',
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

  const canSubmit = useMemo(() => form.companyName.trim().length >= 2, [form.companyName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setErrorMessage(pick('اسم الشركة يجب أن يكون حرفين على الأقل.', 'Company name must be at least 2 characters.'));
      return;
    }

    const payload: UpsertBusinessProfilePayload = {
      companyName: form.companyName.trim(),
      commercialRegister: toOptional(form.commercialRegister),
      taxNumber: toOptional(form.taxNumber),
      website: toOptional(form.website),
    };

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await businessProfileService.upsert(payload);
      setForm({
        companyName: result.profile.companyName,
        commercialRegister: result.profile.commercialRegister ?? '',
        taxNumber: result.profile.taxNumber ?? '',
        website: result.profile.website ?? '',
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
        setSuccessMessage(pick('تم حفظ ملف المتجر بنجاح.', 'Business profile saved successfully.'));
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
        description={pick('يجب تسجيل الدخول أولاً للوصول إلى صفحة الملف التجاري.', 'Please sign in to access business profile management.')}
      />
    );
  }

  if (user.accountType !== 'STORE') {
    return (
      <EmptyState
        title={pick('صفحة خاصة بالمتاجر', 'Store Accounts Only')}
        description={pick('هذه الصفحة مخصصة لحسابات STORE فقط.', 'This page is available only for STORE accounts.')}
      />
    );
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-black text-ink">{pick('إدارة ملف المتجر', 'Business Profile Management')}</h1>
        <p className="mt-1 text-sm text-muted">
          {pick(
            'حدّث بيانات النشاط التجاري الرسمية. بعض التغييرات قد تتطلب مراجعة تحقق جديدة.',
            'Update official business details. Some changes can trigger a fresh verification review.',
          )}
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="grid gap-4">
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('اسم الشركة', 'Company Name')}</span>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.companyName}
                onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                placeholder={pick('مثال: شركة النخبة للتجارة', 'Example: Elite Trading LLC')}
                minLength={2}
                maxLength={200}
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('السجل التجاري', 'Commercial Register')}</span>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.commercialRegister}
                onChange={(event) => setForm((prev) => ({ ...prev, commercialRegister: event.target.value }))}
                placeholder={pick('اختياري', 'Optional')}
                maxLength={100}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('الرقم الضريبي', 'Tax Number')}</span>
              <input
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.taxNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, taxNumber: event.target.value }))}
                placeholder={pick('اختياري', 'Optional')}
                maxLength={100}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-ink">{pick('الموقع الإلكتروني', 'Website')}</span>
              <input
                type="url"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
                value={form.website}
                onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                placeholder="https://example.com"
                maxLength={300}
              />
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
            <p>{pick('آخر تحديث', 'Last Update')}: {updatedAt ?? '-'}</p>
            <p>{pick('تاريخ الإنشاء', 'Created At')}: {createdAt ?? '-'}</p>
            <p>{pick('تاريخ التحقق', 'Verified At')}: {verifiedAt ?? '-'}</p>
          </div>
        </aside>
      </section>
    </section>
  );
}
