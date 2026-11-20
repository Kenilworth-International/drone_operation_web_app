import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import { FiRefreshCw } from 'react-icons/fi';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import OpsroomPerfSummaryExportControls from './OpsroomPerfSummaryExportControls';
import {
  buildDailyTotalRow,
  createPerfSummaryPdfDoc,
  formatExportCell,
  getPdfAutoTableOptions,
  getPdfHeadRow,
} from './opsroomPerfSummaryExportUtils';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { useLazyGetOpsroomDailyPerformanceSummaryQuery } from '../../../api/services NodeJs/opsroomPerformanceSummaryApi';
import { useGetReportPlantationsQuery } from '../../../api/services NodeJs/monthlyPlantationReportApi';
import { useOpsReportWorkspace } from '../../management/reports/OpsReportWorkspaceContext';
import OpsReportViewToggle from '../../management/reports/OpsReportViewToggle';
import {
  OpsFilterToolbar,
  OpsMultiMonthControls,
  OpsPlantationChipControls,
} from '../../management/reports/OpsPeriodControls';
import '../../management/reports/reportsDecisionShell.css';
import '../../../styles/opsroomPerformanceSummary.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatMonthLabel = (ym) => {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
};

const getCurrentYearMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const MISSION_OPTIONS = [
  { value: 'spy', label: 'Spray' },
  { value: 'spd', label: 'Spread' },
  { value: 'all', label: 'All' },
];

const missionLabel = (code) => MISSION_OPTIONS.find((o) => o.value === code)?.label ?? 'Spray';

const COLUMNS = [
  { key: 'date_display', label: 'Date' },
  { key: 'daily_operational_target_ha', label: 'Daily operational target (Ha)' },
  { key: 'total_extent_assigned_ha', label: 'Total extent assigned (Ha)' },
  { key: 'total_extent_attended_ha', label: 'Total extent attended (Ha)' },
  { key: 'total_extent_completed_ops_ha', label: 'Completed (ops) (Ha)' },
  { key: 'total_extent_completed_pilot_ha', label: 'Completed (pilot) (Ha)' },
  { key: 'pct_achievement_ops', label: 'Achievement vs daily target (ops) %' },
  { key: 'pct_achievement_pilot', label: 'Achievement vs daily target (pilot) %' },
  { key: 'active_pilots', label: 'Number of assigned pilots' },
  { key: 'active_drones', label: 'Number of assigned drones' },
];

const OpsroomDailyPerformanceSummary = ({ onExportReady }) => {
  const workspace = useOpsReportWorkspace();
  const [view, setView] = useState('chart');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState([getCurrentYearMonth()]);
  const [selectedPlantations, setSelectedPlantations] = useState([]);
  const [missionType, setMissionType] = useState('all');
  const { data: plantations = [], isLoading: loadingPlantations } = useGetReportPlantationsQuery();
  const [trigger, { data: report, isFetching, error }] = useLazyGetOpsroomDailyPerformanceSummaryQuery();

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      opts.push({ value: ym, label: formatMonthLabel(ym) });
    }
    return opts;
  }, []);

  const toggleMonth = (ym) => {
    setSelectedMonths((prev) => {
      if (prev.includes(ym)) {
        const next = prev.filter((m) => m !== ym);
        return next.length > 0 ? next : prev;
      }
      return [...prev, ym].sort();
    });
  };

  const selectAllMonths = () => {
    setSelectedMonths(monthOptions.map((o) => o.value).sort());
  };

  const clearAllMonths = () => {
    setSelectedMonths([]);
  };

  const togglePlantation = (id) => {
    setSelectedPlantations((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((p) => p !== id);
        return next.length > 0 ? next : prev;
      }
      return [...prev, id];
    });
  };

  const selectAllPlantations = () => {
    setSelectedPlantations(plantations.map((p) => p.id));
  };

  const clearAllPlantations = () => {
    setSelectedPlantations([]);
  };

  const plantationsInitialized = useRef(false);

  const loadReport = () => {
    if (selectedMonths.length === 0) return;
    trigger({
      months: [...selectedMonths].sort(),
      missionType,
      completedPlansOnly: false,
      plantationIds: selectedPlantations.length > 0 ? selectedPlantations : undefined,
    });
  };

  useEffect(() => {
    if (plantations.length > 0 && !plantationsInitialized.current) {
      setSelectedPlantations(plantations.map((p) => p.id));
      plantationsInitialized.current = true;
    }
  }, [plantations]);

  const rows = report?.rows || [];
  const totals = report?.totals || {};
  const sortedSelected = [...selectedMonths].sort();

  const title = useMemo(() => {
    if (report?.months?.length) {
      const labels = report.months.map(formatMonthLabel);
      if (labels.length === 1) return `Performance Summary of ${labels[0]}`;
      return `Performance Summary of ${labels[0]} – ${labels[labels.length - 1]}`;
    }
    return 'Performance Summary';
  }, [report]);

  const exportFileSuffix = sortedSelected.join('_') || 'report';

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.date_display || r.date || '',
        target: Number(r.daily_operational_target_ha) || 0,
        completedOps: Number(r.total_extent_completed_ops_ha) || 0,
        completedPilot: Number(r.total_extent_completed_pilot_ha) || 0,
      })),
    [rows],
  );

  const exportExcel = (exportColumns) => {
    if (!rows.length || !exportColumns.length) return;
    const header = exportColumns.map((c) => c.label);
    const body = rows.map((r) =>
      exportColumns.map((c) => formatExportCell(c.key, r[c.key])),
    );
    const totalRow = buildDailyTotalRow(exportColumns, totals);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body, totalRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance Summary');
    XLSX.writeFile(wb, `Performance_Summary_${exportFileSuffix}.xlsx`);
  };

  const exportPdf = (exportColumns) => {
    if (!rows.length || !exportColumns.length) return;
    const doc = createPerfSummaryPdfDoc();
    doc.setFontSize(12);
    doc.text(title, 14, 14);
    doc.setFontSize(8);
    doc.text(
      `Combined monthly target: ${report?.monthly_target_ha ?? 0} Ha (${report?.month_plan_count ?? 0} plans × ${report?.ha_per_plan ?? 15} Ha) · Mission: ${missionLabel(missionType)}`,
      14,
      20,
    );
    autoTable(doc, {
      startY: 24,
      head: [getPdfHeadRow(exportColumns)],
      body: rows.map((r) =>
        exportColumns.map((c) => String(formatExportCell(c.key, r[c.key]) ?? '')),
      ),
      foot: [buildDailyTotalRow(exportColumns, totals).map((v) => String(v ?? ''))],
      ...getPdfAutoTableOptions(exportColumns),
    });
    doc.save(`Performance_Summary_${exportFileSuffix}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(() => exportExcel(COLUMNS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, totals, exportFileSuffix, onExportReady]);

  useEffect(() => {
    if (!workspace?.setSidebar) return undefined;
    const filterSummary = `Filters · ${selectedMonths.length} mo · ${selectedPlantations.length} pl`;
    workspace.setSidebar(
      <OpsFilterToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
        filterSummary={filterSummary}
        primary={
          <>
            <OpsReportViewToggle view={view} onChange={setView} />
            <div className="rds-ops-controls-block rds-ops-controls-inline">
              <span className="rds-ops-controls-label">Mission</span>
              <label className="rds-ops-field rds-ops-field-inline">
                <select
                  value={missionType}
                  onChange={(e) => setMissionType(e.target.value)}
                  disabled={isFetching}
                >
                  {MISSION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="rds-ops-view-btn is-active"
              onClick={loadReport}
              disabled={isFetching || selectedMonths.length === 0 || selectedPlantations.length === 0}
            >
              Generate
            </button>
          </>
        }
        filters={
          <>
            <OpsMultiMonthControls
              options={monthOptions}
              selected={selectedMonths}
              onToggle={toggleMonth}
              onSelectAll={selectAllMonths}
              onClear={clearAllMonths}
              disabled={isFetching}
            />
            <OpsPlantationChipControls
              plantations={plantations}
              selected={selectedPlantations}
              onToggle={togglePlantation}
              onSelectAll={selectAllPlantations}
              onClear={clearAllPlantations}
              loading={loadingPlantations}
              disabled={isFetching}
            />
          </>
        }
      />
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspace?.setSidebar,
    filtersOpen,
    monthOptions,
    selectedMonths,
    selectedPlantations,
    plantations,
    loadingPlantations,
    missionType,
    view,
    isFetching,
  ]);

  const tableBlock = (
    <div className={workspace ? 'rds-table-wrap' : 'ops-perf-summary__table-wrap'}>
      {!workspace && <h2 className="ops-perf-summary__title">{title}</h2>}
      <table className={workspace ? 'rds-table' : 'ops-perf-summary__table'}>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.year_month}-${row.date}`}>
              {COLUMNS.map((c) => (
                <td key={c.key}>{formatExportCell(c.key, row[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              {buildDailyTotalRow(COLUMNS, totals).map((cell, idx) => (
                <td key={COLUMNS[idx].key}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  const chartBlock =
    chartData.length > 0 ? (
      <div className="rds-ops-data">
        <div className="rds-metric-strip">
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Days</div>
            <div className="rds-metric-strip-val">{rows.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Completed (ops)</div>
            <div className="rds-metric-strip-val">
              {Number(totals.total_extent_completed_ops_ha || 0).toFixed(1)}
            </div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Target</div>
            <div className="rds-metric-strip-val">
              {Number(report?.monthly_target_ha || 0).toFixed(1)}
            </div>
          </div>
        </div>
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">Daily completed vs target</div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="target" name="Target" stroke="#94a3b8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completedOps" name="Completed (ops)" stroke="#0f6b4c" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completedPilot" name="Completed (pilot)" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    ) : (
      <div className="rds-empty">
        {report
          ? 'No chart data for this period.'
          : 'Select months and plantations, then Generate.'}
      </div>
    );

  if (workspace) {
    if (isFetching && !report) {
      return (
        <div className="rds-loading">
          <Bars height={40} width={40} color="#0f6b4c" visible />
        </div>
      );
    }
    return (
      <div className="rds-ops-data">
        {error && (
          <p className="ops-perf-summary__error">Failed to load report. Check API connection and try again.</p>
        )}
        {isFetching ? (
          <div className="rds-loading">
            <Bars height={40} width={40} color="#0f6b4c" visible />
          </div>
        ) : (
          view === 'chart' ? chartBlock : (report ? tableBlock : (
            <div className="rds-empty">Select months and plantations, then Generate.</div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="ops-perf-summary">
      <div className="ops-perf-summary__toolbar">
        <div className="ops-perf-summary__filters-row">
          <div className="ops-perf-summary__panel ops-perf-summary__panel--left">
            <div className="ops-perf-summary__panel-head">
              <label>Plantations (select one or more)</label>
              <div className="ops-perf-summary__panel-actions">
                <button
                  type="button"
                  className="ops-perf-summary__link-btn"
                  onClick={selectAllPlantations}
                  disabled={loadingPlantations || plantations.length === 0}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="ops-perf-summary__link-btn"
                  onClick={clearAllPlantations}
                  disabled={loadingPlantations || selectedPlantations.length === 0}
                >
                  Clear all
                </button>
              </div>
            </div>
            <div className="ops-perf-summary__chip-panel">
              {loadingPlantations ? (
                <span className="ops-perf-summary__hint-inline">Loading plantations…</span>
              ) : (
                plantations.map((pl) => {
                  const on = selectedPlantations.includes(pl.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      className={`ops-perf-summary__chip${on ? ' ops-perf-summary__chip--on' : ''}`}
                      onClick={() => togglePlantation(pl.id)}
                      disabled={isFetching}
                    >
                      {pl.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="ops-perf-summary__panel ops-perf-summary__panel--right">
            <div className="ops-perf-summary__panel-head">
              <label>Months (select one or more)</label>
              <div className="ops-perf-summary__panel-actions">
                <button type="button" className="ops-perf-summary__link-btn" onClick={selectAllMonths}>
                  Select all
                </button>
                <button
                  type="button"
                  className="ops-perf-summary__link-btn"
                  onClick={clearAllMonths}
                  disabled={selectedMonths.length === 0}
                >
                  Clear all
                </button>
              </div>
            </div>
            <div className="ops-perf-summary__chip-panel">
              {monthOptions.map((o) => {
                const on = selectedMonths.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`ops-perf-summary__chip${on ? ' ops-perf-summary__chip--on' : ''}`}
                    onClick={() => toggleMonth(o.value)}
                    disabled={isFetching}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ops-perf-summary__actions-row">
          <div className="ops-perf-summary__field">
            <label htmlFor="ops-perf-mission">Mission</label>
            <select
              id="ops-perf-mission"
              value={missionType}
              onChange={(e) => setMissionType(e.target.value)}
              disabled={isFetching}
            >
              {MISSION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="ops-perf-summary__btn ops-perf-summary__btn--primary"
            onClick={loadReport}
            disabled={isFetching || selectedMonths.length === 0 || selectedPlantations.length === 0}
          >
            <FiRefreshCw /> Generate
          </button>
          <OpsroomPerfSummaryExportControls
            columns={COLUMNS}
            exportDisabled={!rows.length || isFetching}
            onExportExcel={exportExcel}
            onExportPdf={exportPdf}
          />
        </div>
      </div>

      {error && (
        <p className="ops-perf-summary__error">Failed to load report. Check API connection and try again.</p>
      )}

      {selectedPlantations.length === 0 && !loadingPlantations && (
        <p className="ops-perf-summary__error">Select at least one plantation, then click Generate.</p>
      )}

      {report && !isFetching && (
        <p className="ops-perf-summary__meta">
          Months: <strong>{report.months?.map(formatMonthLabel).join(', ')}</strong>.
          Mission: <strong>{missionLabel(report.mission_type ?? missionType)}</strong>.
          Combined target: <strong>{report.monthly_target_ha} Ha</strong> ({report.month_plan_count} plans × {report.ha_per_plan} Ha).
          Assigned = pilot-assigned field Ha; Attended = field Ha when DJI started; Completed (ops) = DJI field area;
          Completed (pilot) = pilot sub-task field area. Achievement % compares completed extent to daily target (ops or pilot).
        </p>
      )}

      {isFetching ? (
        <div className="ops-perf-summary__loading">
          <Bars height="48" width="48" color="#004B71" visible />
          <span>Loading…</span>
        </div>
      ) : report ? (
        tableBlock
      ) : (
        <p className="ops-perf-summary__meta" style={{ padding: 16 }}>
          Select plantations and months, then click <strong>Generate</strong> to load the report.
        </p>
      )}
    </div>
  );
};

export default OpsroomDailyPerformanceSummary;
