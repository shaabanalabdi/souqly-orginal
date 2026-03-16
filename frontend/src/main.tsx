import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import i18n from './i18n';
import './styles/global.scss';

const lang = localStorage.getItem('souqly_lang') || 'ar';
document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
document.documentElement.setAttribute('lang', lang);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            fontFamily: 'IBM Plex Sans Arabic, sans-serif',
            fontSize: '1.25rem',
            color: '#64748B',
          }}
        >
          {i18n.t('common.loading')}
        </div>
      }
    >
      <App />
    </Suspense>
  </StrictMode>,
);
