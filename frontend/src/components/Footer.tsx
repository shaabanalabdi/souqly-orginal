export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterProps {
  brandName?: string;
  links?: FooterLink[];
  copyrightText?: string;
}

const DEFAULT_LINKS: FooterLink[] = [
  { label: 'من نحن', href: '/about' },
  { label: 'الشروط والأحكام', href: '/terms' },
  { label: 'سياسة الخصوصية', href: '/privacy' },
  { label: 'المساعدة', href: '/help' },
  { label: 'اتصل بنا', href: '/contact' },
];

export function Footer({
  brandName = 'Souqly',
  links = DEFAULT_LINKS,
  copyrightText = 'جميع الحقوق محفوظة.',
}: FooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between">
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
      </div>
    </footer>
  );
}
