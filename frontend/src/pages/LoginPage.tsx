import { type FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  const redirect = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('redirect') ?? '/';
  }, [location.search]);

  const login = useAuthStore((state) => state.login);
  const loginWithGoogleOAuth = useAuthStore((state) => state.loginWithGoogleOAuth);
  const loginWithFacebookOAuth = useAuthStore((state) => state.loginWithFacebookOAuth);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [oauthFullName, setOauthFullName] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    await login({ email, password });
    navigate(redirect, { replace: true });
  };

  const handleGoogleOAuth = async () => {
    clearError();
    await loginWithGoogleOAuth({
      email: email.trim() || undefined,
      fullName: oauthFullName.trim() || undefined,
    });
    navigate(redirect, { replace: true });
  };

  const handleFacebookOAuth = async () => {
    clearError();
    await loginWithFacebookOAuth({
      email: email.trim() || undefined,
      fullName: oauthFullName.trim() || undefined,
    });
    navigate(redirect, { replace: true });
  };

  return (
    <section className="card" style={{ maxWidth: 480, marginInline: 'auto' }}>
      <h1 className="page-title">{t('auth.loginTitle')}</h1>
      <p className="page-subtitle">{t('auth.loginSubtitle')}</p>

      <form className="stack" onSubmit={handleSubmit}>
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="button-row">
          <button className="button button--primary" type="submit" disabled={isLoading}>
            {isLoading ? t('auth.loggingIn') : t('auth.submitLogin')}
          </button>
          <Link className="button button--ghost" to="/forgot-password">
            {t('auth.forgotPassword')}
          </Link>
        </div>
      </form>

      <div className="stack" style={{ marginTop: 16 }}>
        <label className="field">
          <span className="label">{t('auth.oauthName')}</span>
          <input
            className="input"
            type="text"
            value={oauthFullName}
            onChange={(event) => setOauthFullName(event.target.value)}
            placeholder={t('auth.oauthNamePlaceholder')}
          />
        </label>

        <div className="button-row">
          <button
            className="button button--ghost"
            type="button"
            disabled={isLoading || !email.trim()}
            onClick={handleGoogleOAuth}
          >
            {t('auth.continueWithGoogle')}
          </button>
          <button
            className="button button--ghost"
            type="button"
            disabled={isLoading || !email.trim()}
            onClick={handleFacebookOAuth}
          >
            {t('auth.continueWithFacebook')}
          </button>
        </div>
      </div>

      <p className="muted-text">
        {t('auth.noAccount')} <Link to="/register">{t('auth.registerLink')}</Link>
      </p>
    </section>
  );
}
