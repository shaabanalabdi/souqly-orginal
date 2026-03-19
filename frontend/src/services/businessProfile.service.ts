import { requestData, requestPaginated } from './client';
import type {
  BusinessProfileDto,
  CompactListingSummary,
  PublicStoreProfileDto,
  StoreAnalyticsDto,
  UpsertBusinessProfilePayload,
  UpsertBusinessProfileResult,
} from '../types/domain';

export const businessProfileService = {
  getStore(storeId: number) {
    return requestData<PublicStoreProfileDto>({
      method: 'GET',
      url: `/stores/${storeId}`,
    });
  },

  listStoreListings(storeId: number, page = 1, limit = 20) {
    return requestPaginated<CompactListingSummary>({
      method: 'GET',
      url: `/stores/${storeId}/listings`,
      params: { page, limit },
    });
  },

  getStoreAnalytics(storeId: number, params: { from?: string; to?: string } = {}) {
    return requestData<StoreAnalyticsDto>({
      method: 'GET',
      url: `/stores/${storeId}/analytics`,
      params,
    });
  },

  me() {
    return requestData<BusinessProfileDto | null>({ method: 'GET', url: '/business-profile/me' });
  },

  upsert(payload: UpsertBusinessProfilePayload) {
    return requestData<UpsertBusinessProfileResult>({
      method: 'PUT',
      url: '/business-profile/me',
      data: payload,
    });
  },
};
