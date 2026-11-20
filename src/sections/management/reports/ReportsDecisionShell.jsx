import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bars } from 'react-loader-spinner';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../store/hooks';
import { ReportsPeriodContext } from './ReportsPeriodContext';
import {
  OpsReportWorkspaceProvider,
  useOpsReportWorkspace,
} from './OpsReportWorkspaceContext';
import {
  formatHa,
  formatPct,
  toYmd,
} from './reportsExcelExport';
import {
  flattenPilotPerformance,
  summarizeFieldRows,
  dailyTrendFromRows,
} from './reportsOverviewMetrics';
import './reportsDecisionShell.css';

const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfWeek = (d = new Date()) => {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
};
const lastMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start, end };
};

const TAB_META = {
  management: { label: 'Management', theme: 'theme-mgmt' },
  ops: { label: 'Operations Room', theme: 'theme-ops' },
  plantation: { label: 'Plantation', theme: 'theme-plant' },
};

const clampPct = (v) => Math.max(0, Math.min(100, Number(v) || 0));

const ReportsDecisionShell = ({ category = null, reportCatalog }) => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const dispatch = useAppDispatch();

  const isCorporateView = category === null || category === 'management';
  const lockedCategory =
    category && category !== 'management'
      ? category === 'finance'
        ? 'plantation'
        : category
      : null;

  const [activeTab, setActiveTab] = useState(lockedCategory || 'management');
  const [selectedReport, setSelectedReport] = useState(null);
  const [startDate, setStartDate] = useState(() => startOfMonth());
  const [endDate, setEndDate] = useState(() => new Date());
  const [activePreset, setActivePreset] = useState('month');
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewRows, setOverviewRows] = useState([]);
  const [exportHandler, setExportHandler] = useState(null);

  const currentTab = lockedCategory || (activeTab === 'finance' ? 'plantation' : activeTab);
  const catalog = reportCatalog[currentTab] || { title: '', reports: [] };
  const themeClass = TAB_META[currentTab]?.theme || 'theme-mgmt';

  const periodValue = useMemo(
    () => ({
      startDate,
      endDate,
      startYmd: toYmd(startDate),
      endYmd: toYmd(endDate),
    }),
    [startDate, endDate]
  );

  const applyPreset = (key) => {
    const today = new Date();
    setActivePreset(key);
    if (key === 'week') {
      setStartDate(startOfWeek(today));
      setEndDate(today);
    } else if (key === 'month') {
      setStartDate(startOfMonth(today));
      setEndDate(today);
    } else if (key === 'last') {
      const { start, end } = lastMonthRange();
      setStartDate(start);
      setEndDate(end);
    }
  };

  useEffect(() => {
    if (selectedReport) return;
    let cancelled = false;
    (async () => {
      setOverviewLoading(true);
      try {
        const result = await dispatch(
          baseApi.endpoints.getPilotPerformance.initiate({
            startDate: periodValue.startYmd,
            endDate: periodValue.endYmd,
          })
        );
        if (cancelled) return;
        setOverviewRows(flattenPilotPerformance(result.data || {}));
      } catch (e) {
        if (!cancelled) setOverviewRows([]);
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, periodValue.startYmd, periodValue.endYmd, selectedReport, currentTab]);

  const summary = useMemo(() => summarizeFieldRows(overviewRows), [overviewRows]);
  const trend = useMemo(
    () =>
      dailyTrendFromRows(overviewRows).map((t) => ({
        ...t,
        completedPilot: Number((t.completedPilot || 0).toFixed(2)),
        completedOps: Number((t.completedOps || 0).toFixed(2)),
        assigned: Number((t.assigned || 0).toFixed(2)),
      })),
    [overviewRows]
  );

  const onExportReady = useCallback((fn) => {
    setExportHandler(() => fn);
  }, []);

  useEffect(() => {
    setExportHandler(null);
  }, [selectedReport?.id]);

  const handleTabChange = (tab) => {
    setSelectedReport(null);
    setActiveTab(tab);
  };

  const openReport = (report) => setSelectedReport(report);

  const renderMgmtOverview = () => (
    <div className="rds-mgmt">
      <div className="rds-mgmt-hero">
        <div>
          <div className="rds-mgmt-kicker">Executive view</div>
          <h2 className="rds-mgmt-title">Management decisions</h2>
          <p className="rds-mgmt-lede">
            Period {periodValue.startYmd} → {periodValue.endYmd}. Browse the index below — each
            report opens in a focused workspace. Exports use this exact range.
          </p>
        </div>
        {!overviewLoading && (
          <div className="rds-mgmt-metrics">
            <div className="rds-mgmt-metric">
              <div className="rds-mgmt-metric-val">{formatHa(summary.assigned)}</div>
              <div className="rds-mgmt-metric-lbl">Assigned Ha</div>
            </div>
            <div className="rds-mgmt-metric">
              <div className="rds-mgmt-metric-val">{formatPct(summary.pctPilot)}</div>
              <div className="rds-mgmt-metric-lbl">Pilot %</div>
            </div>
            <div className="rds-mgmt-metric">
              <div className="rds-mgmt-metric-val">{formatPct(summary.pctOps)}</div>
              <div className="rds-mgmt-metric-lbl">OpsRoom %</div>
            </div>
          </div>
        )}
      </div>

      {overviewLoading ? (
        <div className="rds-loading">
          <Bars height={32} width={32} color="#1e3a5f" />
        </div>
      ) : (
        <div className="rds-mgmt-chart">
          <div className="rds-mgmt-chart-label">Completion trend · Pilot vs OpsRoom</div>
          {trend.length === 0 ? (
            <div className="rds-empty">No trend for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mgmtPilot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mgmtOps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="completedPilot" name="Pilot" stroke="#0ea5e9" fill="url(#mgmtPilot)" strokeWidth={2} />
                <Area type="monotone" dataKey="completedOps" name="OpsRoom" stroke="#1e3a5f" fill="url(#mgmtOps)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <div className="rds-mgmt-index">
        <div className="rds-mgmt-index-head">
          <span>#</span>
          <span>Report</span>
          <span />
        </div>
        {(catalog.reports || []).map((report, i) => (
          <button
            key={report.id}
            type="button"
            className="rds-mgmt-index-row"
            style={{ animationDelay: `${i * 0.04}s` }}
            onClick={() => openReport(report)}
          >
            <span className="rds-mgmt-index-num">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <p className="rds-mgmt-index-name">{report.name}</p>
              <p className="rds-mgmt-index-desc">{report.description}</p>
            </span>
            <span className="rds-mgmt-index-go" aria-hidden>
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderOpsOverview = () => {
    const pilotPct = clampPct(summary.pctPilot);
    const opsPct = clampPct(summary.pctOps);
    return (
      <div className="rds-ops">
        <aside className="rds-ops-rail">
          <div className="rds-ops-rail-label">Report rail</div>
          {(catalog.reports || []).map((report) => (
            <button
              key={report.id}
              type="button"
              className="rds-ops-rail-item"
              onClick={() => openReport(report)}
            >
              <span className="rds-ops-rail-name">{report.name}</span>
              <span className="rds-ops-rail-desc">{report.description}</span>
            </button>
          ))}
        </aside>

        <section className="rds-ops-stage">
          <div>
            <h2 className="rds-ops-stage-title">Operations board</h2>
            <p className="rds-ops-stage-sub">
              Snapshot for {periodValue.startYmd} → {periodValue.endYmd}. Open a report from the rail —
              each report keeps its own dates and Excel download.
            </p>
            <div className="rds-ops-board-dates">
              <label className="rds-ops-field">
                <span>From</span>
                <input
                  type="date"
                  value={periodValue.startYmd}
                  max={periodValue.endYmd}
                  onChange={(e) => {
                    setActivePreset(null);
                    if (e.target.value) setStartDate(new Date(`${e.target.value}T00:00:00`));
                  }}
                />
              </label>
              <label className="rds-ops-field">
                <span>To</span>
                <input
                  type="date"
                  value={periodValue.endYmd}
                  min={periodValue.startYmd}
                  max={toYmd(new Date())}
                  onChange={(e) => {
                    setActivePreset(null);
                    if (e.target.value) setEndDate(new Date(`${e.target.value}T00:00:00`));
                  }}
                />
              </label>
              <div className="rds-ops-view-toggle">
                {[
                  ['week', 'Week'],
                  ['month', 'Month'],
                  ['last', 'Last'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`rds-ops-view-btn${activePreset === key ? ' is-active' : ''}`}
                    onClick={() => applyPreset(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {overviewLoading ? (
            <div className="rds-loading">
              <Bars height={32} width={32} color="#0f6b4c" />
            </div>
          ) : (
            <>
              <div className="rds-ops-gauges">
                <div>
                  <div className="rds-ops-gauge-head">
                    <span>Pilot completion</span>
                    <strong>{formatPct(summary.pctPilot)}</strong>
                  </div>
                  <div className="rds-ops-gauge-track">
                    <div className="rds-ops-gauge-fill" style={{ width: `${pilotPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="rds-ops-gauge-head">
                    <span>OpsRoom completion</span>
                    <strong>{formatPct(summary.pctOps)}</strong>
                  </div>
                  <div className="rds-ops-gauge-track">
                    <div className="rds-ops-gauge-fill is-ops" style={{ width: `${opsPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="rds-ops-dual">
                <div>
                  <div className="rds-ops-dual-val">{formatHa(summary.completedPilot)}</div>
                  <div className="rds-ops-dual-lbl">Pilot Ha completed</div>
                </div>
                <div>
                  <div className="rds-ops-dual-val">{formatHa(summary.completedOps)}</div>
                  <div className="rds-ops-dual-lbl">OpsRoom Ha completed</div>
                </div>
              </div>

              <div className="rds-ops-chart">
                <div className="rds-ops-chart-label">Daily completed Ha</div>
                {trend.length === 0 ? (
                  <div className="rds-empty">No daily series</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke="#c9d9d2" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5b726a' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#5b726a' }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="completedPilot" name="Pilot" stroke="#0f6b4c" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="completedOps" name="OpsRoom" stroke="#34d399" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    );
  };

  const renderPlantOverview = () => (
    <div className="rds-plant">
      <div className="rds-plant-intro">
        <div className="rds-plant-kicker">Field & estate</div>
        <h2 className="rds-plant-title">Plantation reports</h2>
        <p className="rds-plant-story">
          For{' '}
          <em>
            {periodValue.startYmd} → {periodValue.endYmd}
          </em>
          , operations covered{' '}
          <em>{overviewLoading ? '…' : formatHa(summary.completedOps)} Ha</em> (OpsRoom) against{' '}
          <em>{overviewLoading ? '…' : formatHa(summary.assigned)} Ha</em> assigned. Open a report
          below — each uses a quieter, reading-first layout.
        </p>
        {!overviewLoading && trend.length > 0 && (
          <div className="rds-plant-spark rds-ui-sans">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={trend} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="plantFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a67c52" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#a67c52" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="completedOps"
                  name="OpsRoom Ha"
                  stroke="#6b5a3e"
                  fill="url(#plantFill)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rds-plant-flow">
        {(catalog.reports || []).map((report, i) => (
          <button
            key={report.id}
            type="button"
            className="rds-plant-item"
            onClick={() => openReport(report)}
          >
            <span className="rds-plant-item-mark">
              {String.fromCharCode(65 + (i % 26))}
            </span>
            <span>
              <p className="rds-plant-item-name">{report.name}</p>
              <p className="rds-plant-item-desc">{report.description}</p>
            </span>
            <span className="rds-plant-item-action">Open report →</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderOverview = () => {
    if (currentTab === 'ops') return renderOpsOverview();
    if (currentTab === 'plantation') return renderPlantOverview();
    return renderMgmtOverview();
  };

  const ReportComponent = selectedReport?.component;
  const uiKind = selectedReport?.uiKind || 'ui-dense';
  const isOpsTab = currentTab === 'ops';
  const showTopPeriod = !isOpsTab;

  return (
    <ReportsPeriodContext.Provider value={periodValue}>
      <OpsReportWorkspaceProvider>
        <div className={`rds-shell ${themeClass}`}>
          {showTopPeriod && (
            <div className="rds-period">
              <div className="rds-period-field">
                <span className="rds-period-label">From</span>
                <input
                  type="date"
                  value={periodValue.startYmd}
                  max={periodValue.endYmd}
                  onChange={(e) => {
                    setActivePreset(null);
                    const v = e.target.value;
                    if (v) setStartDate(new Date(`${v}T00:00:00`));
                  }}
                />
              </div>
              <div className="rds-period-field">
                <span className="rds-period-label">To</span>
                <input
                  type="date"
                  value={periodValue.endYmd}
                  min={periodValue.startYmd}
                  max={toYmd(new Date())}
                  onChange={(e) => {
                    setActivePreset(null);
                    const v = e.target.value;
                    if (v) setEndDate(new Date(`${v}T00:00:00`));
                  }}
                />
              </div>
              <div className="rds-presets">
                {[
                  ['week', 'This week'],
                  ['month', 'This month'],
                  ['last', 'Last month'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`rds-preset${activePreset === key ? ' is-active' : ''}`}
                    onClick={() => applyPreset(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isCorporateView && !selectedReport && (
            <div className="rds-tabs">
              {['management', 'ops', 'plantation'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`rds-tab${currentTab === tab ? ' is-active' : ''}`}
                  onClick={() => handleTabChange(tab)}
                >
                  {TAB_META[tab].label}
                </button>
              ))}
            </div>
          )}

          {!selectedReport && category === 'ops' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <button
                type="button"
                className="rds-back"
                onClick={() =>
                  navigate({
                    pathname: '/home/workflowDashboard',
                    search: routerLocation.search,
                  })
                }
              >
                ← Workflow
              </button>
            </div>
          )}

          {!selectedReport && renderOverview()}

          {selectedReport && isOpsTab && (
            <OpsSelectedReportLayout
              catalog={catalog}
              selectedReport={selectedReport}
              onBack={() => setSelectedReport(null)}
              onSelectReport={openReport}
              ReportComponent={ReportComponent}
            />
          )}

          {selectedReport && !isOpsTab && (
            <div
              className={`rds-report-host ${uiKind}${
                selectedReport.id === 'plan_execution_reasons' ? ' plan-excu-host' : ''
              }`}
            >
              <div className="rds-report-toolbar">
                <button type="button" className="rds-back" onClick={() => setSelectedReport(null)}>
                  ← All reports
                </button>
                <h2 className="rds-report-title">{selectedReport.name}</h2>
                {typeof exportHandler === 'function' && (
                  <button type="button" className="rds-export-btn" onClick={() => exportHandler()}>
                    Download Excel
                  </button>
                )}
              </div>
              <p className="rds-muted" style={{ margin: 0 }}>
                {selectedReport.description}
                <span aria-hidden> · </span>
                {periodValue.startYmd} → {periodValue.endYmd}
              </p>
              <div
                className={
                  selectedReport.id === 'plan_execution_reasons' ? 'plan-excu-host-content' : undefined
                }
              >
                {ReportComponent ? (
                  <ReportComponent
                    startDate={startDate}
                    endDate={endDate}
                    onExportReady={onExportReady}
                  />
                ) : (
                  <div className="rds-empty">Report unavailable.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </OpsReportWorkspaceProvider>
    </ReportsPeriodContext.Provider>
  );
};

/** Ops Room: left = view options / dates / excel; right = chart/table. */
function OpsSelectedReportLayout({
  catalog,
  selectedReport,
  onBack,
  onSelectReport,
  ReportComponent,
}) {
  const workspace = useOpsReportWorkspace();
  const usesWorkspaceControls = Boolean(selectedReport?.opsWorkspace);

  useEffect(() => {
    if (usesWorkspaceControls) return undefined;
    workspace?.setSidebar?.(
      <div className="rds-ops-controls">
        <p className="rds-ops-hint">
          This report keeps its own date and export controls in the view on the right.
        </p>
      </div>
    );
    return () => workspace?.clearSidebar?.();
  }, [usesWorkspaceControls, selectedReport?.id, workspace]);

  return (
    <div className="rds-ops rds-ops-report-open">
      <aside className="rds-ops-rail">
        <button type="button" className="rds-back rds-ops-back" onClick={onBack}>
          ← Board
        </button>
        <div className="rds-ops-rail-label">Reports</div>
        {(catalog.reports || []).map((report) => (
          <button
            key={report.id}
            type="button"
            className={`rds-ops-rail-item${selectedReport.id === report.id ? ' is-active' : ''}`}
            onClick={() => onSelectReport(report)}
          >
            <span className="rds-ops-rail-name">{report.name}</span>
          </button>
        ))}
        <div className="rds-ops-rail-divider" />
        <div className="rds-ops-rail-label">Data view</div>
        <h3 className="rds-ops-active-title">{selectedReport.name}</h3>
        <p className="rds-ops-active-desc">{selectedReport.description}</p>
        {workspace?.sidebar}
      </aside>
      <section className="rds-ops-stage">
        {ReportComponent ? <ReportComponent /> : <div className="rds-empty">Report unavailable.</div>}
      </section>
    </div>
  );
}

export default ReportsDecisionShell;
