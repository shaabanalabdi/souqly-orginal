import { ListingStatus } from '@prisma/client';
import type { Server as SocketServer } from 'socket.io';
import { dispatchInstantSavedSearchAlertsForListing } from '../modules/preferences/savedSearchAlert.service.js';
import { prisma } from '../shared/utils/prisma.js';
import * as notifications from '../shared/realtime/notifications.js';
import * as emailUtils from '../shared/utils/email.js';

describe('Saved search instant alerts', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns empty result for non-active listing', async () => {
        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 101,
            userId: 50,
            titleAr: 'عنوان',
            titleEn: 'Title',
            descriptionAr: 'وصف',
            descriptionEn: 'Description',
            priceAmount: 1000,
            currency: 'USD',
            condition: 'USED',
            negotiable: true,
            countryId: 1,
            cityId: 10,
            subcategoryId: 5,
            status: ListingStatus.PENDING,
            images: [{ id: 1 }],
        } as never);
        const savedSearchSpy = jest.spyOn(prisma.savedSearch, 'findMany').mockResolvedValue([] as never);

        const result = await dispatchInstantSavedSearchAlertsForListing(101, null);

        expect(result).toEqual({
            listingId: 101,
            matchedSearches: 0,
            notifiedUsers: 0,
            emailedUsers: 0,
        });
        expect(savedSearchSpy).toHaveBeenCalledTimes(0);
    });

    it('dispatches realtime and email alerts for matching instant searches', async () => {
        const ioMock = {} as SocketServer;

        jest.spyOn(prisma.listing, 'findUnique').mockResolvedValue({
            id: 101,
            userId: 50,
            titleAr: 'سيارة مستعملة للبيع',
            titleEn: 'Used car for sale',
            descriptionAr: 'وصف إعلان طويل بما يكفي لاختبار مطابقة البحث',
            descriptionEn: 'Long listing description for search matching test',
            priceAmount: 4500,
            currency: 'USD',
            condition: 'USED',
            negotiable: true,
            countryId: 1,
            cityId: 10,
            subcategoryId: 5,
            status: ListingStatus.ACTIVE,
            images: [{ id: 1 }],
        } as never);

        jest.spyOn(prisma.savedSearch, 'findMany').mockResolvedValue([
            {
                id: 1,
                userId: 77,
                name: 'Cars in Damascus',
                filters: {
                    criteria: {
                        q: 'car',
                        countryId: 1,
                        cityId: 10,
                        minPrice: 1000,
                        maxPrice: 6000,
                        withImages: true,
                    },
                    notificationFrequency: 'instant',
                },
                user: { email: 'buyer1@example.com' },
            },
            {
                id: 2,
                userId: 77,
                name: 'Used cars',
                filters: {
                    criteria: {
                        condition: 'USED',
                    },
                    notificationFrequency: 'instant',
                },
                user: { email: 'buyer1@example.com' },
            },
            {
                id: 3,
                userId: 88,
                name: 'Daily digest',
                filters: {
                    criteria: {
                        q: 'car',
                    },
                    notificationFrequency: 'daily',
                },
                user: { email: 'buyer2@example.com' },
            },
            {
                id: 4,
                userId: 99,
                name: 'Different city',
                filters: {
                    criteria: {
                        cityId: 999,
                    },
                    notificationFrequency: 'instant',
                },
                user: { email: 'buyer3@example.com' },
            },
        ] as never);

        const emitSpy = jest
            .spyOn(notifications, 'emitPlatformNotification')
            .mockImplementation(() => undefined);
        const emailSpy = jest.spyOn(emailUtils, 'sendEmail').mockResolvedValue(true);

        const result = await dispatchInstantSavedSearchAlertsForListing(101, ioMock);

        expect(result).toEqual({
            listingId: 101,
            matchedSearches: 2,
            notifiedUsers: 1,
            emailedUsers: 1,
        });
        expect(emitSpy).toHaveBeenCalledTimes(1);
        expect(emitSpy).toHaveBeenCalledWith(
            ioMock,
            [77],
            expect.objectContaining({
                kind: 'system',
                link: '/listings/101',
            }),
        );
        expect(emailSpy).toHaveBeenCalledTimes(1);
    });
});
