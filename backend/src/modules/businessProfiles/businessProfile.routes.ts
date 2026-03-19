import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    getPublicStoreProfileController,
    getStoreAnalyticsController,
    listPublicStoreListingsController,
    getMyBusinessProfileController,
    upsertMyBusinessProfileController,
} from './businessProfile.controller.js';
import {
    storeAnalyticsQuerySchema,
    storeIdParamsSchema,
    storeListingsQuerySchema,
    upsertBusinessProfileBodySchema,
} from './businessProfile.validation.js';

const businessProfileRoutes = Router();

businessProfileRoutes.get(
    '/stores/:storeId',
    validate({ params: storeIdParamsSchema }),
    getPublicStoreProfileController,
);
businessProfileRoutes.get(
    '/stores/:storeId/listings',
    validate({ params: storeIdParamsSchema, query: storeListingsQuerySchema }),
    listPublicStoreListingsController,
);
businessProfileRoutes.get(
    '/stores/:storeId/analytics',
    authenticate,
    validate({ params: storeIdParamsSchema, query: storeAnalyticsQuerySchema }),
    getStoreAnalyticsController,
);

businessProfileRoutes.get('/business-profile/me', authenticate, getMyBusinessProfileController);
businessProfileRoutes.put(
    '/business-profile/me',
    authenticate,
    validate({ body: upsertBusinessProfileBodySchema }),
    upsertMyBusinessProfileController,
);

export default businessProfileRoutes;
