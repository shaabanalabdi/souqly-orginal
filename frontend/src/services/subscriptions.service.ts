import { requestData } from './client';
import type { CurrentStoreSubscriptionDto, StorePlanDto, StoreSubscriptionDto } from '../types/domain';

export const subscriptionsService = {
  listPlans() {
    return requestData<StorePlanDto[]>({ method: 'GET', url: '/subscriptions/plans' });
  },

  current() {
    return requestData<CurrentStoreSubscriptionDto>({ method: 'GET', url: '/subscriptions/current' });
  },

  subscribe(planCode: string, billingCycleMonths: 1 | 3 | 6 | 12 = 1, autoRenew = false) {
    return requestData<StoreSubscriptionDto>({
      method: 'POST',
      url: '/subscriptions/subscribe',
      data: { planCode, billingCycleMonths, autoRenew },
    });
  },

  cancel() {
    return requestData<StoreSubscriptionDto>({ method: 'POST', url: '/subscriptions/cancel' });
  },
};
