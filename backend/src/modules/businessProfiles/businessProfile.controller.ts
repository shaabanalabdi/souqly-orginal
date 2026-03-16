import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import {
    getMyBusinessProfile,
    upsertMyBusinessProfile,
} from './businessProfile.service.js';

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
