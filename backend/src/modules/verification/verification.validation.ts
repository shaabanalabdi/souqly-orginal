import { z } from 'zod';

const documentTypeValues = ['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'OTHER'] as const;

export const identityVerificationRequestBodySchema = z.object({
    documentType: z.enum(documentTypeValues),
    documentNumberMasked: z.string().trim().min(4).max(50).optional(),
    documentFrontUrl: z.string().trim().url().max(500),
    documentBackUrl: z.string().trim().url().max(500).optional(),
    selfieUrl: z.string().trim().url().max(500).optional(),
    note: z.string().trim().max(2000).optional(),
});

export type IdentityVerificationRequestBody = z.infer<typeof identityVerificationRequestBodySchema>;
export type IdentityVerificationDocumentType = (typeof documentTypeValues)[number];
