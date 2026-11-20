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

const PlantationCoveredAreaReport = ({ onExportReady }) => {
  const dispatch = useAppDispatch();
  const workspace = useOpsReportWorkspace();
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateRange, setDateRange] = useState([firstDayOfMonth, today]);
  const [activePreset, setActivePreset] = useState('month');
  useSyncShellDateRange(setDateRange);
  const [startDate, endDate] = dateRange;

  const [typeFilter, setTypeFilter] = useState('all');
  const [plantationFilter, setPlantationFilter] = useState('all');

  const [rawData, setRawData] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [plantationList, setPlantationList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    processTableData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, typeFilter, plantationFilter]);

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
        const plantations = new Set();
        for (let i = 1; i < response.dates.length; i += 2) {
          response.dates[i].forEach((row) => plantations.add(row.plantation));
        }
        setPlantationList(Array.from(plantations));
      } else {
        setRawData([]);
        setPlantationList([]);
      }
    } catch (err) {
      setError('Failed to fetch report data');
      setRawData([]);
      setPlantationList([]);
    } finally {
      setLoading(false);
    }
  };

  const processTableData = () => {
    if (!rawData || rawData.length === 0) {
      setTableData([]);
      return;
    }

    const rowMap = new Map();

    for (let i = 0; i < rawData.length; i += 2) {
      const date = rawData[i];
      const plantations = rawData[i + 1];
      if (!Array.isArray(plantations)) continue;

      plantations.forEach((item) => {
        if (item.spray) {
          if (plantationFilter !== 'all' && plantationFilter !== item.plantation) return;
          if (typeFilter !== 'all' && typeFilter !== 'spray') return;

          const key = `${date}|${item.plantation}|Spray`;
          if (!rowMap.has(key)) {
            rowMap.set(key, {
              date,
              plantation: item.plantation,
              type: 'Spray',
              plan_size: 0,
              field_area: 0,
            });
          }
          const row = rowMap.get(key);
          row.plan_size += Number(item.spray.plan_size) || 0;
          row.field_area += Number(item.spray.field_area) || 0;
        }

        if (item.spread) {
          if (plantationFilter !== 'all' && plantationFilter !== item.plantation) return;
          if (typeFilter !== 'all' && typeFilter !== 'spread') return;

          const key = `${date}|${item.plantation}|Spread`;
          if (!rowMap.has(key)) {
            rowMap.set(key, {
              date,
              plantation: item.plantation,
              type: 'Spread',
              plan_size: 0,
              field_area: 0,
            });
          }
          const row = rowMap.get(key);
          row.plan_size += Number(item.spread.plan_size) || 0;
          row.field_area += Number(item.spread.field_area) || 0;
        }
      });
    }

    setTableData(Array.from(rowMap.values()));
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-CA');
  };

  const exportToExcel = () => {
    const filteredData = tableData.filter((row) => row.field_area > 0);
    const formattedData = filteredData.map((row) => ({
      Date: row.date,
      Plantation: row.plantation,
      Type: row.type,
      'Planned Extent': row.plan_size,
      'Completed Area': row.field_area,
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantation wise Report');
    XLSX.writeFile(wb, `Plantation_wise_Report_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`);
  };

  const exportPdf = () => {
    const filteredData = tableData.filter((row) => row.field_area > 0);
    const doc = new jsPDF();
    doc.text('Plantation wise Report', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Date', 'Plantation', 'Type', 'Planned Extent', 'Completed Area']],
      body: filteredData.map((row) => [row.date, row.plantation, row.type, row.plan_size, row.field_area]),
    });
    doc.save(`Plantation_wise_Report_${formatDate(startDate)}_to_${formatDate(endDate)}.pdf`);
  };

  useEffect(() => {
    onExportReady?.(exportToExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData, startDate, endDate, typeFilter, plantationFilter]);

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
        <div className="rds-ops-controls-block rds-ops-controls-inline">
          <span className="rds-ops-controls-label">Type</span>
          <label className="rds-ops-field rds-ops-field-inline">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="spray">Spray</option>
              <option value="spread">Spread</option>
            </select>
          </label>
        </div>
        <div className="rds-ops-controls-block rds-ops-controls-inline">
          <span className="rds-ops-controls-label">Plantation</span>
          <label className="rds-ops-field rds-ops-field-inline">
            <select value={plantationFilter} onChange={(e) => setPlantationFilter(e.target.value)}>
              <option value="all">All</option>
              {plantationList.map((p, idx) => (
                <option key={idx} value={p}>
                  {p}
                </option>
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
    activePreset,
    typeFilter,
    plantationFilter,
    plantationList,
  ]);

  const visibleRows = tableData.filter((row) => row.field_area > 0);
  const totals = visibleRows.reduce(
    (acc, row) => {
      acc.plan_size += Number(row.plan_size) || 0;
      acc.field_area += Number(row.field_area) || 0;
      return acc;
    },
    { plan_size: 0, field_area: 0 }
  );

  const tableBlock = (
    <div className="rds-table-wrap">
      <table className="rds-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Plantation</th>
            <th>Type</th>
            <th className="num">Planned Extent</th>
            <th className="num">Completed Area</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center' }}>
                No data available
              </td>
            </tr>
          ) : (
            visibleRows.map((row, idx) => (
              <tr key={idx}>
                <td>{row.date}</td>
                <td>{row.plantation}</td>
                <td>{row.type}</td>
                <td className="num">{row.plan_size}</td>
                <td className="num">{row.field_area}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ textAlign: 'right' }}>
              Total:
            </td>
            <td className="num">{totals.plan_size.toFixed(2)}</td>
            <td className="num">{totals.field_area.toFixed(2)}</td>
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
        <div className="filter-group">
          <label>Type:</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="spray">Spray</option>
            <option value="spread">Spread</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Plantation:</label>
          <select value={plantationFilter} onChange={(e) => setPlantationFilter(e.target.value)}>
            <option value="all">All</option>
            {plantationList.map((p, idx) => (
              <option key={idx} value={p}>
                {p}
              </option>
            ))}
          </select>
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

export default PlantationCoveredAreaReport;
