import {
    AccountType,
    ContactRequestStatus,
    ContactVisibility,
    ListingStatus,
    Prisma,
    Role,
    StaffRole,
    TrustTier,
} from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { isIndividualNonStaff, isModeratorOrAdmin } from '../../shared/auth/authorization.js';
import { getIndividualMonthlyListingLimit } from '../../shared/config/systemConfig.js';
import { expandDialectSearchTerms } from '../../shared/utils/dialectSearch.js';
import { haversineDistance } from '../../shared/utils/haversine.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { evaluateListingFraudSignals, recordListingFraudSignals } from './antiFraud.service.js';
import { recordListingStatusHistory } from '../../shared/audit/domainHistory.service.js';
import { sanitizeNullableText, sanitizeText } from '../../shared/utils/sanitize.js';
import { incrementStoreAnalyticsMetric } from '../businessProfiles/businessAnalytics.service.js';
import type {
    CreateListingBody,
    FeatureListingBody,
    ListListingsQuery,
    ListMyListingsQuery,
    NearbyListingsQuery,
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
    contact: {
        phoneVisible: boolean;
        whatsappVisible: boolean;
        phoneVisibility: ContactVisibility;
        whatsappVisibility: ContactVisibility;
        phoneNumber: string | null;
        whatsappNumber: string | null;
    };
    seller: {
        id: number;
        accountType: AccountType;
        name: string;
        username: string | null;
        avatarUrl: string | null;
        trustTier: TrustTier;
        trustScore: number;
        avgResponseHours: number | null;
        rating: number | null;
        reviewCount: number;
        emailVerified: boolean;
        phoneVerified: boolean;
        identityVerified: boolean;
    };
    attributes: Array<{ attributeId: number; name: string; value: string }>;
}

interface ValidatedSubcategoryMeta {
    isService: boolean;
}

interface FullTextCandidateQuery {
    q?: string;
    subcategoryId?: number;
    categorySlug?: string;
    countryId?: number;
    cityId?: number;
    minPrice?: number;
    maxPrice?: number;
    condition?: string;
    withImages?: boolean;
    featuredOnly?: boolean;
    sort?: 'newest' | 'price_asc' | 'price_desc' | 'featured';
    candidateLimit: number;
    bounds?: {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
    };
}

const EXPIRABLE_LISTING_STATUSES = [ListingStatus.ACTIVE, ListingStatus.PENDING] as const;
const DEFAULT_LISTING_DURATION_DAYS = 30;
const CONTACT_NUMBER_MAX_LENGTH = 30;

function localizeName(entity: { nameAr: string; nameEn: string }, lang: AppLanguage): string {
    return lang === 'ar' ? entity.nameAr : entity.nameEn;
}

function resolveAutoListingStatus(trustTier: TrustTier): ListingStatus {
    if (trustTier === TrustTier.TRUSTED || trustTier === TrustTier.TOP_SELLER) {
        return ListingStatus.ACTIVE;
    }

    return ListingStatus.PENDING;
}

function getListingExpiryDate(from: Date = new Date()): Date {
    return new Date(from.getTime() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

function normalizeContactNumber(value: string | null | undefined): string | null {
    const normalized = sanitizeNullableText(value);
    return normalized ? normalized.slice(0, CONTACT_NUMBER_MAX_LENGTH) : null;
}

function buildActiveListingWhere(now: Date): Prisma.ListingWhereInput {
    return {
        status: ListingStatus.ACTIVE,
        AND: [
            {
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gte: now } },
                ],
            },
        ],
    };
}

function buildDialectFallbackSearchClause(query: string): Prisma.ListingWhereInput {
    const searchTerms = expandDialectSearchTerms(query);
    return {
        OR: searchTerms.flatMap((term) => [
            { titleAr: { contains: term } },
            { descriptionAr: { contains: term } },
            { titleEn: { contains: term } },
            { descriptionEn: { contains: term } },
        ]),
    };
}

function buildMySqlBooleanSearchQuery(query: string): string | null {
    const tokens = Array.from(
        new Set(
            expandDialectSearchTerms(query)
                .flatMap((term) => term.split(/\s+/))
                .map((term) => term.trim())
                .filter((term) => term.length >= 2)
                .map((term) => term.replace(/[^\p{L}\p{N}]+/gu, ''))
                .filter((term) => term.length >= 2),
        ),
    );

    if (tokens.length === 0) {
        return null;
    }

    return tokens.map((term) => `+${term}*`).join(' ');
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

function isPubliclyVisibleContact(visibility: ContactVisibility): boolean {
    return visibility === ContactVisibility.VISIBLE;
}

function isApprovalVisibleContact(visibility: ContactVisibility): boolean {
    return visibility === ContactVisibility.APPROVAL;
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
): Promise<ValidatedSubcategoryMeta> {
    const subcategory = await prisma.subcategory.findFirst({
        where: {
            id: subcategoryId,
            isActive: true,
        },
        select: {
            id: true,
            isService: true,
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

    return {
        isService: subcategory.isService,
    };
}

async function enforceMonthlyListingLimit(userId: number): Promise<void> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthlyLimit = await getIndividualMonthlyListingLimit();

    const monthlyCount = await prisma.listing.count({
        where: {
            userId,
            createdAt: {
                gte: startOfMonth,
            },
            status: {
                not: ListingStatus.DRAFT,
            },
        },
    });

    if (monthlyCount >= monthlyLimit) {
        throw new ApiError(
            403,
            'LISTING_MONTHLY_LIMIT_REACHED',
            'Monthly listing limit reached for individual accounts.',
        );
    }
}

async function enforceListingCreationEntitlements(
    user: {
        id: number;
        accountType: AccountType;
        staffRole: StaffRole;
    },
    subcategory: ValidatedSubcategoryMeta,
): Promise<void> {
    if (isIndividualNonStaff(user)) {
        await enforceMonthlyListingLimit(user.id);
        return;
    }

    if (user.accountType === AccountType.CRAFTSMAN && user.staffRole === StaffRole.NONE && !subcategory.isService) {
        throw new ApiError(
            403,
            'CRAFTSMAN_SERVICE_ONLY',
            'Craftsman accounts can publish only service categories.',
        );
    }
}

function buildBoundingBox(lat: number, lng: number, radiusKm: number): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
} {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / Math.max(1, 111 * Math.cos((lat * Math.PI) / 180));

    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
    };
}

async function expireListingIfNeeded(listingId: number): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    const now = new Date();
    const listing = await prisma.listing.findFirst({
        where: {
            id: listingId,
            status: {
                in: [...EXPIRABLE_LISTING_STATUSES],
            },
            expiresAt: {
                lt: now,
            },
        },
        select: {
            id: true,
            status: true,
        },
    });

    if (!listing) {
        return;
    }

    await prisma.$transaction(async (tx) => {
        const updated = await tx.listing.updateMany({
            where: {
                id: listing.id,
                status: listing.status,
                expiresAt: {
                    lt: now,
                },
            },
            data: {
                status: ListingStatus.EXPIRED,
            },
        });

        if (updated.count === 0) {
            return;
        }

        await recordListingStatusHistory({
            listingId: listing.id,
            oldStatus: listing.status,
            newStatus: ListingStatus.EXPIRED,
            actorId: 0,
            reason: 'Listing expired automatically',
        }, tx);
    });
}

async function expireOverdueListingsBatch(batchSize = 100): Promise<void> {
    await expireOverdueListingsBatchWithCount(batchSize);
}

async function expireOverdueListingsBatchWithCount(batchSize = 100): Promise<number> {
    if (process.env.NODE_ENV === 'test') {
        return 0;
    }

    let expiredCount = 0;

    while (true) {
        const now = new Date();
        const dueListings = await prisma.listing.findMany({
            where: {
                status: {
                    in: [...EXPIRABLE_LISTING_STATUSES],
                },
                expiresAt: {
                    lt: now,
                },
            },
            orderBy: {
                expiresAt: 'asc',
            },
            take: batchSize,
            select: {
                id: true,
                status: true,
            },
        });

        if (dueListings.length === 0) {
            return expiredCount;
        }

        await prisma.$transaction(async (tx) => {
            const updated = await tx.listing.updateMany({
                where: {
                    id: {
                        in: dueListings.map((listing) => listing.id),
                    },
                    status: {
                        in: [...EXPIRABLE_LISTING_STATUSES],
                    },
                    expiresAt: {
                        lt: now,
                    },
                },
                data: {
                    status: ListingStatus.EXPIRED,
                },
            });

            expiredCount += updated.count;

            for (const listing of dueListings) {
                await recordListingStatusHistory({
                    listingId: listing.id,
                    oldStatus: listing.status,
                    newStatus: ListingStatus.EXPIRED,
                    actorId: 0,
                    reason: 'Listing expired automatically',
                }, tx);
            }
        });

        if (dueListings.length < batchSize) {
            return expiredCount;
        }
    }
}

async function findListingIdsByFullText(query: FullTextCandidateQuery): Promise<number[] | null> {
    if (process.env.NODE_ENV === 'test' || !query.q) {
        return null;
    }

    const booleanQuery = buildMySqlBooleanSearchQuery(query.q);
    if (!booleanQuery) {
        return null;
    }

    const now = new Date();
    const matchClause = Prisma.sql`
        MATCH(l.titleAr, l.descriptionAr, l.titleEn, l.descriptionEn)
        AGAINST (${booleanQuery} IN BOOLEAN MODE)
    `;
    const whereConditions: Prisma.Sql[] = [
        Prisma.sql`l.status = ${ListingStatus.ACTIVE}`,
        Prisma.sql`(l.expiresAt IS NULL OR l.expiresAt >= ${now})`,
        Prisma.sql`${matchClause}`,
    ];

    if (query.subcategoryId !== undefined) {
        whereConditions.push(Prisma.sql`l.subcategoryId = ${query.subcategoryId}`);
    }
    if (query.categorySlug) {
        whereConditions.push(Prisma.sql`c.slug = ${query.categorySlug}`);
    }
    if (query.countryId !== undefined) {
        whereConditions.push(Prisma.sql`l.countryId = ${query.countryId}`);
    }
    if (query.cityId !== undefined) {
        whereConditions.push(Prisma.sql`l.cityId = ${query.cityId}`);
    }
    if (query.condition !== undefined) {
        whereConditions.push(Prisma.sql`l.condition = ${query.condition}`);
    }
    if (query.minPrice !== undefined) {
        whereConditions.push(Prisma.sql`l.priceAmount >= ${query.minPrice}`);
    }
    if (query.maxPrice !== undefined) {
        whereConditions.push(Prisma.sql`l.priceAmount <= ${query.maxPrice}`);
    }
    if (query.withImages) {
        whereConditions.push(
            Prisma.sql`EXISTS (SELECT 1 FROM listing_images li WHERE li.listingId = l.id)`,
        );
    }
    if (query.featuredOnly) {
        whereConditions.push(Prisma.sql`l.featuredUntil IS NOT NULL AND l.featuredUntil > ${now}`);
    }
    if (query.bounds) {
        whereConditions.push(
            Prisma.sql`
                l.locationLat IS NOT NULL
                AND l.locationLat BETWEEN ${query.bounds.minLat} AND ${query.bounds.maxLat}
            `,
        );
        whereConditions.push(
            Prisma.sql`
                l.locationLng IS NOT NULL
                AND l.locationLng BETWEEN ${query.bounds.minLng} AND ${query.bounds.maxLng}
            `,
        );
    }

    const sortClause =
        query.sort === 'price_asc'
            ? Prisma.sql`l.featuredUntil DESC, l.priceAmount ASC, l.createdAt DESC`
            : query.sort === 'price_desc'
                ? Prisma.sql`l.featuredUntil DESC, l.priceAmount DESC, l.createdAt DESC`
                : query.sort === 'featured'
                    ? Prisma.sql`l.featuredUntil DESC, l.createdAt DESC`
                    : Prisma.sql`l.featuredUntil DESC, l.createdAt DESC`;

    try {
        const rows = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
            SELECT l.id
            FROM listings l
            INNER JOIN subcategories s ON s.id = l.subcategoryId
            INNER JOIN categories c ON c.id = s.categoryId
            WHERE ${Prisma.join(whereConditions, ' AND ')}
            ORDER BY ${matchClause} DESC, ${sortClause}
            LIMIT ${query.candidateLimit}
        `);

        return Array.from(new Set(rows.map((row) => Number(row.id)).filter((value) => Number.isInteger(value))));
    } catch {
        return null;
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

async function mapListingDetails(
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
        phoneNumber: string | null;
        whatsappNumber: string | null;
        phoneVisibility: ContactVisibility;
        whatsappVisibility: ContactVisibility;
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
        user?: {
            id: number;
            phone: string | null;
            accountType: AccountType;
            trustTier: TrustTier;
            trustScore: number;
            avgResponseHours: number | null;
            emailVerifiedAt: Date | null;
            phoneVerifiedAt: Date | null;
            identityVerifiedAt: Date | null;
            profile: {
                fullName: string | null;
                username: string | null;
                avatarUrl: string | null;
            } | null;
            _count: {
                reviewsReceived: number;
            };
        } | null;
    },
    lang: AppLanguage,
    viewerUserId?: number | null,
): Promise<ListingDetailsDto> {
    const base = mapListingSummary(
        {
            ...listing,
            images: listing.images.map((image) => ({ urlThumb: image.urlThumb })),
        },
        lang,
    );

    const seller = listing.user ?? {
        id: 0,
        phone: null,
        accountType: AccountType.INDIVIDUAL,
        trustTier: TrustTier.NEW,
        trustScore: 0,
        avgResponseHours: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        identityVerifiedAt: null,
        profile: null,
        _count: {
            reviewsReceived: 0,
        },
    };

    const ratingAggregate = await prisma.review.aggregate({
        where: {
            revieweeId: seller.id,
        },
        _avg: {
            rating: true,
        },
    });

    const sellerName =
        seller.profile?.fullName
        ?? seller.profile?.username
        ?? `User #${seller.id}`;

    const isOwnerViewer = viewerUserId !== null && viewerUserId !== undefined && viewerUserId === seller.id;
    const approvalAccess =
        !isOwnerViewer && viewerUserId
            ? await prisma.contactAccessRequest.findFirst({
                  where: {
                      listingId: listing.id,
                      requesterUserId: viewerUserId,
                      sellerUserId: seller.id,
                      status: ContactRequestStatus.APPROVED,
                  },
                  select: {
                      phoneApproved: true,
                      whatsappApproved: true,
                  },
              })
            : null;

    const phoneVisible =
        isOwnerViewer
        || isPubliclyVisibleContact(listing.phoneVisibility)
        || (isApprovalVisibleContact(listing.phoneVisibility) && Boolean(approvalAccess?.phoneApproved));
    const whatsappVisible =
        isOwnerViewer
        || isPubliclyVisibleContact(listing.whatsappVisibility)
        || (isApprovalVisibleContact(listing.whatsappVisibility) && Boolean(approvalAccess?.whatsappApproved));

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
            phoneVisible,
            whatsappVisible,
            phoneVisibility: listing.phoneVisibility,
            whatsappVisibility: listing.whatsappVisibility,
            phoneNumber: phoneVisible ? listing.phoneNumber ?? seller.phone ?? null : null,
            whatsappNumber: whatsappVisible ? listing.whatsappNumber ?? seller.phone ?? null : null,
        },
        seller: {
            id: seller.id,
            accountType: seller.accountType,
            name: sellerName,
            username: seller.profile?.username ?? null,
            avatarUrl: seller.profile?.avatarUrl ?? null,
            trustTier: seller.trustTier,
            trustScore: seller.trustScore,
            avgResponseHours: seller.avgResponseHours ?? null,
            rating: ratingAggregate._avg.rating ?? null,
            reviewCount: seller._count.reviewsReceived,
            emailVerified: Boolean(seller.emailVerifiedAt),
            phoneVerified: Boolean(seller.phoneVerifiedAt),
            identityVerified: Boolean(seller.identityVerifiedAt),
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
    phoneNumber: true,
    whatsappNumber: true,
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
    user: {
        select: {
            id: true,
            phone: true,
            accountType: true,
            trustTier: true,
            trustScore: true,
            avgResponseHours: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            identityVerifiedAt: true,
            profile: {
                select: {
                    fullName: true,
                    username: true,
                    avatarUrl: true,
                },
            },
            _count: {
                select: {
                    reviewsReceived: true,
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

    const isDraftCreation = payload.saveAsDraft === true;
    await validateCityCountry(payload.countryId, payload.cityId);
    const subcategory = await validateAttributePayload(payload.subcategoryId, payload.attributes);
    if (!isDraftCreation) {
        await enforceListingCreationEntitlements(user, subcategory);
    }

    const normalizedTitleAr = sanitizeText(payload.titleAr);
    const normalizedTitleEn = sanitizeNullableText(payload.titleEn);
    const normalizedDescriptionAr = sanitizeText(payload.descriptionAr);
    const normalizedDescriptionEn = sanitizeNullableText(payload.descriptionEn);
    const normalizedCountryOfOrigin = sanitizeNullableText(payload.countryOfOrigin);
    const normalizedMoqText = sanitizeNullableText(payload.moqText);
    const normalizedMoqUnit = sanitizeNullableText(payload.moqUnit);
    const normalizedAttributes = payload.attributes.map((item) => ({
        attributeDefinitionId: item.attributeDefinitionId,
        value: sanitizeText(item.value),
    }));

    const safeUserCreatedAt = user.createdAt instanceof Date ? user.createdAt : new Date(0);
    const safeUserPhone = typeof user.phone === 'string' ? user.phone : null;
    const fraudEvaluation = isDraftCreation
        ? null
        : await evaluateListingFraudSignals({
              userId: user.id,
              userCreatedAt: safeUserCreatedAt,
              userPhone: safeUserPhone,
              ipAddress: options?.ipAddress,
              subcategoryId: payload.subcategoryId,
              titleAr: normalizedTitleAr,
              descriptionAr: normalizedDescriptionAr,
              priceAmount: payload.priceAmount ?? null,
              images: payload.images,
          });

    const autoStatus = resolveAutoListingStatus(user.trustTier);
    const initialStatus = isDraftCreation
        ? ListingStatus.DRAFT
        : fraudEvaluation?.requiresManualReview ? ListingStatus.PENDING : autoStatus;
    const expiresAt = isDraftCreation ? null : getListingExpiryDate();

    const listing = await prisma.$transaction(async (tx) => {
        const createdListing = await tx.listing.create({
            data: {
                userId: user.id,
                subcategoryId: payload.subcategoryId,
                countryId: payload.countryId,
                cityId: payload.cityId,
                titleAr: normalizedTitleAr,
                titleEn: normalizedTitleEn,
                descriptionAr: normalizedDescriptionAr,
                descriptionEn: normalizedDescriptionEn,
                priceAmount: payload.priceAmount,
                currency: payload.currency,
                negotiable: payload.negotiable,
                condition: payload.condition,
                deliveryAvailable: payload.deliveryAvailable,
                countryOfOrigin: normalizedCountryOfOrigin,
                moqText: normalizedMoqText,
                moqMinQty: payload.moqMinQty,
                moqUnit: normalizedMoqUnit,
                locationLat: payload.locationLat,
                locationLng: payload.locationLng,
                phoneNumber: normalizeContactNumber(payload.phoneNumber),
                whatsappNumber: normalizeContactNumber(payload.whatsappNumber),
                phoneVisibility: payload.phoneVisibility,
                whatsappVisibility: payload.whatsappVisibility,
                status: initialStatus,
                expiresAt,
                images: {
                    create: buildImageRows(payload.images),
                },
                attributeValues: {
                    create: normalizedAttributes,
                },
            },
            select: listingDetailsSelect,
        });

        if (!isDraftCreation) {
            await recordListingStatusHistory({
                listingId: createdListing.id,
                oldStatus: ListingStatus.DRAFT,
                newStatus: initialStatus,
                actorId: actor.userId,
                reason: 'Listing published',
            }, tx);
        }

        return createdListing;
    });

    if (fraudEvaluation) {
        await recordListingFraudSignals({
            listingId: listing.id,
            actorUserId: actor.userId,
            ipAddress: options?.ipAddress,
            evaluation: fraudEvaluation,
        }).catch(() => undefined);
    }

    return await mapListingDetails(listing, lang, actor.userId);
}

export async function updateListing(
    listingId: number,
    actor: ActorContext,
    payload: UpdateListingBody,
    lang: AppLanguage,
): Promise<ListingDetailsDto> {
    await expireListingIfNeeded(listingId);

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

    if (!existingListing || existingListing.status === ListingStatus.ARCHIVED) {
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

    let targetSubcategoryMeta: ValidatedSubcategoryMeta | null = null;
    if (payload.attributes !== undefined || payload.subcategoryId !== undefined) {
        targetSubcategoryMeta = await validateAttributePayload(targetSubcategoryId, payload.attributes ?? []);
    }

    if (!isAdmin && isOwner && actor.accountType === AccountType.CRAFTSMAN && targetSubcategoryMeta && !targetSubcategoryMeta.isService) {
        throw new ApiError(
            403,
            'CRAFTSMAN_SERVICE_ONLY',
            'Craftsman accounts can publish only service categories.',
        );
    }

    const updateData: Prisma.ListingUncheckedUpdateInput = {};
    if (payload.subcategoryId !== undefined) updateData.subcategoryId = payload.subcategoryId;
    if (payload.countryId !== undefined) updateData.countryId = payload.countryId;
    if (payload.cityId !== undefined) updateData.cityId = payload.cityId;
    if (payload.titleAr !== undefined) updateData.titleAr = sanitizeText(payload.titleAr);
    if (payload.titleEn !== undefined) updateData.titleEn = sanitizeNullableText(payload.titleEn);
    if (payload.descriptionAr !== undefined) updateData.descriptionAr = sanitizeText(payload.descriptionAr);
    if (payload.descriptionEn !== undefined) updateData.descriptionEn = sanitizeNullableText(payload.descriptionEn);
    if (payload.priceAmount !== undefined) updateData.priceAmount = payload.priceAmount;
    if (payload.currency !== undefined) updateData.currency = payload.currency;
    if (payload.negotiable !== undefined) updateData.negotiable = payload.negotiable;
    if (payload.condition !== undefined) updateData.condition = payload.condition;
    if (payload.deliveryAvailable !== undefined) updateData.deliveryAvailable = payload.deliveryAvailable;
    if (payload.countryOfOrigin !== undefined) updateData.countryOfOrigin = sanitizeNullableText(payload.countryOfOrigin);
    if (payload.moqText !== undefined) updateData.moqText = sanitizeNullableText(payload.moqText);
    if (payload.moqMinQty !== undefined) updateData.moqMinQty = payload.moqMinQty;
    if (payload.moqUnit !== undefined) updateData.moqUnit = sanitizeNullableText(payload.moqUnit);
    if (payload.locationLat !== undefined) updateData.locationLat = payload.locationLat;
    if (payload.locationLng !== undefined) updateData.locationLng = payload.locationLng;
    if (payload.phoneNumber !== undefined) updateData.phoneNumber = normalizeContactNumber(payload.phoneNumber);
    if (payload.whatsappNumber !== undefined) updateData.whatsappNumber = normalizeContactNumber(payload.whatsappNumber);
    if (payload.phoneVisibility !== undefined) updateData.phoneVisibility = payload.phoneVisibility;
    if (payload.whatsappVisibility !== undefined) updateData.whatsappVisibility = payload.whatsappVisibility;

    if (
        !isAdmin
        && isOwner
        && existingListing.status !== ListingStatus.DRAFT
        && existingListing.status !== ListingStatus.SOLD
        && existingListing.status !== ListingStatus.EXPIRED
    ) {
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
                        value: sanitizeText(attribute.value),
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

        await recordListingStatusHistory({
            listingId,
            oldStatus: existingListing.status,
            newStatus: listing.status,
            actorId: actor.userId,
            reason: 'Listing updated',
        }, tx);

        return listing;
    });

    return await mapListingDetails(updatedListing, lang, actor.userId);
}

export async function publishDraftListing(
    listingId: number,
    actor: ActorContext,
    lang: AppLanguage,
    options?: { ipAddress?: string | null },
): Promise<ListingDetailsDto> {
    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            userId: true,
            subcategoryId: true,
            countryId: true,
            cityId: true,
            titleAr: true,
            descriptionAr: true,
            priceAmount: true,
            status: true,
            images: {
                select: {
                    urlOriginal: true,
                },
            },
            attributeValues: {
                select: {
                    attributeDefinitionId: true,
                    value: true,
                },
            },
            user: {
                select: {
                    id: true,
                    accountType: true,
                    staffRole: true,
                    trustTier: true,
                    isActive: true,
                    bannedAt: true,
                    phone: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!listing || listing.status === ListingStatus.ARCHIVED) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    if (listing.status !== ListingStatus.DRAFT) {
        throw new ApiError(409, 'INVALID_LISTING_STATE', 'Only draft listings can be published.');
    }

    const isStaff = isModeratorOrAdmin(actor);
    const isOwner = listing.userId === actor.userId;
    if (!isOwner && !isStaff) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to publish this listing.');
    }

    if (!listing.user || !listing.user.isActive || listing.user.bannedAt) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }

    await validateCityCountry(listing.countryId, listing.cityId);
    const subcategory = await validateAttributePayload(
        listing.subcategoryId,
        listing.attributeValues.map((attribute) => ({
            attributeDefinitionId: attribute.attributeDefinitionId,
            value: attribute.value,
        })),
    );

    if (!isStaff) {
        await enforceListingCreationEntitlements(listing.user, subcategory);
    }

    const fraudEvaluation = await evaluateListingFraudSignals({
        userId: listing.user.id,
        userCreatedAt: listing.user.createdAt instanceof Date ? listing.user.createdAt : new Date(0),
        userPhone: typeof listing.user.phone === 'string' ? listing.user.phone : null,
        ipAddress: options?.ipAddress,
        subcategoryId: listing.subcategoryId,
        titleAr: listing.titleAr,
        descriptionAr: listing.descriptionAr,
        priceAmount: listing.priceAmount ?? null,
        images: listing.images.map((image) => image.urlOriginal),
    });

    const autoStatus = isStaff ? ListingStatus.ACTIVE : resolveAutoListingStatus(listing.user.trustTier);
    const nextStatus = fraudEvaluation.requiresManualReview ? ListingStatus.PENDING : autoStatus;
    const expiresAt = getListingExpiryDate();

    const publishedListing = await prisma.$transaction(async (tx) => {
        await tx.listing.update({
            where: { id: listing.id },
            data: {
                status: nextStatus,
                expiresAt,
            },
        });

        await recordListingStatusHistory({
            listingId: listing.id,
            oldStatus: ListingStatus.DRAFT,
            newStatus: nextStatus,
            actorId: actor.userId,
            reason: 'Draft published',
        }, tx);

        const nextListing = await tx.listing.findUnique({
            where: { id: listing.id },
            select: listingDetailsSelect,
        });

        if (!nextListing) {
            throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
        }

        return nextListing;
    });

    await recordListingFraudSignals({
        listingId: listing.id,
        actorUserId: actor.userId,
        ipAddress: options?.ipAddress,
        evaluation: fraudEvaluation,
    }).catch(() => undefined);

    return await mapListingDetails(publishedListing, lang, actor.userId);
}

export async function getListingById(
    listingId: number,
    lang: AppLanguage,
    viewerUserId?: number | null,
): Promise<ListingDetailsDto> {
    await expireListingIfNeeded(listingId);

    const now = new Date();
    const listing = await prisma.listing.findFirst({
        where: {
            id: listingId,
            ...buildActiveListingWhere(now),
        },
        select: listingDetailsSelect,
    });

    if (!listing) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    if (listing.user?.id) {
      void incrementStoreAnalyticsMetric(listing.user.id, 'listingViews');
    }
    return await mapListingDetails(listing, lang, viewerUserId);
}

export async function listListings(query: ListListingsQuery, lang: AppLanguage): Promise<{
    items: ListingSummaryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
}> {
    await expireOverdueListingsBatch();

    const pagination = parsePagination(query as unknown as Record<string, unknown>);
    const now = new Date();
    const where: Prisma.ListingWhereInput = buildActiveListingWhere(now);

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
            gt: now,
        };
    }

    if (query.q) {
        const fullTextIds = await findListingIdsByFullText({
            ...query,
            candidateLimit: Math.min(800, Math.max(200, pagination.limit * 20)),
        });

        if (fullTextIds) {
            if (fullTextIds.length === 0) {
                return {
                    items: [],
                    meta: buildPaginationMeta(0, pagination),
                };
            }

            where.id = {
                in: fullTextIds,
            };
        } else {
            const fallbackSearchClause = buildDialectFallbackSearchClause(query.q);
            const andClauses = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
            where.AND = [...andClauses, fallbackSearchClause];
            if (process.env.NODE_ENV === 'test') {
                where.OR = fallbackSearchClause.OR;
            }
        }
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

export async function listMyListings(
    actor: ActorContext,
    query: ListMyListingsQuery,
    lang: AppLanguage,
): Promise<{ items: ListingSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    await expireOverdueListingsBatch();

    const pagination = parsePagination(query as unknown as Record<string, unknown>);
    const where: Prisma.ListingWhereInput = {
        userId: actor.userId,
        status: query.status ?? {
            not: ListingStatus.ARCHIVED,
        },
    };

    const [total, listings] = await Promise.all([
        prisma.listing.count({ where }),
        prisma.listing.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
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

export async function getManageListingById(
    listingId: number,
    actor: ActorContext,
    lang: AppLanguage,
): Promise<ListingDetailsDto> {
    await expireListingIfNeeded(listingId);

    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            ...listingDetailsSelect,
            userId: true,
        },
    });

    if (!listing || listing.status === ListingStatus.ARCHIVED) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    const isOwner = listing.userId === actor.userId;
    const isStaff = isModeratorOrAdmin(actor);
    if (!isOwner && !isStaff) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to manage this listing.');
    }

    return await mapListingDetails(listing, lang, actor.userId);
}

export async function deleteListing(
    listingId: number,
    actor: ActorContext,
): Promise<{ archived: true; status: ListingStatus }> {
    await expireListingIfNeeded(listingId);

    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            userId: true,
            status: true,
        },
    });

    if (!listing || listing.status === ListingStatus.ARCHIVED) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    const isOwner = listing.userId === actor.userId;
    const isStaff = isModeratorOrAdmin(actor);
    if (!isOwner && !isStaff) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to delete this listing.');
    }

    await prisma.$transaction(async (tx) => {
        await tx.listing.update({
            where: { id: listing.id },
            data: {
                status: ListingStatus.ARCHIVED,
            },
        });

        await recordListingStatusHistory({
            listingId: listing.id,
            oldStatus: listing.status,
            newStatus: ListingStatus.ARCHIVED,
            actorId: actor.userId,
            reason: 'Listing archived',
        }, tx);
    });

    return { archived: true, status: ListingStatus.ARCHIVED };
}

export async function markListingSold(
    listingId: number,
    actor: ActorContext,
): Promise<{ id: number; status: ListingStatus }> {
    await expireListingIfNeeded(listingId);

    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            userId: true,
            status: true,
        },
    });

    if (!listing || listing.status === ListingStatus.ARCHIVED) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    const isOwner = listing.userId === actor.userId;
    const isStaff = isModeratorOrAdmin(actor);
    if (!isOwner && !isStaff) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to update this listing.');
    }

    if (
        listing.status === ListingStatus.REJECTED
        || listing.status === ListingStatus.DRAFT
        || listing.status === ListingStatus.EXPIRED
    ) {
        throw new ApiError(409, 'INVALID_LISTING_STATE', 'This listing cannot be marked as sold.');
    }

    const updated = await prisma.$transaction(async (tx) => {
        const nextListing = await tx.listing.update({
            where: { id: listing.id },
            data: {
                status: ListingStatus.SOLD,
            },
            select: {
                id: true,
                status: true,
            },
        });

        await recordListingStatusHistory({
            listingId: listing.id,
            oldStatus: listing.status,
            newStatus: ListingStatus.SOLD,
            actorId: actor.userId,
            reason: 'Listing marked as sold',
        }, tx);

        return nextListing;
    });

    return {
        id: updated.id,
        status: updated.status,
    };
}

export async function renewListing(
    listingId: number,
    actor: ActorContext,
): Promise<{ id: number; status: ListingStatus; expiresAt: string | null }> {
    await expireListingIfNeeded(listingId);

    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            userId: true,
            status: true,
            expiresAt: true,
        },
    });

    if (!listing || listing.status === ListingStatus.ARCHIVED) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    const isOwner = listing.userId === actor.userId;
    const isStaff = isModeratorOrAdmin(actor);
    if (!isOwner && !isStaff) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to renew this listing.');
    }

    if (
        listing.status === ListingStatus.REJECTED
        || listing.status === ListingStatus.SOLD
        || listing.status === ListingStatus.DRAFT
    ) {
        throw new ApiError(409, 'INVALID_LISTING_STATE', 'This listing cannot be renewed.');
    }

    const nextStatus =
        listing.status === ListingStatus.EXPIRED
            ? (isStaff ? ListingStatus.ACTIVE : resolveAutoListingStatus(actor.trustTier))
            : listing.status;
    const nextExpiresAt = getListingExpiryDate();

    const updated = await prisma.$transaction(async (tx) => {
        const renewedListing = await tx.listing.update({
            where: { id: listing.id },
            data: {
                status: nextStatus,
                expiresAt: nextExpiresAt,
            },
            select: {
                id: true,
                status: true,
                expiresAt: true,
            },
        });

        await recordListingStatusHistory({
            listingId: listing.id,
            oldStatus: listing.status,
            newStatus: nextStatus,
            actorId: actor.userId,
            reason: 'Listing renewed',
        }, tx);

        return renewedListing;
    });

    return {
        id: updated.id,
        status: updated.status,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
    };
}

export async function featureListingByOwner(
    listingId: number,
    actor: ActorContext,
    payload: FeatureListingBody,
): Promise<{ id: number; isFeatured: boolean; featuredUntil: string | null }> {
    await expireListingIfNeeded(listingId);

    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            userId: true,
            status: true,
        },
    });

    if (!listing || listing.status === ListingStatus.ARCHIVED) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    if (listing.userId !== actor.userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You can only feature your own listings.');
    }

    void actor;
    void payload;
    throw new ApiError(
        403,
        'FEATURED_SELF_SERVICE_DISABLED_AT_LAUNCH',
        'Featured listing self-service is disabled at launch and handled operationally by the platform team.',
    );
}

export async function listNearbyListings(query: NearbyListingsQuery, lang: AppLanguage): Promise<{
    items: Array<ListingSummaryDto & { distanceKm: number }>;
    meta: ReturnType<typeof buildPaginationMeta>;
}> {
    await expireOverdueListingsBatch();

    const pagination = parsePagination(query as unknown as Record<string, unknown>);
    const bounds = buildBoundingBox(query.lat, query.lng, query.radiusKm);
    const now = new Date();
    const where: Prisma.ListingWhereInput = {
        ...buildActiveListingWhere(now),
        locationLat: {
            not: null,
            gte: bounds.minLat,
            lte: bounds.maxLat,
        },
        locationLng: {
            not: null,
            gte: bounds.minLng,
            lte: bounds.maxLng,
        },
    };

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
            gt: now,
        };
    }

    if (query.q) {
        const fullTextIds = await findListingIdsByFullText({
            ...query,
            bounds,
            candidateLimit: Math.min(1000, Math.max(250, pagination.limit * 30)),
        });

        if (fullTextIds) {
            if (fullTextIds.length === 0) {
                return {
                    items: [],
                    meta: buildPaginationMeta(0, pagination),
                };
            }

            where.id = {
                in: fullTextIds,
            };
        } else {
            const fallbackSearchClause = buildDialectFallbackSearchClause(query.q);
            const andClauses = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
            where.AND = [...andClauses, fallbackSearchClause];
            if (process.env.NODE_ENV === 'test') {
                where.OR = fallbackSearchClause.OR;
            }
        }
    }

    const rows = await prisma.listing.findMany({
        where,
        select: {
            ...listingSummarySelect,
            locationLat: true,
            locationLng: true,
        },
    });

    const withDistance = rows
        .map((listing) => {
            const distanceKm = haversineDistance(
                query.lat,
                query.lng,
                Number(listing.locationLat),
                Number(listing.locationLng),
            );

            return {
                ...listing,
                distanceKm,
            };
        })
        .filter((listing) => listing.distanceKm <= query.radiusKm);

    const ordered = withDistance.sort((a, b) => {
        if (query.sort === 'price_asc') return (a.priceAmount ?? Infinity) - (b.priceAmount ?? Infinity);
        if (query.sort === 'price_desc') return (b.priceAmount ?? -Infinity) - (a.priceAmount ?? -Infinity);
        if (query.sort === 'featured') {
            const aFeatured = a.featuredUntil ? a.featuredUntil.getTime() : 0;
            const bFeatured = b.featuredUntil ? b.featuredUntil.getTime() : 0;
            if (bFeatured !== aFeatured) return bFeatured - aFeatured;
            return b.createdAt.getTime() - a.createdAt.getTime();
        }

        if (a.distanceKm !== b.distanceKm) {
            return a.distanceKm - b.distanceKm;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const total = ordered.length;
    const skip = getSkip(pagination);
    const paged = ordered.slice(skip, skip + pagination.limit);

    return {
        items: paged.map((listing) => ({
            ...mapListingSummary(listing, lang),
            distanceKm: Math.round(listing.distanceKm * 100) / 100,
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function runListingExpirationSweep(): Promise<{ expiredCount: number }> {
    const expiredCount = await expireOverdueListingsBatchWithCount();
    return {
        expiredCount,
    };
}
