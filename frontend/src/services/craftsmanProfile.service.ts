import { requestData, requestPaginated } from './client';
import type {
  CompactListingSummary,
  CraftsmanProfileDto,
  PublicCraftsmanProfileDto,
  UpsertCraftsmanProfilePayload,
  UpsertCraftsmanProfileResult,
} from '../types/domain';

export const craftsmanProfileService = {
  getPublicProfile(id: number) {
    return requestData<PublicCraftsmanProfileDto>({
      method: 'GET',
      url: `/craftsmen/${id}`,
    });
  },

  listPublicListings(id: number, page = 1, limit = 20) {
    return requestPaginated<CompactListingSummary>({
      method: 'GET',
      url: `/craftsmen/${id}/listings`,
      params: { page, limit },
    });
  },

  trackLead(id: number, payload: { source: 'chat' | 'phone' | 'whatsapp' | 'direct'; message?: string }) {
    return requestData<{ tracked: true }>({
      method: 'POST',
      url: `/craftsmen/${id}/leads`,
      data: payload,
    });
  },

  me() {
    return requestData<CraftsmanProfileDto | null>({
      method: 'GET',
      url: '/craftsman-profile/me',
    });
  },

  upsert(payload: UpsertCraftsmanProfilePayload) {
    return requestData<UpsertCraftsmanProfileResult>({
      method: 'PUT',
      url: '/craftsman-profile/me',
      data: payload,
    });
  },
};
