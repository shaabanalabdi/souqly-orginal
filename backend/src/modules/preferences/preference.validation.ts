import { z } from 'zod';

export const listingIdParamsSchema = z.object({
    listingId: z.coerce.number().int().positive(),
});

export const savedSearchIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    lang: z.string().optional(),
});

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
    z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const notificationFrequencySchema = z.enum(['instant', 'daily', 'weekly']);

export const createSavedSearchBodySchema = z.object({
    name: z.string().trim().min(3).max(200),
    filters: z.record(jsonValueSchema),
    notificationFrequency: notificationFrequencySchema.optional().default('daily'),
});

export const updateSavedSearchBodySchema = z.object({
    name: z.string().trim().min(3).max(200).optional(),
    filters: z.record(jsonValueSchema).optional(),
    notificationFrequency: notificationFrequencySchema.optional(),
});

export type CreateSavedSearchBody = z.infer<typeof createSavedSearchBodySchema>;
export type UpdateSavedSearchBody = z.infer<typeof updateSavedSearchBodySchema>;
