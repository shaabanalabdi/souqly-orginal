import { ListingStatus, ReportStatus, type Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { CreateReportBody } from './report.validation.js';

interface ReportDto {
    id: number;
    reporterId: number;
    listingId: number | null;
    reportableType: string;
    reportableId: number;
    reason: string;
    description: string | null;
    status: ReportStatus;
    createdAt: string;
    listing: {
        id: number;
        title: string;
        status: ListingStatus;
    } | null;
}

function localizeListingTitle(
    listing: { titleAr: string; titleEn: string | null },
    lang: AppLanguage,
): string {
    return lang === 'ar' ? listing.titleAr : listing.titleEn ?? listing.titleAr;
}

async function ensureReportTargetExists(
    reporterId: number,
    payload: CreateReportBody,
): Promise<{ listingId: number | null }> {
    if (payload.reportableType === 'LISTING') {
        const listing = await prisma.listing.findUnique({
            where: { id: payload.reportableId },
            select: {
                id: true,
                userId: true,
            },
        });

        if (!listing) {
            throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
        }

        if (listing.userId === reporterId) {
            throw new ApiError(400, 'CANNOT_REPORT_OWN_LISTING', 'You cannot report your own listing.');
        }

        return { listingId: listing.id };
    }

    if (payload.reportableType === 'USER') {
        const targetUser = await prisma.user.findUnique({
            where: { id: payload.reportableId },
            select: { id: true },
        });

        if (!targetUser) {
            throw new ApiError(404, 'USER_NOT_FOUND', 'Target user not found.');
        }

        if (targetUser.id === reporterId) {
            throw new ApiError(400, 'CANNOT_REPORT_SELF', 'You cannot report your own account.');
        }

        if (payload.listingId) {
            const listing = await prisma.listing.findUnique({
                where: { id: payload.listingId },
                select: { id: true },
            });

            if (!listing) {
                throw new ApiError(404, 'LISTING_NOT_FOUND', 'Linked listing not found.');
            }
        }

        return { listingId: payload.listingId ?? null };
    }

    const targetMessage = await prisma.chatMessage.findUnique({
        where: { id: payload.reportableId },
        select: {
            id: true,
            senderId: true,
            thread: {
                select: {
                    listingId: true,
                },
            },
        },
    });

    if (!targetMessage) {
        throw new ApiError(404, 'MESSAGE_NOT_FOUND', 'Target message not found.');
    }

    if (targetMessage.senderId === reporterId) {
        throw new ApiError(400, 'CANNOT_REPORT_OWN_MESSAGE', 'You cannot report your own message.');
    }

    return { listingId: targetMessage.thread.listingId };
}

function mapReportDto(
    report: {
        id: number;
        reporterId: number;
        listingId: number | null;
        reportableType: string;
        reportableId: number;
        reason: string;
        description: string | null;
        status: ReportStatus;
        createdAt: Date;
        listing: {
            id: number;
            titleAr: string;
            titleEn: string | null;
            status: ListingStatus;
        } | null;
    },
    lang: AppLanguage,
): ReportDto {
    return {
        id: report.id,
        reporterId: report.reporterId,
        listingId: report.listingId,
        reportableType: report.reportableType,
        reportableId: report.reportableId,
        reason: report.reason,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
        listing: report.listing
            ? {
                  id: report.listing.id,
                  title: localizeListingTitle(report.listing, lang),
                  status: report.listing.status,
              }
            : null,
    };
}

export async function createReport(
    reporterId: number,
    payload: CreateReportBody,
    lang: AppLanguage,
): Promise<ReportDto> {
    const target = await ensureReportTargetExists(reporterId, payload);

    const duplicate = await prisma.report.findFirst({
        where: {
            reporterId,
            reportableType: payload.reportableType,
            reportableId: payload.reportableId,
            status: ReportStatus.PENDING,
        },
        select: { id: true },
    });

    if (duplicate) {
        throw new ApiError(409, 'REPORT_ALREADY_EXISTS', 'A pending report already exists for this target.');
    }

    const report = await prisma.report.create({
        data: {
            reporterId,
            listingId: target.listingId,
            reportableType: payload.reportableType,
            reportableId: payload.reportableId,
            reason: payload.reason,
            description: payload.description,
            status: ReportStatus.PENDING,
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

    return mapReportDto(report, lang);
}

export async function listMyReports(
    reporterId: number,
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: ReportDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);
    const status = typeof query.status === 'string' ? (query.status as ReportStatus) : undefined;

    const where: Prisma.ReportWhereInput = {
        reporterId,
    };
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
        items: reports.map((report) => mapReportDto(report, lang)),
        meta: buildPaginationMeta(total, pagination),
    };
}
