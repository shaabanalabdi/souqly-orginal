import type { NextFunction, Request, Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import {
    type DigestHistorySort,
    getSavedSearchDigestHistory,
    getSavedSearchDigestStatus,
    runSavedSearchDigestNow,
    type DigestRunMode,
} from '../../shared/jobs/savedSearchDigest.job.js';
import { emitPlatformNotification } from '../../shared/realtime/notifications.js';
import { dispatchInstantSavedSearchAlertsInBackground } from '../preferences/savedSearchAlert.service.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import { prisma } from '../../shared/utils/prisma.js';
import {
    createBlacklistEntryForAdmin,
    deleteBlacklistEntryForAdmin,
    featureListingByAdmin,
    getAdminDashboardStats,
    getAdminSystemConfig,
    listDisputes,
    listBlacklistEntriesForAdmin,
    listAuditLogs,
    listFraudFlags,
    listIdentityVerifications,
    listReports,
    listUsers,
    moderateListing,
    moderateUser,
    resolveReport,
    resolveIdentityVerification,
    updateBlacklistEntryForAdmin,
    updateAdminSystemConfig,
} from './admin.service.js';

function requireAdminId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

function getSocketServer(req: Request): SocketServer | null {
    return (req.app.get('io') as SocketServer | undefined) ?? null;
}

export async function dashboardController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const stats = await getAdminDashboardStats();
        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        next(error);
    }
}

export async function getAdminConfigController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const config = await getAdminSystemConfig();
        res.json({
            success: true,
            data: config,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateAdminConfigController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const updated = await updateAdminSystemConfig(adminId, req.body);
        res.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        next(error);
    }
}

export async function listReportsController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const result = await listReports(req.query, lang);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function listIdentityVerificationsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await listIdentityVerifications(req.query);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function listAuditLogsController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await listAuditLogs(req.query);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function getSavedSearchDigestStatusController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const status = await getSavedSearchDigestStatus();
        res.json({
            success: true,
            data: status,
        });
    } catch (error) {
        next(error);
    }
}

export async function listFraudFlagsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const result = await listFraudFlags(req.query, lang);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function listDisputesController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const result = await listDisputes(req.query, lang);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function listSavedSearchDigestHistoryController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await getSavedSearchDigestHistory({
            page: typeof req.query.page === 'number' ? req.query.page : undefined,
            limit: typeof req.query.limit === 'number' ? req.query.limit : undefined,
            frequency: req.query.frequency === 'daily' || req.query.frequency === 'weekly'
                ? req.query.frequency
                : undefined,
            source: req.query.source === 'scheduler' || req.query.source === 'manual'
                ? req.query.source
                : undefined,
            sort: req.query.sort === 'completed_desc'
                || req.query.sort === 'completed_asc'
                || req.query.sort === 'duration_desc'
                || req.query.sort === 'duration_asc'
                ? (req.query.sort as DigestHistorySort)
                : undefined,
            minDurationMs: typeof req.query.minDurationMs === 'number' ? req.query.minDurationMs : undefined,
            maxDurationMs: typeof req.query.maxDurationMs === 'number' ? req.query.maxDurationMs : undefined,
            from: typeof req.query.from === 'string' ? req.query.from : undefined,
            to: typeof req.query.to === 'string' ? req.query.to : undefined,
        });

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function runSavedSearchDigestController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const frequency = (typeof req.body.frequency === 'string' ? req.body.frequency : 'both') as DigestRunMode;
        const io = getSocketServer(req);
        const result = await runSavedSearchDigestNow(frequency, io);

        await prisma.auditLog.create({
            data: {
                adminId,
                action: 'SAVED_SEARCH_DIGEST_RUN',
                entityType: 'saved_search_digest',
                entityId: 0,
                oldData: {
                    frequency,
                    requestedAt: result.triggeredAt,
                },
                newData: {
                    runs: result.runs.length,
                    skipped: result.skipped.length,
                },
                ipAddress: req.ip,
            },
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function featureListingController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const listingId = Number(req.params.id);
        const result = await featureListingByAdmin(adminId, listingId, req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function listBlacklistController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await listBlacklistEntriesForAdmin(req.query);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function createBlacklistController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const result = await createBlacklistEntryForAdmin(adminId, req.body);
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateBlacklistController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const result = await updateBlacklistEntryForAdmin(adminId, String(req.params.id), req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteBlacklistController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        await deleteBlacklistEntryForAdmin(adminId, String(req.params.id));
        res.json({
            success: true,
            data: { id: String(req.params.id) },
        });
    } catch (error) {
        next(error);
    }
}

export async function resolveReportController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const report = await resolveReport(adminId, Number(req.params.id), req.body);

        const io = getSocketServer(req);
        if (io) {
            const action = typeof req.body.action === 'string' ? req.body.action : 'resolve';
            emitPlatformNotification(
                io,
                [report.reporterId],
                {
                    kind: 'report_update',
                    title: `Report #${report.id} updated`,
                    body: `Moderation action: ${action}. Current status: ${report.status}.`,
                    link: '/reports',
                },
            );
        }

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        next(error);
    }
}

export async function resolveIdentityVerificationController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const result = await resolveIdentityVerification(adminId, Number(req.params.id), req.body);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function moderateListingController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const listing = await moderateListing(adminId, Number(req.params.id), req.body);

        const io = getSocketServer(req);
        if (io) {
            const listingOwner = await prisma.listing.findUnique({
                where: { id: listing.id },
                select: { userId: true },
            });

            if (listingOwner?.userId) {
                const action = typeof req.body.action === 'string' ? req.body.action : 'update';
                emitPlatformNotification(
                    io,
                    [listingOwner.userId],
                    {
                        kind: 'moderation',
                        title: `Listing #${listing.id} moderated`,
                        body: `Action: ${action}. New status: ${listing.status}.`,
                        link: `/listings/${listing.id}`,
                    },
                );
            }

            if (listing.status === 'ACTIVE') {
                dispatchInstantSavedSearchAlertsInBackground(listing.id, io);
            }
        }

        res.json({
            success: true,
            data: listing,
        });
    } catch (error) {
        next(error);
    }
}

export async function listUsersController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await listUsers(req.query);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function moderateUserController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const adminId = requireAdminId(req);
        const user = await moderateUser(adminId, Number(req.params.id), req.body);

        const io = getSocketServer(req);
        if (io) {
            const action = typeof req.body.action === 'string' ? req.body.action : 'update';
            emitPlatformNotification(
                io,
                [user.id],
                {
                    kind: 'moderation',
                    title: 'Account moderation update',
                    body: `Action: ${action}. Account active: ${user.isActive ? 'yes' : 'no'}.`,
                    link: '/preferences',
                },
            );
        }

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
}
