import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import { FiRefreshCw } from 'react-icons/fi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import OpsroomPerfSummaryExportControls from './OpsroomPerfSummaryExportControls';
import {
  buildPilotTotalRow,
  createPerfSummaryPdfDoc,
  formatExportCell,
  getPdfAutoTableOptions,
  getPdfHeadRow,
} from './opsroomPerfSummaryExportUtils';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { useLazyGetOpsroomPilotDailyPerformanceSummaryQuery } from '../../../api/services NodeJs/opsroomPerformanceSummaryApi';
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
  { value: 'all', label: 'All' },
  { value: 'spy', label: 'Spray' },
  { value: 'spd', label: 'Spread' },
];

const missionLabel = (code) => MISSION_OPTIONS.find((o) => o.value === code)?.label ?? 'All';

const COLUMNS = [
  { key: 'date_display', label: 'Date' },
  { key: 'daily_operational_target_ha', label: 'Daily operational target (Ha)' },
  { key: 'total_extent_assigned_ha', label: 'Total extent assigned (Ha)' },
  { key: 'total_extent_attended_ha', label: 'Total extent attended (Ha)' },
  { key: 'total_extent_completed_ops_ha', label: 'Completed (ops) (Ha)' },
  { key: 'total_extent_completed_pilot_ha', label: 'Completed (pilot) (Ha)' },
  { key: 'pct_achievement_ops', label: 'Achievement vs daily target (ops) %' },
  { key: 'pct_achievement_pilot', label: 'Achievement vs daily target (pilot) %' },
];

const formatCell = (key, value) => formatExportCell(key, value);

const pilotSectionTitle = (pilot) =>
  `${pilot.pilot_name} — ${formatMonthLabel(pilot.year_month)} — ${missionLabel(pilot.mission_type)} (${pilot.month_plan_count} plans · target ${pilot.monthly_target_ha} Ha)`;

const OpsroomPilotDailyPerformanceSummary = ({ onExportReady }) => {
  const workspace = useOpsReportWorkspace();
  const [view, setView] = useState('chart');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState([getCurrentYearMonth()]);
  const [selectedPlantations, setSelectedPlantations] = useState([]);
  const [missionType, setMissionType] = useState('all');
  const [selectedPilotId, setSelectedPilotId] = useState('');
  const { data: plantations = [], isLoading: loadingPlantations } = useGetReportPlantationsQuery();
  const [trigger, { data: report, isFetching, error }] =
    useLazyGetOpsroomPilotDailyPerformanceSummaryQuery();

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

  const selectAllMonths = () => setSelectedMonths(monthOptions.map((o) => o.value).sort());
  const clearAllMonths = () => setSelectedMonths([]);

  const togglePlantation = (id) => {
    setSelectedPlantations((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((p) => p !== id);
        return next.length > 0 ? next : prev;
      }
      return [...prev, id];
    });
  };

  const selectAllPlantations = () => setSelectedPlantations(plantations.map((p) => p.id));
  const clearAllPlantations = () => setSelectedPlantations([]);

  const plantationsInitialized = useRef(false);

  const loadReport = () => {
    if (selectedMonths.length === 0 || selectedPlantations.length === 0) return;
    setMissionType('all');
    setSelectedPilotId('');
    trigger({
      months: [...selectedMonths].sort(),
      missionType: 'all',
      completedPlansOnly: false,
      plantationIds: selectedPlantations,
    });
  };

  useEffect(() => {
    if (plantations.length > 0 && !plantationsInitialized.current) {
      setSelectedPlantations(plantations.map((p) => p.id));
      plantationsInitialized.current = true;
    }
  }, [plantations]);

  const pilotOptions = useMemo(() => {
    const byId = new Map();
    (report?.pilots || []).forEach((p) => {
      if (!byId.has(p.pilot_id)) {
        byId.set(p.pilot_id, p.pilot_name || `Pilot #${p.pilot_id}`);
      }
    });
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [report]);

  const filteredPilots = useMemo(() => {
    let list = report?.pilots || [];
    if (missionType !== 'all') {
      list = list.filter((p) => p.mission_type === missionType);
    }
    if (selectedPilotId) {
      list = list.filter((p) => String(p.pilot_id) === String(selectedPilotId));
    }
    return list;
  }, [report, missionType, selectedPilotId]);

  const filteredFlatRows = useMemo(
    () =>
      filteredPilots.flatMap((p) =>
        p.rows.map((r) => ({
          ...r,
          pilot_id: p.pilot_id,
          pilot_name: p.pilot_name,
          mission_type: p.mission_type,
        })),
      ),
    [filteredPilots],
  );

  const chartData = useMemo(() => {
    const byPilot = new Map();
    filteredFlatRows.forEach((r) => {
      const key = r.pilot_name || `Pilot #${r.pilot_id}`;
      if (!byPilot.has(key)) {
        byPilot.set(key, { name: key, assigned: 0, completedOps: 0, completedPilot: 0 });
      }
      const b = byPilot.get(key);
      b.assigned += Number(r.total_extent_assigned_ha) || 0;
      b.completedOps += Number(r.total_extent_completed_ops_ha) || 0;
      b.completedPilot += Number(r.total_extent_completed_pilot_ha) || 0;
    });
    return Array.from(byPilot.values())
      .sort((a, b) => b.completedOps - a.completedOps)
      .slice(0, 12)
      .map((r) => ({
        ...r,
        assigned: Number(r.assigned.toFixed(2)),
        completedOps: Number(r.completedOps.toFixed(2)),
        completedPilot: Number(r.completedPilot.toFixed(2)),
      }));
  }, [filteredFlatRows]);

  const sortedSelected = [...selectedMonths].sort();
  const exportFileSuffix = sortedSelected.join('_') || 'report';
  const hasReport = Boolean(report && !isFetching);

  const exportFilterSlug = useMemo(() => {
    const missionPart = missionType === 'all' ? 'all_missions' : missionType;
    const pilotPart = selectedPilotId
      ? String(pilotOptions.find((p) => String(p.id) === String(selectedPilotId))?.name || selectedPilotId)
          .replace(/[^\w.-]+/g, '_')
          .slice(0, 40)
      : 'all_pilots';
    return `${missionPart}_${pilotPart}`;
  }, [missionType, selectedPilotId, pilotOptions]);

  const exportExcel = (exportColumns) => {
    if (!filteredPilots.length || !exportColumns.length) return;

    const aoa = [
      ['Pilot Daily Performance Summary'],
      ['Months', report?.months?.map(formatMonthLabel).join(', ') || ''],
      ['Mission filter', missionLabel(missionType)],
      [
        'Pilot filter',
        selectedPilotId
          ? pilotOptions.find((p) => String(p.id) === String(selectedPilotId))?.name || selectedPilotId
          : 'All',
      ],
      [],
    ];

    filteredPilots.forEach((pilot, idx) => {
      aoa.push([pilotSectionTitle(pilot)]);
      aoa.push(exportColumns.map((c) => c.label));
      pilot.rows.forEach((r) => {
        aoa.push(exportColumns.map((c) => formatCell(c.key, r[c.key])));
      });
      aoa.push(buildPilotTotalRow(exportColumns, pilot.totals));
      if (idx < filteredPilots.length - 1) aoa.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pilot Performance');
    XLSX.writeFile(wb, `Pilot_Performance_${exportFileSuffix}_${exportFilterSlug}.xlsx`);
  };

  const exportPdf = (exportColumns) => {
    if (!filteredPilots.length || !exportColumns.length) return;
    const doc = createPerfSummaryPdfDoc();
    let y = 14;
    doc.setFontSize(12);
    doc.text('Pilot Daily Performance Summary', 14, y);
    y += 8;
    doc.setFontSize(8);
    doc.text(
      `Months: ${report?.months?.map(formatMonthLabel).join(', ') || ''} · View: ${missionLabel(missionType)} · ${selectedPilotId ? pilotOptions.find((p) => String(p.id) === String(selectedPilotId))?.name : 'All pilots'}`,
      14,
      y,
    );
    y += 10;

    filteredPilots.forEach((pilot, idx) => {
      if (y > 165) {
        doc.addPage();
        y = 14;
      }
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text(pilotSectionTitle(pilot), 14, y);
      doc.setFont(undefined, 'normal');
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [getPdfHeadRow(exportColumns)],
        body: pilot.rows.map((r) =>
          exportColumns.map((c) => String(formatCell(c.key, r[c.key]) ?? '')),
        ),
        foot: [buildPilotTotalRow(exportColumns, pilot.totals).map((v) => String(v ?? ''))],
        ...getPdfAutoTableOptions(exportColumns, { styles: { fontSize: 6 } }),
      });
      y = (doc.lastAutoTable?.finalY || y) + 12;
      if (idx < filteredPilots.length - 1 && y > 175) {
        doc.addPage();
        y = 14;
      }
    });
    doc.save(`Pilot_Performance_${exportFileSuffix}_${exportFilterSlug}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(() => exportExcel(COLUMNS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPilots, exportFileSuffix, exportFilterSlug, onExportReady]);

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
                  disabled={!hasReport && !report}
                >
                  {MISSION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rds-ops-controls-block rds-ops-controls-inline">
              <span className="rds-ops-controls-label">Pilot</span>
              <label className="rds-ops-field rds-ops-field-inline">
                <select
                  value={selectedPilotId}
                  onChange={(e) => setSelectedPilotId(e.target.value)}
                  disabled={!hasReport && !report}
                >
                  <option value="">All</option>
                  {pilotOptions.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
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
    selectedPilotId,
    pilotOptions,
    view,
    isFetching,
    hasReport,
    report,
  ]);

  const renderPilotTable = (pilot) => (
    <div
      key={`${pilot.pilot_id}-${pilot.mission_type}-${pilot.year_month}`}
      className="ops-perf-summary__pilot-block"
    >
      <h3 className="ops-perf-summary__pilot-title">{pilotSectionTitle(pilot)}</h3>
      <table className={workspace ? 'rds-table' : 'ops-perf-summary__table'}>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pilot.rows.map((row) => (
            <tr key={`${pilot.pilot_id}-${pilot.mission_type}-${row.date}`}>
              {COLUMNS.map((c) => (
                <td key={c.key}>{formatCell(c.key, row[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {buildPilotTotalRow(COLUMNS, pilot.totals).map((cell, idx) => (
              <td key={COLUMNS[idx].key}>{cell}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const tableBlock = (
    <div className={workspace ? 'rds-table-wrap' : 'ops-perf-summary__table-wrap'}>
      {!workspace && <h2 className="ops-perf-summary__title">Pilot Daily Performance Summary</h2>}
      {report?.pilots?.length === 0 ? (
        <p className={workspace ? 'rds-empty' : 'ops-perf-summary__meta'} style={workspace ? undefined : { padding: 16 }}>
          No pilot activity for the selected plantations and months.
        </p>
      ) : filteredPilots.length === 0 ? (
        <p className={workspace ? 'rds-empty' : 'ops-perf-summary__meta'} style={workspace ? undefined : { padding: 16 }}>
          No data for the current Mission / Pilot filter. Try All for both.
        </p>
      ) : (
        filteredPilots.map(renderPilotTable)
      )}
    </div>
  );

  const chartBlock =
    chartData.length > 0 ? (
      <div className="rds-ops-data">
        <div className="rds-metric-strip">
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Pilots</div>
            <div className="rds-metric-strip-val">{filteredPilots.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Rows</div>
            <div className="rds-metric-strip-val">{filteredFlatRows.length}</div>
          </div>
        </div>
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">Top pilots · assigned vs completed (Ha)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={56} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip />
              <Legend />
              <Bar dataKey="assigned" name="Assigned" fill="#94a3b8" />
              <Bar dataKey="completedOps" name="Completed (ops)" fill="#0f6b4c" />
              <Bar dataKey="completedPilot" name="Completed (pilot)" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    ) : (
      <div className="rds-empty">
        {report
          ? 'No chart data for current filters.'
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
            <label htmlFor="ops-pilot-perf-mission">Mission (filter view)</label>
            <select
              id="ops-pilot-perf-mission"
              value={missionType}
              onChange={(e) => setMissionType(e.target.value)}
              disabled={!hasReport}
            >
              {MISSION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ops-perf-summary__field">
            <label htmlFor="ops-pilot-perf-pilot">Pilot (filter view)</label>
            <select
              id="ops-pilot-perf-pilot"
              value={selectedPilotId}
              onChange={(e) => setSelectedPilotId(e.target.value)}
              disabled={!hasReport}
            >
              <option value="">All</option>
              {pilotOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
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
            exportDisabled={!hasReport || !filteredFlatRows.length}
            onExportExcel={exportExcel}
            onExportPdf={exportPdf}
          />
        </div>
      </div>

      {error && (
        <p className="ops-perf-summary__error">Failed to load report. Check API connection and try again.</p>
      )}

      {selectedPlantations.length === 0 && !loadingPlantations && !hasReport && (
        <p className="ops-perf-summary__error">Select at least one plantation, then click Generate.</p>
      )}

      {hasReport && (
        <p className="ops-perf-summary__meta">
          Showing <strong>{filteredPilots.length}</strong> of <strong>{report.pilot_count ?? 0}</strong> tables
          · Mission: <strong>{missionLabel(missionType)}</strong>
          · Pilot: <strong>{selectedPilotId ? pilotOptions.find((p) => String(p.id) === String(selectedPilotId))?.name : 'All'}</strong>.
          Filters apply instantly — click <strong>Generate</strong> again to change plantations or months.
        </p>
      )}

      {isFetching ? (
        <div className="ops-perf-summary__loading">
          <Bars height="48" width="48" color="#004B71" visible />
          <span>Loading…</span>
        </div>
      ) : hasReport ? (
        tableBlock
      ) : (
        <p className="ops-perf-summary__meta" style={{ padding: 16 }}>
          Select plantations and months, then click <strong>Generate</strong> to load the report.
        </p>
      )}
    </div>
  );
};

export default OpsroomPilotDailyPerformanceSummary;
