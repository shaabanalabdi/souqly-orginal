import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    getMyBusinessProfileController,
    upsertMyBusinessProfileController,
} from './businessProfile.controller.js';
import { upsertBusinessProfileBodySchema } from './businessProfile.validation.js';

const businessProfileRoutes = Router();

businessProfileRoutes.use(authenticate);

businessProfileRoutes.get('/business-profile/me', getMyBusinessProfileController);
businessProfileRoutes.put(
    '/business-profile/me',
    validate({ body: upsertBusinessProfileBodySchema }),
    upsertMyBusinessProfileController,
);

export default businessProfileRoutes;
