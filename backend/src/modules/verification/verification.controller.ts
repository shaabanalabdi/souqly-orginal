import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import {
    getMyIdentityVerification,
    submitIdentityVerification,
} from './verification.service.js';

function requireUserId(req: Request): number {
    const userId = req.user?.userId;
    if (!userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }
    return userId;
}

export async function getMyIdentityVerificationController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await getMyIdentityVerification(userId);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function submitIdentityVerificationController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await submitIdentityVerification(userId, req.body);
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}
