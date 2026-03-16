import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';

describe('Craftsman profile routes', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-access-secret';
        process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('GET /api/v1/craftsman-profile/me returns null when profile does not exist', async () => {
        const accessToken = signAccessToken({ userId: 81, role: 'USER', trustTier: 'VERIFIED' });
        jest.spyOn(prisma.craftsmanProfile, 'findUnique').mockResolvedValue(null);

        const response = await request(app)
            .get('/api/v1/craftsman-profile/me')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeNull();
    });

    it('PUT /api/v1/craftsman-profile/me creates profile when missing', async () => {
        const accessToken = signAccessToken({ userId: 82, role: 'USER', trustTier: 'VERIFIED' });

        jest.spyOn(prisma.craftsmanProfile, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.craftsmanProfile, 'create').mockResolvedValue({
            profession: 'Electrician',
            experienceYears: 7,
            workingHours: '09:00-17:00',
            workingAreas: ['Damascus'],
            portfolio: ['https://portfolio.example/item-1'],
            availableNow: true,
            verifiedByAdmin: false,
            verifiedAt: null,
            createdAt: new Date('2026-03-12T10:00:00.000Z'),
            updatedAt: new Date('2026-03-12T10:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 82 } as never);

        const response = await request(app)
            .put('/api/v1/craftsman-profile/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                profession: 'Electrician',
                experienceYears: 7,
                workingHours: '09:00-17:00',
                workingAreas: ['Damascus'],
                portfolio: ['https://portfolio.example/item-1'],
                availableNow: true,
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.created).toBe(true);
        expect(response.body.data.verificationReset).toBe(false);
        expect(response.body.data.profile.profession).toBe('Electrician');
        expect(response.body.data.profile.workingAreas).toEqual(['Damascus']);
    });

    it('PUT /api/v1/craftsman-profile/me updates profile and resets verification when core data changes', async () => {
        const accessToken = signAccessToken({ userId: 83, role: 'USER', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.craftsmanProfile, 'findUnique').mockResolvedValue({
            id: 12,
            profession: 'Old Profession',
            experienceYears: 4,
            workingHours: '10:00-18:00',
            workingAreas: ['Aleppo'],
            portfolio: ['https://portfolio.example/old'],
            availableNow: false,
            verifiedByAdmin: true,
            verifiedAt: new Date('2026-02-01T08:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.craftsmanProfile, 'update').mockResolvedValue({
            profession: 'Plumber',
            experienceYears: 8,
            workingHours: '08:00-16:00',
            workingAreas: ['Damascus', 'Rural Damascus'],
            portfolio: ['https://portfolio.example/new'],
            availableNow: true,
            verifiedByAdmin: false,
            verifiedAt: null,
            createdAt: new Date('2026-01-01T08:00:00.000Z'),
            updatedAt: new Date('2026-03-12T10:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 83 } as never);

        const response = await request(app)
            .put('/api/v1/craftsman-profile/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                profession: 'Plumber',
                experienceYears: 8,
                workingHours: '08:00-16:00',
                workingAreas: ['Damascus', 'Rural Damascus'],
                portfolio: ['https://portfolio.example/new'],
                availableNow: true,
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.created).toBe(false);
        expect(response.body.data.verificationReset).toBe(true);
        expect(response.body.data.profile.verifiedByAdmin).toBe(false);
    });

    it('PUT /api/v1/craftsman-profile/me requires authentication', async () => {
        const response = await request(app).put('/api/v1/craftsman-profile/me').send({
            profession: 'No Auth Craftsman',
        });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
});
