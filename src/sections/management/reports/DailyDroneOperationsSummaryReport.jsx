import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { Bars } from 'react-loader-spinner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiPrinter } from 'react-icons/fi';
import 'react-datepicker/dist/react-datepicker.css';
import '../../../styles/droneOpsReports.css';
import { useLazyGetDailyOperationsSummaryQuery } from '../../../api/services NodeJs/opsroomPerformanceSummaryApi';

const toYmd = (date) => date.toLocaleDateString('en-CA');

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

export default function DailyDroneOperationsSummaryReport() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [data, setData] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [fetchReport, { isLoading, isFetching }] = useLazyGetDailyOperationsSummaryQuery();
  const loading = isLoading || isFetching;

  const handleGenerate = async () => {
    const date = toYmd(selectedDate);
    try {
      const result = await fetchReport({ date, missionType: 'spy' }).unwrap();
      setData(result || null);
      setHasGenerated(true);
    } catch (e) {
      console.error(e);
      setData(null);
      setHasGenerated(true);
    }
  };

  const downloadPdf = () => {
    if (!data?.kpis) return;
    // Always A4 landscape (297 × 210 mm)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const addA4Page = () => doc.addPage('a4', 'landscape');
    const kpis = data.kpis;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('DAILY DRONE OPERATIONS SUMMARY', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text('Strategic Management & Monitoring Department', pageWidth / 2, 19, {
      align: 'center',
    });
    doc.setFontSize(10);
    doc.text(`Date: ${formatDisplayDate(data.date)}`, 14, 26);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('1. Daily Operational KPIs', 14, 34);
    doc.setFont(undefined, 'normal');

    autoTable(doc, {
      startY: 38,
      head: [['Metric', 'Value']],
      body: [
        ['Plans', String(kpis.plan_count ?? 0)],
        ['Planned Extent (Ha)', fmt(kpis.planned_ha)],
        ['Assigned Extent (Ha)', fmt(kpis.assigned_ha)],
        ['Completed Ops (DJI Ha)', fmt(kpis.completed_ops_ha)],
        ['Completed Pilot (Ha)', fmt(kpis.completed_pilot_ha)],
        ['Completion % (Ops)', `${fmt(kpis.completion_pct_ops)}%`],
        ['Completion % (Pilot)', `${fmt(kpis.completion_pct_pilot)}%`],
        ['Drones in Operation', String(kpis.active_drones ?? 0)],
        ['Active Pilots', String(kpis.active_pilots ?? 0)],
        ['Cancelled Plans', String(kpis.cancelled_plans ?? 0)],
        ['Cancelled Extent (Ha)', fmt(kpis.cancelled_extent_ha)],
        ['Total Billing (Ha)', fmt(kpis.total_billing_ha)],
      ],
      styles: { fontSize: 9, cellPadding: 1.5 },
      headStyles: { fillColor: [0, 75, 113], textColor: 255 },
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: 78 }, 1: { cellWidth: 42,halign: 'right' } },
      tableWidth: 127,
    });

    let y = (doc.lastAutoTable?.finalY || 70) + 8;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('2. Major Issues / Delays', 14, y);
    y += 3;

    const issues = Array.isArray(data.issues) ? data.issues : [];
    autoTable(doc, {
      startY: y,
      head: [['Estate', 'Pilot / By', 'Field / Plan', 'Type', 'Reason', 'Area (Ha)']],
      body:
        issues.length > 0
          ? issues.map((row) => [
              row.estate || '—',
              row.pilot || '—',
              row.field || '—',
              row.issue_type || '—',
              row.reason || '—',
              fmt(row.area_ha),
            ])
          : [['—', '—', '—', '—', 'No major issues recorded', '—']],
      styles: { fontSize: 8, cellPadding: 1.2 },
      headStyles: { fillColor: [0, 75, 113], textColor: 255 },
      margin: { left: 14, right: 14 },
      columnStyles: { 5: {halign: 'right' } },
    });

    y = (doc.lastAutoTable?.finalY || y) + 8;
    if (y > pageHeight - 42) {
      addA4Page();
      y = 14;
    }

    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('3. Cancellation Summary', 14, y);
    y += 3;

    const cancellations = Array.isArray(data.cancellations) ? data.cancellations : [];
    autoTable(doc, {
      startY: y,
      head: [['Estate', 'Reason', 'Plans', 'Extent (Ha)']],
      body:
        cancellations.length > 0
          ? cancellations.map((row) => [
              row.estate || '—',
              row.reason || '—',
              String(row.plan_count ?? 0),
              fmt(row.extent_ha),
            ])
          : [['—', 'No cancellations', '0', '0.00']],
      styles: { fontSize: 8, cellPadding: 1.2 },
      headStyles: { fillColor: [0, 75, 113], textColor: 255 },
      margin: { left: 14, right: 14 },
      columnStyles: { 2: {halign: 'right' }, 3: {halign: 'right' } },
    });

    y = (doc.lastAutoTable?.finalY || y) + 8;
    if (y > pageHeight - 28) {
      addA4Page();
      y = 14;
    }

    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('4. Management Notes', 14, y);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    const notes = data.notes || '';
    const split = doc.splitTextToSize(notes, pageWidth - 28);
    doc.text(split, 14, y + 6);

    doc.save(`Daily_Drone_Operations_Summary_${data.date}.pdf`);
  };

  const kpis = data?.kpis;

  return (
    <div className="drone-ops-report">
      <div className="drone-ops-toolbar">
        <div className="drone-ops-fields">
          <div className="drone-ops-field drone-ops-field--date">
            <span className="drone-ops-field-label">Date</span>
            <DatePicker
              selected={selectedDate}
              onChange={(d) => d && setSelectedDate(d)}
              dateFormat="dd/MM/yyyy"
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
            disabled={loading || !selectedDate}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button
            type="button"
            className="drone-ops-btn drone-ops-btn--pdf"
            onClick={downloadPdf}
            disabled={!kpis}
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
          Select a date and click <strong>Generate</strong> to load the operations summary.
        </p>
      ) : !kpis ? (
        <p className="drone-ops-empty">No operations summary data found for the selected date.</p>
      ) : (
        <>
          <div className="drone-ops-section">
            <h3>Daily Operational KPIs — {formatDisplayDate(data.date)}</h3>
            <div className="drone-ops-kpi-grid">
              {[
                ['Plans', kpis.plan_count],
                ['Planned Ha', fmt(kpis.planned_ha)],
                ['Assigned Ha', fmt(kpis.assigned_ha)],
                ['Completed Ops Ha', fmt(kpis.completed_ops_ha)],
                ['Completed Pilot Ha', fmt(kpis.completed_pilot_ha)],
                ['Completion % Ops', `${fmt(kpis.completion_pct_ops)}%`],
                ['Drones', kpis.active_drones],
                ['Pilots', kpis.active_pilots],
                ['Cancelled Plans', kpis.cancelled_plans],
                ['Cancelled Ha', fmt(kpis.cancelled_extent_ha)],
                ['Total Billing Ha', fmt(kpis.total_billing_ha)],
              ].map(([label, value]) => (
                <div className="drone-ops-kpi" key={label}>
                  <span className="drone-ops-kpi-label">{label}</span>
                  <span className="drone-ops-kpi-value">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="drone-ops-section">
            <h3>Major Issues / Delays</h3>
            <div className="drone-ops-table-wrap">
              <table className="drone-ops-table">
                <thead>
                  <tr>
                    <th>Estate</th>
                    <th>Pilot / By</th>
                    <th>Field / Plan</th>
                    <th>Type</th>
                    <th>Reason</th>
                    <th className="num">Area (Ha)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.issues || []).length === 0 ? (
                    <tr>
                      <td colSpan={6}>No major issues recorded</td>
                    </tr>
                  ) : (
                    data.issues.map((row, idx) => (
                      <tr key={`issue-${idx}`}>
                        <td>{row.estate}</td>
                        <td>{row.pilot}</td>
                        <td>{row.field}</td>
                        <td>{row.issue_type}</td>
                        <td className="drone-ops-reason-cell">{row.reason}</td>
                        <td className="num">{fmt(row.area_ha)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="drone-ops-section">
            <h3>Cancellation Summary</h3>
            <div className="drone-ops-table-wrap">
              <table className="drone-ops-table">
                <thead>
                  <tr>
                    <th>Estate</th>
                    <th>Reason</th>
                    <th className="num">Plans</th>
                    <th className="num">Extent (Ha)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.cancellations || []).length === 0 ? (
                    <tr>
                      <td colSpan={4}>No cancellations</td>
                    </tr>
                  ) : (
                    data.cancellations.map((row, idx) => (
                      <tr key={`cancel-${idx}`}>
                        <td>{row.estate}</td>
                        <td>{row.reason}</td>
                        <td className="num">{row.plan_count}</td>
                        <td className="num">{fmt(row.extent_ha)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {data.notes ? (
            <div className="drone-ops-section">
              <h3>Management Notes</h3>
              <div className="drone-ops-notes">{data.notes}</div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
