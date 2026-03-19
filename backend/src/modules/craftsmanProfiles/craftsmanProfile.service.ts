import { AccountType, ListingStatus, type Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { recordUserRoleHistory } from '../../shared/audit/domainHistory.service.js';
import { sanitizeNullableText, sanitizeStringArray, sanitizeText } from '../../shared/utils/sanitize.js';
import { createCraftsmanLead } from './craftsmanLead.service.js';
import type { UpsertCraftsmanProfileBody } from './craftsmanProfile.validation.js';

export interface CraftsmanProfileDto {
    profession: string;
    experienceYears: number | null;
    workingHours: string | null;
    workingAreas: string[];
    portfolio: string[];
    availableNow: boolean;
    verifiedByAdmin: boolean;
    verifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface UpsertCraftsmanProfileResult {
    created: boolean;
    verificationReset: boolean;
    profile: CraftsmanProfileDto;
}

export interface PublicCraftsmanProfileDto extends CraftsmanProfileDto {
    userId: number;
    fullName: string | null;
    phone: string | null;
    whatsappPhone: string | null;
}

export interface CraftsmanListingSummaryDto {
    id: number;
    title: string;
    description: string;
    priceAmount: number | null;
    currency: string | null;
    status: ListingStatus;
    coverImage: string | null;
    createdAt: string;
}

export interface CraftsmanLeadDto {
    id: number;
    fromUserId: number | null;
    source: string;
    message: string | null;
    status: string;
    createdAt: string;
}

function normalizeOptionalString(value: string | undefined): string | null {
    return sanitizeNullableText(value);
}

function normalizeStringArray(values: string[] | undefined): string[] {
    return sanitizeStringArray(values);
}

function parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function arraysEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
}

function mapCraftsmanProfile(profile: {
    profession: string;
    experienceYears: number | null;
    workingHours: string | null;
    workingAreas: unknown;
    portfolio: unknown;
    availableNow: boolean;
    verifiedByAdmin: boolean;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}): CraftsmanProfileDto {
    return {
        profession: profile.profession,
        experienceYears: profile.experienceYears,
        workingHours: profile.workingHours,
        workingAreas: parseStringArray(profile.workingAreas),
        portfolio: parseStringArray(profile.portfolio),
        availableNow: profile.availableNow,
        verifiedByAdmin: profile.verifiedByAdmin,
        verifiedAt: profile.verifiedAt?.toISOString() ?? null,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
    };
}

export async function getMyCraftsmanProfile(userId: number): Promise<CraftsmanProfileDto | null> {
    const profile = await prisma.craftsmanProfile.findUnique({
        where: { userId },
        select: {
            profession: true,
            experienceYears: true,
            workingHours: true,
            workingAreas: true,
            portfolio: true,
            availableNow: true,
            verifiedByAdmin: true,
            verifiedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!profile) return null;
    return mapCraftsmanProfile(profile);
}

export async function upsertMyCraftsmanProfile(
    userId: number,
    payload: UpsertCraftsmanProfileBody,
): Promise<UpsertCraftsmanProfileResult> {
    const normalizedProfession = sanitizeText(payload.profession);
    const normalizedExperienceYears = payload.experienceYears ?? null;
    const normalizedWorkingHours = normalizeOptionalString(payload.workingHours);
    const normalizedWorkingAreas = normalizeStringArray(payload.workingAreas);
    const normalizedPortfolio = normalizeStringArray(payload.portfolio);
    const normalizedAvailableNow = payload.availableNow ?? false;

    const existing = await prisma.craftsmanProfile.findUnique({
        where: { userId },
        select: {
            id: true,
            profession: true,
            experienceYears: true,
            workingHours: true,
            workingAreas: true,
            portfolio: true,
            availableNow: true,
            verifiedByAdmin: true,
            verifiedAt: true,
        },
    });

    if (!existing) {
        const created = await prisma.$transaction(async (tx) => {
            const profile = await tx.craftsmanProfile.create({
                data: {
                    userId,
                    profession: normalizedProfession,
                    experienceYears: normalizedExperienceYears,
                    workingHours: normalizedWorkingHours,
                    workingAreas: normalizedWorkingAreas,
                    portfolio: normalizedPortfolio,
                    availableNow: normalizedAvailableNow,
                },
                select: {
                    profession: true,
                    experienceYears: true,
                    workingHours: true,
                    workingAreas: true,
                    portfolio: true,
                    availableNow: true,
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

            if (currentUser && currentUser.accountType !== AccountType.CRAFTSMAN) {
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        accountType: AccountType.CRAFTSMAN,
                    },
                });

                await recordUserRoleHistory({
                    userId,
                    changedById: userId,
                    oldStaffRole: currentUser.staffRole,
                    newStaffRole: currentUser.staffRole,
                    oldAccountType: currentUser.accountType,
                    newAccountType: AccountType.CRAFTSMAN,
                    reason: 'Craftsman profile created',
                }, tx);
            }

            return profile;
        });

        return {
            created: true,
            verificationReset: false,
            profile: mapCraftsmanProfile(created),
        };
    }

    const existingWorkingAreas = parseStringArray(existing.workingAreas);
    const existingPortfolio = parseStringArray(existing.portfolio);
    const hasCoreChanges =
        existing.profession !== normalizedProfession
        || (existing.experienceYears ?? null) !== normalizedExperienceYears
        || (existing.workingHours ?? null) !== normalizedWorkingHours
        || !arraysEqual(existingWorkingAreas, normalizedWorkingAreas)
        || !arraysEqual(existingPortfolio, normalizedPortfolio)
        || existing.availableNow !== normalizedAvailableNow;

    const verificationReset = existing.verifiedByAdmin && hasCoreChanges;

    const updated = await prisma.$transaction(async (tx) => {
        const profile = await tx.craftsmanProfile.update({
            where: { userId },
            data: {
                profession: normalizedProfession,
                experienceYears: normalizedExperienceYears,
                workingHours: normalizedWorkingHours,
                workingAreas: normalizedWorkingAreas,
                portfolio: normalizedPortfolio,
                availableNow: normalizedAvailableNow,
                ...(verificationReset ? { verifiedByAdmin: false, verifiedAt: null } : {}),
            },
            select: {
                profession: true,
                experienceYears: true,
                workingHours: true,
                workingAreas: true,
                portfolio: true,
                availableNow: true,
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

        if (currentUser && currentUser.accountType !== AccountType.CRAFTSMAN) {
            await tx.user.update({
                where: { id: userId },
                data: {
                    accountType: AccountType.CRAFTSMAN,
                },
            });

            await recordUserRoleHistory({
                userId,
                changedById: userId,
                oldStaffRole: currentUser.staffRole,
                newStaffRole: currentUser.staffRole,
                oldAccountType: currentUser.accountType,
                newAccountType: AccountType.CRAFTSMAN,
                reason: 'Craftsman profile updated',
            }, tx);
        }

        return profile;
    });

    return {
        created: false,
        verificationReset,
        profile: mapCraftsmanProfile(updated),
    };
}

export async function getPublicCraftsmanProfile(craftsmanId: number): Promise<PublicCraftsmanProfileDto> {
    const profile = await prisma.craftsmanProfile.findUnique({
        where: { userId: craftsmanId },
        select: {
            userId: true,
            profession: true,
            experienceYears: true,
            workingHours: true,
            workingAreas: true,
            portfolio: true,
            availableNow: true,
            verifiedByAdmin: true,
            verifiedAt: true,
            createdAt: true,
            updatedAt: true,
            user: {
                select: {
                    accountType: true,
                    phone: true,
                    profile: {
                        select: {
                            fullName: true,
                        },
                    },
                },
            },
        },
    });

    if (!profile || profile.user.accountType !== AccountType.CRAFTSMAN) {
        throw new ApiError(404, 'CRAFTSMAN_NOT_FOUND', 'Craftsman profile not found.');
    }

    return {
        userId: profile.userId,
        fullName: profile.user.profile?.fullName ?? null,
        phone: profile.user.phone ?? null,
        whatsappPhone: profile.user.phone ?? null,
        ...mapCraftsmanProfile(profile),
    };
}

export async function listCraftsmanListings(
    craftsmanId: number,
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: CraftsmanListingSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const where: Prisma.ListingWhereInput = {
        userId: craftsmanId,
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

export async function createPublicCraftsmanLead(
    craftsmanId: number,
    payload: { source: 'chat' | 'phone' | 'whatsapp' | 'direct'; message?: string },
    actorUserId?: number | null,
): Promise<{ tracked: true }> {
    const craftsman = await prisma.user.findUnique({
        where: { id: craftsmanId },
        select: {
            id: true,
            accountType: true,
            isActive: true,
            bannedAt: true,
        },
    });

    if (
        !craftsman
        || craftsman.accountType !== AccountType.CRAFTSMAN
        || !craftsman.isActive
        || craftsman.bannedAt
    ) {
        throw new ApiError(404, 'CRAFTSMAN_NOT_FOUND', 'Craftsman profile not found.');
    }

    await createCraftsmanLead(craftsmanId, {
        fromUserId: actorUserId ?? null,
        source: payload.source,
        message: payload.message,
    });

    return { tracked: true };
}

export async function listMyCraftsmanLeads(
    userId: number,
    query: Record<string, unknown>,
): Promise<{ items: CraftsmanLeadDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);

    const [total, leads] = await Promise.all([
        prisma.craftsmanLead.count({
            where: {
                craftsmanUserId: userId,
            },
        }),
        prisma.craftsmanLead.findMany({
            where: {
                craftsmanUserId: userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                fromUserId: true,
                source: true,
                message: true,
                status: true,
                createdAt: true,
            },
        }),
    ]);

    return {
        items: leads.map((lead) => ({
            id: lead.id,
            fromUserId: lead.fromUserId ?? null,
            source: lead.source,
            message: lead.message,
            status: lead.status,
            createdAt: lead.createdAt.toISOString(),
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}
