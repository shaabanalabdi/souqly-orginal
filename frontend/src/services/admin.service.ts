import { requestData, requestPaginated } from './client';
import type {
  AdminAuditLog,
  AdminBlacklistEntry,
  AdminDashboardStats,
  AdminFeaturedListingResult,
  AdminFraudFlag,
  AdminIdentityVerification,
  AdminSavedSearchDigestHistoryEntry,
  AdminReport,
  AdminSavedSearchDigestRunResult,
  AdminSavedSearchDigestStatus,
  AccountType,
  BlacklistEntryType,
  DigestHistorySort,
  AdminUser,
  DigestRunMode,
  IdentityVerificationStatus,
  ReportStatus,
  StaffRole,
  UserRole,
} from '../types/domain';

export interface ResolveReportPayload {
  action: 'dismiss' | 'resolve' | 'delete_listing' | 'ban_user';
  resolution?: string;
}

export interface ModerateListingPayload {
  action: 'approve' | 'reject' | 'suspend' | 'delete';
  reason?: string;
}

export interface ModerateUserPayload {
  action: 'activate' | 'deactivate' | 'ban' | 'unban' | 'set_role' | 'set_staff_role' | 'set_account_type';
  role?: UserRole;
  staffRole?: StaffRole;
  accountType?: AccountType;
  reason?: string;
}

export interface CreateBlacklistPayload {
  type: BlacklistEntryType;
  value: string;
  reason?: string;
}

export interface UpdateBlacklistPayload {
  reason?: string;
  isActive?: boolean;
}

export interface ResolveIdentityVerificationPayload {
  action: 'approve' | 'reject';
  reviewerNote?: string;
}

export const adminService = {
  dashboard() {
    return requestData<AdminDashboardStats>({
      method: 'GET',
      url: '/admin/dashboard',
    });
  },

  listReports(status?: ReportStatus, page = 1, limit = 20) {
    return requestPaginated<AdminReport>({
      method: 'GET',
      url: '/admin/reports',
      params: { status, page, limit },
    });
  },

  listAuditLogs(params: { adminId?: number; entityType?: string; action?: string; page?: number; limit?: number } = {}) {
    return requestPaginated<AdminAuditLog>({
      method: 'GET',
      url: '/admin/audit-logs',
      params,
    });
  },

  listFraudFlags(params: { listingId?: number; page?: number; limit?: number } = {}) {
    return requestPaginated<AdminFraudFlag>({
      method: 'GET',
      url: '/admin/fraud-flags',
      params,
    });
  },

  listIdentityVerifications(params: { status?: IdentityVerificationStatus; userId?: number; page?: number; limit?: number } = {}) {
    return requestPaginated<AdminIdentityVerification>({
      method: 'GET',
      url: '/admin/identity-verifications',
      params,
    });
  },

  resolveIdentityVerification(requestId: number, payload: ResolveIdentityVerificationPayload) {
    return requestData<AdminIdentityVerification>({
      method: 'PATCH',
      url: `/admin/identity-verifications/${requestId}`,
      data: payload,
    });
  },

  resolveReport(reportId: number, payload: ResolveReportPayload) {
    return requestData<AdminReport>({
      method: 'PATCH',
      url: `/admin/reports/${reportId}`,
      data: payload,
    });
  },

  moderateListing(listingId: number, payload: ModerateListingPayload) {
    return requestData<{ id: number; status: string; updatedAt: string }>({
      method: 'PATCH',
      url: `/admin/listings/${listingId}`,
      data: payload,
    });
  },

  featureListing(listingId: number, payload: { days?: number; clear?: boolean }) {
    return requestData<AdminFeaturedListingResult>({
      method: 'POST',
      url: `/admin/listings/${listingId}/feature`,
      data: payload,
    });
  },

  listUsers(
    params: {
      role?: UserRole;
      staffRole?: StaffRole;
      accountType?: AccountType;
      active?: boolean;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    return requestPaginated<AdminUser>({
      method: 'GET',
      url: '/admin/users',
      params,
    });
  },

  moderateUser(userId: number, payload: ModerateUserPayload) {
    return requestData<{
      id: number;
      email: string | null;
      role: UserRole;
      accountType: AccountType;
      staffRole: StaffRole;
      isActive: boolean;
      bannedAt: string | null;
      bannedReason: string | null;
      updatedAt: string;
    }>({
      method: 'PATCH',
      url: `/admin/users/${userId}`,
      data: payload,
    });
  },

  listBlacklist(params: {
    type?: BlacklistEntryType;
    q?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    return requestPaginated<AdminBlacklistEntry>({
      method: 'GET',
      url: '/admin/blacklist',
      params,
    });
  },

  createBlacklist(payload: CreateBlacklistPayload) {
    return requestData<AdminBlacklistEntry>({
      method: 'POST',
      url: '/admin/blacklist',
      data: payload,
    });
  },

  updateBlacklist(id: string, payload: UpdateBlacklistPayload) {
    return requestData<AdminBlacklistEntry>({
      method: 'PATCH',
      url: `/admin/blacklist/${id}`,
      data: payload,
    });
  },

  deleteBlacklist(id: string) {
    return requestData<{ id: string }>({
      method: 'DELETE',
      url: `/admin/blacklist/${id}`,
    });
  },

  getSavedSearchDigestStatus() {
    return requestData<AdminSavedSearchDigestStatus>({
      method: 'GET',
      url: '/admin/saved-search-digest/status',
    });
  },

  runSavedSearchDigest(frequency: DigestRunMode = 'both') {
    return requestData<AdminSavedSearchDigestRunResult>({
      method: 'POST',
      url: '/admin/saved-search-digest/run',
      data: { frequency },
    });
  },

  listSavedSearchDigestHistory(params: {
    page?: number;
    limit?: number;
    frequency?: 'daily' | 'weekly';
    source?: 'scheduler' | 'manual';
    sort?: DigestHistorySort;
    minDurationMs?: number;
    maxDurationMs?: number;
    from?: string;
    to?: string;
  } = {}) {
    return requestPaginated<AdminSavedSearchDigestHistoryEntry>({
      method: 'GET',
      url: '/admin/saved-search-digest/history',
      params,
    });
  },
};
