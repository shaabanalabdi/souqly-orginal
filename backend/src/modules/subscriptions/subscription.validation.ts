import { z } from 'zod';
import { STORE_PLAN_CODES } from './subscription.plans.js';

export const subscribeBodySchema = z.object({
    planCode: z.enum(STORE_PLAN_CODES),
    billingCycleMonths: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).optional().default(1),
    autoRenew: z.boolean().optional().default(false),
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
