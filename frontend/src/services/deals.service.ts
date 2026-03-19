import { requestData, requestPaginated } from './client';
import type {
  Deal,
  DealDisputeResolution,
  DealReview,
  DealStatus,
  DealSummary,
  DeliveryMethod,
} from '../types/domain';

export interface CreateDealFromOfferPayload {
  offerId: number;
  finalPrice?: number;
  quantity?: number;
  currency?: string;
  meetingPlace?: string;
  meetingLat?: number;
  meetingLng?: number;
  meetingTime?: string;
  deliveryMethod?: DeliveryMethod;
  courierName?: string;
  trackingNumber?: string;
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
}

export interface OpenDisputePayload {
  reason: string;
  description: string;
}

export interface ReviewDisputePayload {
  note?: string;
}

export interface ResolveDisputePayload {
  action: 'close_no_escrow';
  resolution?: string;
}

export const dealsService = {
  listMyDeals(status?: DealStatus, page = 1, limit = 20) {
    return requestPaginated<DealSummary>({
      method: 'GET',
      url: '/deals/my',
      params: { status, page, limit },
    });
  },

  createFromOffer(payload: CreateDealFromOfferPayload) {
    return requestData<Deal>({
      method: 'POST',
      url: '/deals/from-offer',
      data: payload,
    });
  },

  confirmDeal(dealId: number) {
    return requestData<Deal>({
      method: 'PATCH',
      url: `/deals/${dealId}/confirm`,
    });
  },

  openDispute(dealId: number, payload: OpenDisputePayload) {
    return requestData<DealDisputeResolution>({
      method: 'POST',
      url: `/deals/${dealId}/dispute`,
      data: payload,
    });
  },

  reviewDispute(dealId: number, payload: ReviewDisputePayload = {}) {
    return requestData<DealDisputeResolution>({
      method: 'PATCH',
      url: `/deals/${dealId}/dispute/review`,
      data: payload,
    });
  },

  resolveDispute(dealId: number, payload: ResolveDisputePayload) {
    return requestData<DealDisputeResolution>({
      method: 'PATCH',
      url: `/deals/${dealId}/dispute/resolve`,
      data: payload,
    });
  },

  createReview(dealId: number, payload: CreateReviewPayload) {
    return requestData<DealReview>({
      method: 'POST',
      url: `/deals/${dealId}/reviews`,
      data: payload,
    });
  },
};
