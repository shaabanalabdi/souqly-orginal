import { requestData, requestPaginated } from './client';
import type {
  CreateListingPayload,
  ListingDetails,
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

  details(id: number) {
    return requestData<ListingDetails>({
      method: 'GET',
      url: `/listings/${id}`,
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
};
