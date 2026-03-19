import type { ReactNode } from 'react';

interface StaticPageSection {
  title: string;
  body: ReactNode;
}

interface StaticPageLayoutProps {
  title: string;
  intro: string;
  sections: StaticPageSection[];
}

export function StaticPageLayout({ title, intro, sections }: StaticPageLayoutProps) {
  return (
    <section className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-r from-primary to-blue-700 px-6 py-10 text-white shadow-soft">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm text-blue-50">{intro}</p>
      </header>

      <div className="grid gap-4">
        {sections.map((section) => (
          <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-bold text-ink">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-muted">{section.body}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
