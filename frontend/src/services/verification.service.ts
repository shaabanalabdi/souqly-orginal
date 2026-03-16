import { requestData } from './client';
import type { MyIdentityVerificationResult } from '../types/domain';

export type IdentityDocumentType = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVER_LICENSE' | 'OTHER';

export interface SubmitIdentityVerificationPayload {
  documentType: IdentityDocumentType;
  documentNumberMasked?: string;
  documentFrontUrl: string;
  documentBackUrl?: string;
  selfieUrl?: string;
  note?: string;
}

export interface SubmitIdentityVerificationResult {
  status: 'PENDING';
  request: {
    id: number;
    userId: number;
    status: 'PENDING';
    documentType: string;
    documentNumberMasked: string | null;
    documentFrontUrl: string | null;
    documentBackUrl: string | null;
    selfieUrl: string | null;
    note: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    reviewerId: number | null;
    reviewerNote: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export const verificationService = {
  getMyIdentityVerification() {
    return requestData<MyIdentityVerificationResult>({
      method: 'GET',
      url: '/verification/identity/me',
    });
  },

  submitIdentityVerification(payload: SubmitIdentityVerificationPayload) {
    return requestData<SubmitIdentityVerificationResult>({
      method: 'POST',
      url: '/verification/identity/request',
      data: payload,
    });
  },
};
