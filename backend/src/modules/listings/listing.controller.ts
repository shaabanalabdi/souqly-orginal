import type { NextFunction, Request, Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { dispatchInstantSavedSearchAlertsInBackground } from '../preferences/savedSearchAlert.service.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import {
    createListing,
    deleteListing,
    featureListingByOwner,
    getManageListingById,
    getListingById,
    listListings,
    listMyListings,
    listNearbyListings,
    markListingSold,
    publishDraftListing,
    renewListing,
    updateListing,
} from './listing.service.js';
import type { NearbyListingsQuery } from './listing.validation.js';

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
        const listing = await getListingById(Number(req.params.id), lang, req.user?.userId ?? null);

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

export async function listMyListingsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const lang = getRequestLanguage(req);
        const result = await listMyListings(actor, req.query, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function getManageListingController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const lang = getRequestLanguage(req);
        const listing = await getManageListingById(Number(req.params.id), actor, lang);

        res.json({
            success: true,
            data: listing,
        });
    } catch (error) {
        next(error);
    }
}

export async function deleteListingController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const result = await deleteListing(Number(req.params.id), actor);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function markListingSoldController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const result = await markListingSold(Number(req.params.id), actor);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function renewListingController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const result = await renewListing(Number(req.params.id), actor);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function publishDraftListingController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const lang = getRequestLanguage(req);
        const listing = await publishDraftListing(Number(req.params.id), actor, lang, { ipAddress: req.ip });
        const io = getSocketServer(req);

        if (listing.status === 'ACTIVE' && io) {
            dispatchInstantSavedSearchAlertsInBackground(listing.id, io);
        }

        res.json({
            success: true,
            data: listing,
        });
    } catch (error) {
        next(error);
    }
}

export async function featureListingController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const actor = requireActor(req);
        const result = await featureListingByOwner(Number(req.params.id), actor, req.body);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function listNearbyListingsController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const lang = getRequestLanguage(req);
        const result = await listNearbyListings(req.query as unknown as NearbyListingsQuery, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}
