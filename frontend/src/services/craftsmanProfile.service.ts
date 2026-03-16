import { requestData } from './client';
import type {
  CraftsmanProfileDto,
  UpsertCraftsmanProfilePayload,
  UpsertCraftsmanProfileResult,
} from '../types/domain';

export const craftsmanProfileService = {
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
