import { DealStatus, DeliveryMethod } from '@prisma/client';
import { z } from 'zod';

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.nativeEnum(DealStatus).optional(),
    lang: z.string().optional(),
});

export const createDealFromOfferBodySchema = z
    .object({
        offerId: z.coerce.number().int().positive(),
        finalPrice: z.coerce.number().positive().optional(),
        quantity: z.coerce.number().int().positive().optional().default(1),
        currency: z.string().trim().toUpperCase().min(3).max(5).optional(),
        meetingPlace: z.string().trim().max(300).optional(),
        meetingLat: z.coerce.number().min(-90).max(90).optional(),
        meetingLng: z.coerce.number().min(-180).max(180).optional(),
        meetingTime: z.coerce.date().optional(),
        deliveryMethod: z.nativeEnum(DeliveryMethod).optional().default(DeliveryMethod.PICKUP),
        courierName: z.string().trim().max(100).optional(),
        trackingNumber: z.string().trim().max(100).optional(),
    })
    .superRefine((value, ctx) => {
        const hasLat = value.meetingLat !== undefined;
        const hasLng = value.meetingLng !== undefined;
        if (hasLat !== hasLng) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['meetingLat'],
                message: 'meetingLat and meetingLng must be provided together.',
            });
        }
    });

export const dealIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const createReviewBodySchema = z.object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(1000).optional(),
});

export const holdEscrowBodySchema = z
    .object({
        amount: z.coerce.number().positive().optional(),
        currency: z.string().trim().toUpperCase().min(3).max(5).optional(),
        providerRef: z.string().trim().max(120).optional(),
    })
    .superRefine((value, ctx) => {
        if (value.amount === undefined && value.currency !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['amount'],
                message: 'amount is required when currency is provided.',
            });
        }
    });

export const createDisputeBodySchema = z.object({
    reason: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10).max(4000),
});

export const reviewDisputeBodySchema = z.object({
    note: z.string().trim().max(2000).optional(),
});

export const resolveDisputeBodySchema = z.object({
    action: z.enum(['release_escrow', 'refund_escrow', 'close_no_escrow']),
    resolution: z.string().trim().max(2000).optional(),
});

export const escrowWebhookBodySchema = z
    .object({
        eventId: z.string().trim().min(1).max(120),
        eventType: z.enum([
            'escrow.held',
            'escrow.released',
            'escrow.refunded',
            'dispute.opened',
            'dispute.resolved',
        ]),
        dealId: z.coerce.number().int().positive().optional(),
        providerRef: z.string().trim().max(120).optional(),
        amount: z.coerce.number().positive().optional(),
        currency: z.string().trim().toUpperCase().min(3).max(5).optional(),
        reason: z.string().trim().max(200).optional(),
        description: z.string().trim().max(4000).optional(),
        resolution: z.string().trim().max(2000).optional(),
        resolutionAction: z.enum(['release_escrow', 'refund_escrow', 'close_no_escrow']).optional(),
    })
    .superRefine((value, ctx) => {
        if (value.dealId === undefined && !value.providerRef) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['dealId'],
                message: 'dealId or providerRef is required.',
            });
        }

        if ((value.eventType === 'escrow.held') && value.amount === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['amount'],
                message: 'amount is required for escrow.held events.',
            });
        }
    });

export type CreateDealFromOfferBody = z.infer<typeof createDealFromOfferBodySchema>;
export type CreateReviewBody = z.infer<typeof createReviewBodySchema>;
export type HoldEscrowBody = z.infer<typeof holdEscrowBodySchema>;
export type CreateDisputeBody = z.infer<typeof createDisputeBodySchema>;
export type ReviewDisputeBody = z.infer<typeof reviewDisputeBodySchema>;
export type ResolveDisputeBody = z.infer<typeof resolveDisputeBodySchema>;
export type EscrowWebhookBody = z.infer<typeof escrowWebhookBodySchema>;
