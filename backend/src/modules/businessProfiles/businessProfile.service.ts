import { AccountType, ListingStatus, StaffRole, type Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { recordUserRoleHistory } from '../../shared/audit/domainHistory.service.js';
import { sanitizeNullableText, sanitizeText } from '../../shared/utils/sanitize.js';
import { sumStoreAnalyticsMetrics } from './businessAnalytics.service.js';
import type { UpsertBusinessProfileBody } from './businessProfile.validation.js';

export interface BusinessProfileDto {
    companyName: string;
    commercialRegister: string | null;
    taxNumber: string | null;
    website: string | null;
    verifiedByAdmin: boolean;
    verifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface UpsertBusinessProfileResult {
    created: boolean;
    verificationReset: boolean;
    profile: BusinessProfileDto;
}

export interface PublicStoreProfileDto {
    userId: number;
    fullName: string | null;
    companyName: string;
    website: string | null;
    verifiedByAdmin: boolean;
    verifiedAt: string | null;
    createdAt: string;
}

export interface StoreListingSummaryDto {
    id: number;
    title: string;
    description: string;
    priceAmount: number | null;
    currency: string | null;
    status: ListingStatus;
    coverImage: string | null;
    createdAt: string;
}

export interface StoreAnalyticsDto {
    storeId: number;
    from: string;
    to: string;
    metrics: {
        activeListings: number;
        totalListings: number;
        listingViews: number;
        profileViews: number;
        chatStarts: number;
        offersReceived: number;
        dealsCreated: number;
    };
}

interface ActorContext {
    userId: number;
    staffRole: StaffRole;
}

function normalizeOptionalValue(value: string | undefined): string | null {
    if (value === undefined) return null;
    return sanitizeNullableText(value);
}

function mapBusinessProfile(profile: {
    companyName: string;
    commercialRegister: string | null;
    taxNumber: string | null;
    website: string | null;
    verifiedByAdmin: boolean;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}): BusinessProfileDto {
    return {
        companyName: profile.companyName,
        commercialRegister: profile.commercialRegister,
        taxNumber: profile.taxNumber,
        website: profile.website,
        verifiedByAdmin: profile.verifiedByAdmin,
        verifiedAt: profile.verifiedAt?.toISOString() ?? null,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
    };
}

export async function getMyBusinessProfile(userId: number): Promise<BusinessProfileDto | null> {
    const profile = await prisma.businessProfile.findUnique({
        where: { userId },
        select: {
            companyName: true,
            commercialRegister: true,
            taxNumber: true,
            website: true,
            verifiedByAdmin: true,
            verifiedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!profile) return null;
    return mapBusinessProfile(profile);
}

export async function upsertMyBusinessProfile(
    userId: number,
    payload: UpsertBusinessProfileBody,
): Promise<UpsertBusinessProfileResult> {
    const normalizedCompanyName = sanitizeText(payload.companyName);
    const normalizedCommercialRegister = normalizeOptionalValue(payload.commercialRegister);
    const normalizedTaxNumber = normalizeOptionalValue(payload.taxNumber);
    const normalizedWebsite = normalizeOptionalValue(payload.website);

    const existing = await prisma.businessProfile.findUnique({
        where: { userId },
        select: {
            id: true,
            companyName: true,
            commercialRegister: true,
            taxNumber: true,
            website: true,
            verifiedByAdmin: true,
            verifiedAt: true,
        },
    });

    if (!existing) {
        const created = await prisma.$transaction(async (tx) => {
            const profile = await tx.businessProfile.create({
                data: {
                    userId,
                    companyName: normalizedCompanyName,
                    commercialRegister: normalizedCommercialRegister,
                    taxNumber: normalizedTaxNumber,
                    website: normalizedWebsite,
                },
                select: {
                    companyName: true,
                    commercialRegister: true,
                    taxNumber: true,
                    website: true,
                    verifiedByAdmin: true,
                    verifiedAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            const currentUser = await tx.user.findUnique({
                where: { id: userId },
                select: { accountType: true, staffRole: true },
            });

            if (currentUser && currentUser.accountType !== AccountType.STORE) {
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        accountType: AccountType.STORE,
                    },
                });

                await recordUserRoleHistory({
                    userId,
                    changedById: userId,
                    oldStaffRole: currentUser.staffRole,
                    newStaffRole: currentUser.staffRole,
                    oldAccountType: currentUser.accountType,
                    newAccountType: AccountType.STORE,
                    reason: 'Business profile created',
                }, tx);
            }

            return profile;
        });

        return {
            created: true,
            verificationReset: false,
            profile: mapBusinessProfile(created),
        };
    }

    const hasCoreChanges =
        existing.companyName !== normalizedCompanyName ||
        (existing.commercialRegister ?? null) !== normalizedCommercialRegister ||
        (existing.taxNumber ?? null) !== normalizedTaxNumber ||
        (existing.website ?? null) !== normalizedWebsite;

    const verificationReset = existing.verifiedByAdmin && hasCoreChanges;

    const updated = await prisma.$transaction(async (tx) => {
        const profile = await tx.businessProfile.update({
            where: { userId },
            data: {
                companyName: normalizedCompanyName,
                commercialRegister: normalizedCommercialRegister,
                taxNumber: normalizedTaxNumber,
                website: normalizedWebsite,
                ...(verificationReset ? { verifiedByAdmin: false, verifiedAt: null } : {}),
            },
            select: {
                companyName: true,
                commercialRegister: true,
                taxNumber: true,
                website: true,
                verifiedByAdmin: true,
                verifiedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        const currentUser = await tx.user.findUnique({
            where: { id: userId },
            select: { accountType: true, staffRole: true },
        });

        if (currentUser && currentUser.accountType !== AccountType.STORE) {
            await tx.user.update({
                where: { id: userId },
                data: {
                    accountType: AccountType.STORE,
                },
            });

            await recordUserRoleHistory({
                userId,
                changedById: userId,
                oldStaffRole: currentUser.staffRole,
                newStaffRole: currentUser.staffRole,
                oldAccountType: currentUser.accountType,
                newAccountType: AccountType.STORE,
                reason: 'Business profile updated',
            }, tx);
        }

        return profile;
    });

    return {
        created: false,
        verificationReset,
        profile: mapBusinessProfile(updated),
    };
}

export async function getPublicStoreProfile(
    storeId: number,
): Promise<PublicStoreProfileDto> {
    const profile = await prisma.businessProfile.findUnique({
        where: { userId: storeId },
        select: {
            userId: true,
            companyName: true,
            website: true,
            verifiedByAdmin: true,
            verifiedAt: true,
            createdAt: true,
            user: {
                select: {
                    accountType: true,
                    profile: {
                        select: {
                            fullName: true,
                        },
                    },
                },
            },
        },
    });

    if (!profile || profile.user.accountType !== AccountType.STORE) {
        throw new ApiError(404, 'STORE_NOT_FOUND', 'Store profile not found.');
    }

    return {
        userId: profile.userId,
        fullName: profile.user.profile?.fullName ?? null,
        companyName: profile.companyName,
        website: profile.website,
        verifiedByAdmin: profile.verifiedByAdmin,
        verifiedAt: profile.verifiedAt?.toISOString() ?? null,
        createdAt: profile.createdAt.toISOString(),
    };
}

export async function listStoreListings(
    storeId: number,
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: StoreListingSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const where: Prisma.ListingWhereInput = {
        userId: storeId,
        status: ListingStatus.ACTIVE,
    };

    const [total, listings] = await Promise.all([
        prisma.listing.count({ where }),
        prisma.listing.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                titleAr: true,
                titleEn: true,
                descriptionAr: true,
                descriptionEn: true,
                priceAmount: true,
                currency: true,
                status: true,
                createdAt: true,
                images: {
                    select: {
                        urlThumb: true,
                    },
                    orderBy: {
                        sortOrder: 'asc',
                    },
                    take: 1,
                },
            },
        }),
    ]);

    return {
        items: listings.map((listing) => ({
            id: listing.id,
            title: lang === 'ar' ? listing.titleAr : listing.titleEn ?? listing.titleAr,
            description: lang === 'ar' ? listing.descriptionAr : listing.descriptionEn ?? listing.descriptionAr,
            priceAmount: listing.priceAmount,
            currency: listing.currency,
            status: listing.status,
            coverImage: listing.images[0]?.urlThumb ?? null,
            createdAt: listing.createdAt.toISOString(),
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function getStoreAnalytics(
    storeId: number,
    actor: ActorContext,
    query: { from?: string; to?: string },
): Promise<StoreAnalyticsDto> {
    const isOwner = actor.userId === storeId;
    const isStaff = actor.staffRole === StaffRole.ADMIN || actor.staffRole === StaffRole.MODERATOR;
    if (!isOwner && !isStaff) {
        throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to view this store analytics.');
    }

    const fromDate = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = query.to ? new Date(query.to) : new Date();
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
        throw new ApiError(400, 'INVALID_DATE_RANGE', 'Invalid analytics date range.');
    }

    const [activeListings, totalListings, aggregated] = await Promise.all([
        prisma.listing.count({ where: { userId: storeId, status: ListingStatus.ACTIVE } }),
        prisma.listing.count({ where: { userId: storeId, status: { not: ListingStatus.ARCHIVED } } }),
        sumStoreAnalyticsMetrics(storeId, fromDate, toDate),
    ]);

    return {
        storeId,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        metrics: {
            activeListings,
            totalListings,
            listingViews: aggregated._sum.listingViews ?? 0,
            profileViews: aggregated._sum.profileViews ?? 0,
            chatStarts: aggregated._sum.chatStarts ?? 0,
            offersReceived: aggregated._sum.offersReceived ?? 0,
            dealsCreated: aggregated._sum.dealsCreated ?? 0,
        },
    };
}
