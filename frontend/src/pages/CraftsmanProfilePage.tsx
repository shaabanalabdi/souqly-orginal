import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { asHttpError } from '../services/http';
import { craftsmanProfileService } from '../services/craftsmanProfile.service';
import { formatDate } from '../utils/format';
import type { CraftsmanProfileDto } from '../types/domain';

interface CraftsmanProfileFormState {
  profession: string;
  experienceYears: string;
  workingHours: string;
  workingAreasCsv: string;
  portfolioCsv: string;
  availableNow: boolean;
}

const INITIAL_FORM: CraftsmanProfileFormState = {
  profession: '',
  experienceYears: '',
  workingHours: '',
  workingAreasCsv: '',
  portfolioCsv: '',
  availableNow: false,
};

function toFormState(profile: CraftsmanProfileDto): CraftsmanProfileFormState {
  return {
    profession: profile.profession,
    experienceYears: profile.experienceYears === null ? '' : String(profile.experienceYears),
    workingHours: profile.workingHours ?? '',
    workingAreasCsv: profile.workingAreas.join(', '),
    portfolioCsv: profile.portfolio.join(', '),
    availableNow: profile.availableNow,
  };
}

function parseCsvList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function CraftsmanProfilePage() {
  const { t } = useTranslation('craftsmanProfile');
  const [profile, setProfile] = useState<CraftsmanProfileDto | null>(null);
  const [form, setForm] = useState<CraftsmanProfileFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await craftsmanProfileService.me();
      setProfile(result);
      setForm(result ? toFormState(result) : INITIAL_FORM);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const profession = form.profession.trim();
    if (!profession) {
      setError(t('professionRequired'));
      return;
    }

    const parsedExperienceYears =
      form.experienceYears.trim().length > 0 && Number.isFinite(Number(form.experienceYears))
        ? Number(form.experienceYears)
        : undefined;

    setSaving(true);
    try {
      const result = await craftsmanProfileService.upsert({
        profession,
        experienceYears: parsedExperienceYears,
        workingHours: form.workingHours.trim() || undefined,
        workingAreas: parseCsvList(form.workingAreasCsv),
        portfolio: parseCsvList(form.portfolioCsv),
        availableNow: form.availableNow,
      });

      setProfile(result.profile);
      setForm(toFormState(result.profile));

      if (result.verificationReset) {
        setMessage(t('resetVerificationMsg'));
      } else {
        setMessage(result.created ? t('createdMsg') : t('updatedMsg'));
      }
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">{t('title')}</h1>

      {loading ? <p>Loading profile...</p> : null}

      {profile ? (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card__header">
            <h2>Verification Status</h2>
            <span className={profile.verifiedByAdmin ? 'badge badge--success' : 'badge badge--warning'}>
              {profile.verifiedByAdmin ? 'Verified by admin' : 'Pending verification'}
            </span>
          </div>
          <div className="list">
            <div className="row">
              <span className="row__label">Last updated</span>
              <span className="row__value">{formatDate(profile.updatedAt)}</span>
            </div>
            <div className="row">
              <span className="row__label">Verified at</span>
              <span className="row__value">{profile.verifiedAt ? formatDate(profile.verifiedAt) : '-'}</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="card__header">
          <h2>{profile ? t('updateProfile') : t('createProfile')}</h2>
        </div>
        <form onSubmit={handleSubmit} className="form-grid" style={{ padding: '1rem' }}>
          <label>{t('profession')}<input
              className="input"
              type="text"
              value={form.profession}
              onChange={(event) => setForm((prev) => ({ ...prev, profession: event.target.value }))}
              maxLength={120}
              required
            />
          </label>

          <label>{t('experience')}<input
              className="input"
              type="number"
              min={0}
              max={80}
              value={form.experienceYears}
              onChange={(event) => setForm((prev) => ({ ...prev, experienceYears: event.target.value }))}
            />
          </label>

          <label>{t('workingHours')}<input
              className="input"
              type="text"
              value={form.workingHours}
              onChange={(event) => setForm((prev) => ({ ...prev, workingHours: event.target.value }))}
              maxLength={255}
              placeholder={t('workingHoursPlaceholder')}
            />
          </label>

          <label>{t('workingAreas')}<input
              className="input"
              type="text"
              value={form.workingAreasCsv}
              onChange={(event) => setForm((prev) => ({ ...prev, workingAreasCsv: event.target.value }))}
              placeholder={t('workingAreasPlaceholder')}
            />
          </label>

          <label>{t('portfolioUrls')}<input
              className="input"
              type="text"
              value={form.portfolioCsv}
              onChange={(event) => setForm((prev) => ({ ...prev, portfolioCsv: event.target.value }))}
              placeholder={t('portfolioUrlsPlaceholder')}
            />
          </label>

          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.availableNow}
              onChange={(event) => setForm((prev) => ({ ...prev, availableNow: event.target.checked }))}
            />{t('availableNow')}</label>

          <div>
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? 'Saving...' : profile ? 'Save Changes' : 'Create Profile'}
            </button>
          </div>
        </form>
      </section>

      {message ? <p className="alert alert--success" style={{ marginTop: '1rem' }}>{message}</p> : null}
      {error ? <p className="alert alert--danger" style={{ marginTop: '1rem' }}>{error}</p> : null}
    </div>
  );
}
