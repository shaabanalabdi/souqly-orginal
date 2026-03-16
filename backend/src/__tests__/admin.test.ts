import request from 'supertest';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';
import * as digestJob from '../shared/jobs/savedSearchDigest.job.js';

describe('Admin routes', () => {
    it('GET /api/v1/admin/dashboard returns aggregate stats', async () => {
        const adminToken = signAccessToken({ userId: 1, role: 'ADMIN', trustTier: 'TOP_SELLER' });

        jest.spyOn(prisma.user, 'count')
            .mockResolvedValueOnce(10)
            .mockResolvedValueOnce(8)
            .mockResolvedValueOnce(2);
        jest.spyOn(prisma.listing, 'count')
            .mockResolvedValueOnce(20)
            .mockResolvedValueOnce(12)
            .mockResolvedValueOnce(4)
            .mockResolvedValueOnce(3);
        jest.spyOn(prisma.report, 'count')
            .mockResolvedValueOnce(7)
            .mockResolvedValueOnce(2);
        jest.spyOn(prisma.deal, 'count')
            .mockResolvedValueOnce(9)
            .mockResolvedValueOnce(5);

        const response = await request(app)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.users.total).toBe(10);
        expect(response.body.data.listings.total).toBe(20);
        expect(response.body.data.reports.pending).toBe(2);
    });

    it('GET /api/v1/admin/reports lists reports for moderators', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.report, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.report, 'findMany').mockResolvedValue([
            {
                id: 15,
                reporterId: 41,
                listingId: 200,
                reportableType: 'LISTING',
                reportableId: 200,
                reason: 'FRAUD',
                description: 'Suspicious',
                status: 'PENDING',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                reporter: {
                    email: 'reporter@souqly.com',
                    profile: {
                        fullName: 'Reporter',
                    },
                },
                listing: {
                    id: 200,
                    titleAr: 'عنوان',
                    titleEn: 'Title',
                    status: 'ACTIVE',
                },
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/admin/reports?lang=en')
            .set('Authorization', `Bearer ${modToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].listing.title).toBe('Title');
    });

    it('GET /api/v1/admin/audit-logs lists audit actions for moderators', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.auditLog, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([
            {
                id: 80,
                adminId: 2,
                action: 'REPORT_RESOLVE',
                entityType: 'report',
                entityId: 15,
                oldData: { status: 'PENDING' },
                newData: { status: 'RESOLVED' },
                ipAddress: null,
                createdAt: new Date('2026-01-01T04:00:00.000Z'),
            },
        ] as never);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([
            {
                id: 2,
                email: 'mod@souqly.com',
                profile: {
                    fullName: 'Moderator',
                },
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/admin/audit-logs?page=1&limit=20')
            .set('Authorization', `Bearer ${modToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].action).toBe('REPORT_RESOLVE');
        expect(response.body.data[0].adminEmail).toBe('mod@souqly.com');
    });

    it('GET /api/v1/admin/saved-search-digest/status returns digest runtime status', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(digestJob, 'getSavedSearchDigestStatus').mockResolvedValue({
            enabled: true,
            checkIntervalMs: 3600000,
            daily: {
                lastRunAt: '2026-01-01T00:00:00.000Z',
                nextDueAt: '2026-01-02T00:00:00.000Z',
                isLocked: false,
                minIntervalMs: 86400000,
            },
            weekly: {
                lastRunAt: null,
                nextDueAt: '2026-01-01T00:00:00.000Z',
                isLocked: false,
                minIntervalMs: 604800000,
            },
        });

        const response = await request(app)
            .get('/api/v1/admin/saved-search-digest/status')
            .set('Authorization', `Bearer ${modToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.enabled).toBe(true);
        expect(response.body.data.daily.minIntervalMs).toBe(86400000);
    });

    it('GET /api/v1/admin/saved-search-digest/history lists digest run history', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(digestJob, 'getSavedSearchDigestHistory').mockResolvedValue({
            items: [
                {
                    id: 'manual:daily:1',
                    source: 'manual',
                    frequency: 'daily',
                    processedSearches: 3,
                    matchedSearches: 2,
                    matchedListings: 5,
                    notifiedUsers: 2,
                    emailedUsers: 2,
                    startedAt: '2026-01-01T10:00:00.000Z',
                    completedAt: '2026-01-01T10:00:03.000Z',
                    durationMs: 3000,
                    recordedAt: '2026-01-01T10:00:03.000Z',
                },
            ],
            meta: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
                hasNext: false,
                hasPrev: false,
            },
        });

        const response = await request(app)
            .get('/api/v1/admin/saved-search-digest/history?page=1&limit=20&frequency=daily&source=manual&sort=completed_desc&from=2026-01-01T00:00:00.000Z&to=2026-01-02T00:00:00.000Z')
            .set('Authorization', `Bearer ${modToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta.total).toBe(1);
        expect(response.body.data[0].source).toBe('manual');
    });

    it('POST /api/v1/admin/saved-search-digest/run triggers manual digest run', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(digestJob, 'runSavedSearchDigestNow').mockResolvedValue({
            triggeredAt: '2026-01-01T10:00:00.000Z',
            frequency: 'daily',
            runs: [
                {
                    frequency: 'daily',
                    processedSearches: 2,
                    matchedSearches: 1,
                    matchedListings: 3,
                    notifiedUsers: 1,
                    emailedUsers: 1,
                    startedAt: '2026-01-01T10:00:00.000Z',
                    completedAt: '2026-01-01T10:00:05.000Z',
                },
            ],
            skipped: [],
        });
        jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as never);

        const response = await request(app)
            .post('/api/v1/admin/saved-search-digest/run')
            .set('Authorization', `Bearer ${modToken}`)
            .send({
                frequency: 'daily',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.frequency).toBe('daily');
        expect(response.body.data.runs).toHaveLength(1);
    });

    it('GET /api/v1/admin/fraud-flags returns flagged listings', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.auditLog, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([
            {
                id: 501,
                adminId: 41,
                entityId: 200,
                newData: {
                    riskScore: 75,
                    signals: [{ code: 'DUPLICATE_IMAGE', severity: 'high', message: 'duplicate image' }],
                },
                ipAddress: '127.0.0.1',
                createdAt: new Date('2026-01-01T10:00:00.000Z'),
            },
        ] as never);
        jest.spyOn(prisma.listing, 'findMany').mockResolvedValue([
            {
                id: 200,
                titleAr: 'عنوان',
                titleEn: 'Title',
            },
        ] as never);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([
            {
                id: 41,
                email: 'seller@souqly.com',
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/admin/fraud-flags?page=1&limit=20&listingId=200&lang=en')
            .set('Authorization', `Bearer ${modToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].listingId).toBe(200);
        expect(response.body.data[0].riskScore).toBe(75);
    });

    it('POST /api/v1/admin/listings/:id/feature sets featuredUntil', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 200,
            featuredUntil: null,
        } as never);
        jest.spyOn(prisma.listing, 'update').mockResolvedValue({
            id: 200,
            featuredUntil: new Date('2099-01-08T10:00:00.000Z'),
            updatedAt: new Date('2026-01-01T10:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as never);

        const response = await request(app)
            .post('/api/v1/admin/listings/200/feature')
            .set('Authorization', `Bearer ${modToken}`)
            .send({
                days: 7,
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(200);
        expect(response.body.data.isFeatured).toBe(true);
    });

    it('GET /api/v1/admin/identity-verifications lists verification requests', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.identityVerificationRequest, 'count').mockResolvedValue(1);
        jest.spyOn(prisma.identityVerificationRequest, 'findMany').mockResolvedValue([
            {
                id: 901,
                userId: 41,
                status: 'PENDING',
                documentType: 'NATIONAL_ID',
                documentNumberMasked: '****1234',
                note: 'Please verify.',
                submittedAt: new Date('2026-03-12T12:00:00.000Z'),
                reviewedAt: null,
                reviewerId: null,
                reviewerNote: null,
                createdAt: new Date('2026-03-12T12:00:00.000Z'),
                updatedAt: new Date('2026-03-12T12:00:00.000Z'),
                user: {
                    email: 'user@souqly.com',
                    identityVerificationStatus: 'PENDING',
                    identityVerifiedAt: null,
                    profile: {
                        fullName: 'Test User',
                    },
                },
                reviewer: null,
            },
        ] as never);

        const response = await request(app)
            .get('/api/v1/admin/identity-verifications?status=PENDING')
            .set('Authorization', `Bearer ${modToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe('PENDING');
    });

    it('PATCH /api/v1/admin/identity-verifications/:id resolves verification request for admin', async () => {
        const adminToken = signAccessToken({ userId: 1, role: 'ADMIN', trustTier: 'TOP_SELLER' });

        jest.spyOn(prisma.identityVerificationRequest, 'findUnique').mockResolvedValue({
            id: 901,
            userId: 41,
            status: 'PENDING',
        } as never);

        const requestUpdateMock = jest.fn().mockResolvedValue({
            id: 901,
            userId: 41,
            status: 'VERIFIED',
            documentType: 'NATIONAL_ID',
            documentNumberMasked: '****1234',
            note: 'Please verify.',
            submittedAt: new Date('2026-03-12T12:00:00.000Z'),
            reviewedAt: new Date('2026-03-12T12:20:00.000Z'),
            reviewerId: 1,
            reviewerNote: 'Approved',
            createdAt: new Date('2026-03-12T12:00:00.000Z'),
            updatedAt: new Date('2026-03-12T12:20:00.000Z'),
            user: {
                email: 'user@souqly.com',
                identityVerificationStatus: 'PENDING',
                identityVerifiedAt: null,
                profile: {
                    fullName: 'Test User',
                },
            },
            reviewer: {
                email: 'admin@souqly.com',
                profile: {
                    fullName: 'Main Admin',
                },
            },
        });
        const userUpdateMock = jest.fn().mockResolvedValue({ id: 41 });

        jest.spyOn(prisma, '$transaction').mockImplementation((async (callback: (tx: unknown) => unknown) =>
            callback({
                identityVerificationRequest: {
                    update: requestUpdateMock,
                },
                user: {
                    update: userUpdateMock,
                },
            })) as never);
        jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as never);

        const response = await request(app)
            .patch('/api/v1/admin/identity-verifications/901')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                action: 'approve',
                reviewerNote: 'Approved',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('VERIFIED');
        expect(requestUpdateMock).toHaveBeenCalledTimes(1);
        expect(userUpdateMock).toHaveBeenCalledTimes(1);
    });

    it('PATCH /api/v1/admin/reports/:id resolves report and deletes listing', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.report, 'findUnique').mockResolvedValue({
            id: 15,
            reporterId: 41,
            listingId: 200,
            reportableType: 'LISTING',
            reportableId: 200,
            reason: 'FRAUD',
            description: 'Suspicious',
            status: 'PENDING',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            reporter: {
                email: 'reporter@souqly.com',
                profile: {
                    fullName: 'Reporter',
                },
            },
            listing: {
                id: 200,
                titleAr: 'عنوان',
                titleEn: 'Title',
                status: 'ACTIVE',
                userId: 99,
            },
        } as never);
        jest.spyOn(prisma.listing, 'updateMany').mockResolvedValue({ count: 1 } as never);
        jest.spyOn(prisma.report, 'update').mockResolvedValue({
            id: 15,
            reporterId: 41,
            listingId: 200,
            reportableType: 'LISTING',
            reportableId: 200,
            reason: 'FRAUD',
            description: 'Suspicious',
            status: 'RESOLVED',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            reporter: {
                email: 'reporter@souqly.com',
                profile: {
                    fullName: 'Reporter',
                },
            },
            listing: {
                id: 200,
                titleAr: 'عنوان',
                titleEn: 'Title',
                status: 'DELETED',
            },
        } as never);
        jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as never);

        const response = await request(app)
            .patch('/api/v1/admin/reports/15')
            .set('Authorization', `Bearer ${modToken}`)
            .send({
                action: 'delete_listing',
                resolution: 'Removed by moderation',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('RESOLVED');
    });

    it('PATCH /api/v1/admin/listings/:id moderates listing status', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 200,
            status: 'PENDING',
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.listing, 'update').mockResolvedValue({
            id: 200,
            status: 'ACTIVE',
            updatedAt: new Date('2026-01-01T01:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as never);

        const response = await request(app)
            .patch('/api/v1/admin/listings/200')
            .set('Authorization', `Bearer ${modToken}`)
            .send({
                action: 'approve',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('ACTIVE');
    });

    it('GET /api/v1/admin/users is admin-only', async () => {
        const modToken = signAccessToken({ userId: 2, role: 'MODERATOR', trustTier: 'TRUSTED' });

        const response = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${modToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('PATCH /api/v1/admin/users/:id updates user role for admin', async () => {
        const adminToken = signAccessToken({ userId: 1, role: 'ADMIN', trustTier: 'TOP_SELLER' });

        jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
            id: 41,
            email: 'user@souqly.com',
            role: 'USER',
            accountType: 'INDIVIDUAL',
            staffRole: 'NONE',
            isActive: true,
            bannedAt: null,
            bannedReason: null,
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.user, 'update').mockResolvedValue({
            id: 41,
            email: 'user@souqly.com',
            role: 'MODERATOR',
            accountType: 'INDIVIDUAL',
            staffRole: 'MODERATOR',
            isActive: true,
            bannedAt: null,
            bannedReason: null,
            updatedAt: new Date('2026-01-01T01:00:00.000Z'),
        } as never);
        jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as never);

        const response = await request(app)
            .patch('/api/v1/admin/users/41')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                action: 'set_role',
                role: 'MODERATOR',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.role).toBe('MODERATOR');
    });
});
