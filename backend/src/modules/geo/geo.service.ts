import { haversineDistance } from '../../shared/utils/haversine.js';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { prisma } from '../../shared/utils/prisma.js';
import type { AppLanguage } from '../../shared/utils/language.js';

export interface GeoCountryDto {
    id: number;
    code: string;
    name: string;
    currencyCode: string;
    currencySymbol: string;
    phoneCode: string;
}

export interface GeoCityDto {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
}

export interface GeoNearestCityDto {
    city: GeoCityDto;
    country: {
        id: number;
        code: string;
        name: string;
        currencyCode: string;
        currencySymbol: string;
    };
    distanceKm: number;
}

function localizeName(entity: { nameAr: string; nameEn: string }, lang: AppLanguage): string {
    return lang === 'ar' ? entity.nameAr : entity.nameEn;
}

function roundTo(value: number, precision: number): number {
    const multiplier = 10 ** precision;
    return Math.round(value * multiplier) / multiplier;
}

export async function listCountries(lang: AppLanguage): Promise<GeoCountryDto[]> {
    const countries = await prisma.country.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
            currencyCode: true,
            currencySymbol: true,
            phoneCode: true,
        },
    });

    return countries.map((country) => ({
        id: country.id,
        code: country.code,
        name: localizeName(country, lang),
        currencyCode: country.currencyCode,
        currencySymbol: country.currencySymbol,
        phoneCode: country.phoneCode,
    }));
}

export async function listCitiesByCountry(
    countryCode: string,
    lang: AppLanguage,
): Promise<{ country: GeoCountryDto; cities: GeoCityDto[] }> {
    const normalizedCountryCode = countryCode.toUpperCase();
    const country = await prisma.country.findFirst({
        where: {
            code: normalizedCountryCode,
            isActive: true,
        },
        select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
            currencyCode: true,
            currencySymbol: true,
            phoneCode: true,
            cities: {
                where: { isActive: true },
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
                select: {
                    id: true,
                    nameAr: true,
                    nameEn: true,
                    latitude: true,
                    longitude: true,
                },
            },
        },
    });

    if (!country) {
        throw new ApiError(404, 'COUNTRY_NOT_FOUND', `Country '${normalizedCountryCode}' not found.`);
    }

    return {
        country: {
            id: country.id,
            code: country.code,
            name: localizeName(country, lang),
            currencyCode: country.currencyCode,
            currencySymbol: country.currencySymbol,
            phoneCode: country.phoneCode,
        },
        cities: country.cities.map((city) => ({
            id: city.id,
            name: localizeName(city, lang),
            latitude: city.latitude,
            longitude: city.longitude,
        })),
    };
}

export async function getNearestCity(
    latitude: number,
    longitude: number,
    lang: AppLanguage,
): Promise<GeoNearestCityDto> {
    const cities = await prisma.city.findMany({
        where: {
            isActive: true,
            country: {
                isActive: true,
            },
        },
        select: {
            id: true,
            nameAr: true,
            nameEn: true,
            latitude: true,
            longitude: true,
            country: {
                select: {
                    id: true,
                    code: true,
                    nameAr: true,
                    nameEn: true,
                    currencyCode: true,
                    currencySymbol: true,
                },
            },
        },
    });

    if (cities.length === 0) {
        throw new ApiError(404, 'NO_ACTIVE_CITIES', 'No active cities are configured.');
    }

    let nearestCity = cities[0];
    let shortestDistance = haversineDistance(
        latitude,
        longitude,
        nearestCity.latitude,
        nearestCity.longitude,
    );

    for (const city of cities.slice(1)) {
        const distance = haversineDistance(latitude, longitude, city.latitude, city.longitude);
        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestCity = city;
        }
    }

    return {
        city: {
            id: nearestCity.id,
            name: localizeName(nearestCity, lang),
            latitude: nearestCity.latitude,
            longitude: nearestCity.longitude,
        },
        country: {
            id: nearestCity.country.id,
            code: nearestCity.country.code,
            name: localizeName(nearestCity.country, lang),
            currencyCode: nearestCity.country.currencyCode,
            currencySymbol: nearestCity.country.currencySymbol,
        },
        distanceKm: roundTo(shortestDistance, 2),
    };
}
