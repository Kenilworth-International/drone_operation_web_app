import React, { useState, useEffect } from "react";
import { Bars } from 'react-loader-spinner';
import '../../../styles/ops6.css';
import ReportDateRangePicker from '../../../components/ReportDateRangePicker';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch } from '../../../store/hooks';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { FiRefreshCw, FiDownload, FiPrinter } from "react-icons/fi";
import { useSyncShellPeriod } from '../../management/reports/ReportsPeriodContext';

const CanceledByOpsRoom = () => {
  const dispatch = useAppDispatch();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [endDate, setEndDate] = useState(new Date());
  useSyncShellPeriod(setStartDate, setEndDate);
  const [pilotFilter, setPilotFilter] = useState('');
  const [estateFilter, setEstateFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [reasonFlagFilter, setReasonFlagFilter] = useState(''); // '' = All, 'c' = Canceled, 'h' = Partially
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
        plan.tasks.map((task) => ({
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

  const filteredData = data.filter(
    (task) =>
      (!pilotFilter || task.pilot === pilotFilter) &&
      (!estateFilter || task.estate === estateFilter) &&
      (!reasonFilter || task.reason === reasonFilter) &&
      (!reasonFlagFilter || task.reason_flag === reasonFlagFilter)
  );

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
      <div>
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Bars color="#004B71" height={80} width={80} />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-gray-500">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-lg">No ops room canceled data for the selected criteria</p>
            <button
              onClick={fetchData}
              className="mt-4 flex items-center bg-blue-500 text-white"
            >
              <FiRefreshCw className="mr-2" />
              Refresh Data
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
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
        )}
      </div>
    </div>
  );
};

export default CanceledByOpsRoom;
