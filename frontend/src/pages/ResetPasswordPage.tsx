import { type FormEvent, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth.service';
import { asHttpError } from '../services/http';

export function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') ?? '', [location.search]);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!token) {
      setError(t('missingResetToken'));
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword });
      setMessage(t('passwordUpdated'));
      setNewPassword('');
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card" style={{ maxWidth: 500, marginInline: 'auto' }}>
      <h1 className="page-title">{t('resetPasswordTitle')}</h1>
      <p className="page-subtitle">{t('resetPasswordSubtitle')}</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">{t('newPassword')}</span>
          <input
            className="input"
            type="password"
            minLength={8}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="button-row">
          <button type="submit" className="button button--primary" disabled={loading}>
            {loading ? t('updating') : t('updatePassword')}
          </button>
          <Link to="/login" className="button button--ghost">
            {t('backToLogin')}
          </Link>
        </div>
      </form>
    </section>
  );
}
