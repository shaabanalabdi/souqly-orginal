// ============================================
// Souqly - i18n Configuration
// ============================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

// Force Arabic as the default language
const savedLang = localStorage.getItem('souqly_lang') ?? 'ar';

i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init({
        lng: savedLang,
        fallbackLng: 'ar',
        supportedLngs: ['ar', 'en'],
        defaultNS: 'translation',
        ns: ['translation'],

        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
        },

        interpolation: {
            escapeValue: false, // React already escapes
        },

        react: {
            useSuspense: true,
        },
    });

export default i18n;

/**
 * Helper to set the document direction based on language
 */
export function setDirection(lang: string): void {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
}

// Apply direction immediately on load
setDirection(savedLang);

// Update direction whenever language changes
i18n.on('languageChanged', (lng: string) => {
    localStorage.setItem('souqly_lang', lng);
    setDirection(lng);
});
