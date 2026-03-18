import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsService } from '../services/reports.service';
import { asHttpError } from '../services/http';
import type { ReportReason, ReportStatus, UserReport } from '../types/domain';
import { formatDate } from '../utils/format';
import { translateEnum } from '../utils/i18n';

type StatusFilter = '' | ReportStatus;

export function ReportsPage() {
  const { t } = useTranslation('reports');
  const [reports, setReports] = useState<UserReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [reportableType, setReportableType] = useState<'LISTING' | 'USER' | 'MESSAGE'>('LISTING');
  const [reportableId, setReportableId] = useState('');
  const [reason, setReason] = useState<ReportReason>('FRAUD');
  const [description, setDescription] = useState('');
  const [linkedListingId, setLinkedListingId] = useState('');

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsService.listMine(statusFilter || undefined);
      setReports(result.items);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleCreateReport = async () => {
    const targetId = Number(reportableId);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      setMessage(t('reportableIdPositive'));
      return;
    }

    setMessage(null);
    try {
      await reportsService.create({
        reportableType,
        reportableId: targetId,
        reason,
        description: description || undefined,
        listingId: linkedListingId ? Number(linkedListingId) : undefined,
      });
      setMessage(t('reportSubmitted'));
      setReportableId('');
      setDescription('');
      setLinkedListingId('');
      await loadReports();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  return (
    <div className="stack">
      <h1 className="page-title">{t('title')}</h1>
      <p className="page-subtitle">{t('subtitle')}</p>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="muted-text">{message}</p> : null}

      <section className="card">
        <h2>{t('createReport')}</h2>
        <div className="grid grid--3">
          <label className="field">
            <span className="label">{t('type')}</span>
            <select
              className="select"
              value={reportableType}
              onChange={(event) => setReportableType(event.target.value as 'LISTING' | 'USER' | 'MESSAGE')}
            >
              <option value="LISTING">{translateEnum(t, 'reportableType', 'LISTING')}</option>
              <option value="USER">{translateEnum(t, 'reportableType', 'USER')}</option>
              <option value="MESSAGE">{translateEnum(t, 'reportableType', 'MESSAGE')}</option>
            </select>
          </label>

          <label className="field">
            <span className="label">{t('targetId')}</span>
            <input
              className="input"
              type="number"
              min={1}
              value={reportableId}
              onChange={(event) => setReportableId(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="label">{t('reason')}</span>
            <select className="select" value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
              <option value="FRAUD">{translateEnum(t, 'reportReason', 'FRAUD')}</option>
              <option value="INAPPROPRIATE">{translateEnum(t, 'reportReason', 'INAPPROPRIATE')}</option>
              <option value="DUPLICATE">{translateEnum(t, 'reportReason', 'DUPLICATE')}</option>
              <option value="SPAM">{translateEnum(t, 'reportReason', 'SPAM')}</option>
              <option value="OTHER">{translateEnum(t, 'reportReason', 'OTHER')}</option>
            </select>
          </label>

          <label className="field">
            <span className="label">{t('linkedListingId')}</span>
            <input
              className="input"
              type="number"
              min={1}
              value={linkedListingId}
              onChange={(event) => setLinkedListingId(event.target.value)}
            />
          </label>
        </div>

        <label className="field" style={{ marginTop: '0.7rem' }}>
          <span className="label">{t('description')}</span>
          <textarea
            className="textarea"
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="button-row">
          <button type="button" className="button button--danger" onClick={handleCreateReport}>
            {t('submitReport')}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>{t('myReports')}</h2>
          <div className="inline">
            <select
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="">{t('allStatuses')}</option>
              <option value="PENDING">{translateEnum(t, 'reportStatus', 'PENDING')}</option>
              <option value="RESOLVED">{translateEnum(t, 'reportStatus', 'RESOLVED')}</option>
              <option value="DISMISSED">{translateEnum(t, 'reportStatus', 'DISMISSED')}</option>
            </select>
            <button type="button" className="button button--secondary" onClick={loadReports} disabled={loading}>
              {t('refresh')}
            </button>
          </div>
        </div>

        <div className="list">
          {reports.map((report) => (
            <div key={report.id} className="row">
              <div className="row__title">
                {t('report', { id: report.id })} • {translateEnum(t, 'reportStatus', report.status)}
              </div>
              <div className="row__meta">
                {t('type')}: {translateEnum(t, 'reportableType', report.reportableType)} #{report.reportableId} • {t('reason')}:{' '}
                {translateEnum(t, 'reportReason', report.reason)} • {t('submittedOn', { date: formatDate(report.createdAt) })}
              </div>
              {report.description ? <p>{report.description}</p> : null}
              {report.listing ? (
                <div className="row__meta">
                  {t('linkedListing', {
                    id: report.listing.id,
                    status: translateEnum(t, 'listingStatus', report.listing.status),
                    title: report.listing.title,
                  })}
                </div>
              ) : null}
            </div>
          ))}
          {!loading && reports.length === 0 ? <p className="muted-text">{t('noReports')}</p> : null}
        </div>
      </section>
    </div>
  );
}
