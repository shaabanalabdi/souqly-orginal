import { ListingStatus, type Condition, type Prisma } from '@prisma/client';
import type { Server as SocketServer } from 'socket.io';
import { emitPlatformNotification } from '../../shared/realtime/notifications.js';
import { sendEmail } from '../../shared/utils/email.js';
import { logger } from '../../shared/utils/logger.js';
import { prisma } from '../../shared/utils/prisma.js';

type NotificationFrequency = 'instant' | 'daily' | 'weekly';

interface ParsedSavedSearch {
    criteria: Record<string, unknown>;
    frequency: NotificationFrequency;
}

interface AlertDispatchResult {
    listingId: number;
    matchedSearches: number;
    notifiedUsers: number;
    emailedUsers: number;
}

interface AlertListingRecord {
    id: number;
    userId: number;
    titleAr: string;
    titleEn: string | null;
    descriptionAr: string;
    descriptionEn: string | null;
    priceAmount: number | null;
    currency: string | null;
    condition: Condition | null;
    negotiable: boolean;
    countryId: number;
    cityId: number;
    subcategoryId: number;
    status: ListingStatus;
    images: Array<{ id: number }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSavedSearch(value: Prisma.JsonValue): ParsedSavedSearch {
    if (!isRecord(value)) {
        return {
            criteria: {},
            frequency: 'daily',
        };
    }

    const rawCriteria = value.criteria;
    const rawFrequency = value.notificationFrequency;
    const criteria = isRecord(rawCriteria) ? rawCriteria : {};
    const frequency: NotificationFrequency =
        rawFrequency === 'instant' || rawFrequency === 'daily' || rawFrequency === 'weekly'
            ? rawFrequency
            : 'daily';

    return { criteria, frequency };
}

function toNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }

    return undefined;
}

function toBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
    }

    return undefined;
}

function toText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function listingMatchesCriteria(listing: AlertListingRecord, criteria: Record<string, unknown>): boolean {
    const queryText = toText(criteria.q)?.toLowerCase();
    if (queryText) {
        const haystack = [
            listing.titleAr,
            listing.titleEn,
            listing.descriptionAr,
            listing.descriptionEn,
        ]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join(' ')
            .toLowerCase();

        if (!haystack.includes(queryText)) {
            return false;
        }
    }

    const subcategoryId = toNumber(criteria.subcategoryId);
    if (subcategoryId !== undefined && listing.subcategoryId !== subcategoryId) {
        return false;
    }

    const countryId = toNumber(criteria.countryId);
    if (countryId !== undefined && listing.countryId !== countryId) {
        return false;
    }

    const cityId = toNumber(criteria.cityId);
    if (cityId !== undefined && listing.cityId !== cityId) {
        return false;
    }

    const condition = toText(criteria.condition)?.toUpperCase();
    if (condition && listing.condition !== condition) {
        return false;
    }

    const currency = toText(criteria.currency)?.toUpperCase();
    if (currency && listing.currency !== currency) {
        return false;
    }

    const negotiable = toBoolean(criteria.negotiable);
    if (negotiable !== undefined && listing.negotiable !== negotiable) {
        return false;
    }

    const minPrice = toNumber(criteria.minPrice);
    if (minPrice !== undefined) {
        if (listing.priceAmount === null || listing.priceAmount < minPrice) {
            return false;
        }
    }

    const maxPrice = toNumber(criteria.maxPrice);
    if (maxPrice !== undefined) {
        if (listing.priceAmount === null || listing.priceAmount > maxPrice) {
            return false;
        }
    }

    const withImages = toBoolean(criteria.withImages);
    if (withImages === true && listing.images.length === 0) {
        return false;
    }

    return true;
}

function listingTitle(listing: AlertListingRecord): string {
    return listing.titleEn ?? listing.titleAr;
}

export async function dispatchInstantSavedSearchAlertsForListing(
    listingId: number,
    io: SocketServer | null,
): Promise<AlertDispatchResult> {
    const result: AlertDispatchResult = {
        listingId,
        matchedSearches: 0,
        notifiedUsers: 0,
        emailedUsers: 0,
    };

    const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: {
            id: true,
            userId: true,
            titleAr: true,
            titleEn: true,
            descriptionAr: true,
            descriptionEn: true,
            priceAmount: true,
            currency: true,
            condition: true,
            negotiable: true,
            countryId: true,
            cityId: true,
            subcategoryId: true,
            status: true,
            images: {
                select: {
                    id: true,
                },
                take: 1,
            },
        },
    });

    if (!listing || listing.status !== ListingStatus.ACTIVE) {
        return result;
    }

    const savedSearches = await prisma.savedSearch.findMany({
        where: {
            userId: {
                not: listing.userId,
            },
            user: {
                isActive: true,
                bannedAt: null,
            },
        },
        select: {
            id: true,
            userId: true,
            name: true,
            filters: true,
            user: {
                select: {
                    email: true,
                },
            },
        },
    });

    const matchedByUser = new Map<number, { email: string | null; names: string[] }>();

    for (const savedSearch of savedSearches) {
        const parsed = parseSavedSearch(savedSearch.filters);
        if (parsed.frequency !== 'instant') {
            continue;
        }

        if (!listingMatchesCriteria(listing, parsed.criteria)) {
            continue;
        }

        result.matchedSearches += 1;

        const existing = matchedByUser.get(savedSearch.userId);
        if (existing) {
            existing.names.push(savedSearch.name);
        } else {
            matchedByUser.set(savedSearch.userId, {
                email: savedSearch.user.email,
                names: [savedSearch.name],
            });
        }
    }

    result.notifiedUsers = matchedByUser.size;
    const listingUrl = `/listings/${listing.id}`;
    const publicBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const fullListingUrl = `${publicBaseUrl}${listingUrl}`;

    if (io) {
        for (const [userId, summary] of matchedByUser.entries()) {
            const firstSearch = summary.names[0];
            const moreCount = Math.max(0, summary.names.length - 1);
            const extraText = moreCount > 0 ? ` (+${moreCount} more)` : '';

            emitPlatformNotification(
                io,
                [userId],
                {
                    kind: 'system',
                    title: 'Saved search match',
                    body: `${listingTitle(listing)} matched "${firstSearch}"${extraText}.`,
                    link: listingUrl,
                },
            );
        }
    }

    const emailOutcomes = await Promise.all(
        Array.from(matchedByUser.values()).map(async (summary) => {
            if (!summary.email) {
                return false;
            }

            const ok = await sendEmail({
                to: summary.email,
                subject: `New Souqly match: ${listingTitle(listing)}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 640px;">
                      <h2>New listing matched your saved search</h2>
                      <p><strong>${listingTitle(listing)}</strong></p>
                      <p>Matched search: ${summary.names[0]}</p>
                      <p><a href="${fullListingUrl}">Open listing</a></p>
                    </div>
                `,
            });

            return ok;
        }),
    );

    result.emailedUsers = emailOutcomes.filter(Boolean).length;
    return result;
}

export function dispatchInstantSavedSearchAlertsInBackground(
    listingId: number,
    io: SocketServer | null,
): void {
    void dispatchInstantSavedSearchAlertsForListing(listingId, io).catch((error) => {
        logger.error(`Saved search alert dispatch failed for listing ${listingId}:`, error);
    });
}
