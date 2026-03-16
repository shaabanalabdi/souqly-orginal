import { type FormEvent, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { asHttpError } from '../services/http';

export function ResetPasswordPage() {
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
      setError('Missing reset token in URL.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword });
      setMessage('Password has been updated successfully.');
      setNewPassword('');
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card" style={{ maxWidth: 500, marginInline: 'auto' }}>
      <h1 className="page-title">Reset Password</h1>
      <p className="page-subtitle">Set a new strong password.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">New Password</span>
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
            {loading ? 'Updating...' : 'Update password'}
          </button>
          <Link to="/login" className="button button--ghost">
            Back to login
          </Link>
        </div>
      </form>
    </section>
  );
}
