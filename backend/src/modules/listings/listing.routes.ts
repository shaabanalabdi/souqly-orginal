import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { createListingLimiter } from '../../shared/middleware/rateLimiter.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    createListingController,
    getListingByIdController,
    listListingsController,
    updateListingController,
} from './listing.controller.js';
import {
    createListingBodySchema,
    listListingsQuerySchema,
    listingIdParamsSchema,
    updateListingBodySchema,
} from './listing.validation.js';

const listingRoutes = Router();

listingRoutes.get('/listings', validate({ query: listListingsQuerySchema }), listListingsController);
listingRoutes.get('/listings/:id', validate({ params: listingIdParamsSchema }), getListingByIdController);
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

export default listingRoutes;
