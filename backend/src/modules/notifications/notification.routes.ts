import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    listNotificationsController,
    markAllReadController,
    markReadController,
    unreadCountController,
} from './notification.controller.js';
import { listNotificationsQuerySchema, notificationIdParamsSchema } from './notification.validation.js';

const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get('/notifications', validate({ query: listNotificationsQuerySchema }), listNotificationsController);
notificationRoutes.patch('/notifications/:id/read', validate({ params: notificationIdParamsSchema }), markReadController);
notificationRoutes.patch('/notifications/read-all', markAllReadController);
notificationRoutes.get('/notifications/unread-count', unreadCountController);

export default notificationRoutes;
