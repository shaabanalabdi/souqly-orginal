import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { asHttpError } from '../services/http';

export function ForgotPasswordPage() {
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
      setMessage('If this email exists, a password reset link has been sent.');
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card" style={{ maxWidth: 500, marginInline: 'auto' }}>
      <h1 className="page-title">Forgot Password</h1>
      <p className="page-subtitle">Enter your email to request a reset link.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">Email</span>
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
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
          <Link to="/login" className="button button--ghost">
            Back to login
          </Link>
        </div>
      </form>
    </section>
  );
}
