import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    holdDealEscrowController,
    openDealDisputeController,
    resolveDealDisputeController,
    releaseDealEscrowController,
    refundDealEscrowController,
    reviewDealDisputeController,
    confirmDealController,
    createDealFromOfferController,
    createDealReviewController,
    getDealByIdController,
    listMyDealsController,
} from './deal.controller.js';
import {
    createDisputeBodySchema,
    createDealFromOfferBodySchema,
    createReviewBodySchema,
    dealIdParamsSchema,
    holdEscrowBodySchema,
    paginationQuerySchema,
    resolveDisputeBodySchema,
    reviewDisputeBodySchema,
} from './deal.validation.js';

const dealRoutes = Router();

dealRoutes.use(authenticate);

dealRoutes.get('/deals/my', validate({ query: paginationQuerySchema }), listMyDealsController);
dealRoutes.get('/deals/:id', validate({ params: dealIdParamsSchema }), getDealByIdController);
dealRoutes.post('/deals/from-offer', validate({ body: createDealFromOfferBodySchema }), createDealFromOfferController);
dealRoutes.patch('/deals/:id/confirm', validate({ params: dealIdParamsSchema }), confirmDealController);
dealRoutes.patch(
    '/deals/:id/escrow/hold',
    validate({ params: dealIdParamsSchema, body: holdEscrowBodySchema }),
    holdDealEscrowController,
);
dealRoutes.patch(
    '/deals/:id/escrow/release',
    validate({ params: dealIdParamsSchema }),
    releaseDealEscrowController,
);
dealRoutes.patch(
    '/deals/:id/escrow/refund',
    validate({ params: dealIdParamsSchema }),
    refundDealEscrowController,
);
dealRoutes.post(
    '/deals/:id/dispute',
    validate({ params: dealIdParamsSchema, body: createDisputeBodySchema }),
    openDealDisputeController,
);
dealRoutes.patch(
    '/deals/:id/dispute/review',
    validate({ params: dealIdParamsSchema, body: reviewDisputeBodySchema }),
    reviewDealDisputeController,
);
dealRoutes.patch(
    '/deals/:id/dispute/resolve',
    validate({ params: dealIdParamsSchema, body: resolveDisputeBodySchema }),
    resolveDealDisputeController,
);
dealRoutes.post(
    '/deals/:id/reviews',
    validate({ params: dealIdParamsSchema, body: createReviewBodySchema }),
    createDealReviewController,
);

export default dealRoutes;
