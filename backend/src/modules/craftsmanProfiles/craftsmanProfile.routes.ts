import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    createCraftsmanLeadController,
    getPublicCraftsmanProfileController,
    listCraftsmanListingsController,
    listMyCraftsmanLeadsController,
    getMyCraftsmanProfileController,
    upsertMyCraftsmanProfileController,
} from './craftsmanProfile.controller.js';
import {
    craftsmanLeadBodySchema,
    craftsmanLeadsQuerySchema,
    craftsmanIdParamsSchema,
    craftsmanListingsQuerySchema,
    upsertCraftsmanProfileBodySchema,
} from './craftsmanProfile.validation.js';

const craftsmanProfileRoutes = Router();

craftsmanProfileRoutes.get(
    '/craftsmen/:id',
    validate({ params: craftsmanIdParamsSchema }),
    getPublicCraftsmanProfileController,
);

craftsmanProfileRoutes.get(
    '/craftsmen/:id/listings',
    validate({ params: craftsmanIdParamsSchema, query: craftsmanListingsQuerySchema }),
    listCraftsmanListingsController,
);
craftsmanProfileRoutes.post(
    '/craftsmen/:id/leads',
    validate({ params: craftsmanIdParamsSchema, body: craftsmanLeadBodySchema }),
    createCraftsmanLeadController,
);

craftsmanProfileRoutes.get('/craftsman-profile/me', authenticate, getMyCraftsmanProfileController);
craftsmanProfileRoutes.get(
    '/craftsman-profile/me/leads',
    authenticate,
    validate({ query: craftsmanLeadsQuerySchema }),
    listMyCraftsmanLeadsController,
);
craftsmanProfileRoutes.put(
    '/craftsman-profile/me',
    authenticate,
    validate({ body: upsertCraftsmanProfileBodySchema }),
    upsertMyCraftsmanProfileController,
);

export default craftsmanProfileRoutes;
