import { z } from 'zod';

const stringListSchema = z
    .array(z.string().trim().min(1).max(120))
    .max(50)
    .transform((values) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))));

export const upsertCraftsmanProfileBodySchema = z.object({
    profession: z.string().trim().min(2).max(120),
    experienceYears: z.coerce.number().int().min(0).max(80).optional(),
    workingHours: z.string().trim().max(255).optional(),
    workingAreas: stringListSchema.optional(),
    portfolio: z.array(z.string().trim().url().max(500)).max(30).optional(),
    availableNow: z.boolean().optional(),
});

export const craftsmanIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const craftsmanListingsQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

export const craftsmanLeadsQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

const craftsmanLeadSourceValues = ['chat', 'phone', 'whatsapp', 'direct'] as const;

export const craftsmanLeadBodySchema = z.object({
    source: z.enum(craftsmanLeadSourceValues),
    message: z.string().trim().max(500).optional(),
});

export type UpsertCraftsmanProfileBody = z.infer<typeof upsertCraftsmanProfileBodySchema>;
export type CreateCraftsmanLeadBody = z.infer<typeof craftsmanLeadBodySchema>;
