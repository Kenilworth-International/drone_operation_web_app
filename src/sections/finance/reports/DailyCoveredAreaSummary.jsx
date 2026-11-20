import React, { useState, useEffect } from 'react';
import '../../../styles/finance2.css';
import { useAppDispatch } from '../../../store/hooks';
import { baseApi } from '../../../api/services/allEndpoints';
import DatePicker from 'react-datepicker';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bars } from 'react-loader-spinner';
import { useSyncShellDateRange } from '../../management/reports/ReportsPeriodContext';
import { useOpsReportWorkspace } from '../../management/reports/OpsReportWorkspaceContext';
import { OpsDateRangeControls } from '../../management/reports/OpsPeriodControls';
import '../../management/reports/reportsDecisionShell.css';

const applyPresetRange = (key) => {
  const today = new Date();
  if (key === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return { start, end: today };
  }
  if (key === 'last') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start, end };
  }
  return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
};

const DailyCoveredAreaSummary = ({ onExportReady }) => {
  const dispatch = useAppDispatch();
  const workspace = useOpsReportWorkspace();
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateRange, setDateRange] = useState([firstDayOfMonth, today]);
  const [activePreset, setActivePreset] = useState('month');
  useSyncShellDateRange(setDateRange);
  const [startDate, endDate] = dateRange;

  const [rawData, setRawData] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    processTableData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const start = startDate.toLocaleDateString('en-CA');
      const end = endDate.toLocaleDateString('en-CA');
      const result = await dispatch(
        baseApi.endpoints.getPlantationCoveredArea.initiate({ startDate: start, endDate: end })
      );
      const response = result.data;
      if (response && response.dates) {
        setRawData(response.dates);
      } else {
        setRawData([]);
      }
    } catch (err) {
      setError('Failed to fetch report data');
      setRawData([]);
    } finally {
      setLoading(false);
    }
  };

  const processTableData = () => {
    if (!rawData || rawData.length === 0) {
      setTableData([]);
      return;
    }

    const dateGroups = new Map();

    for (let i = 0; i < rawData.length; i += 2) {
      const date = rawData[i];
      const plantations = rawData[i + 1];
      if (!Array.isArray(plantations)) continue;

      if (!dateGroups.has(date)) {
        dateGroups.set(date, {
          date,
          plantations: new Set(),
          planned_total: 0,
          completed_total: 0,
        });
      }

      const dateGroup = dateGroups.get(date);

      plantations.forEach((item) => {
        let hasCompletedArea = false;
        let plantationPlanned = 0;
        let plantationCompleted = 0;

        if (item.spray) {
          const sprayArea = Number(item.spray.field_area) || 0;
          const sprayPlanned = Number(item.spray.plan_size) || 0;
          if (sprayArea > 0) {
            hasCompletedArea = true;
            plantationCompleted += sprayArea;
            plantationPlanned += sprayPlanned;
          }
        }

        if (item.spread) {
          const spreadArea = Number(item.spread.field_area) || 0;
          const spreadPlanned = Number(item.spread.plan_size) || 0;
          if (spreadArea > 0) {
            hasCompletedArea = true;
            plantationCompleted += spreadArea;
            plantationPlanned += spreadPlanned;
          }
        }

        if (hasCompletedArea) {
          dateGroup.plantations.add(item.plantation);
          dateGroup.completed_total += plantationCompleted;
          dateGroup.planned_total += plantationPlanned;
        }
      });
    }

    setTableData(
      Array.from(dateGroups.values())
        .filter((group) => group.completed_total > 0)
        .map((group) => ({
          date: group.date,
          plantations: Array.from(group.plantations).join(', '),
          planned: group.planned_total,
          completed: group.completed_total,
        }))
    );
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-CA');
  };

  const exportToExcel = () => {
    const formattedData = tableData.map((row) => ({
      Date: row.date,
      Plantations: row.plantations,
      'Planned Total': row.planned,
      'Completed Total': row.completed,
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Summary Report');
    XLSX.writeFile(wb, `Daily_Summary_Report_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.text('Daily Summary Report', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Date', 'Plantations', 'Planned Total', 'Completed Total']],
      body: tableData.map((row) => [row.date, row.plantations, row.planned, row.completed]),
    });
    doc.save(`Daily_Summary_Report_${formatDate(startDate)}_to_${formatDate(endDate)}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(exportToExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData, startDate, endDate]);

  useEffect(() => {
    if (!workspace?.setSidebar) return undefined;
    workspace.setSidebar(
      <div className="rds-ops-controls">
        <OpsDateRangeControls
          startDate={startDate}
          endDate={endDate || startDate}
          onStartChange={(d) => {
            setActivePreset(null);
            setDateRange([d, endDate || d]);
          }}
          onEndChange={(d) => {
            setActivePreset(null);
            setDateRange([startDate || d, d]);
          }}
          showPresets
          activePreset={activePreset}
          onPreset={(key) => {
            const { start, end } = applyPresetRange(key);
            setActivePreset(key);
            setDateRange([start, end]);
          }}
        />
      </div>
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.setSidebar, startDate, endDate, activePreset]);

  const totals = tableData.reduce(
    (acc, row) => {
      acc.planned += Number(row.planned) || 0;
      acc.completed += Number(row.completed) || 0;
      return acc;
    },
    { planned: 0, completed: 0 }
  );

  const tableBlock = (
    <div className="rds-table-wrap">
      <table className="rds-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Plantations</th>
            <th className="num">Planned Total</th>
            <th className="num">Completed Total</th>
          </tr>
        </thead>
        <tbody>
          {tableData.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center' }}>
                No data available
              </td>
            </tr>
          ) : (
            tableData.map((row, idx) => (
              <tr key={idx}>
                <td>{row.date}</td>
                <td>{row.plantations}</td>
                <td className="num">{row.planned.toFixed(2)}</td>
                <td className="num">{row.completed.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ textAlign: 'right' }}>
              Total:
            </td>
            <td className="num">{totals.planned.toFixed(2)}</td>
            <td className="num">{totals.completed.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  if (workspace) {
    return (
      <div className="rds-ops-data">
        {loading ? (
          <div className="rds-loading">
            <Bars height={36} width={36} color="#0f6b4c" ariaLabel="loading" />
          </div>
        ) : error ? (
          <div className="rds-empty">{error}</div>
        ) : (
          tableBlock
        )}
      </div>
    );
  }

  return (
    <div className="finance-report-container2">
      <div className="finance-report-filters">
        <div className="filter-group">
          <label>Date Range:</label>
          <DatePicker
            selectsRange
            startDate={startDate}
            endDate={endDate}
            onChange={(update) => setDateRange(update)}
            dateFormat="yyyy-MM-dd"
            maxDate={today}
            isClearable={false}
            className="custom-date-range"
            disabled={loading}
          />
        </div>
        <div className="button-group-finance">
          <button type="button" className="download-btn-finance" onClick={exportToExcel}>
            Excel
          </button>
          <button type="button" className="download-btn-finance" onClick={exportPdf}>
            PDF
          </button>
        </div>
      </div>
      <div className="finance-report-table-section">
        {loading ? (
          <div style={{ textAlign: 'center', margin: '2em' }}>
            <Bars height={40} width={40} color="#2563eb" />
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          tableBlock
        )}
      </div>
    </div>
  );
};

export default DailyCoveredAreaSummary;
