import React, { useState, useEffect, useMemo } from "react";
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
import '../../../styles/ops6.css';
import ReportDateRangePicker from '../../../components/ReportDateRangePicker';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../store/hooks';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { FiRefreshCw, FiDownload, FiPrinter } from "react-icons/fi";
import { useSyncShellPeriod } from '../../management/reports/ReportsPeriodContext';
import { useOpsReportWorkspace } from '../../management/reports/OpsReportWorkspaceContext';
import OpsReportViewToggle from '../../management/reports/OpsReportViewToggle';
import { OpsDateRangeControls } from '../../management/reports/OpsPeriodControls';
import '../../management/reports/reportsDecisionShell.css';

const CanceledByPilots = ({ onExportReady }) => {
  const dispatch = useAppDispatch();
  const workspace = useOpsReportWorkspace();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [endDate, setEndDate] = useState(new Date());
  useSyncShellPeriod(setStartDate, setEndDate);
  const [view, setView] = useState('chart');
  const [pilotFilter, setPilotFilter] = useState('');
  const [estateFilter, setEstateFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pilotOptions, setPilotOptions] = useState([]);
  const [estateOptions, setEstateOptions] = useState([]);
  const [reasonOptions, setReasonOptions] = useState([]);

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA');
  };

  const formatDisplayDate = (dateStr) => {
    if (dateStr == null || dateStr === '') return '—';
    const s = String(dateStr).trim();
    if (!s) return '—';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [year, month, day] = s.slice(0, 10).split('-');
      return `${day}-${month}-${year}`;
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB');
  };

  const formatNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  };

  const fetchData = async () => {
    if (!startDate || !endDate) return;
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    if (!start || !end) return;

    setLoading(true);
    try {
      const result = await dispatch(baseApi.endpoints.getCanceledFieldsByDateRange.initiate({
        startDate: start,
        endDate: end,
      }));
      const plans = result.data || [];

      const flattenedData = plans.flatMap((plan) =>
        (plan.tasks || []).map((task) => {
          const fieldArea = Number(task.area) || 0;
          const pilotFieldArea = Number(task.pilot_field_area) || 0;
          const djiFieldArea = Number(task.dji_field_area) || 0;
          const coveredArea = pilotFieldArea > 0 ? pilotFieldArea : djiFieldArea;
          const completionRate =
            fieldArea > 0 ? ((coveredArea / fieldArea) * 100).toFixed(2) : '0.00';
          const type = task.type === 'p' ? 'p' : 'x';

          return {
            plan_id: plan.plan_id,
            date: plan.date,
            estate: plan.estate,
            estate_area: formatNum(plan.area),
            task_id: task.task_id,
            pilot: task.pilot,
            field: task.field,
            type,
            reason: task.reason || '',
            cancel_reason: task.cancel_reason || '',
            partial_reason: task.partial_reason || '',
            ops_reason: task.ops_reason || '',
            area: formatNum(fieldArea),
            pilot_field_area: formatNum(pilotFieldArea),
            dji_field_area: formatNum(djiFieldArea),
            completion_rate: completionRate,
          };
        })
      );

      setData(flattenedData);
      setPilotOptions([...new Set(flattenedData.map((task) => task.pilot).filter(Boolean))]);
      setEstateOptions([...new Set(flattenedData.map((task) => task.estate).filter(Boolean))]);
      setReasonOptions([
        ...new Set(
          flattenedData
            .flatMap((task) => [task.reason, task.cancel_reason, task.partial_reason, task.ops_reason])
            .filter(Boolean)
        ),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
      setData([]);
      setPilotOptions([]);
      setEstateOptions([]);
      setReasonOptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!startDate || !endDate) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const filteredData = useMemo(
    () =>
      data.filter((task) =>
        (!pilotFilter || task.pilot === pilotFilter) &&
        (!estateFilter || task.estate === estateFilter) &&
        (!reasonFilter ||
          task.reason === reasonFilter ||
          task.cancel_reason === reasonFilter ||
          task.partial_reason === reasonFilter ||
          task.ops_reason === reasonFilter)
      ),
    [data, pilotFilter, estateFilter, reasonFilter]
  );

  const reasonChartData = useMemo(() => {
    const counts = new Map();
    filteredData.forEach((task) => {
      const label =
        task.cancel_reason ||
        task.partial_reason ||
        task.reason ||
        task.ops_reason ||
        (task.type === 'x' ? 'Canceled (no reason)' : 'Partial (no reason)');
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name: name.length > 28 ? `${name.slice(0, 26)}…` : name, count, fullName: name }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [filteredData]);

  const dailyChartData = useMemo(() => {
    const byDay = new Map();
    filteredData.forEach((task) => {
      const day = String(task.date || '').slice(0, 10) || 'Unknown';
      if (!byDay.has(day)) byDay.set(day, { name: day, canceled: 0, partial: 0 });
      const row = byDay.get(day);
      if (task.type === 'x') row.canceled += 1;
      else row.partial += 1;
    });
    return Array.from(byDay.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData]);

  const downloadExcel = () => {
    const worksheetData = filteredData.map((task) => ({
      "Plan ID": task.plan_id,
      Date: formatDisplayDate(task.date),
      "Estate (Area)": `${task.estate} (${task.estate_area})`,
      "Task ID": task.task_id,
      Pilot: task.pilot,
      Field: task.field,
      Area: task.area,
      "Pilot Field Area": task.pilot_field_area,
      "DJI Field Area": task.dji_field_area,
      "Completion Rate (%)": task.completion_rate,
      "Pilot Status": task.type === 'x' ? 'Canceled' : 'Partially Completed',
      "Cancel Reason": task.cancel_reason,
      "Partial Reason": task.partial_reason,
      "Ops Room Reason": task.ops_reason,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Canceled_Fields");
    const formatDateForFilename = (date) => {
      const formatted = formatDate(date);
      return formatted || 'na';
    };
    const pilotPart = pilotFilter ? pilotFilter.replace(/\s+/g, '_') : 'All_Pilots';
    const estatePart = estateFilter ? estateFilter.replace(/\s+/g, '_') : 'All_Estates';
    const reasonPart = reasonFilter ? reasonFilter.replace(/\s+/g, '_') : 'All_Reasons';
    XLSX.writeFile(workbook, `Canceled_Fields_Report_${estatePart}_${reasonPart}_${pilotPart}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const title = "Canceled / Partial by Pilots Report";
    const formatDateForFilename = (date) => {
      const formatted = formatDate(date);
      return formatted || 'na';
    };
    const startLabel = formatDate(startDate);
    const endLabel = formatDate(endDate);
    const dateRange = `${formatDisplayDate(startLabel)} to ${formatDisplayDate(endLabel)}`;

    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(dateRange, 14, 22);

    const tableData = filteredData.map((task) => [
      task.plan_id,
      formatDisplayDate(task.date),
      `${task.estate} (${task.estate_area})`,
      task.task_id,
      task.pilot,
      task.field,
      task.area,
      task.pilot_field_area,
      task.completion_rate,
      task.type === 'x' ? 'Canceled' : 'Partially Completed',
      task.cancel_reason || '-',
      task.partial_reason || '-',
      task.ops_reason || '-',
    ]);

    autoTable(doc, {
      head: [[
        'Plan ID', 'Date', 'Estate (Area)', 'Task ID', 'Pilot', 'Field',
        'Area', 'Pilot Area', 'Completion %', 'Status',
        'Cancel Reason', 'Partial Reason', 'Ops Room',
      ]],
      body: tableData,
      startY: 30,
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [209, 213, 219],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [22, 160, 133],
        textColor: 255,
        fontStyle: 'bold',
        lineWidth: 0.2,
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    const pilotPart = pilotFilter ? pilotFilter.replace(/\s+/g, '_') : 'All_Pilots';
    const estatePart = estateFilter ? estateFilter.replace(/\s+/g, '_') : 'All_Estates';
    const reasonPart = reasonFilter ? reasonFilter.replace(/\s+/g, '_') : 'All_Reasons';
    doc.save(`Canceled_Fields_Report_${estatePart}_${reasonPart}_${pilotPart}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(downloadExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, startDate, endDate, pilotFilter, estateFilter, reasonFilter]);

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
            <span>Pilot</span>
            <select value={pilotFilter} onChange={(e) => setPilotFilter(e.target.value)}>
              <option value="">All</option>
              {pilotOptions.map((pilot) => (
                <option key={pilot} value={pilot}>{pilot}</option>
              ))}
            </select>
          </label>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Estate</span>
            <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}>
              <option value="">All</option>
              {estateOptions.map((estate) => (
                <option key={estate} value={estate}>{estate}</option>
              ))}
            </select>
          </label>
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Reason</span>
            <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
              <option value="">All</option>
              {reasonOptions.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
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
    pilotFilter,
    estateFilter,
    reasonFilter,
    pilotOptions,
    estateOptions,
    reasonOptions,
  ]);

  if (loading) {
    return (
      <div className={workspace ? 'rds-loading' : 'flex justify-center items-center h-full'}>
        <Bars color="#004B71" height={workspace ? 40 : 80} width={workspace ? 40 : 80} />
      </div>
    );
  }

  const tableBlock = filteredData.length === 0 ? (
    <div className={workspace ? 'rds-empty' : 'flex flex-col justify-center items-center h-full text-gray-500'}>
      {!workspace && <div className="text-2xl mb-2">📊</div>}
      <p className={workspace ? undefined : 'text-lg'}>No data available for the selected criteria</p>
      {!workspace && (
        <button
          onClick={fetchData}
          className="mt-4 flex items-center bg-blue-500 text-white"
        >
          <FiRefreshCw className="mr-2" />
          Refresh Data
        </button>
      )}
    </div>
  ) : (
    <div className={workspace ? 'rds-table-wrap' : 'table-container'}>
      <table className={workspace ? 'rds-table' : undefined}>
        <thead>
          <tr>
            <th>Plan ID</th>
            <th>Date</th>
            <th>Estate (Area)</th>
            <th>Task ID</th>
            <th>Pilot</th>
            <th>Field</th>
            <th>Area</th>
            <th>Pilot Field Area</th>
            <th>Completion Rate (%)</th>
            <th>Pilot Status</th>
            <th>Cancel Reason</th>
            <th>Partial Reason</th>
            <th>Ops Room Reason</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((task) => (
            <tr key={task.task_id}>
              <td>{task.plan_id}</td>
              <td>{formatDisplayDate(task.date)}</td>
              <td>{`${task.estate} (${task.estate_area})`}</td>
              <td>{task.task_id}</td>
              <td>{task.pilot}</td>
              <td>{task.field}</td>
              <td>{task.area}</td>
              <td>{task.pilot_field_area}</td>
              <td>{task.completion_rate}%</td>
              <td>{task.type === 'x' ? 'Canceled' : 'Partially Completed'}</td>
              <td>{task.cancel_reason || '-'}</td>
              <td>{task.partial_reason || '-'}</td>
              <td>{task.ops_reason || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const chartBlock =
    reasonChartData.length > 0 || dailyChartData.length > 0 ? (
      <div className="rds-ops-data">
        <div className="rds-metric-strip">
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Tasks</div>
            <div className="rds-metric-strip-val">{filteredData.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Canceled</div>
            <div className="rds-metric-strip-val">
              {filteredData.filter((t) => t.type === 'x').length}
            </div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Partial</div>
            <div className="rds-metric-strip-val">
              {filteredData.filter((t) => t.type !== 'x').length}
            </div>
          </div>
        </div>
        {reasonChartData.length > 0 && (
          <div className="rds-chart-bleed">
            <div className="rds-chart-bleed-title">Top reasons</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={reasonChartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Bar dataKey="count" name="Tasks" fill="#0f6b4c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {dailyChartData.length > 0 && (
          <div className="rds-chart-bleed">
            <div className="rds-chart-bleed-title">Daily volume</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Legend />
                <Bar dataKey="canceled" name="Canceled" fill="#dc2626" stackId="a" />
                <Bar dataKey="partial" name="Partial" fill="#f59e0b" stackId="a" />
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
    <div className="ops-container6">
      <div className="ops6-section">
        <div className="ops6-section-next">
          <div className="report-toolbar ops6-top">
            <ReportDateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                if (start) setStartDate(start);
                if (end) setEndDate(end);
              }}
              disabled={loading}
            />
            <div className="report-toolbar-field">
              <select
                value={pilotFilter}
                onChange={(e) => setPilotFilter(e.target.value)}
              >
                <option value="">All Pilots</option>
                {pilotOptions.map((pilot, index) => (
                  <option key={index} value={pilot}>{pilot}</option>
                ))}
              </select>
            </div>
            <div className="report-toolbar-field">
              <select
                value={estateFilter}
                onChange={(e) => setEstateFilter(e.target.value)}
              >
                <option value="">All Estates</option>
                {estateOptions.map((estate, index) => (
                  <option key={index} value={estate}>{estate}</option>
                ))}
              </select>
            </div>
            <div className="report-toolbar-field">
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
              >
                <option value="">All Reasons</option>
                {reasonOptions.map((reason, index) => (
                  <option key={index} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
            <div className="report-toolbar-actions">
              <button
                onClick={downloadExcel}
                className="flex items-center bg-green-500 text-white m-0"
              >
                <FiDownload className="mr-2" />
                Excel
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center bg-red-600 text-white m-0"
              >
                <FiPrinter className="mr-2" />
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>
      <div>{tableBlock}</div>
    </div>
  );
};

export default CanceledByPilots;
