import { z } from 'zod';

export const upsertBusinessProfileBodySchema = z.object({
    companyName: z.string().trim().min(2).max(200),
    commercialRegister: z.string().trim().max(100).optional(),
    taxNumber: z.string().trim().max(100).optional(),
    website: z.string().trim().url().max(300).optional(),
});

export const storeIdParamsSchema = z.object({
    storeId: z.coerce.number().int().positive(),
});

export const storeListingsQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

export const storeAnalyticsQuerySchema = z.object({
    from: z.string().trim().min(10).max(64).optional(),
    to: z.string().trim().min(10).max(64).optional(),
});

export type UpsertBusinessProfileBody = z.infer<typeof upsertBusinessProfileBodySchema>;
