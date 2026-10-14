import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatFuelMoney, getFuelLineDisplayParts } from './fuelVoucherDescription';
import {
  formatVoucherDisplayDate,
  getFuelVoucherLabels,
  hasVoucherApprovalInfo,
  resolveVoucherApprovalType,
  resolveVoucherApprovedBy,
  resolveVoucherDriverName,
} from './transportVoucherPrintUtils';

const VOUCHER_ORG = {
  org_name: 'Kenilworth International Lanka (Pvt) Ltd',
  email: 'finance@kenilworthinternational.com',
};

function splitTableWidths(total, ratios) {
  const raw = ratios.map((r) => Math.floor(total * r * 10) / 10);
  const used = raw.reduce((sum, w) => sum + w, 0);
  raw[raw.length - 1] = Math.round((raw[raw.length - 1] + (total - used)) * 10) / 10;
  return raw;
}

function tryAddLogo(doc, x, y, w, h) {
  try {
    const logoPath = `${window.location.origin}${process.env.PUBLIC_URL || ''}/assets/images/kenilowrthlogoDark.png`;
    doc.addImage(logoPath, 'PNG', x, y, w, h);
  } catch {
    /* logo optional */
  }
}

function drawMetaRows(doc, rows, startX, valueX, startY, rowGap = 5) {
  rows.forEach(([label, value], idx) => {
    const rowY = startY + idx * rowGap;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, startX, rowY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), valueX, rowY);
  });
}

/**
 * Build and download a fuel (transport or generator) voucher as A4 PDF (invoice-style layout).
 * @param {object} voucher
 */
export function downloadTransportVoucherPdf(voucher) {
  const labels = getFuelVoucherLabels(voucher);
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;
  let y = 14;

  tryAddLogo(doc, margin, y, 28, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(VOUCHER_ORG.org_name, pageWidth - margin, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let orgY = y + 9;
  if (VOUCHER_ORG.email) {
    doc.text(VOUCHER_ORG.email, pageWidth - margin, orgY, { align: 'right' });
    orgY += 4;
  }

  y = Math.max(y + 32, orgY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 76, 117);
  doc.text(labels.title, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 9;

  const partiesY = y;
  const leftColX = margin;
  const midColX = margin + 58;
  const metaLabelX = pageWidth - margin - 72;
  const metaValueX = metaLabelX + 44;
  const checkedBy = voucher?.checked_by_name || voucher?.created_by_name || 'Finance';
  const approvedBy = resolveVoucherApprovedBy(voucher);
  const approvalType = resolveVoucherApprovalType(voucher);
  const showApproval = hasVoucherApprovalInfo(voucher);
  const txCount = voucher?.transaction_count || voucher?.lines?.length || 0;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared By', leftColX, partiesY);

  if (showApproval) {
    doc.text('Approval', midColX, partiesY);
  }

  drawMetaRows(
    doc,
    [
      ['VOUCHER', voucher?.voucher_no || '—'],
      ['DATE', formatVoucherDisplayDate(voucher?.created_at)],
      ['TXNS', String(txCount)],
    ],
    metaLabelX,
    metaValueX,
    partiesY
  );

  doc.setFont('helvetica', 'bold');
  doc.text(checkedBy, leftColX, partiesY + 5);
  if (showApproval && approvalType) {
    doc.text(approvalType, midColX, partiesY + 5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text('Finance Settlement', leftColX, partiesY + 9);
  if (showApproval && approvedBy) {
    doc.text(approvedBy, midColX, partiesY + 9);
  }

  y = partiesY + 16;

  const lines = voucher?.lines || [];
  const lineRows = lines.map((line) => {
    const parts = getFuelLineDisplayParts(line);
    return [
      resolveVoucherDriverName(line),
      parts.fuelDate,
      parts.liters,
      parts.amount,
      line.approved_by_name || '—',
    ];
  });

  const [w0, w1, w2, w3, w4] = splitTableWidths(tableWidth, [0.24, 0.18, 0.12, 0.16, 0.30]);

  autoTable(doc, {
    head: [[labels.personHeader, 'FUEL DATE', 'LITERS', 'AMOUNT', 'ADMIN APPROVER']],
    body: lineRows,
    startY: y,
    tableWidth,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: {
      fillColor: [232, 244, 252],
      textColor: [15, 76, 117],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: w0, halign: 'left' },
      1: { cellWidth: w1, halign: 'left' },
      2: { halign: 'right', cellWidth: w2 },
      3: { halign: 'right', cellWidth: w3 },
      4: { cellWidth: w4, halign: 'left' },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 8;

  const notice = labels.notice;

  const colMid = pageWidth / 2;
  doc.setFontSize(7);
  const noticeLines = doc.splitTextToSize(notice, colMid - margin - 4);
  doc.text(noticeLines, margin, y);

  const totalsX = colMid + 4;
  let ty = y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('TRANSACTIONS', totalsX, ty);
  doc.text(String(txCount), pageWidth - margin, ty, { align: 'right' });
  ty += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL AMOUNT', totalsX, ty);
  doc.text(`LKR ${formatFuelMoney(voucher?.total_amount)}`, pageWidth - margin, ty, { align: 'right' });

  y = Math.max(y + noticeLines.length * 3.5, ty) + 10;

  const sigColWidth = (tableWidth - 10) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CHECKED BY', margin, y);
  doc.text('APPROVED BY', margin + sigColWidth + 10, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(checkedBy, margin, y);
  if (approvedBy) {
    doc.text(approvedBy, margin + sigColWidth + 10, y);
  }
  y += 3;
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + sigColWidth, y);
  doc.line(margin + sigColWidth + 10, y, pageWidth - margin, y);

  if (voucher?.notes) {
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Notes:', margin, y);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(String(voucher.notes), tableWidth - 16);
    doc.text(noteLines, margin + 14, y);
  }

  const footerY = pageHeight - 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('DSMS Finance Settlement Document', pageWidth / 2, footerY, { align: 'center' });

  const safeNo = String(voucher?.voucher_no || labels.fileFallback).replace(/[^\w.-]+/g, '_');
  doc.save(`${safeNo}.pdf`);
}
