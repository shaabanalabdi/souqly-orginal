import { AccountType } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma.js';
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

function normalizeOptionalValue(value: string | undefined): string | null {
    if (value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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
    const normalizedCompanyName = payload.companyName.trim();
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
        const created = await prisma.businessProfile.create({
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

        await prisma.user.update({
            where: { id: userId },
            data: {
                accountType: AccountType.STORE,
            },
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

    const updated = await prisma.businessProfile.update({
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

    await prisma.user.update({
        where: { id: userId },
        data: {
            accountType: AccountType.STORE,
        },
    });

    return {
        created: false,
        verificationReset,
        profile: mapBusinessProfile(updated),
    };
}
