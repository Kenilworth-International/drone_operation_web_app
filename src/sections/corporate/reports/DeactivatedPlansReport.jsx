import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Bars } from 'react-loader-spinner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import { FaBan } from 'react-icons/fa';
import 'react-datepicker/dist/react-datepicker.css';
import '../../../styles/deactivatedPlansReport.css';
import { useLazyGetDeactivatedPlansReportQuery } from '../../../api/services NodeJs/financeReportApi';
import { useGetDeactivateReasonsQuery } from '../../../api/services NodeJs/reasonsApi';
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

const PIE_COLORS = ['#0f6b4c', '#34d399', '#94a3b8', '#f59e0b', '#dc2626', '#2563eb', '#7c3aed', '#0891b2'];

export default function DeactivatedPlansReport({ onExportReady }) {
  const workspace = useOpsReportWorkspace();
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  useSyncShellPeriod(setStartDate, setEndDate);
  const [view, setView] = useState('chart');
  const [reasonFilter, setReasonFilter] = useState('');
  const [plantationFilter, setPlantationFilter] = useState('');
  const [estateFilter, setEstateFilter] = useState('');
  const [plans, setPlans] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [fetchReport, { isLoading, isFetching }] = useLazyGetDeactivatedPlansReportQuery();
  const { data: deactivateReasonsList = [] } = useGetDeactivateReasonsQuery({ include_inactive: true });

  const handleGenerate = async () => {
    setPlantationFilter('');
    setEstateFilter('');
    try {
      const result = await fetchReport({
        start_date: toYmd(startDate),
        end_date: toYmd(endDate),
        deactivate_reason_id: reasonFilter ? Number(reasonFilter) : undefined,
      }).unwrap();
      setPlans(Array.isArray(result?.plans) ? result.plans : []);
      setHasGenerated(true);
    } catch (e) {
      console.error(e);
      setPlans([]);
      setHasGenerated(true);
    }
  };

  // Ops workspace: auto-load when period / reason changes
  useEffect(() => {
    if (!workspace?.setSidebar) return;
    if (!startDate || !endDate) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchReport({
          start_date: toYmd(startDate),
          end_date: toYmd(endDate),
          deactivate_reason_id: reasonFilter ? Number(reasonFilter) : undefined,
        }).unwrap();
        if (!cancelled) {
          setPlans(Array.isArray(result?.plans) ? result.plans : []);
          setHasGenerated(true);
        }
      } catch (e) {
        if (!cancelled) {
          setPlans([]);
          setHasGenerated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.setSidebar, startDate, endDate, reasonFilter]);

  const reasonOptions = useMemo(() => {
    const byId = new Map();
    deactivateReasonsList.forEach((r) => {
      if (r.id != null && r.reason) {
        byId.set(String(r.id), r.reason);
      }
    });
    plans.forEach((row) => {
      if (row.deactivate_reason_id && row.deactivate_reason && row.deactivate_reason !== '—') {
        byId.set(String(row.deactivate_reason_id), row.deactivate_reason);
      }
    });
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [deactivateReasonsList, plans]);

  const plantationOptions = useMemo(() => {
    const names = [...new Set(plans.map((p) => p.plantation_name).filter((n) => n && n !== '—'))];
    return names.sort();
  }, [plans]);

  const estateOptions = useMemo(() => {
    const names = [...new Set(plans.map((p) => p.estate_name).filter((n) => n && n !== '—'))];
    return names.sort();
  }, [plans]);

  const filtered = useMemo(
    () =>
      plans.filter((row) => {
        if (reasonFilter && String(row.deactivate_reason_id) !== String(reasonFilter)) {
          return false;
        }
        if (plantationFilter && row.plantation_name !== plantationFilter) return false;
        if (estateFilter && row.estate_name !== estateFilter) return false;
        return true;
      }),
    [plans, reasonFilter, plantationFilter, estateFilter]
  );

  const reasonChartData = useMemo(() => {
    const counts = new Map();
    filtered.forEach((row) => {
      const label = row.deactivate_reason || 'Unknown';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered]);

  const dailyChartData = useMemo(() => {
    const byDay = new Map();
    filtered.forEach((row) => {
      const day = String(row.plan_date || row.deactivated_at || '').slice(0, 10) || 'Unknown';
      byDay.set(day, (byDay.get(day) || 0) + 1);
    });
    return Array.from(byDay.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const loading = isLoading || isFetching;

  const exportRows = () =>
    filtered.map((row) => ({
      'Plan ID': row.plan_id,
      'Plan Date': formatDisplayDate(row.plan_date),
      Plantation: row.plantation_name,
      Estate: row.estate_name,
      'Total Extent (Ha)': Number(row.total_extent || 0).toFixed(2),
      'Deactivate Reason': row.deactivate_reason,
      'Deactivated By': row.deactivated_by_name,
      'Deactivated At': row.deactivated_at || '—',
    }));

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deactivated Plans');
    XLSX.writeFile(
      wb,
      `Deactivated_Plans_${toYmd(startDate)}_to_${toYmd(endDate)}.xlsx`
    );
  };

  const downloadPdf = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('Deactivated Plans with Reason', 14, 16);
    doc.setFontSize(10);
    doc.text(`Period: ${formatDisplayDate(toYmd(startDate))} – ${formatDisplayDate(toYmd(endDate))}`, 14, 24);

    autoTable(doc, {
      head: [
        [
          'Plan ID',
          'Plan Date',
          'Plantation',
          'Estate',
          'Extent (Ha)',
          'Deactivate Reason',
          'Deactivated By',
          'Deactivated At',
        ],
      ],
      body: filtered.map((row) => [
        row.plan_id,
        formatDisplayDate(row.plan_date),
        row.plantation_name,
        row.estate_name,
        Number(row.total_extent || 0).toFixed(2),
        row.deactivate_reason,
        row.deactivated_by_name,
        row.deactivated_at || '—',
      ]),
      startY: 30,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [0, 75, 113] },
    });

    doc.save(`Deactivated_Plans_${toYmd(startDate)}_to_${toYmd(endDate)}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(downloadExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, startDate, endDate, reasonFilter, plantationFilter, estateFilter]);

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
            <span>Reason</span>
            <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
              <option value="">All</option>
              {reasonOptions.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Plantation</span>
            <select value={plantationFilter} onChange={(e) => setPlantationFilter(e.target.value)}>
              <option value="">All</option>
              {plantationOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Estate</span>
            <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}>
              <option value="">All</option>
              {estateOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
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
    reasonFilter,
    plantationFilter,
    estateFilter,
    reasonOptions,
    plantationOptions,
    estateOptions,
  ]);

  const tableBlock = !hasGenerated ? (
    <p className={workspace ? 'rds-empty' : 'deactivated-plans-empty'}>
      {workspace
        ? 'Loading deactivated plans for the selected period…'
        : <>Select a date range and click <strong>Generate</strong> to load deactivated plans.</>}
    </p>
  ) : filtered.length === 0 ? (
    <p className={workspace ? 'rds-empty' : 'deactivated-plans-empty'}>
      No deactivated plans found for the selected period.
    </p>
  ) : (
    <div className={workspace ? 'rds-table-wrap' : 'deactivated-plans-table-wrap'}>
      <table className={workspace ? 'rds-table' : 'deactivated-plans-table'}>
        <thead>
          <tr>
            <th>Plan ID</th>
            <th>Plan Date</th>
            <th>Plantation</th>
            <th>Estate</th>
            <th>Extent (Ha)</th>
            <th>Deactivate Reason</th>
            <th>Deactivated By</th>
            <th>Deactivated At</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.plan_id}>
              <td>{row.plan_id}</td>
              <td>{formatDisplayDate(row.plan_date)}</td>
              <td>{row.plantation_name}</td>
              <td>{row.estate_name}</td>
              <td>{Number(row.total_extent || 0).toFixed(2)}</td>
              <td className={workspace ? undefined : 'deactivated-plans-reason-cell'}>{row.deactivate_reason}</td>
              <td>{row.deactivated_by_name}</td>
              <td>{row.deactivated_at || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const chartBlock =
    reasonChartData.length > 0 ? (
      <div className="rds-ops-data">
        <div className="rds-metric-strip">
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Plans</div>
            <div className="rds-metric-strip-val">{filtered.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Reasons</div>
            <div className="rds-metric-strip-val">{reasonChartData.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Extent (Ha)</div>
            <div className="rds-metric-strip-val">
              {filtered.reduce((s, r) => s + (Number(r.total_extent) || 0), 0).toFixed(1)}
            </div>
          </div>
        </div>
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">By deactivate reason</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={reasonChartData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${String(name).slice(0, 18)} ${(percent * 100).toFixed(0)}%`}
              >
                {reasonChartData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {dailyChartData.length > 0 && (
          <div className="rds-chart-bleed">
            <div className="rds-chart-bleed-title">Daily volume</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Bar dataKey="count" name="Plans" fill="#0f6b4c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    ) : (
      <div className="rds-empty">
        {hasGenerated ? 'No chart data for this period.' : 'Select a period to load deactivated plans.'}
      </div>
    );

  if (workspace) {
    if (loading && !hasGenerated) {
      return (
        <div className="rds-loading">
          <Bars height={40} width={40} color="#0f6b4c" ariaLabel="loading" />
        </div>
      );
    }
    return (
      <div className="rds-ops-data">
        {view === 'chart' ? chartBlock : (
          <>
            {hasGenerated && (
              <div className="rds-metric-strip">
                <div className="rds-metric-strip-item">
                  <div className="rds-metric-strip-lbl">Deactivated</div>
                  <div className="rds-metric-strip-val">{filtered.length}</div>
                  {filtered.length !== plans.length && (
                    <div className="rds-metric-strip-sub">of {plans.length} in range</div>
                  )}
                </div>
              </div>
            )}
            {loading ? (
              <div className="rds-loading">
                <Bars height={40} width={40} color="#0f6b4c" ariaLabel="loading" />
              </div>
            ) : (
              tableBlock
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="deactivated-plans-report">
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
          <div className="deactivated-plans-field deactivated-plans-field--select deactivated-plans-field--reason">
            <span className="deactivated-plans-field-label">Deactivate Reason</span>
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
            <span className="deactivated-plans-field-label">Plantation</span>
            <select value={plantationFilter} onChange={(e) => setPlantationFilter(e.target.value)}>
              <option value="">All</option>
              {plantationOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
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
        <div className="deactivated-plans-summary">
          <FaBan aria-hidden />
          <span>
            <strong>{filtered.length}</strong> deactivated plan{filtered.length === 1 ? '' : 's'}
            {filtered.length !== plans.length ? ` (of ${plans.length} in range)` : ''}
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="deactivated-plans-loading">
          <Bars height={48} width={48} color="#004b71" ariaLabel="loading" />
        </div>
      ) : (
        tableBlock
      )}
    </div>
  );
}
