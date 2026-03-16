import { ListingStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma.js';
import { isBlockedValue, matchBlockedKeywords } from '../../shared/moderation/blacklist.service.js';

export type FraudSignalSeverity = 'low' | 'medium' | 'high';

export interface FraudSignal {
    code:
        | 'BLACKLISTED_PHONE'
        | 'BLACKLISTED_IP'
        | 'BLACKLISTED_KEYWORD'
        | 'PRICE_ANOMALY_LOW'
        | 'PRICE_ANOMALY_HIGH'
        | 'DUPLICATE_DESCRIPTION'
        | 'DUPLICATE_IMAGE'
        | 'NEW_ACCOUNT_HIGH_VALUE';
    severity: FraudSignalSeverity;
    message: string;
    meta?: Record<string, unknown>;
}

export interface EvaluateListingFraudInput {
    userId: number;
    userCreatedAt: Date;
    userPhone: string | null;
    ipAddress?: string | null;
    subcategoryId: number;
    titleAr: string;
    descriptionAr: string;
    priceAmount: number | null;
    images: string[];
}

export interface ListingFraudEvaluation {
    signals: FraudSignal[];
    riskScore: number;
    requiresManualReview: boolean;
}

const DEFAULT_LOW_PRICE_RATIO = 0.25;
const DEFAULT_HIGH_PRICE_RATIO = 4;
const DEFAULT_NEW_ACCOUNT_DAYS = 7;
const DEFAULT_HIGH_VALUE_THRESHOLD = 5000;

function parsePositiveFloat(raw: string | undefined, fallback: number): number {
    if (!raw) {
        return fallback;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }

    return parsed;
}

function severityWeight(severity: FraudSignalSeverity): number {
    if (severity === 'high') return 50;
    if (severity === 'medium') return 25;
    return 10;
}

async function detectPriceAnomaly(
    input: EvaluateListingFraudInput,
    signals: FraudSignal[],
): Promise<void> {
    if (input.priceAmount === null) {
        return;
    }

    const lowRatio = parsePositiveFloat(process.env.ANTI_FRAUD_LOW_PRICE_RATIO, DEFAULT_LOW_PRICE_RATIO);
    const highRatio = parsePositiveFloat(process.env.ANTI_FRAUD_HIGH_PRICE_RATIO, DEFAULT_HIGH_PRICE_RATIO);

    const aggregate = await prisma.listing.aggregate({
        where: {
            subcategoryId: input.subcategoryId,
            status: ListingStatus.ACTIVE,
            priceAmount: { not: null },
        },
        _avg: { priceAmount: true },
    });

    const average = aggregate._avg.priceAmount;
    if (!average || average <= 0) {
        return;
    }

    const ratio = input.priceAmount / average;
    if (ratio < lowRatio) {
        signals.push({
            code: 'PRICE_ANOMALY_LOW',
            severity: 'medium',
            message: 'Listing price is significantly lower than category average.',
            meta: {
                submittedPrice: input.priceAmount,
                categoryAverage: average,
                ratio,
            },
        });
    } else if (ratio > highRatio) {
        signals.push({
            code: 'PRICE_ANOMALY_HIGH',
            severity: 'low',
            message: 'Listing price is significantly higher than category average.',
            meta: {
                submittedPrice: input.priceAmount,
                categoryAverage: average,
                ratio,
            },
        });
    }
}

async function detectDuplicateDescription(
    input: EvaluateListingFraudInput,
    signals: FraudSignal[],
): Promise<void> {
    const trimmedDescription = input.descriptionAr.trim();
    if (trimmedDescription.length < 40) {
        return;
    }

    const duplicate = await prisma.listing.findFirst({
        where: {
            userId: { not: input.userId },
            status: { in: [ListingStatus.PENDING, ListingStatus.ACTIVE] },
            descriptionAr: trimmedDescription,
        },
        select: { id: true, userId: true },
    });

    if (!duplicate) {
        return;
    }

    signals.push({
        code: 'DUPLICATE_DESCRIPTION',
        severity: 'high',
        message: 'Listing description duplicates another listing text.',
        meta: {
            matchedListingId: duplicate.id,
            matchedUserId: duplicate.userId,
        },
    });
}

async function detectDuplicateImages(
    input: EvaluateListingFraudInput,
    signals: FraudSignal[],
): Promise<void> {
    if (input.images.length === 0) {
        return;
    }

    const duplicateImage = await prisma.listingImage.findFirst({
        where: {
            urlOriginal: { in: input.images },
            listing: {
                userId: { not: input.userId },
                status: { in: [ListingStatus.PENDING, ListingStatus.ACTIVE] },
            },
        },
        select: {
            listingId: true,
            listing: {
                select: {
                    userId: true,
                },
            },
        },
    });

    if (!duplicateImage) {
        return;
    }

    signals.push({
        code: 'DUPLICATE_IMAGE',
        severity: 'high',
        message: 'One or more listing images were already used in another account.',
        meta: {
            matchedListingId: duplicateImage.listingId,
            matchedUserId: duplicateImage.listing.userId,
        },
    });
}

async function detectBlacklistSignals(
    input: EvaluateListingFraudInput,
    signals: FraudSignal[],
): Promise<void> {
    const [phoneBlocked, ipBlocked, keywordMatches] = await Promise.all([
        isBlockedValue('phone', input.userPhone),
        isBlockedValue('ip', input.ipAddress ?? null),
        matchBlockedKeywords(`${input.titleAr}\n${input.descriptionAr}`),
    ]);

    if (phoneBlocked) {
        signals.push({
            code: 'BLACKLISTED_PHONE',
            severity: 'high',
            message: 'The account phone number appears on blacklist.',
        });
    }

    if (ipBlocked) {
        signals.push({
            code: 'BLACKLISTED_IP',
            severity: 'high',
            message: 'The request IP appears on blacklist.',
        });
    }

    if (keywordMatches.length > 0) {
        signals.push({
            code: 'BLACKLISTED_KEYWORD',
            severity: 'medium',
            message: 'Listing text contains blocked keywords.',
            meta: {
                keywords: keywordMatches,
            },
        });
    }
}

function detectNewAccountHighValue(
    input: EvaluateListingFraudInput,
    signals: FraudSignal[],
): void {
    if (input.priceAmount === null) {
        return;
    }

    const newAccountDays = parsePositiveFloat(process.env.ANTI_FRAUD_NEW_ACCOUNT_DAYS, DEFAULT_NEW_ACCOUNT_DAYS);
    const highValueThreshold = parsePositiveFloat(
        process.env.ANTI_FRAUD_HIGH_VALUE_THRESHOLD,
        DEFAULT_HIGH_VALUE_THRESHOLD,
    );

    const accountAgeMs = Date.now() - input.userCreatedAt.getTime();
    const accountAgeDays = accountAgeMs / (24 * 60 * 60 * 1000);
    if (accountAgeDays <= newAccountDays && input.priceAmount >= highValueThreshold) {
        signals.push({
            code: 'NEW_ACCOUNT_HIGH_VALUE',
            severity: 'high',
            message: 'New account posted a high-value listing.',
            meta: {
                accountAgeDays: Number(accountAgeDays.toFixed(2)),
                priceAmount: input.priceAmount,
                highValueThreshold,
            },
        });
    }
}

export async function evaluateListingFraudSignals(
    input: EvaluateListingFraudInput,
): Promise<ListingFraudEvaluation> {
    const antiFraudEnabled = (process.env.ANTI_FRAUD_ENABLED ?? 'true').toLowerCase() !== 'false';
    if (!antiFraudEnabled || process.env.NODE_ENV === 'test') {
        return {
            signals: [],
            riskScore: 0,
            requiresManualReview: false,
        };
    }

    const signals: FraudSignal[] = [];

    await Promise.all([
        detectBlacklistSignals(input, signals),
        detectPriceAnomaly(input, signals),
        detectDuplicateDescription(input, signals),
        detectDuplicateImages(input, signals),
    ].map(async (task) => {
        try {
            await task;
        } catch {
            // Safety-first fallback: anti-fraud checks should not block listing creation on transient failures.
        }
    }));

    detectNewAccountHighValue(input, signals);

    const riskScore = Math.min(100, signals.reduce((sum, signal) => sum + severityWeight(signal.severity), 0));

    return {
        signals,
        riskScore,
        requiresManualReview: signals.length > 0,
    };
}

export async function recordListingFraudSignals(input: {
    listingId: number;
    actorUserId: number;
    ipAddress?: string | null;
    evaluation: ListingFraudEvaluation;
}): Promise<void> {
    if (input.evaluation.signals.length === 0) {
        return;
    }

    const payload = JSON.parse(
        JSON.stringify({
            riskScore: input.evaluation.riskScore,
            signals: input.evaluation.signals,
            actorUserId: input.actorUserId,
            ipAddress: input.ipAddress ?? null,
            flaggedAt: new Date().toISOString(),
        }),
    ) as Prisma.InputJsonValue;

    await prisma.auditLog.create({
        data: {
            adminId: input.actorUserId,
            action: 'LISTING_FRAUD_FLAGGED',
            entityType: 'listing',
            entityId: input.listingId,
            oldData: undefined,
            newData: payload,
            ipAddress: input.ipAddress ?? null,
        },
    });
}
