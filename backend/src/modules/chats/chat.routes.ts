import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { chatMessageLimiter } from '../../shared/middleware/rateLimiter.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    createOfferController,
    createThreadController,
    getPhoneRequestStateController,
    listMyOffersController,
    listMyThreadsController,
    listThreadMessagesController,
    respondPhoneRequestController,
    requestPhoneController,
    respondOfferController,
    sendMessageController,
    unreadCountController,
} from './chat.controller.js';
import {
    createOfferBodySchema,
    createThreadBodySchema,
    listOffersQuerySchema,
    offerIdParamsSchema,
    paginationQuerySchema,
    phoneRequestBodySchema,
    phoneRequestResponseBodySchema,
    respondOfferBodySchema,
    sendMessageBodySchema,
    threadIdParamsSchema,
} from './chat.validation.js';

const chatRoutes = Router();

chatRoutes.use(authenticate);

chatRoutes.get('/chats/offers', validate({ query: listOffersQuerySchema }), listMyOffersController);
chatRoutes.get('/chats/threads', validate({ query: paginationQuerySchema }), listMyThreadsController);
chatRoutes.get('/chats/unread-count', unreadCountController);
chatRoutes.post('/chats/threads', validate({ body: createThreadBodySchema }), createThreadController);
chatRoutes.get(
    '/chats/threads/:threadId/messages',
    validate({ params: threadIdParamsSchema, query: paginationQuerySchema }),
    listThreadMessagesController,
);
chatRoutes.post(
    '/chats/threads/:threadId/messages',
    chatMessageLimiter,
    validate({ params: threadIdParamsSchema, body: sendMessageBodySchema }),
    sendMessageController,
);
chatRoutes.post(
    '/chats/threads/:threadId/phone-request',
    chatMessageLimiter,
    validate({ params: threadIdParamsSchema, body: phoneRequestBodySchema }),
    requestPhoneController,
);
chatRoutes.get(
    '/chats/threads/:threadId/phone-request',
    validate({ params: threadIdParamsSchema }),
    getPhoneRequestStateController,
);
chatRoutes.patch(
    '/chats/threads/:threadId/phone-request',
    chatMessageLimiter,
    validate({ params: threadIdParamsSchema, body: phoneRequestResponseBodySchema }),
    respondPhoneRequestController,
);
chatRoutes.post(
    '/chats/threads/:threadId/offers',
    chatMessageLimiter,
    validate({ params: threadIdParamsSchema, body: createOfferBodySchema }),
    createOfferController,
);
chatRoutes.patch(
    '/chats/offers/:offerId/respond',
    chatMessageLimiter,
    validate({ params: offerIdParamsSchema, body: respondOfferBodySchema }),
    respondOfferController,
);

export default chatRoutes;
