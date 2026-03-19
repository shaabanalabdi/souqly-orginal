import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import {
    cancelStoreSubscription,
    confirmStoreSubscriptionCheckout,
    getCurrentStoreSubscription,
    listStorePlans,
    subscribeStorePlan,
} from './subscription.service.js';
import type { ConfirmSubscriptionCheckoutBody } from './subscription.validation.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

function requireIdempotencyKey(req: Request): string {
    const key = req.header('x-idempotency-key')?.trim();
    if (!key) {
        throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'x-idempotency-key header is required.');
    }

    return key;
}

export async function listStorePlansController(
    _req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const plans = listStorePlans();
        res.json({
            success: true,
            data: plans,
        });
    } catch (error) {
        next(error);
    }
}

export async function getCurrentStoreSubscriptionController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await getCurrentStoreSubscription(userId);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function subscribeStorePlanController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await subscribeStorePlan(userId, req.body, requireIdempotencyKey(req));

        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function confirmStoreSubscriptionCheckoutController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await confirmStoreSubscriptionCheckout(
            userId,
            req.body as ConfirmSubscriptionCheckoutBody,
            requireIdempotencyKey(req),
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function cancelStoreSubscriptionController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await cancelStoreSubscription(userId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}
