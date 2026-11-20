import React, { useEffect, useMemo, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { baseApi } from '../../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../../store/hooks';
import { useOpsReportWorkspace } from '../OpsReportWorkspaceContext';
import OpsReportViewToggle from '../OpsReportViewToggle';
import { OpsMonthControls } from '../OpsPeriodControls';
import {
  exportLegacyAoaExcel,
  formatHa,
  monthBounds,
  toYmd,
} from '../reportsExcelExport';
import '../reportsDecisionShell.css';

const currentYearMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const PilotPerformanceByDateCombined = ({ onExportReady }) => {
  const dispatch = useAppDispatch();
  const workspace = useOpsReportWorkspace();
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [view, setView] = useState('chart');
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);

  const { start, end } = useMemo(() => monthBounds(yearMonth), [yearMonth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await dispatch(
          baseApi.endpoints.getPilotTeamSprayArea.initiate({
            startDate: toYmd(start),
            endDate: toYmd(end),
          })
        );
        if (cancelled) return;
        if (result.error) setApiData(null);
        else setApiData(result.data);
      } catch (e) {
        if (!cancelled) setApiData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, start, end]);

  const { dateKeys, pilotRows, teamRows, trend, monthLabel } = useMemo(() => {
    const empty = { dateKeys: [], pilotRows: [], teamRows: [], trend: [], monthLabel: '' };
    if (!apiData || apiData.status !== 'true' || !Array.isArray(apiData.dates)) return empty;

    const dateKeys = apiData.dates.map((d) => d.date);
    let monthLabel = '';
    if (dateKeys.length > 0) {
      const d0 = new Date(dateKeys[0]);
      const mm = d0.toLocaleString('en-US', { month: 'short' });
      const yy = String(d0.getFullYear()).slice(-2);
      monthLabel = `${mm}-${yy}`;
    }

    const pilotMap = new Map();
    const trendMap = new Map();

    apiData.dates.forEach((day) => {
      const date = day.date;
      if (!trendMap.has(date)) trendMap.set(date, { date, pilot: 0, ops: 0 });
      const t = trendMap.get(date);
      (day.pilots || []).forEach((p) => {
        const id = p.pilot_id || p.pilot_name;
        const name = p.pilot_name || 'Unknown';
        const team = p.pilot_plantation_team || 'Unassigned';
        const pilotHa = Number(p.pilot_date_field_area) || 0;
        const opsHa = Number(p.ops_room_dji_field_area) || 0;
        t.pilot += pilotHa;
        t.ops += opsHa;
        if (!pilotMap.has(id)) {
          pilotMap.set(id, {
            id,
            name,
            team,
            perDatePilot: {},
            perDateOps: {},
            totalPilot: 0,
            totalOps: 0,
          });
        }
        const row = pilotMap.get(id);
        row.perDatePilot[date] = (row.perDatePilot[date] || 0) + pilotHa;
        row.perDateOps[date] = (row.perDateOps[date] || 0) + opsHa;
        row.totalPilot += pilotHa;
        row.totalOps += opsHa;
      });
    });

    const pilotRows = Array.from(pilotMap.values())
      .filter((r) => r.totalPilot !== 0 || r.totalOps !== 0)
      .sort((a, b) => b.totalOps + b.totalPilot - (a.totalOps + a.totalPilot));

    const teamMap = new Map();
    pilotRows.forEach((r) => {
      if (!teamMap.has(r.team)) teamMap.set(r.team, []);
      teamMap.get(r.team).push(r);
    });
    const teamRows = Array.from(teamMap.entries()).map(([teamName, pilots]) => ({
      teamName,
      pilots,
    }));

    const trend = Array.from(trendMap.values())
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((r) => ({
        date: String(r.date).slice(0, 10),
        pilot: Number(r.pilot.toFixed(2)),
        ops: Number(r.ops.toFixed(2)),
      }));

    return { dateKeys, pilotRows, teamRows, trend, monthLabel };
  }, [apiData]);

  const handleExport = () => {
    // Legacy pivoted layout, with Pilot + OpsRoom value pairs per day + totals
    const days = (dateKeys || []).map((dk) => new Date(dk).getDate());
    const title = 'Pilot Performance by Date (Pilot + OpsRoom)';
    const sheetHeaders = [
      [title],
      ['Team', 'Pilot', 'Metric', monthLabel, ...new Array(Math.max(days.length - 1, 0)).fill(''), 'Total'],
      ['', '', '', ...days, ''],
    ];

    const body = [];
    teamRows.forEach((team) => {
      team.pilots.forEach((pilot) => {
        body.push([
          team.teamName,
          pilot.name,
          'Pilot',
          ...dateKeys.map((dk) => Number(pilot.perDatePilot[dk] || 0)),
          Number(pilot.totalPilot || 0),
        ]);
        body.push([
          team.teamName,
          pilot.name,
          'OpsRoom',
          ...dateKeys.map((dk) => Number(pilot.perDateOps[dk] || 0)),
          Number(pilot.totalOps || 0),
        ]);
      });
    });

    const aoa = [...sheetHeaders, ...body];
    const lastCol = (dateKeys?.length || 0) + 3;
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
      { s: { r: 1, c: 3 }, e: { r: 1, c: lastCol - 1 } },
      { s: { r: 1, c: lastCol }, e: { r: 2, c: lastCol } },
    ];

    exportLegacyAoaExcel({
      sheetName: 'Pilot Performance',
      fileName: `Pilot_Performance_ByDate_${toYmd(start)}_to_${toYmd(end)}.xlsx`,
      aoa,
      merges,
      cols: [
        { wch: 15 },
        { wch: 22 },
        { wch: 10 },
        ...new Array(days.length).fill({ wch: 6 }),
        { wch: 10 },
      ],
    });
  };

  useEffect(() => {
    onExportReady?.(handleExport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilotRows, dateKeys, start, end, teamRows]);

  useEffect(() => {
    if (!workspace?.setSidebar) return undefined;
    workspace.setSidebar(
      <div className="rds-ops-controls">
        <OpsMonthControls yearMonth={yearMonth} onChange={setYearMonth} />
        <p className="rds-ops-hint">
          {toYmd(start)} → {toYmd(end)}
        </p>
        <OpsReportViewToggle view={view} onChange={setView} />
      </div>
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.setSidebar, yearMonth, view, pilotRows.length, start, end, dateKeys, teamRows]);

  if (loading) {
    return (
      <div className="rds-loading">
        <Bars height={40} width={40} color="#0f6b4c" />
      </div>
    );
  }

  return (
    <div className="rds-ops-data">
      {view === 'chart' &&
        (trend.length > 0 ? (
          <div className="rds-chart-bleed">
            <div className="rds-chart-bleed-title">Daily series · Pilot vs OpsRoom</div>
            <div className="rds-bydate-legend">
              <span className="leg-p">Pilot Ha</span>
              <span className="leg-o">OpsRoom Ha</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="#c9d9d2" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="pilot" name="Pilot Ha" stroke="#0f6b4c" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="ops" name="OpsRoom Ha" stroke="#34d399" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rds-empty">No daily spray data for this month.</div>
        ))}

      {view === 'table' &&
        (!pilotRows.length ? (
          <div className="rds-empty">No daily spray data for this month.</div>
        ) : (
          <div className="rds-table-wrap">
            <table className="rds-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Pilot</th>
                  {dateKeys.map((d) => (
                    <th key={d} colSpan={2} style={{ textAlign: 'center' }}>
                      {String(d).slice(5)}
                    </th>
                  ))}
                  <th className="num">Σ Pilot</th>
                  <th className="num">Σ Ops</th>
                </tr>
                <tr>
                  <th />
                  <th />
                  {dateKeys.map((d) => (
                    <React.Fragment key={`${d}-sub`}>
                      <th className="num">P</th>
                      <th className="num">O</th>
                    </React.Fragment>
                  ))}
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                {pilotRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.team}</td>
                    <td>{r.name}</td>
                    {dateKeys.map((d) => (
                      <React.Fragment key={`${r.id}-${d}`}>
                        <td className="num">{formatHa(r.perDatePilot[d] || 0)}</td>
                        <td className="num">{formatHa(r.perDateOps[d] || 0)}</td>
                      </React.Fragment>
                    ))}
                    <td className="num">{formatHa(r.totalPilot)}</td>
                    <td className="num">{formatHa(r.totalOps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
};

export default PilotPerformanceByDateCombined;
