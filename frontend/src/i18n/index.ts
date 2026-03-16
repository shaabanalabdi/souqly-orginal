// ============================================
// Souqly - i18n Configuration
// ============================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'ar',
        supportedLngs: ['ar', 'en'],
        defaultNS: 'translation',
        ns: ['translation'],

        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
        },

        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'souqly_lang',
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

i18n.on('languageChanged', (lng: string) => {
    setDirection(lng);
});
