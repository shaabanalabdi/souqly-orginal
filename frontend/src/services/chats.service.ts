import { requestData, requestPaginated } from './client';
import type { ChatMessage, Offer, ThreadSummary } from '../types/domain';

export interface SendMessagePayload {
  type?: 'TEXT' | 'IMAGE';
  content?: string;
  imageUrl?: string;
}

export interface CreateOfferPayload {
  amount: number;
  quantity?: number;
  message?: string;
}

export interface RespondOfferPayload {
  action: 'accept' | 'reject' | 'counter';
  counterAmount?: number;
}

export const chatsService = {
  createOrGetThread(listingId: number) {
    return requestData<{ created: boolean; thread: ThreadSummary }>({
      method: 'POST',
      url: '/chats/threads',
      data: { listingId },
    });
  },

  listThreads(page = 1, limit = 20) {
    return requestPaginated<ThreadSummary>({
      method: 'GET',
      url: '/chats/threads',
      params: { page, limit },
    });
  },

  unreadCount() {
    return requestData<{ unreadCount: number }>({
      method: 'GET',
      url: '/chats/unread-count',
    });
  },

  listMessages(threadId: number, page = 1, limit = 50) {
    return requestPaginated<ChatMessage>({
      method: 'GET',
      url: `/chats/threads/${threadId}/messages`,
      params: { page, limit },
    });
  },

  sendMessage(threadId: number, payload: SendMessagePayload) {
    return requestData<ChatMessage>({
      method: 'POST',
      url: `/chats/threads/${threadId}/messages`,
      data: payload,
    });
  },

  requestPhone(threadId: number, message?: string) {
    return requestData<ChatMessage>({
      method: 'POST',
      url: `/chats/threads/${threadId}/phone-request`,
      data: { message },
    });
  },

  createOffer(threadId: number, payload: CreateOfferPayload) {
    return requestData<Offer>({
      method: 'POST',
      url: `/chats/threads/${threadId}/offers`,
      data: payload,
    });
  },

  respondOffer(offerId: number, payload: RespondOfferPayload) {
    return requestData<Offer>({
      method: 'PATCH',
      url: `/chats/offers/${offerId}/respond`,
      data: payload,
    });
  },
};
