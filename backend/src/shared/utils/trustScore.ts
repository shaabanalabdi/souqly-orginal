import { TrustTier } from '@prisma/client';

const TRUST_SCORE_WEIGHTS = {
    verification: 20,
    rating: 30,
    transactions: 15,
    accountAge: 10,
    responseTime: 15,
    disputes: 10,
} as const;

export interface TrustScoreInputs {
    verification: number;
    rating: number;
    transactions: number;
    accountAge: number;
    responseTime: number;
    disputes: number;
}

export interface TrustScoreRawMetrics {
    verificationPoints: number;
    averageRating: number;
    completedTransactions: number;
    accountAgeDays: number;
    avgResponseHours: number | null;
    disputesCount: number;
}

function clampToRange(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function clamp01(value: number): number {
    return clampToRange(value, 0, 1);
}

/**
 * Weighted Trust Score formula from PRD:
 * score = (Verification * 20) + (Rating * 30) + (Transactions * 15) +
 *         (Account Age * 10) + (Response Time * 15) + (Disputes * 10)
 * Inputs must be normalized between 0 and 1.
 */
export function calculateTrustScore(inputs: TrustScoreInputs): number {
    const normalizedInputs: TrustScoreInputs = {
        verification: clamp01(inputs.verification),
        rating: clamp01(inputs.rating),
        transactions: clamp01(inputs.transactions),
        accountAge: clamp01(inputs.accountAge),
        responseTime: clamp01(inputs.responseTime),
        disputes: clamp01(inputs.disputes),
    };

    const score =
        normalizedInputs.verification * TRUST_SCORE_WEIGHTS.verification +
        normalizedInputs.rating * TRUST_SCORE_WEIGHTS.rating +
        normalizedInputs.transactions * TRUST_SCORE_WEIGHTS.transactions +
        normalizedInputs.accountAge * TRUST_SCORE_WEIGHTS.accountAge +
        normalizedInputs.responseTime * TRUST_SCORE_WEIGHTS.responseTime +
        normalizedInputs.disputes * TRUST_SCORE_WEIGHTS.disputes;

    return Math.round(score);
}

export function normalizeTrustScoreMetrics(raw: TrustScoreRawMetrics): TrustScoreInputs {
    const completedTransactions = Math.max(raw.completedTransactions, 0);
    const disputesCount = Math.max(raw.disputesCount, 0);

    const verification = clamp01(raw.verificationPoints / 5);
    const rating = clamp01(raw.averageRating / 5);
    const transactions = clamp01(completedTransactions / 100);
    const accountAge = clamp01(Math.max(raw.accountAgeDays, 0) / 365);

    const responseTimeWindowHours = 72;
    const responseTime =
        raw.avgResponseHours === null
            ? 0.5
            : 1 - clamp01(Math.max(raw.avgResponseHours, 0) / responseTimeWindowHours);

    const disputesRatio =
        completedTransactions > 0
            ? disputesCount / completedTransactions
            : disputesCount > 0
                ? 1
                : 0;
    const disputes = 1 - clamp01(disputesRatio);

    return {
        verification,
        rating,
        transactions,
        accountAge,
        responseTime,
        disputes,
    };
}

export function calculateTrustScoreFromRaw(raw: TrustScoreRawMetrics): number {
    return calculateTrustScore(normalizeTrustScoreMetrics(raw));
}

export function resolveTrustTier(score: number): TrustTier {
    const safeScore = clampToRange(score, 0, 100);

    if (safeScore >= 85) {
        return TrustTier.TOP_SELLER;
    }

    if (safeScore >= 65) {
        return TrustTier.TRUSTED;
    }

    if (safeScore >= 40) {
        return TrustTier.VERIFIED;
    }

    return TrustTier.NEW;
}
