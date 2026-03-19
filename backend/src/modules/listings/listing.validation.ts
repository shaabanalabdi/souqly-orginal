import { Condition, ContactVisibility, ListingStatus } from '@prisma/client';
import { z } from 'zod';

const listingImageSchema = z.string().trim().url().max(500);

const listingAttributeSchema = z.object({
    attributeDefinitionId: z.coerce.number().int().positive(),
    value: z.string().trim().min(1).max(2000),
});

const contactVisibilitySchema = z.union([
    z.nativeEnum(ContactVisibility),
    z.boolean().transform((value) => (value ? ContactVisibility.VISIBLE : ContactVisibility.HIDDEN)),
]);

const contactNumberSchema = z.preprocess(
    (value) => {
        if (typeof value !== 'string') {
            return value;
        }

        const normalized = value.trim();
        return normalized.length > 0 ? normalized : undefined;
    },
    z
        .string()
        .min(6)
        .max(30)
        .regex(/^[+0-9()\-\s]+$/)
        .optional(),
);

function validatePriceCurrencyPair<T extends { priceAmount?: number; currency?: string }>(
    value: T,
    ctx: z.RefinementCtx,
): void {
    if (value.priceAmount !== undefined && !value.currency) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['currency'],
            message: 'currency is required when priceAmount is provided.',
        });
    }

    if (value.currency && value.priceAmount === undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['priceAmount'],
            message: 'priceAmount is required when currency is provided.',
        });
    }
}

function validateLocationPair<T extends { locationLat?: number; locationLng?: number }>(
    value: T,
    ctx: z.RefinementCtx,
): void {
    const latProvided = value.locationLat !== undefined;
    const lngProvided = value.locationLng !== undefined;

    if (latProvided !== lngProvided) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['locationLat'],
            message: 'locationLat and locationLng must be provided together.',
        });
    }
}

export const createListingBodySchema = z
    .object({
        subcategoryId: z.coerce.number().int().positive(),
        countryId: z.coerce.number().int().positive(),
        cityId: z.coerce.number().int().positive(),
        titleAr: z.string().trim().min(5).max(200),
        titleEn: z.string().trim().min(5).max(200).optional(),
        descriptionAr: z.string().trim().min(20).max(5000),
        descriptionEn: z.string().trim().min(20).max(5000).optional(),
        priceAmount: z.coerce.number().positive().optional(),
        currency: z.string().trim().toUpperCase().min(3).max(5).optional(),
        negotiable: z.boolean().optional().default(true),
        condition: z.nativeEnum(Condition).optional(),
        deliveryAvailable: z.boolean().optional().default(false),
        countryOfOrigin: z.string().trim().max(100).optional(),
        moqText: z.string().trim().max(200).optional(),
        moqMinQty: z.coerce.number().int().positive().optional(),
        moqUnit: z.string().trim().max(50).optional(),
        locationLat: z.coerce.number().min(-90).max(90).optional(),
        locationLng: z.coerce.number().min(-180).max(180).optional(),
        saveAsDraft: z.boolean().optional().default(false),
        phoneNumber: contactNumberSchema,
        whatsappNumber: contactNumberSchema,
        phoneVisibility: contactVisibilitySchema.optional().default(ContactVisibility.APPROVAL),
        whatsappVisibility: contactVisibilitySchema.optional().default(ContactVisibility.APPROVAL),
        images: z.array(listingImageSchema).min(1).max(10),
        attributes: z.array(listingAttributeSchema).optional().default([]),
    })
    .superRefine(validatePriceCurrencyPair)
    .superRefine(validateLocationPair);

export const updateListingBodySchema = z
    .object({
        subcategoryId: z.coerce.number().int().positive().optional(),
        countryId: z.coerce.number().int().positive().optional(),
        cityId: z.coerce.number().int().positive().optional(),
        titleAr: z.string().trim().min(5).max(200).optional(),
        titleEn: z.string().trim().min(5).max(200).optional(),
        descriptionAr: z.string().trim().min(20).max(5000).optional(),
        descriptionEn: z.string().trim().min(20).max(5000).optional(),
        priceAmount: z.coerce.number().positive().optional(),
        currency: z.string().trim().toUpperCase().min(3).max(5).optional(),
        negotiable: z.boolean().optional(),
        condition: z.nativeEnum(Condition).optional(),
        deliveryAvailable: z.boolean().optional(),
        countryOfOrigin: z.string().trim().max(100).optional(),
        moqText: z.string().trim().max(200).optional(),
        moqMinQty: z.coerce.number().int().positive().optional(),
        moqUnit: z.string().trim().max(50).optional(),
        locationLat: z.coerce.number().min(-90).max(90).optional(),
        locationLng: z.coerce.number().min(-180).max(180).optional(),
        phoneNumber: contactNumberSchema,
        whatsappNumber: contactNumberSchema,
        phoneVisibility: contactVisibilitySchema.optional(),
        whatsappVisibility: contactVisibilitySchema.optional(),
        images: z.array(listingImageSchema).min(1).max(10).optional(),
        attributes: z.array(listingAttributeSchema).optional(),
    })
    .superRefine(validatePriceCurrencyPair)
    .superRefine(validateLocationPair);

export const listingIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const featureListingBodySchema = z.object({
    days: z.coerce.number().int().min(1).max(365).optional(),
});

export const nearbyListingsQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
        radiusKm: z.coerce.number().min(1).max(200),
        q: z.string().trim().min(1).max(100).optional(),
        categorySlug: z.string().trim().min(1).max(100).optional(),
        subcategoryId: z.coerce.number().int().positive().optional(),
        countryId: z.coerce.number().int().positive().optional(),
        cityId: z.coerce.number().int().positive().optional(),
        minPrice: z.coerce.number().nonnegative().optional(),
        maxPrice: z.coerce.number().nonnegative().optional(),
        condition: z.nativeEnum(Condition).optional(),
        sort: z.enum(['newest', 'price_asc', 'price_desc', 'featured']).optional(),
        withImages: z.coerce.boolean().optional(),
        featuredOnly: z.coerce.boolean().optional(),
        lang: z.string().optional(),
    })
    .superRefine((value, ctx) => {
        if (
            value.minPrice !== undefined &&
            value.maxPrice !== undefined &&
            value.minPrice > value.maxPrice
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['minPrice'],
                message: 'minPrice cannot be greater than maxPrice.',
            });
        }
    });

export const listListingsQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        q: z.string().trim().min(1).max(100).optional(),
        categorySlug: z.string().trim().min(1).max(100).optional(),
        subcategoryId: z.coerce.number().int().positive().optional(),
        countryId: z.coerce.number().int().positive().optional(),
        cityId: z.coerce.number().int().positive().optional(),
        minPrice: z.coerce.number().nonnegative().optional(),
        maxPrice: z.coerce.number().nonnegative().optional(),
        condition: z.nativeEnum(Condition).optional(),
        sort: z.enum(['newest', 'price_asc', 'price_desc', 'featured']).optional(),
        withImages: z.coerce.boolean().optional(),
        featuredOnly: z.coerce.boolean().optional(),
        lang: z.string().optional(),
    })
    .superRefine((value, ctx) => {
        if (
            value.minPrice !== undefined &&
            value.maxPrice !== undefined &&
            value.minPrice > value.maxPrice
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['minPrice'],
                message: 'minPrice cannot be greater than maxPrice.',
            });
        }
    });

export const listMyListingsQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.nativeEnum(ListingStatus).optional(),
    lang: z.string().optional(),
});

export type CreateListingBody = z.infer<typeof createListingBodySchema>;
export type UpdateListingBody = z.infer<typeof updateListingBodySchema>;
export type ListListingsQuery = z.infer<typeof listListingsQuerySchema>;
export type ListMyListingsQuery = z.infer<typeof listMyListingsQuerySchema>;
export type NearbyListingsQuery = z.infer<typeof nearbyListingsQuerySchema>;
export type FeatureListingBody = z.infer<typeof featureListingBodySchema>;
