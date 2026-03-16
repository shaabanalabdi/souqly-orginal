import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    getMyIdentityVerificationController,
    submitIdentityVerificationController,
} from './verification.controller.js';
import { identityVerificationRequestBodySchema } from './verification.validation.js';

const verificationRoutes = Router();

verificationRoutes.use('/verification', authenticate);

verificationRoutes.get('/verification/identity/me', getMyIdentityVerificationController);
verificationRoutes.post(
    '/verification/identity/request',
    validate({ body: identityVerificationRequestBodySchema }),
    submitIdentityVerificationController,
);

export default verificationRoutes;
