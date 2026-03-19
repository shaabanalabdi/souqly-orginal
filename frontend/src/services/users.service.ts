import { requestData, requestPaginated } from './client';
import type { PublicUserListing, PublicUserProfileDto, PublicUserReview } from '../types/domain';

export const usersService = {
  getPublicProfile(userId: number) {
    return requestData<PublicUserProfileDto>({
      method: 'GET',
      url: `/users/${userId}/public`,
    });
  },

  listPublicListings(userId: number, page = 1, limit = 12) {
    return requestPaginated<PublicUserListing>({
      method: 'GET',
      url: `/users/${userId}/listings`,
      params: { page, limit },
    });
  },

  listPublicReviews(userId: number, page = 1, limit = 20) {
    return requestPaginated<PublicUserReview>({
      method: 'GET',
      url: `/users/${userId}/reviews`,
      params: { page, limit },
    });
  },
};
