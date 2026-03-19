import { StaffRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { validate } from '../../shared/middleware/validate.js';
import {
    createBlacklistController,
    dashboardController,
    deleteBlacklistController,
    featureListingController,
    getAdminConfigController,
    getSavedSearchDigestStatusController,
    listIdentityVerificationsController,
    listBlacklistController,
    listDisputesController,
    listFraudFlagsController,
    listSavedSearchDigestHistoryController,
    listAuditLogsController,
    listReportsController,
    listUsersController,
    moderateListingController,
    moderateUserController,
    resolveReportController,
    resolveIdentityVerificationController,
    runSavedSearchDigestController,
    updateAdminConfigController,
    updateBlacklistController,
} from './admin.controller.js';
import {
    auditLogQuerySchema,
    blacklistIdParamsSchema,
    createBlacklistBodySchema,
    featureListingBodySchema,
    idParamsSchema,
    listIdentityVerificationQuerySchema,
    listBlacklistQuerySchema,
    listFraudFlagsQuerySchema,
    listDisputesQuerySchema,
    moderateListingBodySchema,
    moderateUserBodySchema,
    paginationQuerySchema,
    resolveReportBodySchema,
    runSavedSearchDigestBodySchema,
    resolveIdentityVerificationBodySchema,
    savedSearchDigestHistoryQuerySchema,
    updateAdminConfigBodySchema,
    updateBlacklistBodySchema,
} from './admin.validation.js';

const adminRoutes = Router();

adminRoutes.use('/admin', authenticate, authorize(StaffRole.ADMIN, StaffRole.MODERATOR));

adminRoutes.get('/admin/dashboard', dashboardController);
adminRoutes.get('/admin/config', authorize(StaffRole.ADMIN), getAdminConfigController);
adminRoutes.patch(
    '/admin/config',
    authorize(StaffRole.ADMIN),
    validate({ body: updateAdminConfigBodySchema }),
    updateAdminConfigController,
);
adminRoutes.get('/admin/reports', validate({ query: paginationQuerySchema }), listReportsController);
adminRoutes.get('/admin/disputes', validate({ query: listDisputesQuerySchema }), listDisputesController);
adminRoutes.get('/admin/audit-logs', validate({ query: auditLogQuerySchema }), listAuditLogsController);
adminRoutes.get('/admin/fraud-flags', validate({ query: listFraudFlagsQuerySchema }), listFraudFlagsController);
adminRoutes.get(
    '/admin/identity-verifications',
    validate({ query: listIdentityVerificationQuerySchema }),
    listIdentityVerificationsController,
);
adminRoutes.get('/admin/saved-search-digest/status', getSavedSearchDigestStatusController);
adminRoutes.get(
    '/admin/saved-search-digest/history',
    validate({ query: savedSearchDigestHistoryQuerySchema }),
    listSavedSearchDigestHistoryController,
);
adminRoutes.post(
    '/admin/saved-search-digest/run',
    validate({ body: runSavedSearchDigestBodySchema }),
    runSavedSearchDigestController,
);
adminRoutes.patch(
    '/admin/reports/:id',
    validate({ params: idParamsSchema, body: resolveReportBodySchema }),
    resolveReportController,
);
adminRoutes.patch(
    '/admin/identity-verifications/:id',
    authorize(StaffRole.ADMIN),
    validate({ params: idParamsSchema, body: resolveIdentityVerificationBodySchema }),
    resolveIdentityVerificationController,
);
adminRoutes.patch(
    '/admin/listings/:id',
    validate({ params: idParamsSchema, body: moderateListingBodySchema }),
    moderateListingController,
);
adminRoutes.post(
    '/admin/listings/:id/feature',
    validate({ params: idParamsSchema, body: featureListingBodySchema }),
    featureListingController,
);
adminRoutes.get('/admin/blacklist', validate({ query: listBlacklistQuerySchema }), listBlacklistController);
adminRoutes.post('/admin/blacklist', validate({ body: createBlacklistBodySchema }), createBlacklistController);
adminRoutes.patch(
    '/admin/blacklist/:id',
    validate({ params: blacklistIdParamsSchema, body: updateBlacklistBodySchema }),
    updateBlacklistController,
);
adminRoutes.delete(
    '/admin/blacklist/:id',
    validate({ params: blacklistIdParamsSchema }),
    deleteBlacklistController,
);

adminRoutes.get(
    '/admin/users',
    authorize(StaffRole.ADMIN),
    validate({ query: paginationQuerySchema }),
    listUsersController,
);
adminRoutes.patch(
    '/admin/users/:id',
    authorize(StaffRole.ADMIN),
    validate({ params: idParamsSchema, body: moderateUserBodySchema }),
    moderateUserController,
);

export default adminRoutes;
