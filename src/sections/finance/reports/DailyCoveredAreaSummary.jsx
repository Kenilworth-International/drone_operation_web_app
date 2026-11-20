import React, { useState, useEffect } from "react";
import '../../../styles/finance2.css';
import { useAppDispatch } from '../../../store/hooks';
import { baseApi } from '../../../api/services/allEndpoints';
import DatePicker from 'react-datepicker';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Bars } from "react-loader-spinner";
import { useSyncShellDateRange } from '../../management/reports/ReportsPeriodContext';

const DailyCoveredAreaSummary = () => {
  const dispatch = useAppDispatch();
  // Date range: 1st of month to today
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateRange, setDateRange] = useState([firstDayOfMonth, today]);
  useSyncShellDateRange(setDateRange);
  const [startDate, endDate] = dateRange;

  // Data
  const [rawData, setRawData] = useState([]); // Raw API response
  const [tableData, setTableData] = useState([]); // Processed for table

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch data on mount and when date range changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [startDate, endDate]);

  // Process table data when rawData changes
  useEffect(() => {
    processTableData();
    // eslint-disable-next-line
  }, [rawData]);

  // Fetch finance report data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const start = startDate.toLocaleDateString('en-CA');
      const end = endDate.toLocaleDateString('en-CA');
      const result = await dispatch(baseApi.endpoints.getPlantationCoveredArea.initiate({ startDate: start, endDate: end }));
      const response = result.data;
      if (response && response.dates) {
        setRawData(response.dates);
      } else {
        setRawData([]);
      }
    } catch (err) {
      setError("Failed to fetch report data");
      setRawData([]);
    } finally {
      setLoading(false);
    }
  };

  // Process API data for table - group by date
  const processTableData = () => {
    if (!rawData || rawData.length === 0) {
      setTableData([]);
      return;
    }
    
    const dateGroups = new Map(); // Group data by date
    
    for (let i = 0; i < rawData.length; i += 2) {
      const date = rawData[i];
      const plantations = rawData[i + 1];
      
      if (!Array.isArray(plantations)) continue;
      
      // Initialize date group if not exists
      if (!dateGroups.has(date)) {
        dateGroups.set(date, {
          date,
          plantations: new Set(),
          planned_total: 0,
          completed_total: 0
        });
      }
      
      const dateGroup = dateGroups.get(date);
      
      plantations.forEach(item => {
        let hasCompletedArea = false;
        let plantationPlanned = 0;
        let plantationCompleted = 0;
        
        // Process spray operations
        if (item.spray) {
          const sprayArea = Number(item.spray.field_area) || 0;
          const sprayPlanned = Number(item.spray.plan_size) || 0;
          
          if (sprayArea > 0) {
            hasCompletedArea = true;
            plantationCompleted += sprayArea;
            plantationPlanned += sprayPlanned;
          }
        }
        
        // Process spread operations
        if (item.spread) {
          const spreadArea = Number(item.spread.field_area) || 0;
          const spreadPlanned = Number(item.spread.plan_size) || 0;
          
          if (spreadArea > 0) {
            hasCompletedArea = true;
            plantationCompleted += spreadArea;
            plantationPlanned += spreadPlanned;
          }
        }
        
        // Only add plantation and totals if it has completed area
        if (hasCompletedArea) {
          dateGroup.plantations.add(item.plantation);
          dateGroup.completed_total += plantationCompleted;
          dateGroup.planned_total += plantationPlanned;
        }
      });
    }
    
    // Convert to array format for table
    const processedData = Array.from(dateGroups.values())
      .filter(group => group.completed_total > 0) // Only show dates with completed work
      .map(group => ({
        date: group.date,
        plantations: Array.from(group.plantations).join(', '),
        planned: group.planned_total,
        completed: group.completed_total
      }));
    
    setTableData(processedData);
  };

  // Download Excel
  const exportToExcel = () => {
    const formattedData = tableData.map(row => ({
      Date: row.date,
      Plantations: row.plantations,
      'Planned Total': row.planned,
      'Completed Total': row.completed
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Summary Report");
    XLSX.writeFile(wb, `Daily_Summary_Report_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`);
  };

  // Download PDF
  const exportPdf = () => {
    const doc = new jsPDF();
    doc.text("Daily Summary Report", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Date", "Plantations", "Planned Total", "Completed Total"]],
      body: tableData.map(row => [row.date, row.plantations, row.planned, row.completed]),
    });
    doc.save(`Daily_Summary_Report_${formatDate(startDate)}_to_${formatDate(endDate)}.pdf`);
  };

  // Helpers
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-CA');
  };

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
          <button className="download-btn-finance" onClick={exportToExcel}>Excel</button>
          <button className="download-btn-finance" onClick={exportPdf}>PDF</button>
        </div>
      </div>
      
      {/* Table Section */}
      <div className="finance-report-table-section">
        {loading ? (
          <div style={{ textAlign: 'center', margin: '2em' }}>
            <Bars height={40} width={40} color="#2563eb" />
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            <table className="finance-report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plantations</th>
                  <th>Planned Total</th>
                  <th>Completed Total</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center' }}>No data available</td></tr>
                ) : (
                  tableData.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.date}</td>
                      <td>{row.plantations}</td>
                      <td>{row.planned.toFixed(2)}</td>
                      <td>{row.completed.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                {(() => {
                  const totals = tableData.reduce(
                    (acc, row) => {
                      acc.planned += Number(row.planned) || 0;
                      acc.completed += Number(row.completed) || 0;
                      return acc;
                    }, { planned: 0, completed: 0 });
                  return (
                    <tr style={{ fontWeight: 'bold', background: '#f0f4fa' }}>
                      <td colSpan={2} style={{ textAlign: 'right' }}>Total:</td>
                      <td>{totals.planned.toFixed(2)}</td>
                      <td>{totals.completed.toFixed(2)}</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

export default DailyCoveredAreaSummary;

