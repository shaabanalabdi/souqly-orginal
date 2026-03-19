import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyStatePanel, ErrorStatePanel, LoadingState } from '../components/ui';
import { categoriesService } from '../services/categories.service';
import { asHttpError } from '../services/http';
import { listingsService } from '../services/listings.service';
import type { CategorySubcategories } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

interface SubcategoryCount {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export function CategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const navigate = useNavigate();
  const { pick } = useLocaleSwitch();
  const [data, setData] = useState<CategorySubcategories | null>(null);
  const [subcategories, setSubcategories] = useState<SubcategoryCount[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!categorySlug) {
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const categoryResult = await categoriesService.listSubcategories(categorySlug);
        const [categoryListings, ...counts] = await Promise.all([
          listingsService.list({ categorySlug, page: 1, limit: 1 }),
          ...categoryResult.subcategories.map((item) =>
            listingsService.list({ subcategoryId: item.id, page: 1, limit: 1 }).then((result) => ({
              id: item.id,
              slug: item.slug,
              name: item.name,
              count: result.meta.total,
            })),
          ),
        ]);

        if (!active) {
          return;
        }

        setData(categoryResult);
        setSubcategories(counts as SubcategoryCount[]);
        setTotalListings(categoryListings.meta.total);
      } catch (error) {
        if (active) {
          setErrorMessage(asHttpError(error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [categorySlug]);

  const sortedSubcategories = useMemo(
    () => [...subcategories].sort((left, right) => right.count - left.count),
    [subcategories],
  );

  if (loading) {
    return <LoadingState text={pick('جارٍ تحميل التصنيف...', 'Loading category...')} />;
  }

  if (errorMessage || !data) {
    return (
      <ErrorStatePanel
        title={pick('تعذر تحميل التصنيف', 'Failed to load category')}
        message={errorMessage || pick('هذا التصنيف غير متاح حاليًا.', 'This category is currently unavailable.')}
      />
    );
  }

  return (
    <section className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-r from-primary to-blue-700 px-6 py-8 text-white shadow-soft">
        <p className="text-sm text-blue-100">{pick('التصنيفات', 'Categories')}</p>
        <h1 className="mt-2 text-3xl font-black">{data.category.name}</h1>
        <p className="mt-3 text-sm text-blue-50">
          {pick('إجمالي الإعلانات النشطة في هذا التصنيف', 'Active listings in this category')}: {totalListings}
        </p>
      </header>

      {sortedSubcategories.length === 0 ? (
        <EmptyStatePanel
          title={pick('لا توجد تصنيفات فرعية', 'No subcategories')}
          description={pick('لم يتم تفعيل أي تصنيف فرعي داخل هذا القسم بعد.', 'No subcategories are enabled in this section yet.')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedSubcategories.map((subcategory) => (
            <article key={subcategory.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">{subcategory.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {pick('إعلانات نشطة', 'Active listings')}: {subcategory.count}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
                  {subcategory.slug}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Link
                  to={`/search?category=${encodeURIComponent(data.category.slug)}`}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-blue-900"
                >
                  {pick('عرض النتائج', 'View Results')}
                </Link>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary"
                  onClick={() => navigate(`/search?category=${encodeURIComponent(data.category.slug)}`)}
                >
                  {pick('فتح البحث', 'Open Search')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
