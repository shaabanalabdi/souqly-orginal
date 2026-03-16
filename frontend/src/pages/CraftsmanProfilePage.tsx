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
      setError('Profession is required.');
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
        setMessage('Craftsman profile updated. Verification badge has been reset and requires admin review.');
      } else {
        setMessage(result.created ? 'Craftsman profile created successfully.' : 'Craftsman profile updated successfully.');
      }
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Craftsman Profile</h1>

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
          <h2>{profile ? 'Update Craftsman Profile' : 'Create Craftsman Profile'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="form-grid" style={{ padding: '1rem' }}>
          <label>
            Profession
            <input
              className="input"
              type="text"
              value={form.profession}
              onChange={(event) => setForm((prev) => ({ ...prev, profession: event.target.value }))}
              maxLength={120}
              required
            />
          </label>

          <label>
            Experience (years)
            <input
              className="input"
              type="number"
              min={0}
              max={80}
              value={form.experienceYears}
              onChange={(event) => setForm((prev) => ({ ...prev, experienceYears: event.target.value }))}
            />
          </label>

          <label>
            Working Hours
            <input
              className="input"
              type="text"
              value={form.workingHours}
              onChange={(event) => setForm((prev) => ({ ...prev, workingHours: event.target.value }))}
              maxLength={255}
              placeholder="09:00-17:00"
            />
          </label>

          <label>
            Working Areas (comma separated)
            <input
              className="input"
              type="text"
              value={form.workingAreasCsv}
              onChange={(event) => setForm((prev) => ({ ...prev, workingAreasCsv: event.target.value }))}
              placeholder="Damascus, Homs"
            />
          </label>

          <label>
            Portfolio URLs (comma separated)
            <input
              className="input"
              type="text"
              value={form.portfolioCsv}
              onChange={(event) => setForm((prev) => ({ ...prev, portfolioCsv: event.target.value }))}
              placeholder="https://example.com/item-1, https://example.com/item-2"
            />
          </label>

          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.availableNow}
              onChange={(event) => setForm((prev) => ({ ...prev, availableNow: event.target.checked }))}
            />
            Available now
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
