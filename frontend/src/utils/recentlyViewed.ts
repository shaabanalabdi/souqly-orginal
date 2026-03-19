const RECENTLY_VIEWED_KEY = 'souqly_recently_viewed_listing_ids';
const MAX_RECENT_ITEMS = 12;

export function getRecentlyViewedListingIds(): number[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
      .slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

export function addRecentlyViewedListingId(listingId: number): number[] {
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return getRecentlyViewedListingIds();
  }

  const existing = getRecentlyViewedListingIds();
  const next = [listingId, ...existing.filter((value) => value !== listingId)].slice(0, MAX_RECENT_ITEMS);

  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota and private mode storage errors.
  }

  return next;
}
