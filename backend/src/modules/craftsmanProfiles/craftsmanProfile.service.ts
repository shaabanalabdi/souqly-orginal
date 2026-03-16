import { AccountType } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma.js';
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

function normalizeOptionalString(value: string | undefined): string | null {
    if (value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(values: string[] | undefined): string[] {
    if (!values) return [];
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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
    const normalizedProfession = payload.profession.trim();
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
        const created = await prisma.craftsmanProfile.create({
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

        await prisma.user.update({
            where: { id: userId },
            data: {
                accountType: AccountType.CRAFTSMAN,
            },
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

    const updated = await prisma.craftsmanProfile.update({
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

    await prisma.user.update({
        where: { id: userId },
        data: {
            accountType: AccountType.CRAFTSMAN,
        },
    });

    return {
        created: false,
        verificationReset,
        profile: mapCraftsmanProfile(updated),
    };
}
