import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';

describe('Verification routes', () => {
    it('GET /api/v1/verification/identity/me returns user verification status', async () => {
        const accessToken = signAccessToken({ userId: 71, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 71,
            isActive: true,
            bannedAt: null,
            identityVerificationStatus: 'PENDING',
            identityVerifiedAt: null,
        } as never);
        jest.spyOn(prisma.identityVerificationRequest, 'findFirst').mockResolvedValue({
            id: 501,
            userId: 71,
            status: 'PENDING',
            documentType: 'NATIONAL_ID',
            documentNumberMasked: '****1234',
            documentFrontUrl: 'https://cdn.souqly.com/verification/id-front.jpg',
            documentBackUrl: null,
            selfieUrl: null,
            note: 'Please review quickly.',
            submittedAt: new Date('2026-03-12T10:00:00.000Z'),
            reviewedAt: null,
            reviewerId: null,
            reviewerNote: null,
            createdAt: new Date('2026-03-12T10:00:00.000Z'),
            updatedAt: new Date('2026-03-12T10:00:00.000Z'),
        } as never);

        const response = await request(app)
            .get('/api/v1/verification/identity/me')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('PENDING');
        expect(response.body.data.currentRequest.id).toBe(501);
        expect(response.body.data.canSubmit).toBe(false);
    });

    it('POST /api/v1/verification/identity/request creates a pending verification request', async () => {
        const accessToken = signAccessToken({ userId: 72, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 72,
            isActive: true,
            bannedAt: null,
            identityVerificationStatus: 'NONE',
        } as never);
        jest.spyOn(prisma.identityVerificationRequest, 'create').mockResolvedValue({
            id: 777,
            userId: 72,
            status: 'PENDING',
            documentType: 'PASSPORT',
            documentNumberMasked: '***7788',
            documentFrontUrl: 'https://cdn.souqly.com/verification/passport-front.jpg',
            documentBackUrl: null,
            selfieUrl: 'https://cdn.souqly.com/verification/selfie.jpg',
            note: 'My passport document.',
            submittedAt: new Date('2026-03-12T10:10:00.000Z'),
            reviewedAt: null,
            reviewerId: null,
            reviewerNote: null,
            createdAt: new Date('2026-03-12T10:10:00.000Z'),
            updatedAt: new Date('2026-03-12T10:10:00.000Z'),
        } as never);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 72 } as never);

        const response = await request(app)
            .post('/api/v1/verification/identity/request')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                documentType: 'PASSPORT',
                documentNumberMasked: '***7788',
                documentFrontUrl: 'https://cdn.souqly.com/verification/passport-front.jpg',
                selfieUrl: 'https://cdn.souqly.com/verification/selfie.jpg',
                note: 'My passport document.',
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('PENDING');
        expect(response.body.data.request.id).toBe(777);
    });

    it('POST /api/v1/verification/identity/request rejects when request is already pending', async () => {
        const accessToken = signAccessToken({ userId: 73, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 73,
            isActive: true,
            bannedAt: null,
            identityVerificationStatus: 'PENDING',
        } as never);

        const response = await request(app)
            .post('/api/v1/verification/identity/request')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                documentType: 'NATIONAL_ID',
                documentFrontUrl: 'https://cdn.souqly.com/verification/id-front.jpg',
            });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('IDENTITY_VERIFICATION_PENDING');
    });
});
