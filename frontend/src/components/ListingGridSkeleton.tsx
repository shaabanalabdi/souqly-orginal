export interface ListingGridSkeletonProps {
  count?: number;
}

export function ListingGridSkeleton({ count = 6 }: ListingGridSkeletonProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <article key={`skeleton-${index + 1}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
          <div className="aspect-[4/3] animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
          </div>
        </article>
      ))}
    </div>
  );
}
