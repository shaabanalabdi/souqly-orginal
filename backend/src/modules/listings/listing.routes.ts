import { Router } from 'express';
import { authenticate, authenticateOptional } from '../../shared/middleware/authenticate.js';
import { createListingLimiter } from '../../shared/middleware/rateLimiter.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    createListingController,
    deleteListingController,
    featureListingController,
    getManageListingController,
    getListingByIdController,
    listNearbyListingsController,
    listListingsController,
    listMyListingsController,
    markListingSoldController,
    publishDraftListingController,
    renewListingController,
    updateListingController,
} from './listing.controller.js';
import {
    createListingBodySchema,
    featureListingBodySchema,
    listListingsQuerySchema,
    listMyListingsQuerySchema,
    listingIdParamsSchema,
    nearbyListingsQuerySchema,
    updateListingBodySchema,
} from './listing.validation.js';

const listingRoutes = Router();

listingRoutes.get('/listings', validate({ query: listListingsQuerySchema }), listListingsController);
listingRoutes.get('/listings/my', authenticate, validate({ query: listMyListingsQuerySchema }), listMyListingsController);
listingRoutes.get('/listings/:id/manage', authenticate, validate({ params: listingIdParamsSchema }), getManageListingController);
listingRoutes.get('/search/nearby', validate({ query: nearbyListingsQuerySchema }), listNearbyListingsController);
listingRoutes.get('/listings/:id', authenticateOptional, validate({ params: listingIdParamsSchema }), getListingByIdController);
listingRoutes.post(
    '/listings',
    authenticate,
    createListingLimiter,
    validate({ body: createListingBodySchema }),
    createListingController,
);
listingRoutes.patch(
    '/listings/:id',
    authenticate,
    validate({ params: listingIdParamsSchema, body: updateListingBodySchema }),
    updateListingController,
);
listingRoutes.delete('/listings/:id', authenticate, validate({ params: listingIdParamsSchema }), deleteListingController);
listingRoutes.post(
    '/listings/:id/mark-sold',
    authenticate,
    validate({ params: listingIdParamsSchema }),
    markListingSoldController,
);
listingRoutes.post(
    '/listings/:id/renew',
    authenticate,
    validate({ params: listingIdParamsSchema }),
    renewListingController,
);
listingRoutes.post(
    '/listings/:id/publish',
    authenticate,
    validate({ params: listingIdParamsSchema }),
    publishDraftListingController,
);
listingRoutes.post(
    '/listings/:id/feature',
    authenticate,
    validate({ params: listingIdParamsSchema, body: featureListingBodySchema }),
    featureListingController,
);

export default listingRoutes;
