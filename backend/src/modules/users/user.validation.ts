import { z } from 'zod';

export const publicUserParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const publicUserPaginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});

export const updateMyProfileBodySchema = z.object({
    fullName: z.string().trim().min(2).max(100).optional(),
    username: z
        .string()
        .trim()
        .min(3)
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/)
        .optional()
        .nullable(),
    bio: z.string().trim().max(1000).optional().nullable(),
    avatarUrl: z.string().trim().url().max(500).optional().nullable(),
    countryId: z.coerce.number().int().positive().optional().nullable(),
    cityId: z.coerce.number().int().positive().optional().nullable(),
});

export type UpdateMyProfileBody = z.infer<typeof updateMyProfileBodySchema>;
