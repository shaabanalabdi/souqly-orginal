import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import {
    countPublicUserActiveListings,
    countPublicUserReviews,
    findPublicUserActiveListings,
    findPublicUserProfileById,
    findPublicUserReviews,
    findUserProfileById,
    getAverageRating,
    updateUserProfile,
    type PublicUserListingRecord,
    type PublicUserProfileRecord,
    type PublicUserReviewRecord,
    type UserProfileRecord,
} from './user.repository.js';
import type { UpdateMyProfileBody } from './user.validation.js';

interface LocalizedGeo {
    id: number;
    name: string;
    code?: string;
}

export interface UserProfileDto {
    id: number;
    email: string | null;
    phone: string | null;
    fullName: string | null;
    username: string | null;
    bio: string | null;
    avatarUrl: string | null;
    accountType: string;
    staffRole: string;
    trustTier: string;
    trustScore: number;
    avgResponseHours: number | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    location: {
        country: LocalizedGeo | null;
        city: LocalizedGeo | null;
    };
    stats: {
        activeListings: number;
        reviewsReceived: number;
        completedDeals: number;
    };
    rating: number | null;
    memberSince: string;
}

export interface PublicUserProfileDto {
    id: number;
    fullName: string | null;
    username: string | null;
    bio: string | null;
    avatarUrl: string | null;
    accountType: string;
    trustTier: string;
    trustScore: number;
    avgResponseHours: number | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    stats: {
        activeListings: number;
        reviewsReceived: number;
        completedDeals: number;
    };
    rating: number | null;
    memberSince: string;
}

export interface PublicUserListingDto {
    id: number;
    title: string;
    description: string;
    priceAmount: number | null;
    currency: string | null;
    status: string;
    coverImage: string | null;
    countryName: string;
    cityName: string;
    createdAt: string;
}

export interface PublicUserReviewDto {
    id: number;
    dealId: number;
    rating: number;
    comment: string | null;
    createdAt: string;
    reviewer: {
        id: number;
        fullName: string | null;
        username: string | null;
        avatarUrl: string | null;
    };
}

function localizeGeo(
    entity: { id: number; nameAr: string; nameEn: string; code?: string } | null | undefined,
    lang: AppLanguage,
): LocalizedGeo | null {
    if (!entity) {
        return null;
    }

    return {
        id: entity.id,
        name: lang === 'ar' ? entity.nameAr : entity.nameEn,
        ...(entity.code ? { code: entity.code } : {}),
    };
}

function mapStats(
    counts: {
        listings: number;
        reviewsReceived: number;
        buyerDeals: number;
        sellerDeals: number;
    },
) {
    return {
        activeListings: counts.listings,
        reviewsReceived: counts.reviewsReceived,
        completedDeals: counts.buyerDeals + counts.sellerDeals,
    };
}

async function mapUserProfile(record: UserProfileRecord, lang: AppLanguage): Promise<UserProfileDto> {
    return {
        id: record.id,
        email: record.email,
        phone: record.phone,
        fullName: record.profile?.fullName ?? null,
        username: record.profile?.username ?? null,
        bio: record.profile?.bio ?? null,
        avatarUrl: record.profile?.avatarUrl ?? null,
        accountType: record.accountType,
        staffRole: record.staffRole,
        trustTier: record.trustTier,
        trustScore: record.trustScore,
        avgResponseHours: record.avgResponseHours ?? null,
        emailVerified: Boolean(record.emailVerifiedAt),
        phoneVerified: Boolean(record.phoneVerifiedAt),
        identityVerified: Boolean(record.identityVerifiedAt),
        location: {
            country: localizeGeo(record.profile?.country ?? null, lang),
            city: localizeGeo(record.profile?.city ?? null, lang),
        },
        stats: mapStats(record._count),
        rating: await getAverageRating(record.id),
        memberSince: record.createdAt.toISOString(),
    };
}

async function mapPublicUserProfile(
    record: PublicUserProfileRecord,
): Promise<PublicUserProfileDto> {
    return {
        id: record.id,
        fullName: record.profile?.fullName ?? null,
        username: record.profile?.username ?? null,
        bio: record.profile?.bio ?? null,
        avatarUrl: record.profile?.avatarUrl ?? null,
        accountType: record.accountType,
        trustTier: record.trustTier,
        trustScore: record.trustScore,
        avgResponseHours: record.avgResponseHours ?? null,
        emailVerified: Boolean(record.emailVerifiedAt),
        phoneVerified: Boolean(record.phoneVerifiedAt),
        identityVerified: Boolean(record.identityVerifiedAt),
        stats: mapStats(record._count),
        rating: await getAverageRating(record.id),
        memberSince: record.createdAt.toISOString(),
    };
}

function mapPublicUserListing(record: PublicUserListingRecord, lang: AppLanguage): PublicUserListingDto {
    return {
        id: record.id,
        title: lang === 'ar' ? record.titleAr : record.titleEn ?? record.titleAr,
        description: lang === 'ar' ? record.descriptionAr : record.descriptionEn ?? record.descriptionAr,
        priceAmount: record.priceAmount,
        currency: record.currency,
        status: record.status,
        coverImage: record.images[0]?.urlThumb ?? null,
        countryName: lang === 'ar' ? record.country.nameAr : record.country.nameEn,
        cityName: lang === 'ar' ? record.city.nameAr : record.city.nameEn,
        createdAt: record.createdAt.toISOString(),
    };
}

function mapPublicUserReview(record: PublicUserReviewRecord): PublicUserReviewDto {
    return {
        id: record.id,
        dealId: record.dealId,
        rating: record.rating,
        comment: record.comment,
        createdAt: record.createdAt.toISOString(),
        reviewer: {
            id: record.reviewer.id,
            fullName: record.reviewer.profile?.fullName ?? null,
            username: record.reviewer.profile?.username ?? null,
            avatarUrl: record.reviewer.profile?.avatarUrl ?? null,
        },
    };
}

export async function getMyUserProfile(userId: number, lang: AppLanguage): Promise<UserProfileDto> {
    const user = await findUserProfileById(userId);
    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    return mapUserProfile(user, lang);
}

export async function updateMyUserProfile(
    userId: number,
    payload: UpdateMyProfileBody,
    lang: AppLanguage,
): Promise<UserProfileDto> {
    try {
        const updated = await updateUserProfile(userId, payload);
        return mapUserProfile(updated, lang);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ApiError(409, 'USERNAME_ALREADY_IN_USE', 'Username is already in use.');
        }

        throw error;
    }
}

export async function getPublicUserProfile(
    userId: number,
): Promise<PublicUserProfileDto> {
    const user = await findPublicUserProfileById(userId);
    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    return mapPublicUserProfile(user);
}

export async function listPublicUserListings(
    userId: number,
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: PublicUserListingDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const user = await findPublicUserProfileById(userId);
    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const pagination = parsePagination(query);
    const [total, listings] = await Promise.all([
        countPublicUserActiveListings(userId),
        findPublicUserActiveListings(userId, getSkip(pagination), pagination.limit),
    ]);

    return {
        items: listings.map((listing) => mapPublicUserListing(listing, lang)),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function listPublicUserReviews(
    userId: number,
    query: Record<string, unknown>,
): Promise<{ items: PublicUserReviewDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const user = await findPublicUserProfileById(userId);
    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const pagination = parsePagination(query);
    const [total, reviews] = await Promise.all([
        countPublicUserReviews(userId),
        findPublicUserReviews(userId, getSkip(pagination), pagination.limit),
    ]);

    return {
        items: reviews.map(mapPublicUserReview),
        meta: buildPaginationMeta(total, pagination),
    };
}
