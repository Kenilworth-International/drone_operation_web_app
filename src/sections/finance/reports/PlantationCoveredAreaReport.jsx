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

const PlantationCoveredAreaReport = () => {
  const dispatch = useAppDispatch();
  // Date range: 1st of month to today
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateRange, setDateRange] = useState([firstDayOfMonth, today]);
  useSyncShellDateRange(setDateRange);
  const [startDate, endDate] = dateRange;

  // Filters
  const [typeFilter, setTypeFilter] = useState('all'); // all/spray/spread
  const [plantationFilter, setPlantationFilter] = useState('all');

  // Data
  const [rawData, setRawData] = useState([]); // Raw API response
  const [tableData, setTableData] = useState([]); // Flattened for table
  const [plantationList, setPlantationList] = useState([]); // For filter dropdown

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [startDate, endDate]);

  // Refetch table data when filters or rawData change
  useEffect(() => {
    processTableData();
    // eslint-disable-next-line
  }, [rawData, typeFilter, plantationFilter]);

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
        // Build plantation list for filter
        const plantations = new Set();
        for (let i = 1; i < response.dates.length; i += 2) {
          response.dates[i].forEach(row => plantations.add(row.plantation));
        }
        setPlantationList(Array.from(plantations));
      } else {
        setRawData([]);
        setPlantationList([]);
      }
    } catch (err) {
      setError("Failed to fetch report data");
      setRawData([]);
      setPlantationList([]);
    } finally {
      setLoading(false);
    }
  };

  // Flatten API data for table
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
      
      plantations.forEach(item => {
        // Process spray operations
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
              field_area: 0
            });
          }
          const row = rowMap.get(key);
          const sprayArea = Number(item.spray.field_area) || 0;
          row.plan_size += Number(item.spray.plan_size) || 0;
          row.field_area += sprayArea;
        }
        
        // Process spread operations
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
              field_area: 0
            });
          }
          const row = rowMap.get(key);
          const spreadArea = Number(item.spread.field_area) || 0;
          row.plan_size += Number(item.spread.plan_size) || 0;
          row.field_area += spreadArea;
        }
      });
    }
    
    setTableData(Array.from(rowMap.values()));
  };

  // Download Excel
  const exportToExcel = () => {
    const filteredData = tableData.filter(row => row.field_area > 0);
    // Format data with custom headers
    const formattedData = filteredData.map(row => ({
      Date: row.date,
      Plantation: row.plantation,
      Type: row.type,
      'Planned Extent': row.plan_size,
      'Completed Area': row.field_area
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantation wise Report");
    XLSX.writeFile(wb, `Plantation_wise_Report_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`);
  };

  // Download PDF
  const exportPdf = () => {
    const filteredData = tableData.filter(row => row.field_area > 0);
    const doc = new jsPDF();
    doc.text("Plantation wise Report", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Date", "Plantation", "Type", "Planned Extent", "Completed Area"]],
      body: filteredData.map(row => [row.date, row.plantation, row.type, row.plan_size, row.field_area]),
    });
    doc.save(`Plantation_wise_Report_${formatDate(startDate)}_to_${formatDate(endDate)}.pdf`);
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
        <div className="filter-group">
          <label>Type:</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="spray">Spray</option>
            <option value="spread">Spread</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Plantation:</label>
          <select value={plantationFilter} onChange={e => setPlantationFilter(e.target.value)}>
            <option value="all">All</option>
            {plantationList.map((p, idx) => (
              <option key={idx} value={p}>{p}</option>
            ))}
          </select>
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
            {console.log("Rendering Table Data", tableData)}
            {console.log("Table data length:", tableData.length)}
            {console.log("Filtered data:", tableData.filter(row => row.field_area > 0))}
            <table className="finance-report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plantation</th>
                  <th>Type</th>
                  <th>Planned Extent</th>
                  <th>Completed Area</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center' }}>No data available</td></tr>
                ) : (
                  tableData
                    .filter(row => row.field_area > 0)
                    .map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.date}</td>
                        <td>{row.plantation}</td>
                        <td>{row.type}</td>
                        <td>{row.plan_size}</td>
                        <td>{row.field_area}</td>
                      </tr>
                    ))
                )}
              </tbody>
              <tfoot>
                {(() => {
                  const totals = tableData.filter(row => row.field_area > 0).reduce(
                    (acc, row) => {
                      acc.plan_size += Number(row.plan_size) || 0;
                      acc.field_area += Number(row.field_area) || 0;
                      return acc;
                    }, { plan_size: 0, field_area: 0 });
                  return (
                    <tr style={{ fontWeight: 'bold', background: '#f0f4fa' }}>
                      <td colSpan={3} style={{ textAlign: 'right' }}>Total:</td>
                      <td>{totals.plan_size.toFixed(2)}</td>
                      <td>{totals.field_area.toFixed(2)}</td>
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

export default PlantationCoveredAreaReport;

