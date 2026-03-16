import { useEffect, useState } from 'react';
import { adminService } from '../services/admin.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { PaginationMeta } from '../types/api';
import type {
  AdminAuditLog,
  AdminBlacklistEntry,
  AdminDashboardStats,
  AdminFraudFlag,
  AdminIdentityVerification,
  AdminSavedSearchDigestHistoryEntry,
  AdminReport,
  AdminSavedSearchDigestStatus,
  AdminUser,
  AccountType,
  BlacklistEntryType,
  DigestHistorySort,
  DigestRunMode,
  IdentityVerificationStatus,
  ReportStatus,
  StaffRole,
} from '../types/domain';
import { formatDate } from '../utils/format';

type ReportStatusFilter = '' | ReportStatus;
type IdentityVerificationStatusFilter = '' | IdentityVerificationStatus;
type DigestHistoryFrequencyFilter = '' | 'daily' | 'weekly';
type DigestHistorySourceFilter = '' | 'scheduler' | 'manual';
type BlacklistActiveFilter = '' | 'true' | 'false';

function csvEscape(value: string | number): string {
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function toIsoStartOfDay(dateValue: string): string | undefined {
  if (!dateValue) return undefined;
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function toIsoEndOfDay(dateValue: string): string | undefined {
  if (!dateValue) return undefined;
  const date = new Date(`${dateValue}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return '0 ms';
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function AdminPage() {
  const staffRole = useAuthStore((state) => state.user?.staffRole);
  const isAdmin = staffRole === 'ADMIN';

  const [dashboard, setDashboard] = useState<AdminDashboardStats | null>(null);
  const [digestStatus, setDigestStatus] = useState<AdminSavedSearchDigestStatus | null>(null);
  const [digestHistory, setDigestHistory] = useState<AdminSavedSearchDigestHistoryEntry[]>([]);
  const [digestHistoryMeta, setDigestHistoryMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [digestHistoryPage, setDigestHistoryPage] = useState(1);
  const [digestHistoryLimit, setDigestHistoryLimit] = useState(20);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [fraudFlags, setFraudFlags] = useState<AdminFraudFlag[]>([]);
  const [identityVerifications, setIdentityVerifications] = useState<AdminIdentityVerification[]>([]);
  const [blacklistEntries, setBlacklistEntries] = useState<AdminBlacklistEntry[]>([]);
  const [identityVerificationFilter, setIdentityVerificationFilter] = useState<IdentityVerificationStatusFilter>('');
  const [digestHistoryFrequencyFilter, setDigestHistoryFrequencyFilter] = useState<DigestHistoryFrequencyFilter>('');
  const [digestHistorySourceFilter, setDigestHistorySourceFilter] = useState<DigestHistorySourceFilter>('');
  const [digestHistorySort, setDigestHistorySort] = useState<DigestHistorySort>('completed_desc');
  const [digestHistoryFromDate, setDigestHistoryFromDate] = useState('');
  const [digestHistoryToDate, setDigestHistoryToDate] = useState('');
  const [digestHistoryMinDurationMs, setDigestHistoryMinDurationMs] = useState('');
  const [digestHistoryMaxDurationMs, setDigestHistoryMaxDurationMs] = useState('');
  const [reportsFilter, setReportsFilter] = useState<ReportStatusFilter>('');
  const [auditAdminFilter, setAuditAdminFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [fraudListingFilter, setFraudListingFilter] = useState('');
  const [blacklistTypeFilter, setBlacklistTypeFilter] = useState<'' | BlacklistEntryType>('');
  const [blacklistActiveFilter, setBlacklistActiveFilter] = useState<BlacklistActiveFilter>('');
  const [blacklistQueryFilter, setBlacklistQueryFilter] = useState('');
  const [blacklistCreateType, setBlacklistCreateType] = useState<BlacklistEntryType>('keyword');
  const [blacklistCreateValue, setBlacklistCreateValue] = useState('');
  const [blacklistCreateReason, setBlacklistCreateReason] = useState('');
  const [featureListingId, setFeatureListingId] = useState('');
  const [featureDays, setFeatureDays] = useState('7');
  const [loading, setLoading] = useState(false);
  const [digestRunning, setDigestRunning] = useState<DigestRunMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [reportIdAction, setReportIdAction] = useState('');
  const [reportAction, setReportAction] = useState<'dismiss' | 'resolve' | 'delete_listing' | 'ban_user'>('resolve');
  const [reportResolution, setReportResolution] = useState('');

  const [listingIdAction, setListingIdAction] = useState('');
  const [listingAction, setListingAction] = useState<'approve' | 'reject' | 'suspend' | 'delete'>('approve');
  const [listingReason, setListingReason] = useState('');
  const [identityVerificationIdAction, setIdentityVerificationIdAction] = useState('');
  const [identityVerificationAction, setIdentityVerificationAction] = useState<'approve' | 'reject'>('approve');
  const [identityVerificationReviewerNote, setIdentityVerificationReviewerNote] = useState('');

  const [userIdAction, setUserIdAction] = useState('');
  const [userAction, setUserAction] = useState<
    'activate' | 'deactivate' | 'ban' | 'unban' | 'set_staff_role' | 'set_account_type'
  >('activate');
  const [userStaffRole, setUserStaffRole] = useState<StaffRole>('NONE');
  const [userAccountType, setUserAccountType] = useState<AccountType>('INDIVIDUAL');
  const [userReason, setUserReason] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardResult, digestStatusResult, digestHistoryResult, reportsResult, auditLogsResult, fraudFlagsResult, identityVerificationsResult, blacklistResult] = await Promise.all([
        adminService.dashboard(),
        adminService.getSavedSearchDigestStatus(),
        adminService.listSavedSearchDigestHistory({
          page: digestHistoryPage,
          limit: digestHistoryLimit,
          frequency: digestHistoryFrequencyFilter || undefined,
          source: digestHistorySourceFilter || undefined,
          sort: digestHistorySort,
          minDurationMs: digestHistoryMinDurationMs.trim().length > 0
            && Number.isFinite(Number(digestHistoryMinDurationMs))
            && Number(digestHistoryMinDurationMs) >= 0
            ? Number(digestHistoryMinDurationMs)
            : undefined,
          maxDurationMs: digestHistoryMaxDurationMs.trim().length > 0
            && Number.isFinite(Number(digestHistoryMaxDurationMs))
            && Number(digestHistoryMaxDurationMs) >= 0
            ? Number(digestHistoryMaxDurationMs)
            : undefined,
          from: toIsoStartOfDay(digestHistoryFromDate),
          to: toIsoEndOfDay(digestHistoryToDate),
        }),
        adminService.listReports(reportsFilter || undefined),
        adminService.listAuditLogs({
          page: 1,
          limit: 20,
          adminId: Number.isFinite(Number(auditAdminFilter)) && Number(auditAdminFilter) > 0
            ? Number(auditAdminFilter)
            : undefined,
          entityType: auditEntityFilter.trim() || undefined,
          action: auditActionFilter.trim() || undefined,
        }),
        adminService.listFraudFlags({
          page: 1,
          limit: 20,
          listingId: Number.isFinite(Number(fraudListingFilter)) && Number(fraudListingFilter) > 0
            ? Number(fraudListingFilter)
            : undefined,
        }),
        adminService.listIdentityVerifications({
          page: 1,
          limit: 20,
          status: identityVerificationFilter || undefined,
        }),
        adminService.listBlacklist({
          page: 1,
          limit: 50,
          type: blacklistTypeFilter || undefined,
          q: blacklistQueryFilter.trim() || undefined,
          active: blacklistActiveFilter === ''
            ? undefined
            : blacklistActiveFilter === 'true',
        }),
      ]);
      setDashboard(dashboardResult);
      setDigestStatus(digestStatusResult);
      setDigestHistory(digestHistoryResult.items);
      setDigestHistoryMeta(digestHistoryResult.meta);
      setReports(reportsResult.items);
      setAuditLogs(auditLogsResult.items);
      setFraudFlags(fraudFlagsResult.items);
      setIdentityVerifications(identityVerificationsResult.items);
      setBlacklistEntries(blacklistResult.items);

      if (isAdmin) {
        const usersResult = await adminService.listUsers({ page: 1, limit: 50 });
        setUsers(usersResult.items);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reportsFilter,
    identityVerificationFilter,
    auditAdminFilter,
    auditEntityFilter,
    auditActionFilter,
    fraudListingFilter,
    blacklistTypeFilter,
    blacklistActiveFilter,
    blacklistQueryFilter,
    digestHistoryFrequencyFilter,
    digestHistorySourceFilter,
    digestHistorySort,
    digestHistoryFromDate,
    digestHistoryToDate,
    digestHistoryMinDurationMs,
    digestHistoryMaxDurationMs,
    digestHistoryPage,
    digestHistoryLimit,
    isAdmin,
  ]);

  const handleResolveReport = async () => {
    const reportId = Number(reportIdAction);
    if (!Number.isFinite(reportId) || reportId <= 0) return;
    setMessage(null);
    try {
      await adminService.resolveReport(reportId, {
        action: reportAction,
        resolution: reportResolution || undefined,
      });
      setMessage(`Report #${reportId} updated.`);
      setReportIdAction('');
      setReportResolution('');
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleModerateListing = async () => {
    const listingId = Number(listingIdAction);
    if (!Number.isFinite(listingId) || listingId <= 0) return;
    setMessage(null);
    try {
      await adminService.moderateListing(listingId, {
        action: listingAction,
        reason: listingReason || undefined,
      });
      setMessage(`Listing #${listingId} moderated with action ${listingAction}.`);
      setListingIdAction('');
      setListingReason('');
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleResolveIdentityVerification = async () => {
    const requestId = Number(identityVerificationIdAction);
    if (!Number.isFinite(requestId) || requestId <= 0) return;

    setMessage(null);
    try {
      await adminService.resolveIdentityVerification(requestId, {
        action: identityVerificationAction,
        reviewerNote: identityVerificationReviewerNote.trim() || undefined,
      });
      setMessage(`Identity verification #${requestId} updated with action ${identityVerificationAction}.`);
      setIdentityVerificationIdAction('');
      setIdentityVerificationReviewerNote('');
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleModerateUser = async () => {
    const userId = Number(userIdAction);
    if (!Number.isFinite(userId) || userId <= 0) return;
    setMessage(null);
    try {
      await adminService.moderateUser(userId, {
        action: userAction,
        staffRole: userAction === 'set_staff_role' ? userStaffRole : undefined,
        accountType: userAction === 'set_account_type' ? userAccountType : undefined,
        reason: userReason || undefined,
      });
      setMessage(`User #${userId} moderated with action ${userAction}.`);
      setUserIdAction('');
      setUserReason('');
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleFeatureListing = async (clear = false) => {
    const listingId = Number(featureListingId);
    if (!Number.isFinite(listingId) || listingId <= 0) return;

    setMessage(null);
    try {
      const result = await adminService.featureListing(listingId, {
        clear,
        days: clear ? undefined : (Number.isFinite(Number(featureDays)) && Number(featureDays) > 0 ? Number(featureDays) : 7),
      });
      setMessage(
        result.isFeatured
          ? `Listing #${result.id} featured until ${formatDate(result.featuredUntil)}.`
          : `Listing #${result.id} is no longer featured.`,
      );
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleCreateBlacklist = async () => {
    if (!blacklistCreateValue.trim()) return;
    setMessage(null);
    try {
      await adminService.createBlacklist({
        type: blacklistCreateType,
        value: blacklistCreateValue.trim(),
        reason: blacklistCreateReason.trim() || undefined,
      });
      setBlacklistCreateValue('');
      setBlacklistCreateReason('');
      setMessage('Blacklist entry created.');
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleToggleBlacklistEntry = async (entry: AdminBlacklistEntry) => {
    setMessage(null);
    try {
      await adminService.updateBlacklist(entry.id, {
        isActive: !entry.isActive,
      });
      setMessage(`Blacklist entry #${entry.id} updated.`);
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleDeleteBlacklistEntry = async (entryId: string) => {
    setMessage(null);
    try {
      await adminService.deleteBlacklist(entryId);
      setMessage(`Blacklist entry #${entryId} deleted.`);
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleRunDigest = async (frequency: DigestRunMode) => {
    setDigestRunning(frequency);
    setMessage(null);
    try {
      const result = await adminService.runSavedSearchDigest(frequency);
      const runsSummary = result.runs
        .map((run) => `${run.frequency}: ${run.matchedListings} listings / ${run.notifiedUsers} users`)
        .join(' | ');
      const skippedSummary = result.skipped
        .map((item) => `${item.frequency}:${item.reason}`)
        .join(' | ');

      setMessage(
        [
          `Digest run (${result.frequency}) done.`,
          runsSummary ? `Runs -> ${runsSummary}.` : '',
          skippedSummary ? `Skipped -> ${skippedSummary}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
      await loadAll();
    } catch (err) {
      setMessage(asHttpError(err).message);
    } finally {
      setDigestRunning(null);
    }
  };

  const handleExportDigestHistoryCsv = () => {
    if (digestHistory.length === 0) {
      setMessage('No digest history rows to export.');
      return;
    }

    const headers = [
      'id',
      'source',
      'frequency',
      'processedSearches',
      'matchedSearches',
      'matchedListings',
      'notifiedUsers',
      'emailedUsers',
      'startedAt',
      'completedAt',
      'durationMs',
      'recordedAt',
    ];

    const lines = [
      headers.join(','),
      ...digestHistory.map((entry) =>
        [
          csvEscape(entry.id),
          csvEscape(entry.source),
          csvEscape(entry.frequency),
          csvEscape(entry.processedSearches),
          csvEscape(entry.matchedSearches),
          csvEscape(entry.matchedListings),
          csvEscape(entry.notifiedUsers),
          csvEscape(entry.emailedUsers),
          csvEscape(entry.startedAt),
          csvEscape(entry.completedAt),
          csvEscape(entry.durationMs),
          csvEscape(entry.recordedAt),
        ].join(','),
      ),
    ];

    const csvContent = `${lines.join('\n')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `saved-search-digest-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack">
      <h1 className="page-title">Admin Console</h1>
      <p className="page-subtitle">
        Dashboard, moderation queue, listing moderation, and user controls.
      </p>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="muted-text">{message}</p> : null}

      <section className="card">
        <div className="card__header">
          <h2>Dashboard</h2>
          <button type="button" className="button button--secondary" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
        </div>
        {dashboard ? (
          <div className="grid grid--2">
            <div className="row">
              <div className="row__title">Users</div>
              <div className="row__meta">
                Total: {dashboard.users.total} • Active: {dashboard.users.active} • Banned: {dashboard.users.banned}
              </div>
            </div>
            <div className="row">
              <div className="row__title">Listings</div>
              <div className="row__meta">
                Total: {dashboard.listings.total} • Active: {dashboard.listings.active} • Pending:{' '}
                {dashboard.listings.pending} • Rejected: {dashboard.listings.rejected}
              </div>
            </div>
            <div className="row">
              <div className="row__title">Reports</div>
              <div className="row__meta">
                Total: {dashboard.reports.total} • Pending: {dashboard.reports.pending}
              </div>
            </div>
            <div className="row">
              <div className="row__title">Deals</div>
              <div className="row__meta">
                Total: {dashboard.deals.total} • Completed: {dashboard.deals.completed}
              </div>
            </div>
          </div>
        ) : (
          <p className="muted-text">No dashboard data.</p>
        )}
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Saved Search Digests</h2>
          <button type="button" className="button button--secondary" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
        </div>
        {digestStatus ? (
          <div className="grid grid--2">
            <div className="row">
              <div className="row__title">Scheduler</div>
              <div className="row__meta">
                Enabled: {digestStatus.enabled ? 'Yes' : 'No'} • Check interval: {Math.round(digestStatus.checkIntervalMs / 60000)} min
              </div>
            </div>
            <div className="row">
              <div className="row__title">Daily</div>
              <div className="row__meta">
                Last run: {digestStatus.daily.lastRunAt ? formatDate(digestStatus.daily.lastRunAt) : 'Never'} • Next due:{' '}
                {formatDate(digestStatus.daily.nextDueAt)} • Locked: {digestStatus.daily.isLocked ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="row">
              <div className="row__title">Weekly</div>
              <div className="row__meta">
                Last run: {digestStatus.weekly.lastRunAt ? formatDate(digestStatus.weekly.lastRunAt) : 'Never'} • Next due:{' '}
                {formatDate(digestStatus.weekly.nextDueAt)} • Locked: {digestStatus.weekly.isLocked ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        ) : (
          <p className="muted-text">No digest status loaded.</p>
        )}
        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void handleRunDigest('daily')}
            disabled={Boolean(digestRunning)}
          >
            {digestRunning === 'daily' ? 'Running daily...' : 'Run Daily Digest'}
          </button>
          <button
            type="button"
            className="button button--warning"
            onClick={() => void handleRunDigest('weekly')}
            disabled={Boolean(digestRunning)}
          >
            {digestRunning === 'weekly' ? 'Running weekly...' : 'Run Weekly Digest'}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void handleRunDigest('both')}
            disabled={Boolean(digestRunning)}
          >
            {digestRunning === 'both' ? 'Running both...' : 'Run Both'}
          </button>
        </div>
        <div className="grid grid--3" style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          <label className="field">
            <span className="label">History Frequency</span>
            <select
              className="select"
              value={digestHistoryFrequencyFilter}
              onChange={(event) => {
                setDigestHistoryPage(1);
                setDigestHistoryFrequencyFilter(event.target.value as DigestHistoryFrequencyFilter);
              }}
            >
              <option value="">All</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
            </select>
          </label>
          <label className="field">
            <span className="label">History Source</span>
            <select
              className="select"
              value={digestHistorySourceFilter}
              onChange={(event) => {
                setDigestHistoryPage(1);
                setDigestHistorySourceFilter(event.target.value as DigestHistorySourceFilter);
              }}
            >
              <option value="">All</option>
              <option value="manual">manual</option>
              <option value="scheduler">scheduler</option>
            </select>
          </label>
          <label className="field">
            <span className="label">From Date</span>
            <input
              className="input"
              type="date"
              value={digestHistoryFromDate}
              onChange={(event) => {
                setDigestHistoryPage(1);
                setDigestHistoryFromDate(event.target.value);
              }}
            />
          </label>
          <label className="field">
            <span className="label">Sort</span>
            <select
              className="select"
              value={digestHistorySort}
              onChange={(event) => {
                setDigestHistoryPage(1);
                setDigestHistorySort(event.target.value as DigestHistorySort);
              }}
            >
              <option value="completed_desc">Newest first</option>
              <option value="completed_asc">Oldest first</option>
              <option value="duration_desc">Longest runs first</option>
              <option value="duration_asc">Shortest runs first</option>
            </select>
          </label>
          <label className="field">
            <span className="label">To Date</span>
            <input
              className="input"
              type="date"
              value={digestHistoryToDate}
              onChange={(event) => {
                setDigestHistoryPage(1);
                setDigestHistoryToDate(event.target.value);
              }}
            />
          </label>
          <label className="field">
            <span className="label">Min Duration (ms)</span>
            <input
              className="input"
              type="number"
              min={0}
              value={digestHistoryMinDurationMs}
              onChange={(event) => {
                setDigestHistoryPage(1);
                setDigestHistoryMinDurationMs(event.target.value);
              }}
            />
          </label>
          <label className="field">
            <span className="label">Max Duration (ms)</span>
            <input
              className="input"
              type="number"
              min={0}
              value={digestHistoryMaxDurationMs}
              onChange={(event) => {
                setDigestHistoryPage(1);
                setDigestHistoryMaxDurationMs(event.target.value);
              }}
            />
          </label>
        </div>
        <div className="button-row">
          <button type="button" className="button button--ghost" onClick={handleExportDigestHistoryCsv}>
            Export CSV
          </button>
        </div>
        <div className="table-wrap" style={{ marginTop: '0.85rem' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Frequency</th>
                <th>Processed</th>
                <th>Matched</th>
                <th>Notified</th>
                <th>Emailed</th>
                <th>Duration</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {digestHistory.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.source}</td>
                  <td>{entry.frequency}</td>
                  <td>{entry.processedSearches}</td>
                  <td>{entry.matchedListings}</td>
                  <td>{entry.notifiedUsers}</td>
                  <td>{entry.emailedUsers}</td>
                  <td>{formatDurationMs(entry.durationMs)}</td>
                  <td>{formatDate(entry.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && digestHistory.length === 0 ? <p className="muted-text">No digest history yet.</p> : null}
        </div>
        <div className="inline" style={{ marginTop: '0.65rem' }}>
          <span className="muted-text">
            Page {digestHistoryMeta.page} / {Math.max(1, digestHistoryMeta.totalPages)} • Total rows: {digestHistoryMeta.total}
          </span>
          <label className="field" style={{ minWidth: '120px' }}>
            <span className="label">Page size</span>
            <select
              className="select"
              value={digestHistoryLimit}
              onChange={(event) => {
                setDigestHistoryPage(1);
                setDigestHistoryLimit(Number(event.target.value));
              }}
              disabled={loading}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className="button-row">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setDigestHistoryPage((prev) => Math.max(1, prev - 1))}
              disabled={loading || !digestHistoryMeta.hasPrev}
            >
              Previous
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setDigestHistoryPage((prev) => prev + 1)}
              disabled={loading || !digestHistoryMeta.hasNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid--3">
        <div className="card">
          <h2>Resolve Report</h2>
          <div className="stack">
            <label className="field">
              <span className="label">Report ID</span>
              <input
                className="input"
                type="number"
                min={1}
                value={reportIdAction}
                onChange={(event) => setReportIdAction(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Action</span>
              <select
                className="select"
                value={reportAction}
                onChange={(event) =>
                  setReportAction(event.target.value as 'dismiss' | 'resolve' | 'delete_listing' | 'ban_user')
                }
              >
                <option value="resolve">resolve</option>
                <option value="dismiss">dismiss</option>
                <option value="delete_listing">delete_listing</option>
                <option value="ban_user">ban_user</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Resolution note</span>
              <input
                className="input"
                value={reportResolution}
                onChange={(event) => setReportResolution(event.target.value)}
              />
            </label>
            <button type="button" className="button button--danger" onClick={handleResolveReport}>
              Apply
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Moderate Listing</h2>
          <div className="stack">
            <label className="field">
              <span className="label">Listing ID</span>
              <input
                className="input"
                type="number"
                min={1}
                value={listingIdAction}
                onChange={(event) => setListingIdAction(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Action</span>
              <select
                className="select"
                value={listingAction}
                onChange={(event) =>
                  setListingAction(event.target.value as 'approve' | 'reject' | 'suspend' | 'delete')
                }
              >
                <option value="approve">approve</option>
                <option value="reject">reject</option>
                <option value="suspend">suspend</option>
                <option value="delete">delete</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Reason</span>
              <input className="input" value={listingReason} onChange={(event) => setListingReason(event.target.value)} />
            </label>
            <button type="button" className="button button--warning" onClick={handleModerateListing}>
              Apply
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Identity Verification</h2>
          <div className="stack">
            <label className="field">
              <span className="label">Request ID</span>
              <input
                className="input"
                type="number"
                min={1}
                value={identityVerificationIdAction}
                onChange={(event) => setIdentityVerificationIdAction(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Action</span>
              <select
                className="select"
                value={identityVerificationAction}
                onChange={(event) => setIdentityVerificationAction(event.target.value as 'approve' | 'reject')}
              >
                <option value="approve">approve</option>
                <option value="reject">reject</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Reviewer note</span>
              <input
                className="input"
                value={identityVerificationReviewerNote}
                onChange={(event) => setIdentityVerificationReviewerNote(event.target.value)}
              />
            </label>
            <button type="button" className="button button--primary" onClick={handleResolveIdentityVerification}>
              Apply
            </button>
          </div>
        </div>
      </section>

      {isAdmin ? (
        <section className="card">
          <h2>Moderate User (Admin only)</h2>
          <div className="grid grid--3">
            <label className="field">
              <span className="label">User ID</span>
              <input
                className="input"
                type="number"
                min={1}
                value={userIdAction}
                onChange={(event) => setUserIdAction(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Action</span>
              <select
                className="select"
                value={userAction}
                onChange={(event) =>
                  setUserAction(
                    event.target.value as
                      | 'activate'
                      | 'deactivate'
                      | 'ban'
                      | 'unban'
                      | 'set_staff_role'
                      | 'set_account_type',
                  )
                }
              >
                <option value="activate">activate</option>
                <option value="deactivate">deactivate</option>
                <option value="ban">ban</option>
                <option value="unban">unban</option>
                <option value="set_staff_role">set_staff_role</option>
                <option value="set_account_type">set_account_type</option>
              </select>
            </label>
            {userAction === 'set_staff_role' ? (
              <label className="field">
                <span className="label">Staff Role</span>
                <select
                  className="select"
                  value={userStaffRole}
                  onChange={(event) => setUserStaffRole(event.target.value as StaffRole)}
                >
                  <option value="NONE">NONE</option>
                  <option value="MODERATOR">MODERATOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
            ) : null}
            {userAction === 'set_account_type' ? (
              <label className="field">
                <span className="label">Account Type</span>
                <select
                  className="select"
                  value={userAccountType}
                  onChange={(event) => setUserAccountType(event.target.value as AccountType)}
                >
                  <option value="INDIVIDUAL">INDIVIDUAL</option>
                  <option value="STORE">STORE</option>
                  <option value="CRAFTSMAN">CRAFTSMAN</option>
                </select>
              </label>
            ) : null}
            <label className="field">
              <span className="label">Reason</span>
              <input className="input" value={userReason} onChange={(event) => setUserReason(event.target.value)} />
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="button button--danger" onClick={handleModerateUser}>
              Apply User Action
            </button>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2>Featured Listings</h2>
        <div className="grid grid--3">
          <label className="field">
            <span className="label">Listing ID</span>
            <input
              className="input"
              type="number"
              min={1}
              value={featureListingId}
              onChange={(event) => setFeatureListingId(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="label">Days</span>
            <input
              className="input"
              type="number"
              min={1}
              max={365}
              value={featureDays}
              onChange={(event) => setFeatureDays(event.target.value)}
            />
          </label>
        </div>
        <div className="button-row">
          <button type="button" className="button button--warning" onClick={() => void handleFeatureListing(false)}>
            Feature Listing
          </button>
          <button type="button" className="button button--ghost" onClick={() => void handleFeatureListing(true)}>
            Clear Featured
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Identity Verification Queue</h2>
          <select
            className="select"
            value={identityVerificationFilter}
            onChange={(event) => setIdentityVerificationFilter(event.target.value as IdentityVerificationStatusFilter)}
          >
            <option value="">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="NONE">NONE</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Status</th>
                <th>Doc Type</th>
                <th>Masked Number</th>
                <th>Submitted</th>
                <th>Reviewed</th>
                <th>Reviewer</th>
              </tr>
            </thead>
            <tbody>
              {identityVerifications.map((requestItem) => (
                <tr key={requestItem.id}>
                  <td>{requestItem.id}</td>
                  <td>{requestItem.user.fullName ?? requestItem.user.email ?? `User #${requestItem.userId}`}</td>
                  <td>{requestItem.status}</td>
                  <td>{requestItem.documentType}</td>
                  <td>{requestItem.documentNumberMasked ?? '-'}</td>
                  <td>{formatDate(requestItem.submittedAt)}</td>
                  <td>{requestItem.reviewedAt ? formatDate(requestItem.reviewedAt) : '-'}</td>
                  <td>{requestItem.reviewer?.fullName ?? requestItem.reviewer?.email ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && identityVerifications.length === 0 ? <p className="muted-text">No identity verification requests found.</p> : null}
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Fraud Flags</h2>
          <button type="button" className="button button--secondary" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="grid grid--3" style={{ marginBottom: '0.75rem' }}>
          <label className="field">
            <span className="label">Listing ID</span>
            <input
              className="input"
              type="number"
              min={1}
              value={fraudListingFilter}
              onChange={(event) => setFraudListingFilter(event.target.value)}
              placeholder="Filter by listing"
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Risk</th>
                <th>Signals</th>
                <th>Actor</th>
                <th>IP</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {fraudFlags.map((flag) => (
                <tr key={flag.auditLogId}>
                  <td>#{flag.listingId} {flag.listingTitle ? `(${flag.listingTitle})` : ''}</td>
                  <td>{flag.riskScore}</td>
                  <td>{flag.signals.map((signal) => signal.code).join(', ') || '-'}</td>
                  <td>{flag.actorEmail ?? (flag.actorUserId ? `User #${flag.actorUserId}` : '-')}</td>
                  <td>{flag.ipAddress ?? '-'}</td>
                  <td>{formatDate(flag.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && fraudFlags.length === 0 ? <p className="muted-text">No fraud flags found.</p> : null}
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Blacklist</h2>
          <button type="button" className="button button--secondary" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="grid grid--3" style={{ marginBottom: '0.75rem' }}>
          <label className="field">
            <span className="label">Type</span>
            <select
              className="select"
              value={blacklistTypeFilter}
              onChange={(event) => setBlacklistTypeFilter(event.target.value as '' | BlacklistEntryType)}
            >
              <option value="">All</option>
              <option value="phone">phone</option>
              <option value="ip">ip</option>
              <option value="keyword">keyword</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Active</span>
            <select
              className="select"
              value={blacklistActiveFilter}
              onChange={(event) => setBlacklistActiveFilter(event.target.value as BlacklistActiveFilter)}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Search</span>
            <input
              className="input"
              value={blacklistQueryFilter}
              onChange={(event) => setBlacklistQueryFilter(event.target.value)}
              placeholder="value or reason"
            />
          </label>
        </div>

        <div className="grid grid--3" style={{ marginBottom: '0.75rem' }}>
          <label className="field">
            <span className="label">New Type</span>
            <select
              className="select"
              value={blacklistCreateType}
              onChange={(event) => setBlacklistCreateType(event.target.value as BlacklistEntryType)}
            >
              <option value="keyword">keyword</option>
              <option value="phone">phone</option>
              <option value="ip">ip</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Value</span>
            <input
              className="input"
              value={blacklistCreateValue}
              onChange={(event) => setBlacklistCreateValue(event.target.value)}
              placeholder="e.g. scam, +9639..., 192.168.0.1"
            />
          </label>
          <label className="field">
            <span className="label">Reason</span>
            <input
              className="input"
              value={blacklistCreateReason}
              onChange={(event) => setBlacklistCreateReason(event.target.value)}
            />
          </label>
        </div>
        <div className="button-row">
          <button type="button" className="button button--danger" onClick={() => void handleCreateBlacklist()}>
            Add to Blacklist
          </button>
        </div>

        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Value</th>
                <th>Reason</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {blacklistEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.id}</td>
                  <td>{entry.type}</td>
                  <td>{entry.value}</td>
                  <td>{entry.reason ?? '-'}</td>
                  <td>{entry.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="button-row">
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => void handleToggleBlacklistEntry(entry)}
                      >
                        {entry.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => void handleDeleteBlacklistEntry(entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && blacklistEntries.length === 0 ? <p className="muted-text">No blacklist entries found.</p> : null}
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Report Queue</h2>
          <select
            className="select"
            value={reportsFilter}
            onChange={(event) => setReportsFilter(event.target.value as ReportStatusFilter)}
          >
            <option value="">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISMISSED">DISMISSED</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Target</th>
                <th>Reporter</th>
                <th>Listing</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.id}</td>
                  <td>{report.status}</td>
                  <td>{report.reason}</td>
                  <td>
                    {report.reportableType} #{report.reportableId}
                  </td>
                  <td>{report.reporter.fullName ?? report.reporter.email ?? `User #${report.reporterId}`}</td>
                  <td>
                    {report.listing ? `#${report.listing.id} (${report.listing.status})` : 'N/A'}
                  </td>
                  <td>{formatDate(report.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && reports.length === 0 ? <p className="muted-text">No reports found.</p> : null}
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>Audit Logs</h2>
          <button type="button" className="button button--secondary" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="grid grid--3" style={{ marginBottom: '0.75rem' }}>
          <label className="field">
            <span className="label">Admin ID</span>
            <input
              className="input"
              type="number"
              min={1}
              value={auditAdminFilter}
              onChange={(event) => setAuditAdminFilter(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="label">Entity type</span>
            <input
              className="input"
              value={auditEntityFilter}
              onChange={(event) => setAuditEntityFilter(event.target.value)}
              placeholder="user, listing, report"
            />
          </label>
          <label className="field">
            <span className="label">Action contains</span>
            <input
              className="input"
              value={auditActionFilter}
              onChange={(event) => setAuditActionFilter(event.target.value)}
              placeholder="BAN, REPORT, APPROVE"
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.adminName ?? log.adminEmail ?? `Admin #${log.adminId}`}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.entityType} #{log.entityId}
                  </td>
                  <td>{log.ipAddress ?? '-'}</td>
                  <td>{formatDate(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && auditLogs.length === 0 ? <p className="muted-text">No audit logs found.</p> : null}
        </div>
      </section>

      {isAdmin ? (
        <section className="card">
          <h2>Users</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Legacy Role</th>
                  <th>Staff Role</th>
                  <th>Account Type</th>
                  <th>Active</th>
                  <th>Trust</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.email ?? '-'}</td>
                    <td>{user.fullName ?? '-'}</td>
                    <td>{user.role}</td>
                    <td>{user.staffRole}</td>
                    <td>{user.accountType}</td>
                    <td>{user.isActive ? 'Yes' : 'No'}</td>
                    <td>
                      {user.trustTier} ({user.trustScore})
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && users.length === 0 ? <p className="muted-text">No users found.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
