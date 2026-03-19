import { requestData } from './client';
import type {
  CurrentStoreSubscriptionDto,
  StorePlanDto,
  StoreSubscriptionCheckoutDto,
  StoreSubscriptionDto,
} from '../types/domain';

function buildIdempotencyKey(): string {
  return `subscription-${crypto.randomUUID()}`;
}

export const subscriptionsService = {
  listPlans() {
    return requestData<StorePlanDto[]>({ method: 'GET', url: '/subscriptions/plans' });
  },

  current() {
    return requestData<CurrentStoreSubscriptionDto>({ method: 'GET', url: '/subscriptions/current' });
  },

  subscribe(planCode: string, billingCycleMonths: 1 | 3 | 6 | 12 = 1, autoRenew = false) {
    return requestData<StoreSubscriptionCheckoutDto>({
      method: 'POST',
      url: '/subscriptions/subscribe',
      data: { planCode, billingCycleMonths, autoRenew },
      headers: {
        'x-idempotency-key': buildIdempotencyKey(),
      },
    });
  },

  confirmCheckout(checkoutToken: string) {
    return requestData<StoreSubscriptionDto>({
      method: 'POST',
      url: '/subscriptions/checkout/confirm',
      data: { checkoutToken },
      headers: {
        'x-idempotency-key': buildIdempotencyKey(),
      },
    });
  },

  cancel() {
    return requestData<StoreSubscriptionDto>({ method: 'POST', url: '/subscriptions/cancel' });
  },
};
