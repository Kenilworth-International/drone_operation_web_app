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

const CanceledByPilots = () => {
  const dispatch = useAppDispatch();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [pilotFilter, setPilotFilter] = useState('');
  const [estateFilter, setEstateFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pilotOptions, setPilotOptions] = useState([]);
  const [estateOptions, setEstateOptions] = useState([]);
  const [reasonOptions, setReasonOptions] = useState([]);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-CA');
  };

  const formatDisplayDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  const formatNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await dispatch(baseApi.endpoints.getCanceledFieldsByDateRange.initiate({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      }));
      const plans = result.data || [];

      const flattenedData = plans.flatMap((plan) =>
        (plan.tasks || []).map((task) => {
          const fieldArea = Number(task.area) || 0;
          // Pilot-reported completed extent from field_pilot_sub_tasks.fieldArea
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
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const filteredData = data.filter((task) =>
    (!pilotFilter || task.pilot === pilotFilter) &&
    (!estateFilter || task.estate === estateFilter) &&
    (!reasonFilter ||
      task.reason === reasonFilter ||
      task.cancel_reason === reasonFilter ||
      task.partial_reason === reasonFilter ||
      task.ops_reason === reasonFilter)
  );

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
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
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
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const dateRange = `${formatDisplayDate(formatDate(startDate))} to ${formatDisplayDate(formatDate(endDate))}`;

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
      <div>
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Bars color="#004B71" height={80} width={80} />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-gray-500">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-lg">No data available for the selected criteria</p>
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
        )}
      </div>
    </div>
  );
};

export default CanceledByPilots;
