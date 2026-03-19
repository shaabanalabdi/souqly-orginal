import { MessageType, OfferStatus } from '@prisma/client';
import { z } from 'zod';

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    lang: z.string().optional(),
});

export const createThreadBodySchema = z.object({
    listingId: z.coerce.number().int().positive(),
});

export const threadIdParamsSchema = z.object({
    threadId: z.coerce.number().int().positive(),
});

export const sendMessageBodySchema = z
    .object({
        type: z.enum([MessageType.TEXT, MessageType.IMAGE]).optional().default(MessageType.TEXT),
        content: z.string().trim().max(5000).optional(),
        imageUrl: z.string().trim().url().max(500).optional(),
    })
    .superRefine((value, ctx) => {
        if (value.type === MessageType.TEXT && !value.content) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['content'],
                message: 'content is required for TEXT messages.',
            });
        }

        if (value.type === MessageType.IMAGE && !value.imageUrl) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['imageUrl'],
                message: 'imageUrl is required for IMAGE messages.',
            });
        }
    });

export const phoneRequestBodySchema = z.object({
    message: z.string().trim().max(500).optional(),
});

export const phoneRequestResponseBodySchema = z.object({
    action: z.enum(['approve', 'reject']),
});

export const createOfferBodySchema = z.object({
    amount: z.coerce.number().positive(),
    quantity: z.coerce.number().int().positive().optional().default(1),
    message: z.string().trim().max(1000).optional(),
});

export const offerIdParamsSchema = z.object({
    offerId: z.coerce.number().int().positive(),
});

export const listOffersQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.nativeEnum(OfferStatus).optional(),
    lang: z.string().optional(),
});

export const respondOfferBodySchema = z
    .object({
        action: z.enum(['accept', 'reject', 'counter']),
        counterAmount: z.coerce.number().positive().optional(),
    })
    .superRefine((value, ctx) => {
        if (value.action === 'counter' && value.counterAmount === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['counterAmount'],
                message: 'counterAmount is required when action is counter.',
            });
        }
    });

export type PhoneRequestResponseBody = z.infer<typeof phoneRequestResponseBodySchema>;
