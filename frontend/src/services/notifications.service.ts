import { requestData, requestPaginated } from './client';
import type { AppNotification } from '../types/domain';

export const notificationsService = {
  list(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
    return requestPaginated<AppNotification>({
      method: 'GET',
      url: '/notifications',
      params,
    });
  },

  markRead(id: number) {
    return requestData<AppNotification>({
      method: 'PATCH',
      url: `/notifications/${id}/read`,
    });
  },

  markAllRead() {
    return requestData<{ updatedCount: number }>({
      method: 'PATCH',
      url: '/notifications/read-all',
    });
  },

  unreadCount() {
    return requestData<{ count: number }>({
      method: 'GET',
      url: '/notifications/unread-count',
    });
  },
};
