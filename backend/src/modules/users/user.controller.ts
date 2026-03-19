import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import {
    getMyUserProfile,
    getPublicUserProfile,
    listPublicUserListings,
    listPublicUserReviews,
    updateMyUserProfile,
} from './user.service.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

export async function getMyProfileController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await getMyUserProfile(requireUserId(req), getRequestLanguage(req));
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function updateMyProfileController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await updateMyUserProfile(requireUserId(req), req.body, getRequestLanguage(req));
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function getPublicProfileController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await getPublicUserProfile(Number(req.params.id));
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function listPublicUserListingsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await listPublicUserListings(Number(req.params.id), req.query, getRequestLanguage(req));
        res.json({ success: true, data: result.items, meta: result.meta });
    } catch (error) {
        next(error);
    }
}

export async function listPublicUserReviewsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await listPublicUserReviews(Number(req.params.id), req.query);
        res.json({ success: true, data: result.items, meta: result.meta });
    } catch (error) {
        next(error);
    }
}
