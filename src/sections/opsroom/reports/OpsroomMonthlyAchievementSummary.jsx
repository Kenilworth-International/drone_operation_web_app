import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import { FiRefreshCw } from 'react-icons/fi';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import OpsroomPerfSummaryExportControls from './OpsroomPerfSummaryExportControls';
import {
  buildMonthlyTotalRow,
  createPerfSummaryPdfDoc,
  formatExportCell,
  getPdfAutoTableOptions,
  getPdfHeadRow,
} from './opsroomPerfSummaryExportUtils';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { useLazyGetOpsroomMonthlyAchievementSummaryQuery } from '../../../api/services NodeJs/opsroomPerformanceSummaryApi';
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

const MISSION_OPTIONS = [
  { value: 'spy', label: 'Spray' },
  { value: 'spd', label: 'Spread' },
  { value: 'all', label: 'All' },
];

const missionLabel = (code) => MISSION_OPTIONS.find((o) => o.value === code)?.label ?? 'Spray';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const monthsForYear = (year) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

const formatMonthChipLabel = (ym) => {
  const [, m] = ym.split('-');
  return MONTH_NAMES[parseInt(m, 10) - 1] || ym;
};

const formatMonthRangeLabel = (monthList) => {
  if (!monthList?.length) return '';
  if (monthList.length === 1) return formatMonthChipLabel(monthList[0]);
  const sorted = [...monthList].sort();
  return `${formatMonthChipLabel(sorted[0])} – ${formatMonthChipLabel(sorted[sorted.length - 1])}`;
};

const COLUMNS = [
  { key: 'month_display', label: 'Month' },
  { key: 'operational_target_ha', label: 'Operational target (Ha)' },
  { key: 'total_extent_assigned_ha', label: 'Extent assigned (Ha)' },
  { key: 'total_extent_attended_ha', label: 'Extent attended (Ha)' },
  { key: 'total_extent_completed_ops_ha', label: 'Extent completed (Ha) (ops)' },
  { key: 'total_extent_completed_pilot_ha', label: 'Extent completed (Ha) (pilot)' },
  { key: 'pct_achievement_ops', label: 'Achievement vs target (ops) %' },
  { key: 'pct_achievement_pilot', label: 'Achievement vs target (pilot) %' },
  { key: 'worked_pilots', label: 'Worked pilots' },
  { key: 'worked_drones', label: 'Worked drones' },
];

const OpsroomMonthlyAchievementSummary = ({ onExportReady }) => {
  const workspace = useOpsReportWorkspace();
  const [view, setView] = useState('chart');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonths, setSelectedMonths] = useState(() => monthsForYear(currentYear));
  const [selectedPlantations, setSelectedPlantations] = useState([]);
  const [missionType, setMissionType] = useState('all');
  const { data: plantations = [], isLoading: loadingPlantations } = useGetReportPlantationsQuery();
  const [trigger, { data: report, isFetching, error }] = useLazyGetOpsroomMonthlyAchievementSummaryQuery();

  const yearOptions = useMemo(() => {
    const opts = [];
    for (let y = currentYear; y >= currentYear - 10; y -= 1) {
      opts.push({ value: y, label: String(y) });
    }
    return opts;
  }, [currentYear]);

  const monthOptions = useMemo(
    () =>
      monthsForYear(selectedYear).map((ym) => {
        const monthIndex = parseInt(ym.split('-')[1], 10) - 1;
        return {
          value: ym,
          label: MONTH_SHORT[monthIndex] || ym,
          title: MONTH_NAMES[monthIndex] || ym,
        };
      }),
    [selectedYear],
  );

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
    setSelectedMonths(monthsForYear(selectedYear));
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
      year: selectedYear,
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

  useEffect(() => {
    setSelectedMonths(monthsForYear(selectedYear));
  }, [selectedYear]);

  const rows = report?.rows || [];
  const totals = report?.totals || {};
  const title = report?.year
    ? `Monthly Achievement Data — ${report.year}${report.months?.length && report.months.length < 12 ? ` (${formatMonthRangeLabel(report.months)})` : ''}`
    : 'Monthly Achievement Data';
  const totalRowLabel =
    report?.months?.length && report.months.length < 12 ? 'Total' : 'Year total';

  const formatCell = (key, value) => formatExportCell(key, value);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.month_display || r.year_month || '',
        completedOps: Number(r.total_extent_completed_ops_ha) || 0,
        completedPilot: Number(r.total_extent_completed_pilot_ha) || 0,
        achievementOps: Number(r.pct_achievement_ops) || 0,
        achievementPilot: Number(r.pct_achievement_pilot) || 0,
      })),
    [rows],
  );

  const exportExcel = (exportColumns) => {
    if (!rows.length || !exportColumns.length) return;
    const header = exportColumns.map((c) => c.label);
    const body = rows.map((r) => exportColumns.map((c) => formatCell(c.key, r[c.key])));
    const totalRow = buildMonthlyTotalRow(exportColumns, totals, totalRowLabel);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body, totalRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Achievement');
    XLSX.writeFile(wb, `Monthly_Achievement_${selectedYear}.xlsx`);
  };

  const exportPdf = (exportColumns) => {
    if (!rows.length || !exportColumns.length) return;
    const doc = createPerfSummaryPdfDoc();
    doc.setFontSize(12);
    doc.text(title, 14, 14);
    doc.setFontSize(8);
    doc.text(
      `Months: ${formatMonthRangeLabel(report?.months)} · Period target: ${report?.year_operational_target_ha ?? 0} Ha (${report?.year_plan_count ?? 0} plans × ${report?.ha_per_plan ?? 15} Ha) · Mission: ${missionLabel(report?.mission_type ?? missionType)}`,
      14,
      20,
    );
    autoTable(doc, {
      startY: 24,
      head: [getPdfHeadRow(exportColumns)],
      body: rows.map((r) =>
        exportColumns.map((c) => String(formatCell(c.key, r[c.key]) ?? '')),
      ),
      foot: [buildMonthlyTotalRow(exportColumns, totals, totalRowLabel).map((v) => String(v ?? ''))],
      ...getPdfAutoTableOptions(exportColumns),
    });
    doc.save(`Monthly_Achievement_${selectedYear}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(() => exportExcel(COLUMNS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, totals, selectedYear, totalRowLabel, onExportReady]);

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
            <div className="rds-ops-controls-block rds-ops-controls-inline">
              <span className="rds-ops-controls-label">Year</span>
              <label className="rds-ops-field rds-ops-field-inline">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={isFetching}
                >
                  {yearOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
              disabled={isFetching || selectedPlantations.length === 0 || selectedMonths.length === 0}
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
    selectedYear,
    yearOptions,
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
            <tr key={row.year_month}>
              {COLUMNS.map((c) => (
                <td key={c.key}>{formatCell(c.key, row[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              {COLUMNS.map((c) => (
                <td key={c.key}>
                  {c.key === 'month_display' ? totalRowLabel : formatCell(c.key, totals[c.key])}
                </td>
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
            <div className="rds-metric-strip-lbl">Months</div>
            <div className="rds-metric-strip-val">{rows.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Completed (ops)</div>
            <div className="rds-metric-strip-val">
              {Number(totals.total_extent_completed_ops_ha || 0).toFixed(1)}
            </div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Ach. ops %</div>
            <div className="rds-metric-strip-val">
              {Number(totals.pct_achievement_ops || 0).toFixed(0)}%
            </div>
          </div>
        </div>
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">Completed Ha + achievement % by month</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="ha"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                unit="%"
              />
              <Tooltip />
              <Legend />
              <Bar yAxisId="ha" dataKey="completedOps" name="Completed (ops) Ha" fill="#0f6b4c" />
              <Bar yAxisId="ha" dataKey="completedPilot" name="Completed (pilot) Ha" fill="#34d399" />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="achievementOps"
                name="Achievement (ops) %"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    ) : (
      <div className="rds-empty">
        {report
          ? 'No chart data for this period.'
          : 'Select year, months, and plantations, then Generate.'}
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
            <div className="rds-empty">Select year, months, and plantations, then Generate.</div>
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
              <label htmlFor="ops-monthly-year">Year</label>
            </div>
            <div className="ops-perf-summary__field" style={{ marginBottom: 12 }}>
              <select
                id="ops-monthly-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                disabled={isFetching}
              >
                {yearOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ops-perf-summary__panel-head">
              <label>Months (select one or more)</label>
              <div className="ops-perf-summary__panel-actions">
                <button
                  type="button"
                  className="ops-perf-summary__link-btn"
                  onClick={selectAllMonths}
                  disabled={isFetching}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="ops-perf-summary__link-btn"
                  onClick={clearAllMonths}
                  disabled={isFetching || selectedMonths.length === 0}
                >
                  Clear all
                </button>
              </div>
            </div>
            <div className="ops-perf-summary__month-grid-panel">
              <div className="ops-perf-summary__month-grid" role="group" aria-label="Months">
                {monthOptions.map((o) => {
                  const on = selectedMonths.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      title={o.title}
                      className={`ops-perf-summary__month-btn${on ? ' ops-perf-summary__month-btn--on' : ''}`}
                      onClick={() => toggleMonth(o.value)}
                      disabled={isFetching}
                      aria-pressed={on}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="ops-perf-summary__actions-row">
          <div className="ops-perf-summary__field">
            <label htmlFor="ops-monthly-mission">Mission</label>
            <select
              id="ops-monthly-mission"
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
            disabled={isFetching || selectedPlantations.length === 0 || selectedMonths.length === 0}
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

      {selectedMonths.length === 0 && (
        <p className="ops-perf-summary__error">Select at least one month for the chosen year, then click Generate.</p>
      )}

      {report && !isFetching && (
        <p className="ops-perf-summary__meta">
          Year: <strong>{report.year}</strong>.
          Months: <strong>{formatMonthRangeLabel(report.months)}</strong>.
          Mission: <strong>{missionLabel(report.mission_type ?? missionType)}</strong>.
          Period target: <strong>{report.year_operational_target_ha} Ha</strong> ({report.year_plan_count} plans × {report.ha_per_plan} Ha).
          Assigned = pilot-assigned field Ha; Attended = field Ha when DJI started; Completed (ops) = DJI field area;
          Completed (pilot) = pilot sub-task field area.
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
          Select plantations, year, and months, then click <strong>Generate</strong> to load the report.
        </p>
      )}
    </div>
  );
};

export default OpsroomMonthlyAchievementSummary;
