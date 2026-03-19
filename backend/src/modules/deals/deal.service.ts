import {
    DealStatus,
    DisputeStatus,
    EscrowLedgerEntryType,
    EscrowStatus,
    EscrowWebhookEventStatus,
    MessageType,
    OfferStatus,
    Prisma,
    StaffRole,
} from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { isModeratorOrAdmin } from '../../shared/auth/authorization.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';
import { domainEventBus } from '../../events/domainEvents.js';
import { createAuditLog } from '../../shared/audit/auditLog.service.js';
import { sanitizeNullableText, sanitizeText } from '../../shared/utils/sanitize.js';
import { incrementStoreAnalyticsMetric } from '../businessProfiles/businessAnalytics.service.js';
import type {
    CreateDisputeBody,
    CreateDealFromOfferBody,
    CreateReviewBody,
    EscrowWebhookBody,
    HoldEscrowBody,
    ResolveDisputeBody,
    ReviewDisputeBody,
} from './deal.validation.js';

interface DealDto {
    id: number;
    listingId: number;
    buyerId: number;
    sellerId: number;
    finalPrice: number;
    quantity: number;
    currency: string;
    status: DealStatus;
    buyerConfirmed: boolean;
    sellerConfirmed: boolean;
    escrow: {
        status: EscrowStatus;
        amount: number | null;
        currency: string | null;
        providerRef: string | null;
        heldAt: string | null;
        releasedAt: string | null;
        refundedAt: string | null;
    };
    meetingPlace: string | null;
    meetingLat: number | null;
    meetingLng: number | null;
    createdAt: string;
    completedAt: string | null;
}

interface ReviewDto {
    id: number;
    dealId: number;
    reviewerId: number;
    revieweeId: number;
    rating: number;
    comment: string | null;
    createdAt: string;
}

interface DealSummaryDto extends DealDto {
    listing: {
        title: string;
        coverImage: string | null;
    };
    otherUserId: number;
}

interface DealDetailsDto extends DealDto {
    listing: {
        title: string;
        coverImage: string | null;
    };
    dispute: DisputeCaseDto | null;
}

interface DealActor {
    userId: number;
    staffRole: StaffRole;
}

interface DisputeCaseDto {
    id: number;
    dealId: number;
    openedByUserId: number;
    reason: string;
    description: string;
    status: DisputeStatus;
    resolvedByAdmin: number | null;
    resolution: string | null;
    createdAt: string;
    resolvedAt: string | null;
}

interface DealDisputeDto {
    deal: DealDto;
    dispute: DisputeCaseDto;
}

interface EscrowWebhookResultDto {
    eventId: string;
    eventType: EscrowWebhookBody['eventType'];
    applied: boolean;
    deduplicated: boolean;
    message: string;
    deal: DealDto | null;
    dispute: DisputeCaseDto | null;
    participantIds: number[];
}

function localizeListingTitle(
    listing: { titleAr: string; titleEn: string | null },
    lang: AppLanguage,
): string {
    return lang === 'ar' ? listing.titleAr : listing.titleEn ?? listing.titleAr;
}

function serializeDeal(deal: {
    id: number;
    listingId: number;
    buyerId: number;
    sellerId: number;
    finalPrice: number;
    quantity: number;
    currency: string;
    status: DealStatus;
    buyerConfirmed: boolean;
    sellerConfirmed: boolean;
    escrowStatus: EscrowStatus;
    escrowAmount: number | null;
    escrowCurrency: string | null;
    escrowProviderRef: string | null;
    escrowHeldAt: Date | null;
    escrowReleasedAt: Date | null;
    escrowRefundedAt: Date | null;
    meetingPlace: string | null;
    meetingLat: number | null;
    meetingLng: number | null;
    createdAt: Date;
    completedAt: Date | null;
}): DealDto {
    return {
        id: deal.id,
        listingId: deal.listingId,
        buyerId: deal.buyerId,
        sellerId: deal.sellerId,
        finalPrice: deal.finalPrice,
        quantity: deal.quantity,
        currency: deal.currency,
        status: deal.status,
        buyerConfirmed: deal.buyerConfirmed,
        sellerConfirmed: deal.sellerConfirmed,
        escrow: {
            status: deal.escrowStatus,
            amount: deal.escrowAmount,
            currency: deal.escrowCurrency,
            providerRef: deal.escrowProviderRef,
            heldAt: deal.escrowHeldAt?.toISOString() ?? null,
            releasedAt: deal.escrowReleasedAt?.toISOString() ?? null,
            refundedAt: deal.escrowRefundedAt?.toISOString() ?? null,
        },
        meetingPlace: deal.meetingPlace,
        meetingLat: deal.meetingLat,
        meetingLng: deal.meetingLng,
        createdAt: deal.createdAt.toISOString(),
        completedAt: deal.completedAt?.toISOString() ?? null,
    };
}

function serializeReview(review: {
    id: number;
    dealId: number;
    reviewerId: number;
    revieweeId: number;
    rating: number;
    comment: string | null;
    createdAt: Date;
}): ReviewDto {
    return {
        id: review.id,
        dealId: review.dealId,
        reviewerId: review.reviewerId,
        revieweeId: review.revieweeId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
    };
}

function serializeDispute(dispute: {
    id: number;
    dealId: number;
    openedByUserId: number;
    reason: string;
    description: string;
    status: DisputeStatus;
    resolvedByAdmin: number | null;
    resolution: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
}): DisputeCaseDto {
    return {
        id: dispute.id,
        dealId: dispute.dealId,
        openedByUserId: dispute.openedByUserId,
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status,
        resolvedByAdmin: dispute.resolvedByAdmin,
        resolution: dispute.resolution,
        createdAt: dispute.createdAt.toISOString(),
        resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    };
}

const dealEscrowSelect = {
    id: true,
    listingId: true,
    buyerId: true,
    sellerId: true,
    finalPrice: true,
    quantity: true,
    currency: true,
    status: true,
    buyerConfirmed: true,
    sellerConfirmed: true,
    escrowStatus: true,
    escrowAmount: true,
    escrowCurrency: true,
    escrowProviderRef: true,
    escrowHeldAt: true,
    escrowReleasedAt: true,
    escrowRefundedAt: true,
    meetingPlace: true,
    meetingLat: true,
    meetingLng: true,
    createdAt: true,
    completedAt: true,
} satisfies Prisma.DealSelect;

const disputeCaseSelect = {
    id: true,
    dealId: true,
    openedByUserId: true,
    reason: true,
    description: true,
    status: true,
    resolvedByAdmin: true,
    resolution: true,
    createdAt: true,
    resolvedAt: true,
} satisfies Prisma.DisputeCaseSelect;

const dealEscrowWithDisputeSelect = {
    ...dealEscrowSelect,
    dispute: {
        select: disputeCaseSelect,
    },
} satisfies Prisma.DealSelect;

type DealEscrowRecord = Prisma.DealGetPayload<{ select: typeof dealEscrowSelect }>;
type DealEscrowWithDisputeRecord = Prisma.DealGetPayload<{
    select: typeof dealEscrowWithDisputeSelect;
}>;

const escrowWebhookEventSelect = {
    id: true,
    eventId: true,
    eventType: true,
    dealId: true,
    providerRef: true,
    status: true,
    processedAt: true,
    createdAt: true,
} satisfies Prisma.EscrowWebhookEventSelect;

type EscrowWebhookEventRecord = Prisma.EscrowWebhookEventGetPayload<{
    select: typeof escrowWebhookEventSelect;
}>;

function sanitizeWebhookPayload(payload: EscrowWebhookBody): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonObject;
}

function isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function findEscrowWebhookEventById(eventId: string): Promise<EscrowWebhookEventRecord | null> {
    return prisma.escrowWebhookEvent.findUnique({
        where: { eventId },
        select: escrowWebhookEventSelect,
    });
}

async function registerEscrowWebhookEvent(
    payload: EscrowWebhookBody,
): Promise<{ event: EscrowWebhookEventRecord; duplicate: boolean }> {
    const existing = await findEscrowWebhookEventById(payload.eventId);
    if (existing) {
        return {
            event: existing,
            duplicate: true,
        };
    }

    try {
        const event = await prisma.escrowWebhookEvent.create({
            data: {
                eventId: payload.eventId,
                eventType: payload.eventType,
                dealId: payload.dealId ?? null,
                providerRef: payload.providerRef ?? null,
                payload: sanitizeWebhookPayload(payload),
                status: EscrowWebhookEventStatus.RECEIVED,
            },
            select: escrowWebhookEventSelect,
        });

        return {
            event,
            duplicate: false,
        };
    } catch (error) {
        if (!isUniqueConstraintError(error)) {
            throw error;
        }

        const duplicateEvent = await findEscrowWebhookEventById(payload.eventId);
        if (!duplicateEvent) {
            throw error;
        }

        return {
            event: duplicateEvent,
            duplicate: true,
        };
    }
}

function assertModeratorOrAdmin(actor: DealActor): void {
    if (!isModeratorOrAdmin(actor)) {
        throw new ApiError(403, 'FORBIDDEN', 'Only moderators and admins can perform this action.');
    }
}

function normalizeIdempotencyKey(idempotencyKey: string | undefined | null, action: string): string {
    const normalized = idempotencyKey?.trim();
    if (!normalized) {
        throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', `${action} requires x-idempotency-key.`);
    }

    if (normalized.length > 120) {
        throw new ApiError(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency key is too long.');
    }

    return normalized;
}

async function returnEscrowIdempotentResult(idempotencyKey: string): Promise<DealDto | null> {
    const existing = await prisma.escrowLedgerEntry.findUnique({
        where: { idempotencyKey },
        select: { dealId: true },
    });

    if (!existing) {
        return null;
    }

    const deal = await prisma.deal.findUnique({
        where: { id: existing.dealId },
        select: dealEscrowSelect,
    });

    return deal ? serializeDeal(deal) : null;
}

export async function createDealFromOffer(
    userId: number,
    payload: CreateDealFromOfferBody,
): Promise<DealDto> {
    const offer = await prisma.offer.findUnique({
        where: { id: payload.offerId },
        select: {
            id: true,
            threadId: true,
            listingId: true,
            amount: true,
            quantity: true,
            status: true,
            thread: {
                select: {
                    buyerId: true,
                    sellerId: true,
                },
            },
            listing: {
                select: {
                    currency: true,
                },
            },
        },
    });

    if (!offer) {
        throw new ApiError(404, 'OFFER_NOT_FOUND', 'Offer not found.');
    }

    if (offer.thread.buyerId !== userId && offer.thread.sellerId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to create a deal for this offer.');
    }

    if (offer.status !== OfferStatus.ACCEPTED) {
        throw new ApiError(400, 'OFFER_NOT_ACCEPTED', 'Only accepted offers can be converted to deals.');
    }

    const existingDeal = await prisma.deal.findFirst({
        where: {
            listingId: offer.listingId,
            buyerId: offer.thread.buyerId,
            sellerId: offer.thread.sellerId,
            status: {
                in: [DealStatus.PENDING, DealStatus.CONFIRMED, DealStatus.COMPLETED, DealStatus.RATED, DealStatus.DISPUTED],
            },
        },
        select: { id: true },
    });

    if (existingDeal) {
        throw new ApiError(409, 'DEAL_ALREADY_EXISTS', 'A deal already exists for this offer.');
    }

    const normalizedMeetingPlace = sanitizeNullableText(payload.meetingPlace);
    const normalizedCourierName = sanitizeNullableText(payload.courierName);
    const normalizedTrackingNumber = sanitizeNullableText(payload.trackingNumber);

    const deal = await prisma.deal.create({
        data: {
            listingId: offer.listingId,
            buyerId: offer.thread.buyerId,
            sellerId: offer.thread.sellerId,
            finalPrice: payload.finalPrice ?? offer.amount,
            quantity: payload.quantity ?? offer.quantity,
            currency: payload.currency ?? offer.listing.currency ?? 'USD',
            meetingPlace: normalizedMeetingPlace,
            meetingLat: payload.meetingLat,
            meetingLng: payload.meetingLng,
            meetingTime: payload.meetingTime,
            deliveryMethod: payload.deliveryMethod,
            courierName: normalizedCourierName,
            trackingNumber: normalizedTrackingNumber,
            status: DealStatus.PENDING,
        },
        select: {
            id: true,
            listingId: true,
            buyerId: true,
            sellerId: true,
            finalPrice: true,
            quantity: true,
            currency: true,
            status: true,
            buyerConfirmed: true,
            sellerConfirmed: true,
            escrowStatus: true,
            escrowAmount: true,
            escrowCurrency: true,
            escrowProviderRef: true,
            escrowHeldAt: true,
            escrowReleasedAt: true,
            escrowRefundedAt: true,
            meetingPlace: true,
            meetingLat: true,
            meetingLng: true,
            createdAt: true,
            completedAt: true,
        },
    });

    await prisma.chatMessage.create({
        data: {
            threadId: offer.threadId,
            senderId: userId,
            type: MessageType.SYSTEM,
            content: `Deal #${deal.id} created`,
        },
    });

    await prisma.chatThread.update({
        where: { id: offer.threadId },
        data: { lastMessageAt: new Date() },
    });

    domainEventBus.publish('DEAL_CREATED', {
        dealId: deal.id,
        listingId: deal.listingId,
        buyerId: deal.buyerId,
        sellerId: deal.sellerId,
    });

    await incrementStoreAnalyticsMetric(deal.sellerId, 'dealsCreated');

    return serializeDeal(deal);
}

export async function confirmDeal(userId: number, dealId: number): Promise<DealDto> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            id: true,
            listingId: true,
            buyerId: true,
            sellerId: true,
            finalPrice: true,
            quantity: true,
            currency: true,
            status: true,
            buyerConfirmed: true,
            sellerConfirmed: true,
            escrowStatus: true,
            escrowAmount: true,
            escrowCurrency: true,
            escrowProviderRef: true,
            escrowHeldAt: true,
            escrowReleasedAt: true,
            escrowRefundedAt: true,
            meetingPlace: true,
            meetingLat: true,
            meetingLng: true,
            createdAt: true,
            completedAt: true,
        },
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to confirm this deal.');
    }

    if (
        deal.status === DealStatus.CANCELLED
        || deal.status === DealStatus.DISPUTED
        || deal.status === DealStatus.RATED
    ) {
        throw new ApiError(400, 'DEAL_NOT_CONFIRMABLE', 'This deal cannot be confirmed.');
    }

    const nextBuyerConfirmed = deal.buyerId === userId ? true : deal.buyerConfirmed;
    const nextSellerConfirmed = deal.sellerId === userId ? true : deal.sellerConfirmed;
    const bothConfirmed = nextBuyerConfirmed && nextSellerConfirmed;

    const updated = await prisma.deal.update({
        where: { id: deal.id },
        data: {
            buyerConfirmed: nextBuyerConfirmed,
            sellerConfirmed: nextSellerConfirmed,
            status: bothConfirmed ? DealStatus.COMPLETED : DealStatus.CONFIRMED,
            completedAt: bothConfirmed ? new Date() : null,
        },
        select: {
            id: true,
            listingId: true,
            buyerId: true,
            sellerId: true,
            finalPrice: true,
            quantity: true,
            currency: true,
            status: true,
            buyerConfirmed: true,
            sellerConfirmed: true,
            escrowStatus: true,
            escrowAmount: true,
            escrowCurrency: true,
            escrowProviderRef: true,
            escrowHeldAt: true,
            escrowReleasedAt: true,
            escrowRefundedAt: true,
            meetingPlace: true,
            meetingLat: true,
            meetingLng: true,
            createdAt: true,
            completedAt: true,
        },
    });

    if (bothConfirmed) {
        domainEventBus.publish('DEAL_COMPLETED', {
            dealId: updated.id,
            buyerId: updated.buyerId,
            sellerId: updated.sellerId,
        });
    }

    return serializeDeal(updated);
}

export async function holdDealEscrow(
    userId: number,
    dealId: number,
    payload: HoldEscrowBody,
    idempotencyKey?: string,
): Promise<DealDto> {
    const normalizedKey = normalizeIdempotencyKey(idempotencyKey, 'Hold escrow');
    const idempotentResult = await returnEscrowIdempotentResult(normalizedKey);
    if (idempotentResult) {
        return idempotentResult;
    }

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: dealEscrowSelect,
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    if (deal.buyerId !== userId) {
        throw new ApiError(403, 'ESCROW_HOLD_FORBIDDEN', 'Only the buyer can hold escrow for this deal.');
    }

    if (deal.status === DealStatus.CANCELLED || deal.status === DealStatus.DISPUTED) {
        throw new ApiError(400, 'DEAL_NOT_ESCROWABLE', 'This deal cannot accept escrow actions.');
    }

    if (deal.escrowStatus === EscrowStatus.HELD) {
        throw new ApiError(409, 'ESCROW_ALREADY_HELD', 'Escrow is already held for this deal.');
    }

    if (deal.escrowStatus === EscrowStatus.RELEASED) {
        throw new ApiError(409, 'ESCROW_ALREADY_RELEASED', 'Escrow has already been released for this deal.');
    }

    const amount = payload.amount ?? deal.finalPrice;
    const currency = payload.currency ?? deal.currency;

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const nextDeal = await tx.deal.update({
                where: { id: deal.id },
                data: {
                    escrowStatus: EscrowStatus.HELD,
                    escrowAmount: amount,
                    escrowCurrency: currency,
                    escrowProviderRef: payload.providerRef ?? null,
                    escrowHeldAt: new Date(),
                    escrowReleasedAt: null,
                    escrowRefundedAt: null,
                },
                select: dealEscrowSelect,
            });

            await tx.escrowLedgerEntry.create({
                data: {
                    dealId: deal.id,
                    actorUserId: userId,
                    entryType: EscrowLedgerEntryType.HOLD,
                    amount,
                    currency,
                    providerRef: payload.providerRef ?? null,
                    idempotencyKey: normalizedKey,
                    metadata: {
                        source: 'api',
                        previousEscrowStatus: deal.escrowStatus,
                    } as Prisma.InputJsonValue,
                },
            });

            return nextDeal;
        });

        return serializeDeal(updated);
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002'
        ) {
            const duplicateResult = await returnEscrowIdempotentResult(normalizedKey);
            if (duplicateResult) {
                return duplicateResult;
            }
        }

        throw error;
    }
}

export async function releaseDealEscrow(actor: DealActor, dealId: number, idempotencyKey?: string): Promise<DealDto> {
    const normalizedKey = normalizeIdempotencyKey(idempotencyKey, 'Release escrow');
    const idempotentResult = await returnEscrowIdempotentResult(normalizedKey);
    if (idempotentResult) {
        return idempotentResult;
    }

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: dealEscrowSelect,
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    const isPrivileged = isModeratorOrAdmin(actor);
    const isBuyer = deal.buyerId === actor.userId;
    if (!isBuyer && !isPrivileged) {
        throw new ApiError(403, 'ESCROW_RELEASE_FORBIDDEN', 'Only the buyer or moderation team can release escrow.');
    }

    if (deal.escrowStatus !== EscrowStatus.HELD) {
        throw new ApiError(400, 'ESCROW_NOT_HELD', 'Escrow must be held before release.');
    }

    if (deal.status === DealStatus.CANCELLED || deal.status === DealStatus.DISPUTED) {
        throw new ApiError(400, 'DEAL_NOT_ESCROWABLE', 'This deal cannot release escrow in its current status.');
    }

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const nextDeal = await tx.deal.update({
                where: { id: deal.id },
                data: {
                    escrowStatus: EscrowStatus.RELEASED,
                    escrowReleasedAt: new Date(),
                },
                select: dealEscrowSelect,
            });

            await tx.escrowLedgerEntry.create({
                data: {
                    dealId: deal.id,
                    actorUserId: actor.userId,
                    entryType: EscrowLedgerEntryType.RELEASE,
                    amount: deal.escrowAmount ?? deal.finalPrice,
                    currency: deal.escrowCurrency ?? deal.currency,
                    providerRef: deal.escrowProviderRef,
                    idempotencyKey: normalizedKey,
                    metadata: {
                        source: 'api',
                        previousEscrowStatus: deal.escrowStatus,
                        privileged: isPrivileged,
                    } as Prisma.InputJsonValue,
                },
            });

            if (isPrivileged) {
                await createAuditLog({
                    adminId: actor.userId,
                    action: 'ESCROW_RELEASE',
                    entityType: 'deal',
                    entityId: deal.id,
                    oldData: { escrowStatus: deal.escrowStatus } as Prisma.InputJsonObject,
                    newData: { escrowStatus: EscrowStatus.RELEASED } as Prisma.InputJsonObject,
                }, tx);
            }

            return nextDeal;
        });

        return serializeDeal(updated);
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002'
        ) {
            const duplicateResult = await returnEscrowIdempotentResult(normalizedKey);
            if (duplicateResult) {
                return duplicateResult;
            }
        }

        throw error;
    }
}

export async function refundDealEscrow(actor: DealActor, dealId: number, idempotencyKey?: string): Promise<DealDto> {
    const normalizedKey = normalizeIdempotencyKey(idempotencyKey, 'Refund escrow');
    const idempotentResult = await returnEscrowIdempotentResult(normalizedKey);
    if (idempotentResult) {
        return idempotentResult;
    }

    const isPrivileged = isModeratorOrAdmin(actor);
    if (!isPrivileged) {
        throw new ApiError(403, 'ESCROW_REFUND_FORBIDDEN', 'Only moderators and admins can refund escrow.');
    }

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: dealEscrowSelect,
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    if (deal.escrowStatus !== EscrowStatus.HELD) {
        throw new ApiError(400, 'ESCROW_NOT_HELD', 'Escrow must be held before refund.');
    }

    const shouldCancelDeal = deal.status !== DealStatus.COMPLETED;

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const nextDeal = await tx.deal.update({
                where: { id: deal.id },
                data: {
                    escrowStatus: EscrowStatus.REFUNDED,
                    escrowRefundedAt: new Date(),
                    status: shouldCancelDeal ? DealStatus.CANCELLED : deal.status,
                    completedAt: shouldCancelDeal ? null : deal.completedAt,
                },
                select: dealEscrowSelect,
            });

            await tx.escrowLedgerEntry.create({
                data: {
                    dealId: deal.id,
                    actorUserId: actor.userId,
                    entryType: EscrowLedgerEntryType.REFUND,
                    amount: deal.escrowAmount ?? deal.finalPrice,
                    currency: deal.escrowCurrency ?? deal.currency,
                    providerRef: deal.escrowProviderRef,
                    idempotencyKey: normalizedKey,
                    metadata: {
                        source: 'api',
                        previousEscrowStatus: deal.escrowStatus,
                        cancelledDeal: shouldCancelDeal,
                    } as Prisma.InputJsonValue,
                },
            });

            await createAuditLog({
                adminId: actor.userId,
                action: 'ESCROW_REFUND',
                entityType: 'deal',
                entityId: deal.id,
                oldData: { escrowStatus: deal.escrowStatus, dealStatus: deal.status } as Prisma.InputJsonObject,
                newData: {
                    escrowStatus: EscrowStatus.REFUNDED,
                    dealStatus: shouldCancelDeal ? DealStatus.CANCELLED : deal.status,
                } as Prisma.InputJsonObject,
            }, tx);

            return nextDeal;
        });

        return serializeDeal(updated);
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002'
        ) {
            const duplicateResult = await returnEscrowIdempotentResult(normalizedKey);
            if (duplicateResult) {
                return duplicateResult;
            }
        }

        throw error;
    }
}

export async function openDealDispute(
    userId: number,
    dealId: number,
    payload: CreateDisputeBody,
): Promise<DealDisputeDto> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: dealEscrowWithDisputeSelect,
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to open dispute on this deal.');
    }

    if (deal.status === DealStatus.CANCELLED) {
        throw new ApiError(400, 'DEAL_NOT_DISPUTABLE', 'Cancelled deals cannot be disputed.');
    }

    if (deal.dispute && deal.dispute.status !== DisputeStatus.RESOLVED) {
        throw new ApiError(409, 'DISPUTE_ALREADY_OPEN', 'This deal already has an active dispute.');
    }

    const normalizedReason = sanitizeText(payload.reason);
    const normalizedDescription = sanitizeText(payload.description);

    const dispute = deal.dispute
        ? await prisma.disputeCase.update({
              where: { dealId: deal.id },
              data: {
                  openedByUserId: userId,
                  reason: normalizedReason,
                  description: normalizedDescription,
                  status: DisputeStatus.OPEN,
                  resolvedByAdmin: null,
                  resolution: null,
                  resolvedAt: null,
              },
              select: disputeCaseSelect,
          })
        : await prisma.disputeCase.create({
              data: {
                  dealId: deal.id,
                  openedByUserId: userId,
                  reason: normalizedReason,
                  description: normalizedDescription,
                  status: DisputeStatus.OPEN,
              },
              select: disputeCaseSelect,
          });

    const updatedDeal =
        deal.status === DealStatus.DISPUTED
            ? deal
            : await prisma.deal.update({
                  where: { id: deal.id },
                  data: {
                      status: DealStatus.DISPUTED,
                      completedAt: null,
                  },
                  select: dealEscrowSelect,
              });

    domainEventBus.publish('DISPUTE_OPENED', {
        dealId: updatedDeal.id,
        participantUserIds: [updatedDeal.buyerId, updatedDeal.sellerId],
        openedByUserId: userId,
    });

    return {
        deal: serializeDeal(updatedDeal),
        dispute: serializeDispute(dispute),
    };
}

export async function reviewDealDispute(
    actor: DealActor,
    dealId: number,
    payload: ReviewDisputeBody,
): Promise<DealDisputeDto> {
    assertModeratorOrAdmin(actor);

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: dealEscrowWithDisputeSelect,
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    if (!deal.dispute) {
        throw new ApiError(404, 'DISPUTE_NOT_FOUND', 'No dispute found for this deal.');
    }

    const existingDispute = deal.dispute;

    if (existingDispute.status === DisputeStatus.RESOLVED) {
        throw new ApiError(409, 'DISPUTE_ALREADY_RESOLVED', 'Dispute is already resolved.');
    }

    const disputeNote = sanitizeNullableText(payload.note);

    const { dispute, updatedDeal } = await prisma.$transaction(async (tx) => {
        const nextDispute = await tx.disputeCase.update({
            where: { dealId: deal.id },
            data: {
                status: DisputeStatus.UNDER_REVIEW,
                resolution: disputeNote ?? existingDispute.resolution ?? null,
            },
            select: disputeCaseSelect,
        });

        const nextDeal =
            deal.status === DealStatus.DISPUTED
                ? deal
                : await tx.deal.update({
                      where: { id: deal.id },
                      data: {
                          status: DealStatus.DISPUTED,
                          completedAt: null,
                      },
                      select: dealEscrowSelect,
                  });

        await createAuditLog({
            adminId: actor.userId,
            action: 'DISPUTE_REVIEW',
            entityType: 'deal',
            entityId: deal.id,
            oldData: {
                disputeStatus: existingDispute.status,
                dealStatus: deal.status,
            } as Prisma.InputJsonObject,
            newData: {
                disputeStatus: DisputeStatus.UNDER_REVIEW,
                note: disputeNote,
            } as Prisma.InputJsonObject,
        }, tx);

        return {
            dispute: nextDispute,
            updatedDeal: nextDeal,
        };
    });

    return {
        deal: serializeDeal(updatedDeal),
        dispute: serializeDispute(dispute),
    };
}

function resolveDisputeMessage(payload: ResolveDisputeBody): string {
    if (payload.action === 'release_escrow') {
        return 'Dispute resolved by releasing escrow to seller.';
    }

    if (payload.action === 'refund_escrow') {
        return 'Dispute resolved by refunding escrow to buyer.';
    }

    return 'Dispute closed without changing escrow.';
}

export async function resolveDealDispute(
    actor: DealActor,
    dealId: number,
    payload: ResolveDisputeBody,
): Promise<DealDisputeDto> {
    assertModeratorOrAdmin(actor);

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: dealEscrowWithDisputeSelect,
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    if (!deal.dispute) {
        throw new ApiError(404, 'DISPUTE_NOT_FOUND', 'No dispute found for this deal.');
    }

    const existingDispute = deal.dispute;

    if (existingDispute.status === DisputeStatus.RESOLVED) {
        throw new ApiError(409, 'DISPUTE_ALREADY_RESOLVED', 'Dispute is already resolved.');
    }

    const normalizedResolution = sanitizeNullableText(payload.resolution);

    const { updatedDeal, dispute } = await prisma.$transaction(async (tx) => {
        let nextDeal: DealEscrowRecord | DealEscrowWithDisputeRecord = deal;
        if (payload.action === 'release_escrow') {
            if (deal.escrowStatus !== EscrowStatus.HELD) {
                throw new ApiError(400, 'ESCROW_NOT_HELD', 'Escrow must be held before release.');
            }

            nextDeal = await tx.deal.update({
                where: { id: deal.id },
                data: {
                    escrowStatus: EscrowStatus.RELEASED,
                    escrowReleasedAt: new Date(),
                    status: deal.status === DealStatus.DISPUTED ? DealStatus.CONFIRMED : deal.status,
                },
                select: dealEscrowSelect,
            });
        } else if (payload.action === 'refund_escrow') {
            if (deal.escrowStatus !== EscrowStatus.HELD) {
                throw new ApiError(400, 'ESCROW_NOT_HELD', 'Escrow must be held before refund.');
            }

            const shouldCancelDeal = deal.status !== DealStatus.COMPLETED;
            nextDeal = await tx.deal.update({
                where: { id: deal.id },
                data: {
                    escrowStatus: EscrowStatus.REFUNDED,
                    escrowRefundedAt: new Date(),
                    status: shouldCancelDeal ? DealStatus.CANCELLED : deal.status,
                    completedAt: shouldCancelDeal ? null : deal.completedAt,
                },
                select: dealEscrowSelect,
            });
        } else if (deal.status === DealStatus.DISPUTED) {
            nextDeal = await tx.deal.update({
                where: { id: deal.id },
                data: {
                    status: DealStatus.CONFIRMED,
                },
                select: dealEscrowSelect,
            });
        }

        const nextDispute = await tx.disputeCase.update({
            where: { dealId: deal.id },
            data: {
                status: DisputeStatus.RESOLVED,
                resolvedByAdmin: actor.userId,
                resolution: normalizedResolution ?? resolveDisputeMessage(payload),
                resolvedAt: new Date(),
            },
            select: disputeCaseSelect,
        });

        await createAuditLog({
            adminId: actor.userId,
            action: 'DISPUTE_RESOLVE',
            entityType: 'deal',
            entityId: deal.id,
            oldData: {
                disputeStatus: existingDispute.status,
                escrowStatus: deal.escrowStatus,
                dealStatus: deal.status,
            } as Prisma.InputJsonObject,
            newData: {
                disputeStatus: DisputeStatus.RESOLVED,
                escrowStatus: nextDeal.escrowStatus,
                dealStatus: nextDeal.status,
                action: payload.action,
                resolution: normalizedResolution ?? resolveDisputeMessage(payload),
            } as Prisma.InputJsonObject,
        }, tx);

        return {
            updatedDeal: nextDeal,
            dispute: nextDispute,
        };
    });

    return {
        deal: serializeDeal(updatedDeal),
        dispute: serializeDispute(dispute),
    };
}

async function resolveWebhookDeal(payload: EscrowWebhookBody) {
    if (payload.dealId !== undefined) {
        return prisma.deal.findUnique({
            where: { id: payload.dealId },
            select: dealEscrowWithDisputeSelect,
        });
    }

    return prisma.deal.findFirst({
        where: {
            escrowProviderRef: payload.providerRef,
        },
        select: dealEscrowWithDisputeSelect,
    });
}

export async function processEscrowWebhook(payload: EscrowWebhookBody): Promise<EscrowWebhookResultDto> {
    const registration = await registerEscrowWebhookEvent(payload);
    if (registration.duplicate) {
        const duplicateDeal = await resolveWebhookDeal(payload);
        return {
            eventId: payload.eventId,
            eventType: payload.eventType,
            applied: false,
            deduplicated: true,
            message: `Duplicate webhook event ignored (${registration.event.status}).`,
            deal: duplicateDeal ? serializeDeal(duplicateDeal) : null,
            dispute: duplicateDeal?.dispute ? serializeDispute(duplicateDeal.dispute) : null,
            participantIds: duplicateDeal ? [duplicateDeal.buyerId, duplicateDeal.sellerId] : [],
        };
    }

    try {
        const deal = await resolveWebhookDeal(payload);
        if (!deal) {
            throw new ApiError(404, 'DEAL_NOT_FOUND', 'No deal found for this webhook payload.');
        }

        let updatedDeal: DealEscrowRecord | DealEscrowWithDisputeRecord = deal;
        let updatedDispute = deal.dispute;
        let applied = false;
        let message = 'Webhook acknowledged with no state changes.';

        if (payload.eventType === 'escrow.held') {
            const nextAmount = payload.amount ?? deal.escrowAmount ?? deal.finalPrice;
            const nextCurrency = payload.currency ?? deal.escrowCurrency ?? deal.currency;
            const shouldApply =
                deal.escrowStatus !== EscrowStatus.HELD
                || deal.escrowAmount !== nextAmount
                || deal.escrowCurrency !== nextCurrency
                || (payload.providerRef && payload.providerRef !== deal.escrowProviderRef);

            if (shouldApply) {
                applied = true;
                updatedDeal = await prisma.deal.update({
                    where: { id: deal.id },
                    data: {
                        escrowStatus: EscrowStatus.HELD,
                        escrowAmount: nextAmount,
                        escrowCurrency: nextCurrency,
                        escrowProviderRef: payload.providerRef ?? deal.escrowProviderRef,
                        escrowHeldAt: new Date(),
                        escrowReleasedAt: null,
                        escrowRefundedAt: null,
                    },
                    select: dealEscrowSelect,
                });
                await prisma.escrowLedgerEntry.create({
                    data: {
                        dealId: deal.id,
                        actorUserId: null,
                        entryType: EscrowLedgerEntryType.HOLD,
                        amount: nextAmount,
                        currency: nextCurrency,
                        providerRef: payload.providerRef ?? deal.escrowProviderRef,
                        idempotencyKey: `${payload.eventId}:hold`,
                        metadata: {
                            source: 'webhook',
                            eventType: payload.eventType,
                        } as Prisma.InputJsonValue,
                    },
                });
                message = 'Escrow marked as held from provider webhook.';
            }
        } else if (payload.eventType === 'escrow.released') {
            if (deal.escrowStatus !== EscrowStatus.RELEASED) {
                applied = true;
                updatedDeal = await prisma.deal.update({
                    where: { id: deal.id },
                    data: {
                        escrowStatus: EscrowStatus.RELEASED,
                        escrowReleasedAt: new Date(),
                        status: deal.status === DealStatus.DISPUTED ? DealStatus.CONFIRMED : deal.status,
                    },
                    select: dealEscrowSelect,
                });
                await prisma.escrowLedgerEntry.create({
                    data: {
                        dealId: deal.id,
                        actorUserId: null,
                        entryType: EscrowLedgerEntryType.RELEASE,
                        amount: deal.escrowAmount ?? deal.finalPrice,
                        currency: deal.escrowCurrency ?? deal.currency,
                        providerRef: payload.providerRef ?? deal.escrowProviderRef,
                        idempotencyKey: `${payload.eventId}:release`,
                        metadata: {
                            source: 'webhook',
                            eventType: payload.eventType,
                        } as Prisma.InputJsonValue,
                    },
                });
                message = 'Escrow marked as released from provider webhook.';
            }
        } else if (payload.eventType === 'escrow.refunded') {
            if (deal.escrowStatus !== EscrowStatus.REFUNDED) {
                applied = true;
                const shouldCancelDeal = deal.status !== DealStatus.COMPLETED;
                updatedDeal = await prisma.deal.update({
                    where: { id: deal.id },
                    data: {
                        escrowStatus: EscrowStatus.REFUNDED,
                        escrowRefundedAt: new Date(),
                        status: shouldCancelDeal ? DealStatus.CANCELLED : deal.status,
                        completedAt: shouldCancelDeal ? null : deal.completedAt,
                    },
                    select: dealEscrowSelect,
                });
                await prisma.escrowLedgerEntry.create({
                    data: {
                        dealId: deal.id,
                        actorUserId: null,
                        entryType: EscrowLedgerEntryType.REFUND,
                        amount: deal.escrowAmount ?? deal.finalPrice,
                        currency: deal.escrowCurrency ?? deal.currency,
                        providerRef: payload.providerRef ?? deal.escrowProviderRef,
                        idempotencyKey: `${payload.eventId}:refund`,
                        metadata: {
                            source: 'webhook',
                            eventType: payload.eventType,
                        } as Prisma.InputJsonValue,
                    },
                });
                message = 'Escrow marked as refunded from provider webhook.';
            }
        } else if (payload.eventType === 'dispute.opened') {
            const reason = payload.reason ?? 'Provider dispute opened';
            const description = payload.description ?? 'Escrow provider opened a dispute.';
            updatedDispute = deal.dispute
                ? await prisma.disputeCase.update({
                      where: { dealId: deal.id },
                      data: {
                          status: DisputeStatus.OPEN,
                          reason,
                          description,
                          resolvedByAdmin: null,
                          resolution: null,
                          resolvedAt: null,
                      },
                      select: disputeCaseSelect,
                  })
                : await prisma.disputeCase.create({
                      data: {
                          dealId: deal.id,
                          openedByUserId: deal.buyerId,
                          reason,
                          description,
                          status: DisputeStatus.OPEN,
                      },
                      select: disputeCaseSelect,
                  });

            if (deal.status !== DealStatus.DISPUTED) {
                updatedDeal = await prisma.deal.update({
                    where: { id: deal.id },
                    data: {
                        status: DealStatus.DISPUTED,
                        completedAt: null,
                    },
                    select: dealEscrowSelect,
                });
            }

            applied = true;
            message = 'Dispute opened from provider webhook.';
        } else if (payload.eventType === 'dispute.resolved') {
            if (!deal.dispute) {
                throw new ApiError(404, 'DISPUTE_NOT_FOUND', 'No dispute found to resolve for this deal.');
            }

            if (payload.resolutionAction === 'release_escrow' && deal.escrowStatus === EscrowStatus.HELD) {
                updatedDeal = await prisma.deal.update({
                    where: { id: deal.id },
                    data: {
                        escrowStatus: EscrowStatus.RELEASED,
                        escrowReleasedAt: new Date(),
                        status: deal.status === DealStatus.DISPUTED ? DealStatus.CONFIRMED : deal.status,
                    },
                    select: dealEscrowSelect,
                });
                await prisma.escrowLedgerEntry.create({
                    data: {
                        dealId: deal.id,
                        actorUserId: null,
                        entryType: EscrowLedgerEntryType.RELEASE,
                        amount: deal.escrowAmount ?? deal.finalPrice,
                        currency: deal.escrowCurrency ?? deal.currency,
                        providerRef: payload.providerRef ?? deal.escrowProviderRef,
                        idempotencyKey: `${payload.eventId}:release`,
                        metadata: {
                            source: 'webhook',
                            eventType: payload.eventType,
                            resolutionAction: payload.resolutionAction,
                        } as Prisma.InputJsonValue,
                    },
                });
            } else if (payload.resolutionAction === 'refund_escrow' && deal.escrowStatus === EscrowStatus.HELD) {
                const shouldCancelDeal = deal.status !== DealStatus.COMPLETED;
                updatedDeal = await prisma.deal.update({
                    where: { id: deal.id },
                    data: {
                        escrowStatus: EscrowStatus.REFUNDED,
                        escrowRefundedAt: new Date(),
                        status: shouldCancelDeal ? DealStatus.CANCELLED : deal.status,
                        completedAt: shouldCancelDeal ? null : deal.completedAt,
                    },
                    select: dealEscrowSelect,
                });
                await prisma.escrowLedgerEntry.create({
                    data: {
                        dealId: deal.id,
                        actorUserId: null,
                        entryType: EscrowLedgerEntryType.REFUND,
                        amount: deal.escrowAmount ?? deal.finalPrice,
                        currency: deal.escrowCurrency ?? deal.currency,
                        providerRef: payload.providerRef ?? deal.escrowProviderRef,
                        idempotencyKey: `${payload.eventId}:refund`,
                        metadata: {
                            source: 'webhook',
                            eventType: payload.eventType,
                            resolutionAction: payload.resolutionAction,
                        } as Prisma.InputJsonValue,
                    },
                });
            } else if (payload.resolutionAction === 'close_no_escrow' && deal.status === DealStatus.DISPUTED) {
                updatedDeal = await prisma.deal.update({
                    where: { id: deal.id },
                    data: {
                        status: DealStatus.CONFIRMED,
                    },
                    select: dealEscrowSelect,
                });
            }

            updatedDispute = await prisma.disputeCase.update({
                where: { dealId: deal.id },
                data: {
                    status: DisputeStatus.RESOLVED,
                    resolution: payload.resolution ?? 'Resolved by escrow provider.',
                    resolvedByAdmin: deal.dispute.resolvedByAdmin ?? null,
                    resolvedAt: new Date(),
                },
                select: disputeCaseSelect,
            });

            applied = true;
            message = 'Dispute resolved from provider webhook.';
        }

        await prisma.escrowWebhookEvent.update({
            where: { id: registration.event.id },
            data: {
                status: EscrowWebhookEventStatus.PROCESSED,
                dealId: deal.id,
                providerRef: payload.providerRef ?? updatedDeal.escrowProviderRef ?? deal.escrowProviderRef,
                processedAt: new Date(),
                failureCode: null,
                failureMessage: null,
            },
        });

        return {
            eventId: payload.eventId,
            eventType: payload.eventType,
            applied,
            deduplicated: false,
            message,
            deal: serializeDeal(updatedDeal),
            dispute: updatedDispute ? serializeDispute(updatedDispute) : null,
            participantIds: [deal.buyerId, deal.sellerId],
        };
    } catch (error) {
        const failureCode = error instanceof ApiError ? error.code : 'UNHANDLED_ESCROW_WEBHOOK_ERROR';
        const failureMessage = error instanceof Error ? error.message : 'Unhandled error while processing webhook.';

        await prisma.escrowWebhookEvent.update({
            where: { id: registration.event.id },
            data: {
                status: EscrowWebhookEventStatus.FAILED,
                failureCode: failureCode.slice(0, 120),
                failureMessage: failureMessage.slice(0, 4000),
                processedAt: new Date(),
            },
        }).catch(() => undefined);

        throw error;
    }
}

export async function listMyDeals(
    userId: number,
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: DealSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);

    const statusFilter = typeof query.status === 'string' ? query.status : undefined;
    const where: Prisma.DealWhereInput = {
        OR: [{ buyerId: userId }, { sellerId: userId }],
    };
    if (statusFilter) {
        where.status = statusFilter as DealStatus;
    }

    const [total, deals] = await Promise.all([
        prisma.deal.count({ where }),
        prisma.deal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                listingId: true,
                buyerId: true,
                sellerId: true,
                finalPrice: true,
                quantity: true,
                currency: true,
                status: true,
                buyerConfirmed: true,
                sellerConfirmed: true,
                escrowStatus: true,
                escrowAmount: true,
                escrowCurrency: true,
                escrowProviderRef: true,
                escrowHeldAt: true,
                escrowReleasedAt: true,
                escrowRefundedAt: true,
                meetingPlace: true,
                meetingLat: true,
                meetingLng: true,
                createdAt: true,
                completedAt: true,
                listing: {
                    select: {
                        titleAr: true,
                        titleEn: true,
                        images: {
                            select: {
                                urlThumb: true,
                            },
                            orderBy: {
                                sortOrder: 'asc',
                            },
                            take: 1,
                        },
                    },
                },
            },
        }),
    ]);

    return {
        items: deals.map((deal) => ({
            ...serializeDeal(deal),
            listing: {
                title: localizeListingTitle(deal.listing, lang),
                coverImage: deal.listing.images[0]?.urlThumb ?? null,
            },
            otherUserId: deal.buyerId === userId ? deal.sellerId : deal.buyerId,
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function getDealById(
    actor: DealActor,
    dealId: number,
    lang: AppLanguage,
): Promise<DealDetailsDto> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            ...dealEscrowWithDisputeSelect,
            listing: {
                select: {
                    titleAr: true,
                    titleEn: true,
                    images: {
                        select: {
                            urlThumb: true,
                        },
                        orderBy: {
                            sortOrder: 'asc',
                        },
                        take: 1,
                    },
                },
            },
        },
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    const isParticipant = deal.buyerId === actor.userId || deal.sellerId === actor.userId;
    if (!isParticipant && !isModeratorOrAdmin(actor)) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to access this deal.');
    }

    return {
        ...serializeDeal(deal),
        listing: {
            title: localizeListingTitle(deal.listing, lang),
            coverImage: deal.listing.images[0]?.urlThumb ?? null,
        },
        dispute: deal.dispute ? serializeDispute(deal.dispute) : null,
    };
}

export async function createDealReview(
    userId: number,
    dealId: number,
    payload: CreateReviewBody,
): Promise<ReviewDto> {
    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        select: {
            id: true,
            buyerId: true,
            sellerId: true,
            status: true,
        },
    });

    if (!deal) {
        throw new ApiError(404, 'DEAL_NOT_FOUND', 'Deal not found.');
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to review this deal.');
    }

    if (deal.status !== DealStatus.COMPLETED && deal.status !== DealStatus.RATED) {
        throw new ApiError(400, 'DEAL_NOT_COMPLETED', 'Deal must be completed before reviewing.');
    }

    const existingReview = await prisma.review.findUnique({
        where: {
            dealId_reviewerId: {
                dealId,
                reviewerId: userId,
            },
        },
        select: { id: true },
    });

    if (existingReview) {
        throw new ApiError(409, 'REVIEW_ALREADY_EXISTS', 'You have already reviewed this deal.');
    }

    const revieweeId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
    const review = await prisma.$transaction(async (tx) => {
        const createdReview = await tx.review.create({
            data: {
                dealId,
                reviewerId: userId,
                revieweeId,
                rating: payload.rating,
                comment: sanitizeNullableText(payload.comment),
            },
            select: {
                id: true,
                dealId: true,
                reviewerId: true,
                revieweeId: true,
                rating: true,
                comment: true,
                createdAt: true,
            },
        });

        if (deal.status === DealStatus.COMPLETED) {
            await tx.deal.update({
                where: { id: dealId },
                data: {
                    status: DealStatus.RATED,
                },
            });
        }

        return createdReview;
    });

    domainEventBus.publish('REVIEW_RECEIVED', {
        reviewId: review.id,
        dealId,
        revieweeId,
        rating: review.rating,
    });
    return serializeReview(review);
}
