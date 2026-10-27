import { formatMoney, getPreferredCurrency } from '../lib/currency';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarCheck,
  Download,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import Notice from '../components/Notice';
import StatCard from '../components/StatCard';
import { useAuth } from '../features/auth/AuthContext';
import { apiRequest } from '../lib/api';

const money = (value) => formatMoney(value);

const dateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const formatTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleTimeString();
};

const cell = (value) => {
  let text = String(value ?? '');

  // Prevent spreadsheet formula injection in exported CSV cells.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
};

function exportCsv(report) {
  if (!report) return;

  const rows = [
    ['HySmart Station Daily Closing Report'],
    ['Date', report.date ?? ''],
    [
      'Branch',
      'Shift ID',
      'Cashier user ID',
      'Shift status',
      'Opening time',
      'Closing time',
      'Closing state',
      'Expected sales NGN',
      'Collections NGN',
      'Sales variance NGN',
      'Cash variance NGN',
      'Reconciled at',
      'Handover note',
    ],
  ];

  for (const branch of report.branches ?? []) {
    for (const shift of branch.shifts ?? []) {
      const reconciliation = shift.reconciliation;

      rows.push([
        branch.branch ?? '',
        shift.shiftId ?? '',
        shift.cashierUserId ?? '',
        shift.status ?? '',
        shift.openedAt ?? '',
        shift.closedAt ?? '',
        shift.closingState ?? '',
        reconciliation?.expectedSales ?? '',
        reconciliation?.collections ?? '',
        reconciliation?.salesVariance ?? '',
        reconciliation?.cashVariance ?? '',
        reconciliation?.reconciledAt ?? '',
        reconciliation?.handoverNote ?? '',
      ]);
    }
  }

  const csv = '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `hysmart-daily-closing-${report.date || 'report'}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Give the browser time to begin processing the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CompanyDailyClosing() {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [date, setDate] = useState(() => dateString(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewBusy, setReviewBusy] = useState('');
  const [reviewNotice, setReviewNotice] = useState('');

  // Ignore results from older requests when a newer request has started.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    if (!accessToken) {
      latestRequest.current += 1;
      setReport(null);
      setLoading(false);
      setError('');
      return;
    }

    const requestId = ++latestRequest.current;

    setLoading(true);
    setError('');

    try {
      const result = await apiRequest(
        `/companies/daily-closing-report?date=${encodeURIComponent(date)}`,
        { token: accessToken }
      );

      if (requestId === latestRequest.current) {
        setReport(result);
      }
    } catch (err) {
      if (requestId === latestRequest.current) {
        setReport(null);
        setError(err?.message || 'Unable to load the daily closing report.');
      }
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
      }
    }
  }, [accessToken, date]);

  useEffect(() => {
    void load();

    return () => {
      // Prevent a response from updating this screen after cleanup.
      latestRequest.current += 1;
    };
  }, [load]);

  const review = async (id, approve) => {
    if (!accessToken || !id || reviewBusy) return;

    setReviewBusy(id);
    setError('');
    setReviewNotice('');

    try {
      await apiRequest(`/companies/daily-closing-review/${id}`, {
        token: accessToken,
        method: 'POST',
        body: {
          approve,
          note: approve
            ? 'Reviewed by company owner'
            : 'Please address the branch close issues and resubmit',
        },
      });

      setReviewNotice(
        approve
          ? 'Branch daily close approved.'
          : 'Branch daily close rejected; manager must review and resubmit.'
      );

      await load();
    } catch (err) {
      setError(err?.message || 'Could not review submission.');
    } finally {
      setReviewBusy('');
    }
  };

  const totals = report?.totals ?? {};
  const branches = Array.isArray(report?.branches) ? report.branches : [];

  return (
    <section className="content-card company-daily-closing">
      <div className="card-heading">
        <CalendarCheck />

        <div>
          <h2>Daily closing report</h2>
          <p>
            Company-wide shift closure status and saved reconciliations,
            grouped by shift opening date.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void load()}
          disabled={loading || !accessToken}
        >
          <RefreshCw
            size={15}
            className={loading ? 'spin' : undefined}
          />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="report-filter-row">
        <label>
          Report date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void load()}
          disabled={loading || !accessToken}
        >
          <ShieldCheck size={16} />
          Review closing
        </button>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => exportCsv(report)}
          disabled={!report}
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {error && <Notice type="error">{error}</Notice>}

      {reviewNotice && <Notice type="success">{reviewNotice}</Notice>}

      <div className="stat-grid company-stat-grid">
        <StatCard
          label="Open shifts"
          value={report ? (totals.openShifts ?? 0) : '—'}
          detail="Not yet closed"
          icon={CalendarCheck}
        />

        <StatCard
          label="Awaiting reconciliation"
          value={report ? (totals.closedUnreconciled ?? 0) : '—'}
          detail="Closed, no saved reconciliation"
          icon={CalendarCheck}
        />

        <StatCard
          label="Reconciled shifts"
          value={report ? (totals.reconciledShifts ?? 0) : '—'}
          detail="Saved manager review"
          icon={ShieldCheck}
        />

        <StatCard
          label="Reconciled collections"
          value={report ? money(totals.collections) : '—'}
          detail={`Expected sales ${money(totals.expectedSales)}`}
          icon={ShieldCheck}
        />
      </div>

      {!report && loading ? (
        <p className="loading-line">Loading shift closure data…</p>
      ) : !report ? (
        <p className="loading-line">
          {error ? 'The report could not be loaded.' : 'No report loaded.'}
        </p>
      ) : branches.length === 0 ? (
        <p className="loading-line">
          No branches are configured for this company.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Branch / shift</th>
                <th>Shift status</th>
                <th>Expected sales</th>
                <th>Collections</th>
                <th>Sales variance</th>
                <th>Cash variance</th>
                <th>Handover</th>
                <th>Manager daily close</th>
              </tr>
            </thead>

            <tbody>
              {branches.map((branch) => {
                const shifts = Array.isArray(branch.shifts)
                  ? branch.shifts
                  : [];

                return (
                  <Fragment key={branch.stationId ?? branch.branch}>
                    {shifts.length === 0 ? (
                      <tr>
                        <td>
                          <b>{branch.branch ?? 'Unnamed branch'}</b>
                          <small className="table-subline">
                            {branch.status ?? ''}
                          </small>
                        </td>
                        <td colSpan={7}>
                          No shifts opened on this date.
                        </td>
                      </tr>
                    ) : (
                      shifts.map((shift) => {
                        const reconciliation = shift.reconciliation;
                        const closingState = shift.closingState ?? 'unknown';
                        const submission = branch.dailyCloseSubmission;
                        const submissionStatus = submission?.status;

                        return (
                          <tr key={shift.shiftId}>
                            <td>
                              <b>{branch.branch ?? 'Unnamed branch'}</b>
                              <small className="table-subline">
                                {shift.shiftId
                                  ? `${shift.shiftId.slice(0, 8)} · `
                                  : ''}
                                {formatTime(shift.openedAt)}
                              </small>
                            </td>

                            <td>
                              <span
                                className={`status-badge ${
                                  closingState === 'reconciled'
                                    ? ''
                                    : 'status-pending'
                                }`}
                              >
                                {String(closingState).replaceAll('_', ' ')}
                              </span>

                              <small className="table-subline">
                                {shift.closedAt
                                  ? `Closed ${formatTime(shift.closedAt)}`
                                  : 'Still open'}
                              </small>
                            </td>

                            <td>
                              {reconciliation
                                ? money(reconciliation.expectedSales)
                                : '—'}
                            </td>

                            <td>
                              {reconciliation
                                ? money(reconciliation.collections)
                                : '—'}
                            </td>

                            <td>
                              {reconciliation
                                ? money(reconciliation.salesVariance)
                                : '—'}
                            </td>

                            <td>
                              {reconciliation
                                ? money(reconciliation.cashVariance)
                                : shift.shiftCashVariance == null
                                  ? '—'
                                  : money(shift.shiftCashVariance)}
                            </td>

                            <td>
                              {reconciliation?.handoverNote || '—'}
                            </td>

                            <td>
                              {submission ? (
                                <>
                                  <span
                                    className={`status-badge ${
                                      submissionStatus === 'approved'
                                        ? ''
                                        : 'status-pending'
                                    }`}
                                  >
                                    {submissionStatus ?? 'unknown'}
                                  </span>

                                  {submission.manager_note && (
                                    <small className="table-subline">
                                      {submission.manager_note}
                                    </small>
                                  )}

                                  {submissionStatus === 'submitted' && (
                                    <div className="tabs-row">
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        disabled={Boolean(reviewBusy)}
                                        onClick={() =>
                                          void review(submission.id, true)
                                        }
                                      >
                                        {reviewBusy === submission.id
                                          ? 'Reviewing…'
                                          : 'Approve'}
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-outline"
                                        disabled={Boolean(reviewBusy)}
                                        onClick={() =>
                                          void review(submission.id, false)
                                        }
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}

                                  {submission.review_note && (
                                    <small className="table-subline">
                                      Review: {submission.review_note}
                                    </small>
                                  )}
                                </>
                              ) : (
                                'Not submitted'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report?.note && (
        <p className="report-footnote">
          {report.note} Access is restricted to the authenticated company owner.
        </p>
      )}
    </section>
  );
}
