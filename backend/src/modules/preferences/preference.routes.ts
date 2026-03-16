import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    addFavoriteController,
    createSavedSearchController,
    deleteSavedSearchController,
    listFavoritesController,
    listSavedSearchesController,
    removeFavoriteController,
    updateSavedSearchController,
} from './preference.controller.js';
import {
    createSavedSearchBodySchema,
    listingIdParamsSchema,
    paginationQuerySchema,
    savedSearchIdParamsSchema,
    updateSavedSearchBodySchema,
} from './preference.validation.js';

const preferenceRoutes = Router();

preferenceRoutes.use(authenticate);

preferenceRoutes.get('/favorites', validate({ query: paginationQuerySchema }), listFavoritesController);
preferenceRoutes.post('/favorites/:listingId', validate({ params: listingIdParamsSchema }), addFavoriteController);
preferenceRoutes.delete('/favorites/:listingId', validate({ params: listingIdParamsSchema }), removeFavoriteController);

preferenceRoutes.get('/saved-searches', validate({ query: paginationQuerySchema }), listSavedSearchesController);
preferenceRoutes.post(
    '/saved-searches',
    validate({ body: createSavedSearchBodySchema }),
    createSavedSearchController,
);
preferenceRoutes.patch(
    '/saved-searches/:id',
    validate({ params: savedSearchIdParamsSchema, body: updateSavedSearchBodySchema }),
    updateSavedSearchController,
);
preferenceRoutes.delete(
    '/saved-searches/:id',
    validate({ params: savedSearchIdParamsSchema }),
    deleteSavedSearchController,
);

export default preferenceRoutes;
