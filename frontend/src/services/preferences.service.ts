import { requestData, requestPaginated } from './client';
import type { FavoriteSummary, NotificationFrequency, SavedSearch } from '../types/domain';

export interface SavedSearchPayload {
  name: string;
  filters: Record<string, unknown>;
  notificationFrequency?: NotificationFrequency;
}

export interface SavedSearchUpdatePayload {
  name?: string;
  filters?: Record<string, unknown>;
  notificationFrequency?: NotificationFrequency;
}

export const preferencesService = {
  listFavorites(page = 1, limit = 20) {
    return requestPaginated<FavoriteSummary>({
      method: 'GET',
      url: '/favorites',
      params: { page, limit },
    });
  },

  addFavorite(listingId: number) {
    return requestData<{ favorited: true; alreadyFavorited: boolean; favorite: FavoriteSummary }>({
      method: 'POST',
      url: `/favorites/${listingId}`,
    });
  },

  removeFavorite(listingId: number) {
    return requestData<{ removed: boolean }>({
      method: 'DELETE',
      url: `/favorites/${listingId}`,
    });
  },

  listSavedSearches(page = 1, limit = 20) {
    return requestPaginated<SavedSearch>({
      method: 'GET',
      url: '/saved-searches',
      params: { page, limit },
    });
  },

  createSavedSearch(payload: SavedSearchPayload) {
    return requestData<SavedSearch>({
      method: 'POST',
      url: '/saved-searches',
      data: payload,
    });
  },

  updateSavedSearch(id: number, payload: SavedSearchUpdatePayload) {
    return requestData<SavedSearch>({
      method: 'PATCH',
      url: `/saved-searches/${id}`,
      data: payload,
    });
  },

  deleteSavedSearch(id: number) {
    return requestData<{ deleted: true }>({
      method: 'DELETE',
      url: `/saved-searches/${id}`,
    });
  },
};
