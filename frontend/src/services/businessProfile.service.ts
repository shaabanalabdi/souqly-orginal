import { requestData } from './client';
import type {
  BusinessProfileDto,
  UpsertBusinessProfilePayload,
  UpsertBusinessProfileResult,
} from '../types/domain';

export const businessProfileService = {
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
