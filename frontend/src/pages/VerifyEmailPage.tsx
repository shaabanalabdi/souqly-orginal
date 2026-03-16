import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { asHttpError } from '../services/http';

type VerificationState = 'idle' | 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') ?? '', [location.search]);
  const [state, setState] = useState<VerificationState>('idle');
  const [message, setMessage] = useState<string>('Waiting for verification...');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setState('error');
        setMessage('Missing verification token.');
        return;
      }

      setState('loading');
      setMessage('Verifying your email...');
      try {
        await authService.verifyEmail(token);
        setState('success');
        setMessage('Email verified. You can now login.');
      } catch (err) {
        setState('error');
        setMessage(asHttpError(err).message);
      }
    };

    void run();
  }, [token]);

  return (
    <section className="card" style={{ maxWidth: 520, marginInline: 'auto' }}>
      <h1 className="page-title">Email Verification</h1>
      <p className={state === 'error' ? 'error-text' : state === 'success' ? 'success-text' : 'muted-text'}>
        {message}
      </p>
      <div className="button-row">
        <Link to="/login" className="button button--primary">
          Go to login
        </Link>
        <Link to="/register" className="button button--ghost">
          Back to register
        </Link>
      </div>
    </section>
  );
}
