import { AccountType, type Prisma } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma.js';

export type StoreAnalyticsMetric =
    | 'listingViews'
    | 'profileViews'
    | 'chatStarts'
    | 'offersReceived'
    | 'dealsCreated';

function getAnalyticsDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildCreateData(
    storeUserId: number,
    metric: StoreAnalyticsMetric,
    amount: number,
    day: Date,
): Prisma.StoreAnalyticsDailyUncheckedCreateInput {
    return {
        userId: storeUserId,
        date: day,
        listingViews: metric === 'listingViews' ? amount : 0,
        profileViews: metric === 'profileViews' ? amount : 0,
        chatStarts: metric === 'chatStarts' ? amount : 0,
        offersReceived: metric === 'offersReceived' ? amount : 0,
        dealsCreated: metric === 'dealsCreated' ? amount : 0,
    };
}

function buildUpdateData(metric: StoreAnalyticsMetric, amount: number): Prisma.StoreAnalyticsDailyUncheckedUpdateInput {
    switch (metric) {
        case 'listingViews':
            return { listingViews: { increment: amount } };
        case 'profileViews':
            return { profileViews: { increment: amount } };
        case 'chatStarts':
            return { chatStarts: { increment: amount } };
        case 'offersReceived':
            return { offersReceived: { increment: amount } };
        case 'dealsCreated':
            return { dealsCreated: { increment: amount } };
        default:
            return {};
    }
}

export async function incrementStoreAnalyticsMetric(
    storeUserId: number,
    metric: StoreAnalyticsMetric,
    amount = 1,
    tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
    if (amount <= 0) {
        return;
    }

    const storeUser = await tx.user.findUnique({
        where: { id: storeUserId },
        select: { accountType: true },
    });

    if (!storeUser || storeUser.accountType !== AccountType.STORE) {
        return;
    }

    const day = getAnalyticsDay(new Date());

    await tx.storeAnalyticsDaily.upsert({
        where: {
            userId_date: {
                userId: storeUserId,
                date: day,
            },
        },
        update: buildUpdateData(metric, amount),
        create: buildCreateData(storeUserId, metric, amount, day),
    });
}

export async function sumStoreAnalyticsMetrics(
    storeUserId: number,
    fromDate: Date,
    toDate: Date,
) {
    const fromDay = getAnalyticsDay(fromDate);
    const toDay = getAnalyticsDay(toDate);

    return prisma.storeAnalyticsDaily.aggregate({
        where: {
            userId: storeUserId,
            date: {
                gte: fromDay,
                lte: toDay,
            },
        },
        _sum: {
            listingViews: true,
            profileViews: true,
            chatStarts: true,
            offersReceived: true,
            dealsCreated: true,
        },
    });
}
