import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import { createReportController, listMyReportsController } from './report.controller.js';
import { createReportBodySchema, paginationQuerySchema } from './report.validation.js';

const reportRoutes = Router();

reportRoutes.use(authenticate);

reportRoutes.post('/reports', validate({ body: createReportBodySchema }), createReportController);
reportRoutes.get('/reports/my', validate({ query: paginationQuerySchema }), listMyReportsController);

export default reportRoutes;
