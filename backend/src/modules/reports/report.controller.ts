import type { NextFunction, Request, Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { StaffRole } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { emitPlatformNotification } from '../../shared/realtime/notifications.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import { prisma } from '../../shared/utils/prisma.js';
import { createReport, listMyReports } from './report.service.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

function getSocketServer(req: Request): SocketServer | null {
    return (req.app.get('io') as SocketServer | undefined) ?? null;
}

export async function createReportController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const reporterId = requireUserId(req);
        const lang = getRequestLanguage(req);
        const report = await createReport(reporterId, req.body, lang);

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(
                io,
                [reporterId],
                {
                    kind: 'report_update',
                    title: `Report #${report.id} submitted`,
                    body: 'Your report has been added to moderation queue.',
                    link: '/reports',
                },
            );

            const moderators = await prisma.user.findMany({
                where: {
                    staffRole: {
                        in: [StaffRole.ADMIN, StaffRole.MODERATOR],
                    },
                    isActive: true,
                    bannedAt: null,
                },
                select: {
                    id: true,
                },
            });

            emitPlatformNotification(
                io,
                moderators.map((user) => user.id),
                {
                    kind: 'report_queue',
                    title: 'New report in queue',
                    body: `Report #${report.id} requires moderation review.`,
                    link: '/admin',
                },
            );
        }

        res.status(201).json({
            success: true,
            data: report,
        });
    } catch (error) {
        next(error);
    }
}

export async function listMyReportsController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const reporterId = requireUserId(req);
        const lang = getRequestLanguage(req);
        const result = await listMyReports(reporterId, req.query, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}
