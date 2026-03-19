import { EventEmitter } from 'node:events';
import type {
    IdentityVerificationStatus,
    ListingStatus,
    OfferStatus,
    TrustScoreEventType,
} from '@prisma/client';

export interface DomainEventMap {
    LISTING_CREATED: {
        listingId: number;
        userId: number;
    };
    LISTING_MODERATED: {
        listingId: number;
        ownerUserId: number;
        status: ListingStatus;
        action: 'approve' | 'reject' | 'suspend' | 'delete';
    };
    MESSAGE_SENT: {
        threadId: number;
        senderId: number;
        recipientUserIds: number[];
        preview: string;
        messageKind: 'TEXT' | 'IMAGE';
    };
    PHONE_REQUESTED: {
        threadId: number;
        requesterUserId: number;
        recipientUserIds: number[];
    };
    OFFER_SENT: {
        offerId: number;
        threadId: number;
        listingId: number;
        senderId: number;
        recipientUserIds: number[];
        amount: number;
        currency: string | null;
    };
    OFFER_RESPONDED: {
        offerId: number;
        threadId: number;
        listingId: number;
        actorUserId: number;
        recipientUserIds: number[];
        status: OfferStatus;
        counterAmount: number | null;
    };
    DEAL_CREATED: {
        dealId: number;
        listingId: number;
        buyerId: number;
        sellerId: number;
    };
    DEAL_COMPLETED: {
        dealId: number;
        buyerId: number;
        sellerId: number;
    };
    DISPUTE_OPENED: {
        dealId: number;
        participantUserIds: number[];
        openedByUserId: number;
    };
    REVIEW_RECEIVED: {
        reviewId: number;
        dealId: number;
        revieweeId: number;
        rating: number;
    };
    EMAIL_VERIFIED: {
        userId: number;
    };
    PHONE_VERIFIED: {
        userId: number;
    };
    IDENTITY_VERIFICATION_REVIEWED: {
        userId: number;
        status: IdentityVerificationStatus;
    };
    TRUST_RECALCULATION_REQUESTED: {
        userId: number;
        eventType: TrustScoreEventType;
        metadata?: Record<string, unknown>;
    };
}

type DomainEventName = keyof DomainEventMap;

type DomainEventListener<K extends DomainEventName> = (
    payload: DomainEventMap[K],
) => void | Promise<void>;

class DomainEventBus {
    private readonly emitter = new EventEmitter();

    publish<K extends DomainEventName>(eventName: K, payload: DomainEventMap[K]): void {
        this.emitter.emit(eventName, payload);
    }

    subscribe<K extends DomainEventName>(
        eventName: K,
        listener: DomainEventListener<K>,
    ): () => void {
        const wrapped = (payload: DomainEventMap[K]): void => {
            void Promise.resolve(listener(payload));
        };

        this.emitter.on(eventName, wrapped);
        return () => {
            this.emitter.off(eventName, wrapped);
        };
    }

    removeAllListeners(): void {
        this.emitter.removeAllListeners();
    }
}

export const domainEventBus = new DomainEventBus();
