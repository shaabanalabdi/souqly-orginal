import { useEffect, useState } from 'react';
import { reportsService } from '../services/reports.service';
import { asHttpError } from '../services/http';
import type { ReportReason, ReportStatus, UserReport } from '../types/domain';
import { formatDate } from '../utils/format';

type StatusFilter = '' | ReportStatus;

export function ReportsPage() {
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
      setMessage('Reportable id must be a positive number.');
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
      setMessage('Report submitted.');
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
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">Submit abuse/fraud reports and monitor your report queue.</p>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="muted-text">{message}</p> : null}

      <section className="card">
        <h2>Create Report</h2>
        <div className="grid grid--3">
          <label className="field">
            <span className="label">Type</span>
            <select
              className="select"
              value={reportableType}
              onChange={(event) => setReportableType(event.target.value as 'LISTING' | 'USER' | 'MESSAGE')}
            >
              <option value="LISTING">LISTING</option>
              <option value="USER">USER</option>
              <option value="MESSAGE">MESSAGE</option>
            </select>
          </label>

          <label className="field">
            <span className="label">Target ID</span>
            <input
              className="input"
              type="number"
              min={1}
              value={reportableId}
              onChange={(event) => setReportableId(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="label">Reason</span>
            <select className="select" value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
              <option value="FRAUD">FRAUD</option>
              <option value="INAPPROPRIATE">INAPPROPRIATE</option>
              <option value="DUPLICATE">DUPLICATE</option>
              <option value="SPAM">SPAM</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>

          <label className="field">
            <span className="label">Linked Listing ID (optional)</span>
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
          <span className="label">Description</span>
          <textarea
            className="textarea"
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="button-row">
          <button type="button" className="button button--danger" onClick={handleCreateReport}>
            Submit report
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <h2>My Reports</h2>
          <div className="inline">
            <select
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="">All statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="DISMISSED">DISMISSED</option>
            </select>
            <button type="button" className="button button--secondary" onClick={loadReports} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="list">
          {reports.map((report) => (
            <div key={report.id} className="row">
              <div className="row__title">
                Report #{report.id} • {report.status}
              </div>
              <div className="row__meta">
                Type: {report.reportableType} #{report.reportableId} • Reason: {report.reason} • Submitted{' '}
                {formatDate(report.createdAt)}
              </div>
              {report.description ? <p>{report.description}</p> : null}
              {report.listing ? (
                <div className="row__meta">
                  Linked listing: #{report.listing.id} ({report.listing.status}) - {report.listing.title}
                </div>
              ) : null}
            </div>
          ))}
          {!loading && reports.length === 0 ? <p className="muted-text">No reports found.</p> : null}
        </div>
      </section>
    </div>
  );
}
