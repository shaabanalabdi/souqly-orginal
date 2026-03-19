import { randomUUID } from 'node:crypto';
import { PaymentAttemptStatus, Prisma, StoreSubscriptionStatus } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { prisma } from '../../shared/utils/prisma.js';
import { notifyUser } from '../notifications/notification.service.js';
import type {
    ConfirmSubscriptionCheckoutBody,
    SubscribeBody,
} from './subscription.validation.js';
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
    startedAt: string | null;
    activatedAt: string | null;
    expiresAt: string;
    autoRenew: boolean;
    priceUsd: number;
    daysRemaining: number;
    checkoutPending: boolean;
}

interface StoreSubscriptionPaymentAttemptDto {
    status: PaymentAttemptStatus;
    amountUsd: number;
    currency: string;
    checkoutToken: string;
    checkoutUrl: string | null;
    providerRef: string | null;
    expiresAt: string;
    createdAt: string;
}

interface StoreSubscriptionCheckoutDto {
    subscription: StoreSubscriptionDto;
    paymentAttempt: StoreSubscriptionPaymentAttemptDto;
}

interface CurrentStoreSubscriptionDto {
    eligibleForStorePlans: boolean;
    active: boolean;
    subscription: StoreSubscriptionDto | null;
}

const SUBSCRIPTION_SELECT = {
    id: true,
    userId: true,
    planCode: true,
    planName: true,
    status: true,
    startedAt: true,
    activatedAt: true,
    expiresAt: true,
    autoRenew: true,
    priceUsd: true,
    lastCheckoutToken: true,
} as const;

const PAYMENT_ATTEMPT_SELECT = {
    userId: true,
    subscriptionId: true,
    planCode: true,
    billingMonths: true,
    amountUsd: true,
    currency: true,
    status: true,
    idempotencyKey: true,
    checkoutToken: true,
    providerRef: true,
    expiresAt: true,
    createdAt: true,
} as const;

type SubscriptionRecord = Prisma.StoreSubscriptionGetPayload<{
    select: typeof SUBSCRIPTION_SELECT;
}>;

type PaymentAttemptRecord = Prisma.StoreSubscriptionPaymentAttemptGetPayload<{
    select: typeof PAYMENT_ATTEMPT_SELECT;
}>;

function addMonths(from: Date, months: number): Date {
    const date = new Date(from);
    date.setMonth(date.getMonth() + months);
    return date;
}

function addMinutes(from: Date, minutes: number): Date {
    return new Date(from.getTime() + minutes * 60 * 1000);
}

function getDaysRemaining(expiresAt: Date, now: Date): number {
    if (expiresAt <= now) return 0;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((expiresAt.getTime() - now.getTime()) / millisecondsPerDay);
}

function resolveCheckoutUrl(checkoutToken: string): string | null {
    const baseUrl = process.env.STORE_SUBSCRIPTION_CHECKOUT_URL?.trim();
    if (!baseUrl) {
        return null;
    }

    return `${baseUrl.replace(/\/$/, '')}/${checkoutToken}`;
}

function mapSubscription(subscription: SubscriptionRecord, now: Date): StoreSubscriptionDto {
    return {
        planCode: subscription.planCode,
        planName: subscription.planName,
        status: subscription.status,
        startedAt: subscription.startedAt?.toISOString() ?? null,
        activatedAt: subscription.activatedAt?.toISOString() ?? null,
        expiresAt: subscription.expiresAt.toISOString(),
        autoRenew: subscription.autoRenew,
        priceUsd: subscription.priceUsd,
        daysRemaining: getDaysRemaining(subscription.expiresAt, now),
        checkoutPending: subscription.status === StoreSubscriptionStatus.PENDING,
    };
}

function mapPaymentAttempt(attempt: PaymentAttemptRecord): StoreSubscriptionPaymentAttemptDto {
    return {
        status: attempt.status,
        amountUsd: attempt.amountUsd,
        currency: attempt.currency,
        checkoutToken: attempt.checkoutToken,
        checkoutUrl: resolveCheckoutUrl(attempt.checkoutToken),
        providerRef: attempt.providerRef ?? null,
        expiresAt: attempt.expiresAt.toISOString(),
        createdAt: attempt.createdAt.toISOString(),
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

async function normalizeCurrentSubscription(
    tx: Prisma.TransactionClient,
    userId: number,
    now: Date,
): Promise<SubscriptionRecord | null> {
    const current = await tx.storeSubscription.findUnique({
        where: { userId },
        select: SUBSCRIPTION_SELECT,
    });

    if (
        current
        && current.status === StoreSubscriptionStatus.ACTIVE
        && current.expiresAt <= now
    ) {
        return tx.storeSubscription.update({
            where: { userId },
            data: {
                status: StoreSubscriptionStatus.EXPIRED,
                autoRenew: false,
                lastCheckoutToken: null,
            },
            select: SUBSCRIPTION_SELECT,
        });
    }

    return current;
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

    const current = await prisma.$transaction((tx) => normalizeCurrentSubscription(tx, userId, now));

    if (!current) {
        return {
            eligibleForStorePlans,
            active: false,
            subscription: null,
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
    idempotencyKey: string,
): Promise<StoreSubscriptionCheckoutDto> {
    await ensureBusinessProfile(userId);

    const now = new Date();
    const existingAttempt = await prisma.storeSubscriptionPaymentAttempt.findUnique({
        where: { idempotencyKey },
        select: {
            ...PAYMENT_ATTEMPT_SELECT,
            subscription: {
                select: SUBSCRIPTION_SELECT,
            },
        },
    });

    if (existingAttempt) {
        if (existingAttempt.userId !== userId) {
            throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key is already in use.');
        }

        const subscription =
            existingAttempt.subscription
            ?? await prisma.storeSubscription.findUnique({
                where: { userId },
                select: SUBSCRIPTION_SELECT,
            });

        if (!subscription) {
            throw new ApiError(409, 'SUBSCRIPTION_STATE_INVALID', 'Subscription checkout state is invalid.');
        }

        return {
            subscription: mapSubscription(subscription, now),
            paymentAttempt: mapPaymentAttempt(existingAttempt),
        };
    }

    const plan = getStorePlanByCode(payload.planCode);
    const billedAmount = Number((plan.priceUsdMonthly * payload.billingCycleMonths).toFixed(2));
    const checkoutToken = randomUUID().replace(/-/g, '');
    const checkoutExpiresAt = addMinutes(now, 30);

    const result = await prisma.$transaction(async (tx) => {
        const current = await normalizeCurrentSubscription(tx, userId, now);

        let subscription: SubscriptionRecord;
        if (
            current
            && current.status === StoreSubscriptionStatus.ACTIVE
            && current.expiresAt > now
        ) {
            subscription = await tx.storeSubscription.update({
                where: { userId },
                data: {
                    autoRenew: payload.autoRenew,
                    lastCheckoutToken: checkoutToken,
                },
                select: SUBSCRIPTION_SELECT,
            });
        } else if (current) {
            subscription = await tx.storeSubscription.update({
                where: { userId },
                data: {
                    planCode: plan.code,
                    planName: plan.name,
                    status: StoreSubscriptionStatus.PENDING,
                    startedAt: null,
                    activatedAt: null,
                    expiresAt: addMonths(now, payload.billingCycleMonths),
                    autoRenew: payload.autoRenew,
                    priceUsd: billedAmount,
                    lastCheckoutToken: checkoutToken,
                },
                select: SUBSCRIPTION_SELECT,
            });
        } else {
            subscription = await tx.storeSubscription.create({
                data: {
                    userId,
                    planCode: plan.code,
                    planName: plan.name,
                    status: StoreSubscriptionStatus.PENDING,
                    startedAt: null,
                    activatedAt: null,
                    expiresAt: addMonths(now, payload.billingCycleMonths),
                    autoRenew: payload.autoRenew,
                    priceUsd: billedAmount,
                    lastCheckoutToken: checkoutToken,
                },
                select: SUBSCRIPTION_SELECT,
            });
        }

        const attempt = await tx.storeSubscriptionPaymentAttempt.create({
            data: {
                userId,
                subscriptionId: subscription.id,
                planCode: plan.code,
                billingMonths: payload.billingCycleMonths,
                amountUsd: billedAmount,
                currency: 'USD',
                status: PaymentAttemptStatus.PENDING,
                idempotencyKey,
                checkoutToken,
                expiresAt: checkoutExpiresAt,
            },
            select: PAYMENT_ATTEMPT_SELECT,
        });

        return {
            subscription,
            paymentAttempt: attempt,
        };
    });

    return {
        subscription: mapSubscription(result.subscription, now),
        paymentAttempt: mapPaymentAttempt(result.paymentAttempt),
    };
}

export async function confirmStoreSubscriptionCheckout(
    userId: number,
    payload: ConfirmSubscriptionCheckoutBody,
    idempotencyKey: string,
): Promise<StoreSubscriptionDto> {
    await ensureBusinessProfile(userId);

    const now = new Date();
    const providerRef = payload.providerRef?.trim() || `checkout-confirm:${idempotencyKey}`;

    const subscription = await prisma.$transaction(async (tx) => {
        const attempt = await tx.storeSubscriptionPaymentAttempt.findFirst({
            where: {
                userId,
                checkoutToken: payload.checkoutToken,
            },
            select: {
                ...PAYMENT_ATTEMPT_SELECT,
                subscription: {
                    select: SUBSCRIPTION_SELECT,
                },
            },
        });

        if (!attempt) {
            throw new ApiError(404, 'SUBSCRIPTION_CHECKOUT_NOT_FOUND', 'Subscription checkout not found.');
        }

        if (attempt.status === PaymentAttemptStatus.SUCCEEDED) {
            const current =
                attempt.subscription
                ?? await normalizeCurrentSubscription(tx, userId, now);

            if (!current) {
                throw new ApiError(409, 'SUBSCRIPTION_STATE_INVALID', 'Subscription checkout state is invalid.');
            }

            return current;
        }

        if (attempt.status !== PaymentAttemptStatus.PENDING) {
            throw new ApiError(409, 'SUBSCRIPTION_CHECKOUT_FINALIZED', 'Subscription checkout is already finalized.');
        }

        if (attempt.expiresAt <= now) {
            await tx.storeSubscriptionPaymentAttempt.update({
                where: { checkoutToken: payload.checkoutToken },
                data: {
                    status: PaymentAttemptStatus.CANCELED,
                    failureReason: 'Checkout session expired before confirmation.',
                },
            });

            throw new ApiError(409, 'SUBSCRIPTION_CHECKOUT_EXPIRED', 'Subscription checkout has expired.');
        }

        const conflictingProviderRef = await tx.storeSubscriptionPaymentAttempt.findFirst({
            where: {
                providerRef,
                checkoutToken: {
                    not: payload.checkoutToken,
                },
            },
            select: { checkoutToken: true },
        });

        if (conflictingProviderRef) {
            throw new ApiError(409, 'PROVIDER_REFERENCE_REUSED', 'Provider reference is already associated with another checkout.');
        }

        const current = await normalizeCurrentSubscription(tx, userId, now);
        const shouldExtend =
            Boolean(current)
            && current!.status === StoreSubscriptionStatus.ACTIVE
            && current!.expiresAt > now
            && current!.planCode === attempt.planCode;

        const startedAt = shouldExtend ? current!.startedAt ?? now : now;
        const baseDate = shouldExtend ? current!.expiresAt : now;
        const expiresAt = addMonths(baseDate, attempt.billingMonths);

        const attemptPlan = getStorePlanByCode(attempt.planCode as StorePlanDefinition['code']);

        const updatedSubscription = current
            ? await tx.storeSubscription.update({
                  where: { userId },
                  data: {
                      planCode: attempt.planCode,
                      planName: attemptPlan.name,
                      status: StoreSubscriptionStatus.ACTIVE,
                      startedAt,
                      activatedAt: now,
                      expiresAt,
                      priceUsd: attempt.amountUsd,
                      lastCheckoutToken: null,
                  },
                  select: SUBSCRIPTION_SELECT,
              })
            : await tx.storeSubscription.create({
                  data: {
                      userId,
                      planCode: attempt.planCode,
                      planName: attemptPlan.name,
                      status: StoreSubscriptionStatus.ACTIVE,
                      startedAt: now,
                      activatedAt: now,
                      expiresAt,
                      autoRenew: false,
                      priceUsd: attempt.amountUsd,
                  },
                  select: SUBSCRIPTION_SELECT,
              });

        await tx.storeSubscriptionPaymentAttempt.update({
            where: { checkoutToken: payload.checkoutToken },
            data: {
                subscriptionId: updatedSubscription.id,
                status: PaymentAttemptStatus.SUCCEEDED,
                providerRef,
                paidAt: now,
            },
        });

        return updatedSubscription;
    });

    await notifyUser(userId, {
        type: 'SUBSCRIPTION_ACTIVATED',
        title: 'Subscription activated',
        body: `${subscription.planName} is now active on your store account.`,
        link: '/subscriptions',
        targetType: 'store_subscription',
        dedupKey: `subscription-activated:${userId}:${subscription.planCode}:${subscription.expiresAt.toISOString()}`,
    });

    return mapSubscription(subscription, now);
}

export async function cancelStoreSubscription(userId: number): Promise<StoreSubscriptionDto> {
    await ensureBusinessProfile(userId);

    const now = new Date();
    const existing = await prisma.$transaction((tx) => normalizeCurrentSubscription(tx, userId, now));

    if (!existing || existing.status !== StoreSubscriptionStatus.ACTIVE) {
        throw new ApiError(404, 'ACTIVE_SUBSCRIPTION_NOT_FOUND', 'Active store subscription not found.');
    }

    const canceled = await prisma.storeSubscription.update({
        where: { userId },
        data: {
            status: StoreSubscriptionStatus.CANCELED,
            autoRenew: false,
            lastCheckoutToken: null,
        },
        select: SUBSCRIPTION_SELECT,
    });

    return mapSubscription(canceled, now);
}
