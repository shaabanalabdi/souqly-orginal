import { requestData, requestPaginated } from './client';
import type { ReportReason, ReportStatus, UserReport } from '../types/domain';

export interface CreateReportPayload {
  reportableType: 'LISTING' | 'USER' | 'MESSAGE';
  reportableId: number;
  reason: ReportReason;
  description?: string;
  listingId?: number;
}

export const reportsService = {
  create(payload: CreateReportPayload) {
    return requestData<UserReport>({
      method: 'POST',
      url: '/reports',
      data: payload,
    });
  },

  listMine(status?: ReportStatus, page = 1, limit = 20) {
    return requestPaginated<UserReport>({
      method: 'GET',
      url: '/reports/my',
      params: { status, page, limit },
    });
  },
};
