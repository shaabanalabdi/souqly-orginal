import { ListingStatus, Prisma } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma.js';
import type { UpdateMyProfileBody } from './user.validation.js';

export const userProfileSelect = {
    id: true,
    email: true,
    phone: true,
    trustTier: true,
    trustScore: true,
    accountType: true,
    staffRole: true,
    avgResponseHours: true,
    emailVerifiedAt: true,
    phoneVerifiedAt: true,
    identityVerificationStatus: true,
    identityVerifiedAt: true,
    createdAt: true,
    profile: {
        select: {
            fullName: true,
            username: true,
            bio: true,
            avatarUrl: true,
            countryId: true,
            cityId: true,
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
        },
    },
    _count: {
        select: {
            listings: {
                where: {
                    status: ListingStatus.ACTIVE,
                },
            },
            reviewsReceived: true,
            buyerDeals: {
                where: {
                    status: {
                        in: ['COMPLETED', 'RATED'],
                    },
                },
            },
            sellerDeals: {
                where: {
                    status: {
                        in: ['COMPLETED', 'RATED'],
                    },
                },
            },
        },
    },
} satisfies Prisma.UserSelect;

export type UserProfileRecord = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;

const publicUserProfileSelect = {
    id: true,
    trustTier: true,
    trustScore: true,
    accountType: true,
    avgResponseHours: true,
    createdAt: true,
    emailVerifiedAt: true,
    phoneVerifiedAt: true,
    identityVerificationStatus: true,
    identityVerifiedAt: true,
    profile: {
        select: {
            fullName: true,
            username: true,
            bio: true,
            avatarUrl: true,
        },
    },
    _count: {
        select: {
            listings: {
                where: {
                    status: ListingStatus.ACTIVE,
                },
            },
            reviewsReceived: true,
            buyerDeals: {
                where: {
                    status: {
                        in: ['COMPLETED', 'RATED'],
                    },
                },
            },
            sellerDeals: {
                where: {
                    status: {
                        in: ['COMPLETED', 'RATED'],
                    },
                },
            },
        },
    },
} satisfies Prisma.UserSelect;

export type PublicUserProfileRecord = Prisma.UserGetPayload<{ select: typeof publicUserProfileSelect }>;

const publicUserListingSelect = {
    id: true,
    titleAr: true,
    titleEn: true,
    descriptionAr: true,
    descriptionEn: true,
    priceAmount: true,
    currency: true,
    status: true,
    createdAt: true,
    country: {
        select: {
            nameAr: true,
            nameEn: true,
        },
    },
    city: {
        select: {
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

export type PublicUserListingRecord = Prisma.ListingGetPayload<{ select: typeof publicUserListingSelect }>;

const publicUserReviewSelect = {
    id: true,
    dealId: true,
    rating: true,
    comment: true,
    createdAt: true,
    reviewer: {
        select: {
            id: true,
            profile: {
                select: {
                    fullName: true,
                    username: true,
                    avatarUrl: true,
                },
            },
        },
    },
} satisfies Prisma.ReviewSelect;

export type PublicUserReviewRecord = Prisma.ReviewGetPayload<{ select: typeof publicUserReviewSelect }>;

export async function findUserProfileById(userId: number): Promise<UserProfileRecord | null> {
    return prisma.user.findUnique({
        where: { id: userId },
        select: userProfileSelect,
    });
}

export async function findPublicUserProfileById(userId: number): Promise<PublicUserProfileRecord | null> {
    return prisma.user.findFirst({
        where: {
            id: userId,
            isActive: true,
            bannedAt: null,
        },
        select: publicUserProfileSelect,
    });
}

export async function countPublicUserActiveListings(userId: number): Promise<number> {
    return prisma.listing.count({
        where: {
            userId,
            status: ListingStatus.ACTIVE,
            user: {
                isActive: true,
                bannedAt: null,
            },
        },
    });
}

export async function findPublicUserActiveListings(
    userId: number,
    skip: number,
    take: number,
): Promise<PublicUserListingRecord[]> {
    return prisma.listing.findMany({
        where: {
            userId,
            status: ListingStatus.ACTIVE,
            user: {
                isActive: true,
                bannedAt: null,
            },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: publicUserListingSelect,
    });
}

export async function countPublicUserReviews(userId: number): Promise<number> {
    return prisma.review.count({
        where: {
            revieweeId: userId,
            reviewee: {
                isActive: true,
                bannedAt: null,
            },
        },
    });
}

export async function findPublicUserReviews(
    userId: number,
    skip: number,
    take: number,
): Promise<PublicUserReviewRecord[]> {
    return prisma.review.findMany({
        where: {
            revieweeId: userId,
            reviewee: {
                isActive: true,
                bannedAt: null,
            },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: publicUserReviewSelect,
    });
}

export async function updateUserProfile(
    userId: number,
    payload: UpdateMyProfileBody,
): Promise<UserProfileRecord> {
    const profileData: Prisma.ProfileUncheckedUpdateInput = {};
    if (payload.fullName !== undefined) profileData.fullName = payload.fullName;
    if (payload.username !== undefined) profileData.username = payload.username;
    if (payload.bio !== undefined) profileData.bio = payload.bio;
    if (payload.avatarUrl !== undefined) profileData.avatarUrl = payload.avatarUrl;
    if (payload.countryId !== undefined) profileData.countryId = payload.countryId;
    if (payload.cityId !== undefined) profileData.cityId = payload.cityId;

    await prisma.user.update({
        where: { id: userId },
        data: {
            profile: {
                upsert: {
                    create: {
                        fullName: payload.fullName ?? 'Souqly User',
                        username: payload.username ?? null,
                        bio: payload.bio ?? null,
                        avatarUrl: payload.avatarUrl ?? null,
                        countryId: payload.countryId ?? null,
                        cityId: payload.cityId ?? null,
                    },
                    update: profileData,
                },
            },
        },
    });

    const updated = await findUserProfileById(userId);
    if (!updated) {
        throw new Error('Updated user profile could not be reloaded.');
    }

    return updated;
}

export async function getAverageRating(userId: number): Promise<number | null> {
    const aggregate = await prisma.review.aggregate({
        where: {
            revieweeId: userId,
        },
        _avg: {
            rating: true,
        },
    });

    return aggregate._avg.rating ?? null;
}
