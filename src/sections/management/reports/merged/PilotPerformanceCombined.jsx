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
import {
  flattenPilotPerformance,
  summarizeFieldRows,
} from '../reportsOverviewMetrics';
import '../reportsDecisionShell.css';

const PilotPerformanceCombined = ({ startDate: propStart, endDate: propEnd, onExportReady }) => {
  const dispatch = useAppDispatch();
  const period = useReportsPeriod();
  const startDate = propStart || period?.startDate;
  const endDate = propEnd || period?.endDate;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    pilotName: '',
    plantation: '',
    region: '',
    estate: '',
  });

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
        setRows(flattenPilotPerformance(result.data || {}));
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

  const filterOptions = useMemo(() => {
    const pilots = new Set();
    const plantations = new Set();
    const regions = new Set();
    const estates = new Set();
    rows.forEach((r) => {
      if (r.pilotName) pilots.add(r.pilotName);
      if (r.plantation) plantations.add(r.plantation);
      if (r.region) regions.add(r.region);
      if (r.estate) estates.add(r.estate);
    });
    return {
      pilots: [...pilots].sort(),
      plantations: [...plantations].sort(),
      regions: [...regions].sort(),
      estates: [...estates].sort(),
    };
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!filters.pilotName || r.pilotName === filters.pilotName) &&
          (!filters.plantation || r.plantation === filters.plantation) &&
          (!filters.region || r.region === filters.region) &&
          (!filters.estate || r.estate === filters.estate) &&
          Number(r.assigned) > 0
      ),
    [rows, filters]
  );

  const totals = useMemo(() => summarizeFieldRows(filtered), [filtered]);

  const chartData = useMemo(() => {
    const byPilot = new Map();
    filtered.forEach((r) => {
      const key = r.pilotName || 'Unknown';
      if (!byPilot.has(key)) {
        byPilot.set(key, { name: key, assigned: 0, pilot: 0, ops: 0 });
      }
      const b = byPilot.get(key);
      b.assigned += Number(r.assigned) || 0;
      b.pilot += Number(r.completedPilot) || 0;
      b.ops += Number(r.completedOps) || 0;
    });
    return Array.from(byPilot.values())
      .sort((a, b) => b.assigned - a.assigned)
      .slice(0, 12)
      .map((r) => ({
        ...r,
        assigned: Number(r.assigned.toFixed(2)),
        pilot: Number(r.pilot.toFixed(2)),
        ops: Number(r.ops.toFixed(2)),
      }));
  }, [filtered]);

  const handleExport = () => {
    exportReportExcel({
      title: 'Pilot Performance — Pilot + OpsRoom',
      filePrefix: 'pilot_performance_combined',
      sheetName: 'Pilot Performance',
      startDate,
      endDate,
      headers: [
        'Date',
        'Pilot',
        'Group',
        'Plantation',
        'Region',
        'Estate',
        'Field',
        'Type',
        'Assigned Ha',
        'Completed Pilot Ha',
        'Completed OpsRoom Ha',
        '% Pilot',
        '% OpsRoom',
        'Status',
      ],
      rows: filtered.map((r) => [
        r.date,
        r.pilotName,
        r.group,
        r.plantation,
        r.region,
        r.estate,
        r.fieldName,
        r.planType,
        formatHa(r.assigned),
        formatHa(r.completedPilot),
        formatHa(r.completedOps),
        formatPct(r.pctPilot),
        formatPct(r.pctOps),
        r.taskStatus,
      ]),
    });
  };

  useEffect(() => {
    onExportReady?.(handleExport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, startDate, endDate]);

  if (loading) {
    return (
      <div className="rds-loading">
        <Bars height={40} width={40} color="#2d6a4f" />
      </div>
    );
  }

  return (
    <div>
      <div className="rds-metric-strip">
        <div className="rds-metric-strip-item">
          <div className="rds-metric-strip-lbl">Assigned</div>
          <div className="rds-metric-strip-val">{formatHa(totals.assigned)}</div>
        </div>
        <div className="rds-metric-strip-item">
          <div className="rds-metric-strip-lbl">Pilot Ha</div>
          <div className="rds-metric-strip-val">{formatHa(totals.completedPilot)}</div>
          <div className="rds-metric-strip-sub">{formatPct(totals.pctPilot)}</div>
        </div>
        <div className="rds-metric-strip-item">
          <div className="rds-metric-strip-lbl">OpsRoom Ha</div>
          <div className="rds-metric-strip-val">{formatHa(totals.completedOps)}</div>
          <div className="rds-metric-strip-sub">{formatPct(totals.pctOps)}</div>
        </div>
        <div className="rds-metric-strip-item">
          <div className="rds-metric-strip-lbl">Fields</div>
          <div className="rds-metric-strip-val">{totals.rowCount}</div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">Top pilots · assigned vs completed</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} axisLine={false} tickLine={false} />
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

      <div className="rds-filters-inline">
        {[
          ['pilotName', 'Pilot', filterOptions.pilots],
          ['plantation', 'Plantation', filterOptions.plantations],
          ['region', 'Region', filterOptions.regions],
          ['estate', 'Estate', filterOptions.estates],
        ].map(([key, label, opts]) => (
          <select
            key={key}
            value={filters[key]}
            onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
            aria-label={label}
          >
            <option value="">All {label}s</option>
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ))}
        <button type="button" className="rds-export-btn" onClick={handleExport} disabled={!filtered.length}>
          Download Excel
        </button>
      </div>

      {!filtered.length ? (
        <div className="rds-empty">No field data for this period.</div>
      ) : (
        <div className="rds-table-wrap">
          <table className="rds-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Pilot</th>
                <th>Plantation</th>
                <th>Estate</th>
                <th>Field</th>
                <th className="num">Assigned</th>
                <th className="num">Pilot Ha</th>
                <th className="num">OpsRoom Ha</th>
                <th className="num">% Pilot</th>
                <th className="num">% Ops</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.date}-${r.pilotName}-${r.fieldName}-${i}`}>
                  <td>{String(r.date || '').slice(0, 10)}</td>
                  <td>{r.pilotName}</td>
                  <td>{r.plantation}</td>
                  <td>{r.estate}</td>
                  <td>{r.fieldName}</td>
                  <td className="num">{formatHa(r.assigned)}</td>
                  <td className="num">{formatHa(r.completedPilot)}</td>
                  <td className="num">{formatHa(r.completedOps)}</td>
                  <td className="num">{formatPct(r.pctPilot)}</td>
                  <td className="num">{formatPct(r.pctOps)}</td>
                  <td>{r.taskStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PilotPerformanceCombined;
