import { z } from 'zod';
import { isManagedMediaUrl } from '../../shared/utils/s3.js';

const documentTypeValues = ['NATIONAL_ID', 'PASSPORT', 'DRIVER_LICENSE', 'OTHER'] as const;

const managedVerificationUrlSchema = z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => isManagedMediaUrl(value, 'verification'), {
        message: 'Verification documents must be uploaded through Souqly managed storage.',
    });

export const identityVerificationRequestBodySchema = z.object({
    documentType: z.enum(documentTypeValues),
    documentNumberMasked: z.string().trim().min(4).max(50).optional(),
    documentFrontUrl: managedVerificationUrlSchema,
    documentBackUrl: managedVerificationUrlSchema.optional(),
    selfieUrl: managedVerificationUrlSchema.optional(),
    note: z.string().trim().max(2000).optional(),
});

export type IdentityVerificationRequestBody = z.infer<typeof identityVerificationRequestBodySchema>;
export type IdentityVerificationDocumentType = (typeof documentTypeValues)[number];
