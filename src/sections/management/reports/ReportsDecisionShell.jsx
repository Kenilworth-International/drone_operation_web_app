import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bars } from 'react-loader-spinner';
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
  management: {
    label: 'Management',
    theme: 'theme-mgmt',
    boardTitle: 'Management board',
    accent: '#1e3a5f',
  },
  ops: {
    label: 'Operations Room',
    theme: 'theme-ops',
    boardTitle: 'Operations board',
    accent: '#0f6b4c',
  },
  plantation: {
    label: 'Plantation',
    theme: 'theme-plant',
    boardTitle: 'Plantation board',
    accent: '#6b5a3e',
  },
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
  const tabMeta = TAB_META[currentTab] || TAB_META.management;

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
  const ReportComponent = selectedReport?.component;

  return (
    <ReportsPeriodContext.Provider value={periodValue}>
      <OpsReportWorkspaceProvider>
        <div className={`rds-shell ${tabMeta.theme}`}>
          {isCorporateView && (
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

          {category === 'ops' && !selectedReport && (
            <div style={{ marginBottom: '0.75rem' }}>
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

          <BoardLayout
            catalog={catalog}
            tabMeta={tabMeta}
            selectedReport={selectedReport}
            onSelectReport={openReport}
            onClearReport={() => setSelectedReport(null)}
            periodValue={periodValue}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            activePreset={activePreset}
            setActivePreset={setActivePreset}
            applyPreset={applyPreset}
            overviewLoading={overviewLoading}
            summary={summary}
            trend={trend}
            ReportComponent={ReportComponent}
            exportHandler={exportHandler}
            onExportReady={onExportReady}
            startDate={startDate}
            endDate={endDate}
          />
        </div>
      </OpsReportWorkspaceProvider>
    </ReportsPeriodContext.Provider>
  );
};

function BoardLayout({
  catalog,
  tabMeta,
  selectedReport,
  onSelectReport,
  onClearReport,
  periodValue,
  setStartDate,
  setEndDate,
  activePreset,
  setActivePreset,
  applyPreset,
  overviewLoading,
  summary,
  trend,
  ReportComponent,
  exportHandler,
  onExportReady,
  startDate,
  endDate,
}) {
  const workspace = useOpsReportWorkspace();
  const usesWorkspaceControls = Boolean(selectedReport?.opsWorkspace);
  const pilotPct = clampPct(summary.pctPilot);
  const opsPct = clampPct(summary.pctOps);

  useEffect(() => {
    if (!selectedReport) {
      workspace?.clearSidebar?.();
      return undefined;
    }
    if (usesWorkspaceControls) return undefined;

    // Legacy / non-workspace reports: dates + Excel live in the left data-view panel
    workspace?.setSidebar?.(
      <div className="rds-ops-controls">
        <div className="rds-ops-controls-block">
          <div className="rds-ops-controls-label">Date range</div>
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
        <p className="rds-ops-hint">
          Chart / table and any extra filters appear on the right. Use Download Excel above the data
          when available.
        </p>
      </div>
    );
    return () => workspace?.clearSidebar?.();
  }, [
    selectedReport,
    usesWorkspaceControls,
    periodValue.startYmd,
    periodValue.endYmd,
    activePreset,
    workspace,
    setStartDate,
    setEndDate,
    setActivePreset,
    applyPreset,
  ]);

  return (
    <div className={`rds-ops${selectedReport ? ' rds-ops-report-open' : ''}`}>
      <aside className="rds-ops-rail">
        {selectedReport && (
          <button type="button" className="rds-back rds-ops-back" onClick={onClearReport}>
            ← Board
          </button>
        )}
        <div className="rds-ops-rail-label">Report rail</div>
        {(catalog.reports || []).map((report) => (
          <button
            key={report.id}
            type="button"
            className={`rds-ops-rail-item${selectedReport?.id === report.id ? ' is-active' : ''}`}
            onClick={() => onSelectReport(report)}
          >
            <span className="rds-ops-rail-name">{report.name}</span>
            {!selectedReport && (
              <span className="rds-ops-rail-desc">{report.description}</span>
            )}
          </button>
        ))}

        {selectedReport && (
          <>
            <div className="rds-ops-rail-divider" />
            <div className="rds-ops-rail-label">Data view</div>
            <h3 className="rds-ops-active-title">{selectedReport.name}</h3>
            <p className="rds-ops-active-desc">{selectedReport.description}</p>
            {workspace?.sidebar}
          </>
        )}
      </aside>

      <section className="rds-ops-stage">
        {!selectedReport && (
          <>
            <div>
              <h2 className="rds-ops-stage-title">{tabMeta.boardTitle}</h2>
              <p className="rds-ops-stage-sub">
                Snapshot for {periodValue.startYmd} → {periodValue.endYmd}. Open a report from the
                rail — chart / table on the right, Excel from the report toolbar.
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
                <Bars height={32} width={32} color={tabMeta.accent} />
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
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: '#5b726a' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#5b726a' }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                        />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="completedPilot"
                          name="Pilot"
                          stroke="#0f6b4c"
                          strokeWidth={2.5}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="completedOps"
                          name="OpsRoom"
                          stroke="#34d399"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {selectedReport && (
          <div
            className={`rds-stage-report${
              selectedReport.id === 'plan_execution_reasons' ? ' plan-excu-host' : ''
            }`}
          >
            <div className="rds-stage-report-top">
              <div>
                <h2 className="rds-ops-stage-title" style={{ marginBottom: 0 }}>
                  {selectedReport.name}
                </h2>
                <p className="rds-ops-stage-sub" style={{ marginTop: '0.25rem' }}>
                  {periodValue.startYmd} → {periodValue.endYmd}
                </p>
              </div>
              {typeof exportHandler === 'function' && (
                <button type="button" className="rds-export-btn" onClick={() => exportHandler()}>
                  Download Excel
                </button>
              )}
            </div>
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
      </section>
    </div>
  );
}

export default ReportsDecisionShell;
