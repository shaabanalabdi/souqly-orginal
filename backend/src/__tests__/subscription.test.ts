import request from 'supertest';
import { StoreSubscriptionStatus } from '@prisma/client';
import app from '../app.js';
import { prisma } from '../shared/utils/prisma.js';
import { signAccessToken } from '../shared/utils/jwt.js';
import { STORE_PLAN_CATALOG } from '../modules/subscriptions/subscription.plans.js';

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 1000);

const BASIC = STORE_PLAN_CATALOG.find((p) => p.code === 'BASIC')!;
const PRO = STORE_PLAN_CATALOG.find((p) => p.code === 'PRO')!;

describe('Subscription routes', () => {
    // ─── Plans ────────────────────────────────────────────────────────────────

    it('GET /api/v1/subscriptions/plans returns all plans (public)', async () => {
        const res = await request(app).get('/api/v1/subscriptions/plans');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data).toHaveLength(STORE_PLAN_CATALOG.length);
        expect(res.body.data[0]).toMatchObject({
            code: BASIC.code,
            priceUsdMonthly: BASIC.priceUsdMonthly,
            featuredSlots: BASIC.featuredSlots,
            analyticsLevel: BASIC.analyticsLevel,
        });
        // quarterly / yearly discount fields are present and numeric
        expect(typeof res.body.data[0].priceUsdQuarterly).toBe('number');
        expect(typeof res.body.data[0].priceUsdYearly).toBe('number');
    });

    // ─── Current subscription ─────────────────────────────────────────────────

    it('GET /api/v1/subscriptions/current returns 401 without auth', async () => {
        const res = await request(app).get('/api/v1/subscriptions/current');
        expect(res.status).toBe(401);
    });

    it('GET /api/v1/subscriptions/current returns null when no subscription exists', async () => {
        const token = signAccessToken({ userId: 10, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({ id: 5 } as never);
        jest.spyOn(prisma.storeSubscription, 'findUnique').mockResolvedValue(null);

        const res = await request(app)
            .get('/api/v1/subscriptions/current')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.active).toBe(false);
        expect(res.body.data.subscription).toBeNull();
        expect(res.body.data.eligibleForStorePlans).toBe(true);
    });

    it('GET /api/v1/subscriptions/current returns active subscription', async () => {
        const token = signAccessToken({ userId: 10, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({ id: 5 } as never);
        jest.spyOn(prisma.storeSubscription, 'findUnique').mockResolvedValue({
            planCode: PRO.code,
            planName: PRO.name,
            status: StoreSubscriptionStatus.ACTIVE,
            startedAt: new Date('2026-01-01'),
            expiresAt: FUTURE,
            autoRenew: true,
            priceUsd: PRO.priceUsdMonthly,
        } as never);

        const res = await request(app)
            .get('/api/v1/subscriptions/current')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.active).toBe(true);
        expect(res.body.data.subscription.planCode).toBe(PRO.code);
        expect(res.body.data.subscription.autoRenew).toBe(true);
        expect(res.body.data.subscription.daysRemaining).toBeGreaterThan(0);
    });

    it('GET /api/v1/subscriptions/current auto-expires an overdue ACTIVE subscription', async () => {
        const token = signAccessToken({ userId: 10, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({ id: 5 } as never);
        jest.spyOn(prisma.storeSubscription, 'findUnique').mockResolvedValue({
            planCode: BASIC.code,
            planName: BASIC.name,
            status: StoreSubscriptionStatus.ACTIVE,
            startedAt: new Date('2025-01-01'),
            expiresAt: PAST,
            autoRenew: false,
            priceUsd: BASIC.priceUsdMonthly,
        } as never);
        const updateSpy = jest.spyOn(prisma.storeSubscription, 'update').mockResolvedValue({
            planCode: BASIC.code,
            planName: BASIC.name,
            status: StoreSubscriptionStatus.EXPIRED,
            startedAt: new Date('2025-01-01'),
            expiresAt: PAST,
            autoRenew: false,
            priceUsd: BASIC.priceUsdMonthly,
        } as never);

        const res = await request(app)
            .get('/api/v1/subscriptions/current')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.active).toBe(false);
        expect(res.body.data.subscription.status).toBe(StoreSubscriptionStatus.EXPIRED);
        expect(updateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: StoreSubscriptionStatus.EXPIRED }),
            }),
        );
    });

    // ─── Subscribe ────────────────────────────────────────────────────────────

    it('POST /api/v1/subscriptions/subscribe requires auth', async () => {
        const res = await request(app)
            .post('/api/v1/subscriptions/subscribe')
            .send({ planCode: BASIC.code });
        expect(res.status).toBe(401);
    });

    it('POST /api/v1/subscriptions/subscribe returns 403 without business profile', async () => {
        const token = signAccessToken({ userId: 20, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue(null);

        const res = await request(app)
            .post('/api/v1/subscriptions/subscribe')
            .set('Authorization', `Bearer ${token}`)
            .set('x-idempotency-key', 'sub-no-business-profile')
            .send({ planCode: BASIC.code });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('BUSINESS_PROFILE_REQUIRED');
    });

    it('POST /api/v1/subscriptions/subscribe creates new subscription', async () => {
        const token = signAccessToken({ userId: 20, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({ id: 7 } as never);
        jest.spyOn(prisma.storeSubscriptionPaymentAttempt, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.storeSubscription, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.storeSubscription, 'create').mockResolvedValue({
            id: 1,
            userId: 20,
            planCode: PRO.code,
            planName: PRO.name,
            status: StoreSubscriptionStatus.PENDING,
            startedAt: null,
            activatedAt: null,
            expiresAt: FUTURE,
            autoRenew: false,
            priceUsd: PRO.priceUsdMonthly,
            lastCheckoutToken: 'checkout-sub-create',
        } as never);
        jest.spyOn(prisma.storeSubscriptionPaymentAttempt, 'create').mockResolvedValue({
            userId: 20,
            subscriptionId: 1,
            planCode: PRO.code,
            billingMonths: 1,
            amountUsd: PRO.priceUsdMonthly,
            currency: 'USD',
            status: 'PENDING',
            idempotencyKey: 'sub-create',
            checkoutToken: 'checkout-sub-create',
            providerRef: null,
            expiresAt: FUTURE,
            createdAt: new Date(),
        } as never);

        const res = await request(app)
            .post('/api/v1/subscriptions/subscribe')
            .set('Authorization', `Bearer ${token}`)
            .set('x-idempotency-key', 'sub-create')
            .send({ planCode: PRO.code, billingCycleMonths: 1, autoRenew: false });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.subscription.planCode).toBe(PRO.code);
        expect(res.body.data.subscription.status).toBe(StoreSubscriptionStatus.PENDING);
        expect(res.body.data.paymentAttempt.status).toBe('PENDING');
    });

    it('POST /api/v1/subscriptions/subscribe extends existing same-plan active subscription', async () => {
        const token = signAccessToken({ userId: 20, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({ id: 7 } as never);
        jest.spyOn(prisma.storeSubscriptionPaymentAttempt, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.storeSubscription, 'findUnique').mockResolvedValue({
            id: 9,
            userId: 20,
            planCode: PRO.code,
            planName: PRO.name,
            status: StoreSubscriptionStatus.ACTIVE,
            startedAt: new Date('2026-01-01'),
            activatedAt: new Date('2026-01-01'),
            expiresAt: FUTURE,
            autoRenew: false,
            priceUsd: PRO.priceUsdMonthly,
            lastCheckoutToken: null,
        } as never);
        jest.spyOn(prisma.storeSubscription, 'update').mockResolvedValue({
            id: 9,
            userId: 20,
            planCode: PRO.code,
            planName: PRO.name,
            status: StoreSubscriptionStatus.ACTIVE,
            startedAt: new Date('2026-01-01'),
            activatedAt: new Date('2026-01-01'),
            expiresAt: new Date(FUTURE.getTime() + 30 * 24 * 60 * 60 * 1000),
            autoRenew: false,
            priceUsd: PRO.priceUsdMonthly,
            lastCheckoutToken: 'checkout-sub-renew',
        } as never);
        jest.spyOn(prisma.storeSubscriptionPaymentAttempt, 'create').mockResolvedValue({
            userId: 20,
            subscriptionId: 9,
            planCode: PRO.code,
            billingMonths: 1,
            amountUsd: PRO.priceUsdMonthly,
            currency: 'USD',
            status: 'PENDING',
            idempotencyKey: 'sub-renew',
            checkoutToken: 'checkout-sub-renew',
            providerRef: null,
            expiresAt: FUTURE,
            createdAt: new Date(),
        } as never);

        const res = await request(app)
            .post('/api/v1/subscriptions/subscribe')
            .set('Authorization', `Bearer ${token}`)
            .set('x-idempotency-key', 'sub-renew')
            .send({ planCode: PRO.code, billingCycleMonths: 1 });

        expect(res.status).toBe(201);
        expect(res.body.data.subscription.planCode).toBe(PRO.code);
        expect(res.body.data.paymentAttempt.status).toBe('PENDING');
    });

    it('POST /api/v1/subscriptions/subscribe rejects invalid planCode', async () => {
        const token = signAccessToken({ userId: 20, role: 'USER', trustTier: 'NEW' });

        const res = await request(app)
            .post('/api/v1/subscriptions/subscribe')
            .set('Authorization', `Bearer ${token}`)
            .send({ planCode: 'FAKE_PLAN' });

        expect(res.status).toBe(400);
    });

    // ─── Cancel ───────────────────────────────────────────────────────────────

    it('POST /api/v1/subscriptions/cancel requires auth', async () => {
        const res = await request(app).post('/api/v1/subscriptions/cancel');
        expect(res.status).toBe(401);
    });

    it('POST /api/v1/subscriptions/cancel cancels active subscription', async () => {
        const token = signAccessToken({ userId: 30, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({ id: 9 } as never);
        jest.spyOn(prisma.storeSubscription, 'findUnique').mockResolvedValue({
            userId: 30,
            planCode: BASIC.code,
            planName: BASIC.name,
            status: StoreSubscriptionStatus.ACTIVE,
            startedAt: new Date('2026-02-01'),
            expiresAt: FUTURE,
            autoRenew: true,
            priceUsd: BASIC.priceUsdMonthly,
        } as never);
        jest.spyOn(prisma.storeSubscription, 'update').mockResolvedValue({
            planCode: BASIC.code,
            planName: BASIC.name,
            status: StoreSubscriptionStatus.CANCELED,
            startedAt: new Date('2026-02-01'),
            expiresAt: FUTURE,
            autoRenew: false,
            priceUsd: BASIC.priceUsdMonthly,
        } as never);

        const res = await request(app)
            .post('/api/v1/subscriptions/cancel')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(StoreSubscriptionStatus.CANCELED);
        expect(res.body.data.autoRenew).toBe(false);
    });

    it('POST /api/v1/subscriptions/cancel returns 404 when no active subscription', async () => {
        const token = signAccessToken({ userId: 30, role: 'USER', trustTier: 'NEW' });

        jest.spyOn(prisma.businessProfile, 'findUnique').mockResolvedValue({ id: 9 } as never);
        jest.spyOn(prisma.storeSubscription, 'findUnique').mockResolvedValue(null);

        const res = await request(app)
            .post('/api/v1/subscriptions/cancel')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('ACTIVE_SUBSCRIPTION_NOT_FOUND');
    });
});
