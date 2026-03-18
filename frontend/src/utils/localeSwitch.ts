import { useTranslation } from 'react-i18next';

export function useLocaleSwitch() {
  const { i18n } = useTranslation();
  const isArabic = i18n.resolvedLanguage?.startsWith('ar') ?? i18n.language === 'ar';
  const locale = isArabic ? 'ar-SA' : 'en-US';

  const pick = (arabicText: string, englishText: string): string => (isArabic ? arabicText : englishText);

  return { isArabic, locale, pick };
}
