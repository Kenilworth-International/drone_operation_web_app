import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const format2 = (n) => Number(n || 0).toFixed(2);

const MANAGER_CANCEL_EMPTY = '-';

const formatPdfMetric = (row, value, { percent = false } = {}) => {
  if (row?.isManagerCanceled) return MANAGER_CANCEL_EMPTY;
  const num = Number(value) || 0;
  return percent ? `${format2(num)}%` : format2(num);
};

/** Parse API YYYY-MM-DD (or ISO) for display without UTC day rollback. */
function parsePeriodDate(val) {
  if (val == null) return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatPeriodRange(periodStart, periodEnd) {
  const start = parsePeriodDate(periodStart);
  const end = parsePeriodDate(periodEnd);
  const fmt = (d) =>
    d
      ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
      : '-';
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start) || fmt(end) || '-';
}

function formatMonthYearFromPeriod(periodStart) {
  const d = parsePeriodDate(periodStart);
  if (!d) return '-';
  return `${d.toLocaleString('default', { month: 'long' })} - ${d.getFullYear()}`;
}

/** Display title for work summary UI and PDF headers. */
export function formatWorkSummaryTitle(periodStart, pdfId = null) {
  const base = `${formatMonthYearFromPeriod(periodStart)} Work Summary`;
  if (pdfId != null && pdfId !== '') {
    return `${base} (PDF-${pdfId})`;
  }
  return base;
}

/** Compact label for history action buttons, e.g. "26/01 - pdf 15". */
export function formatWorkSummaryShortLabel(periodStart, pdfId) {
  const d = parsePeriodDate(periodStart);
  if (!d || pdfId == null || pdfId === '') return '-';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}/${mm} - pdf ${pdfId}`;
}

function formatPlanDateDisplay(val) {
  if (!val) return 'Invalid Date';
  const d = parsePeriodDate(val);
  if (d) return d.toLocaleDateString();
  const fallback = new Date(val);
  return Number.isNaN(fallback.getTime()) ? 'Invalid Date' : fallback.toLocaleDateString();
}

function tryAddLogo(doc, x, y, w, h) {
  try {
    const logoPath = `${window.location.origin}${process.env.PUBLIC_URL || ''}/assets/images/kenilowrthlogoDark.png`;
    doc.addImage(logoPath, 'PNG', x, y, w, h);
  } catch {
    /* logo optional */
  }
}

/** Unique file name per export record (not period-based). */
export function getWorkSummaryPdfFileName(pdfId) {
  return `Finance_WorkSummary_PDF_${pdfId}.pdf`;
}

/** Normalize live report row or DB snapshot line for PDF table. */
export function normalizeRowForPdf(row) {
  if (row.planId != null) {
    return {
      planId: row.planId,
      missionType: row.missionType,
      planDate: row.date,
      estateName: row.estateName,
      fieldName: row.fieldName,
      fieldHa: row.landExtent,
      completedHa: row.fieldExtent,
      coveredPercent: row.coveredPercent,
      billingHa: row.billingExtent,
      reason: row.comNarration,
      isManagerCanceled: Boolean(row.isManagerCanceled),
    };
  }
  return {
    planId: row.plan_id,
    missionType: row.mission_type,
    planDate: row.plan_date,
    estateName: row.estate_name,
    fieldName: row.field_name,
    fieldHa: row.field_ha,
    completedHa: row.completed_ha,
    coveredPercent: row.covered_percent,
    billingHa: row.billing_ha_applied,
    reason: row.reason_text,
    isManagerCanceled: false,
  };
}

/** All rows that appear in the exported PDF (same filter as getFilteredRows output). */
export function buildPdfSnapshotLines(filteredRows) {
  return (filteredRows || []).map((r) => ({
    plan_id: r.planId,
    field_id: r.fieldId,
    estate_id: r.estateId,
    field_name: r.fieldName,
    pilot_names: r.pilotNames,
    plan_date: r.date ? String(r.date).slice(0, 10) : null,
    mission_type: r.missionType,
    field_ha: r.landExtent,
    completed_ha: r.fieldExtent,
    covered_percent: r.coveredPercent,
    billing_ha_default: r.hasChargeableReason ? r.landExtent : r.fieldExtent,
    billing_ha_applied: r.billingExtent,
    reason_text: r.comNarration || null,
    has_chargeable_reason: r.hasChargeableReason ? 1 : 0,
    is_included: r.billingIncluded ? 1 : 0,
  }));
}

/**
 * Build work summary PDF (same layout as Finance Work Summary export).
 * @returns {import('jspdf').jsPDF}
 */
export function buildWorkSummaryPdfDocument({
  plantation,
  estateNames,
  periodStart,
  rows,
  pdfId = null,
}) {
  const normalized = (rows || []).map(normalizeRowForPdf);
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;

  tryAddLogo(doc, 10, 10, 30, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text('Kenilworth International Lanka Pvt Ltd', pageWidth / 2, 25, { align: 'center' });
  doc.setFontSize(10);
  doc.text('7B , D.W Rupasinghe Mawatha, Nugegoda', pageWidth / 2, 30, { align: 'center' });

  const monthYear = formatMonthYearFromPeriod(periodStart);

  let currentY = 45;
  doc.text(`Plantation: ${plantation || 'N/A'}`, marginX, currentY);
  currentY += 5;
  const estateText = `Estate: ${estateNames || ''}`;
  const estateWrapped = doc.splitTextToSize(estateText, pageWidth - marginX * 2);
  doc.text(estateWrapped, marginX, currentY);
  currentY += estateWrapped.length * 5;
  doc.text(`Month: ${monthYear}`, marginX, currentY);
  currentY += 7;
  doc.text(formatWorkSummaryTitle(periodStart, pdfId), pageWidth / 2, currentY, { align: 'center' });

  const tableData = normalized.map((row) => {
    const planLines = [
      `${row.planId}-${row.missionType || ''}`,
      formatPlanDateDisplay(row.planDate),
      row.estateName || '',
    ].filter(Boolean);
    return [
    planLines.join('\n'),
    row.fieldName || '-',
    formatPdfMetric(row, row.fieldHa),
    formatPdfMetric(row, row.completedHa),
    formatPdfMetric(row, row.coveredPercent, { percent: true }),
    formatPdfMetric(row, row.billingHa),
    row.reason || '-',
  ];
  });

  const billable = normalized.filter((r) => !r.isManagerCanceled);
  const totalFieldHa = billable.reduce((s, r) => s + Number(r.fieldHa || 0), 0);
  const totalCompleted = billable.reduce((s, r) => s + Number(r.completedHa || 0), 0);
  const totalBilling = billable.reduce((s, r) => s + Number(r.billingHa || 0), 0);
  tableData.push(['Total', '', format2(totalFieldHa), format2(totalCompleted), '', format2(totalBilling), '']);

  autoTable(doc, {
    head: [['Plan / Date', 'Field Name', 'Field(Ha)', 'Completed(Ha)', 'Covered %', 'Billing(Ha)', 'Reason']],
    body: tableData,
    startY: currentY + 5,
    margin: { top: 20, bottom: 50 },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 66 },
    },
    headStyles: {
      fillColor: [0, 75, 113],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        const isLastRow = hookData.row.index === tableData.length - 1;
        if (isLastRow) {
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY : currentY + 10;
  let footerStartY = tableEndY + 12;
  if (footerStartY + 40 > pageHeight - 10) {
    doc.addPage();
    footerStartY = 20;
  }
  doc.setFontSize(9);
  doc.text(
    'This is a system-generated report. No signature required from KWIL. Contact : 071 617 1177',
    pageWidth / 2,
    footerStartY,
    { align: 'center' }
  );
  doc.setLineWidth(0.5);
  doc.line(15, footerStartY + 2, pageWidth - 15, footerStartY + 2);
  doc.text(
    'The above work summary is correct and approved for the payments',
    pageWidth - 100,
    footerStartY + 10,
    { align: 'right' }
  );
  const sigY = footerStartY + 20;
  doc.text('Signature:', 16, sigY);
  doc.text('Name:', 16, sigY + 10);
  const rightColX = pageWidth - 90;
  doc.text('Stamp:', rightColX, sigY);
  doc.text('Date:', rightColX, sigY + 10);

  return doc;
}

/**
 * Regenerate and download work summary PDF from a stored snapshot (by pdf_id).
 */
export function downloadWorkSummaryPdfFromSnapshot({ document, lines }) {
  const pdfId = document?.pdf_id ?? document?.id;
  if (!pdfId) {
    throw new Error('PDF ID is required');
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('No rows in snapshot');
  }

  const doc = buildWorkSummaryPdfDocument({
    plantation: document.plantation_name || document.plantation,
    estateNames: document.estate_names || '',
    periodStart: document.period_start,
    rows: lines,
    pdfId,
  });

  doc.save(getWorkSummaryPdfFileName(pdfId));
}
