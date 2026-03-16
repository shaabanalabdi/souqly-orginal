import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';

describe('Chat routes', () => {
    it('POST /api/v1/chats/threads creates a new thread', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.listing, 'findFirst').mockResolvedValue({
            id: 200,
            userId: 99,
            titleAr: 'عنوان الإعلان',
            titleEn: 'Listing title',
            priceAmount: 1200,
            currency: 'USD',
            images: [{ urlThumb: 'https://img.example/thumb.jpg' }],
        } as never);
        jest.spyOn(prisma.chatThread, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.chatThread, 'create').mockResolvedValue({
            id: 7,
            listingId: 200,
            buyerId: 41,
            sellerId: 99,
            lastMessageAt: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            messages: [],
            _count: {
                messages: 0,
            },
        } as never);

        const response = await request(app)
            .post('/api/v1/chats/threads')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ listingId: 200 });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.created).toBe(true);
        expect(response.body.data.thread.id).toBe(7);
    });

    it('GET /api/v1/chats/threads returns user threads', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.chatThread, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.chatThread, 'findMany').mockResolvedValue([
            {
                id: 7,
                listingId: 200,
                buyerId: 41,
                sellerId: 99,
                lastMessageAt: new Date('2026-01-01T01:00:00.000Z'),
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                listing: {
                    id: 200,
                    titleAr: 'عنوان الإعلان',
                    titleEn: 'Listing title',
                    priceAmount: 1200,
                    currency: 'USD',
                    images: [{ urlThumb: 'https://img.example/thumb.jpg' }],
                },
                messages: [
                    {
                        senderId: 41,
                        type: 'TEXT',
                        content: 'Hello',
                        createdAt: new Date('2026-01-01T01:00:00.000Z'),
                    },
                ],
                _count: {
                    messages: 0,
                },
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/chats/threads?lang=en')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta.total).toBe(1);
    });

    it('GET /api/v1/chats/unread-count returns unread total', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.chatMessage, 'count').mockResolvedValue(3);

        const response = await request(app)
            .get('/api/v1/chats/unread-count')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.unreadCount).toBe(3);
    });

    it('POST /api/v1/chats/threads/:threadId/messages sends a text message', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.chatThread, 'findUnique').mockResolvedValue({
            id: 7,
            listingId: 200,
            buyerId: 41,
            sellerId: 99,
        } as never);
        jest.spyOn(prisma.chatMessage, 'create').mockResolvedValue({
            id: 11,
            threadId: 7,
            senderId: 41,
            type: 'TEXT',
            content: 'مرحبا',
            imageUrl: null,
            isRead: false,
            readAt: null,
            createdAt: new Date('2026-01-01T02:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.chatThread, 'update').mockResolvedValue({ id: 7 } as never);

        const response = await request(app)
            .post('/api/v1/chats/threads/7/messages')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                type: 'TEXT',
                content: 'مرحبا',
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe('TEXT');
    });

    it('POST /api/v1/chats/threads/:threadId/phone-request allows buyer only', async () => {
        const accessToken = signAccessToken({ userId: 99, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.chatThread, 'findUnique').mockResolvedValue({
            id: 7,
            listingId: 200,
            buyerId: 41,
            sellerId: 99,
        } as never);

        const response = await request(app)
            .post('/api/v1/chats/threads/7/phone-request')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                message: 'Can I get your phone?',
            });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('ONLY_BUYER_CAN_REQUEST_PHONE');
    });

    it('POST /api/v1/chats/threads/:threadId/offers creates offer and message', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.chatThread, 'findUnique').mockResolvedValue({
            id: 7,
            listingId: 200,
            buyerId: 41,
            sellerId: 99,
        } as never);
        jest.spyOn(prisma.offer, 'create').mockResolvedValue({
            id: 51,
            threadId: 7,
            listingId: 200,
            senderId: 41,
            amount: 1000,
            quantity: 1,
            message: 'My offer',
            status: 'PENDING',
            counterAmount: null,
            createdAt: new Date('2026-01-01T03:00:00.000Z'),
            respondedAt: null,
        } as never);
        jest.spyOn(prisma.chatMessage, 'create').mockResolvedValue({ id: 1 } as never);
        jest.spyOn(prisma.chatThread, 'update').mockResolvedValue({ id: 7 } as never);

        const response = await request(app)
            .post('/api/v1/chats/threads/7/offers')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                amount: 1000,
                quantity: 1,
                message: 'My offer',
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(51);
        expect(response.body.data.status).toBe('PENDING');
    });

    it('PATCH /api/v1/chats/offers/:offerId/respond accepts offer for other participant', async () => {
        const accessToken = signAccessToken({ userId: 99, role: 'USER', trustTier: 'NEW' });
        jest.spyOn(prisma.offer, 'findUnique').mockResolvedValue({
            id: 51,
            threadId: 7,
            listingId: 200,
            senderId: 41,
            amount: 1000,
            quantity: 1,
            message: 'My offer',
            status: 'PENDING',
            counterAmount: null,
            createdAt: new Date('2026-01-01T03:00:00.000Z'),
            respondedAt: null,
            thread: {
                buyerId: 41,
                sellerId: 99,
            },
        } as never);
        jest.spyOn(prisma.offer, 'update').mockResolvedValue({
            id: 51,
            threadId: 7,
            listingId: 200,
            senderId: 41,
            amount: 1000,
            quantity: 1,
            message: 'My offer',
            status: 'ACCEPTED',
            counterAmount: null,
            createdAt: new Date('2026-01-01T03:00:00.000Z'),
            respondedAt: new Date('2026-01-01T04:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.chatMessage, 'create').mockResolvedValue({ id: 1 } as never);
        jest.spyOn(prisma.chatThread, 'update').mockResolvedValue({ id: 7 } as never);

        const response = await request(app)
            .patch('/api/v1/chats/offers/51/respond')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                action: 'accept',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('ACCEPTED');
    });

    it('GET /api/v1/chats/threads requires authentication', async () => {
        const response = await request(app).get('/api/v1/chats/threads');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
});
