import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';

export function RegisterPage() {
  const { t } = useTranslation();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setSuccessMessage(null);
    setResendMessage(null);

    const result = await register({ email, password, fullName });
    setSuccessMessage(t('auth.registerSuccessMsg', { email: result.email }));
  };

  const handleResend = async () => {
    try {
      if (!email) {
        setResendMessage(t('auth.resendRequiresEmail'));
        return;
      }
      await authService.resendVerification(email);
      setResendMessage(t('auth.resendSuccessMsg'));
    } catch (err) {
      setResendMessage(asHttpError(err).message);
    }
  };

  return (
    <section className="card" style={{ maxWidth: 540, marginInline: 'auto' }}>
      <h1 className="page-title">{t('auth.registerTitle')}</h1>
      <p className="page-subtitle">{t('auth.registerSubtitle')}</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">{t('auth.fullName')}</span>
          <input
            className="input"
            required
            minLength={2}
            maxLength={100}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">{t('auth.email')}</span>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">{t('auth.password')}</span>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}
        {successMessage ? <p className="success-text">{successMessage}</p> : null}
        {resendMessage ? <p className="muted-text">{resendMessage}</p> : null}

        <div className="button-row">
          <button type="submit" className="button button--primary" disabled={isLoading}>
            {isLoading ? t('auth.creating') : t('auth.submitRegister')}
          </button>
          <button type="button" className="button button--ghost" onClick={handleResend}>
            {t('auth.resendVerification')}
          </button>
        </div>
      </form>

      <p className="muted-text">
        {t('auth.alreadyHaveAccount')} <Link to="/login">{t('auth.loginLink')}</Link>
      </p>
    </section>
  );
}
