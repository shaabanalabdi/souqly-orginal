import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import {
    getPublicStoreProfile,
    getStoreAnalytics,
    listStoreListings,
    getMyBusinessProfile,
    upsertMyBusinessProfile,
} from './businessProfile.service.js';
import { incrementStoreAnalyticsMetric } from './businessAnalytics.service.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

export async function getMyBusinessProfileController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const profile = await getMyBusinessProfile(userId);

        res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        next(error);
    }
}

export async function upsertMyBusinessProfileController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await upsertMyBusinessProfile(userId, req.body);

        res.status(result.created ? 201 : 200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function getPublicStoreProfileController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const storeId = Number(req.params.storeId);
        const profile = await getPublicStoreProfile(storeId);
        void incrementStoreAnalyticsMetric(storeId, 'profileViews');

        res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        next(error);
    }
}

export async function listPublicStoreListingsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const storeId = Number(req.params.storeId);
        const result = await listStoreListings(storeId, req.query, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function getStoreAnalyticsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        if (!req.user?.userId || !req.user.staffRole) {
            throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
        }

        const storeId = Number(req.params.storeId);
        const analytics = await getStoreAnalytics(
            storeId,
            {
                userId: req.user.userId,
                staffRole: req.user.staffRole,
            },
            {
                from: typeof req.query.from === 'string' ? req.query.from : undefined,
                to: typeof req.query.to === 'string' ? req.query.to : undefined,
            },
        );

        res.json({
            success: true,
            data: analytics,
        });
    } catch (error) {
        next(error);
    }
}
