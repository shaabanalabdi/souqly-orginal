import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { asHttpError, checkApiHealth, getApiBaseUrl, type HttpError } from '../services/http';
import { useLocaleSwitch } from '../utils/localeSwitch';

type ApiStatus = 'checking' | 'online' | 'offline';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { pick } = useLocaleSwitch();

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
  const [diagnosticHint, setDiagnosticHint] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  const apiBaseUrl = getApiBaseUrl();

  const resolveAuthHint = (httpError: HttpError): string => {
    if (!httpError.status) {
      return pick(
        `تعذر الاتصال بالخادم. تحقق من تشغيل الـ backend ثم جرّب: ${apiBaseUrl}/health`,
        `Cannot reach backend. Make sure it is running, then check: ${apiBaseUrl}/health`,
      );
    }

    if (httpError.code === 'INVALID_CREDENTIALS') {
      return pick('تحقق من البريد وكلمة المرور.', 'Please verify email and password.');
    }

    if (httpError.code === 'EMAIL_NOT_VERIFIED') {
      return pick('يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول.', 'You must verify email before login.');
    }

    if (httpError.code === 'ACCOUNT_DISABLED') {
      return pick('الحساب معطل. تواصل مع الدعم.', 'Account is disabled. Contact support.');
    }

    if (httpError.status >= 500) {
      return pick(
        `الخادم أعاد خطأ (${httpError.status}). راجع سجل backend.`,
        `Server returned ${httpError.status}. Check backend logs.`,
      );
    }

    return pick('حدث خطأ أثناء تسجيل الدخول.', 'Login failed due to an unexpected error.');
  };

  const runHealthCheck = async () => {
    setApiStatus('checking');
    const healthy = await checkApiHealth();
    setApiStatus(healthy ? 'online' : 'offline');
  };

  useEffect(() => {
    let active = true;
    void checkApiHealth().then((healthy) => {
      if (!active) return;
      setApiStatus(healthy ? 'online' : 'offline');
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    setDiagnosticHint(null);
    try {
      await login({ email, password });
      navigate(redirect, { replace: true });
    } catch (err) {
      setDiagnosticHint(resolveAuthHint(asHttpError(err)));
    }
  };

  const handleGoogleOAuth = async () => {
    clearError();
    setDiagnosticHint(null);
    try {
      await loginWithGoogleOAuth({
        email: email.trim() || undefined,
        fullName: oauthFullName.trim() || undefined,
      });
      navigate(redirect, { replace: true });
    } catch (err) {
      setDiagnosticHint(resolveAuthHint(asHttpError(err)));
    }
  };

  const handleFacebookOAuth = async () => {
    clearError();
    setDiagnosticHint(null);
    try {
      await loginWithFacebookOAuth({
        email: email.trim() || undefined,
        fullName: oauthFullName.trim() || undefined,
      });
      navigate(redirect, { replace: true });
    } catch (err) {
      setDiagnosticHint(resolveAuthHint(asHttpError(err)));
    }
  };

  return (
    <section className="card" style={{ maxWidth: 480, marginInline: 'auto' }}>
      <h1 className="page-title">{t('auth.loginTitle')}</h1>
      <p className="page-subtitle">{t('auth.loginSubtitle')}</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <p className="muted-text" style={{ marginBottom: 6 }}>
          {pick('عنوان API الحالي', 'Current API base')}: <code>{apiBaseUrl}</code>
        </p>
        {apiStatus === 'checking' ? <p className="muted-text">{pick('جارٍ فحص اتصال الخادم...', 'Checking backend connectivity...')}</p> : null}
        {apiStatus === 'online' ? <p className="success-text">{pick('الخادم متاح.', 'Backend is reachable.')}</p> : null}
        {apiStatus === 'offline' ? (
          <p className="error-text">
            {pick('الخادم غير متاح الآن. تأكد من تشغيل backend ثم أعد المحاولة.', 'Backend is unreachable. Start backend and retry.')}
          </p>
        ) : null}
        <div className="button-row">
          <button type="button" className="button button--ghost" onClick={() => void runHealthCheck()}>
            {pick('إعادة الفحص', 'Re-check')}
          </button>
          <a className="button button--ghost" href={`${apiBaseUrl}/health`} target="_blank" rel="noreferrer">
            {pick('فتح health', 'Open health')}
          </a>
        </div>
      </div>

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
        {diagnosticHint ? <p className="muted-text">{diagnosticHint}</p> : null}

        <div className="button-row">
          <button className="button button--primary" type="submit" disabled={isLoading || apiStatus === 'offline'}>
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
            disabled={isLoading || !email.trim() || apiStatus === 'offline'}
            onClick={() => void handleGoogleOAuth()}
          >
            {t('auth.continueWithGoogle')}
          </button>
          <button
            className="button button--ghost"
            type="button"
            disabled={isLoading || !email.trim() || apiStatus === 'offline'}
            onClick={() => void handleFacebookOAuth()}
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
