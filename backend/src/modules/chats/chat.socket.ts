import type { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../../shared/utils/jwt.js';
import { logger } from '../../shared/utils/logger.js';
import { prisma } from '../../shared/utils/prisma.js';

const CHAT_EVENTS = {
    THREAD_CREATED: 'chat:thread:created',
    MESSAGE_CREATED: 'chat:message:created',
    OFFER_UPDATED: 'chat:offer:updated',
    THREAD_JOIN: 'thread:join',
    THREAD_LEAVE: 'thread:leave',
    CHAT_ERROR: 'chat:error',
} as const;

function userRoom(userId: number): string {
    return `user:${userId}`;
}

function threadRoom(threadId: number): string {
    return `thread:${threadId}`;
}

function extractSocketToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
        return authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken;
    }

    const headerToken = socket.handshake.headers.authorization;
    if (typeof headerToken === 'string' && headerToken.length > 0) {
        return headerToken.startsWith('Bearer ') ? headerToken.slice(7) : headerToken;
    }

    return null;
}

export function setupChatSocket(io: SocketServer): void {
    io.use((socket, next) => {
        try {
            const token = extractSocketToken(socket);
            if (!token) {
                next(new Error('UNAUTHORIZED'));
                return;
            }

            const payload = verifyAccessToken(token);
            socket.data.userId = payload.userId;
            socket.data.role = payload.role;
            socket.data.staffRole = payload.staffRole;
            socket.data.accountType = payload.accountType;
            socket.data.trustTier = payload.trustTier;
            next();
        } catch {
            next(new Error('UNAUTHORIZED'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.data.userId as number | undefined;
        if (!userId) {
            socket.disconnect(true);
            return;
        }

        socket.join(userRoom(userId));
        logger.info(`Socket connected for user ${userId}: ${socket.id}`);

        socket.on(CHAT_EVENTS.THREAD_JOIN, async (payload: { threadId?: number } = {}) => {
            const threadId = Number(payload.threadId);
            if (!Number.isInteger(threadId) || threadId <= 0) {
                socket.emit(CHAT_EVENTS.CHAT_ERROR, { code: 'INVALID_THREAD_ID' });
                return;
            }

            const thread = await prisma.chatThread.findUnique({
                where: { id: threadId },
                select: {
                    buyerId: true,
                    sellerId: true,
                },
            });

            if (!thread || (thread.buyerId !== userId && thread.sellerId !== userId)) {
                socket.emit(CHAT_EVENTS.CHAT_ERROR, { code: 'FORBIDDEN_THREAD' });
                return;
            }

            socket.join(threadRoom(threadId));
        });

        socket.on(CHAT_EVENTS.THREAD_LEAVE, (payload: { threadId?: number } = {}) => {
            const threadId = Number(payload.threadId);
            if (!Number.isInteger(threadId) || threadId <= 0) {
                return;
            }

            socket.leave(threadRoom(threadId));
        });

        socket.on('disconnect', () => {
            logger.info(`Socket disconnected for user ${userId}: ${socket.id}`);
        });
    });
}

function emitToUsers(io: SocketServer, participantIds: number[], event: string, payload: unknown): void {
    const uniqueIds = Array.from(new Set(participantIds.filter((id) => Number.isInteger(id) && id > 0)));
    for (const userId of uniqueIds) {
        io.to(userRoom(userId)).emit(event, payload);
    }
}

export function emitThreadCreated(
    io: SocketServer,
    participantIds: number[],
    thread: unknown,
): void {
    emitToUsers(io, participantIds, CHAT_EVENTS.THREAD_CREATED, { thread, participants: participantIds });
}

export function emitMessageCreated(
    io: SocketServer,
    participantIds: number[],
    message: { threadId: number },
): void {
    io.to(threadRoom(message.threadId)).emit(CHAT_EVENTS.MESSAGE_CREATED, { threadId: message.threadId, message });
    emitToUsers(io, participantIds, CHAT_EVENTS.MESSAGE_CREATED, { threadId: message.threadId, message });
}

export function emitOfferUpdated(
    io: SocketServer,
    participantIds: number[],
    offer: { threadId: number },
    kind: 'created' | 'responded',
): void {
    io.to(threadRoom(offer.threadId)).emit(CHAT_EVENTS.OFFER_UPDATED, {
        threadId: offer.threadId,
        offer,
        kind,
    });
    emitToUsers(io, participantIds, CHAT_EVENTS.OFFER_UPDATED, {
        threadId: offer.threadId,
        offer,
        kind,
    });
}

export { CHAT_EVENTS };
