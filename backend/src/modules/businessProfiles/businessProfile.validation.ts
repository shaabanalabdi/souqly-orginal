import { z } from 'zod';

export const upsertBusinessProfileBodySchema = z.object({
    companyName: z.string().trim().min(2).max(200),
    commercialRegister: z.string().trim().max(100).optional(),
    taxNumber: z.string().trim().max(100).optional(),
    website: z.string().trim().url().max(300).optional(),
});

export type UpsertBusinessProfileBody = z.infer<typeof upsertBusinessProfileBodySchema>;
