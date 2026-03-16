import { AccountType, ListingStatus, Role, StaffRole, TrustTier, type Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { isIndividualNonStaff, isModeratorOrAdmin } from '../../shared/auth/authorization.js';
import { expandDialectSearchTerms } from '../../shared/utils/dialectSearch.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { evaluateListingFraudSignals, recordListingFraudSignals } from './antiFraud.service.js';
import type {
    CreateListingBody,
    ListListingsQuery,
    UpdateListingBody,
} from './listing.validation.js';

interface ActorContext {
    userId: number;
    role: Role;
    staffRole: StaffRole;
    accountType: AccountType;
    trustTier: TrustTier;
}

interface ListingImageDto {
    url: string;
    sortOrder: number;
}

interface ListingSummaryDto {
    id: number;
    title: string;
    description: string;
    priceAmount: number | null;
    currency: string | null;
    negotiable: boolean;
    condition: string | null;
    status: ListingStatus;
    country: { id: number; code: string; name: string };
    city: { id: number; name: string };
    subcategory: { id: number; slug: string; name: string };
    coverImage: string | null;
    featuredUntil: string | null;
    isFeatured: boolean;
    createdAt: string;
}

interface ListingDetailsDto extends ListingSummaryDto {
    images: ListingImageDto[];
    location: { lat: number | null; lng: number | null };
    contact: { phoneVisible: boolean; whatsappVisible: boolean };
    attributes: Array<{ attributeId: number; name: string; value: string }>;
}

function localizeName(entity: { nameAr: string; nameEn: string }, lang: AppLanguage): string {
    return lang === 'ar' ? entity.nameAr : entity.nameEn;
}

function resolveAutoListingStatus(trustTier: TrustTier): ListingStatus {
    if (trustTier === TrustTier.TRUSTED || trustTier === TrustTier.TOP_SELLER) {
        return ListingStatus.ACTIVE;
    }

    return ListingStatus.PENDING;
}

function buildImageRows(images: string[]): Array<{
    urlOriginal: string;
    urlMedium: string;
    urlThumb: string;
    urlMini: string;
    sortOrder: number;
}> {
    return images.map((url, index) => ({
        urlOriginal: url,
        urlMedium: url,
        urlThumb: url,
        urlMini: url,
        sortOrder: index,
    }));
}

function isCurrentlyFeatured(featuredUntil: Date | null): boolean {
    return Boolean(featuredUntil && featuredUntil.getTime() > Date.now());
}

async function validateCityCountry(countryId: number, cityId: number): Promise<void> {
    const city = await prisma.city.findFirst({
        where: {
            id: cityId,
            countryId,
            isActive: true,
            country: {
                isActive: true,
            },
        },
        select: { id: true },
    });

    if (!city) {
        throw new ApiError(400, 'INVALID_CITY_COUNTRY_PAIR', 'City does not belong to the selected country.');
    }
}

async function validateAttributePayload(
    subcategoryId: number,
    attributes: Array<{ attributeDefinitionId: number; value: string }>,
): Promise<void> {
    const subcategory = await prisma.subcategory.findFirst({
        where: {
            id: subcategoryId,
            isActive: true,
        },
        select: {
            id: true,
            attributes: {
                select: {
                    id: true,
                    isRequired: true,
                },
            },
        },
    });

    if (!subcategory) {
        throw new ApiError(400, 'SUBCATEGORY_NOT_FOUND', 'Invalid or inactive subcategory.');
    }

    const providedIds = attributes.map((item) => item.attributeDefinitionId);
    const uniqueProvidedIds = new Set(providedIds);

    if (uniqueProvidedIds.size !== providedIds.length) {
        throw new ApiError(400, 'DUPLICATE_ATTRIBUTE', 'Duplicate attributes are not allowed.');
    }

    const allowedIds = new Set(subcategory.attributes.map((attribute) => attribute.id));
    const invalidAttribute = attributes.find((item) => !allowedIds.has(item.attributeDefinitionId));
    if (invalidAttribute) {
        throw new ApiError(
            400,
            'INVALID_ATTRIBUTE_DEFINITION',
            `Attribute ${invalidAttribute.attributeDefinitionId} does not belong to this subcategory.`,
        );
    }

    const requiredIds = subcategory.attributes
        .filter((attribute) => attribute.isRequired)
        .map((attribute) => attribute.id);
    const missingRequired = requiredIds.filter((attributeId) => !uniqueProvidedIds.has(attributeId));

    if (missingRequired.length > 0) {
        throw new ApiError(400, 'MISSING_REQUIRED_ATTRIBUTES', 'Missing required attributes.', {
            missingRequired,
        });
    }
}

async function enforceMonthlyListingLimit(userId: number): Promise<void> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await prisma.listing.count({
        where: {
            userId,
            createdAt: {
                gte: startOfMonth,
            },
            status: {
                not: ListingStatus.DELETED,
            },
        },
    });

    if (monthlyCount >= 50) {
        throw new ApiError(
            403,
            'LISTING_MONTHLY_LIMIT_REACHED',
            'Monthly listing limit reached for individual accounts.',
        );
    }
}

function mapListingSummary(
    listing: {
        id: number;
        titleAr: string;
        titleEn: string | null;
        descriptionAr: string;
        descriptionEn: string | null;
        priceAmount: number | null;
        currency: string | null;
        negotiable: boolean;
        condition: string | null;
        status: ListingStatus;
        createdAt: Date;
        country: { id: number; code: string; nameAr: string; nameEn: string };
        city: { id: number; nameAr: string; nameEn: string };
        subcategory: { id: number; slug: string; nameAr: string; nameEn: string };
        featuredUntil: Date | null;
        images: Array<{ urlThumb: string }>;
    },
    lang: AppLanguage,
): ListingSummaryDto {
    return {
        id: listing.id,
        title: lang === 'ar' ? listing.titleAr : listing.titleEn ?? listing.titleAr,
        description: lang === 'ar' ? listing.descriptionAr : listing.descriptionEn ?? listing.descriptionAr,
        priceAmount: listing.priceAmount,
        currency: listing.currency,
        negotiable: listing.negotiable,
        condition: listing.condition,
        status: listing.status,
        country: {
            id: listing.country.id,
            code: listing.country.code,
            name: localizeName(listing.country, lang),
        },
        city: {
            id: listing.city.id,
            name: localizeName(listing.city, lang),
        },
        subcategory: {
            id: listing.subcategory.id,
            slug: listing.subcategory.slug,
            name: localizeName(listing.subcategory, lang),
        },
        coverImage: listing.images[0]?.urlThumb ?? null,
        featuredUntil: listing.featuredUntil?.toISOString() ?? null,
        isFeatured: isCurrentlyFeatured(listing.featuredUntil),
        createdAt: listing.createdAt.toISOString(),
    };
}

function mapListingDetails(
    listing: {
        id: number;
        titleAr: string;
        titleEn: string | null;
        descriptionAr: string;
        descriptionEn: string | null;
        priceAmount: number | null;
        currency: string | null;
        negotiable: boolean;
        condition: string | null;
        status: ListingStatus;
        createdAt: Date;
        locationLat: number | null;
        locationLng: number | null;
        phoneVisibility: boolean;
        whatsappVisibility: boolean;
        country: { id: number; code: string; nameAr: string; nameEn: string };
        city: { id: number; nameAr: string; nameEn: string };
        subcategory: { id: number; slug: string; nameAr: string; nameEn: string };
        featuredUntil: Date | null;
        images: Array<{ urlOriginal: string; sortOrder: number; urlThumb: string }>;
        attributeValues: Array<{
            attributeDefinitionId: number;
            value: string;
            attribute: { nameAr: string; nameEn: string };
        }>;
    },
    lang: AppLanguage,
): ListingDetailsDto {
    const base = mapListingSummary(
        {
            ...listing,
            images: listing.images.map((image) => ({ urlThumb: image.urlThumb })),
        },
        lang,
    );

    return {
        ...base,
        images: listing.images.map((image) => ({
            url: image.urlOriginal,
            sortOrder: image.sortOrder,
        })),
        location: {
            lat: listing.locationLat,
            lng: listing.locationLng,
        },
        contact: {
            phoneVisible: listing.phoneVisibility,
            whatsappVisible: listing.whatsappVisibility,
        },
        attributes: listing.attributeValues.map((item) => ({
            attributeId: item.attributeDefinitionId,
            name: localizeName(item.attribute, lang),
            value: item.value,
        })),
    };
}

const listingSummarySelect = {
    id: true,
    titleAr: true,
    titleEn: true,
    descriptionAr: true,
    descriptionEn: true,
    priceAmount: true,
    currency: true,
    negotiable: true,
    condition: true,
    status: true,
    createdAt: true,
    featuredUntil: true,
    country: {
        select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
        },
    },
    city: {
        select: {
            id: true,
            nameAr: true,
            nameEn: true,
        },
    },
    subcategory: {
        select: {
            id: true,
            slug: true,
            nameAr: true,
            nameEn: true,
        },
    },
    images: {
        select: {
            urlThumb: true,
        },
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
    },
} satisfies Prisma.ListingSelect;

const listingDetailsSelect = {
    id: true,
    titleAr: true,
    titleEn: true,
    descriptionAr: true,
    descriptionEn: true,
    priceAmount: true,
    currency: true,
    negotiable: true,
    condition: true,
    status: true,
    createdAt: true,
    featuredUntil: true,
    locationLat: true,
    locationLng: true,
    phoneVisibility: true,
    whatsappVisibility: true,
    country: {
        select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
        },
    },
    city: {
        select: {
            id: true,
            nameAr: true,
            nameEn: true,
        },
    },
    subcategory: {
        select: {
            id: true,
            slug: true,
            nameAr: true,
            nameEn: true,
        },
    },
    images: {
        select: {
            urlOriginal: true,
            sortOrder: true,
            urlThumb: true,
        },
        orderBy: { sortOrder: 'asc' as const },
    },
    attributeValues: {
        select: {
            attributeDefinitionId: true,
            value: true,
            attribute: {
                select: {
                    nameAr: true,
                    nameEn: true,
                },
            },
        },
    },
} satisfies Prisma.ListingSelect;

export async function createListing(
    actor: ActorContext,
    payload: CreateListingBody,
    lang: AppLanguage,
    options?: { ipAddress?: string | null },
): Promise<ListingDetailsDto> {
    const user = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: {
            id: true,
            role: true,
            accountType: true,
            staffRole: true,
            trustTier: true,
            isActive: true,
            bannedAt: true,
            phone: true,
            createdAt: true,
        },
    });

    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    if (!user.isActive || user.bannedAt) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }

    if (isIndividualNonStaff(user)) {
        await enforceMonthlyListingLimit(user.id);
    }

    await validateCityCountry(payload.countryId, payload.cityId);
    await validateAttributePayload(payload.subcategoryId, payload.attributes);

    const autoStatus = resolveAutoListingStatus(user.trustTier);
    const safeUserCreatedAt = user.createdAt instanceof Date ? user.createdAt : new Date(0);
    const safeUserPhone = typeof user.phone === 'string' ? user.phone : null;
    const fraudEvaluation = await evaluateListingFraudSignals({
        userId: user.id,
        userCreatedAt: safeUserCreatedAt,
        userPhone: safeUserPhone,
        ipAddress: options?.ipAddress,
        subcategoryId: payload.subcategoryId,
        titleAr: payload.titleAr,
        descriptionAr: payload.descriptionAr,
        priceAmount: payload.priceAmount ?? null,
        images: payload.images,
    });

    const initialStatus = fraudEvaluation.requiresManualReview ? ListingStatus.PENDING : autoStatus;

    const listing = await prisma.listing.create({
        data: {
            userId: user.id,
            subcategoryId: payload.subcategoryId,
            countryId: payload.countryId,
            cityId: payload.cityId,
            titleAr: payload.titleAr,
            titleEn: payload.titleEn,
            descriptionAr: payload.descriptionAr,
            descriptionEn: payload.descriptionEn,
            priceAmount: payload.priceAmount,
            currency: payload.currency,
            negotiable: payload.negotiable,
            condition: payload.condition,
            deliveryAvailable: payload.deliveryAvailable,
            countryOfOrigin: payload.countryOfOrigin,
            moqText: payload.moqText,
            moqMinQty: payload.moqMinQty,
            moqUnit: payload.moqUnit,
            locationLat: payload.locationLat,
            locationLng: payload.locationLng,
            phoneVisibility: payload.phoneVisibility,
            whatsappVisibility: payload.whatsappVisibility,
            status: initialStatus,
            images: {
                create: buildImageRows(payload.images),
            },
            attributeValues: {
                create: payload.attributes.map((item) => ({
                    attributeDefinitionId: item.attributeDefinitionId,
                    value: item.value,
                })),
            },
        },
        select: listingDetailsSelect,
    });

    await recordListingFraudSignals({
        listingId: listing.id,
        actorUserId: actor.userId,
        ipAddress: options?.ipAddress,
        evaluation: fraudEvaluation,
    }).catch(() => undefined);

    return mapListingDetails(listing, lang);
}

export async function updateListing(
    listingId: number,
    actor: ActorContext,
    payload: UpdateListingBody,
    lang: AppLanguage,
): Promise<ListingDetailsDto> {
    const existingListing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            userId: true,
            countryId: true,
            cityId: true,
            subcategoryId: true,
            status: true,
        },
    });

    if (!existingListing || existingListing.status === ListingStatus.DELETED) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    const isAdmin = isModeratorOrAdmin(actor);
    const isOwner = existingListing.userId === actor.userId;

    if (!isAdmin && !isOwner) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to modify this listing.');
    }

    const targetCountryId = payload.countryId ?? existingListing.countryId;
    const targetCityId = payload.cityId ?? existingListing.cityId;
    const targetSubcategoryId = payload.subcategoryId ?? existingListing.subcategoryId;

    if (payload.countryId !== undefined || payload.cityId !== undefined) {
        await validateCityCountry(targetCountryId, targetCityId);
    }

    if (payload.attributes !== undefined || payload.subcategoryId !== undefined) {
        await validateAttributePayload(targetSubcategoryId, payload.attributes ?? []);
    }

    const updateData: Prisma.ListingUncheckedUpdateInput = {};
    if (payload.subcategoryId !== undefined) updateData.subcategoryId = payload.subcategoryId;
    if (payload.countryId !== undefined) updateData.countryId = payload.countryId;
    if (payload.cityId !== undefined) updateData.cityId = payload.cityId;
    if (payload.titleAr !== undefined) updateData.titleAr = payload.titleAr;
    if (payload.titleEn !== undefined) updateData.titleEn = payload.titleEn;
    if (payload.descriptionAr !== undefined) updateData.descriptionAr = payload.descriptionAr;
    if (payload.descriptionEn !== undefined) updateData.descriptionEn = payload.descriptionEn;
    if (payload.priceAmount !== undefined) updateData.priceAmount = payload.priceAmount;
    if (payload.currency !== undefined) updateData.currency = payload.currency;
    if (payload.negotiable !== undefined) updateData.negotiable = payload.negotiable;
    if (payload.condition !== undefined) updateData.condition = payload.condition;
    if (payload.deliveryAvailable !== undefined) updateData.deliveryAvailable = payload.deliveryAvailable;
    if (payload.countryOfOrigin !== undefined) updateData.countryOfOrigin = payload.countryOfOrigin;
    if (payload.moqText !== undefined) updateData.moqText = payload.moqText;
    if (payload.moqMinQty !== undefined) updateData.moqMinQty = payload.moqMinQty;
    if (payload.moqUnit !== undefined) updateData.moqUnit = payload.moqUnit;
    if (payload.locationLat !== undefined) updateData.locationLat = payload.locationLat;
    if (payload.locationLng !== undefined) updateData.locationLng = payload.locationLng;
    if (payload.phoneVisibility !== undefined) updateData.phoneVisibility = payload.phoneVisibility;
    if (payload.whatsappVisibility !== undefined) updateData.whatsappVisibility = payload.whatsappVisibility;

    if (!isAdmin && isOwner) {
        updateData.status = resolveAutoListingStatus(actor.trustTier);
    }

    const updatedListing = await prisma.$transaction(async (tx) => {
        await tx.listing.update({
            where: { id: listingId },
            data: updateData,
        });

        if (payload.images !== undefined) {
            await tx.listingImage.deleteMany({ where: { listingId } });
            if (payload.images.length > 0) {
                await tx.listingImage.createMany({
                    data: buildImageRows(payload.images).map((image) => ({
                        listingId,
                        ...image,
                    })),
                });
            }
        }

        if (payload.attributes !== undefined) {
            await tx.listingAttributeValue.deleteMany({ where: { listingId } });
            if (payload.attributes.length > 0) {
                await tx.listingAttributeValue.createMany({
                    data: payload.attributes.map((attribute) => ({
                        listingId,
                        attributeDefinitionId: attribute.attributeDefinitionId,
                        value: attribute.value,
                    })),
                });
            }
        }

        const listing = await tx.listing.findUnique({
            where: { id: listingId },
            select: listingDetailsSelect,
        });

        if (!listing) {
            throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
        }

        return listing;
    });

    return mapListingDetails(updatedListing, lang);
}

export async function getListingById(listingId: number, lang: AppLanguage): Promise<ListingDetailsDto> {
    const listing = await prisma.listing.findFirst({
        where: {
            id: listingId,
            status: ListingStatus.ACTIVE,
        },
        select: listingDetailsSelect,
    });

    if (!listing) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    return mapListingDetails(listing, lang);
}

export async function listListings(query: ListListingsQuery, lang: AppLanguage): Promise<{
    items: ListingSummaryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
}> {
    const pagination = parsePagination(query as unknown as Record<string, unknown>);

    const where: Prisma.ListingWhereInput = {
        status: ListingStatus.ACTIVE,
    };

    if (query.q) {
        const searchTerms = expandDialectSearchTerms(query.q);
        where.OR = searchTerms.flatMap((term) => [
            { titleAr: { contains: term } },
            { descriptionAr: { contains: term } },
            { titleEn: { contains: term } },
            { descriptionEn: { contains: term } },
        ]);
    }

    if (query.subcategoryId !== undefined) where.subcategoryId = query.subcategoryId;
    if (query.categorySlug) {
        where.subcategory = {
            category: {
                slug: query.categorySlug,
            },
        };
    }
    if (query.countryId !== undefined) where.countryId = query.countryId;
    if (query.cityId !== undefined) where.cityId = query.cityId;
    if (query.condition !== undefined) where.condition = query.condition;

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
        where.priceAmount = {};
        if (query.minPrice !== undefined) where.priceAmount.gte = query.minPrice;
        if (query.maxPrice !== undefined) where.priceAmount.lte = query.maxPrice;
    }

    if (query.withImages) {
        where.images = { some: {} };
    }

    if (query.featuredOnly) {
        where.featuredUntil = {
            gt: new Date(),
        };
    }

    const orderBy: Prisma.ListingOrderByWithRelationInput[] =
        query.sort === 'price_asc'
            ? [{ featuredUntil: 'desc' }, { priceAmount: 'asc' }, { createdAt: 'desc' }]
            : query.sort === 'price_desc'
                ? [{ featuredUntil: 'desc' }, { priceAmount: 'desc' }, { createdAt: 'desc' }]
                : query.sort === 'featured'
                    ? [{ featuredUntil: 'desc' }, { createdAt: 'desc' }]
                    : [{ featuredUntil: 'desc' }, { createdAt: 'desc' }];

    const [total, listings] = await Promise.all([
        prisma.listing.count({ where }),
        prisma.listing.findMany({
            where,
            orderBy,
            skip: getSkip(pagination),
            take: pagination.limit,
            select: listingSummarySelect,
        }),
    ]);

    return {
        items: listings.map((listing) => mapListingSummary(listing, lang)),
        meta: buildPaginationMeta(total, pagination),
    };
}
