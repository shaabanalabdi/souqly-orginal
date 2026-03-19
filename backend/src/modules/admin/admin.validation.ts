import { AccountType, DisputeStatus, IdentityVerificationStatus, ListingStatus, ReportStatus, StaffRole } from '@prisma/client';
import { z } from 'zod';

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.string().optional(),
    accountType: z.nativeEnum(AccountType).optional(),
    staffRole: z.nativeEnum(StaffRole).optional(),
    active: z.coerce.boolean().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    lang: z.string().optional(),
});

export const auditLogQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    adminId: z.coerce.number().int().positive().optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    action: z.string().trim().min(1).max(200).optional(),
});

export const idParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const blacklistIdParamsSchema = z.object({
    id: z.string().trim().min(1).max(64),
});

export const moderateListingBodySchema = z.object({
    action: z.enum(['approve', 'reject', 'suspend', 'delete']),
    reason: z.string().trim().max(500).optional(),
});

export const resolveReportBodySchema = z.object({
    action: z.enum(['dismiss', 'resolve', 'delete_listing', 'ban_user']),
    resolution: z.string().trim().max(2000).optional(),
});

export const moderateUserBodySchema = z
    .object({
        action: z.enum(['activate', 'deactivate', 'ban', 'unban', 'set_staff_role', 'set_account_type']),
        staffRole: z.nativeEnum(StaffRole).optional(),
        accountType: z.nativeEnum(AccountType).optional(),
        reason: z.string().trim().max(500).optional(),
    })
    .superRefine((value, ctx) => {
        if (value.action === 'set_staff_role' && !value.staffRole) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['staffRole'],
                message: 'staffRole is required when action is set_staff_role.',
            });
        }

        if (value.action === 'set_account_type' && !value.accountType) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['accountType'],
                message: 'accountType is required when action is set_account_type.',
            });
        }
    });

export const listFraudFlagsQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    listingId: z.coerce.number().int().positive().optional(),
});

export const listDisputesQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.nativeEnum(DisputeStatus).optional(),
    dealId: z.coerce.number().int().positive().optional(),
    openedByUserId: z.coerce.number().int().positive().optional(),
    lang: z.string().optional(),
});

export const listIdentityVerificationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.nativeEnum(IdentityVerificationStatus).optional(),
    userId: z.coerce.number().int().positive().optional(),
});

export const resolveIdentityVerificationBodySchema = z.object({
    action: z.enum(['approve', 'reject']),
    reviewerNote: z.string().trim().max(2000).optional(),
});

export const listBlacklistQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    type: z.enum(['phone', 'ip', 'keyword']).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    active: z.coerce.boolean().optional(),
});

export const createBlacklistBodySchema = z.object({
    type: z.enum(['phone', 'ip', 'keyword']),
    value: z.string().trim().min(2).max(255),
    reason: z.string().trim().max(500).optional(),
});

export const updateBlacklistBodySchema = z.object({
    reason: z.string().trim().max(500).optional(),
    isActive: z.boolean().optional(),
});

export const featureListingBodySchema = z
    .object({
        days: z.coerce.number().int().min(1).max(365).optional(),
        clear: z.coerce.boolean().optional().default(false),
    })
    .superRefine((value, ctx) => {
        if (!value.clear && value.days === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['days'],
                message: 'days is required when clear is false.',
            });
        }
    });

export const runSavedSearchDigestBodySchema = z.object({
    frequency: z.enum(['daily', 'weekly', 'both']).optional().default('both'),
});

export const updateAdminConfigBodySchema = z.object({
    config: z.record(z.string(), z.unknown()),
    replace: z.coerce.boolean().optional().default(false),
    changeNote: z.string().trim().max(2000).optional(),
});

export const savedSearchDigestHistoryQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    frequency: z.enum(['daily', 'weekly']).optional(),
    source: z.enum(['scheduler', 'manual']).optional(),
    sort: z.enum(['completed_desc', 'completed_asc', 'duration_desc', 'duration_asc']).optional(),
    minDurationMs: z.coerce.number().int().nonnegative().optional(),
    maxDurationMs: z.coerce.number().int().nonnegative().optional(),
    from: z.string().trim().min(10).max(64).optional(),
    to: z.string().trim().min(10).max(64).optional(),
}).superRefine((value, ctx) => {
    if (
        value.minDurationMs !== undefined
        && value.maxDurationMs !== undefined
        && value.minDurationMs > value.maxDurationMs
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['minDurationMs'],
            message: 'minDurationMs cannot be greater than maxDurationMs.',
        });
    }
});

export function normalizeReportStatus(rawStatus: string | undefined): ReportStatus | undefined {
    if (!rawStatus) {
        return undefined;
    }

    if (rawStatus === ReportStatus.PENDING) return ReportStatus.PENDING;
    if (rawStatus === ReportStatus.RESOLVED) return ReportStatus.RESOLVED;
    if (rawStatus === ReportStatus.DISMISSED) return ReportStatus.DISMISSED;
    return undefined;
}

export function normalizeDisputeStatus(rawStatus: string | undefined): DisputeStatus | undefined {
    if (!rawStatus) {
        return undefined;
    }

    if (rawStatus === DisputeStatus.OPEN) return DisputeStatus.OPEN;
    if (rawStatus === DisputeStatus.UNDER_REVIEW) return DisputeStatus.UNDER_REVIEW;
    if (rawStatus === DisputeStatus.RESOLVED) return DisputeStatus.RESOLVED;
    return undefined;
}

export function mapListingActionToStatus(action: 'approve' | 'reject' | 'suspend' | 'delete'): ListingStatus {
    if (action === 'approve') return ListingStatus.ACTIVE;
    if (action === 'reject') return ListingStatus.REJECTED;
    if (action === 'suspend') return ListingStatus.EXPIRED;
    return ListingStatus.ARCHIVED;
}
