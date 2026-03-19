import {
    AccountType,
    DisputeStatus,
    IdentityVerificationStatus,
    ListingStatus,
    ReportStatus,
    Role,
    StaffRole,
    type Prisma,
} from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { clearSystemConfigCache } from '../../shared/config/systemConfig.js';
import {
    isAdmin,
    legacyRoleFromStaffRole,
} from '../../shared/auth/authorization.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';
import {
    createBlacklistEntry,
    deleteBlacklistEntry,
    listBlacklistEntries,
    type BlacklistEntryType,
    updateBlacklistEntry,
} from '../../shared/moderation/blacklist.service.js';
import { mapListingActionToStatus, normalizeDisputeStatus, normalizeReportStatus } from './admin.validation.js';
import { domainEventBus } from '../../events/domainEvents.js';
import { createAuditLog as persistAuditLog } from '../../shared/audit/auditLog.service.js';
import {
    recordListingStatusHistory,
    recordUserRoleHistory,
} from '../../shared/audit/domainHistory.service.js';

interface DashboardDto {
    users: {
        total: number;
        active: number;
        banned: number;
    };
    listings: {
        total: number;
        active: number;
        pending: number;
        rejected: number;
    };
    reports: {
        total: number;
        pending: number;
    };
    deals: {
        total: number;
        completed: number;
    };
}

interface AdminReportDto {
    id: number;
    reporterId: number;
    listingId: number | null;
    reportableType: string;
    reportableId: number;
    reason: string;
    description: string | null;
    status: ReportStatus;
    createdAt: string;
    reporter: {
        email: string | null;
        fullName: string | null;
    };
    listing: {
        id: number;
        title: string;
        status: ListingStatus;
    } | null;
}

interface AdminDisputeDto {
    id: number;
    dealId: number;
    openedByUserId: number;
    reason: string;
    description: string;
    status: DisputeStatus;
    resolvedByAdmin: number | null;
    resolution: string | null;
    createdAt: string;
    resolvedAt: string | null;
    deal: {
        id: number;
        status: string;
        finalPrice: number;
        currency: string;
        buyerId: number;
        sellerId: number;
        listingId: number;
        listingTitle: string;
    };
}

interface ModeratedListingDto {
    id: number;
    userId: number;
    status: ListingStatus;
    updatedAt: string;
}

interface ModeratedUserDto {
    id: number;
    email: string | null;
    role: Role;
    accountType: AccountType;
    staffRole: StaffRole;
    isActive: boolean;
    bannedAt: string | null;
    bannedReason: string | null;
    updatedAt: string;
}

interface AdminUserDto extends ModeratedUserDto {
    trustTier: string;
    trustScore: number;
    fullName: string | null;
    createdAt: string;
}

interface AdminAuditLogDto {
    id: number;
    adminId: number;
    adminEmail: string | null;
    adminName: string | null;
    action: string;
    entityType: string;
    entityId: number;
    oldData: Prisma.JsonValue | null;
    newData: Prisma.JsonValue | null;
    ipAddress: string | null;
    createdAt: string;
}

interface AdminFraudFlagDto {
    auditLogId: number;
    listingId: number;
    listingTitle: string | null;
    actorUserId: number | null;
    actorEmail: string | null;
    riskScore: number;
    signals: Array<{
        code: string;
        severity: string;
        message: string;
        meta?: Record<string, unknown>;
    }>;
    ipAddress: string | null;
    createdAt: string;
}

interface AdminIdentityVerificationDto {
    id: number;
    userId: number;
    status: IdentityVerificationStatus;
    documentType: string;
    documentNumberMasked: string | null;
    note: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    reviewerId: number | null;
    reviewerNote: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
        email: string | null;
        fullName: string | null;
        identityVerificationStatus: IdentityVerificationStatus;
        identityVerifiedAt: string | null;
    };
    reviewer: {
        email: string | null;
        fullName: string | null;
    } | null;
}

interface AdminBlacklistEntryDto {
    id: string;
    type: BlacklistEntryType;
    value: string;
    reason: string | null;
    isActive: boolean;
    createdBy: number;
    updatedBy: number;
    createdAt: string;
    updatedAt: string;
}

interface FeaturedListingDto {
    id: number;
    featuredUntil: string | null;
    isFeatured: boolean;
    updatedAt: string;
}

interface AdminSystemConfigDto {
    version: number;
    config: Prisma.JsonValue;
    changedById: number | null;
    changeNote: string | null;
    createdAt: string | null;
}

function mapIdentityVerificationDto(request: {
    id: number;
    userId: number;
    status: IdentityVerificationStatus;
    documentType: string;
    documentNumberMasked: string | null;
    note: string | null;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewerId: number | null;
    reviewerNote: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
        email: string | null;
        identityVerificationStatus: IdentityVerificationStatus;
        identityVerifiedAt: Date | null;
        profile: {
            fullName: string | null;
        } | null;
    };
    reviewer: {
        email: string | null;
        profile: {
            fullName: string | null;
        } | null;
    } | null;
}): AdminIdentityVerificationDto {
    return {
        id: request.id,
        userId: request.userId,
        status: request.status,
        documentType: request.documentType,
        documentNumberMasked: request.documentNumberMasked,
        note: request.note,
        submittedAt: request.submittedAt.toISOString(),
        reviewedAt: request.reviewedAt?.toISOString() ?? null,
        reviewerId: request.reviewerId ?? null,
        reviewerNote: request.reviewerNote ?? null,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        user: {
            email: request.user.email,
            fullName: request.user.profile?.fullName ?? null,
            identityVerificationStatus: request.user.identityVerificationStatus,
            identityVerifiedAt: request.user.identityVerifiedAt?.toISOString() ?? null,
        },
        reviewer: request.reviewer
            ? {
                  email: request.reviewer.email,
                  fullName: request.reviewer.profile?.fullName ?? null,
              }
            : null,
    };
}

function localizeListingTitle(
    listing: { titleAr: string; titleEn: string | null },
    lang: AppLanguage,
): string {
    return lang === 'ar' ? listing.titleAr : listing.titleEn ?? listing.titleAr;
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

async function createAuditLog(
    adminId: number,
    action: string,
    entityType: string,
    entityId: number,
    oldData?: Prisma.InputJsonValue,
    newData?: Prisma.InputJsonValue,
    db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
    await persistAuditLog({
        adminId,
        action,
        entityType,
        entityId,
        oldData,
        newData,
    }, db);
}

export async function getAdminDashboardStats(): Promise<DashboardDto> {
    const [
        totalUsers,
        activeUsers,
        bannedUsers,
        totalListings,
        activeListings,
        pendingListings,
        rejectedListings,
        totalReports,
        pendingReports,
        totalDeals,
        completedDeals,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { bannedAt: { not: null } } }),
        prisma.listing.count(),
        prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
        prisma.listing.count({ where: { status: ListingStatus.PENDING } }),
        prisma.listing.count({ where: { status: ListingStatus.REJECTED } }),
        prisma.report.count(),
        prisma.report.count({ where: { status: ReportStatus.PENDING } }),
        prisma.deal.count(),
        prisma.deal.count({ where: { status: 'COMPLETED' } }),
    ]);

    return {
        users: {
            total: totalUsers,
            active: activeUsers,
            banned: bannedUsers,
        },
        listings: {
            total: totalListings,
            active: activeListings,
            pending: pendingListings,
            rejected: rejectedListings,
        },
        reports: {
            total: totalReports,
            pending: pendingReports,
        },
        deals: {
            total: totalDeals,
            completed: completedDeals,
        },
    };
}

export async function listReports(
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: AdminReportDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const rawStatus = typeof query.status === 'string' ? query.status : undefined;
    const status = normalizeReportStatus(rawStatus);

    const where: Prisma.ReportWhereInput = {};
    if (status) {
        where.status = status;
    }

    const [total, reports] = await Promise.all([
        prisma.report.count({ where }),
        prisma.report.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                reporterId: true,
                listingId: true,
                reportableType: true,
                reportableId: true,
                reason: true,
                description: true,
                status: true,
                createdAt: true,
                reporter: {
                    select: {
                        email: true,
                        profile: {
                            select: {
                                fullName: true,
                            },
                        },
                    },
                },
                listing: {
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        status: true,
                    },
                },
            },
        }),
    ]);

    return {
        items: reports.map((report) => ({
            id: report.id,
            reporterId: report.reporterId,
            listingId: report.listingId,
            reportableType: report.reportableType,
            reportableId: report.reportableId,
            reason: report.reason,
            description: report.description,
            status: report.status,
            createdAt: report.createdAt.toISOString(),
            reporter: {
                email: report.reporter.email,
                fullName: report.reporter.profile?.fullName ?? null,
            },
            listing: report.listing
                ? {
                      id: report.listing.id,
                      title: localizeListingTitle(report.listing, lang),
                      status: report.listing.status,
                  }
                : null,
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function resolveReport(
    adminId: number,
    reportId: number,
    payload: { action: 'dismiss' | 'resolve' | 'delete_listing' | 'ban_user'; resolution?: string },
): Promise<AdminReportDto> {
    const report = await prisma.report.findUnique({
        where: { id: reportId },
        select: {
            id: true,
            reporterId: true,
            listingId: true,
            reportableType: true,
            reportableId: true,
            reason: true,
            description: true,
            status: true,
            createdAt: true,
            reporter: {
                select: {
                    email: true,
                    profile: {
                        select: {
                            fullName: true,
                        },
                    },
                },
            },
            listing: {
                select: {
                    id: true,
                    titleAr: true,
                    titleEn: true,
                    status: true,
                    userId: true,
                },
            },
        },
    });

    if (!report) {
        throw new ApiError(404, 'REPORT_NOT_FOUND', 'Report not found.');
    }

    const reportStatus =
        payload.action === 'dismiss' ? ReportStatus.DISMISSED : ReportStatus.RESOLVED;

    if (payload.action === 'delete_listing') {
        const listingId = report.listingId ?? (report.reportableType === 'LISTING' ? report.reportableId : null);
        if (!listingId) {
            throw new ApiError(400, 'LISTING_NOT_TARGETED', 'No listing target found for this report.');
        }

        await prisma.listing.updateMany({
            where: { id: listingId },
            data: { status: ListingStatus.ARCHIVED },
        });
    }

    if (payload.action === 'ban_user') {
        const targetUserId =
            report.reportableType === 'USER' ? report.reportableId : report.listing?.userId ?? null;

        if (!targetUserId) {
            throw new ApiError(400, 'USER_NOT_TARGETED', 'No user target found for this report.');
        }

        await prisma.user.updateMany({
            where: { id: targetUserId },
            data: {
                isActive: false,
                bannedAt: new Date(),
                bannedReason: payload.resolution ?? 'Banned by moderation action',
            },
        });
    }

    const updatedReport = await prisma.report.update({
        where: { id: report.id },
        data: {
            status: reportStatus,
            resolvedByAdmin: adminId,
            resolvedAt: new Date(),
            resolution: payload.resolution,
        },
        select: {
            id: true,
            reporterId: true,
            listingId: true,
            reportableType: true,
            reportableId: true,
            reason: true,
            description: true,
            status: true,
            createdAt: true,
            reporter: {
                select: {
                    email: true,
                    profile: {
                        select: {
                            fullName: true,
                        },
                    },
                },
            },
            listing: {
                select: {
                    id: true,
                    titleAr: true,
                    titleEn: true,
                    status: true,
                },
            },
        },
    });

    await createAuditLog(
        adminId,
        `REPORT_${payload.action.toUpperCase()}`,
        'report',
        report.id,
        { status: report.status } as Prisma.InputJsonObject,
        { status: updatedReport.status } as Prisma.InputJsonObject,
    );

    return {
        id: updatedReport.id,
        reporterId: updatedReport.reporterId,
        listingId: updatedReport.listingId,
        reportableType: updatedReport.reportableType,
        reportableId: updatedReport.reportableId,
        reason: updatedReport.reason,
        description: updatedReport.description,
        status: updatedReport.status,
        createdAt: updatedReport.createdAt.toISOString(),
        reporter: {
            email: updatedReport.reporter.email,
            fullName: updatedReport.reporter.profile?.fullName ?? null,
        },
        listing: updatedReport.listing
            ? {
                  id: updatedReport.listing.id,
                  title: updatedReport.listing.titleAr,
                  status: updatedReport.listing.status,
              }
            : null,
    };
}

export async function listDisputes(
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: AdminDisputeDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const rawStatus = typeof query.status === 'string' ? query.status : undefined;
    const status = normalizeDisputeStatus(rawStatus);
    const dealId = typeof query.dealId === 'number' ? query.dealId : undefined;
    const openedByUserId = typeof query.openedByUserId === 'number' ? query.openedByUserId : undefined;

    const where: Prisma.DisputeCaseWhereInput = {};
    if (status) {
        where.status = status;
    }
    if (dealId) {
        where.dealId = dealId;
    }
    if (openedByUserId) {
        where.openedByUserId = openedByUserId;
    }

    const [total, disputes] = await Promise.all([
        prisma.disputeCase.count({ where }),
        prisma.disputeCase.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                dealId: true,
                openedByUserId: true,
                reason: true,
                description: true,
                status: true,
                resolvedByAdmin: true,
                resolution: true,
                createdAt: true,
                resolvedAt: true,
                deal: {
                    select: {
                        id: true,
                        status: true,
                        finalPrice: true,
                        currency: true,
                        buyerId: true,
                        sellerId: true,
                        listingId: true,
                        listing: {
                            select: {
                                titleAr: true,
                                titleEn: true,
                            },
                        },
                    },
                },
            },
        }),
    ]);

    return {
        items: disputes.map((dispute) => ({
            id: dispute.id,
            dealId: dispute.dealId,
            openedByUserId: dispute.openedByUserId,
            reason: dispute.reason,
            description: dispute.description,
            status: dispute.status,
            resolvedByAdmin: dispute.resolvedByAdmin,
            resolution: dispute.resolution,
            createdAt: dispute.createdAt.toISOString(),
            resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
            deal: {
                id: dispute.deal.id,
                status: dispute.deal.status,
                finalPrice: dispute.deal.finalPrice,
                currency: dispute.deal.currency,
                buyerId: dispute.deal.buyerId,
                sellerId: dispute.deal.sellerId,
                listingId: dispute.deal.listingId,
                listingTitle: localizeListingTitle(dispute.deal.listing, lang),
            },
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function moderateListing(
    adminId: number,
    listingId: number,
    payload: { action: 'approve' | 'reject' | 'suspend' | 'delete'; reason?: string },
): Promise<ModeratedListingDto> {
    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            userId: true,
            status: true,
            updatedAt: true,
        },
    });

    if (!listing) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    const newStatus = mapListingActionToStatus(payload.action);
    const updated = await prisma.$transaction(async (tx) => {
        const nextListing = await tx.listing.update({
            where: { id: listing.id },
            data: {
                status: newStatus,
            },
            select: {
                id: true,
                status: true,
                updatedAt: true,
            },
        });

        await recordListingStatusHistory({
            listingId: listing.id,
            oldStatus: listing.status,
            newStatus: nextListing.status,
            actorId: adminId,
            reason: payload.reason ?? `Moderation action: ${payload.action}`,
        }, tx);

        await createAuditLog(
            adminId,
            `LISTING_${payload.action.toUpperCase()}`,
            'listing',
            listing.id,
            { status: listing.status, reason: payload.reason } as Prisma.InputJsonObject,
            { status: nextListing.status } as Prisma.InputJsonObject,
            tx,
        );

        return nextListing;
    });

    domainEventBus.publish('LISTING_MODERATED', {
        listingId: updated.id,
        ownerUserId: listing.userId,
        status: updated.status,
        action: payload.action,
    });

    return {
        id: updated.id,
        userId: listing.userId,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
    };
}

export async function listUsers(
    query: Record<string, unknown>,
): Promise<{ items: AdminUserDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const accountType =
        query.accountType && typeof query.accountType === 'string' ? (query.accountType as AccountType) : undefined;
    const staffRole =
        query.staffRole && typeof query.staffRole === 'string' ? (query.staffRole as StaffRole) : undefined;
    const active = typeof query.active === 'boolean' ? query.active : undefined;
    const search = typeof query.q === 'string' ? query.q : undefined;

    const filters: Prisma.UserWhereInput[] = [];
    if (active !== undefined) filters.push({ isActive: active });
    if (accountType) filters.push({ accountType });
    if (staffRole) filters.push({ staffRole });
    if (search) {
        filters.push({
            OR: [
                { email: { contains: search } },
                { profile: { fullName: { contains: search } } },
            ],
        });
    }

    const where: Prisma.UserWhereInput = filters.length > 0 ? { AND: filters } : {};

    const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                email: true,
                role: true,
                accountType: true,
                staffRole: true,
                isActive: true,
                bannedAt: true,
                bannedReason: true,
                trustTier: true,
                trustScore: true,
                createdAt: true,
                updatedAt: true,
                profile: {
                    select: {
                        fullName: true,
                    },
                },
            },
        }),
    ]);

    return {
        items: users.map((user) => ({
            id: user.id,
            email: user.email,
            role: user.role,
            accountType: user.accountType,
            staffRole: user.staffRole,
            isActive: user.isActive,
            bannedAt: user.bannedAt?.toISOString() ?? null,
            bannedReason: user.bannedReason ?? null,
            updatedAt: user.updatedAt.toISOString(),
            trustTier: user.trustTier,
            trustScore: user.trustScore,
            fullName: user.profile?.fullName ?? null,
            createdAt: user.createdAt.toISOString(),
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function moderateUser(
    adminId: number,
    targetUserId: number,
    payload: {
        action: 'activate' | 'deactivate' | 'ban' | 'unban' | 'set_staff_role' | 'set_account_type';
        staffRole?: StaffRole;
        accountType?: AccountType;
        reason?: string;
    },
): Promise<ModeratedUserDto> {
    const existing = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
            id: true,
            email: true,
            role: true,
            accountType: true,
            staffRole: true,
            isActive: true,
            bannedAt: true,
            bannedReason: true,
            updatedAt: true,
        },
    });

    if (!existing) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const isTargetAdmin = isAdmin(existing);
    if (
        payload.action !== 'set_staff_role'
        && isTargetAdmin
        && adminId !== targetUserId
    ) {
        throw new ApiError(403, 'CANNOT_MODERATE_ADMIN', 'Admin accounts cannot be moderated by this action.');
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (payload.action === 'activate') {
        updateData.isActive = true;
        updateData.bannedAt = null;
        updateData.bannedReason = null;
    }

    if (payload.action === 'deactivate') {
        updateData.isActive = false;
    }

    if (payload.action === 'ban') {
        updateData.isActive = false;
        updateData.bannedAt = new Date();
        updateData.bannedReason = payload.reason ?? 'Banned by admin';
    }

    if (payload.action === 'unban') {
        updateData.isActive = true;
        updateData.bannedAt = null;
        updateData.bannedReason = null;
    }

    if (payload.action === 'set_staff_role') {
        const nextStaffRole = payload.staffRole ?? StaffRole.NONE;
        updateData.staffRole = nextStaffRole;
        updateData.role = legacyRoleFromStaffRole(nextStaffRole);
    }

    if (payload.action === 'set_account_type') {
        updateData.accountType = payload.accountType;
    }

    const updated = await prisma.$transaction(async (tx) => {
        const nextUser = await tx.user.update({
            where: { id: existing.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                role: true,
                accountType: true,
                staffRole: true,
                isActive: true,
                bannedAt: true,
                bannedReason: true,
                updatedAt: true,
            },
        });

        await recordUserRoleHistory({
            userId: existing.id,
            changedById: adminId,
            oldStaffRole: existing.staffRole,
            newStaffRole: nextUser.staffRole,
            oldAccountType: existing.accountType,
            newAccountType: nextUser.accountType,
            reason: payload.reason ?? payload.action,
        }, tx);

        await createAuditLog(
            adminId,
            `USER_${payload.action.toUpperCase()}`,
            'user',
            existing.id,
            {
                role: existing.role,
                accountType: existing.accountType,
                staffRole: existing.staffRole,
                isActive: existing.isActive,
                bannedAt: existing.bannedAt?.toISOString() ?? null,
            } as Prisma.InputJsonObject,
            {
                role: nextUser.role,
                accountType: nextUser.accountType,
                staffRole: nextUser.staffRole,
                isActive: nextUser.isActive,
                bannedAt: nextUser.bannedAt?.toISOString() ?? null,
            } as Prisma.InputJsonObject,
            tx,
        );

        return nextUser;
    });

    return {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        accountType: updated.accountType,
        staffRole: updated.staffRole,
        isActive: updated.isActive,
        bannedAt: updated.bannedAt?.toISOString() ?? null,
        bannedReason: updated.bannedReason ?? null,
        updatedAt: updated.updatedAt.toISOString(),
    };
}

export async function listFraudFlags(
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: AdminFraudFlagDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const listingId = typeof query.listingId === 'number' ? query.listingId : undefined;

    const where: Prisma.AuditLogWhereInput = {
        action: 'LISTING_FRAUD_FLAGGED',
        entityType: 'listing',
    };
    if (listingId) {
        where.entityId = listingId;
    }

    const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                adminId: true,
                entityId: true,
                newData: true,
                ipAddress: true,
                createdAt: true,
            },
        }),
    ]);

    const listingIds = Array.from(new Set(logs.map((log) => log.entityId)));
    const actorUserIds = Array.from(new Set(logs.map((log) => log.adminId)));

    const [listings, actors] = await Promise.all([
        listingIds.length
            ? prisma.listing.findMany({
                  where: { id: { in: listingIds } },
                  select: {
                      id: true,
                      titleAr: true,
                      titleEn: true,
                  },
              })
            : [],
        actorUserIds.length
            ? prisma.user.findMany({
                  where: { id: { in: actorUserIds } },
                  select: {
                      id: true,
                      email: true,
                  },
              })
            : [],
    ]);

    const listingMap = new Map(listings.map((listing) => [listing.id, localizeListingTitle(listing, lang)]));
    const actorMap = new Map(actors.map((actor) => [actor.id, actor.email]));

    const items: AdminFraudFlagDto[] = logs.map((log) => {
        const payload = asRecord(log.newData);
        const signalsRaw = Array.isArray(payload?.signals) ? payload.signals : [];
        const riskScoreRaw = payload?.riskScore;
        const riskScore = typeof riskScoreRaw === 'number' ? riskScoreRaw : Number(riskScoreRaw ?? 0) || 0;

        return {
            auditLogId: log.id,
            listingId: log.entityId,
            listingTitle: listingMap.get(log.entityId) ?? null,
            actorUserId: log.adminId,
            actorEmail: actorMap.get(log.adminId) ?? null,
            riskScore,
            signals: signalsRaw
                .filter((signal): signal is Record<string, unknown> => Boolean(signal) && typeof signal === 'object')
                .map((signal) => ({
                    code: typeof signal.code === 'string' ? signal.code : 'UNKNOWN',
                    severity: typeof signal.severity === 'string' ? signal.severity : 'unknown',
                    message: typeof signal.message === 'string' ? signal.message : '',
                    meta:
                        signal.meta && typeof signal.meta === 'object' && !Array.isArray(signal.meta)
                            ? (signal.meta as Record<string, unknown>)
                            : undefined,
                })),
            ipAddress: log.ipAddress ?? null,
            createdAt: log.createdAt.toISOString(),
        };
    });

    return {
        items,
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function listIdentityVerifications(
    query: Record<string, unknown>,
): Promise<{ items: AdminIdentityVerificationDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const status =
        query.status && typeof query.status === 'string'
            ? (query.status as IdentityVerificationStatus)
            : undefined;
    const userId = typeof query.userId === 'number' ? query.userId : undefined;

    const where: Prisma.IdentityVerificationRequestWhereInput = {};
    if (status) {
        where.status = status;
    }
    if (userId) {
        where.userId = userId;
    }

    const [total, requests] = await Promise.all([
        prisma.identityVerificationRequest.count({ where }),
        prisma.identityVerificationRequest.findMany({
            where,
            orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                userId: true,
                status: true,
                documentType: true,
                documentNumberMasked: true,
                note: true,
                submittedAt: true,
                reviewedAt: true,
                reviewerId: true,
                reviewerNote: true,
                createdAt: true,
                updatedAt: true,
                user: {
                    select: {
                        email: true,
                        identityVerificationStatus: true,
                        identityVerifiedAt: true,
                        profile: {
                            select: {
                                fullName: true,
                            },
                        },
                    },
                },
                reviewer: {
                    select: {
                        email: true,
                        profile: {
                            select: {
                                fullName: true,
                            },
                        },
                    },
                },
            },
        }),
    ]);

    return {
        items: requests.map(mapIdentityVerificationDto),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function resolveIdentityVerification(
    adminId: number,
    requestId: number,
    payload: { action: 'approve' | 'reject'; reviewerNote?: string },
): Promise<AdminIdentityVerificationDto> {
    const existing = await prisma.identityVerificationRequest.findUnique({
        where: { id: requestId },
        select: {
            id: true,
            userId: true,
            status: true,
        },
    });

    if (!existing) {
        throw new ApiError(404, 'IDENTITY_VERIFICATION_NOT_FOUND', 'Identity verification request not found.');
    }

    if (existing.status !== IdentityVerificationStatus.PENDING) {
        throw new ApiError(400, 'IDENTITY_VERIFICATION_NOT_PENDING', 'Identity verification is not pending.');
    }

    const nextStatus =
        payload.action === 'approve'
            ? IdentityVerificationStatus.VERIFIED
            : IdentityVerificationStatus.REJECTED;

    const updated = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.identityVerificationRequest.update({
            where: { id: existing.id },
            data: {
                status: nextStatus,
                reviewedAt: new Date(),
                reviewerId: adminId,
                reviewerNote: payload.reviewerNote,
            },
            select: {
                id: true,
                userId: true,
                status: true,
                documentType: true,
                documentNumberMasked: true,
                note: true,
                submittedAt: true,
                reviewedAt: true,
                reviewerId: true,
                reviewerNote: true,
                createdAt: true,
                updatedAt: true,
                user: {
                    select: {
                        email: true,
                        identityVerificationStatus: true,
                        identityVerifiedAt: true,
                        profile: {
                            select: {
                                fullName: true,
                            },
                        },
                    },
                },
                reviewer: {
                    select: {
                        email: true,
                        profile: {
                            select: {
                                fullName: true,
                            },
                        },
                    },
                },
            },
        });

        await tx.user.update({
            where: { id: existing.userId },
            data: {
                identityVerificationStatus: nextStatus,
                identityVerifiedAt:
                    nextStatus === IdentityVerificationStatus.VERIFIED
                        ? new Date()
                        : null,
            },
        });

        return updatedRequest;
    });

    await createAuditLog(
        adminId,
        payload.action === 'approve' ? 'IDENTITY_VERIFICATION_APPROVE' : 'IDENTITY_VERIFICATION_REJECT',
        'identity_verification',
        existing.id,
        {
            status: existing.status,
            userId: existing.userId,
        } as Prisma.InputJsonObject,
        {
            status: nextStatus,
            reviewerNote: payload.reviewerNote ?? null,
        } as Prisma.InputJsonObject,
    );

    domainEventBus.publish('IDENTITY_VERIFICATION_REVIEWED', {
        userId: existing.userId,
        status: nextStatus,
    });

    return mapIdentityVerificationDto(updated);
}

export async function listBlacklistEntriesForAdmin(
    query: Record<string, unknown>,
): Promise<{ items: AdminBlacklistEntryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const result = await listBlacklistEntries({
        page: typeof query.page === 'number' ? query.page : undefined,
        limit: typeof query.limit === 'number' ? query.limit : undefined,
        type:
            query.type === 'phone' || query.type === 'ip' || query.type === 'keyword'
                ? query.type
                : undefined,
        q: typeof query.q === 'string' ? query.q : undefined,
        active: typeof query.active === 'boolean' ? query.active : undefined,
    });

    return {
        items: result.items.map((entry) => ({
            id: entry.id,
            type: entry.type,
            value: entry.value,
            reason: entry.reason,
            isActive: entry.isActive,
            createdBy: entry.createdBy,
            updatedBy: entry.updatedBy,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        })),
        meta: result.meta,
    };
}

export async function createBlacklistEntryForAdmin(
    adminId: number,
    payload: { type: BlacklistEntryType; value: string; reason?: string },
): Promise<AdminBlacklistEntryDto> {
    let entry;
    try {
        entry = await createBlacklistEntry({
            type: payload.type,
            value: payload.value,
            reason: payload.reason,
            adminId,
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'BLACKLIST_ENTRY_ALREADY_EXISTS') {
            throw new ApiError(409, 'BLACKLIST_ENTRY_EXISTS', 'Blacklist entry already exists.');
        }

        throw error;
    }

    await createAuditLog(
        adminId,
        'BLACKLIST_CREATE',
        'blacklist',
        Number(entry.id),
        undefined,
        {
            type: entry.type,
            value: entry.value,
            reason: entry.reason,
            isActive: entry.isActive,
        } as Prisma.InputJsonObject,
    );

    return {
        id: entry.id,
        type: entry.type,
        value: entry.value,
        reason: entry.reason,
        isActive: entry.isActive,
        createdBy: entry.createdBy,
        updatedBy: entry.updatedBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };
}

export async function updateBlacklistEntryForAdmin(
    adminId: number,
    id: string,
    payload: { reason?: string; isActive?: boolean },
): Promise<AdminBlacklistEntryDto> {
    const entry = await updateBlacklistEntry({
        id,
        reason: payload.reason,
        isActive: payload.isActive,
        adminId,
    });

    if (!entry) {
        throw new ApiError(404, 'BLACKLIST_ENTRY_NOT_FOUND', 'Blacklist entry not found.');
    }

    await createAuditLog(
        adminId,
        'BLACKLIST_UPDATE',
        'blacklist',
        Number(entry.id),
        undefined,
        {
            reason: entry.reason,
            isActive: entry.isActive,
        } as Prisma.InputJsonObject,
    );

    return {
        id: entry.id,
        type: entry.type,
        value: entry.value,
        reason: entry.reason,
        isActive: entry.isActive,
        createdBy: entry.createdBy,
        updatedBy: entry.updatedBy,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };
}

export async function deleteBlacklistEntryForAdmin(adminId: number, id: string): Promise<void> {
    const deleted = await deleteBlacklistEntry(id);
    if (!deleted) {
        throw new ApiError(404, 'BLACKLIST_ENTRY_NOT_FOUND', 'Blacklist entry not found.');
    }

    await createAuditLog(
        adminId,
        'BLACKLIST_DELETE',
        'blacklist',
        Number(id),
        undefined,
        undefined,
    );
}

export async function featureListingByAdmin(
    adminId: number,
    listingId: number,
    payload: { days?: number; clear?: boolean },
): Promise<FeaturedListingDto> {
    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            featuredUntil: true,
        },
    });

    if (!listing) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    const nextFeaturedUntil = payload.clear
        ? null
        : new Date(Date.now() + (payload.days ?? 0) * 24 * 60 * 60 * 1000);

    const updated = await prisma.listing.update({
        where: { id: listing.id },
        data: {
            featuredUntil: nextFeaturedUntil,
        },
        select: {
            id: true,
            featuredUntil: true,
            updatedAt: true,
        },
    });

    await createAuditLog(
        adminId,
        payload.clear ? 'LISTING_UNFEATURE' : 'LISTING_FEATURE',
        'listing',
        listing.id,
        {
            featuredUntil: listing.featuredUntil?.toISOString() ?? null,
        } as Prisma.InputJsonObject,
        {
            featuredUntil: updated.featuredUntil?.toISOString() ?? null,
            days: payload.days ?? null,
        } as Prisma.InputJsonObject,
    );

    return {
        id: updated.id,
        featuredUntil: updated.featuredUntil?.toISOString() ?? null,
        isFeatured: Boolean(updated.featuredUntil && updated.featuredUntil.getTime() > Date.now()),
        updatedAt: updated.updatedAt.toISOString(),
    };
}

export async function getAdminSystemConfig(): Promise<AdminSystemConfigDto> {
    const latest = await prisma.systemConfigVersion.findFirst({
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: {
            version: true,
            configJson: true,
            changedById: true,
            changeNote: true,
            createdAt: true,
        },
    });

    if (!latest) {
        return {
            version: 0,
            config: {},
            changedById: null,
            changeNote: null,
            createdAt: null,
        };
    }

    return {
        version: latest.version,
        config: latest.configJson,
        changedById: latest.changedById,
        changeNote: latest.changeNote ?? null,
        createdAt: latest.createdAt.toISOString(),
    };
}

export async function updateAdminSystemConfig(
    adminId: number,
    payload: { config: Record<string, unknown>; replace?: boolean; changeNote?: string },
): Promise<AdminSystemConfigDto> {
    return prisma.$transaction(async (tx) => {
        const current = await tx.systemConfigVersion.findFirst({
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
            select: {
                version: true,
                configJson: true,
            },
        });

        const previousConfig =
            current?.configJson && typeof current.configJson === 'object' && !Array.isArray(current.configJson)
                ? (current.configJson as Record<string, unknown>)
                : {};
        const nextConfig: Record<string, unknown> = payload.replace
            ? payload.config
            : ({
                  ...previousConfig,
                  ...payload.config,
              });

        const created = await tx.systemConfigVersion.create({
            data: {
                version: (current?.version ?? 0) + 1,
                configJson: nextConfig as Prisma.InputJsonValue,
                changedById: adminId,
                changeNote: payload.changeNote ?? null,
            },
            select: {
                id: true,
                version: true,
                configJson: true,
                changedById: true,
                changeNote: true,
                createdAt: true,
            },
        });

        await createAuditLog(
            adminId,
            'SYSTEM_CONFIG_UPDATE',
            'system_config',
            created.id,
            {
                version: current?.version ?? 0,
                config: previousConfig,
            } as Prisma.InputJsonObject,
            {
                version: created.version,
                config: nextConfig,
                replace: Boolean(payload.replace),
            } as Prisma.InputJsonObject,
            tx,
        );

        clearSystemConfigCache();

        return {
            version: created.version,
            config: created.configJson,
            changedById: created.changedById,
            changeNote: created.changeNote ?? null,
            createdAt: created.createdAt.toISOString(),
        };
    });
}

export async function listAuditLogs(
    query: Record<string, unknown>,
): Promise<{ items: AdminAuditLogDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const adminId = typeof query.adminId === 'number' ? query.adminId : undefined;
    const entityType = typeof query.entityType === 'string' ? query.entityType.trim() : undefined;
    const action = typeof query.action === 'string' ? query.action.trim() : undefined;

    const where: Prisma.AuditLogWhereInput = {};
    if (adminId && Number.isInteger(adminId) && adminId > 0) {
        where.adminId = adminId;
    }
    if (entityType) {
        where.entityType = {
            equals: entityType,
        };
    }
    if (action) {
        where.action = {
            contains: action,
        };
    }

    const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                adminId: true,
                action: true,
                entityType: true,
                entityId: true,
                oldData: true,
                newData: true,
                ipAddress: true,
                createdAt: true,
            },
        }),
    ]);

    const adminIds = Array.from(new Set(logs.map((log) => log.adminId)));
    const admins = adminIds.length
        ? await prisma.user.findMany({
              where: { id: { in: adminIds } },
              select: {
                  id: true,
                  email: true,
                  profile: {
                      select: {
                          fullName: true,
                      },
                  },
              },
          })
        : [];
    const adminsById = new Map(
        admins.map((admin) => [admin.id, { email: admin.email, fullName: admin.profile?.fullName ?? null }]),
    );

    return {
        items: logs.map((log) => {
            const admin = adminsById.get(log.adminId);
            return {
                id: log.id,
                adminId: log.adminId,
                adminEmail: admin?.email ?? null,
                adminName: admin?.fullName ?? null,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                oldData: log.oldData ?? null,
                newData: log.newData ?? null,
                ipAddress: log.ipAddress ?? null,
                createdAt: log.createdAt.toISOString(),
            };
        }),
        meta: buildPaginationMeta(total, pagination),
    };
}
