import { ListingStatus, type Condition, type Prisma } from '@prisma/client';
import type { Server as SocketServer } from 'socket.io';
import { emitPlatformNotification } from '../../shared/realtime/notifications.js';
import { sendEmail } from '../../shared/utils/email.js';
import { prisma } from '../../shared/utils/prisma.js';

type NotificationFrequency = 'instant' | 'daily' | 'weekly';
export type DigestFrequency = 'daily' | 'weekly';

interface ParsedSavedSearch {
    criteria: Record<string, unknown>;
    frequency: NotificationFrequency;
}

interface DigestListingRecord {
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

interface UserDigestSummary {
    email: string | null;
    searches: Array<{
        name: string;
        listingIds: number[];
        listingTitles: string[];
    }>;
}

export interface DigestDispatchResult {
    frequency: DigestFrequency;
    processedSearches: number;
    matchedSearches: number;
    matchedListings: number;
    notifiedUsers: number;
    emailedUsers: number;
    startedAt: string;
    completedAt: string;
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

function listingTitle(listing: DigestListingRecord): string {
    return listing.titleEn ?? listing.titleAr;
}

function listingMatchesCriteria(listing: DigestListingRecord, criteria: Record<string, unknown>): boolean {
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

function buildWindowStart(now: Date, frequency: DigestFrequency): Date {
    const hours = frequency === 'daily' ? 24 : 24 * 7;
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

async function findListingsForSearch(
    savedSearchUserId: number,
    windowStart: Date,
): Promise<DigestListingRecord[]> {
    return prisma.listing.findMany({
        where: {
            status: ListingStatus.ACTIVE,
            createdAt: {
                gte: windowStart,
            },
            userId: {
                not: savedSearchUserId,
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
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
}

function buildDigestEmailHtml(
    frequency: DigestFrequency,
    frontendBaseUrl: string,
    searches: UserDigestSummary['searches'],
): string {
    const searchBlocks = searches
        .slice(0, 5)
        .map((search) => {
            const listingLines = search.listingIds
                .slice(0, 5)
                .map((listingId, index) => {
                    const title = search.listingTitles[index];
                    const link = `${frontendBaseUrl}/listings/${listingId}`;
                    return `<li><a href="${link}">${title}</a></li>`;
                })
                .join('');

            return `
                <section style="margin-bottom: 14px;">
                  <h3 style="margin: 0 0 6px 0; font-size: 16px;">${search.name}</h3>
                  <ul style="margin: 0; padding-inline-start: 18px;">
                    ${listingLines}
                  </ul>
                </section>
            `;
        })
        .join('');

    return `
        <div style="font-family: Arial, sans-serif; max-width: 680px;">
          <h2>Souqly ${frequency} saved search digest</h2>
          <p>New listings matched your saved searches.</p>
          ${searchBlocks}
          <p><a href="${frontendBaseUrl}/preferences">Manage saved searches</a></p>
        </div>
    `;
}

export async function dispatchSavedSearchDigest(
    frequency: DigestFrequency,
    io: SocketServer | null,
): Promise<DigestDispatchResult> {
    const startedAt = new Date();
    const windowStart = buildWindowStart(startedAt, frequency);
    const result: DigestDispatchResult = {
        frequency,
        processedSearches: 0,
        matchedSearches: 0,
        matchedListings: 0,
        notifiedUsers: 0,
        emailedUsers: 0,
        startedAt: startedAt.toISOString(),
        completedAt: startedAt.toISOString(),
    };

    const savedSearches = await prisma.savedSearch.findMany({
        where: {
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

    const digestByUser = new Map<number, UserDigestSummary>();

    for (const savedSearch of savedSearches) {
        const parsed = parseSavedSearch(savedSearch.filters);
        if (parsed.frequency !== frequency) {
            continue;
        }

        result.processedSearches += 1;

        const candidates = await findListingsForSearch(savedSearch.userId, windowStart);
        const matches = candidates.filter((listing) => listingMatchesCriteria(listing, parsed.criteria));

        if (matches.length === 0) {
            continue;
        }

        result.matchedSearches += 1;
        result.matchedListings += matches.length;

        const userSummary = digestByUser.get(savedSearch.userId) ?? {
            email: savedSearch.user.email,
            searches: [],
        };

        userSummary.searches.push({
            name: savedSearch.name,
            listingIds: matches.map((listing) => listing.id),
            listingTitles: matches.map((listing) => listingTitle(listing)),
        });
        digestByUser.set(savedSearch.userId, userSummary);
    }

    result.notifiedUsers = digestByUser.size;
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (io) {
        for (const [userId, digest] of digestByUser.entries()) {
            const totalListings = digest.searches.reduce((count, search) => count + search.listingIds.length, 0);
            emitPlatformNotification(
                io,
                [userId],
                {
                    kind: 'system',
                    title: `${frequency} saved search digest`,
                    body: `${totalListings} new listings matched ${digest.searches.length} saved searches.`,
                    link: '/preferences',
                },
            );
        }
    }

    const emailOutcomes = await Promise.all(
        Array.from(digestByUser.values()).map(async (digest) => {
            if (!digest.email) {
                return false;
            }

            return sendEmail({
                to: digest.email,
                subject: `Souqly ${frequency} digest`,
                html: buildDigestEmailHtml(frequency, frontendBaseUrl, digest.searches),
            });
        }),
    );

    result.emailedUsers = emailOutcomes.filter(Boolean).length;
    result.completedAt = new Date().toISOString();
    return result;
}
