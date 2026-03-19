import { prisma } from '../utils/prisma.js';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : {};
}

function getPathValue(source: JsonRecord, path: string[]): unknown {
    let current: unknown = source;
    for (const segment of path) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
            return undefined;
        }
        current = (current as JsonRecord)[segment];
    }
    return current;
}

let configCache: { expiresAt: number; value: JsonRecord } | null = null;

export async function getLatestSystemConfig(): Promise<JsonRecord> {
    const now = Date.now();
    if (configCache && configCache.expiresAt > now) {
        return configCache.value;
    }

    const latest = await prisma.systemConfigVersion.findFirst({
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: {
            configJson: true,
        },
    });

    const value = asRecord(latest?.configJson);
    configCache = {
        value,
        expiresAt: now + 15_000,
    };
    return value;
}

export function clearSystemConfigCache(): void {
    configCache = null;
}

export async function getIndividualMonthlyListingLimit(): Promise<number> {
    const config = await getLatestSystemConfig();
    const candidates = [
        getPathValue(config, ['listingLimits', 'individualPerMonth']),
        getPathValue(config, ['listings', 'individualMonthlyLimit']),
        getPathValue(config, ['limits', 'individualMonthlyListings']),
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
            return Math.floor(candidate);
        }
    }

    return 10;
}

export async function isInternalEscrowEnabled(): Promise<boolean> {
    if ((process.env.ENABLE_INTERNAL_ESCROW ?? '').trim().toLowerCase() === 'true') {
        return true;
    }

    const config = await getLatestSystemConfig();
    const candidates = [
        getPathValue(config, ['launch', 'enableInternalEscrow']),
        getPathValue(config, ['payments', 'enableInternalEscrow']),
    ];

    return candidates.some((candidate) => candidate === true);
}
