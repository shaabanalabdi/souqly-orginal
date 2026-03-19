import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from './Header';
import { Footer } from './Footer';
import { setDirection } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { marketplaceCountries } from '../pages/marketplaceMockData';
import { useLocaleSwitch } from '../utils/localeSwitch';
import { TARGET_MARKET_COUNTRY_CODES } from '../constants/market';

interface QuickLink {
  to: string;
  labelAr: string;
  labelEn: string;
  auth?: boolean;
  admin?: boolean;
}

const quickLinks: QuickLink[] = [
  { to: '/', labelAr: 'الرئيسية', labelEn: 'Home' },
  { to: '/search', labelAr: 'البحث', labelEn: 'Search' },
  { to: '/store', labelAr: 'المتجر', labelEn: 'Store' },
  { to: '/craftsman', labelAr: 'الحرفيين', labelEn: 'Craftsmen' },
  { to: '/listings/create', labelAr: 'إضافة إعلان', labelEn: 'Post Listing', auth: true },
  { to: '/chats', labelAr: 'المحادثات', labelEn: 'Chats', auth: true },
  { to: '/profile', labelAr: 'الملف الشخصي', labelEn: 'Profile', auth: true },
  { to: '/dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', auth: true },
  { to: '/admin', labelAr: 'الإدارة', labelEn: 'Admin', auth: true, admin: true },
];

function countryFlagFromCode(code: string): string {
  const upper = code.toUpperCase();
  if (upper === 'SY') return '🇸🇾';
  if (upper === 'JO') return '🇯🇴';
  if (upper === 'LB') return '🇱🇧';
  if (upper === 'PS') return '🇵🇸';
  if (upper === 'IQ') return '🇮🇶';
  return '🌍';
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const { isArabic, pick } = useLocaleSwitch();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [searchValue, setSearchValue] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    const countryCode = new URLSearchParams(window.location.search).get('countryCode')?.toUpperCase();
    const isSupported = !!countryCode && marketplaceCountries.some((country) => country.code === countryCode);
    return isSupported ? countryCode : TARGET_MARKET_COUNTRY_CODES[0];
  });

  const isAdminOrModerator = user?.staffRole === 'ADMIN' || user?.staffRole === 'MODERATOR';

  const visibleLinks = useMemo(
    () =>
      quickLinks.filter((link) => {
        if (link.auth && !isAuthenticated) return false;
        if (link.admin && !isAdminOrModerator) return false;
        return true;
      }),
    [isAdminOrModerator, isAuthenticated],
  );

  const onToggleLanguage = () => {
    const nextLang = isArabic ? 'en' : 'ar';
    void i18n.changeLanguage(nextLang);
    setDirection(nextLang);
  };

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  const onSearchSubmit = () => {
    const trimmed = searchValue.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (selectedCountry) params.set('countryCode', selectedCountry);
    params.set('page', '1');
    navigate(`/search?${params.toString()}`);
  };

  const onCountryChange = (code: string) => {
    setSelectedCountry(code);
    if (!location.pathname.startsWith('/search')) return;

    const params = new URLSearchParams(location.search);
    params.set('countryCode', code);
    params.delete('countryId');
    params.delete('cityId');
    params.set('page', '1');
    navigate(`/search?${params.toString()}`);
  };

  const hideHeaderAndFooter = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      {!hideHeaderAndFooter ? (
        <>
          <Header
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onSearchSubmit={onSearchSubmit}
            countries={marketplaceCountries.map((country) => ({
              code: country.code,
              label: pick(country.labelAr, country.labelEn),
              flag: countryFlagFromCode(country.code),
            }))}
            selectedCountryCode={selectedCountry}
            onCountryChange={onCountryChange}
            language={isArabic ? 'ar' : 'en'}
            onToggleLanguage={onToggleLanguage}
            isAuthenticated={isAuthenticated}
            userName={user?.fullName ?? user?.email ?? undefined}
            onProfile={() => navigate('/profile')}
            onLogin={() => navigate('/login')}
            onRegister={() => navigate('/register')}
            onLogout={onLogout}
            labels={{
              searchPlaceholder: pick('ابحث عن سيارات، عقارات، خدمات...', 'Search cars, real estate, services...'),
              searchButton: pick('بحث', 'Search'),
              countryLabel: pick('الدولة', 'Country'),
              chooseCountry: pick('اختيار الدولة', 'Choose Country'),
              login: pick('دخول', 'Login'),
              register: pick('حساب جديد', 'Register'),
              profile: pick('الملف الشخصي', 'Profile'),
              logout: isLoading ? pick('جارٍ الخروج...', 'Logging out...') : pick('خروج', 'Logout'),
            }}
          />

          <nav className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2">
              {visibleLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      isActive ? 'bg-primary text-white' : 'text-ink hover:bg-slate-100'
                    }`
                  }
                >
                  {pick(link.labelAr, link.labelEn)}
                </NavLink>
              ))}
            </div>
          </nav>
        </>
      ) : null}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      {!hideHeaderAndFooter ? (
        <Footer
          links={[
            { href: '/search', label: pick('تصفح الإعلانات', 'Browse Listings') },
            { href: '/store', label: pick('المتجر', 'Store') },
            { href: '/terms', label: pick('الشروط', 'Terms') },
            { href: '/privacy', label: pick('الخصوصية', 'Privacy') },
            { href: '/craftsman', label: pick('الحرفيون', 'Craftsmen') },
          ]}
          copyrightText={pick('جميع الحقوق محفوظة.', 'All rights reserved.')}
        />
      ) : null}
    </div>
  );
}
