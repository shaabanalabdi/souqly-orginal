import { DealStatus, type Prisma, TrustScoreEventType } from '@prisma/client';
import { prisma } from '../../shared/utils/prisma.js';
import { calculateTrustScoreFromRaw, resolveTrustTier } from '../../shared/utils/trustScore.js';

export interface RecalculateTrustScoreOptions {
    eventType?: TrustScoreEventType;
    metadata?: Prisma.InputJsonValue;
}

export interface RecalculateTrustScoreResult {
    userId: number;
    scoreBefore: number;
    scoreAfter: number;
    delta: number;
}

export async function recalculateUserTrustScore(
    userId: number,
    options: RecalculateTrustScoreOptions = {},
): Promise<RecalculateTrustScoreResult | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            trustScore: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            googleId: true,
            facebookId: true,
            createdAt: true,
            avgResponseHours: true,
        },
    });

    if (!user) {
        return null;
    }

    const [ratingAgg, completedTransactions, disputeCount] = await Promise.all([
        prisma.review.aggregate({
            where: { revieweeId: userId },
            _avg: { rating: true },
        }),
        prisma.deal.count({
            where: {
                status: {
                    in: [DealStatus.COMPLETED, DealStatus.RATED],
                },
                OR: [{ buyerId: userId }, { sellerId: userId }],
            },
        }),
        prisma.disputeCase.count({
            where: {
                deal: {
                    OR: [{ buyerId: userId }, { sellerId: userId }],
                },
            },
        }),
    ]);

    let verificationPoints = 0;
    if (user.emailVerifiedAt) verificationPoints += 1;
    if (user.phoneVerifiedAt) verificationPoints += 1;
    if (user.googleId) verificationPoints += 1;
    if (user.facebookId) verificationPoints += 1;

    const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    const scoreAfter = calculateTrustScoreFromRaw({
        verificationPoints,
        averageRating: ratingAgg._avg.rating ?? 0,
        completedTransactions,
        accountAgeDays,
        avgResponseHours: user.avgResponseHours,
        disputesCount: disputeCount,
    });

    const scoreBefore = user.trustScore;
    const delta = scoreAfter - scoreBefore;

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: {
                trustScore: scoreAfter,
                trustTier: resolveTrustTier(scoreAfter),
            },
        });

        await tx.trustScoreEvent.create({
            data: {
                userId,
                eventType: options.eventType ?? TrustScoreEventType.RECALCULATION,
                delta,
                scoreBefore,
                scoreAfter,
                metadata: options.metadata ?? undefined,
            },
        });
    });

    return {
        userId,
        scoreBefore,
        scoreAfter,
        delta,
    };
}
