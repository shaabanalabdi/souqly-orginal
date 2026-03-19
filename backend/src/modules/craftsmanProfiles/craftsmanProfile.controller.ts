import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import {
    createPublicCraftsmanLead,
    getPublicCraftsmanProfile,
    listCraftsmanListings,
    listMyCraftsmanLeads,
    getMyCraftsmanProfile,
    upsertMyCraftsmanProfile,
} from './craftsmanProfile.service.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

export async function getMyCraftsmanProfileController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const profile = await getMyCraftsmanProfile(userId);
        res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        next(error);
    }
}

export async function upsertMyCraftsmanProfileController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await upsertMyCraftsmanProfile(userId, req.body);
        res.status(result.created ? 201 : 200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function getPublicCraftsmanProfileController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const profile = await getPublicCraftsmanProfile(Number(req.params.id));
        res.json({
            success: true,
            data: profile,
        });
    } catch (error) {
        next(error);
    }
}

export async function createCraftsmanLeadController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const result = await createPublicCraftsmanLead(
            Number(req.params.id),
            req.body,
            req.user?.userId ?? null,
        );
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function listCraftsmanListingsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const result = await listCraftsmanListings(Number(req.params.id), req.query, lang);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function listMyCraftsmanLeadsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await listMyCraftsmanLeads(userId, req.query);
        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}
