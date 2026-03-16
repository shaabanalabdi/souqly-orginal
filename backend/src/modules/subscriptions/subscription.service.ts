import { StoreSubscriptionStatus } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { SubscribeBody } from './subscription.validation.js';
import {
    getStorePlanByCode,
    STORE_PLAN_CATALOG,
    type StorePlanDefinition,
} from './subscription.plans.js';

interface StorePlanDto extends StorePlanDefinition {
    priceUsdQuarterly: number;
    priceUsdYearly: number;
}

interface StoreSubscriptionDto {
    planCode: string;
    planName: string;
    status: StoreSubscriptionStatus;
    startedAt: string;
    expiresAt: string;
    autoRenew: boolean;
    priceUsd: number;
    daysRemaining: number;
}

interface CurrentStoreSubscriptionDto {
    eligibleForStorePlans: boolean;
    active: boolean;
    subscription: StoreSubscriptionDto | null;
}

const SUBSCRIPTION_SELECT = {
    planCode: true,
    planName: true,
    status: true,
    startedAt: true,
    expiresAt: true,
    autoRenew: true,
    priceUsd: true,
} as const;

function addMonths(from: Date, months: number): Date {
    const date = new Date(from);
    date.setMonth(date.getMonth() + months);
    return date;
}

function getDaysRemaining(expiresAt: Date, now: Date): number {
    if (expiresAt <= now) return 0;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((expiresAt.getTime() - now.getTime()) / millisecondsPerDay);
}

function mapSubscription(
    subscription: {
        planCode: string;
        planName: string;
        status: StoreSubscriptionStatus;
        startedAt: Date;
        expiresAt: Date;
        autoRenew: boolean;
        priceUsd: number;
    },
    now: Date,
): StoreSubscriptionDto {
    return {
        planCode: subscription.planCode,
        planName: subscription.planName,
        status: subscription.status,
        startedAt: subscription.startedAt.toISOString(),
        expiresAt: subscription.expiresAt.toISOString(),
        autoRenew: subscription.autoRenew,
        priceUsd: subscription.priceUsd,
        daysRemaining: getDaysRemaining(subscription.expiresAt, now),
    };
}

async function hasBusinessProfile(userId: number): Promise<boolean> {
    const businessProfile = await prisma.businessProfile.findUnique({
        where: { userId },
        select: { id: true },
    });

    return Boolean(businessProfile);
}

async function ensureBusinessProfile(userId: number): Promise<void> {
    const eligible = await hasBusinessProfile(userId);
    if (!eligible) {
        throw new ApiError(
            403,
            'BUSINESS_PROFILE_REQUIRED',
            'Store subscriptions are available only for business profiles.',
        );
    }
}

export function listStorePlans(): StorePlanDto[] {
    return STORE_PLAN_CATALOG.map((plan) => ({
        ...plan,
        priceUsdQuarterly: Number((plan.priceUsdMonthly * 3 * 0.95).toFixed(2)),
        priceUsdYearly: Number((plan.priceUsdMonthly * 12 * 0.85).toFixed(2)),
    }));
}

export async function getCurrentStoreSubscription(userId: number): Promise<CurrentStoreSubscriptionDto> {
    const now = new Date();
    const eligibleForStorePlans = await hasBusinessProfile(userId);

    const current = await prisma.storeSubscription.findUnique({
        where: { userId },
        select: SUBSCRIPTION_SELECT,
    });

    if (!current) {
        return {
            eligibleForStorePlans,
            active: false,
            subscription: null,
        };
    }

    if (current.status === StoreSubscriptionStatus.ACTIVE && current.expiresAt <= now) {
        const expired = await prisma.storeSubscription.update({
            where: { userId },
            data: {
                status: StoreSubscriptionStatus.EXPIRED,
                autoRenew: false,
            },
            select: SUBSCRIPTION_SELECT,
        });

        return {
            eligibleForStorePlans,
            active: false,
            subscription: mapSubscription(expired, now),
        };
    }

    return {
        eligibleForStorePlans,
        active: current.status === StoreSubscriptionStatus.ACTIVE && current.expiresAt > now,
        subscription: mapSubscription(current, now),
    };
}

export async function subscribeStorePlan(
    userId: number,
    payload: SubscribeBody,
): Promise<StoreSubscriptionDto> {
    await ensureBusinessProfile(userId);

    const now = new Date();
    const plan = getStorePlanByCode(payload.planCode);
    const billedAmount = Number((plan.priceUsdMonthly * payload.billingCycleMonths).toFixed(2));

    const existing = await prisma.storeSubscription.findUnique({
        where: { userId },
        select: SUBSCRIPTION_SELECT,
    });

    const shouldExtend =
        Boolean(existing) &&
        existing!.status === StoreSubscriptionStatus.ACTIVE &&
        existing!.expiresAt > now &&
        existing!.planCode === plan.code;

    const startedAt = shouldExtend ? existing!.startedAt : now;
    const baseDate = shouldExtend ? existing!.expiresAt : now;
    const expiresAt = addMonths(baseDate, payload.billingCycleMonths);

    const subscription = existing
        ? await prisma.storeSubscription.update({
              where: { userId },
              data: {
                  planCode: plan.code,
                  planName: plan.name,
                  status: StoreSubscriptionStatus.ACTIVE,
                  startedAt,
                  expiresAt,
                  autoRenew: payload.autoRenew,
                  priceUsd: billedAmount,
              },
              select: SUBSCRIPTION_SELECT,
          })
        : await prisma.storeSubscription.create({
              data: {
                  userId,
                  planCode: plan.code,
                  planName: plan.name,
                  status: StoreSubscriptionStatus.ACTIVE,
                  startedAt,
                  expiresAt,
                  autoRenew: payload.autoRenew,
                  priceUsd: billedAmount,
              },
              select: SUBSCRIPTION_SELECT,
          });

    return mapSubscription(subscription, now);
}

export async function cancelStoreSubscription(userId: number): Promise<StoreSubscriptionDto> {
    await ensureBusinessProfile(userId);

    const now = new Date();
    const existing = await prisma.storeSubscription.findUnique({
        where: { userId },
        select: SUBSCRIPTION_SELECT,
    });

    if (!existing || existing.status !== StoreSubscriptionStatus.ACTIVE) {
        throw new ApiError(404, 'ACTIVE_SUBSCRIPTION_NOT_FOUND', 'Active store subscription not found.');
    }

    const canceled = await prisma.storeSubscription.update({
        where: { userId },
        data: {
            status: StoreSubscriptionStatus.CANCELED,
            autoRenew: false,
        },
        select: SUBSCRIPTION_SELECT,
    });

    return mapSubscription(canceled, now);
}
