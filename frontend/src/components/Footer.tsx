export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterSocialLink {
  label: string;
  href: string;
  icon: string;
}

export interface FooterProps {
  brandName?: string;
  links?: FooterLink[];
  socialLinks?: FooterSocialLink[];
  copyrightText?: string;
}

const DEFAULT_LINKS: FooterLink[] = [
  { label: 'من نحن', href: '/about' },
  { label: 'الشروط والأحكام', href: '/terms' },
  { label: 'سياسة الخصوصية', href: '/privacy' },
  { label: 'المحتوى المحظور', href: '/prohibited-content' },
  { label: 'المساعدة', href: '/help' },
  { label: 'اتصل بنا', href: '/contact' },
];

const DEFAULT_SOCIAL_LINKS: FooterSocialLink[] = [
  { label: 'Facebook', href: '#', icon: 'public' },
  { label: 'Instagram', href: '#', icon: 'photo_camera' },
  { label: 'YouTube', href: '#', icon: 'smart_display' },
  { label: 'WhatsApp', href: '#', icon: 'chat' },
];

export function Footer({
  brandName = 'Souqly',
  links = DEFAULT_LINKS,
  socialLinks = DEFAULT_SOCIAL_LINKS,
  copyrightText = 'جميع الحقوق محفوظة.',
}: FooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-black text-primary">{brandName}</p>
          <p className="mt-1 text-sm text-muted">{copyrightText}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="font-medium text-muted transition hover:text-primary">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              aria-label={link.label}
              className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-lg">{link.icon}</span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
