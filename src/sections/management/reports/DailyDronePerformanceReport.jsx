import React, { useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Bars } from 'react-loader-spinner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiPrinter } from 'react-icons/fi';
import 'react-datepicker/dist/react-datepicker.css';
import '../../../styles/droneOpsReports.css';
import { useLazyGetDroneDailyPerformanceQuery } from '../../../api/services NodeJs/opsroomPerformanceSummaryApi';

const toYearMonth = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateStr;
};

const fmt = (n, digits = 2) => {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v.toFixed(digits) : '0.00';
};

export default function DailyDronePerformanceReport() {
  const today = new Date();
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [yearMonth, setYearMonth] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  const [fetchReport, { isLoading, isFetching }] = useLazyGetDroneDailyPerformanceQuery();
  const loading = isLoading || isFetching;

  const handleGenerate = async () => {
    const ym = toYearMonth(monthDate);
    try {
      const result = await fetchReport({ yearMonth: ym, missionType: 'spy' }).unwrap();
      setRows(Array.isArray(result?.rows) ? result.rows : []);
      setTotals(result?.totals || null);
      setYearMonth(result?.year_month || ym);
      setHasGenerated(true);
    } catch (e) {
      console.error(e);
      setRows([]);
      setTotals(null);
      setYearMonth(ym);
      setHasGenerated(true);
    }
  };

  const tableRows = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      const key = row.date || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    const out = [];
    groups.forEach((groupRows, date) => {
      groupRows.forEach((row, idx) => {
        out.push({
          ...row,
          date,
          rowSpan: idx === 0 ? groupRows.length : 0,
        });
      });
    });
    return out;
  }, [rows]);

  const downloadPdf = () => {
    if (!rows.length) return;
    // Always A4 landscape (297 × 210 mm)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Drone Performance Report', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text('Strategic Management & Monitoring Department', pageWidth / 2, 19, {
      align: 'center',
    });
    doc.setFontSize(10);
    doc.text(`Month: ${yearMonth}`, 14, 26);

    let lastDate = null;
    const body = rows.map((row) => {
      const showDate = row.date !== lastDate;
      lastDate = row.date;
      return [
        showDate ? formatDisplayDate(row.date) : '',
        row.drone_id || '—',
        row.pilot_name || '—',
        fmt(row.total_task_area_ha),
        fmt(row.total_flight_time_hours),
        fmt(row.average_hours_per_ha),
        String(row.total_flights ?? 0),
        fmt(row.average_flights_per_ha, 1),
      ];
    });

    if (totals) {
      body.push([
        'Total',
        '',
        '',
        fmt(totals.total_task_area_ha),
        fmt(totals.total_flight_time_hours),
        fmt(totals.average_hours_per_ha),
        String(totals.total_flights ?? 0),
        fmt(totals.average_flights_per_ha, 1),
      ]);
    }

    autoTable(doc, {
      startY: 31,
      head: [
        [
          'Date',
          'Drone ID',
          'Pilot',
          'Total Task Area (Ha)',
          'Total Flight Time (Hours)',
          'Average hours/Per Ha',
          'Total Flights',
          'Average Flights Per Ha',
        ],
      ],
      body,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [0, 75, 113], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14, top: 12, bottom: 12 },
      tableWidth: 'auto',
      columnStyles: {
        0: { cellWidth: 24 },
        3: {halign: 'right' },
        4: {halign: 'right' },
        5: {halign: 'right' },
        6: {halign: 'right' },
        7: {halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === body.length - 1 && totals) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    doc.save(`Drone_Performance_Report_${yearMonth}.pdf`);
  };

  return (
    <div className="drone-ops-report">
      <div className="drone-ops-toolbar">
        <div className="drone-ops-fields">
          <div className="drone-ops-field drone-ops-field--date">
            <span className="drone-ops-field-label">Month</span>
            <DatePicker
              selected={monthDate}
              onChange={(d) => d && setMonthDate(d)}
              dateFormat="MM/yyyy"
              showMonthYearPicker
              wrapperClassName="drone-ops-datepicker-wrap"
              className="drone-ops-date-input"
            />
          </div>
        </div>
        <div className="drone-ops-actions">
          <button
            type="button"
            className="drone-ops-btn drone-ops-btn--generate"
            onClick={handleGenerate}
            disabled={loading || !monthDate}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button
            type="button"
            className="drone-ops-btn drone-ops-btn--pdf"
            onClick={downloadPdf}
            disabled={!rows.length}
          >
            <FiPrinter /> PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="drone-ops-loading">
          <Bars height={48} width={48} color="#004b71" ariaLabel="loading" />
        </div>
      ) : !hasGenerated ? (
        <p className="drone-ops-empty">
          Select a month and click <strong>Generate</strong> to load drone performance.
        </p>
      ) : rows.length === 0 ? (
        <p className="drone-ops-empty">No drone performance data found for {yearMonth}.</p>
      ) : (
        <div className="drone-ops-table-wrap">
          <table className="drone-ops-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Drone ID</th>
                <th>Pilot</th>
                <th className="num">Total Task Area (Ha)</th>
                <th className="num">Total Flight Time (Hours)</th>
                <th className="num">Average hours/Per Ha</th>
                <th className="num">Total Flights</th>
                <th className="num">Average Flights Per Ha</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => (
                <tr key={`${row.date}-${row.drone_id}-${row.pilot_name}-${idx}`}>
                  {row.rowSpan > 0 ? (
                    <td className="drone-ops-date" rowSpan={row.rowSpan}>
                      {formatDisplayDate(row.date)}
                    </td>
                  ) : null}
                  <td>{row.drone_id}</td>
                  <td>{row.pilot_name}</td>
                  <td className="num">{fmt(row.total_task_area_ha)}</td>
                  <td className="num">{fmt(row.total_flight_time_hours)}</td>
                  <td className="num">{fmt(row.average_hours_per_ha)}</td>
                  <td className="num">{row.total_flights}</td>
                  <td className="num">{fmt(row.average_flights_per_ha, 1)}</td>
                </tr>
              ))}
            </tbody>
            {totals ? (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td colSpan={2} />
                  <td className="num">{fmt(totals.total_task_area_ha)}</td>
                  <td className="num">{fmt(totals.total_flight_time_hours)}</td>
                  <td className="num">{fmt(totals.average_hours_per_ha)}</td>
                  <td className="num">{totals.total_flights}</td>
                  <td className="num">{fmt(totals.average_flights_per_ha, 1)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  );
}
