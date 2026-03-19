import {
    IdentityVerificationStatus,
    ListingStatus,
    NotificationType,
    OfferStatus,
    TrustScoreEventType,
} from '@prisma/client';
import { domainEventBus } from './domainEvents.js';
import {
    enqueueNotificationJob,
    enqueueTrustScoreRecalculationJob,
} from '../queues/queueManager.js';
import { logger } from '../shared/utils/logger.js';

let isRegistered = false;
let unsubscribers: Array<() => void> = [];

function fireAndForget(task: Promise<unknown>, context: string): void {
    task.catch((error) => {
        logger.error(`${context} failed`, error);
    });
}

export function registerDomainEventHandlers(): void {
    if (isRegistered) {
        return;
    }

    unsubscribers = [
        domainEventBus.subscribe('EMAIL_VERIFIED', ({ userId }) => {
            fireAndForget(
                Promise.all([
                    enqueueTrustScoreRecalculationJob({
                        userId,
                        eventType: TrustScoreEventType.EMAIL_VERIFIED,
                        metadata: { source: 'auth.verifyEmailToken' },
                    }),
                    enqueueNotificationJob({
                        recipientUserIds: [userId],
                        notificationType: NotificationType.SYSTEM,
                        platformKind: 'system',
                        title: 'Email verified',
                        body: 'Your email address has been verified successfully.',
                        dedupKey: `email-verified:${userId}`,
                    }),
                ]),
                'EMAIL_VERIFIED handler',
            );
        }),
        domainEventBus.subscribe('PHONE_VERIFIED', ({ userId }) => {
            fireAndForget(
                Promise.all([
                    enqueueTrustScoreRecalculationJob({
                        userId,
                        eventType: TrustScoreEventType.PHONE_VERIFIED,
                        metadata: { source: 'auth.verifyPhoneOtp' },
                    }),
                    enqueueNotificationJob({
                        recipientUserIds: [userId],
                        notificationType: NotificationType.SYSTEM,
                        platformKind: 'system',
                        title: 'Phone verified',
                        body: 'Your phone number has been verified successfully.',
                        dedupKey: `phone-verified:${userId}`,
                    }),
                ]),
                'PHONE_VERIFIED handler',
            );
        }),
        domainEventBus.subscribe('MESSAGE_SENT', (payload) => {
            const body =
                payload.messageKind === 'IMAGE'
                    ? 'You received a new image in chat.'
                    : payload.preview;

            fireAndForget(
                enqueueNotificationJob({
                    recipientUserIds: payload.recipientUserIds,
                    notificationType: NotificationType.MESSAGE_RECEIVED,
                    platformKind: 'system',
                    title: 'New message',
                    body,
                    link: `/chat?thread=${payload.threadId}`,
                    targetType: 'thread',
                    targetId: payload.threadId,
                    dedupKey: `message:${payload.threadId}:${payload.senderId}:${payload.preview}`,
                }),
                'MESSAGE_SENT handler',
            );
        }),
        domainEventBus.subscribe('PHONE_REQUESTED', (payload) => {
            fireAndForget(
                enqueueNotificationJob({
                    recipientUserIds: payload.recipientUserIds,
                    notificationType: NotificationType.PHONE_REQUESTED,
                    platformKind: 'system',
                    title: 'Phone request',
                    body: 'A buyer requested your phone number inside chat.',
                    link: `/chat?thread=${payload.threadId}`,
                    targetType: 'thread',
                    targetId: payload.threadId,
                    dedupKey: `phone-request:${payload.threadId}:${payload.requesterUserId}`,
                }),
                'PHONE_REQUESTED handler',
            );
        }),
        domainEventBus.subscribe('OFFER_SENT', (payload) => {
            fireAndForget(
                enqueueNotificationJob({
                    recipientUserIds: payload.recipientUserIds,
                    notificationType: NotificationType.OFFER_RECEIVED,
                    platformKind: 'deal_update',
                    title: 'New offer received',
                    body: `You received an offer of ${payload.amount}${payload.currency ? ` ${payload.currency}` : ''}.`,
                    link: `/chat?thread=${payload.threadId}`,
                    targetType: 'offer',
                    targetId: payload.offerId,
                    dedupKey: `offer-sent:${payload.offerId}`,
                }),
                'OFFER_SENT handler',
            );
        }),
        domainEventBus.subscribe('OFFER_RESPONDED', (payload) => {
            const body =
                payload.status === OfferStatus.ACCEPTED
                    ? 'Your offer was accepted.'
                    : payload.status === OfferStatus.REJECTED
                        ? 'Your offer was rejected.'
                        : `Your offer received a counter at ${payload.counterAmount ?? 0}.`;

            fireAndForget(
                enqueueNotificationJob({
                    recipientUserIds: payload.recipientUserIds,
                    notificationType: NotificationType.OFFER_RESPONDED,
                    platformKind: 'deal_update',
                    title: 'Offer update',
                    body,
                    link: `/chat?thread=${payload.threadId}`,
                    targetType: 'offer',
                    targetId: payload.offerId,
                    dedupKey: `offer-response:${payload.offerId}:${payload.status}`,
                }),
                'OFFER_RESPONDED handler',
            );
        }),
        domainEventBus.subscribe('DEAL_CREATED', (payload) => {
            fireAndForget(
                enqueueNotificationJob({
                    recipientUserIds: [payload.buyerId, payload.sellerId],
                    notificationType: NotificationType.DEAL_CREATED,
                    platformKind: 'deal_update',
                    title: 'Deal created',
                    body: `Deal #${payload.dealId} is ready for confirmation and escrow.`,
                    link: `/deals/${payload.dealId}`,
                    targetType: 'deal',
                    targetId: payload.dealId,
                    dedupKey: `deal-created:${payload.dealId}`,
                }),
                'DEAL_CREATED handler',
            );
        }),
        domainEventBus.subscribe('DEAL_COMPLETED', (payload) => {
            fireAndForget(
                Promise.all([
                    enqueueNotificationJob({
                        recipientUserIds: [payload.buyerId, payload.sellerId],
                        notificationType: NotificationType.DEAL_COMPLETED,
                        platformKind: 'deal_update',
                        title: 'Deal completed',
                        body: `Deal #${payload.dealId} has been completed.`,
                        link: `/deals/${payload.dealId}`,
                        targetType: 'deal',
                        targetId: payload.dealId,
                        dedupKey: `deal-completed:${payload.dealId}`,
                    }),
                    enqueueTrustScoreRecalculationJob({
                        userId: payload.buyerId,
                        eventType: TrustScoreEventType.DEAL_COMPLETED,
                        metadata: { dealId: payload.dealId },
                    }),
                    enqueueTrustScoreRecalculationJob({
                        userId: payload.sellerId,
                        eventType: TrustScoreEventType.DEAL_COMPLETED,
                        metadata: { dealId: payload.dealId },
                    }),
                ]),
                'DEAL_COMPLETED handler',
            );
        }),
        domainEventBus.subscribe('DISPUTE_OPENED', (payload) => {
            fireAndForget(
                enqueueNotificationJob({
                    recipientUserIds: payload.participantUserIds,
                    notificationType: NotificationType.DISPUTE_OPENED,
                    platformKind: 'deal_update',
                    title: 'Dispute opened',
                    body: `A dispute was opened for deal #${payload.dealId}.`,
                    link: `/deals/${payload.dealId}`,
                    targetType: 'deal',
                    targetId: payload.dealId,
                    dedupKey: `dispute-opened:${payload.dealId}`,
                }),
                'DISPUTE_OPENED handler',
            );
        }),
        domainEventBus.subscribe('REVIEW_RECEIVED', (payload) => {
            fireAndForget(
                Promise.all([
                    enqueueNotificationJob({
                        recipientUserIds: [payload.revieweeId],
                        notificationType: NotificationType.REVIEW_RECEIVED,
                        platformKind: 'system',
                        title: 'New review received',
                        body: `You received a ${payload.rating}/5 review.`,
                        link: '/reviews',
                        targetType: 'review',
                        targetId: payload.reviewId,
                        dedupKey: `review-received:${payload.reviewId}`,
                    }),
                    enqueueTrustScoreRecalculationJob({
                        userId: payload.revieweeId,
                        eventType: TrustScoreEventType.REVIEW_RECEIVED,
                        metadata: { dealId: payload.dealId, rating: payload.rating },
                    }),
                ]),
                'REVIEW_RECEIVED handler',
            );
        }),
        domainEventBus.subscribe('LISTING_MODERATED', (payload) => {
            const notificationType =
                payload.status === ListingStatus.ACTIVE
                    ? NotificationType.LISTING_APPROVED
                    : payload.status === ListingStatus.REJECTED
                        ? NotificationType.LISTING_REJECTED
                        : NotificationType.SYSTEM;

            fireAndForget(
                enqueueNotificationJob({
                    recipientUserIds: [payload.ownerUserId],
                    notificationType,
                    platformKind: 'moderation',
                    title: 'Listing moderation update',
                    body: `Your listing #${payload.listingId} was ${payload.action}.`,
                    link: `/listing/${payload.listingId}`,
                    targetType: 'listing',
                    targetId: payload.listingId,
                    dedupKey: `listing-moderated:${payload.listingId}:${payload.status}`,
                }),
                'LISTING_MODERATED handler',
            );
        }),
        domainEventBus.subscribe('IDENTITY_VERIFICATION_REVIEWED', (payload) => {
            const approved = payload.status === IdentityVerificationStatus.VERIFIED;
            fireAndForget(
                Promise.all([
                    enqueueNotificationJob({
                        recipientUserIds: [payload.userId],
                        notificationType:
                            approved
                                ? NotificationType.VERIFICATION_APPROVED
                                : NotificationType.VERIFICATION_REJECTED,
                        platformKind: 'system',
                        title: approved ? 'Verification approved' : 'Verification rejected',
                        body: approved
                            ? 'Your identity verification was approved.'
                            : 'Your identity verification was rejected.',
                        link: '/security',
                        targetType: 'identity_verification',
                        targetId: payload.userId,
                        dedupKey: `identity-review:${payload.userId}:${payload.status}`,
                    }),
                    ...(approved
                        ? [
                              enqueueTrustScoreRecalculationJob({
                                  userId: payload.userId,
                                  eventType: TrustScoreEventType.ID_VERIFIED,
                                  metadata: { source: 'admin.resolveIdentityVerification' },
                              }),
                          ]
                        : []),
                ]),
                'IDENTITY_VERIFICATION_REVIEWED handler',
            );
        }),
        domainEventBus.subscribe('TRUST_RECALCULATION_REQUESTED', (payload) => {
            fireAndForget(
                enqueueTrustScoreRecalculationJob({
                    userId: payload.userId,
                    eventType: payload.eventType,
                    metadata: payload.metadata,
                }),
                'TRUST_RECALCULATION_REQUESTED handler',
            );
        }),
    ];

    isRegistered = true;
}

export function unregisterDomainEventHandlers(): void {
    for (const unsubscribe of unsubscribers) {
        unsubscribe();
    }
    unsubscribers = [];
    isRegistered = false;
}
