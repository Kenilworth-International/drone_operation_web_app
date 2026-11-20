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
import {
  flattenPilotPerformance,
  summarizeFieldRows,
} from '../reportsOverviewMetrics';
import '../reportsDecisionShell.css';

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const statusText = (s) => {
  if (s === 'c') return 'Completed';
  if (s === 'p') return 'Partial';
  if (s === 'n') return 'Not started';
  return s || '';
};

const PilotPerformanceCombined = () => {
  const dispatch = useAppDispatch();
  const workspace = useOpsReportWorkspace();
  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(() => new Date());
  const [view, setView] = useState('both'); // chart | table | both
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    pilotName: '',
    plantation: '',
    region: '',
    estate: '',
  });

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
        if (!cancelled) setRows(flattenPilotPerformance(result.data || {}));
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
    // Legacy columns + OpsRoom / % extras
    const headers = [
      'Date',
      'Pilot',
      'Group',
      'Plantation',
      'Region',
      'Estate',
      'Field Name',
      'Assigned (ha)',
      'Completed Pilot (ha)',
      'Completed OpsRoom (ha)',
      '% Pilot',
      '% OpsRoom',
      'Status',
    ];
    const dataRows = filtered.map((r) => [
      r.date,
      r.pilotName,
      r.group,
      r.plantation,
      r.region,
      r.estate,
      r.fieldName,
      formatHa(r.assigned),
      formatHa(r.completedPilot),
      formatHa(r.completedOps),
      formatPct(r.pctPilot),
      formatPct(r.pctOps),
      statusText(r.taskStatus),
    ]);
    dataRows.push([
      'Total',
      '',
      '',
      '',
      '',
      '',
      '',
      formatHa(totals.assigned),
      formatHa(totals.completedPilot),
      formatHa(totals.completedOps),
      formatPct(totals.pctPilot),
      formatPct(totals.pctOps),
      '',
    ]);
    const filterLabel =
      filters.pilotName ||
      filters.estate ||
      filters.region ||
      filters.plantation ||
      'All_Pilots';
    exportLegacyExcel({
      sheetName: 'Pilot Performance',
      fileName: `Pilot_Performance_${String(filterLabel).replace(/\s+/g, '_')}_${toYmd(startDate)}_to_${toYmd(endDate)}.xlsx`,
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
          <div className="rds-ops-controls-label">Filters</div>
          {[
            ['pilotName', 'Pilot', filterOptions.pilots],
            ['plantation', 'Plantation', filterOptions.plantations],
            ['region', 'Region', filterOptions.regions],
            ['estate', 'Estate', filterOptions.estates],
          ].map(([key, label, opts]) => (
            <label key={key} className="rds-ops-field">
              <span>{label}</span>
              <select
                value={filters[key]}
                onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
              >
                <option value="">All</option>
                {opts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <button
          type="button"
          className="rds-export-btn rds-ops-export"
          onClick={handleExport}
          disabled={!filtered.length}
        >
          Download Excel
        </button>
      </div>
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspace?.setSidebar,
    startDate,
    endDate,
    view,
    filters,
    filterOptions,
    filtered.length,
    totals,
  ]);

  if (loading) {
    return (
      <div className="rds-loading">
        <Bars height={40} width={40} color="#0f6b4c" />
      </div>
    );
  }

  return (
    <div className="rds-ops-data">
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

      {(view === 'chart' || view === 'both') && chartData.length > 0 && (
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">Top pilots · assigned vs completed</div>
          <ResponsiveContainer width="100%" height={240}>
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

      {(view === 'table' || view === 'both') &&
        (!filtered.length ? (
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
                    <td>{statusText(r.taskStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
};

export default PilotPerformanceCombined;
