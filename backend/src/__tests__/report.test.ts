import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';

describe('Report routes', () => {
    it('POST /api/v1/reports creates report on listing', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 200,
            userId: 99,
        } as never);
        jest.spyOn(prisma.report, 'findFirst').mockResolvedValue(null);
        jest.spyOn(prisma.report, 'create').mockResolvedValue({
            id: 11,
            reporterId: 41,
            listingId: 200,
            reportableType: 'LISTING',
            reportableId: 200,
            reason: 'FRAUD',
            description: 'Fake ad',
            status: 'PENDING',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            listing: {
                id: 200,
                titleAr: 'عنوان',
                titleEn: 'Title',
                status: 'ACTIVE',
            },
        } as never);

        const response = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                reportableType: 'LISTING',
                reportableId: 200,
                reason: 'FRAUD',
                description: 'Fake ad',
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(11);
        expect(response.body.data.status).toBe('PENDING');
    });

    it('POST /api/v1/reports blocks duplicate pending report', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 200,
            userId: 99,
        } as never);
        jest.spyOn(prisma.report, 'findFirst').mockResolvedValue({ id: 1 } as never);

        const response = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                reportableType: 'LISTING',
                reportableId: 200,
                reason: 'FRAUD',
            });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('REPORT_ALREADY_EXISTS');
    });

    it('POST /api/v1/reports rejects reporting own listing', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 200,
            userId: 41,
        } as never);

        const response = await request(app)
            .post('/api/v1/reports')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                reportableType: 'LISTING',
                reportableId: 200,
                reason: 'SPAM',
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('CANNOT_REPORT_OWN_LISTING');
    });

    it('GET /api/v1/reports/my lists current user reports', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.report, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.report, 'findMany').mockResolvedValue([
            {
                id: 11,
                reporterId: 41,
                listingId: 200,
                reportableType: 'LISTING',
                reportableId: 200,
                reason: 'FRAUD',
                description: 'Fake ad',
                status: 'PENDING',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                listing: {
                    id: 200,
                    titleAr: 'عنوان',
                    titleEn: 'Title',
                    status: 'ACTIVE',
                },
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/reports/my?lang=en')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta.total).toBe(1);
        expect(response.body.data[0].listing.title).toBe('Title');
    });

    it('GET /api/v1/reports/my requires authentication', async () => {
        const response = await request(app).get('/api/v1/reports/my');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
});
