import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Bars } from 'react-loader-spinner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import 'react-datepicker/dist/react-datepicker.css';
import '../../../styles/deactivatedPlansReport.css';
import { useLazyGetManagerApprovedCanceledReportQuery } from '../../../api/services NodeJs/financeReportApi';
import { useSyncShellPeriod } from '../../management/reports/ReportsPeriodContext';
import { useOpsReportWorkspace } from '../../management/reports/OpsReportWorkspaceContext';
import OpsReportViewToggle from '../../management/reports/OpsReportViewToggle';
import { OpsDateRangeControls } from '../../management/reports/OpsPeriodControls';
import '../../management/reports/reportsDecisionShell.css';

const toYmd = (date) => date.toLocaleDateString('en-CA');

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateStr;
};

export default function ManagerApprovedCanceledReport({ onExportReady }) {
  const workspace = useOpsReportWorkspace();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  useSyncShellPeriod(setStartDate, setEndDate);
  const [view, setView] = useState('chart');
  const [statusFilter, setStatusFilter] = useState('');
  const [estateFilter, setEstateFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [lines, setLines] = useState([]);
  const [summary, setSummary] = useState({ approved_count: 0, canceled_count: 0, total: 0 });
  const [hasGenerated, setHasGenerated] = useState(false);

  const [fetchReport, { isLoading, isFetching }] = useLazyGetManagerApprovedCanceledReportQuery();

  const handleGenerate = async () => {
    setEstateFilter('');
    try {
      const result = await fetchReport({
        start_date: toYmd(startDate),
        end_date: toYmd(endDate),
        status_filter: statusFilter || undefined,
        reason_id: reasonFilter ? Number(reasonFilter) : undefined,
      }).unwrap();
      setLines(Array.isArray(result?.lines) ? result.lines : []);
      setSummary({
        approved_count: result?.approved_count ?? 0,
        canceled_count: result?.canceled_count ?? 0,
        total: result?.total ?? 0,
      });
      setHasGenerated(true);
    } catch (e) {
      console.error(e);
      setLines([]);
      setSummary({ approved_count: 0, canceled_count: 0, total: 0 });
      setHasGenerated(true);
    }
  };

  // In shell/workspace: auto-load when period/status changes (no second date UI)
  useEffect(() => {
    if (!workspace?.setSidebar) return;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.setSidebar, startDate, endDate, statusFilter]);

  const estateOptions = useMemo(() => {
    const names = [...new Set(lines.map((r) => r.estate_name).filter((n) => n && n !== '—'))];
    return names.sort();
  }, [lines]);

  const reasonOptions = useMemo(() => {
    const byId = new Map();
    lines.forEach((row) => {
      if (row.reason_id && row.reason && row.reason !== '—') {
        byId.set(String(row.reason_id), row.reason);
      }
    });
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [lines]);

  const filtered = useMemo(
    () =>
      lines.filter((row) => {
        if (estateFilter && row.estate_name !== estateFilter) return false;
        if (reasonFilter && String(row.reason_id) !== String(reasonFilter)) return false;
        return true;
      }),
    [lines, estateFilter, reasonFilter]
  );

  const loading = isLoading || isFetching;

  const exportRows = () =>
    filtered.map((row) => ({
      'Plan ID': row.plan_id,
      'Plan Date': formatDisplayDate(row.plan_date),
      Plantation: row.plantation_name,
      Estate: row.estate_name,
      Field: row.field_name,
      'Field Area (Ha)': Number(row.field_area || 0).toFixed(2),
      Status: row.action_status,
      Reason: row.reason,
      Manager: row.manager_name,
      'Action At': row.action_at || '—',
    }));

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Approved Canceled');
    XLSX.writeFile(wb, `Manager_Approved_Canceled_${toYmd(startDate)}_to_${toYmd(endDate)}.xlsx`);
  };

  const downloadPdf = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('Plantation Management – Approved / Canceled', 14, 16);
    doc.setFontSize(10);
    doc.text(`Period: ${formatDisplayDate(toYmd(startDate))} – ${formatDisplayDate(toYmd(endDate))}`, 14, 24);

    autoTable(doc, {
      head: [
        [
          'Plan ID',
          'Plan Date',
          'Plantation',
          'Estate',
          'Field',
          'Area',
          'Status',
          'Reason',
          'Manager',
          'Action At',
        ],
      ],
      body: filtered.map((row) => [
        row.plan_id,
        formatDisplayDate(row.plan_date),
        row.plantation_name,
        row.estate_name,
        row.field_name,
        Number(row.field_area || 0).toFixed(2),
        row.action_status,
        row.reason,
        row.manager_name,
        row.action_at || '—',
      ]),
      startY: 30,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [0, 75, 113] },
    });

    doc.save(`Manager_Approved_Canceled_${toYmd(startDate)}_to_${toYmd(endDate)}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(downloadExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, startDate, endDate]);

  useEffect(() => {
    if (!workspace?.setSidebar) return undefined;
    workspace.setSidebar(
      <div className="rds-ops-controls">
        <OpsDateRangeControls
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
        <OpsReportViewToggle view={view} onChange={setView} />
        <div className="rds-ops-controls-block rds-ops-controls-inline">
          <span className="rds-ops-controls-label">Filters</span>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="approved">Approved</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Reason</span>
            <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
              <option value="">All</option>
              {reasonOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Estate</span>
            <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}>
              <option value="">All</option>
              {estateOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspace?.setSidebar,
    startDate,
    endDate,
    view,
    statusFilter,
    reasonFilter,
    estateFilter,
    reasonOptions,
    estateOptions,
  ]);

  const summaryStrip = hasGenerated ? (
    <div className="rds-metric-strip">
      <div className="rds-metric-strip-item">
        <div className="rds-metric-strip-lbl">Approved</div>
        <div className="rds-metric-strip-val">{summary.approved_count}</div>
      </div>
      <div className="rds-metric-strip-item">
        <div className="rds-metric-strip-lbl">Canceled</div>
        <div className="rds-metric-strip-val">{summary.canceled_count}</div>
      </div>
      <div className="rds-metric-strip-item">
        <div className="rds-metric-strip-lbl">Showing</div>
        <div className="rds-metric-strip-val">{filtered.length}</div>
        <div className="rds-metric-strip-sub">of {summary.total}</div>
      </div>
    </div>
  ) : null;

  const chartBlock =
    !hasGenerated || loading ? (
      <div className="rds-loading">
        <Bars height={40} width={40} color="#0f6b4c" ariaLabel="loading" />
      </div>
    ) : (
      <div className="rds-ops-data">
        {summaryStrip}
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">Approved vs canceled</div>
          <div className="rds-ops-dual">
            <div>
              <div className="rds-ops-dual-val" style={{ color: '#0f6b4c' }}>
                {summary.approved_count}
              </div>
              <div className="rds-ops-dual-lbl">Approved</div>
            </div>
            <div>
              <div className="rds-ops-dual-val" style={{ color: '#b45309' }}>
                {summary.canceled_count}
              </div>
              <div className="rds-ops-dual-lbl">Canceled</div>
            </div>
          </div>
        </div>
      </div>
    );

  const tableBlock = loading ? (
    <div className="rds-loading">
      <Bars height={40} width={40} color="#0f6b4c" ariaLabel="loading" />
    </div>
  ) : !hasGenerated ? (
    <div className="rds-empty">Select period and filters above.</div>
  ) : filtered.length === 0 ? (
    <div className="rds-empty">No approved or canceled field lines in this period.</div>
  ) : (
    <div className="rds-ops-data">
      {summaryStrip}
      <div className="rds-table-wrap">
        <table className="rds-table">
          <thead>
            <tr>
              <th>Plan ID</th>
              <th>Plan Date</th>
              <th>Plantation</th>
              <th>Estate</th>
              <th>Field</th>
              <th className="num">Area</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Manager</th>
              <th>Action At</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.line_id}>
                <td>{row.plan_id}</td>
                <td>{formatDisplayDate(row.plan_date)}</td>
                <td>{row.plantation_name}</td>
                <td>{row.estate_name}</td>
                <td>{row.field_name}</td>
                <td className="num">{Number(row.field_area || 0).toFixed(2)}</td>
                <td>{row.action_status}</td>
                <td>{row.reason}</td>
                <td>{row.manager_name}</td>
                <td>{row.action_at || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (workspace) {
    return <div className="rds-ops-data">{view === 'chart' ? chartBlock : tableBlock}</div>;
  }

  return (
    <div className="deactivated-plans-report manager-approved-canceled-report">
      <div className="deactivated-plans-toolbar">
        <div className="deactivated-plans-fields">
          <div className="deactivated-plans-field deactivated-plans-field--date">
            <span className="deactivated-plans-field-label">From</span>
            <DatePicker
              selected={startDate}
              onChange={(d) => d && setStartDate(d)}
              dateFormat="dd/MM/yyyy"
              wrapperClassName="deactivated-plans-datepicker-wrap"
              className="deactivated-plans-date-input"
            />
          </div>
          <div className="deactivated-plans-field deactivated-plans-field--date">
            <span className="deactivated-plans-field-label">To</span>
            <DatePicker
              selected={endDate}
              onChange={(d) => d && setEndDate(d)}
              dateFormat="dd/MM/yyyy"
              wrapperClassName="deactivated-plans-datepicker-wrap"
              className="deactivated-plans-date-input"
            />
          </div>
          <div className="deactivated-plans-field deactivated-plans-field--select">
            <span className="deactivated-plans-field-label">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="approved">Approved</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
          <div className="deactivated-plans-field deactivated-plans-field--select deactivated-plans-field--reason">
            <span className="deactivated-plans-field-label">Reason</span>
            <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
              <option value="">All</option>
              {reasonOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="deactivated-plans-field deactivated-plans-field--select">
            <span className="deactivated-plans-field-label">Estate</span>
            <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}>
              <option value="">All</option>
              {estateOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="deactivated-plans-actions">
          <button
            type="button"
            className="deactivated-plans-btn deactivated-plans-btn--generate"
            onClick={handleGenerate}
            disabled={loading || !startDate || !endDate}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button
            type="button"
            className="deactivated-plans-btn deactivated-plans-btn--excel"
            onClick={downloadExcel}
            disabled={!filtered.length}
          >
            <FiDownload /> Excel
          </button>
          <button
            type="button"
            className="deactivated-plans-btn deactivated-plans-btn--pdf"
            onClick={downloadPdf}
            disabled={!filtered.length}
          >
            <FiPrinter /> PDF
          </button>
        </div>
      </div>

      {hasGenerated ? (
        <div className="deactivated-plans-summary manager-approved-canceled-summary">
          <span className="manager-approved-canceled-stat manager-approved-canceled-stat--approved">
            <FaCheckCircle aria-hidden />
            <strong>{summary.approved_count}</strong> approved
          </span>
          <span className="manager-approved-canceled-stat manager-approved-canceled-stat--canceled">
            <FaTimesCircle aria-hidden />
            <strong>{summary.canceled_count}</strong> canceled
          </span>
          <span>
            Showing <strong>{filtered.length}</strong> of {summary.total} field line
            {summary.total === 1 ? '' : 's'}
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="deactivated-plans-loading">
          <Bars height={48} width={48} color="#004b71" ariaLabel="loading" />
        </div>
      ) : !hasGenerated ? (
        <p className="deactivated-plans-empty">
          Select dates and status (optional), then click <strong>Generate</strong>.
        </p>
      ) : filtered.length === 0 ? (
        <p className="deactivated-plans-empty">No approved or canceled field lines in this period.</p>
      ) : (
        <div className="deactivated-plans-table-wrap">
          <table className="deactivated-plans-table">
            <thead>
              <tr>
                <th>Plan ID</th>
                <th>Plan Date</th>
                <th>Plantation</th>
                <th>Estate</th>
                <th>Field</th>
                <th>Area (Ha)</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Manager</th>
                <th>Action At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.line_id}
                  className={
                    row.action_status === 'Canceled'
                      ? 'manager-approved-canceled-row--canceled'
                      : 'manager-approved-canceled-row--approved'
                  }
                >
                  <td>{row.plan_id}</td>
                  <td>{formatDisplayDate(row.plan_date)}</td>
                  <td>{row.plantation_name}</td>
                  <td>{row.estate_name}</td>
                  <td>{row.field_name}</td>
                  <td>{Number(row.field_area || 0).toFixed(2)}</td>
                  <td>{row.action_status}</td>
                  <td className="deactivated-plans-reason-cell">{row.reason}</td>
                  <td>{row.manager_name}</td>
                  <td>{row.action_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
