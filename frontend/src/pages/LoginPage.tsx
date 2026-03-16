import { type FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
      <h1 className="page-title">Login</h1>
      <p className="page-subtitle">Use your verified email and password.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">Password</span>
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
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
          <Link className="button button--ghost" to="/forgot-password">
            Forgot password
          </Link>
        </div>
      </form>

      <div className="stack" style={{ marginTop: 16 }}>
        <label className="field">
          <span className="label">OAuth display name (optional)</span>
          <input
            className="input"
            type="text"
            value={oauthFullName}
            onChange={(event) => setOauthFullName(event.target.value)}
            placeholder="Used in foundation/mock mode"
          />
        </label>

        <div className="button-row">
          <button
            className="button button--ghost"
            type="button"
            disabled={isLoading || !email.trim()}
            onClick={handleGoogleOAuth}
          >
            Continue with Google
          </button>
          <button
            className="button button--ghost"
            type="button"
            disabled={isLoading || !email.trim()}
            onClick={handleFacebookOAuth}
          >
            Continue with Facebook
          </button>
        </div>
      </div>

      <p className="muted-text">
        No account? <Link to="/register">Register</Link>
      </p>
    </section>
  );
}
