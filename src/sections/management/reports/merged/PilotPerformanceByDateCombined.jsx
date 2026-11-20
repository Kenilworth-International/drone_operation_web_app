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
  Legend,
} from 'recharts';
import { baseApi } from '../../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../../store/hooks';
import { useReportsPeriod } from '../ReportsPeriodContext';
import {
  exportReportExcel,
  formatHa,
  toYmd,
} from '../reportsExcelExport';
import '../reportsDecisionShell.css';

const PilotPerformanceByDateCombined = ({
  startDate: propStart,
  endDate: propEnd,
  onExportReady,
}) => {
  const dispatch = useAppDispatch();
  const period = useReportsPeriod();
  const startDate = propStart || period?.startDate;
  const endDate = propEnd || period?.endDate;

  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await dispatch(
          baseApi.endpoints.getPilotTeamSprayArea.initiate({
            startDate: toYmd(startDate),
            endDate: toYmd(endDate),
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
  }, [dispatch, startDate, endDate]);

  const { dateKeys, pilotRows, trend } = useMemo(() => {
    const empty = { dateKeys: [], pilotRows: [], trend: [] };
    if (!apiData || apiData.status !== 'true' || !Array.isArray(apiData.dates)) return empty;

    const dateKeys = apiData.dates.map((d) => d.date);
    const pilotMap = new Map();
    const trendMap = new Map();

    apiData.dates.forEach((day) => {
      const date = day.date;
      if (!trendMap.has(date)) {
        trendMap.set(date, { date, pilot: 0, ops: 0 });
      }
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

    const trend = Array.from(trendMap.values())
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((r) => ({
        date: String(r.date).slice(0, 10),
        pilot: Number(r.pilot.toFixed(2)),
        ops: Number(r.ops.toFixed(2)),
      }));

    return { dateKeys, pilotRows, trend };
  }, [apiData]);

  const handleExport = () => {
    const headers = [
      'Team',
      'Pilot',
      ...dateKeys.flatMap((d) => [`${d} Pilot`, `${d} OpsRoom`]),
      'Total Pilot',
      'Total OpsRoom',
    ];
    const rows = pilotRows.map((r) => [
      r.team,
      r.name,
      ...dateKeys.flatMap((d) => [
        formatHa(r.perDatePilot[d] || 0),
        formatHa(r.perDateOps[d] || 0),
      ]),
      formatHa(r.totalPilot),
      formatHa(r.totalOps),
    ]);
    exportReportExcel({
      title: 'Pilot Performance by Date — Pilot + OpsRoom',
      filePrefix: 'pilot_performance_by_date_combined',
      sheetName: 'By Date',
      startDate,
      endDate,
      headers,
      rows,
    });
  };

  useEffect(() => {
    onExportReady?.(handleExport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilotRows, dateKeys, startDate, endDate]);

  if (loading) {
    return (
      <div className="rds-loading">
        <Bars height={40} width={40} color="#2d6a4f" />
      </div>
    );
  }

  return (
    <div>
      {trend.length > 0 && (
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">Daily series · Pilot vs OpsRoom</div>
          <div className="rds-bydate-legend">
            <span className="leg-p">Pilot Ha</span>
            <span className="leg-o">OpsRoom Ha</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
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
      )}

      <div className="rds-filters-inline" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="rds-export-btn" onClick={handleExport} disabled={!pilotRows.length}>
          Download Excel
        </button>
      </div>

      {!pilotRows.length ? (
        <div className="rds-empty">No daily spray data for this period.</div>
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
      )}
    </div>
  );
};

export default PilotPerformanceByDateCombined;
