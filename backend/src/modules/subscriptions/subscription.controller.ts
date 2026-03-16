import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import {
    cancelStoreSubscription,
    getCurrentStoreSubscription,
    listStorePlans,
    subscribeStorePlan,
} from './subscription.service.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
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
        const result = await subscribeStorePlan(userId, req.body);

        res.status(201).json({
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
