import { ListingStatus, MessageType, OfferStatus, type Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';

interface ThreadSummaryDto {
    id: number;
    listingId: number;
    otherUserId: number;
    unreadCount: number;
    lastMessageAt: string | null;
    createdAt: string;
    listing: {
        id: number;
        title: string;
        coverImage: string | null;
        priceAmount: number | null;
        currency: string | null;
    };
    lastMessage: {
        senderId: number;
        type: MessageType;
        content: string;
        createdAt: string;
    } | null;
}

interface ChatMessageDto {
    id: number;
    threadId: number;
    senderId: number;
    type: MessageType;
    content: string;
    imageUrl: string | null;
    isRead: boolean;
    readAt: string | null;
    createdAt: string;
}

interface OfferDto {
    id: number;
    threadId: number;
    listingId: number;
    senderId: number;
    amount: number;
    quantity: number;
    message: string | null;
    status: OfferStatus;
    counterAmount: number | null;
    createdAt: string;
    respondedAt: string | null;
}

function localizeListingTitle(
    listing: { titleAr: string; titleEn: string | null },
    lang: AppLanguage,
): string {
    return lang === 'ar' ? listing.titleAr : listing.titleEn ?? listing.titleAr;
}

async function ensureThreadParticipant(threadId: number, userId: number) {
    const thread = await prisma.chatThread.findUnique({
        where: { id: threadId },
        select: {
            id: true,
            listingId: true,
            buyerId: true,
            sellerId: true,
        },
    });

    if (!thread) {
        throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found.');
    }

    if (thread.buyerId !== userId && thread.sellerId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to access this thread.');
    }

    return thread;
}

export async function getThreadParticipantIds(
    threadId: number,
): Promise<{ buyerId: number; sellerId: number }> {
    const thread = await prisma.chatThread.findUnique({
        where: { id: threadId },
        select: {
            buyerId: true,
            sellerId: true,
        },
    });

    if (!thread) {
        throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found.');
    }

    return thread;
}

function serializeMessage(message: {
    id: number;
    threadId: number;
    senderId: number;
    type: MessageType;
    content: string;
    imageUrl: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
}): ChatMessageDto {
    return {
        id: message.id,
        threadId: message.threadId,
        senderId: message.senderId,
        type: message.type,
        content: message.content,
        imageUrl: message.imageUrl,
        isRead: message.isRead,
        readAt: message.readAt?.toISOString() ?? null,
        createdAt: message.createdAt.toISOString(),
    };
}

function serializeOffer(offer: {
    id: number;
    threadId: number;
    listingId: number;
    senderId: number;
    amount: number;
    quantity: number;
    message: string | null;
    status: OfferStatus;
    counterAmount: number | null;
    createdAt: Date;
    respondedAt: Date | null;
}): OfferDto {
    return {
        id: offer.id,
        threadId: offer.threadId,
        listingId: offer.listingId,
        senderId: offer.senderId,
        amount: offer.amount,
        quantity: offer.quantity,
        message: offer.message,
        status: offer.status,
        counterAmount: offer.counterAmount,
        createdAt: offer.createdAt.toISOString(),
        respondedAt: offer.respondedAt?.toISOString() ?? null,
    };
}

export async function createOrGetThread(
    userId: number,
    listingId: number,
    lang: AppLanguage,
): Promise<{ created: boolean; thread: ThreadSummaryDto }> {
    const listing = await prisma.listing.findFirst({
        where: {
            id: listingId,
            status: ListingStatus.ACTIVE,
        },
        select: {
            id: true,
            userId: true,
            titleAr: true,
            titleEn: true,
            priceAmount: true,
            currency: true,
            images: {
                select: { urlThumb: true },
                orderBy: { sortOrder: 'asc' },
                take: 1,
            },
        },
    });

    if (!listing) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    if (listing.userId === userId) {
        throw new ApiError(400, 'CANNOT_CHAT_OWN_LISTING', 'You cannot start a chat on your own listing.');
    }

    const existingThread = await prisma.chatThread.findUnique({
        where: {
            listingId_buyerId: {
                listingId,
                buyerId: userId,
            },
        },
        select: {
            id: true,
            listingId: true,
            buyerId: true,
            sellerId: true,
            lastMessageAt: true,
            createdAt: true,
            messages: {
                select: {
                    senderId: true,
                    type: true,
                    content: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
            _count: {
                select: {
                    messages: {
                        where: {
                            isRead: false,
                            senderId: { not: userId },
                        },
                    },
                },
            },
        },
    });

    const thread = existingThread
        ? existingThread
        : await prisma.chatThread.create({
              data: {
                  listingId,
                  buyerId: userId,
                  sellerId: listing.userId,
              },
              select: {
                  id: true,
                  listingId: true,
                  buyerId: true,
                  sellerId: true,
                  lastMessageAt: true,
                  createdAt: true,
                  messages: {
                      select: {
                          senderId: true,
                          type: true,
                          content: true,
                          createdAt: true,
                      },
                      orderBy: { createdAt: 'desc' },
                      take: 1,
                  },
                  _count: {
                      select: {
                          messages: {
                              where: {
                                  isRead: false,
                                  senderId: { not: userId },
                              },
                          },
                      },
                  },
              },
          });

    return {
        created: !existingThread,
        thread: {
            id: thread.id,
            listingId: thread.listingId,
            otherUserId: thread.sellerId,
            unreadCount: thread._count.messages,
            lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
            createdAt: thread.createdAt.toISOString(),
            listing: {
                id: listing.id,
                title: localizeListingTitle(listing, lang),
                coverImage: listing.images[0]?.urlThumb ?? null,
                priceAmount: listing.priceAmount,
                currency: listing.currency,
            },
            lastMessage: thread.messages[0]
                ? {
                      senderId: thread.messages[0].senderId,
                      type: thread.messages[0].type,
                      content: thread.messages[0].content,
                      createdAt: thread.messages[0].createdAt.toISOString(),
                  }
                : null,
        },
    };
}

export async function listMyThreads(
    userId: number,
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: ThreadSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);

    const where: Prisma.ChatThreadWhereInput = {
        OR: [{ buyerId: userId }, { sellerId: userId }],
    };

    const [total, threads] = await Promise.all([
        prisma.chatThread.count({ where }),
        prisma.chatThread.findMany({
            where,
            orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                listingId: true,
                buyerId: true,
                sellerId: true,
                lastMessageAt: true,
                createdAt: true,
                listing: {
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        priceAmount: true,
                        currency: true,
                        images: {
                            select: { urlThumb: true },
                            orderBy: { sortOrder: 'asc' },
                            take: 1,
                        },
                    },
                },
                messages: {
                    select: {
                        senderId: true,
                        type: true,
                        content: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                _count: {
                    select: {
                        messages: {
                            where: {
                                isRead: false,
                                senderId: { not: userId },
                            },
                        },
                    },
                },
            },
        }),
    ]);

    return {
        items: threads.map((thread) => ({
            id: thread.id,
            listingId: thread.listingId,
            otherUserId: thread.buyerId === userId ? thread.sellerId : thread.buyerId,
            unreadCount: thread._count.messages,
            lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
            createdAt: thread.createdAt.toISOString(),
            listing: {
                id: thread.listing.id,
                title: localizeListingTitle(thread.listing, lang),
                coverImage: thread.listing.images[0]?.urlThumb ?? null,
                priceAmount: thread.listing.priceAmount,
                currency: thread.listing.currency,
            },
            lastMessage: thread.messages[0]
                ? {
                      senderId: thread.messages[0].senderId,
                      type: thread.messages[0].type,
                      content: thread.messages[0].content,
                      createdAt: thread.messages[0].createdAt.toISOString(),
                  }
                : null,
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function getMyUnreadMessagesCount(userId: number): Promise<{ unreadCount: number }> {
    const unreadCount = await prisma.chatMessage.count({
        where: {
            isRead: false,
            senderId: { not: userId },
            thread: {
                OR: [{ buyerId: userId }, { sellerId: userId }],
            },
        },
    });

    return { unreadCount };
}

export async function listThreadMessages(
    userId: number,
    threadId: number,
    query: Record<string, unknown>,
): Promise<{ items: ChatMessageDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    await ensureThreadParticipant(threadId, userId);

    const pagination = parsePagination(query);
    const where: Prisma.ChatMessageWhereInput = { threadId };

    const [total, messages] = await Promise.all([
        prisma.chatMessage.count({ where }),
        prisma.chatMessage.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                threadId: true,
                senderId: true,
                type: true,
                content: true,
                imageUrl: true,
                isRead: true,
                readAt: true,
                createdAt: true,
            },
        }),
    ]);

    await prisma.chatMessage.updateMany({
        where: {
            threadId,
            senderId: { not: userId },
            isRead: false,
        },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });

    return {
        items: messages.map(serializeMessage),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function sendThreadMessage(
    userId: number,
    threadId: number,
    payload: { type: 'TEXT' | 'IMAGE'; content?: string; imageUrl?: string },
): Promise<ChatMessageDto> {
    await ensureThreadParticipant(threadId, userId);

    const message = await prisma.chatMessage.create({
        data: {
            threadId,
            senderId: userId,
            type: payload.type,
            content: payload.content ?? '',
            imageUrl: payload.imageUrl,
        },
        select: {
            id: true,
            threadId: true,
            senderId: true,
            type: true,
            content: true,
            imageUrl: true,
            isRead: true,
            readAt: true,
            createdAt: true,
        },
    });

    await prisma.chatThread.update({
        where: { id: threadId },
        data: { lastMessageAt: message.createdAt },
    });

    return serializeMessage(message);
}

export async function requestPhoneInThread(
    userId: number,
    threadId: number,
    payload: { message?: string },
): Promise<ChatMessageDto> {
    const thread = await ensureThreadParticipant(threadId, userId);

    if (thread.buyerId !== userId) {
        throw new ApiError(403, 'ONLY_BUYER_CAN_REQUEST_PHONE', 'Only the buyer can request phone access.');
    }

    const message = await prisma.chatMessage.create({
        data: {
            threadId,
            senderId: userId,
            type: MessageType.PHONE_REQUEST,
            content: payload.message ?? 'Phone number request',
        },
        select: {
            id: true,
            threadId: true,
            senderId: true,
            type: true,
            content: true,
            imageUrl: true,
            isRead: true,
            readAt: true,
            createdAt: true,
        },
    });

    await prisma.chatThread.update({
        where: { id: threadId },
        data: { lastMessageAt: message.createdAt },
    });

    return serializeMessage(message);
}

export async function createThreadOffer(
    userId: number,
    threadId: number,
    payload: { amount: number; quantity: number; message?: string },
): Promise<OfferDto> {
    const thread = await ensureThreadParticipant(threadId, userId);

    const offer = await prisma.offer.create({
        data: {
            threadId,
            senderId: userId,
            listingId: thread.listingId,
            amount: payload.amount,
            quantity: payload.quantity,
            message: payload.message,
            status: OfferStatus.PENDING,
        },
        select: {
            id: true,
            threadId: true,
            listingId: true,
            senderId: true,
            amount: true,
            quantity: true,
            message: true,
            status: true,
            counterAmount: true,
            createdAt: true,
            respondedAt: true,
        },
    });

    const systemPayload = JSON.stringify({
        offerId: offer.id,
        amount: offer.amount,
        quantity: offer.quantity,
        status: offer.status,
    });

    await prisma.chatMessage.create({
        data: {
            threadId,
            senderId: userId,
            type: MessageType.OFFER,
            content: systemPayload,
        },
    });

    await prisma.chatThread.update({
        where: { id: threadId },
        data: { lastMessageAt: new Date() },
    });

    return serializeOffer(offer);
}

export async function respondToOffer(
    userId: number,
    offerId: number,
    payload: { action: 'accept' | 'reject' | 'counter'; counterAmount?: number },
): Promise<OfferDto> {
    const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        select: {
            id: true,
            threadId: true,
            listingId: true,
            senderId: true,
            amount: true,
            quantity: true,
            message: true,
            status: true,
            counterAmount: true,
            createdAt: true,
            respondedAt: true,
            thread: {
                select: {
                    buyerId: true,
                    sellerId: true,
                },
            },
        },
    });

    if (!offer) {
        throw new ApiError(404, 'OFFER_NOT_FOUND', 'Offer not found.');
    }

    if (offer.thread.buyerId !== userId && offer.thread.sellerId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to access this offer.');
    }

    if (offer.senderId === userId) {
        throw new ApiError(403, 'CANNOT_RESPOND_OWN_OFFER', 'You cannot respond to your own offer.');
    }

    if (offer.status !== OfferStatus.PENDING) {
        throw new ApiError(400, 'OFFER_ALREADY_RESOLVED', 'Offer has already been resolved.');
    }

    const nextStatus =
        payload.action === 'accept'
            ? OfferStatus.ACCEPTED
            : payload.action === 'reject'
                ? OfferStatus.REJECTED
                : OfferStatus.COUNTERED;

    const updatedOffer = await prisma.offer.update({
        where: { id: offer.id },
        data: {
            status: nextStatus,
            counterAmount: payload.action === 'counter' ? payload.counterAmount : null,
            respondedAt: new Date(),
        },
        select: {
            id: true,
            threadId: true,
            listingId: true,
            senderId: true,
            amount: true,
            quantity: true,
            message: true,
            status: true,
            counterAmount: true,
            createdAt: true,
            respondedAt: true,
        },
    });

    const responseMessage =
        payload.action === 'accept'
            ? `Offer #${offer.id} accepted`
            : payload.action === 'reject'
                ? `Offer #${offer.id} rejected`
                : `Offer #${offer.id} countered with ${payload.counterAmount}`;

    await prisma.chatMessage.create({
        data: {
            threadId: offer.threadId,
            senderId: userId,
            type: MessageType.SYSTEM,
            content: responseMessage,
        },
    });

    await prisma.chatThread.update({
        where: { id: offer.threadId },
        data: {
            lastMessageAt: new Date(),
        },
    });

    return serializeOffer(updatedOffer);
}
