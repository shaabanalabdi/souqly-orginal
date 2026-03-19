import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountShell } from '../components/AccountShell';
import { ListingCard } from '../components/ListingCard';
import { Button, EmptyStatePanel, ErrorStatePanel, LoadingState, useToast } from '../components/ui';
import { preferencesService } from '../services/preferences.service';
import { asHttpError } from '../services/http';
import type { FavoriteSummary } from '../types/domain';
import { formatDate } from '../utils/format';
import { useLocaleSwitch } from '../utils/localeSwitch';

export function FavoritesPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const { locale, pick } = useLocaleSwitch();
  const [favorites, setFavorites] = useState<FavoriteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadFavorites = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await preferencesService.listFavorites(1, 48);
      setFavorites(result.items);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, []);

  const cards = useMemo(
    () =>
      favorites.map((favorite) => ({
        id: favorite.listing.id,
        title: favorite.listing.title,
        price: favorite.listing.priceAmount ?? 0,
        currency: favorite.listing.currency ?? 'USD',
        location: `${favorite.listing.countryName} - ${favorite.listing.cityName}`,
        imageUrl: favorite.listing.coverImage ?? undefined,
        createdAt: favorite.createdAt,
      })),
    [favorites],
  );

  return (
    <AccountShell
      title={pick('المفضلة', 'Favorites')}
      description={pick('كل الإعلانات التي حفظتها للعودة إليها لاحقًا.', 'All listings you saved for later.')}
    >
      {loading ? (
        <LoadingState text={pick('جارٍ تحميل المفضلة...', 'Loading favorites...')} />
      ) : errorMessage ? (
        <ErrorStatePanel
          title={pick('تعذر تحميل المفضلة', 'Failed to load favorites')}
          message={errorMessage}
          action={<Button variant="secondary" onClick={() => void loadFavorites()}>{pick('إعادة المحاولة', 'Retry')}</Button>}
        />
      ) : cards.length === 0 ? (
        <EmptyStatePanel
          title={pick('لا توجد عناصر مفضلة', 'No Favorites Yet')}
          description={pick('أضف الإعلانات التي تهمك لتظهر هنا.', 'Save listings you care about to see them here.')}
          action={<Button onClick={() => navigate('/search')}>{pick('استكشاف الإعلانات', 'Browse Listings')}</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((favorite) => (
            <div key={favorite.id} className="space-y-2">
              <ListingCard
                id={favorite.id}
                title={favorite.title}
                price={favorite.price}
                currency={favorite.currency}
                location={favorite.location}
                imageUrl={favorite.imageUrl}
                isFavorite
                locale={locale}
                onOpen={(id) => navigate(`/listings/${id}`)}
                onToggleFavorite={async (id, nextState) => {
                  if (nextState) {
                    return;
                  }

                  setBusyId(Number(id));
                  try {
                    await preferencesService.removeFavorite(Number(id));
                    setFavorites((prev) => prev.filter((item) => item.listing.id !== Number(id)));
                    push(pick('تمت إزالة الإعلان من المفضلة.', 'Listing removed from favorites.'), 'success');
                  } catch (error) {
                    push(asHttpError(error).message, 'error');
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
              <div className="flex items-center justify-between px-1 text-xs text-muted">
                <span>{pick('أضيفت في', 'Saved on')}: {formatDate(favorite.createdAt)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  isLoading={busyId === favorite.id}
                  onClick={async () => {
                    setBusyId(favorite.id);
                    try {
                      await preferencesService.removeFavorite(favorite.id);
                      setFavorites((prev) => prev.filter((item) => item.favoriteId !== favorite.id));
                    } catch (error) {
                      push(asHttpError(error).message, 'error');
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  {pick('إزالة', 'Remove')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
