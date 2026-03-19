import { ListingStatus, type Prisma } from '@prisma/client';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import type { AppLanguage } from '../../shared/utils/language.js';
import { buildPaginationMeta, getSkip, parsePagination } from '../../shared/utils/pagination.js';
import { prisma } from '../../shared/utils/prisma.js';
import type {
    CreateSavedSearchBody,
    UpdateSavedSearchBody,
} from './preference.validation.js';

type NotificationFrequency = 'instant' | 'daily' | 'weekly';

interface FavoriteSummaryDto {
    favoriteId: number;
    listing: {
        id: number;
        title: string;
        priceAmount: number | null;
        currency: string | null;
        status: ListingStatus;
        coverImage: string | null;
        countryName: string;
        cityName: string;
    };
    createdAt: string;
}

interface SavedSearchDto {
    id: number;
    name: string;
    filters: Record<string, unknown>;
    notificationFrequency: NotificationFrequency;
    createdAt: string;
}

interface ParsedSavedSearchFilters {
    filters: Record<string, unknown>;
    notificationFrequency: NotificationFrequency;
}

function localizeName(entity: { nameAr: string; nameEn: string }, lang: AppLanguage): string {
    return lang === 'ar' ? entity.nameAr : entity.nameEn;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSavedSearchFilters(value: Prisma.JsonValue): ParsedSavedSearchFilters {
    const defaultResult: ParsedSavedSearchFilters = {
        filters: {},
        notificationFrequency: 'daily',
    };

    if (!isRecord(value)) {
        return defaultResult;
    }

    const rawCriteria = value.criteria;
    const rawFrequency = value.notificationFrequency;

    const filters = isRecord(rawCriteria) ? rawCriteria : {};
    const notificationFrequency: NotificationFrequency =
        rawFrequency === 'instant' || rawFrequency === 'daily' || rawFrequency === 'weekly'
            ? rawFrequency
            : 'daily';

    return { filters, notificationFrequency };
}

function buildSavedSearchFiltersInput(
    filters: Record<string, unknown>,
    notificationFrequency: NotificationFrequency,
): Prisma.InputJsonValue {
    return {
        criteria: filters as unknown as Prisma.InputJsonValue,
        notificationFrequency,
    } as Prisma.InputJsonObject;
}

export async function addFavorite(
    userId: number,
    listingId: number,
    lang: AppLanguage,
): Promise<{ favorited: true; alreadyFavorited: boolean; favorite: FavoriteSummaryDto }> {
    const listing = await prisma.listing.findFirst({
        where: {
            id: listingId,
            status: ListingStatus.ACTIVE,
        },
        select: {
            id: true,
            userId: true,
            titleAr: true,
            titleEn: true,
            priceAmount: true,
            currency: true,
            status: true,
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
                select: { urlThumb: true },
                orderBy: { sortOrder: 'asc' },
                take: 1,
            },
        },
    });

    if (!listing) {
        throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    }

    if (listing.userId === userId) {
        throw new ApiError(400, 'CANNOT_FAVORITE_OWN_LISTING', 'You cannot favorite your own listing.');
    }

    const existingFavorite = await prisma.favorite.findUnique({
        where: {
            userId_listingId: {
                userId,
                listingId,
            },
        },
        select: {
            id: true,
            createdAt: true,
        },
    });

    const favorite = existingFavorite
        ? existingFavorite
        : await prisma.favorite.create({
              data: {
                  userId,
                  listingId,
              },
              select: {
                  id: true,
                  createdAt: true,
              },
          });

    if (!existingFavorite) {
        await prisma.listing.updateMany({
            where: { id: listingId },
            data: {
                favoriteCount: {
                    increment: 1,
                },
            },
        });
    }

    return {
        favorited: true,
        alreadyFavorited: Boolean(existingFavorite),
        favorite: {
            favoriteId: favorite.id,
            listing: {
                id: listing.id,
                title: lang === 'ar' ? listing.titleAr : listing.titleEn ?? listing.titleAr,
                priceAmount: listing.priceAmount,
                currency: listing.currency,
                status: listing.status,
                coverImage: listing.images[0]?.urlThumb ?? null,
                countryName: localizeName(listing.country, lang),
                cityName: localizeName(listing.city, lang),
            },
            createdAt: favorite.createdAt.toISOString(),
        },
    };
}

export async function removeFavorite(
    userId: number,
    listingId: number,
): Promise<{ removed: boolean }> {
    const deleted = await prisma.favorite.deleteMany({
        where: {
            userId,
            listingId,
        },
    });

    if (deleted.count > 0) {
        await prisma.listing.updateMany({
            where: {
                id: listingId,
                favoriteCount: { gt: 0 },
            },
            data: {
                favoriteCount: {
                    decrement: 1,
                },
            },
        });
    }

    return { removed: deleted.count > 0 };
}

export async function listFavorites(
    userId: number,
    query: Record<string, unknown>,
    lang: AppLanguage,
): Promise<{ items: FavoriteSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);

    const where: Prisma.FavoriteWhereInput = {
        userId,
        listing: {
            status: {
                not: ListingStatus.ARCHIVED,
            },
        },
    };

    const [total, favorites] = await Promise.all([
        prisma.favorite.count({ where }),
        prisma.favorite.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                createdAt: true,
                listing: {
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        priceAmount: true,
                        currency: true,
                        status: true,
                        country: {
                            select: { nameAr: true, nameEn: true },
                        },
                        city: {
                            select: { nameAr: true, nameEn: true },
                        },
                        images: {
                            select: { urlThumb: true },
                            orderBy: { sortOrder: 'asc' },
                            take: 1,
                        },
                    },
                },
            },
        }),
    ]);

    return {
        items: favorites.map((favorite) => ({
            favoriteId: favorite.id,
            listing: {
                id: favorite.listing.id,
                title: lang === 'ar' ? favorite.listing.titleAr : favorite.listing.titleEn ?? favorite.listing.titleAr,
                priceAmount: favorite.listing.priceAmount,
                currency: favorite.listing.currency,
                status: favorite.listing.status,
                coverImage: favorite.listing.images[0]?.urlThumb ?? null,
                countryName: localizeName(favorite.listing.country, lang),
                cityName: localizeName(favorite.listing.city, lang),
            },
            createdAt: favorite.createdAt.toISOString(),
        })),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function createSavedSearch(
    userId: number,
    payload: CreateSavedSearchBody,
): Promise<SavedSearchDto> {
    const savedSearch = await prisma.savedSearch.create({
        data: {
            userId,
            name: payload.name,
            filters: buildSavedSearchFiltersInput(payload.filters, payload.notificationFrequency),
        },
        select: {
            id: true,
            name: true,
            filters: true,
            createdAt: true,
        },
    });

    const parsed = parseSavedSearchFilters(savedSearch.filters);

    return {
        id: savedSearch.id,
        name: savedSearch.name,
        filters: parsed.filters,
        notificationFrequency: parsed.notificationFrequency,
        createdAt: savedSearch.createdAt.toISOString(),
    };
}

export async function listSavedSearches(
    userId: number,
    query: Record<string, unknown>,
): Promise<{ items: SavedSearchDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const pagination = parsePagination(query);

    const where: Prisma.SavedSearchWhereInput = { userId };
    const [total, searches] = await Promise.all([
        prisma.savedSearch.count({ where }),
        prisma.savedSearch.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: getSkip(pagination),
            take: pagination.limit,
            select: {
                id: true,
                name: true,
                filters: true,
                createdAt: true,
            },
        }),
    ]);

    return {
        items: searches.map((search) => {
            const parsed = parseSavedSearchFilters(search.filters);

            return {
                id: search.id,
                name: search.name,
                filters: parsed.filters,
                notificationFrequency: parsed.notificationFrequency,
                createdAt: search.createdAt.toISOString(),
            };
        }),
        meta: buildPaginationMeta(total, pagination),
    };
}

export async function updateSavedSearch(
    userId: number,
    id: number,
    payload: UpdateSavedSearchBody,
): Promise<SavedSearchDto> {
    const existing = await prisma.savedSearch.findFirst({
        where: {
            id,
            userId,
        },
        select: {
            id: true,
            name: true,
            filters: true,
            createdAt: true,
        },
    });

    if (!existing) {
        throw new ApiError(404, 'SAVED_SEARCH_NOT_FOUND', 'Saved search not found.');
    }

    const parsed = parseSavedSearchFilters(existing.filters);

    const updated = await prisma.savedSearch.update({
        where: { id: existing.id },
        data: {
            name: payload.name ?? existing.name,
            filters: buildSavedSearchFiltersInput(
                payload.filters ?? parsed.filters,
                payload.notificationFrequency ?? parsed.notificationFrequency,
            ),
        },
        select: {
            id: true,
            name: true,
            filters: true,
            createdAt: true,
        },
    });

    const updatedParsed = parseSavedSearchFilters(updated.filters);

    return {
        id: updated.id,
        name: updated.name,
        filters: updatedParsed.filters,
        notificationFrequency: updatedParsed.notificationFrequency,
        createdAt: updated.createdAt.toISOString(),
    };
}

export async function deleteSavedSearch(
    userId: number,
    id: number,
): Promise<{ deleted: true }> {
    const deleted = await prisma.savedSearch.deleteMany({
        where: {
            id,
            userId,
        },
    });

    if (deleted.count === 0) {
        throw new ApiError(404, 'SAVED_SEARCH_NOT_FOUND', 'Saved search not found.');
    }

    return { deleted: true };
}
