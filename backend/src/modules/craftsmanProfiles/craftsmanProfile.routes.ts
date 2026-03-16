import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    getMyCraftsmanProfileController,
    upsertMyCraftsmanProfileController,
} from './craftsmanProfile.controller.js';
import { upsertCraftsmanProfileBodySchema } from './craftsmanProfile.validation.js';

const craftsmanProfileRoutes = Router();

craftsmanProfileRoutes.use(authenticate);

craftsmanProfileRoutes.get('/craftsman-profile/me', getMyCraftsmanProfileController);
craftsmanProfileRoutes.put(
    '/craftsman-profile/me',
    validate({ body: upsertCraftsmanProfileBodySchema }),
    upsertMyCraftsmanProfileController,
);

export default craftsmanProfileRoutes;
