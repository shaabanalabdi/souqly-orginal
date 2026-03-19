import { requestData, requestPaginated } from './client';
import type {
    CreateListingPayload,
    ListingDetails,
    ListingStatus,
    ListingQuery,
    ListingSummary,
    UpdateListingPayload,
} from '../types/domain';

export const listingsService = {
  list(query: ListingQuery = {}) {
    return requestPaginated<ListingSummary>({
      method: 'GET',
      url: '/listings',
      params: query,
    });
  },

  listMine(params: { status?: ListingStatus; page?: number; limit?: number } = {}) {
    return requestPaginated<ListingSummary>({
      method: 'GET',
      url: '/listings/my',
      params,
    });
  },

  details(id: number) {
    return requestData<ListingDetails>({
      method: 'GET',
      url: `/listings/${id}`,
    });
  },

  manageDetails(id: number) {
    return requestData<ListingDetails>({
      method: 'GET',
      url: `/listings/${id}/manage`,
    });
  },

  create(payload: CreateListingPayload) {
    return requestData<ListingDetails>({
      method: 'POST',
      url: '/listings',
      data: payload,
    });
  },

  update(id: number, payload: UpdateListingPayload) {
    return requestData<ListingDetails>({
      method: 'PATCH',
      url: `/listings/${id}`,
      data: payload,
    });
  },

  markSold(id: number) {
    return requestData<{ id: number; status: ListingStatus }>({
      method: 'POST',
      url: `/listings/${id}/mark-sold`,
    });
  },

  renew(id: number) {
    return requestData<{ id: number; status: ListingStatus; expiresAt: string | null }>({
      method: 'POST',
      url: `/listings/${id}/renew`,
    });
  },

  publish(id: number) {
    return requestData<ListingDetails>({
      method: 'POST',
      url: `/listings/${id}/publish`,
    });
  },

  remove(id: number) {
    return requestData<{ archived: true; status: ListingStatus }>({
      method: 'DELETE',
      url: `/listings/${id}`,
    });
  },
};
