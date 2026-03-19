import type { NextFunction, Request, Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import type { StaffRole } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { emitPlatformNotification } from '../../shared/realtime/notifications.js';
import { isInternalEscrowEnabled } from '../../shared/config/systemConfig.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import { notifyUsers } from '../notifications/notification.service.js';
import {
    holdDealEscrow,
    openDealDispute,
    processEscrowWebhook,
    resolveDealDispute,
    refundDealEscrow,
    releaseDealEscrow,
    reviewDealDispute,
    confirmDeal,
    createDealFromOffer,
    createDealReview,
    getDealById,
    listMyDeals,
} from './deal.service.js';
import type {
    CreateDisputeBody,
    EscrowWebhookBody,
    HoldEscrowBody,
    ResolveDisputeBody,
    ReviewDisputeBody,
} from './deal.validation.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

function requireActor(req: Request): { userId: number; staffRole: StaffRole } {
    if (!req.user?.userId || !req.user.staffRole) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return {
        userId: req.user.userId,
        staffRole: req.user.staffRole,
    };
}

function requireIdempotencyKey(req: Request): string {
    const key = req.header('x-idempotency-key')?.trim();
    if (!key) {
        throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'x-idempotency-key header is required.');
    }

    return key;
}

function getSocketServer(req: Request): SocketServer | null {
    return (req.app.get('io') as SocketServer | undefined) ?? null;
}

async function assertEscrowEnabledAtLaunch(): Promise<void> {
    const enabled = await isInternalEscrowEnabled();
    if (!enabled) {
        throw new ApiError(
            410,
            'INTERNAL_ESCROW_DISABLED_AT_LAUNCH',
            'Internal escrow and payment handling are disabled at launch for Souqly.',
        );
    }
}

function assertEscrowWebhookSecret(req: Request): void {
    const configuredSecret = process.env.ESCROW_WEBHOOK_SECRET?.trim();
    if (!configuredSecret) {
        throw new ApiError(
            503,
            'ESCROW_WEBHOOK_NOT_CONFIGURED',
            'Escrow webhook is not configured on this environment.',
        );
    }

    const incomingSecret = req.header('x-escrow-webhook-secret');
    if (!incomingSecret || incomingSecret !== configuredSecret) {
        throw new ApiError(401, 'INVALID_WEBHOOK_SECRET', 'Escrow webhook secret is invalid.');
    }
}

export async function createDealFromOfferController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const deal = await createDealFromOffer(userId, req.body);

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(
                io,
                [deal.buyerId, deal.sellerId],
                {
                    kind: 'deal_update',
                    title: `Deal #${deal.id} created`,
                    body: `A new deal has been created with status ${deal.status}.`,
                    link: '/deals',
                },
            );
        }

        res.status(201).json({
            success: true,
            data: deal,
        });
    } catch (error) {
        next(error);
    }
}

export async function listMyDealsController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const lang = getRequestLanguage(req);
        const result = await listMyDeals(userId, req.query, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function getDealByIdController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const actor = requireActor(req);
        const lang = getRequestLanguage(req);
        const deal = await getDealById(actor, Number(req.params.id), lang);

        res.json({
            success: true,
            data: deal,
        });
    } catch (error) {
        next(error);
    }
}

export async function confirmDealController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const deal = await confirmDeal(userId, Number(req.params.id));

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(
                io,
                [deal.buyerId, deal.sellerId],
                {
                    kind: 'deal_update',
                    title: `Deal #${deal.id} updated`,
                    body: `Deal status is now ${deal.status}.`,
                    link: '/deals',
                },
            );
        }

        res.json({
            success: true,
            data: deal,
        });
    } catch (error) {
        next(error);
    }
}

export async function createDealReviewController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const review = await createDealReview(userId, Number(req.params.id), req.body);

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(
                io,
                [review.revieweeId],
                {
                    kind: 'deal_update',
                    title: 'New review received',
                    body: `You received a ${review.rating}-star review on deal #${review.dealId}.`,
                    link: '/deals',
                },
            );
        }

        res.status(201).json({
            success: true,
            data: review,
        });
    } catch (error) {
        next(error);
    }
}

export async function holdDealEscrowController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        await assertEscrowEnabledAtLaunch();
        const userId = requireUserId(req);
        const deal = await holdDealEscrow(
            userId,
            Number(req.params.id),
            req.body as HoldEscrowBody,
            requireIdempotencyKey(req),
        );

        await notifyUsers([deal.buyerId, deal.sellerId], {
            type: 'ESCROW_HELD',
            title: `Escrow held for deal #${deal.id}`,
            body: `Escrow status is now ${deal.escrow.status}.`,
            link: '/deals',
            targetType: 'deal',
            targetId: deal.id,
            dedupKey: `escrow-held:${deal.id}`,
        });

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(
                io,
                [deal.buyerId, deal.sellerId],
                {
                    kind: 'deal_update',
                    title: `Escrow held for deal #${deal.id}`,
                    body: `Escrow status is now ${deal.escrow.status}.`,
                    link: '/deals',
                },
            );
        }

        res.json({
            success: true,
            data: deal,
        });
    } catch (error) {
        next(error);
    }
}

export async function releaseDealEscrowController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        await assertEscrowEnabledAtLaunch();
        const actor = requireActor(req);
        const deal = await releaseDealEscrow(actor, Number(req.params.id), requireIdempotencyKey(req));

        await notifyUsers([deal.buyerId, deal.sellerId], {
            type: 'ESCROW_RELEASED',
            title: `Escrow released for deal #${deal.id}`,
            body: `Escrow status is now ${deal.escrow.status}.`,
            link: '/deals',
            targetType: 'deal',
            targetId: deal.id,
            dedupKey: `escrow-released:${deal.id}`,
        });

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(
                io,
                [deal.buyerId, deal.sellerId],
                {
                    kind: 'deal_update',
                    title: `Escrow released for deal #${deal.id}`,
                    body: `Escrow status is now ${deal.escrow.status}.`,
                    link: '/deals',
                },
            );
        }

        res.json({
            success: true,
            data: deal,
        });
    } catch (error) {
        next(error);
    }
}

export async function refundDealEscrowController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        await assertEscrowEnabledAtLaunch();
        const actor = requireActor(req);
        const deal = await refundDealEscrow(actor, Number(req.params.id), requireIdempotencyKey(req));

        await notifyUsers([deal.buyerId, deal.sellerId], {
            type: 'ESCROW_REFUNDED',
            title: `Escrow refunded for deal #${deal.id}`,
            body: `Escrow status is now ${deal.escrow.status}.`,
            link: '/deals',
            targetType: 'deal',
            targetId: deal.id,
            dedupKey: `escrow-refunded:${deal.id}`,
        });

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(
                io,
                [deal.buyerId, deal.sellerId],
                {
                    kind: 'deal_update',
                    title: `Escrow refunded for deal #${deal.id}`,
                    body: `Escrow status is now ${deal.escrow.status}.`,
                    link: '/deals',
                },
            );
        }

        res.json({
            success: true,
            data: deal,
        });
    } catch (error) {
        next(error);
    }
}

export async function openDealDisputeController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await openDealDispute(
            userId,
            Number(req.params.id),
            req.body as CreateDisputeBody,
        );

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(io, [result.deal.buyerId, result.deal.sellerId], {
                kind: 'deal_update',
                title: `Dispute opened for deal #${result.deal.id}`,
                body: `Dispute status is now ${result.dispute.status}.`,
                link: '/deals',
            });
        }

        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function reviewDealDisputeController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const result = await reviewDealDispute(
            actor,
            Number(req.params.id),
            req.body as ReviewDisputeBody,
        );

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(io, [result.deal.buyerId, result.deal.sellerId], {
                kind: 'deal_update',
                title: `Dispute under review for deal #${result.deal.id}`,
                body: `Dispute status is now ${result.dispute.status}.`,
                link: '/deals',
            });
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function resolveDealDisputeController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const result = await resolveDealDispute(
            actor,
            Number(req.params.id),
            req.body as ResolveDisputeBody,
        );

        await notifyUsers([result.deal.buyerId, result.deal.sellerId], {
            type: 'DISPUTE_RESOLVED',
            title: `Dispute resolved for deal #${result.deal.id}`,
            body: `Dispute status is now ${result.dispute.status}.`,
            link: '/deals',
            targetType: 'deal',
            targetId: result.deal.id,
            dedupKey: `dispute-resolved:${result.deal.id}:${result.dispute.status}`,
        });

        const io = getSocketServer(req);
        if (io) {
            emitPlatformNotification(io, [result.deal.buyerId, result.deal.sellerId], {
                kind: 'deal_update',
                title: `Dispute resolved for deal #${result.deal.id}`,
                body: `Dispute status is now ${result.dispute.status}.`,
                link: '/deals',
            });
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function escrowWebhookController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        await assertEscrowEnabledAtLaunch();
        assertEscrowWebhookSecret(req);
        const result = await processEscrowWebhook(req.body as EscrowWebhookBody);

        if (result.deal) {
            const notificationType =
                result.eventType === 'escrow.held'
                    ? 'ESCROW_HELD'
                    : result.eventType === 'escrow.released'
                        ? 'ESCROW_RELEASED'
                        : result.eventType === 'escrow.refunded'
                            ? 'ESCROW_REFUNDED'
                            : result.eventType === 'dispute.resolved'
                                ? 'DISPUTE_RESOLVED'
                                : null;

            if (notificationType && result.participantIds.length > 0) {
                await notifyUsers(result.participantIds, {
                    type: notificationType,
                    title: `Escrow webhook: ${result.eventType}`,
                    body: result.message,
                    link: '/deals',
                    targetType: 'deal',
                    targetId: result.deal.id,
                    dedupKey: `escrow-webhook:${result.eventId}`,
                });
            }
        }

        const io = getSocketServer(req);
        if (io && result.participantIds.length > 0) {
            emitPlatformNotification(io, result.participantIds, {
                kind: 'deal_update',
                title: `Escrow webhook: ${result.eventType}`,
                body: result.message,
                link: '/deals',
            });
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}
