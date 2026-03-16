import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import {
    addFavorite,
    createSavedSearch,
    deleteSavedSearch,
    listFavorites,
    listSavedSearches,
    removeFavorite,
    updateSavedSearch,
} from './preference.service.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

export async function addFavoriteController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const lang = getRequestLanguage(req);
        const result = await addFavorite(userId, Number(req.params.listingId), lang);

        res.status(result.alreadyFavorited ? 200 : 201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function removeFavoriteController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await removeFavorite(userId, Number(req.params.listingId));

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function listFavoritesController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const lang = getRequestLanguage(req);
        const result = await listFavorites(userId, req.query, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function createSavedSearchController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const savedSearch = await createSavedSearch(userId, req.body);

        res.status(201).json({
            success: true,
            data: savedSearch,
        });
    } catch (error) {
        next(error);
    }
}

export async function listSavedSearchesController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await listSavedSearches(userId, req.query);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateSavedSearchController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const savedSearch = await updateSavedSearch(userId, Number(req.params.id), req.body);

        res.json({
            success: true,
            data: savedSearch,
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteSavedSearchController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await deleteSavedSearch(userId, Number(req.params.id));

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}
