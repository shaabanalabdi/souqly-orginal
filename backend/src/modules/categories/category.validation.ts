import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const categorySlugParamsSchema = z.object({
    categorySlug: z.string().trim().min(2).max(100).regex(slugPattern),
});

export const subcategorySlugParamsSchema = z.object({
    subcategorySlug: z.string().trim().min(2).max(100).regex(slugPattern),
});
