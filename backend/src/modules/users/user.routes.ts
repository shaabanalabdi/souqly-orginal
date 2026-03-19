import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    getMyProfileController,
    getPublicProfileController,
    listPublicUserListingsController,
    listPublicUserReviewsController,
    updateMyProfileController,
} from './user.controller.js';
import {
    publicUserParamsSchema,
    publicUserPaginationQuerySchema,
    updateMyProfileBodySchema,
} from './user.validation.js';

const userRoutes = Router();

userRoutes.get('/users/:id/public', validate({ params: publicUserParamsSchema }), getPublicProfileController);
userRoutes.get(
    '/users/:id/listings',
    validate({ params: publicUserParamsSchema, query: publicUserPaginationQuerySchema }),
    listPublicUserListingsController,
);
userRoutes.get(
    '/users/:id/reviews',
    validate({ params: publicUserParamsSchema, query: publicUserPaginationQuerySchema }),
    listPublicUserReviewsController,
);

userRoutes.get('/users/me/profile', authenticate, getMyProfileController);
userRoutes.patch(
    '/users/me/profile',
    authenticate,
    validate({ body: updateMyProfileBodySchema }),
    updateMyProfileController,
);

export default userRoutes;
