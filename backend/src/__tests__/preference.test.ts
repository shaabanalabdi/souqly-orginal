import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';

describe('Preference routes', () => {
    it('POST /api/v1/favorites/:listingId adds favorite', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.listing, 'findFirst').mockResolvedValue({
            id: 200,
            userId: 99,
            titleAr: 'عنوان',
            titleEn: 'Title',
            priceAmount: 1000,
            currency: 'USD',
            status: 'ACTIVE',
            country: { nameAr: 'سوريا', nameEn: 'Syria' },
            city: { nameAr: 'دمشق', nameEn: 'Damascus' },
            images: [{ urlThumb: 'https://img.example/thumb.jpg' }],
        } as never);
        jest.spyOn(prisma.favorite, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.favorite, 'create').mockResolvedValue({
            id: 1,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.listing, 'updateMany').mockResolvedValue({ count: 1 } as never);

        const response = await request(app)
            .post('/api/v1/favorites/200')
            .set('Authorization', `Bearer ${accessToken}`)
            .send();

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.favorited).toBe(true);
        expect(response.body.data.alreadyFavorited).toBe(false);
        expect(response.body.data.favorite.listing.id).toBe(200);
    });

    it('POST /api/v1/favorites/:listingId is idempotent when already favorited', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.listing, 'findFirst').mockResolvedValue({
            id: 200,
            userId: 99,
            titleAr: 'عنوان',
            titleEn: 'Title',
            priceAmount: 1000,
            currency: 'USD',
            status: 'ACTIVE',
            country: { nameAr: 'سوريا', nameEn: 'Syria' },
            city: { nameAr: 'دمشق', nameEn: 'Damascus' },
            images: [{ urlThumb: 'https://img.example/thumb.jpg' }],
        } as never);
        jest.spyOn(prisma.favorite, 'findUnique').mockResolvedValue({
            id: 1,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
        } as never);
        const createSpy = jest.spyOn(prisma.favorite, 'create').mockResolvedValue({
            id: 2,
            createdAt: new Date(),
        } as never);

        const response = await request(app)
            .post('/api/v1/favorites/200')
            .set('Authorization', `Bearer ${accessToken}`)
            .send();

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.alreadyFavorited).toBe(true);
        expect(createSpy).toHaveBeenCalledTimes(0);
    });

    it('GET /api/v1/favorites returns paginated favorites', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.favorite, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.favorite, 'findMany').mockResolvedValue([
            {
                id: 1,
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                listing: {
                    id: 200,
                    titleAr: 'عنوان',
                    titleEn: 'Title',
                    priceAmount: 1000,
                    currency: 'USD',
                    status: 'ACTIVE',
                    country: { nameAr: 'سوريا', nameEn: 'Syria' },
                    city: { nameAr: 'دمشق', nameEn: 'Damascus' },
                    images: [{ urlThumb: 'https://img.example/thumb.jpg' }],
                },
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/favorites?lang=en')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].listing.title).toBe('Title');
        expect(response.body.meta.total).toBe(1);
    });

    it('DELETE /api/v1/favorites/:listingId removes favorite', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.favorite, 'deleteMany').mockResolvedValue({ count: 1 } as never);
        jest.spyOn(prisma.listing, 'updateMany').mockResolvedValue({ count: 1 } as never);

        const response = await request(app)
            .delete('/api/v1/favorites/200')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.removed).toBe(true);
    });

    it('POST /api/v1/saved-searches creates saved search', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.savedSearch, 'create').mockResolvedValue({
            id: 5,
            name: 'Cars in Damascus',
            filters: {
                criteria: { q: 'toyota', cityId: 10 },
                notificationFrequency: 'daily',
            },
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
        } as never);

        const response = await request(app)
            .post('/api/v1/saved-searches')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                name: 'Cars in Damascus',
                filters: { q: 'toyota', cityId: 10 },
                notificationFrequency: 'daily',
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(5);
        expect(response.body.data.notificationFrequency).toBe('daily');
    });

    it('GET /api/v1/saved-searches lists saved searches', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.savedSearch, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.savedSearch, 'findMany').mockResolvedValue([
            {
                id: 5,
                name: 'Cars in Damascus',
                filters: {
                    criteria: { q: 'toyota', cityId: 10 },
                    notificationFrequency: 'daily',
                },
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/saved-searches')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta.total).toBe(1);
    });

    it('PATCH /api/v1/saved-searches/:id updates saved search', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.savedSearch, 'findFirst').mockResolvedValue({
            id: 5,
            name: 'Old Name',
            filters: {
                criteria: { q: 'old' },
                notificationFrequency: 'daily',
            },
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.savedSearch, 'update').mockResolvedValue({
            id: 5,
            name: 'New Name',
            filters: {
                criteria: { q: 'new' },
                notificationFrequency: 'weekly',
            },
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
        } as never);

        const response = await request(app)
            .patch('/api/v1/saved-searches/5')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                name: 'New Name',
                filters: { q: 'new' },
                notificationFrequency: 'weekly',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('New Name');
        expect(response.body.data.notificationFrequency).toBe('weekly');
    });

    it('DELETE /api/v1/saved-searches/:id returns 404 when not found', async () => {
        const accessToken = signAccessToken({ userId: 41, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.savedSearch, 'deleteMany').mockResolvedValue({ count: 0 } as never);

        const response = await request(app)
            .delete('/api/v1/saved-searches/999')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('SAVED_SEARCH_NOT_FOUND');
    });

    it('GET /api/v1/favorites requires authentication', async () => {
        const response = await request(app).get('/api/v1/favorites');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
});
