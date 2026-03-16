import { IdentityVerificationStatus } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { IdentityVerificationRequestBody } from './verification.validation.js';

interface IdentityVerificationRequestDto {
    id: number;
    userId: number;
    status: IdentityVerificationStatus;
    documentType: string;
    documentNumberMasked: string | null;
    documentFrontUrl: string | null;
    documentBackUrl: string | null;
    selfieUrl: string | null;
    note: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    reviewerId: number | null;
    reviewerNote: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface MyIdentityVerificationResult {
    status: IdentityVerificationStatus;
    verifiedAt: string | null;
    canSubmit: boolean;
    currentRequest: IdentityVerificationRequestDto | null;
}

export interface SubmitIdentityVerificationResult {
    status: IdentityVerificationStatus;
    request: IdentityVerificationRequestDto;
}

function assertActiveUser(user: { isActive: boolean; bannedAt: Date | null }): void {
    if (!user.isActive || user.bannedAt) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }
}

function mapRequestToDto(request: {
    id: number;
    userId: number;
    status: IdentityVerificationStatus;
    documentType: string;
    documentNumberMasked: string | null;
    documentFrontUrl: string | null;
    documentBackUrl: string | null;
    selfieUrl: string | null;
    note: string | null;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewerId: number | null;
    reviewerNote: string | null;
    createdAt: Date;
    updatedAt: Date;
}): IdentityVerificationRequestDto {
    return {
        id: request.id,
        userId: request.userId,
        status: request.status,
        documentType: request.documentType,
        documentNumberMasked: request.documentNumberMasked,
        documentFrontUrl: request.documentFrontUrl,
        documentBackUrl: request.documentBackUrl,
        selfieUrl: request.selfieUrl,
        note: request.note,
        submittedAt: request.submittedAt.toISOString(),
        reviewedAt: request.reviewedAt?.toISOString() ?? null,
        reviewerId: request.reviewerId ?? null,
        reviewerNote: request.reviewerNote ?? null,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
    };
}

export async function getMyIdentityVerification(userId: number): Promise<MyIdentityVerificationResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            isActive: true,
            bannedAt: true,
            identityVerificationStatus: true,
            identityVerifiedAt: true,
        },
    });

    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }
    assertActiveUser(user);

    const latestRequest = await prisma.identityVerificationRequest.findFirst({
        where: { userId: user.id },
        orderBy: { submittedAt: 'desc' },
        select: {
            id: true,
            userId: true,
            status: true,
            documentType: true,
            documentNumberMasked: true,
            documentFrontUrl: true,
            documentBackUrl: true,
            selfieUrl: true,
            note: true,
            submittedAt: true,
            reviewedAt: true,
            reviewerId: true,
            reviewerNote: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return {
        status: user.identityVerificationStatus,
        verifiedAt: user.identityVerifiedAt?.toISOString() ?? null,
        canSubmit:
            user.identityVerificationStatus !== IdentityVerificationStatus.PENDING
            && user.identityVerificationStatus !== IdentityVerificationStatus.VERIFIED,
        currentRequest: latestRequest ? mapRequestToDto(latestRequest) : null,
    };
}

export async function submitIdentityVerification(
    userId: number,
    payload: IdentityVerificationRequestBody,
): Promise<SubmitIdentityVerificationResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            isActive: true,
            bannedAt: true,
            identityVerificationStatus: true,
        },
    });

    if (!user) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }
    assertActiveUser(user);

    if (user.identityVerificationStatus === IdentityVerificationStatus.PENDING) {
        throw new ApiError(409, 'IDENTITY_VERIFICATION_PENDING', 'Identity verification is already pending.');
    }

    if (user.identityVerificationStatus === IdentityVerificationStatus.VERIFIED) {
        throw new ApiError(409, 'IDENTITY_ALREADY_VERIFIED', 'Identity is already verified.');
    }

    const createdRequest = await prisma.identityVerificationRequest.create({
        data: {
            userId: user.id,
            status: IdentityVerificationStatus.PENDING,
            documentType: payload.documentType,
            documentNumberMasked: payload.documentNumberMasked,
            documentFrontUrl: payload.documentFrontUrl,
            documentBackUrl: payload.documentBackUrl,
            selfieUrl: payload.selfieUrl,
            note: payload.note,
            submittedAt: new Date(),
        },
        select: {
            id: true,
            userId: true,
            status: true,
            documentType: true,
            documentNumberMasked: true,
            documentFrontUrl: true,
            documentBackUrl: true,
            selfieUrl: true,
            note: true,
            submittedAt: true,
            reviewedAt: true,
            reviewerId: true,
            reviewerNote: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    await prisma.user.update({
        where: { id: user.id },
        data: {
            identityVerificationStatus: IdentityVerificationStatus.PENDING,
            identityVerifiedAt: null,
        },
    });

    return {
        status: IdentityVerificationStatus.PENDING,
        request: mapRequestToDto(createdRequest),
    };
}
