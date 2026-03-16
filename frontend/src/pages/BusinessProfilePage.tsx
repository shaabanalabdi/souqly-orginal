import { useCallback, useEffect, useState } from 'react';
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
      setError('Company name is required.');
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
        setMessage('Business profile updated. Verification badge has been reset and requires admin review.');
      } else {
        setMessage(result.created ? 'Business profile created successfully.' : 'Business profile updated successfully.');
      }
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Business Profile</h1>

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
          <h2>{profile ? 'Update Business Profile' : 'Create Business Profile'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="form-grid" style={{ padding: '1rem' }}>
          <label>
            Company Name
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
            Commercial Register
            <input
              className="input"
              type="text"
              value={form.commercialRegister}
              onChange={(event) => setForm((prev) => ({ ...prev, commercialRegister: event.target.value }))}
              maxLength={100}
            />
          </label>

          <label>
            Tax Number
            <input
              className="input"
              type="text"
              value={form.taxNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, taxNumber: event.target.value }))}
              maxLength={100}
            />
          </label>

          <label>
            Website
            <input
              className="input"
              type="url"
              value={form.website}
              onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
              maxLength={300}
              placeholder="https://example.com"
            />
          </label>

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
