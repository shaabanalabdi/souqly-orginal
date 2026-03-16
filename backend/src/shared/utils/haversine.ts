// FILE: backend/src/shared/utils/haversine.ts

const EARTH_RADIUS_KM = 6371;

/** Calculate distance in km between two lat/lng points */
export function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const toRad = (deg: number): number => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

export interface GeoBoundingBox {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

/**
 * Build a coarse bounding-box filter (for Prisma WHERE),
 * then refine with haversineDistance in application code.
 */
export function buildGeoBoundingBox(lat: number, lng: number, radiusKm: number): GeoBoundingBox {
    const latDelta = radiusKm / EARTH_RADIUS_KM * (180 / Math.PI);
    const lngDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);

    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
    };
}
