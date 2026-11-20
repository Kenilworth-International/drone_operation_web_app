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

const CanceledByOpsRoom = ({ onExportReady }) => {
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
  const [reasonFlagFilter, setReasonFlagFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pilotOptions, setPilotOptions] = useState([]);
  const [estateOptions, setEstateOptions] = useState([]);
  const [reasonOptions, setReasonOptions] = useState([]);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-CA');
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  const pilotStatusLabel = (code) => {
    const map = { p: 'Pending', x: 'Canceled', s: 'Success', c: 'Completed' };
    return map[code] || code || '-';
  };

  const reasonFlagLabel = (flag) => {
    const map = { c: 'Canceled', h: 'Partially' };
    return map[flag] || flag || '-';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await dispatch(
        baseApi.endpoints.getOpsRoomCanceledByDateRange.initiate({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          reasonFlag: reasonFlagFilter || undefined,
        })
      );
      const plans = result.data || [];

      const flattenedData = plans.flatMap((plan) =>
        (plan.tasks || []).map((task) => ({
          plan_id: plan.plan_id,
          date: plan.date,
          estate: plan.estate,
          estate_area: plan.area != null ? Number(plan.area).toFixed(2) : '0.00',
          ops_operator: plan.operator_name || '',
          task_id: task.task_id,
          pilot_status: task.pilot_status || '',
          pilot: task.pilot,
          field: task.field,
          reason: task.reason,
          reason_flag: task.reason_flag || '',
          reason_if_not_sprayed: task.reason_if_not_sprayed || '',
          area: task.area != null ? Number(task.area).toFixed(2) : '0',
          dji_field_area: task.dji_field_area != null ? Number(task.dji_field_area).toFixed(2) : '0',
        }))
      );

      setData(flattenedData);
      setPilotOptions([...new Set(flattenedData.map((t) => t.pilot).filter(Boolean))]);
      setEstateOptions([...new Set(flattenedData.map((t) => t.estate).filter(Boolean))]);
      setReasonOptions([...new Set(flattenedData.map((t) => t.reason).filter(Boolean))]);
    } catch (error) {
      console.error("Error fetching ops room canceled data:", error);
      setData([]);
      setPilotOptions([]);
      setEstateOptions([]);
      setReasonOptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, reasonFlagFilter]);

  const filteredData = useMemo(
    () =>
      data.filter(
        (task) =>
          (!pilotFilter || task.pilot === pilotFilter) &&
          (!estateFilter || task.estate === estateFilter) &&
          (!reasonFilter || task.reason === reasonFilter) &&
          (!reasonFlagFilter || task.reason_flag === reasonFlagFilter)
      ),
    [data, pilotFilter, estateFilter, reasonFilter, reasonFlagFilter]
  );

  const reasonChartData = useMemo(() => {
    const counts = new Map();
    filteredData.forEach((task) => {
      const label = task.reason || 'No reason';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name: name.length > 28 ? `${name.slice(0, 26)}…` : name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [filteredData]);

  const typeChartData = useMemo(() => {
    const counts = { canceled: 0, partial: 0, other: 0 };
    filteredData.forEach((task) => {
      if (task.reason_flag === 'c') counts.canceled += 1;
      else if (task.reason_flag === 'h') counts.partial += 1;
      else counts.other += 1;
    });
    return [
      { name: 'Canceled', count: counts.canceled },
      { name: 'Partially', count: counts.partial },
      { name: 'Other', count: counts.other },
    ].filter((r) => r.count > 0);
  }, [filteredData]);

  const formatDateForFilename = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const downloadExcel = () => {
    const worksheetData = filteredData.map((task) => ({
      "Plan ID": task.plan_id,
      Date: formatDisplayDate(task.date),
      "Estate (Area)": `${task.estate} (${task.estate_area})`,
      "Task ID": task.task_id,
      "Pilot Status": pilotStatusLabel(task.pilot_status),
      "Reason Type": reasonFlagLabel(task.reason_flag),
      "Ops Operator": task.ops_operator || '',
      Pilot: task.pilot,
      Field: task.field,
      Area: task.area,
      "DJI Field Area": task.dji_field_area,
      "Cancel Reason (Ops Room)": task.reason,
      "Reason if not sprayed": task.reason_if_not_sprayed,
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ops_Room_Canceled");
    const pilotPart = pilotFilter ? pilotFilter.replace(/\s+/g, '_') : 'All_Pilots';
    const estatePart = estateFilter ? estateFilter.replace(/\s+/g, '_') : 'All_Estates';
    const reasonPart = reasonFilter ? reasonFilter.replace(/\s+/g, '_') : 'All_Reasons';
    XLSX.writeFile(
      workbook,
      `Ops_Room_Canceled_Report_${estatePart}_${reasonPart}_${pilotPart}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.xlsx`
    );
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Ops Room Canceled Report", 14, 15);
    doc.setFontSize(10);
    doc.text(
      `${formatDisplayDate(formatDate(startDate))} to ${formatDisplayDate(formatDate(endDate))}`,
      14,
      22
    );
    const tableData = filteredData.map((task) => [
      task.plan_id,
      formatDisplayDate(task.date),
      `${task.estate} (${task.estate_area})`,
      task.task_id,
      pilotStatusLabel(task.pilot_status),
      reasonFlagLabel(task.reason_flag),
      task.ops_operator || '',
      task.pilot,
      task.field,
      task.area,
      task.dji_field_area,
      task.reason,
      task.reason_if_not_sprayed,
    ]);
    autoTable(doc, {
      head: [
        [
          'Plan ID',
          'Date',
          'Estate (Area)',
          'Task ID',
          'Pilot Status',
          'Reason Type',
          'Ops Operator',
          'Pilot',
          'Field',
          'Area',
          'DJI Field Area',
          'Cancel Reason (Ops Room)',
          'Reason if not sprayed',
        ],
      ],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2, lineColor: [209, 213, 219], lineWidth: 0.1 },
      headStyles: {
        fillColor: [40, 167, 69],
        textColor: 255,
        fontStyle: 'bold',
        lineWidth: 0.2,
        halign: 'center',
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 8: { cellWidth: 22 }, 9: { cellWidth: 25 }, 10: { cellWidth: 30 }, 11: { cellWidth: 35 }, 12: { cellWidth: 40 } },
    });
    const pilotPart = pilotFilter ? pilotFilter.replace(/\s+/g, '_') : 'All_Pilots';
    const estatePart = estateFilter ? estateFilter.replace(/\s+/g, '_') : 'All_Estates';
    const reasonPart = reasonFilter ? reasonFilter.replace(/\s+/g, '_') : 'All_Reasons';
    doc.save(
      `Ops_Room_Canceled_Report_${estatePart}_${reasonPart}_${pilotPart}_${formatDateForFilename(startDate)}_to_${formatDateForFilename(endDate)}.pdf`
    );
  };

  useEffect(() => {
    onExportReady?.(downloadExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, startDate, endDate, pilotFilter, estateFilter, reasonFilter, reasonFlagFilter]);

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
          <label className="rds-ops-field rds-ops-field-inline">
            <span>Type</span>
            <select value={reasonFlagFilter} onChange={(e) => setReasonFlagFilter(e.target.value)}>
              <option value="">All</option>
              <option value="c">Canceled</option>
              <option value="h">Partially</option>
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
    reasonFlagFilter,
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
      <p className={workspace ? undefined : 'text-lg'}>No ops room canceled data for the selected criteria</p>
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
            <th>Pilot Status</th>
            <th>Reason Type</th>
            <th>Ops Operator</th>
            <th>Pilot</th>
            <th>Field</th>
            <th>Area</th>
            <th>DJI Field Area</th>
            <th>Cancel Reason (Ops Room)</th>
            <th>Reason if not sprayed</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((task) => (
            <tr key={task.task_id}>
              <td>{task.plan_id}</td>
              <td>{formatDisplayDate(task.date)}</td>
              <td>{`${task.estate} (${task.estate_area})`}</td>
              <td>{task.task_id}</td>
              <td>{pilotStatusLabel(task.pilot_status)}</td>
              <td>{reasonFlagLabel(task.reason_flag)}</td>
              <td>{task.ops_operator || '-'}</td>
              <td>{task.pilot}</td>
              <td>{task.field}</td>
              <td>{task.area}</td>
              <td>{task.dji_field_area}</td>
              <td>{task.reason}</td>
              <td>{task.reason_if_not_sprayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const chartBlock =
    reasonChartData.length > 0 || typeChartData.length > 0 ? (
      <div className="rds-ops-data">
        <div className="rds-metric-strip">
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Tasks</div>
            <div className="rds-metric-strip-val">{filteredData.length}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Canceled</div>
            <div className="rds-metric-strip-val">
              {filteredData.filter((t) => t.reason_flag === 'c').length}
            </div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Partial</div>
            <div className="rds-metric-strip-val">
              {filteredData.filter((t) => t.reason_flag === 'h').length}
            </div>
          </div>
        </div>
        {typeChartData.length > 0 && (
          <div className="rds-chart-bleed">
            <div className="rds-chart-bleed-title">By reason type</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Bar dataKey="count" name="Tasks" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {reasonChartData.length > 0 && (
          <div className="rds-chart-bleed">
            <div className="rds-chart-bleed-title">Top cancel reasons</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={reasonChartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={56} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Tasks" fill="#0f6b4c" />
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
                setStartDate(start);
                setEndDate(end);
              }}
              disabled={loading}
            />
            <div className="report-toolbar-field">
              <select value={pilotFilter} onChange={(e) => setPilotFilter(e.target.value)}>
                <option value="">All Pilots</option>
                {pilotOptions.map((pilot, index) => (
                  <option key={index} value={pilot}>
                    {pilot}
                  </option>
                ))}
              </select>
            </div>
            <div className="report-toolbar-field">
              <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}>
                <option value="">All Estates</option>
                {estateOptions.map((estate, index) => (
                  <option key={index} value={estate}>
                    {estate}
                  </option>
                ))}
              </select>
            </div>
            <div className="report-toolbar-field">
              <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
                <option value="">All Reasons</option>
                {reasonOptions.map((reason, index) => (
                  <option key={index} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div className="report-toolbar-field">
              <label htmlFor="canceled-ops-reason-type">Reason type</label>
              <select
                id="canceled-ops-reason-type"
                value={reasonFlagFilter}
                onChange={(e) => setReasonFlagFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="c">Canceled</option>
                <option value="h">Partially</option>
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

export default CanceledByOpsRoom;
