import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';

describe('Business profile routes', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-access-secret';
        process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('GET /api/v1/business-profile/me returns null when profile does not exist', async () => {
        const accessToken = signAccessToken({ userId: 71, role: 'USER', trustTier: 'VERIFIED' });
        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue(null);

        const response = await request(app)
            .get('/api/v1/business-profile/me')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeNull();
    });

    it('PUT /api/v1/business-profile/me creates profile when missing', async () => {
        const accessToken = signAccessToken({ userId: 72, role: 'USER', trustTier: 'VERIFIED' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.businessProfile, 'create').mockResolvedValue({
            companyName: 'Souqly Motors',
            commercialRegister: 'CR-123',
            taxNumber: 'TN-999',
            website: 'https://souqly.example.com',
            verifiedByAdmin: false,
            verifiedAt: null,
            createdAt: new Date('2026-03-12T10:00:00.000Z'),
            updatedAt: new Date('2026-03-12T10:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 72 } as never);

        const response = await request(app)
            .put('/api/v1/business-profile/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                companyName: 'Souqly Motors',
                commercialRegister: 'CR-123',
                taxNumber: 'TN-999',
                website: 'https://souqly.example.com',
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.created).toBe(true);
        expect(response.body.data.verificationReset).toBe(false);
        expect(response.body.data.profile.companyName).toBe('Souqly Motors');
    });

    it('PUT /api/v1/business-profile/me updates profile and resets verification when core data changes', async () => {
        const accessToken = signAccessToken({ userId: 73, role: 'USER', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({
            id: 10,
            companyName: 'Old Company',
            commercialRegister: 'CR-OLD',
            taxNumber: 'TN-OLD',
            website: 'https://old.example.com',
            verifiedByAdmin: true,
            verifiedAt: new Date('2026-02-01T08:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.businessProfile, 'update').mockResolvedValue({
            companyName: 'New Company',
            commercialRegister: 'CR-NEW',
            taxNumber: 'TN-NEW',
            website: 'https://new.example.com',
            verifiedByAdmin: false,
            verifiedAt: null,
            createdAt: new Date('2026-01-01T08:00:00.000Z'),
            updatedAt: new Date('2026-03-12T10:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 73 } as never);

        const response = await request(app)
            .put('/api/v1/business-profile/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                companyName: 'New Company',
                commercialRegister: 'CR-NEW',
                taxNumber: 'TN-NEW',
                website: 'https://new.example.com',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.created).toBe(false);
        expect(response.body.data.verificationReset).toBe(true);
        expect(response.body.data.profile.verifiedByAdmin).toBe(false);
    });

    it('PUT /api/v1/business-profile/me requires authentication', async () => {
        const response = await request(app).put('/api/v1/business-profile/me').send({
            companyName: 'No Auth Company',
        });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
});
