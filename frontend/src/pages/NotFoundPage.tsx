import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="card" style={{ maxWidth: 560, marginInline: 'auto' }}>
      <h1 className="page-title">404 - Page Not Found</h1>
      <p className="page-subtitle">The requested route does not exist.</p>
      <Link to="/" className="button button--primary">
        Back to homepage
      </Link>
    </section>
  );
}
