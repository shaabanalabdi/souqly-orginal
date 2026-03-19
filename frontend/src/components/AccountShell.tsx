import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLocaleSwitch } from '../utils/localeSwitch';

interface AccountShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

interface AccountNavItem {
  href: string;
  labelAr: string;
  labelEn: string;
  icon: string;
}

const NAV_ITEMS: AccountNavItem[] = [
  { href: '/dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', icon: 'dashboard' },
  { href: '/my-listings', labelAr: 'إعلاناتي', labelEn: 'My Listings', icon: 'inventory_2' },
  { href: '/profile', labelAr: 'الملف', labelEn: 'Profile', icon: 'person' },
  { href: '/favorites', labelAr: 'المفضلة', labelEn: 'Favorites', icon: 'favorite' },
  { href: '/saved-searches', labelAr: 'عمليات البحث المحفوظة', labelEn: 'Saved Searches', icon: 'saved_search' },
  { href: '/notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: 'notifications' },
  { href: '/offers', labelAr: 'عروض الأسعار', labelEn: 'Price Offers', icon: 'sell' },
  { href: '/security', labelAr: 'التحقق والأمان', labelEn: 'Security', icon: 'verified_user' },
];

export function AccountShell({ title, description, children }: AccountShellProps) {
  const location = useLocation();
  const { pick } = useLocaleSwitch();

  return (
    <section className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="text-lg font-black text-ink">{pick('إدارة الحساب', 'Account')}</h2>
        <p className="mt-1 text-sm text-muted">
          {pick('الوصول السريع إلى الصفحات الأساسية في حسابك.', 'Quick access to core account pages.')}
        </p>

        <nav className="mt-4 grid gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-blue-50 text-primary' : 'text-ink hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-base">{item.icon}</span>
                <span>{pick(item.labelAr, item.labelEn)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <h1 className="text-2xl font-black text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">{description}</p>
        </header>

        {children}
      </div>
    </section>
  );
}
