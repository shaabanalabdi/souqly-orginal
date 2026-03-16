import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { asHttpError } from '../services/http';
import { businessProfileService } from '../services/businessProfile.service';
import { formatDate } from '../utils/format';
import type { BusinessProfileDto } from '../types/domain';

interface BusinessProfileFormState {
  companyName: string;
  commercialRegister: string;
  taxNumber: string;
  website: string;
}

const INITIAL_FORM: BusinessProfileFormState = {
  companyName: '',
  commercialRegister: '',
  taxNumber: '',
  website: '',
};

function toFormState(profile: BusinessProfileDto): BusinessProfileFormState {
  return {
    companyName: profile.companyName,
    commercialRegister: profile.commercialRegister ?? '',
    taxNumber: profile.taxNumber ?? '',
    website: profile.website ?? '',
  };
}

export function BusinessProfilePage() {
  const { t } = useTranslation('businessProfile');
  const [profile, setProfile] = useState<BusinessProfileDto | null>(null);
  const [form, setForm] = useState<BusinessProfileFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await businessProfileService.me();
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

    if (!form.companyName.trim()) {
      setError(t('companyNameRequired'));
      return;
    }

    setSaving(true);
    try {
      const result = await businessProfileService.upsert({
        companyName: form.companyName.trim(),
        commercialRegister: form.commercialRegister.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        website: form.website.trim() || undefined,
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
            <h2>{t('verificationStatus')}</h2>
            <span className={profile.verifiedByAdmin ? 'badge badge--success' : 'badge badge--warning'}>
              {profile.verifiedByAdmin ? t('verifiedByAdmin') : t('pendingVerification')}
            </span>
          </div>
          <div className="list">
            <div className="row">
              <span className="row__label">{t('lastUpdated')}</span>
              <span className="row__value">{formatDate(profile.updatedAt)}</span>
            </div>
            <div className="row">
              <span className="row__label">{t('verifiedAt')}</span>
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
          <label>
            {t('companyName')}
            <input
              className="input"
              type="text"
              value={form.companyName}
              onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
              maxLength={200}
              required
            />
          </label>

          <label>
            {t('commercialRegister')}
            <input
              className="input"
              type="text"
              value={form.commercialRegister}
              onChange={(event) => setForm((prev) => ({ ...prev, commercialRegister: event.target.value }))}
              maxLength={100}
            />
          </label>

          <label>
            {t('taxNumber')}
            <input
              className="input"
              type="text"
              value={form.taxNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, taxNumber: event.target.value }))}
              maxLength={100}
            />
          </label>

          <label>
            {t('website')}
            <input
              className="input"
              type="url"
              value={form.website}
              onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
              maxLength={300}
              placeholder={t('websitePlaceholder')}
            />
          </label>

          <div>
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? t('saving') : profile ? t('saveChanges') : t('createBtn')}
            </button>
          </div>
        </form>
      </section>

      {message ? <p className="alert alert--success" style={{ marginTop: '1rem' }}>{message}</p> : null}
      {error ? <p className="alert alert--danger" style={{ marginTop: '1rem' }}>{error}</p> : null}
    </div>
  );
}
