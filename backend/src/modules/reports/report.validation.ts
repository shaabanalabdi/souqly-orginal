import { ReportReason, ReportStatus } from '@prisma/client';
import { z } from 'zod';

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.nativeEnum(ReportStatus).optional(),
    lang: z.string().optional(),
});

export const createReportBodySchema = z.object({
    reportableType: z.enum(['LISTING', 'USER', 'MESSAGE']),
    reportableId: z.coerce.number().int().positive(),
    reason: z.nativeEnum(ReportReason),
    description: z.string().trim().max(2000).optional(),
    listingId: z.coerce.number().int().positive().optional(),
});

export type CreateReportBody = z.infer<typeof createReportBodySchema>;
