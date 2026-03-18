import type { FormEvent } from 'react';

export interface HeaderCountryOption {
  code: string;
  label: string;
}

export interface HeaderLabels {
  searchPlaceholder: string;
  searchButton: string;
  countryLabel: string;
  login: string;
  register: string;
  profile: string;
  logout: string;
}

export interface HeaderProps {
  logoText?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  countries: HeaderCountryOption[];
  selectedCountryCode: string;
  onCountryChange: (code: string) => void;
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
  isAuthenticated: boolean;
  userName?: string;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => void;
  onProfile?: () => void;
  labels?: HeaderLabels;
}

const DEFAULT_LABELS: HeaderLabels = {
  searchPlaceholder: 'ابحث عن سيارات، عقارات، خدمات...',
  searchButton: 'بحث',
  countryLabel: 'الدولة',
  login: 'دخول',
  register: 'حساب جديد',
  profile: 'الملف الشخصي',
  logout: 'خروج',
};

function UserAvatar({ userName }: { userName?: string }) {
  const shortName = (userName || 'U').trim().slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
      {shortName}
    </span>
  );
}

export function Header({
  logoText = 'Souqly',
  searchValue,
  onSearchChange,
  onSearchSubmit,
  countries,
  selectedCountryCode,
  onCountryChange,
  language,
  onToggleLanguage,
  isAuthenticated,
  userName,
  onLogin,
  onRegister,
  onLogout,
  onProfile,
  labels = DEFAULT_LABELS,
}: HeaderProps) {
  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSearchSubmit();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
        <div className="flex items-center justify-between gap-4 md:min-w-[180px]">
          <a href="/" className="text-2xl font-black tracking-tight text-primary">
            {logoText}
          </a>

          <button
            type="button"
            onClick={onToggleLanguage}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-slate-50 md:hidden"
            aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex w-full items-center gap-2 md:flex-1">
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
            type="search"
            className="h-11 w-full rounded-xl border border-slate-200 bg-surface px-4 text-sm outline-none ring-primary transition focus:ring-2"
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-blue-900"
          >
            {labels.searchButton}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span>{labels.countryLabel}</span>
            <select
              value={selectedCountryCode}
              onChange={(event) => onCountryChange(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-primary"
              aria-label={labels.countryLabel}
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onToggleLanguage}
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 md:inline-flex"
            aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <UserAvatar userName={userName} />
              {onProfile ? (
                <button
                  type="button"
                  onClick={onProfile}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                >
                  {labels.profile}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onLogout}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-200"
              >
                {labels.logout}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLogin}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                {labels.login}
              </button>
              <button
                type="button"
                onClick={onRegister}
                className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
              >
                {labels.register}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
