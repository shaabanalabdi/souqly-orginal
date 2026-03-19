import { prisma } from '../shared/utils/prisma.js';

beforeAll(() => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    process.env.DATABASE_URL = 'mysql://souqly:souqly@127.0.0.1:3306/souqly_test';
    process.env.ENABLE_INTERNAL_ESCROW = 'true';
    process.env.S3_CDN_URL = 'https://cdn.souqly.com';
    process.env.S3_ENDPOINT = 'https://object-storage.example.com';
    process.env.S3_BUCKET = 'souqly-media';
});

beforeEach(() => {
    jest.spyOn(prisma, '$transaction').mockImplementation(async (input: unknown) => {
        if (typeof input === 'function') {
            return input(prisma as never);
        }

        return Promise.all(input as Promise<unknown>[]);
    });

    jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(prisma.listingStatusHistory, 'create').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(prisma.userRoleHistory, 'create').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        accountType: 'INDIVIDUAL',
        staffRole: 'NONE',
    } as never);
    jest.spyOn(prisma.notificationPreference, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.notification, 'create').mockResolvedValue({
        id: 1,
        type: 'SYSTEM',
        title: 'Test notification',
        body: 'Test notification',
        targetType: null,
        targetId: null,
        link: null,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
    } as never);
    jest.spyOn(prisma.review, 'aggregate').mockResolvedValue({
        _avg: {
            rating: null,
        },
    } as never);
    jest.spyOn(prisma.deal, 'update').mockResolvedValue({ id: 1, status: 'RATED' } as never);
    jest.spyOn(prisma.contactAccessRequest, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.contactAccessRequest, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prisma.contactAccessRequest, 'upsert').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(prisma.contactAccessRequest, 'update').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(prisma.escrowLedgerEntry, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.escrowLedgerEntry, 'create').mockResolvedValue({ id: 1 } as never);
    jest.spyOn(prisma.systemConfigVersion, 'findFirst').mockResolvedValue(null);
    jest.spyOn(prisma.systemConfigVersion, 'create').mockResolvedValue({
        id: 1,
        version: 1,
        configJson: {},
        changeNote: null,
        changedById: 1,
        createdAt: new Date(),
    } as never);
});

afterEach(() => {
    jest.restoreAllMocks();
});
