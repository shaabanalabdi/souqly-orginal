import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';

describe('Deal routes', () => {
    it('POST /api/v1/deals/from-offer creates deal from accepted offer', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.offer, 'findUnique').mockResolvedValue({
            id: 51,
            threadId: 7,
            listingId: 200,
            amount: 1000,
            quantity: 1,
            status: 'ACCEPTED',
            thread: {
                buyerId: 41,
                sellerId: 99,
            },
            listing: {
                currency: 'USD',
            },
        } as never);
        jest.spyOn(prisma.deal, 'findFirst').mockResolvedValue(null);
        jest.spyOn(prisma.deal, 'create').mockResolvedValue({
            id: 300,
            listingId: 200,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 1000,
            quantity: 1,
            currency: 'USD',
            status: 'PENDING',
            buyerConfirmed: false,
            sellerConfirmed: false,
            escrowStatus: 'NONE',
            escrowAmount: null,
            escrowCurrency: null,
            escrowProviderRef: null,
            escrowHeldAt: null,
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);
        jest.spyOn(prisma.chatMessage, 'create').mockResolvedValue({ id: 1 } as never);
        jest.spyOn(prisma.chatThread, 'update').mockResolvedValue({ id: 7 } as never);

        const response = await request(app)
            .post('/api/v1/deals/from-offer')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                offerId: 51,
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(300);
        expect(response.body.data.status).toBe('PENDING');
    });

    it('PATCH /api/v1/deals/:id/confirm sets deal confirmed/completed', async () => {
        const accessToken = signAccessToken({ userId: 99, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 300,
            listingId: 200,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 1000,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 1000,
            escrowCurrency: 'USD',
            escrowProviderRef: null,
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);
        jest.spyOn(prisma.deal, 'update').mockResolvedValue({
            id: 300,
            listingId: 200,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 1000,
            quantity: 1,
            currency: 'USD',
            status: 'COMPLETED',
            buyerConfirmed: true,
            sellerConfirmed: true,
            escrowStatus: 'RELEASED',
            escrowAmount: 1000,
            escrowCurrency: 'USD',
            escrowProviderRef: null,
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: new Date('2026-01-01T03:00:00.000Z'),
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: new Date('2026-01-01T03:00:00.000Z'),
        } as never);

        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 41,
            emailVerifiedAt: new Date(),
            phoneVerifiedAt: null,
            googleId: null,
            facebookId: null,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            avgResponseHours: 12,
        } as never);
        jest.spyOn(prisma.review, 'aggregate').mockResolvedValue({
            _avg: { rating: 4 },
            _count: { rating: 1 },
            _sum: { rating: 4 },
            _min: { rating: 4 },
            _max: { rating: 4 },
        } as never);
        jest.spyOn(prisma.deal, 'count').mockResolvedValue(2);
        jest.spyOn(prisma.disputeCase, 'count').mockResolvedValue(0);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 41 } as never);

        const response = await request(app)
            .patch('/api/v1/deals/300/confirm')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('COMPLETED');
    });

    it('GET /api/v1/deals/my lists user deals', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.deal, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.deal, 'findMany').mockResolvedValue([
            {
                id: 300,
                listingId: 200,
                buyerId: 41,
                sellerId: 99,
                finalPrice: 1000,
                quantity: 1,
                currency: 'USD',
                status: 'PENDING',
                buyerConfirmed: false,
                sellerConfirmed: false,
                escrowStatus: 'NONE',
                escrowAmount: null,
                escrowCurrency: null,
                escrowProviderRef: null,
                escrowHeldAt: null,
                escrowReleasedAt: null,
                escrowRefundedAt: null,
                meetingPlace: null,
                meetingLat: null,
                meetingLng: null,
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                completedAt: null,
                listing: {
                    titleAr: 'عنوان',
                    titleEn: 'Title',
                    images: [{ urlThumb: 'https://img.example/thumb.jpg' }],
                },
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/deals/my?lang=en')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta.total).toBe(1);
    });

    it('PATCH /api/v1/deals/:id/escrow/hold holds escrow for buyer', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'VERIFIED' });

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 301,
            listingId: 201,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 1200,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'NONE',
            escrowAmount: null,
            escrowCurrency: null,
            escrowProviderRef: null,
            escrowHeldAt: null,
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);
        jest.spyOn(prisma.deal, 'update').mockResolvedValue({
            id: 301,
            listingId: 201,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 1200,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 1200,
            escrowCurrency: 'USD',
            escrowProviderRef: null,
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);

        const response = await request(app)
            .patch('/api/v1/deals/301/escrow/hold')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.escrow.status).toBe('HELD');
    });

    it('PATCH /api/v1/deals/:id/escrow/release releases held escrow', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'VERIFIED' });

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 302,
            listingId: 202,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 900,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 900,
            escrowCurrency: 'USD',
            escrowProviderRef: 'ref_123',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);
        jest.spyOn(prisma.deal, 'update').mockResolvedValue({
            id: 302,
            listingId: 202,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 900,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'RELEASED',
            escrowAmount: 900,
            escrowCurrency: 'USD',
            escrowProviderRef: 'ref_123',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: new Date('2026-01-01T02:00:00.000Z'),
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);

        const response = await request(app)
            .patch('/api/v1/deals/302/escrow/release')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.escrow.status).toBe('RELEASED');
    });

    it('PATCH /api/v1/deals/:id/escrow/refund refunds escrow for admin', async () => {
        const accessToken = signAccessToken({ userId: 1, role: 'ADMIN', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 303,
            listingId: 203,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 700,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 700,
            escrowCurrency: 'USD',
            escrowProviderRef: null,
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);
        jest.spyOn(prisma.deal, 'update').mockResolvedValue({
            id: 303,
            listingId: 203,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 700,
            quantity: 1,
            currency: 'USD',
            status: 'CANCELLED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'REFUNDED',
            escrowAmount: 700,
            escrowCurrency: 'USD',
            escrowProviderRef: null,
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: new Date('2026-01-01T03:00:00.000Z'),
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);

        const response = await request(app)
            .patch('/api/v1/deals/303/escrow/refund')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.escrow.status).toBe('REFUNDED');
        expect(response.body.data.status).toBe('CANCELLED');
    });

    it('POST /api/v1/deals/:id/dispute opens dispute for participant', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'VERIFIED' });

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 304,
            listingId: 204,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 800,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 800,
            escrowCurrency: 'USD',
            escrowProviderRef: 'provider_ref_304',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
            dispute: null,
        } as never);
        jest.spyOn(prisma.disputeCase, 'create').mockResolvedValue({
            id: 501,
            dealId: 304,
            openedByUserId: 41,
            reason: 'Item mismatch',
            description: 'The delivered item does not match agreed condition.',
            status: 'OPEN',
            resolvedByAdmin: null,
            resolution: null,
            createdAt: new Date('2026-01-01T04:00:00.000Z'),
            resolvedAt: null,
        } as never);
        jest.spyOn(prisma.deal, 'update').mockResolvedValue({
            id: 304,
            listingId: 204,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 800,
            quantity: 1,
            currency: 'USD',
            status: 'DISPUTED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 800,
            escrowCurrency: 'USD',
            escrowProviderRef: 'provider_ref_304',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);

        const response = await request(app)
            .post('/api/v1/deals/304/dispute')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                reason: 'Item mismatch',
                description: 'The delivered item does not match agreed condition.',
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.deal.status).toBe('DISPUTED');
        expect(response.body.data.dispute.status).toBe('OPEN');
    });

    it('PATCH /api/v1/deals/:id/dispute/review moves dispute to under review for moderator', async () => {
        const accessToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 305,
            listingId: 205,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 650,
            quantity: 1,
            currency: 'USD',
            status: 'DISPUTED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 650,
            escrowCurrency: 'USD',
            escrowProviderRef: 'provider_ref_305',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
            dispute: {
                id: 502,
                dealId: 305,
                openedByUserId: 41,
                reason: 'Delay issue',
                description: 'Delivery delay dispute.',
                status: 'OPEN',
                resolvedByAdmin: null,
                resolution: null,
                createdAt: new Date('2026-01-01T03:00:00.000Z'),
                resolvedAt: null,
            },
        } as never);
        jest.spyOn(prisma.disputeCase, 'update').mockResolvedValue({
            id: 502,
            dealId: 305,
            openedByUserId: 41,
            reason: 'Delay issue',
            description: 'Delivery delay dispute.',
            status: 'UNDER_REVIEW',
            resolvedByAdmin: null,
            resolution: 'Moderator is reviewing',
            createdAt: new Date('2026-01-01T03:00:00.000Z'),
            resolvedAt: null,
        } as never);

        const response = await request(app)
            .patch('/api/v1/deals/305/dispute/review')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ note: 'Moderator is reviewing' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.dispute.status).toBe('UNDER_REVIEW');
    });

    it('PATCH /api/v1/deals/:id/dispute/resolve refunds escrow and resolves dispute', async () => {
        const accessToken = signAccessToken({ userId: 1, role: 'ADMIN', trustTier: 'TOP_SELLER' });

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 306,
            listingId: 206,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 550,
            quantity: 1,
            currency: 'USD',
            status: 'DISPUTED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 550,
            escrowCurrency: 'USD',
            escrowProviderRef: 'provider_ref_306',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
            dispute: {
                id: 503,
                dealId: 306,
                openedByUserId: 41,
                reason: 'Condition issue',
                description: 'Product condition differs from listing.',
                status: 'UNDER_REVIEW',
                resolvedByAdmin: null,
                resolution: null,
                createdAt: new Date('2026-01-01T03:00:00.000Z'),
                resolvedAt: null,
            },
        } as never);
        jest.spyOn(prisma.deal, 'update').mockResolvedValue({
            id: 306,
            listingId: 206,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 550,
            quantity: 1,
            currency: 'USD',
            status: 'CANCELLED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'REFUNDED',
            escrowAmount: 550,
            escrowCurrency: 'USD',
            escrowProviderRef: 'provider_ref_306',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: new Date('2026-01-01T05:00:00.000Z'),
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);
        jest.spyOn(prisma.disputeCase, 'update').mockResolvedValue({
            id: 503,
            dealId: 306,
            openedByUserId: 41,
            reason: 'Condition issue',
            description: 'Product condition differs from listing.',
            status: 'RESOLVED',
            resolvedByAdmin: 1,
            resolution: 'Refund approved by moderation.',
            createdAt: new Date('2026-01-01T03:00:00.000Z'),
            resolvedAt: new Date('2026-01-01T05:00:00.000Z'),
        } as never);

        const response = await request(app)
            .patch('/api/v1/deals/306/dispute/resolve')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                action: 'refund_escrow',
                resolution: 'Refund approved by moderation.',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.deal.status).toBe('CANCELLED');
        expect(response.body.data.dispute.status).toBe('RESOLVED');
    });

    it('POST /api/v1/payments/escrow/webhook handles dispute.opened event', async () => {
        process.env.ESCROW_WEBHOOK_SECRET = 'test-webhook-secret';
        jest.spyOn(prisma.escrowWebhookEvent, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.escrowWebhookEvent, 'create').mockResolvedValue({
            id: 1,
            eventId: 'evt_307_dispute_open',
            eventType: 'dispute.opened',
            dealId: 307,
            providerRef: null,
            status: 'RECEIVED',
            processedAt: null,
            createdAt: new Date('2026-01-01T06:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.escrowWebhookEvent, 'update').mockResolvedValue({
            id: 1,
            eventId: 'evt_307_dispute_open',
            eventType: 'dispute.opened',
            dealId: 307,
            providerRef: 'provider_ref_307',
            status: 'PROCESSED',
            processedAt: new Date('2026-01-01T06:01:00.000Z'),
            createdAt: new Date('2026-01-01T06:00:00.000Z'),
        } as never);

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 307,
            listingId: 207,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 920,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 920,
            escrowCurrency: 'USD',
            escrowProviderRef: 'provider_ref_307',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
            dispute: null,
        } as never);
        jest.spyOn(prisma.disputeCase, 'create').mockResolvedValue({
            id: 504,
            dealId: 307,
            openedByUserId: 41,
            reason: 'Provider dispute',
            description: 'Provider opened dispute automatically.',
            status: 'OPEN',
            resolvedByAdmin: null,
            resolution: null,
            createdAt: new Date('2026-01-01T06:00:00.000Z'),
            resolvedAt: null,
        } as never);
        jest.spyOn(prisma.deal, 'update').mockResolvedValue({
            id: 307,
            listingId: 207,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 920,
            quantity: 1,
            currency: 'USD',
            status: 'DISPUTED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 920,
            escrowCurrency: 'USD',
            escrowProviderRef: 'provider_ref_307',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
        } as never);

        const response = await request(app)
            .post('/api/v1/payments/escrow/webhook')
            .set('x-escrow-webhook-secret', 'test-webhook-secret')
            .send({
                eventId: 'evt_307_dispute_open',
                eventType: 'dispute.opened',
                dealId: 307,
                reason: 'Provider dispute',
                description: 'Provider opened dispute automatically.',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.eventType).toBe('dispute.opened');
        expect(response.body.data.dispute.status).toBe('OPEN');
        expect(response.body.data.deal.status).toBe('DISPUTED');
        expect(response.body.data.deduplicated).toBe(false);
    });

    it('POST /api/v1/payments/escrow/webhook ignores duplicate event ids', async () => {
        process.env.ESCROW_WEBHOOK_SECRET = 'test-webhook-secret';

        jest.spyOn(prisma.escrowWebhookEvent, 'findUnique').mockResolvedValue({
            id: 2,
            eventId: 'evt_dup_308_held',
            eventType: 'escrow.held',
            dealId: 308,
            providerRef: 'provider_ref_308',
            status: 'PROCESSED',
            processedAt: new Date('2026-01-01T06:10:00.000Z'),
            createdAt: new Date('2026-01-01T06:09:00.000Z'),
        } as never);
        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 308,
            listingId: 208,
            buyerId: 41,
            sellerId: 99,
            finalPrice: 1000,
            quantity: 1,
            currency: 'USD',
            status: 'CONFIRMED',
            buyerConfirmed: true,
            sellerConfirmed: false,
            escrowStatus: 'HELD',
            escrowAmount: 1000,
            escrowCurrency: 'USD',
            escrowProviderRef: 'provider_ref_308',
            escrowHeldAt: new Date('2026-01-01T01:00:00.000Z'),
            escrowReleasedAt: null,
            escrowRefundedAt: null,
            meetingPlace: null,
            meetingLat: null,
            meetingLng: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            completedAt: null,
            dispute: null,
        } as never);

        const createEventSpy = jest.spyOn(prisma.escrowWebhookEvent, 'create');
        const updateEventSpy = jest.spyOn(prisma.escrowWebhookEvent, 'update');

        const response = await request(app)
            .post('/api/v1/payments/escrow/webhook')
            .set('x-escrow-webhook-secret', 'test-webhook-secret')
            .send({
                eventId: 'evt_dup_308_held',
                eventType: 'escrow.held',
                dealId: 308,
                amount: 1000,
                currency: 'USD',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.applied).toBe(false);
        expect(response.body.data.deduplicated).toBe(true);
        expect(response.body.data.message).toContain('Duplicate webhook event ignored');
        expect(createEventSpy).not.toHaveBeenCalled();
        expect(updateEventSpy).not.toHaveBeenCalled();
    });

    it('POST /api/v1/deals/:id/reviews creates review only for completed deal', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.deal, 'findUnique').mockResolvedValue({
            id: 300,
            buyerId: 41,
            sellerId: 99,
            status: 'COMPLETED',
        } as never);
        jest.spyOn(prisma.review, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.review, 'create').mockResolvedValue({
            id: 801,
            dealId: 300,
            reviewerId: 41,
            revieweeId: 99,
            rating: 5,
            comment: 'Great seller',
            createdAt: new Date('2026-01-01T05:00:00.000Z'),
        } as never);

        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 99,
            emailVerifiedAt: new Date(),
            phoneVerifiedAt: null,
            googleId: null,
            facebookId: null,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            avgResponseHours: 10,
        } as never);
        jest.spyOn(prisma.review, 'aggregate').mockResolvedValue({
            _avg: { rating: 5 },
            _count: { rating: 1 },
            _sum: { rating: 5 },
            _min: { rating: 5 },
            _max: { rating: 5 },
        } as never);
        jest.spyOn(prisma.deal, 'count').mockResolvedValue(5);
        jest.spyOn(prisma.disputeCase, 'count').mockResolvedValue(0);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 99 } as never);

        const response = await request(app)
            .post('/api/v1/deals/300/reviews')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                rating: 5,
                comment: 'Great seller',
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(801);
    });
});
