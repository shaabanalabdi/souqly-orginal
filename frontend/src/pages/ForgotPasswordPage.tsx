import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth.service';
import { asHttpError } from '../services/http';

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await authService.forgotPassword(email);
      setMessage(t('resetLinkSent'));
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card" style={{ maxWidth: 500, marginInline: 'auto' }}>
      <h1 className="page-title">{t('forgotPasswordTitle')}</h1>
      <p className="page-subtitle">{t('forgotPasswordSubtitle')}</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">{t('email')}</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="button-row">
          <button type="submit" className="button button--primary" disabled={loading}>
            {loading ? t('sending') : t('sendResetLink')}
          </button>
          <Link to="/login" className="button button--ghost">
            {t('backToLogin')}
          </Link>
        </div>
      </form>
    </section>
  );
}
