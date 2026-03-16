import { z } from 'zod';

export const countryCodeParamsSchema = z.object({
    countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
});

export const nearestCityQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    lang: z.string().optional(),
});
