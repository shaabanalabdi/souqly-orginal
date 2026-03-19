import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    cancelStoreSubscriptionController,
    confirmStoreSubscriptionCheckoutController,
    getCurrentStoreSubscriptionController,
    listStorePlansController,
    subscribeStorePlanController,
} from './subscription.controller.js';
import {
    confirmSubscriptionCheckoutBodySchema,
    subscribeBodySchema,
} from './subscription.validation.js';

const subscriptionRoutes = Router();

subscriptionRoutes.get('/subscriptions/plans', listStorePlansController);

subscriptionRoutes.use(authenticate);
subscriptionRoutes.get('/subscriptions/current', getCurrentStoreSubscriptionController);
subscriptionRoutes.post(
    '/subscriptions/subscribe',
    validate({ body: subscribeBodySchema }),
    subscribeStorePlanController,
);
subscriptionRoutes.post(
    '/subscriptions/checkout/confirm',
    validate({ body: confirmSubscriptionCheckoutBodySchema }),
    confirmStoreSubscriptionCheckoutController,
);
subscriptionRoutes.post('/subscriptions/cancel', cancelStoreSubscriptionController);

export default subscriptionRoutes;
