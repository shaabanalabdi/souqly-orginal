import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation('common');
  return (
    <section className="card" style={{ maxWidth: 560, marginInline: 'auto' }}>
      <h1 className="page-title">{t('pageNotFound')}</h1>
      <p className="page-subtitle">{t('routeDoesNotExist')}</p>
      <Link to="/" className="button button--primary">
        {t('backToHomepage')}
      </Link>
    </section>
  );
}
