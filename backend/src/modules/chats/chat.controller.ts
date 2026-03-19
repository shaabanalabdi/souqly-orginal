import type { NextFunction, Request, Response } from 'express';
import type { Server as SocketServer } from 'socket.io';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { getRequestLanguage } from '../../shared/utils/language.js';
import { emitMessageCreated, emitOfferUpdated, emitThreadCreated } from './chat.socket.js';
import {
    createOrGetThread,
    createThreadOffer,
    getPhoneRequestStateInThread,
    getMyUnreadMessagesCount,
    getThreadParticipantIds,
    listMyOffers,
    listMyThreads,
    listThreadMessages,
    respondToPhoneRequestInThread,
    requestPhoneInThread,
    respondToOffer,
    sendThreadMessage,
} from './chat.service.js';

function requireUserId(req: Request): number {
    if (!req.user?.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.');
    }

    return req.user.userId;
}

function getSocketServer(req: Request): SocketServer | null {
    return (req.app.get('io') as SocketServer | undefined) ?? null;
}

export async function createThreadController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const lang = getRequestLanguage(req);
        const result = await createOrGetThread(userId, req.body.listingId, lang);

        const io = getSocketServer(req);
        if (io && result.created) {
            emitThreadCreated(io, [userId, result.thread.otherUserId], result.thread);
        }

        res.status(result.created ? 201 : 200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function listMyThreadsController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const lang = getRequestLanguage(req);
        const result = await listMyThreads(userId, req.query, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function listMyOffersController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const lang = getRequestLanguage(req);
        const result = await listMyOffers(userId, req.query, lang);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function unreadCountController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await getMyUnreadMessagesCount(userId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function listThreadMessagesController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await listThreadMessages(userId, Number(req.params.threadId), req.query);

        res.json({
            success: true,
            data: result.items,
            meta: result.meta,
        });
    } catch (error) {
        next(error);
    }
}

export async function sendMessageController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const message = await sendThreadMessage(userId, Number(req.params.threadId), req.body);

        const io = getSocketServer(req);
        if (io) {
            const participants = await getThreadParticipantIds(message.threadId);
            emitMessageCreated(io, [participants.buyerId, participants.sellerId], message);
        }

        res.status(201).json({
            success: true,
            data: message,
        });
    } catch (error) {
        next(error);
    }
}

export async function requestPhoneController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const message = await requestPhoneInThread(userId, Number(req.params.threadId), req.body);

        const io = getSocketServer(req);
        if (io) {
            const participants = await getThreadParticipantIds(message.threadId);
            emitMessageCreated(io, [participants.buyerId, participants.sellerId], message);
        }

        res.status(201).json({
            success: true,
            data: message,
        });
    } catch (error) {
        next(error);
    }
}

export async function getPhoneRequestStateController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const state = await getPhoneRequestStateInThread(userId, Number(req.params.threadId));

        res.json({
            success: true,
            data: state,
        });
    } catch (error) {
        next(error);
    }
}

export async function respondPhoneRequestController(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const userId = requireUserId(req);
        const result = await respondToPhoneRequestInThread(userId, Number(req.params.threadId), req.body);

        const io = getSocketServer(req);
        if (io) {
            const participants = await getThreadParticipantIds(result.message.threadId);
            emitMessageCreated(io, [participants.buyerId, participants.sellerId], result.message);
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
}

export async function createOfferController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const offer = await createThreadOffer(userId, Number(req.params.threadId), req.body);

        const io = getSocketServer(req);
        if (io) {
            const participants = await getThreadParticipantIds(offer.threadId);
            emitOfferUpdated(io, [participants.buyerId, participants.sellerId], offer, 'created');
        }

        res.status(201).json({
            success: true,
            data: offer,
        });
    } catch (error) {
        next(error);
    }
}

export async function respondOfferController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = requireUserId(req);
        const offer = await respondToOffer(userId, Number(req.params.offerId), req.body);

        const io = getSocketServer(req);
        if (io) {
            const participants = await getThreadParticipantIds(offer.threadId);
            emitOfferUpdated(io, [participants.buyerId, participants.sellerId], offer, 'responded');
        }

        res.json({
            success: true,
            data: offer,
        });
    } catch (error) {
        next(error);
    }
}
