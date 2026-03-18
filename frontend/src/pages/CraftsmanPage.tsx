import { useEffect, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { craftsmanProfileService } from '../services/craftsmanProfile.service';
import { asHttpError } from '../services/http';
import type { CraftsmanProfileDto } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function CraftsmanPage() {
  const { pick } = useLocaleSwitch();
  const publicPhone = '+963 944 000 000';
  const whatsappPhone = '963944000000';
  const [profile, setProfile] = useState<CraftsmanProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const result = await craftsmanProfileService.me();
        setProfile(result);
      } catch (error) {
        setErrorMessage(asHttpError(error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  if (loading) {
    return <p className="text-sm text-muted">{pick('جارٍ التحميل...', 'Loading...')}</p>;
  }

  if (!profile) {
    return (
      <EmptyState
        title={pick('ملف الحرفي غير متوفر', 'Craftsman Profile Unavailable')}
        description={errorMessage || pick('يرجى إكمال بيانات الحرفي من لوحة الحساب.', 'Please complete craftsman profile from account dashboard.')}
      />
    );
  }

  return (
    <section className="space-y-5">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <img src="https://picsum.photos/seed/souqly-craftsman-avatar/140/140" alt="" className="size-20 rounded-full object-cover" />
            <div>
              <h1 className="text-2xl font-black text-ink">{profile.profession}</h1>
              <p className="text-sm font-medium text-primary">
                {pick('حرفي محترف', 'Professional Craftsman')}
              </p>
              <p className="text-sm text-muted">
                {pick('الخبرة', 'Experience')}: {profile.experienceYears ?? pick('غير محدد', 'Not specified')}
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              profile.availableNow ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {profile.availableNow ? pick('متاح الآن', 'Available now') : pick('غير متاح الآن', 'Unavailable now')}
            </span>
            <a href={`tel:${publicPhone}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
              {pick('الهاتف', 'Phone')}: {publicPhone}
            </a>
            <a href={`https://wa.me/${whatsappPhone}`} className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700">
              WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-muted">
          <p>
            {pick('ساعات العمل', 'Working Hours')}: {profile.workingHours ?? pick('غير متاح', 'N/A')}
          </p>
          <p>
            {pick('مناطق العمل', 'Working Areas')}: {profile.workingAreas.length > 0 ? profile.workingAreas.join(', ') : pick('غير متاح', 'N/A')}
          </p>
        </div>
      </article>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="mb-4 text-lg font-bold text-ink">{pick('معرض الأعمال', 'Portfolio')}</h2>
        {profile.portfolio.length === 0 ? (
          <EmptyState
            title={pick('لا يوجد معرض أعمال', 'No Portfolio Yet')}
            description={pick('قم بإضافة روابط الأعمال من صفحة الحرفي.', 'Add portfolio links from craftsman profile page.')}
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
        {errorMessage ? <p className="mt-3 text-sm text-amber-700">{errorMessage}</p> : null}
      </section>
    </section>
  );
}
