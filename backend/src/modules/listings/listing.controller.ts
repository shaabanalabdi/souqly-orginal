import type { NextFunction, Request, Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { dispatchInstantSavedSearchAlertsInBackground } from '../preferences/savedSearchAlert.service.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import { createListing, getListingById, listListings, updateListing } from './listing.service.js';

function requireActor(req: Request): NonNullable<Request['user']> {
    if (!req.user) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user;
}

function getSocketServer(req: Request): SocketServer | null {
    return (req.app.get('io') as SocketServer | undefined) ?? null;
}

export async function createListingController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const lang = getRequestLanguage(req);
        const listing = await createListing(actor, req.body, lang, { ipAddress: req.ip });
        const io = getSocketServer(req);

        if (listing.status === 'ACTIVE' && io) {
            dispatchInstantSavedSearchAlertsInBackground(listing.id, io);
        }

        res.status(201).json({
            success: true,
            data: listing,
        });
    } catch (error) {
        next(error);
    }
}

export async function updateListingController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const lang = getRequestLanguage(req);
        const listing = await updateListing(Number(req.params.id), actor, req.body, lang);

        res.json({
            success: true,
            data: listing,
        });
    } catch (error) {
        next(error);
    }
}

export async function getListingByIdController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const listing = await getListingById(Number(req.params.id), lang);

        res.json({
            success: true,
            data: listing,
        });
    } catch (error) {
        next(error);
    }
}

export async function listListingsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const result = await listListings(req.query, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}
