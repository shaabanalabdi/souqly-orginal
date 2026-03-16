import { TrustTier } from '@prisma/client';
import {
    calculateTrustScore,
    calculateTrustScoreFromRaw,
    normalizeTrustScoreMetrics,
    resolveTrustTier,
} from '../shared/utils/trustScore.js';

describe('Trust score', () => {
    it('computes weighted score from normalized inputs', () => {
        const score = calculateTrustScore({
            verification: 1,
            rating: 0.8,
            transactions: 0.5,
            accountAge: 0.5,
            responseTime: 0.5,
            disputes: 0.9,
        });

        expect(score).toBe(73);
    });

    it('normalizes raw metrics before scoring', () => {
        const normalized = normalizeTrustScoreMetrics({
            verificationPoints: 4,
            averageRating: 4.5,
            completedTransactions: 40,
            accountAgeDays: 200,
            avgResponseHours: 12,
            disputesCount: 2,
        });

        expect(normalized.verification).toBeCloseTo(0.8);
        expect(normalized.rating).toBeCloseTo(0.9);
        expect(normalized.transactions).toBeCloseTo(0.4);
        expect(normalized.accountAge).toBeCloseTo(200 / 365);
        expect(normalized.responseTime).toBeCloseTo(1 - 12 / 72);
        expect(normalized.disputes).toBeCloseTo(0.95);
    });

    it('maps score to trust tiers', () => {
        expect(resolveTrustTier(20)).toBe(TrustTier.NEW);
        expect(resolveTrustTier(50)).toBe(TrustTier.VERIFIED);
        expect(resolveTrustTier(70)).toBe(TrustTier.TRUSTED);
        expect(resolveTrustTier(95)).toBe(TrustTier.TOP_SELLER);
    });

    it('supports direct raw metric calculation', () => {
        const score = calculateTrustScoreFromRaw({
            verificationPoints: 5,
            averageRating: 5,
            completedTransactions: 120,
            accountAgeDays: 500,
            avgResponseHours: 1,
            disputesCount: 0,
        });

        expect(score).toBe(100);
    });
});
