import {
    DealStatus,
    DisputeStatus,
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
import { calculateTrustScoreFromRaw, resolveTrustTier } from '../../shared/utils/trustScore.js';
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

async function recalculateUserTrust(userId: number): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            googleId: true,
            facebookId: true,
            createdAt: true,
            avgResponseHours: true,
        },
    });

    if (!user) {
        return;
    }

    const [ratingAgg, completedTransactions, disputeCount] = await Promise.all([
        prisma.review.aggregate({
            where: { revieweeId: userId },
            _avg: { rating: true },
        }),
        prisma.deal.count({
            where: {
                status: DealStatus.COMPLETED,
                OR: [{ buyerId: userId }, { sellerId: userId }],
            },
        }),
        prisma.disputeCase.count({
            where: {
                deal: {
                    OR: [{ buyerId: userId }, { sellerId: userId }],
                },
            },
        }),
    ]);

    let verificationPoints = 0;
    if (user.emailVerifiedAt) verificationPoints += 1;
    if (user.phoneVerifiedAt) verificationPoints += 1;
    if (user.googleId) verificationPoints += 1;
    if (user.facebookId) verificationPoints += 1;

    const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    const score = calculateTrustScoreFromRaw({
        verificationPoints,
        averageRating: ratingAgg._avg.rating ?? 0,
        completedTransactions,
        accountAgeDays,
        avgResponseHours: user.avgResponseHours,
        disputesCount: disputeCount,
    });

    await prisma.user.update({
        where: { id: userId },
        data: {
            trustScore: score,
            trustTier: resolveTrustTier(score),
        },
    });
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
                in: [DealStatus.PENDING, DealStatus.CONFIRMED, DealStatus.COMPLETED],
            },
        },
        select: { id: true },
    });

    if (existingDeal) {
        throw new ApiError(409, 'DEAL_ALREADY_EXISTS', 'A deal already exists for this offer.');
    }

    const deal = await prisma.deal.create({
        data: {
            listingId: offer.listingId,
            buyerId: offer.thread.buyerId,
            sellerId: offer.thread.sellerId,
            finalPrice: payload.finalPrice ?? offer.amount,
            quantity: payload.quantity ?? offer.quantity,
            currency: payload.currency ?? offer.listing.currency ?? 'USD',
            meetingPlace: payload.meetingPlace,
            meetingLat: payload.meetingLat,
            meetingLng: payload.meetingLng,
            meetingTime: payload.meetingTime,
            deliveryMethod: payload.deliveryMethod,
            courierName: payload.courierName,
            trackingNumber: payload.trackingNumber,
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

    if (deal.status === DealStatus.CANCELLED || deal.status === DealStatus.DISPUTED) {
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
        await Promise.all([recalculateUserTrust(updated.buyerId), recalculateUserTrust(updated.sellerId)]);
    }

    return serializeDeal(updated);
}

export async function holdDealEscrow(
    userId: number,
    dealId: number,
    payload: HoldEscrowBody,
): Promise<DealDto> {
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

    const updated = await prisma.deal.update({
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

    return serializeDeal(updated);
}

export async function releaseDealEscrow(actor: DealActor, dealId: number): Promise<DealDto> {
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

    const updated = await prisma.deal.update({
        where: { id: deal.id },
        data: {
            escrowStatus: EscrowStatus.RELEASED,
            escrowReleasedAt: new Date(),
        },
        select: dealEscrowSelect,
    });

    return serializeDeal(updated);
}

export async function refundDealEscrow(actor: DealActor, dealId: number): Promise<DealDto> {
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

    const updated = await prisma.deal.update({
        where: { id: deal.id },
        data: {
            escrowStatus: EscrowStatus.REFUNDED,
            escrowRefundedAt: new Date(),
            status: shouldCancelDeal ? DealStatus.CANCELLED : deal.status,
            completedAt: shouldCancelDeal ? null : deal.completedAt,
        },
        select: dealEscrowSelect,
    });

    return serializeDeal(updated);
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

    const dispute = deal.dispute
        ? await prisma.disputeCase.update({
              where: { dealId: deal.id },
              data: {
                  openedByUserId: userId,
                  reason: payload.reason,
                  description: payload.description,
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
                  reason: payload.reason,
                  description: payload.description,
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

    if (deal.dispute.status === DisputeStatus.RESOLVED) {
        throw new ApiError(409, 'DISPUTE_ALREADY_RESOLVED', 'Dispute is already resolved.');
    }

    const dispute = await prisma.disputeCase.update({
        where: { dealId: deal.id },
        data: {
            status: DisputeStatus.UNDER_REVIEW,
            resolution: payload.note ?? deal.dispute.resolution ?? null,
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

    if (deal.dispute.status === DisputeStatus.RESOLVED) {
        throw new ApiError(409, 'DISPUTE_ALREADY_RESOLVED', 'Dispute is already resolved.');
    }

    let updatedDeal: DealEscrowRecord | DealEscrowWithDisputeRecord = deal;
    if (payload.action === 'release_escrow') {
        if (deal.escrowStatus !== EscrowStatus.HELD) {
            throw new ApiError(400, 'ESCROW_NOT_HELD', 'Escrow must be held before release.');
        }

        updatedDeal = await prisma.deal.update({
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
    } else if (deal.status === DealStatus.DISPUTED) {
        updatedDeal = await prisma.deal.update({
            where: { id: deal.id },
            data: {
                status: DealStatus.CONFIRMED,
            },
            select: dealEscrowSelect,
        });
    }

    const dispute = await prisma.disputeCase.update({
        where: { dealId: deal.id },
        data: {
            status: DisputeStatus.RESOLVED,
            resolvedByAdmin: actor.userId,
            resolution: payload.resolution ?? resolveDisputeMessage(payload),
            resolvedAt: new Date(),
        },
        select: disputeCaseSelect,
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

    if (deal.status !== DealStatus.COMPLETED) {
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
    const review = await prisma.review.create({
        data: {
            dealId,
            reviewerId: userId,
            revieweeId,
            rating: payload.rating,
            comment: payload.comment,
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

    await recalculateUserTrust(revieweeId);
    return serializeReview(review);
}
