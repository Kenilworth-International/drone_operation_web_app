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
import { useReportsPeriod } from '../ReportsPeriodContext';
import {
  exportReportExcel,
  formatHa,
  formatPct,
  toYmd,
} from '../reportsExcelExport';
import { rollupPilotSummary } from '../reportsOverviewMetrics';
import '../reportsDecisionShell.css';

const PilotSummaryCombined = ({ startDate: propStart, endDate: propEnd, onExportReady }) => {
  const dispatch = useAppDispatch();
  const period = useReportsPeriod();
  const startDate = propStart || period?.startDate;
  const endDate = propEnd || period?.endDate;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) return;
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
        if (cancelled) return;
        setRows(rollupPilotSummary(result.data || {}));
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

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b.assignedTotal || 0) - (a.assignedTotal || 0)),
    [rows]
  );

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

  const handleExport = () => {
    exportReportExcel({
      title: 'Pilot Summary — Pilot + OpsRoom',
      filePrefix: 'pilot_summary_combined',
      sheetName: 'Pilot Summary',
      startDate,
      endDate,
      headers: [
        'Pilot',
        'Assigned Spray',
        'Assigned Spread',
        'Assigned Total',
        'Completed Pilot Spray',
        'Completed Pilot Spread',
        'Completed Pilot Total',
        'Completed OpsRoom Spray',
        'Completed OpsRoom Spread',
        'Completed OpsRoom Total',
        '% Pilot',
        '% OpsRoom',
        'Flying Time',
      ],
      rows: sorted.map((r) => [
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
        r.flyingTime,
      ]),
    });
  };

  useEffect(() => {
    onExportReady?.(handleExport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, startDate, endDate]);

  if (loading) {
    return (
      <div className="rds-loading">
        <Bars height={40} width={40} color="#2d6a4f" />
      </div>
    );
  }

  const maxAssigned = sorted[0]?.assignedTotal || 1;

  return (
    <div>
      <div className="rds-filters-inline" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="rds-export-btn" onClick={handleExport} disabled={!sorted.length}>
          Download Excel
        </button>
      </div>

      {!sorted.length ? (
        <div className="rds-empty">No pilot summary for this period.</div>
      ) : (
        <>
          <div className="rds-chart-bleed-title">Ranked by assigned Ha</div>
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
                      animationDelay: `${i * 0.03}s`,
                    }}
                  />
                </div>
                <span className="num" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPct(r.pctPilot)}
                </span>
                <span className="num" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatPct(r.pctOps)}
                </span>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <div className="rds-chart-bleed">
              <div className="rds-chart-bleed-title">Assigned vs completed · top pilots</div>
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
                  <th className="num">Spray Pilot</th>
                  <th className="num">Spray Ops</th>
                  <th className="num">Spread Pilot</th>
                  <th className="num">Spread Ops</th>
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
                    <td className="num">{formatHa(r.completedPilotSpray)}</td>
                    <td className="num">{formatHa(r.completedOpsSpray)}</td>
                    <td className="num">{formatHa(r.completedPilotSpread)}</td>
                    <td className="num">{formatHa(r.completedOpsSpread)}</td>
                    <td className="num">{r.flyingTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default PilotSummaryCombined;
