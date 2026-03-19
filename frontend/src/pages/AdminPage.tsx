import { useEffect, useMemo, useState } from 'react';
import type {
  AccountType,
  AdminAuditLog,
  AdminBlacklistEntry,
  AdminDashboardStats,
  AdminDispute,
  AdminFraudFlag,
  AdminIdentityVerification,
  AdminReport,
  AdminSavedSearchDigestHistoryEntry,
  AdminSavedSearchDigestStatus,
  AdminUser,
  BlacklistEntryType,
  DigestRunMode,
  IdentityVerificationStatus,
  ReportStatus,
  StaffRole,
} from '../types/domain';
import { adminService } from '../services/admin.service';
import { dealsService } from '../services/deals.service';
import { asHttpError } from '../services/http';
import { useLocaleSwitch } from '../utils/localeSwitch';
import { Button, Dropdown, ErrorStatePanel, Input, LoadingState, Tabs, type TabItem } from '../components/ui';

type AdminTab =
  | 'overview'
  | 'reports'
  | 'users'
  | 'disputes'
  | 'identity'
  | 'blacklist'
  | 'fraud'
  | 'audit'
  | 'digest';

export function AdminPage() {
  const { pick } = useLocaleSwitch();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [identityVerifications, setIdentityVerifications] = useState<AdminIdentityVerification[]>([]);
  const [blacklistEntries, setBlacklistEntries] = useState<AdminBlacklistEntry[]>([]);
  const [fraudFlags, setFraudFlags] = useState<AdminFraudFlag[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [digestStatus, setDigestStatus] = useState<AdminSavedSearchDigestStatus | null>(null);
  const [digestHistory, setDigestHistory] = useState<AdminSavedSearchDigestHistoryEntry[]>([]);

  const [reportsStatusFilter, setReportsStatusFilter] = useState<'' | ReportStatus>('');
  const [usersSearchFilter, setUsersSearchFilter] = useState('');
  const [usersStaffRoleFilter, setUsersStaffRoleFilter] = useState<'' | StaffRole>('');
  const [usersAccountTypeFilter, setUsersAccountTypeFilter] = useState<'' | AccountType>('');
  const [disputesStatusFilter, setDisputesStatusFilter] = useState<'' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED'>('');
  const [disputesDealIdFilter, setDisputesDealIdFilter] = useState('');
  const [identityStatusFilter, setIdentityStatusFilter] = useState<'' | IdentityVerificationStatus>('');
  const [identityNote, setIdentityNote] = useState<Record<number, string>>({});
  const [blacklistQueryFilter, setBlacklistQueryFilter] = useState('');
  const [blacklistTypeFilter, setBlacklistTypeFilter] = useState<'' | BlacklistEntryType>('');
  const [fraudListingIdFilter, setFraudListingIdFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState('');
  const [digestFrequency, setDigestFrequency] = useState<DigestRunMode>('both');

  const [newBlacklistType, setNewBlacklistType] = useState<BlacklistEntryType>('keyword');
  const [newBlacklistValue, setNewBlacklistValue] = useState('');
  const [newBlacklistReason, setNewBlacklistReason] = useState('');

  const [reportResolution, setReportResolution] = useState<Record<number, string>>({});
  const [reportActionLoadingId, setReportActionLoadingId] = useState<number | null>(null);

  const [userActionLoadingId, setUserActionLoadingId] = useState<number | null>(null);

  const [disputeResolution, setDisputeResolution] = useState<Record<number, string>>({});
  const [disputeActionLoadingId, setDisputeActionLoadingId] = useState<number | null>(null);
  const [identityActionLoadingId, setIdentityActionLoadingId] = useState<number | null>(null);
  const [blacklistActionLoadingId, setBlacklistActionLoadingId] = useState<string | null>(null);
  const [digestRunning, setDigestRunning] = useState(false);

  const loadOverview = async () => {
    const dashboardResult = await adminService.dashboard();
    setStats(dashboardResult);
  };

  const loadReports = async () => {
    const reportsResult = await adminService.listReports(reportsStatusFilter || undefined, 1, 8);
    setReports(reportsResult.items);
  };

  const loadUsers = async () => {
    const usersResult = await adminService.listUsers({
      page: 1,
      limit: 8,
      q: usersSearchFilter.trim() || undefined,
      staffRole: usersStaffRoleFilter || undefined,
      accountType: usersAccountTypeFilter || undefined,
    });
    setUsers(usersResult.items);
  };

  const loadDisputes = async () => {
    const disputesResult = await adminService.listDisputes({
      page: 1,
      limit: 8,
      status: disputesStatusFilter || undefined,
      dealId: disputesDealIdFilter.trim() ? Number(disputesDealIdFilter) : undefined,
    });
    setDisputes(disputesResult.items);
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      await Promise.all([
        loadOverview(),
        loadReports(),
        loadUsers(),
        loadDisputes(),
      ]);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadIdentity = async () => {
    const result = await adminService.listIdentityVerifications({
      page: 1,
      limit: 8,
      status: identityStatusFilter || undefined,
    });
    setIdentityVerifications(result.items);
  };

  const loadBlacklist = async () => {
    const result = await adminService.listBlacklist({
      page: 1,
      limit: 8,
      q: blacklistQueryFilter.trim() || undefined,
      type: blacklistTypeFilter || undefined,
    });
    setBlacklistEntries(result.items);
  };

  const loadFraudFlags = async () => {
    const result = await adminService.listFraudFlags({
      page: 1,
      limit: 8,
      listingId: fraudListingIdFilter.trim() ? Number(fraudListingIdFilter) : undefined,
    });
    setFraudFlags(result.items);
  };

  const loadAuditLogs = async () => {
    const result = await adminService.listAuditLogs({
      page: 1,
      limit: 12,
      action: auditActionFilter.trim() || undefined,
      entityType: auditEntityTypeFilter.trim() || undefined,
    });
    setAuditLogs(result.items);
  };

  const loadDigest = async () => {
    const [statusResult, historyResult] = await Promise.all([
      adminService.getSavedSearchDigestStatus(),
      adminService.listSavedSearchDigestHistory({ page: 1, limit: 8 }),
    ]);

    setDigestStatus(statusResult);
    setDigestHistory(historyResult.items);
  };

  const loadActiveTab = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      if (activeTab === 'overview') {
        await loadOverview();
      }
      if (activeTab === 'reports') {
        await loadReports();
      }
      if (activeTab === 'users') {
        await loadUsers();
      }
      if (activeTab === 'disputes') {
        await loadDisputes();
      }
      if (activeTab === 'identity') {
        await loadIdentity();
      }
      if (activeTab === 'blacklist') {
        await loadBlacklist();
      }
      if (activeTab === 'fraud') {
        await loadFraudFlags();
      }
      if (activeTab === 'audit') {
        await loadAuditLogs();
      }
      if (activeTab === 'digest') {
        await loadDigest();
      }
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    void loadActiveTab();
  }, [
    activeTab,
    blacklistQueryFilter,
    blacklistTypeFilter,
    disputesDealIdFilter,
    disputesStatusFilter,
    fraudListingIdFilter,
    auditActionFilter,
    auditEntityTypeFilter,
    identityStatusFilter,
    reportsStatusFilter,
    usersAccountTypeFilter,
    usersSearchFilter,
    usersStaffRoleFilter,
  ]);

  const handleResolveReport = async (
    reportId: number,
    action: 'dismiss' | 'resolve' | 'delete_listing' | 'ban_user',
  ) => {
    try {
      setReportActionLoadingId(reportId);
      await adminService.resolveReport(reportId, {
        action,
        resolution: reportResolution[reportId]?.trim() || undefined,
      });
      await Promise.all([loadReports(), loadOverview()]);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setReportActionLoadingId(null);
    }
  };

  const handleModerateUser = async (
    userId: number,
    action: 'activate' | 'deactivate' | 'ban' | 'unban',
  ) => {
    try {
      setUserActionLoadingId(userId);
      await adminService.moderateUser(userId, { action });
      await Promise.all([loadUsers(), loadOverview()]);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setUserActionLoadingId(null);
    }
  };

  const handleSetStaffRole = async (userId: number, staffRole: StaffRole) => {
    try {
      setUserActionLoadingId(userId);
      await adminService.moderateUser(userId, { action: 'set_staff_role', staffRole });
      await loadUsers();
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setUserActionLoadingId(null);
    }
  };

  const handleSetAccountType = async (userId: number, accountType: AccountType) => {
    try {
      setUserActionLoadingId(userId);
      await adminService.moderateUser(userId, { action: 'set_account_type', accountType });
      await loadUsers();
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setUserActionLoadingId(null);
    }
  };

  const handleResolveDispute = async (
    dealId: number,
    action: 'close_no_escrow',
  ) => {
    try {
      setDisputeActionLoadingId(dealId);
      await dealsService.resolveDispute(dealId, {
        action,
        resolution: disputeResolution[dealId]?.trim() || undefined,
      });
      await Promise.all([loadDisputes(), loadOverview()]);
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setDisputeActionLoadingId(null);
    }
  };

  const handleResolveIdentity = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      setIdentityActionLoadingId(requestId);
      await adminService.resolveIdentityVerification(requestId, {
        action,
        reviewerNote: identityNote[requestId]?.trim() || undefined,
      });
      await loadIdentity();
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setIdentityActionLoadingId(null);
    }
  };

  const handleCreateBlacklist = async () => {
    if (!newBlacklistValue.trim()) {
      return;
    }

    try {
      setBlacklistActionLoadingId('create');
      await adminService.createBlacklist({
        type: newBlacklistType,
        value: newBlacklistValue.trim(),
        reason: newBlacklistReason.trim() || undefined,
      });
      setNewBlacklistValue('');
      setNewBlacklistReason('');
      await loadBlacklist();
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setBlacklistActionLoadingId(null);
    }
  };

  const handleToggleBlacklistActive = async (entry: AdminBlacklistEntry) => {
    try {
      setBlacklistActionLoadingId(entry.id);
      await adminService.updateBlacklist(entry.id, { isActive: !entry.isActive });
      await loadBlacklist();
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setBlacklistActionLoadingId(null);
    }
  };

  const handleDeleteBlacklist = async (id: string) => {
    try {
      setBlacklistActionLoadingId(id);
      await adminService.deleteBlacklist(id);
      await loadBlacklist();
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setBlacklistActionLoadingId(null);
    }
  };

  const handleRunDigest = async () => {
    try {
      setDigestRunning(true);
      await adminService.runSavedSearchDigest(digestFrequency);
      await loadDigest();
    } catch (error) {
      setErrorMessage(asHttpError(error).message);
    } finally {
      setDigestRunning(false);
    }
  };

  const tabs = useMemo<TabItem[]>(
    () => [
      { key: 'overview' as const, labelAr: 'نظرة عامة', labelEn: 'Overview' },
      { key: 'reports' as const, labelAr: 'البلاغات', labelEn: 'Reports' },
      { key: 'users' as const, labelAr: 'المستخدمون', labelEn: 'Users' },
      { key: 'disputes' as const, labelAr: 'النزاعات', labelEn: 'Disputes' },
      { key: 'identity' as const, labelAr: 'التحقق من الهوية', labelEn: 'Identity Verification' },
      { key: 'blacklist' as const, labelAr: 'القائمة السوداء', labelEn: 'Blacklist' },
      { key: 'fraud' as const, labelAr: 'إشارات الاحتيال', labelEn: 'Fraud Flags' },
      { key: 'digest' as const, labelAr: 'ملخصات البحث', labelEn: 'Search Digest' },
    ].map((tab) => ({
      key: tab.key,
      label: pick(tab.labelAr, tab.labelEn),
    })),
    [pick],
  );

  const visibleTabs = useMemo<TabItem[]>(
    () => [
      ...tabs,
      { key: 'audit', label: pick('سجل التدقيق', 'Audit Logs') },
    ],
    [pick, tabs],
  );

  const staffRoleOptions = useMemo(
    () => [
      { key: 'MODERATOR', label: pick('ترقية مشرف', 'Set Moderator') },
      { key: 'NONE', label: pick('إزالة دور إداري', 'Set NONE') },
    ],
    [pick],
  );

  const accountTypeOptions = useMemo(
    () => [
      { key: 'STORE', label: pick('حساب متجر', 'Set STORE') },
      { key: 'INDIVIDUAL', label: pick('حساب فردي', 'Set INDIVIDUAL') },
    ],
    [pick],
  );

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">{pick('لوحة الإدارة', 'Admin Panel')}</h1>
          <p className="text-sm text-muted">
            {pick('مراقبة المنصة والقرارات التشغيلية الأساسية.', 'Platform monitoring and core operational decisions.')}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void loadData()}
        >
          {pick('تحديث', 'Refresh')}
        </Button>
      </header>

      <Tabs
        items={visibleTabs}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as AdminTab)}
      />

      {loading ? <LoadingState text={pick('جارٍ تحميل بيانات الإدارة...', 'Loading admin data...')} /> : null}
      {errorMessage ? (
        <ErrorStatePanel
          title={pick('تعذر تحميل لوحة الإدارة', 'Unable to load admin panel')}
          message={errorMessage}
        />
      ) : null}

      {activeTab === 'overview' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={pick('إجمالي المستخدمين', 'Total Users')}
            value={stats?.users.total ?? 0}
          />
          <MetricCard
            label={pick('إعلانات بانتظار المراجعة', 'Pending Listings')}
            value={stats?.listings.pending ?? 0}
          />
          <MetricCard
            label={pick('بلاغات معلقة', 'Pending Reports')}
            value={stats?.reports.pending ?? 0}
          />
          <MetricCard
            label={pick('صفقات مكتملة', 'Completed Deals')}
            value={stats?.deals.completed ?? 0}
          />
        </div>
      ) : null}

      {activeTab === 'reports' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <label className="text-sm text-muted">{pick('الحالة', 'Status')}</label>
            <select
              value={reportsStatusFilter}
              onChange={(event) => setReportsStatusFilter(event.target.value as '' | ReportStatus)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">{pick('الكل', 'All')}</option>
              <option value="PENDING">PENDING</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="DISMISSED">DISMISSED</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">{pick('السبب', 'Reason')}</th>
                <th className="px-4 py-3">{pick('الحالة', 'Status')}</th>
                <th className="px-4 py-3">{pick('النوع', 'Type')}</th>
                <th className="px-4 py-3">{pick('التاريخ', 'Created')}</th>
                <th className="px-4 py-3">{pick('الإجراء', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-ink">#{report.id}</td>
                  <td className="px-4 py-3 text-muted">{report.reason}</td>
                  <td className="px-4 py-3 text-muted">{report.status}</td>
                  <td className="px-4 py-3 text-muted">{report.reportableType}</td>
                  <td className="px-4 py-3 text-muted">{new Date(report.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[280px] flex-col gap-2">
                      <Input
                        type="text"
                        value={reportResolution[report.id] ?? ''}
                        onChange={(event) =>
                          setReportResolution((prev) => ({
                            ...prev,
                            [report.id]: event.target.value,
                          }))
                        }
                        placeholder={pick('ملاحظة القرار', 'Resolution note')}
                        className="h-8 rounded-md text-xs"
                      />
                      <div className="flex flex-wrap gap-1">
                        <ActionButton
                          label={pick('حل', 'Resolve')}
                          onClick={() => void handleResolveReport(report.id, 'resolve')}
                          loading={reportActionLoadingId === report.id}
                        />
                        <ActionButton
                          label={pick('رفض', 'Dismiss')}
                          onClick={() => void handleResolveReport(report.id, 'dismiss')}
                          loading={reportActionLoadingId === report.id}
                          tone="neutral"
                        />
                        <ActionButton
                          label={pick('أرشفة الإعلان', 'Archive Listing')}
                          onClick={() => void handleResolveReport(report.id, 'delete_listing')}
                          loading={reportActionLoadingId === report.id}
                          tone="warning"
                        />
                        <ActionButton
                          label={pick('حظر المستخدم', 'Ban User')}
                          onClick={() => void handleResolveReport(report.id, 'ban_user')}
                          loading={reportActionLoadingId === report.id}
                          tone="danger"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">
                    {pick('لا توجد بيانات حالياً.', 'No data available yet.')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </div>
      ) : null}

      {activeTab === 'users' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <Input
              type="text"
              value={usersSearchFilter}
              onChange={(event) => setUsersSearchFilter(event.target.value)}
              placeholder={pick('بحث بالاسم/الإيميل', 'Search by name/email')}
              className="h-9"
            />
            <select
              value={usersStaffRoleFilter}
              onChange={(event) => setUsersStaffRoleFilter(event.target.value as '' | StaffRole)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">{pick('كل الأدوار', 'All Staff Roles')}</option>
              <option value="NONE">NONE</option>
              <option value="MODERATOR">MODERATOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <select
              value={usersAccountTypeFilter}
              onChange={(event) => setUsersAccountTypeFilter(event.target.value as '' | AccountType)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">{pick('كل أنواع الحساب', 'All Account Types')}</option>
              <option value="INDIVIDUAL">INDIVIDUAL</option>
              <option value="STORE">STORE</option>
              <option value="CRAFTSMAN">CRAFTSMAN</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">{pick('الدور الإداري', 'Staff Role')}</th>
                <th className="px-4 py-3">{pick('نوع الحساب', 'Account Type')}</th>
                <th className="px-4 py-3">{pick('الحالة', 'Active')}</th>
                <th className="px-4 py-3">{pick('إدارة', 'Moderation')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-ink">#{user.id}</td>
                  <td className="px-4 py-3 text-muted">{user.email ?? '-'}</td>
                  <td className="px-4 py-3 text-muted">{user.staffRole}</td>
                  <td className="px-4 py-3 text-muted">{user.accountType}</td>
                  <td className="px-4 py-3 text-muted">{user.isActive ? pick('نشط', 'Active') : pick('معطل', 'Disabled')}</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[300px] flex-col gap-2">
                      <div className="flex flex-wrap gap-1">
                        <ActionButton
                          label={pick('تفعيل', 'Activate')}
                          onClick={() => void handleModerateUser(user.id, 'activate')}
                          loading={userActionLoadingId === user.id}
                        />
                        <ActionButton
                          label={pick('تعطيل', 'Deactivate')}
                          onClick={() => void handleModerateUser(user.id, 'deactivate')}
                          loading={userActionLoadingId === user.id}
                          tone="warning"
                        />
                        <ActionButton
                          label={pick('حظر', 'Ban')}
                          onClick={() => void handleModerateUser(user.id, 'ban')}
                          loading={userActionLoadingId === user.id}
                          tone="danger"
                        />
                        <ActionButton
                          label={pick('فك الحظر', 'Unban')}
                          onClick={() => void handleModerateUser(user.id, 'unban')}
                          loading={userActionLoadingId === user.id}
                          tone="neutral"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Dropdown
                          triggerLabel={pick('الدور الإداري', 'Staff Role')}
                          options={staffRoleOptions}
                          onSelect={(key) => void handleSetStaffRole(user.id, key as StaffRole)}
                          disabled={userActionLoadingId === user.id}
                        />
                        <Dropdown
                          triggerLabel={pick('نوع الحساب', 'Account Type')}
                          options={accountTypeOptions}
                          onSelect={(key) => void handleSetAccountType(user.id, key as AccountType)}
                          disabled={userActionLoadingId === user.id}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">
                    {pick('لا توجد بيانات حالياً.', 'No data available yet.')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </div>
      ) : null}

      {activeTab === 'disputes' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <label className="text-sm text-muted">{pick('حالة النزاع', 'Dispute Status')}</label>
            <select
              value={disputesStatusFilter}
              onChange={(event) => setDisputesStatusFilter(event.target.value as '' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED')}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">{pick('الكل', 'All')}</option>
              <option value="OPEN">OPEN</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
            <Input
              type="number"
              min={1}
              value={disputesDealIdFilter}
              onChange={(event) => setDisputesDealIdFilter(event.target.value)}
              placeholder={pick('رقم الصفقة', 'Deal ID')}
              className="h-9 w-32"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">{pick('الصفقة', 'Deal')}</th>
                <th className="px-4 py-3">{pick('السبب', 'Reason')}</th>
                <th className="px-4 py-3">{pick('الحالة', 'Status')}</th>
                <th className="px-4 py-3">{pick('العنوان', 'Listing')}</th>
                <th className="px-4 py-3">{pick('الإجراء', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-ink">#{dispute.id}</td>
                  <td className="px-4 py-3 text-muted">#{dispute.dealId}</td>
                  <td className="px-4 py-3 text-muted">{dispute.reason}</td>
                  <td className="px-4 py-3 text-muted">{dispute.status}</td>
                  <td className="px-4 py-3 text-muted">{dispute.deal.listingTitle}</td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[280px] flex-col gap-2">
                      <Input
                        type="text"
                        value={disputeResolution[dispute.dealId] ?? ''}
                        onChange={(event) =>
                          setDisputeResolution((prev) => ({
                            ...prev,
                            [dispute.dealId]: event.target.value,
                          }))
                        }
                        placeholder={pick('تفاصيل القرار', 'Resolution detail')}
                        className="h-8 rounded-md text-xs"
                      />
                      <div className="flex flex-wrap gap-1">
                        <ActionButton
                          label={pick('إغلاق النزاع', 'Close Dispute')}
                          onClick={() => void handleResolveDispute(dispute.dealId, 'close_no_escrow')}
                          loading={disputeActionLoadingId === dispute.dealId}
                          tone="neutral"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {disputes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">
                    {pick('لا توجد بيانات حالياً.', 'No data available yet.')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </div>
      ) : null}

      {activeTab === 'identity' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <label className="text-sm text-muted">{pick('الحالة', 'Status')}</label>
            <select
              value={identityStatusFilter}
              onChange={(event) => setIdentityStatusFilter(event.target.value as '' | IdentityVerificationStatus)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">{pick('الكل', 'All')}</option>
              <option value="PENDING">PENDING</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">{pick('الإجراء', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {identityVerifications.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-ink">#{item.id}</td>
                    <td className="px-4 py-3 text-muted">{item.user.email ?? '-'}</td>
                    <td className="px-4 py-3 text-muted">{item.status}</td>
                    <td className="px-4 py-3 text-muted">{item.documentType}</td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[260px] flex-col gap-2">
                        <Input
                          type="text"
                          value={identityNote[item.id] ?? ''}
                          onChange={(event) =>
                            setIdentityNote((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder={pick('ملاحظة المراجع', 'Reviewer note')}
                          className="h-8 rounded-md text-xs"
                        />
                        <div className="flex flex-wrap gap-1">
                          <ActionButton
                            label={pick('موافقة', 'Approve')}
                            onClick={() => void handleResolveIdentity(item.id, 'approve')}
                            loading={identityActionLoadingId === item.id}
                          />
                          <ActionButton
                            label={pick('رفض', 'Reject')}
                            onClick={() => void handleResolveIdentity(item.id, 'reject')}
                            loading={identityActionLoadingId === item.id}
                            tone="warning"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {identityVerifications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted">
                      {pick('لا توجد بيانات حالياً.', 'No data available yet.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'blacklist' ? (
        <div className="space-y-3">
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft md:grid-cols-4">
            <select
              value={newBlacklistType}
              onChange={(event) => setNewBlacklistType(event.target.value as BlacklistEntryType)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="keyword">keyword</option>
              <option value="phone">phone</option>
              <option value="ip">ip</option>
            </select>
            <Input
              type="text"
              value={newBlacklistValue}
              onChange={(event) => setNewBlacklistValue(event.target.value)}
              placeholder={pick('القيمة', 'Value')}
              className="h-9"
            />
            <Input
              type="text"
              value={newBlacklistReason}
              onChange={(event) => setNewBlacklistReason(event.target.value)}
              placeholder={pick('السبب', 'Reason')}
              className="h-9"
            />
            <Button
              size="sm"
              onClick={() => void handleCreateBlacklist()}
              isLoading={blacklistActionLoadingId === 'create'}
              disabled={!newBlacklistValue.trim()}
            >
              {pick('إضافة', 'Add')}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <Input
              type="text"
              value={blacklistQueryFilter}
              onChange={(event) => setBlacklistQueryFilter(event.target.value)}
              placeholder={pick('بحث', 'Search')}
              className="h-9"
            />
            <select
              value={blacklistTypeFilter}
              onChange={(event) => setBlacklistTypeFilter(event.target.value as '' | BlacklistEntryType)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">{pick('كل الأنواع', 'All Types')}</option>
              <option value="keyword">keyword</option>
              <option value="phone">phone</option>
              <option value="ip">ip</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">{pick('الحالة', 'Active')}</th>
                  <th className="px-4 py-3">{pick('الإجراء', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {blacklistEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-ink">{entry.id}</td>
                    <td className="px-4 py-3 text-muted">{entry.type}</td>
                    <td className="px-4 py-3 text-muted">{entry.value}</td>
                    <td className="px-4 py-3 text-muted">{entry.isActive ? pick('نشط', 'Active') : pick('غير نشط', 'Inactive')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <ActionButton
                          label={entry.isActive ? pick('تعطيل', 'Disable') : pick('تفعيل', 'Enable')}
                          onClick={() => void handleToggleBlacklistActive(entry)}
                          loading={blacklistActionLoadingId === entry.id}
                          tone="neutral"
                        />
                        <ActionButton
                          label={pick('حذف', 'Delete')}
                          onClick={() => void handleDeleteBlacklist(entry.id)}
                          loading={blacklistActionLoadingId === entry.id}
                          tone="danger"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {blacklistEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted">
                      {pick('لا توجد بيانات حالياً.', 'No data available yet.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'fraud' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <Input
              type="number"
              min={1}
              value={fraudListingIdFilter}
              onChange={(event) => setFraudListingIdFilter(event.target.value)}
              placeholder={pick('رقم الإعلان', 'Listing ID')}
              className="h-9 w-36"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">{pick('درجة الخطر', 'Risk Score')}</th>
                  <th className="px-4 py-3">{pick('الإشارة', 'Signals')}</th>
                  <th className="px-4 py-3">{pick('التاريخ', 'Created')}</th>
                </tr>
              </thead>
              <tbody>
                {fraudFlags.map((flag) => (
                  <tr key={flag.auditLogId} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-muted">#{flag.listingId} {flag.listingTitle ? `(${flag.listingTitle})` : ''}</td>
                    <td className="px-4 py-3 text-muted">{flag.riskScore}</td>
                    <td className="px-4 py-3 text-muted">{flag.signals.map((signal) => signal.code).join(', ') || '-'}</td>
                    <td className="px-4 py-3 text-muted">{new Date(flag.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {fraudFlags.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      {pick('لا توجد بيانات حالياً.', 'No data available yet.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'audit' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <Input
              value={auditActionFilter}
              onChange={(event) => setAuditActionFilter(event.target.value)}
              placeholder={pick('الإجراء', 'Action')}
              className="h-9 w-40"
            />
            <Input
              value={auditEntityTypeFilter}
              onChange={(event) => setAuditEntityTypeFilter(event.target.value)}
              placeholder={pick('نوع الكيان', 'Entity Type')}
              className="h-9 w-40"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">{pick('المشرف', 'Admin')}</th>
                  <th className="px-4 py-3">{pick('الإجراء', 'Action')}</th>
                  <th className="px-4 py-3">{pick('الكيان', 'Entity')}</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">{pick('التاريخ', 'Created')}</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-muted">{log.id}</td>
                    <td className="px-4 py-3 text-muted">{log.adminName ?? log.adminEmail ?? `#${log.adminId}`}</td>
                    <td className="px-4 py-3 text-muted">{log.action}</td>
                    <td className="px-4 py-3 text-muted">{log.entityType} #{log.entityId}</td>
                    <td className="px-4 py-3 text-muted">{log.ipAddress ?? '-'}</td>
                    <td className="px-4 py-3 text-muted">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted">
                      {pick('لا توجد بيانات حالياً.', 'No data available yet.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'digest' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <p className="text-sm text-muted">
              {pick('الحالة الحالية', 'Current status')}: {digestStatus?.enabled ? pick('مفعل', 'Enabled') : pick('معطل', 'Disabled')}
            </p>
            <p className="text-sm text-muted">
              {pick('آخر تشغيل يومي', 'Last daily run')}: {digestStatus?.daily.lastRunAt ?? '-'}
            </p>
            <p className="text-sm text-muted">
              {pick('آخر تشغيل أسبوعي', 'Last weekly run')}: {digestStatus?.weekly.lastRunAt ?? '-'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <select
              value={digestFrequency}
              onChange={(event) => setDigestFrequency(event.target.value as DigestRunMode)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="both">both</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
            </select>
            <Button
              size="sm"
              onClick={() => void handleRunDigest()}
              isLoading={digestRunning}
            >
              {pick('تشغيل الآن', 'Run now')}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">{pick('التاريخ', 'Completed')}</th>
                </tr>
              </thead>
              <tbody>
                {digestHistory.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-muted">{entry.id}</td>
                    <td className="px-4 py-3 text-muted">{entry.source}</td>
                    <td className="px-4 py-3 text-muted">{entry.frequency}</td>
                    <td className="px-4 py-3 text-muted">{entry.durationMs} ms</td>
                    <td className="px-4 py-3 text-muted">{entry.completedAt}</td>
                  </tr>
                ))}
                {digestHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted">
                      {pick('لا توجد بيانات حالياً.', 'No data available yet.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-primary">{value}</p>
    </article>
  );
}

function ActionButton({
  label,
  onClick,
  loading,
  tone = 'primary',
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  tone?: 'primary' | 'warning' | 'danger' | 'neutral';
}) {
  const variant = tone === 'danger' ? 'danger' : tone === 'primary' ? 'primary' : tone === 'warning' ? 'secondary' : 'ghost';
  const warningClass = tone === 'warning' ? '!border-amber-500 !text-amber-700 hover:!bg-amber-50' : '';

  return (
    <Button
      size="sm"
      variant={variant}
      onClick={onClick}
      isLoading={loading}
      className={warningClass}
    >
      {label}
    </Button>
  );
}
