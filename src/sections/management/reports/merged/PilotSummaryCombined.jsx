import React, { useEffect, useMemo, useState } from 'react';
import { Bars } from 'react-loader-spinner';
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
import { baseApi } from '../../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../../store/hooks';
import { useOpsReportWorkspace } from '../OpsReportWorkspaceContext';
import {
  exportLegacyExcel,
  formatHa,
  formatPct,
  toYmd,
} from '../reportsExcelExport';
import { rollupPilotSummary } from '../reportsOverviewMetrics';
import '../reportsDecisionShell.css';

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const PilotSummaryCombined = () => {
  const dispatch = useAppDispatch();
  const workspace = useOpsReportWorkspace();
  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(() => new Date());
  const [view, setView] = useState('both');
  const [pilotFilter, setPilotFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await dispatch(
          baseApi.endpoints.getPilotPerformance.initiate({
            startDate: toYmd(startDate),
            endDate: toYmd(endDate),
          })
        );
        if (!cancelled) setRows(rollupPilotSummary(result.data || {}));
      } catch (e) {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, startDate, endDate]);

  const sorted = useMemo(() => {
    const list = [...rows].sort((a, b) => (b.assignedTotal || 0) - (a.assignedTotal || 0));
    if (!pilotFilter) return list;
    return list.filter((r) => r.pilotName === pilotFilter);
  }, [rows, pilotFilter]);

  const chartData = useMemo(
    () =>
      sorted.slice(0, 15).map((r) => ({
        name: r.pilotName,
        assigned: Number((r.assignedTotal || 0).toFixed(2)),
        pilot: Number((r.completedPilotTotal || 0).toFixed(2)),
        ops: Number((r.completedOpsTotal || 0).toFixed(2)),
      })),
    [sorted]
  );

  const maxAssigned = sorted[0]?.assignedTotal || 1;

  const totals = useMemo(
    () =>
      sorted.reduce(
        (acc, r) => {
          acc.assignedSpray += Number(r.assignedSpray) || 0;
          acc.assignedSpread += Number(r.assignedSpread) || 0;
          acc.assignedTotal += Number(r.assignedTotal) || 0;
          acc.completedPilotSpray += Number(r.completedPilotSpray) || 0;
          acc.completedPilotSpread += Number(r.completedPilotSpread) || 0;
          acc.completedPilotTotal += Number(r.completedPilotTotal) || 0;
          acc.completedOpsSpray += Number(r.completedOpsSpray) || 0;
          acc.completedOpsSpread += Number(r.completedOpsSpread) || 0;
          acc.completedOpsTotal += Number(r.completedOpsTotal) || 0;
          acc.flyingTime += Number(r.flyingTime) || 0;
          return acc;
        },
        {
          assignedSpray: 0,
          assignedSpread: 0,
          assignedTotal: 0,
          completedPilotSpray: 0,
          completedPilotSpread: 0,
          completedPilotTotal: 0,
          completedOpsSpray: 0,
          completedOpsSpread: 0,
          completedOpsTotal: 0,
          flyingTime: 0,
        }
      ),
    [sorted]
  );

  const handleExport = () => {
    // Legacy summary columns + OpsRoom / % extras
    const headers = [
      'Pilot',
      'Assigned (Spray)',
      'Assigned (Spread)',
      'Assigned (Total)',
      'Completed Pilot (Spray)',
      'Completed Pilot (Spread)',
      'Completed Pilot (Total)',
      'Completed OpsRoom (Spray)',
      'Completed OpsRoom (Spread)',
      'Completed OpsRoom (Total)',
      '% Pilot',
      '% OpsRoom',
      'Flying Time (min)',
    ];
    const dataRows = sorted.map((r) => [
      r.pilotName,
      formatHa(r.assignedSpray),
      formatHa(r.assignedSpread),
      formatHa(r.assignedTotal),
      formatHa(r.completedPilotSpray),
      formatHa(r.completedPilotSpread),
      formatHa(r.completedPilotTotal),
      formatHa(r.completedOpsSpray),
      formatHa(r.completedOpsSpread),
      formatHa(r.completedOpsTotal),
      formatPct(r.pctPilot),
      formatPct(r.pctOps),
      Number(r.flyingTime || 0).toFixed(1),
    ]);
    dataRows.push([
      'Total',
      formatHa(totals.assignedSpray),
      formatHa(totals.assignedSpread),
      formatHa(totals.assignedTotal),
      formatHa(totals.completedPilotSpray),
      formatHa(totals.completedPilotSpread),
      formatHa(totals.completedPilotTotal),
      formatHa(totals.completedOpsSpray),
      formatHa(totals.completedOpsSpread),
      formatHa(totals.completedOpsTotal),
      '',
      '',
      Number(totals.flyingTime || 0).toFixed(1),
    ]);
    const label = pilotFilter || 'All';
    exportLegacyExcel({
      sheetName: 'Pilot Performance',
      fileName: `Pilot_Performance_Summary_${String(label).replace(/\s+/g, '_')}_${toYmd(startDate)}_to_${toYmd(endDate)}.xlsx`,
      headers,
      rows: dataRows,
    });
  };

  useEffect(() => {
    if (!workspace?.setSidebar) return undefined;
    workspace.setSidebar(
      <div className="rds-ops-controls">
        <div className="rds-ops-controls-block">
          <div className="rds-ops-controls-label">Date range</div>
          <label className="rds-ops-field">
            <span>From</span>
            <input
              type="date"
              value={toYmd(startDate)}
              max={toYmd(endDate)}
              onChange={(e) => e.target.value && setStartDate(new Date(`${e.target.value}T00:00:00`))}
            />
          </label>
          <label className="rds-ops-field">
            <span>To</span>
            <input
              type="date"
              value={toYmd(endDate)}
              min={toYmd(startDate)}
              max={toYmd(new Date())}
              onChange={(e) => e.target.value && setEndDate(new Date(`${e.target.value}T00:00:00`))}
            />
          </label>
        </div>

        <div className="rds-ops-controls-block">
          <div className="rds-ops-controls-label">Data view</div>
          <div className="rds-ops-view-toggle">
            {[
              ['chart', 'Chart'],
              ['table', 'Table'],
              ['both', 'Both'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rds-ops-view-btn${view === key ? ' is-active' : ''}`}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rds-ops-controls-block">
          <div className="rds-ops-controls-label">Filter</div>
          <label className="rds-ops-field">
            <span>Pilot</span>
            <select value={pilotFilter} onChange={(e) => setPilotFilter(e.target.value)}>
              <option value="">All</option>
              {rows.map((r) => (
                <option key={r.pilotName} value={r.pilotName}>
                  {r.pilotName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          className="rds-export-btn rds-ops-export"
          onClick={handleExport}
          disabled={!sorted.length}
        >
          Download Excel
        </button>
      </div>
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.setSidebar, startDate, endDate, view, pilotFilter, rows, sorted.length, totals]);

  if (loading) {
    return (
      <div className="rds-loading">
        <Bars height={40} width={40} color="#0f6b4c" />
      </div>
    );
  }

  return (
    <div className="rds-ops-data">
      {!sorted.length ? (
        <div className="rds-empty">No pilot summary for this period.</div>
      ) : (
        <>
          {(view === 'chart' || view === 'both') && (
            <>
              <div className="rds-chart-bleed-title">Ranked by assigned Ha · % Pilot / % Ops</div>
              <div className="rds-leaderboard">
                {sorted.slice(0, 12).map((r, i) => (
                  <div key={r.pilotName} className="rds-leaderboard-row">
                    <span className="rds-leaderboard-rank">{String(i + 1).padStart(2, '0')}</span>
                    <span>{r.pilotName}</span>
                    <div className="rds-leaderboard-bar-track">
                      <div
                        className="rds-leaderboard-bar-fill"
                        style={{
                          width: `${Math.max(4, (Number(r.assignedTotal) / maxAssigned) * 100)}%`,
                        }}
                      />
                    </div>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatPct(r.pctPilot)}
                    </span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatPct(r.pctOps)}
                    </span>
                  </div>
                ))}
              </div>
              {chartData.length > 0 && (
                <div className="rds-chart-bleed">
                  <div className="rds-chart-bleed-title">Assigned vs completed</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="assigned" name="Assigned" fill="#94a3b8" />
                      <Bar dataKey="pilot" name="Pilot" fill="#0f6b4c" />
                      <Bar dataKey="ops" name="OpsRoom" fill="#34d399" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {(view === 'table' || view === 'both') && (
            <div className="rds-table-wrap">
              <table className="rds-table">
                <thead>
                  <tr>
                    <th>Pilot</th>
                    <th className="num">Assigned</th>
                    <th className="num">Pilot Ha</th>
                    <th className="num">OpsRoom Ha</th>
                    <th className="num">% Pilot</th>
                    <th className="num">% Ops</th>
                    <th className="num">Fly time</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.pilotName}>
                      <td>{r.pilotName}</td>
                      <td className="num">{formatHa(r.assignedTotal)}</td>
                      <td className="num">{formatHa(r.completedPilotTotal)}</td>
                      <td className="num">{formatHa(r.completedOpsTotal)}</td>
                      <td className="num">{formatPct(r.pctPilot)}</td>
                      <td className="num">{formatPct(r.pctOps)}</td>
                      <td className="num">{r.flyingTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PilotSummaryCombined;
