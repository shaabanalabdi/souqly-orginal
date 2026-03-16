import type { Server as SocketServer } from 'socket.io';
import { dispatchSavedSearchDigest } from '../modules/preferences/savedSearchDigest.service.js';
import { getSavedSearchDigestHistory } from '../shared/jobs/savedSearchDigest.job.js';
import { prisma } from '../shared/utils/prisma.js';
import * as notifications from '../shared/realtime/notifications.js';
import * as emailUtils from '../shared/utils/email.js';
import { redis } from '../shared/utils/redis.js';

describe('Saved search digest dispatcher', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns zero matches when no search criteria is matched', async () => {
        jest.spyOn(prisma.savedSearch, 'findMany').mockResolvedValue([
            {
                id: 1,
                userId: 41,
                name: 'Daily Damascus cars',
                filters: {
                    criteria: {
                        cityId: 10,
                    },
                    notificationFrequency: 'daily',
                },
                user: {
                    email: 'buyer@example.com',
                },
            },
        ] as never);

        jest.spyOn(prisma.listing, 'findMany').mockResolvedValue([
            {
                id: 100,
                userId: 88,
                titleAr: 'إعلان',
                titleEn: 'Listing',
                descriptionAr: 'وصف',
                descriptionEn: 'Description',
                priceAmount: 1000,
                currency: 'USD',
                condition: 'USED',
                negotiable: true,
                countryId: 1,
                cityId: 999,
                subcategoryId: 5,
                status: 'ACTIVE',
                images: [{ id: 1 }],
            },
        ] as never);

        const emitSpy = jest
            .spyOn(notifications, 'emitPlatformNotification')
            .mockImplementation(() => undefined);
        const emailSpy = jest.spyOn(emailUtils, 'sendEmail').mockResolvedValue(true);

        const result = await dispatchSavedSearchDigest('daily', null);

        expect(result.processedSearches).toBe(1);
        expect(result.matchedSearches).toBe(0);
        expect(result.matchedListings).toBe(0);
        expect(result.notifiedUsers).toBe(0);
        expect(result.emailedUsers).toBe(0);
        expect(emitSpy).toHaveBeenCalledTimes(0);
        expect(emailSpy).toHaveBeenCalledTimes(0);
    });

    it('sends digest notification and email for matched daily searches', async () => {
        const ioMock = {} as SocketServer;

        jest.spyOn(prisma.savedSearch, 'findMany').mockResolvedValue([
            {
                id: 1,
                userId: 41,
                name: 'Daily Damascus cars',
                filters: {
                    criteria: {
                        q: 'car',
                        cityId: 10,
                        withImages: true,
                    },
                    notificationFrequency: 'daily',
                },
                user: {
                    email: 'buyer@example.com',
                },
            },
            {
                id: 2,
                userId: 41,
                name: 'Weekly only',
                filters: {
                    criteria: {
                        q: 'car',
                    },
                    notificationFrequency: 'weekly',
                },
                user: {
                    email: 'buyer@example.com',
                },
            },
        ] as never);

        jest.spyOn(prisma.listing, 'findMany').mockResolvedValue([
            {
                id: 100,
                userId: 88,
                titleAr: 'سيارة للبيع',
                titleEn: 'Car for sale',
                descriptionAr: 'وصف طويل',
                descriptionEn: 'Long description',
                priceAmount: 1000,
                currency: 'USD',
                condition: 'USED',
                negotiable: true,
                countryId: 1,
                cityId: 10,
                subcategoryId: 5,
                status: 'ACTIVE',
                images: [{ id: 1 }],
            },
        ] as never);

        const emitSpy = jest
            .spyOn(notifications, 'emitPlatformNotification')
            .mockImplementation(() => undefined);
        const emailSpy = jest.spyOn(emailUtils, 'sendEmail').mockResolvedValue(true);

        const result = await dispatchSavedSearchDigest('daily', ioMock);

        expect(result.processedSearches).toBe(1);
        expect(result.matchedSearches).toBe(1);
        expect(result.matchedListings).toBe(1);
        expect(result.notifiedUsers).toBe(1);
        expect(result.emailedUsers).toBe(1);
        expect(emitSpy).toHaveBeenCalledTimes(1);
        expect(emitSpy).toHaveBeenCalledWith(
            ioMock,
            [41],
            expect.objectContaining({
                kind: 'system',
                link: '/preferences',
            }),
        );
        expect(emailSpy).toHaveBeenCalledTimes(1);
    });

    it('filters digest history by source/frequency/date range', async () => {
        jest.spyOn(redis, 'lrange').mockResolvedValue([
            JSON.stringify({
                id: 'h1',
                source: 'manual',
                frequency: 'daily',
                processedSearches: 3,
                matchedSearches: 1,
                matchedListings: 2,
                notifiedUsers: 1,
                emailedUsers: 1,
                startedAt: '2026-01-01T10:00:00.000Z',
                completedAt: '2026-01-01T10:00:05.000Z',
                recordedAt: '2026-01-01T10:00:05.000Z',
            }),
            JSON.stringify({
                id: 'h2',
                source: 'scheduler',
                frequency: 'weekly',
                processedSearches: 5,
                matchedSearches: 2,
                matchedListings: 4,
                notifiedUsers: 2,
                emailedUsers: 2,
                startedAt: '2026-01-08T10:00:00.000Z',
                completedAt: '2026-01-08T10:00:05.000Z',
                recordedAt: '2026-01-08T10:00:05.000Z',
            }),
        ] as never);

        const result = await getSavedSearchDigestHistory({
            page: 1,
            limit: 20,
            source: 'manual',
            frequency: 'daily',
            from: '2026-01-01T00:00:00.000Z',
            to: '2026-01-02T00:00:00.000Z',
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe('h1');
        expect(result.meta.total).toBe(1);
    });

    it('sorts digest history by completedAt ascending', async () => {
        jest.spyOn(redis, 'lrange').mockResolvedValue([
            JSON.stringify({
                id: 'newer',
                source: 'manual',
                frequency: 'daily',
                processedSearches: 2,
                matchedSearches: 1,
                matchedListings: 1,
                notifiedUsers: 1,
                emailedUsers: 1,
                startedAt: '2026-01-02T10:00:00.000Z',
                completedAt: '2026-01-02T10:00:05.000Z',
                recordedAt: '2026-01-02T10:00:05.000Z',
            }),
            JSON.stringify({
                id: 'older',
                source: 'manual',
                frequency: 'daily',
                processedSearches: 2,
                matchedSearches: 1,
                matchedListings: 1,
                notifiedUsers: 1,
                emailedUsers: 1,
                startedAt: '2026-01-01T10:00:00.000Z',
                completedAt: '2026-01-01T10:00:05.000Z',
                recordedAt: '2026-01-01T10:00:05.000Z',
            }),
        ] as never);

        const result = await getSavedSearchDigestHistory({
            page: 1,
            limit: 20,
            sort: 'completed_asc',
        });

        expect(result.items).toHaveLength(2);
        expect(result.items[0].id).toBe('older');
        expect(result.items[1].id).toBe('newer');
    });

    it('supports duration sort/filter and backfills legacy entries without durationMs', async () => {
        jest.spyOn(redis, 'lrange').mockResolvedValue([
            JSON.stringify({
                id: 'with-duration',
                source: 'manual',
                frequency: 'daily',
                processedSearches: 2,
                matchedSearches: 1,
                matchedListings: 1,
                notifiedUsers: 1,
                emailedUsers: 1,
                startedAt: '2026-01-02T10:00:00.000Z',
                completedAt: '2026-01-02T10:00:09.000Z',
                durationMs: 9000,
                recordedAt: '2026-01-02T10:00:09.000Z',
            }),
            JSON.stringify({
                id: 'legacy-no-duration',
                source: 'manual',
                frequency: 'daily',
                processedSearches: 2,
                matchedSearches: 1,
                matchedListings: 1,
                notifiedUsers: 1,
                emailedUsers: 1,
                startedAt: '2026-01-01T10:00:00.000Z',
                completedAt: '2026-01-01T10:00:03.000Z',
                recordedAt: '2026-01-01T10:00:03.000Z',
            }),
        ] as never);

        const result = await getSavedSearchDigestHistory({
            page: 1,
            limit: 20,
            sort: 'duration_desc',
            minDurationMs: 5000,
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe('with-duration');
        expect(result.items[0].durationMs).toBe(9000);
    });
});
