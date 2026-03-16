import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';

export function RegisterPage() {
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
    setSuccessMessage(`Registration completed for ${result.email}. Please verify your email before login.`);
  };

  const handleResend = async () => {
    try {
      if (!email) {
        setResendMessage('Enter your email first.');
        return;
      }
      await authService.resendVerification(email);
      setResendMessage('If your account is unverified, a new link was sent.');
    } catch (err) {
      setResendMessage(asHttpError(err).message);
    }
  };

  return (
    <section className="card" style={{ maxWidth: 540, marginInline: 'auto' }}>
      <h1 className="page-title">Create account</h1>
      <p className="page-subtitle">Password must include uppercase, lowercase, number, and symbol.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="label">Full name</span>
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
            {isLoading ? 'Creating...' : 'Register'}
          </button>
          <button type="button" className="button button--ghost" onClick={handleResend}>
            Resend verification
          </button>
        </div>
      </form>

      <p className="muted-text">
        Already have account? <Link to="/login">Login</Link>
      </p>
    </section>
  );
}
