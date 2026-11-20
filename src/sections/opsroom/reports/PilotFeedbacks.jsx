import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Bars } from 'react-loader-spinner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../store/hooks';
import '../../../styles/opsreport9.css';
import { useSyncShellPeriod } from '../../management/reports/ReportsPeriodContext';
import { useOpsReportWorkspace } from '../../management/reports/OpsReportWorkspaceContext';
import OpsReportViewToggle from '../../management/reports/OpsReportViewToggle';
import { OpsDateRangeControls, startOfMonthDate } from '../../management/reports/OpsPeriodControls';
import '../../management/reports/reportsDecisionShell.css';

const formatDate = (date) => date.toLocaleDateString('en-CA');

const PilotFeedbacks = ({ onExportReady }) => {
  const dispatch = useAppDispatch();
  const workspace = useOpsReportWorkspace();
  const [startDate, setStartDate] = useState(() => startOfMonthDate());
  const [endDate, setEndDate] = useState(() => new Date());
  useSyncShellPeriod(setStartDate, setEndDate);
  const [view, setView] = useState('chart');
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState(null);
  const [selectedEstate, setSelectedEstate] = useState('all');
  const [selectedPilot, setSelectedPilot] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await dispatch(baseApi.endpoints.getPilotFeedbacks.initiate({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      }));
      const res = result.data;
      setApiData(res);
    } catch (e) {
      console.error('Error fetching pilot feedbacks:', e);
      setApiData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const { estates, pilots } = useMemo(() => {
    if (!apiData || apiData.status !== 'true' || !Array.isArray(apiData.feedbacks)) {
      return { estates: [], pilots: [] };
    }

    const uniqueEstates = [...new Set(apiData.feedbacks.map(f => f.estate_name))].sort();
    const uniquePilots = [...new Set(apiData.feedbacks.map(f => f.user_name))].sort();

    return { estates: uniqueEstates, pilots: uniquePilots };
  }, [apiData]);

  const filteredData = useMemo(() => {
    if (!apiData || apiData.status !== 'true' || !Array.isArray(apiData.feedbacks)) {
      return [];
    }

    return apiData.feedbacks.filter(feedback => {
      const estateMatch = selectedEstate === 'all' || feedback.estate_name === selectedEstate;
      const pilotMatch = selectedPilot === 'all' || feedback.user_name === selectedPilot;
      return estateMatch && pilotMatch;
    });
  }, [apiData, selectedEstate, selectedPilot]);

  const dailyChartData = useMemo(() => {
    const byDay = new Map();
    filteredData.forEach((f) => {
      const day = String(f.date || '').slice(0, 10) || 'Unknown';
      byDay.set(day, (byDay.get(day) || 0) + 1);
    });
    return Array.from(byDay.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData]);

  const pilotChartData = useMemo(() => {
    const byPilot = new Map();
    filteredData.forEach((f) => {
      const name = f.user_name || 'Unknown';
      byPilot.set(name, (byPilot.get(name) || 0) + 1);
    });
    return Array.from(byPilot.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [filteredData]);

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      if (!onExportReady) alert('No data available to export');
      return;
    }

    const exportData = filteredData.map(item => ({
      'User ID': item.user_id,
      'Pilot Name': item.user_name,
      'Estate ID': item.estate_id,
      'Estate Name': item.estate_name,
      'Date': item.date,
      'Water Time': item.water_time,
      'Chemical Time': item.chemicle_time,
      'Latitude': item.latitude,
      'Longitude': item.longitude
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pilot Feedbacks');

    const filename = `Pilot_Feedbacks_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  useEffect(() => {
    onExportReady?.(exportToExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, startDate, endDate, selectedEstate, selectedPilot]);

  useEffect(() => {
    if (!workspace?.setSidebar) return undefined;
    workspace.setSidebar(
      <div className="rds-ops-controls">
        <OpsDateRangeControls
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
        <OpsReportViewToggle view={view} onChange={setView} />
        <div className="rds-ops-controls-block rds-ops-controls-inline">
          <span className="rds-ops-controls-label">Filters</span>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Estate</span>
            <select
              value={selectedEstate}
              onChange={(e) => setSelectedEstate(e.target.value)}
            >
              <option value="all">All</option>
              {estates.map((estate) => (
                <option key={estate} value={estate}>{estate}</option>
              ))}
            </select>
          </label>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Pilot</span>
            <select
              value={selectedPilot}
              onChange={(e) => setSelectedPilot(e.target.value)}
            >
              <option value="all">All</option>
              {pilots.map((pilot) => (
                <option key={pilot} value={pilot}>{pilot}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspace?.setSidebar,
    startDate,
    endDate,
    view,
    selectedEstate,
    selectedPilot,
    estates,
    pilots,
  ]);

  if (loading) {
    return (
      <div className={workspace ? 'rds-loading' : 'ops9-table-wrapper'}>
        <div className={workspace ? undefined : 'loading-container-reports'}>
          <Bars height={workspace ? 40 : 60} width={workspace ? 40 : 60} color="#004B71" ariaLabel="bars-loading" visible />
          {!workspace && <p>Loading...</p>}
        </div>
      </div>
    );
  }

  const tableBlock = (
    <div className={workspace ? 'rds-table-wrap' : 'ops9-table-wrapper'}>
      <table className={workspace ? 'rds-table' : 'ops9-table'}>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Pilot Name</th>
            <th>Estate ID</th>
            <th>Estate Name</th>
            <th>Date</th>
            <th>Water Time</th>
            <th>Chemical Time</th>
            <th>Latitude</th>
            <th>Longitude</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.length === 0 ? (
            <tr>
              <td colSpan="9" className={workspace ? undefined : 'no-data'}>
                No feedback data available for the selected criteria
              </td>
            </tr>
          ) : (
            filteredData.map((feedback, index) => (
              <tr key={`${feedback.user_id}-${feedback.date}-${index}`} className={workspace ? undefined : (index % 2 === 0 ? 'even' : 'odd')}>
                <td>{feedback.user_id}</td>
                <td>{feedback.user_name}</td>
                <td>{feedback.estate_id}</td>
                <td>{feedback.estate_name}</td>
                <td>{feedback.date}</td>
                <td>{feedback.water_time}</td>
                <td>{feedback.chemicle_time}</td>
                <td>{feedback.latitude}</td>
                <td>{feedback.longitude}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const chartBlock =
    dailyChartData.length > 0 || pilotChartData.length > 0 ? (
      <div className="rds-ops-data">
        <div className="rds-metric-strip">
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Feedbacks</div>
            <div className="rds-metric-strip-val">{filteredData.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Pilots</div>
            <div className="rds-metric-strip-val">{pilotChartData.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Days</div>
            <div className="rds-metric-strip-val">{dailyChartData.length}</div>
          </div>
        </div>
        {dailyChartData.length > 0 && (
          <div className="rds-chart-bleed">
            <div className="rds-chart-bleed-title">Daily feedback volume</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Feedbacks" stroke="#0f6b4c" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {pilotChartData.length > 0 && (
          <div className="rds-chart-bleed">
            <div className="rds-chart-bleed-title">Top pilots by feedback count</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pilotChartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Feedbacks" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    ) : (
      <div className="rds-empty">No chart data for this period.</div>
    );

  if (workspace) {
    return (
      <div className="rds-ops-data">
        {view === 'chart' ? chartBlock : tableBlock}
      </div>
    );
  }

  return (
    <div className="ops9-container">
      <div className="ops9-controls">
        <div className="date-group">
          <label>Start Date:</label>
          <DatePicker
            selected={startDate}
            onChange={setStartDate}
            dateFormat="yyyy/MM/dd"
            className="date-picker"
            disabled={loading}
          />
        </div>
        <div className="date-group">
          <label>End Date:</label>
          <DatePicker
            selected={endDate}
            onChange={setEndDate}
            dateFormat="yyyy/MM/dd"
            className="date-picker"
            disabled={loading}
          />
        </div>

        <div className="date-group">
          <label>Estate:</label>
          <select
            value={selectedEstate}
            onChange={(e) => setSelectedEstate(e.target.value)}
            className="date-picker"
            disabled={loading}
          >
            <option value="all">All Estates</option>
            {estates.map(estate => (
              <option key={estate} value={estate}>{estate}</option>
            ))}
          </select>
        </div>

        <div className="date-group">
          <label>Pilot:</label>
          <select
            value={selectedPilot}
            onChange={(e) => setSelectedPilot(e.target.value)}
            className="date-picker"
            disabled={loading}
          >
            <option value="all">All Pilots</option>
            {pilots.map(pilot => (
              <option key={pilot} value={pilot}>{pilot}</option>
            ))}
          </select>
        </div>

        <div className="controls-spacer" />
        <button className="export-btn" onClick={exportToExcel} disabled={loading || filteredData.length === 0}>
          Excel
        </button>
      </div>

      {tableBlock}
    </div>
  );
};

export default PilotFeedbacks;
