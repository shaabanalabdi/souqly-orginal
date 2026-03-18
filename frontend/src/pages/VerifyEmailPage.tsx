import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth.service';
import { asHttpError } from '../services/http';

type VerificationState = 'idle' | 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const { t } = useTranslation('auth');
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') ?? '', [location.search]);
  const [state, setState] = useState<VerificationState>('idle');
  const [message, setMessage] = useState<string>(t('waitingForVerification'));

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setState('error');
        setMessage(t('missingVerificationToken'));
        return;
      }

      setState('loading');
      setMessage(t('verifyingEmail'));
      try {
        await authService.verifyEmail(token);
        setState('success');
        setMessage(t('emailVerifiedSuccess'));
      } catch (err) {
        setState('error');
        setMessage(asHttpError(err).message);
      }
    };

    void run();
  }, [token, t]);

  return (
    <section className="card" style={{ maxWidth: 520, marginInline: 'auto' }}>
      <h1 className="page-title">{t('emailVerificationTitle')}</h1>
      <p className={state === 'error' ? 'error-text' : state === 'success' ? 'success-text' : 'muted-text'}>
        {message}
      </p>
      <div className="button-row">
        <Link to="/login" className="button button--primary">
          {t('goToLogin')}
        </Link>
        <Link to="/register" className="button button--ghost">
          {t('backToRegister')}
        </Link>
      </div>
    </section>
  );
}
