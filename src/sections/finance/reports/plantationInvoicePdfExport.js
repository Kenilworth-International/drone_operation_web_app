import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayDate = (d) => {
  if (!d) return '-';
  const text = String(d).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return text;
};

function addressLines(text) {
  if (text == null || String(text).trim() === '') return [];
  return String(text)
    .split(/[,\n\r]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Split total width across columns (sums exactly to total). */
function splitTableWidths(total, ratios) {
  const raw = ratios.map((r) => Math.floor(total * r * 10) / 10);
  const used = raw.reduce((s, w) => s + w, 0);
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

/**
 * Build and download plantation tax invoice as A4 PDF.
 * @param {object} invoice
 */
export function downloadPlantationInvoicePdf(invoice) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;
  let y = 14;

  tryAddLogo(doc, margin, y, 28, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const orgName = invoice.org_name || 'Organization';
  doc.text(orgName, pageWidth - margin, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let orgY = y + 9;
  const orgAddr = invoice.org_address_lines?.length
    ? invoice.org_address_lines
    : addressLines(invoice.org_address);
  orgAddr.forEach((line) => {
    doc.text(line, pageWidth - margin, orgY, { align: 'right' });
    orgY += 4;
  });
  if (invoice.email) {
    doc.text(invoice.email, pageWidth - margin, orgY, { align: 'right' });
    orgY += 4;
  }
  if (invoice.br) {
    doc.text(`Govt. UID: ${invoice.br}`, pageWidth - margin, orgY, { align: 'right' });
    orgY += 4;
  }

  y = Math.max(y + 32, orgY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 76, 117);
  const docTitle =
    String(invoice.invoice_type || '') === 'pre'
      ? 'Tax Invoice (Pre / Advance)'
      : String(invoice.invoice_type || '') === 'credit_note'
        ? 'Credit Note'
        : 'Tax Invoice';
  doc.text(docTitle, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  const partiesY = y;
  const billColX = margin;
  const shipColX = margin + 58;
  const metaLabelX = pageWidth - margin - 52;
  const metaValueX = pageWidth - margin;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To', billColX, partiesY);
  doc.text('Ship To', shipColX, partiesY);

  const metaRows = [
    [
      String(invoice.invoice_type) === 'credit_note' ? 'CREDIT NOTE' : 'INVOICE',
      String(invoice.invoice_no || ''),
    ],
    ['DATE', formatDisplayDate(invoice.invoice_date)],
    ['DUE DATE', formatDisplayDate(invoice.due_date)],
  ];
  metaRows.forEach(([label], idx) => {
    doc.text(label, metaLabelX, partiesY + idx * 5);
  });

  doc.setFont('helvetica', 'normal');
  let rowY = partiesY + 5;
  if (invoice.plantation_name) {
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.plantation_name, billColX, rowY);
    doc.text(invoice.plantation_name, shipColX, rowY);
    doc.setFont('helvetica', 'normal');
    rowY += 4;
  }
  const billLines = invoice.bill_to_lines?.length
    ? invoice.bill_to_lines
    : addressLines(invoice.bill_to_address);
  const shipLines = invoice.ship_to_lines?.length
    ? invoice.ship_to_lines
    : addressLines(invoice.ship_to_address);
  const maxAddr = Math.max(billLines.length, shipLines.length);
  for (let i = 0; i < maxAddr; i += 1) {
    if (billLines[i]) doc.text(billLines[i], billColX, rowY);
    if (shipLines[i]) doc.text(shipLines[i], shipColX, rowY);
    rowY += 4;
  }

  metaRows.forEach(([, value], idx) => {
    doc.text(value, metaValueX, partiesY + idx * 5, { align: 'right' });
  });

  y = Math.max(rowY, partiesY + metaRows.length * 5) + 6;

  const lineRows = (invoice.line_items || []).map((row) => [
    `${row.activity || ''}\n${row.description || ''}`,
    formatMoney(row.qty),
    formatMoney(row.rate),
    formatMoney(row.amount),
  ]);

  const [lineW0, lineW1, lineW2, lineW3] = splitTableWidths(tableWidth, [0.52, 0.16, 0.16, 0.16]);

  autoTable(doc, {
    head: [['ACTIVITY', 'QTY', 'Rate (per Ha)', 'AMOUNT']],
    body: lineRows,
    startY: y,
    tableWidth,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: {
      fillColor: [232, 244, 252],
      textColor: [15, 76, 117],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: lineW0, halign: 'left' },
      1: { halign: 'right', cellWidth: lineW1 },
      2: { halign: 'right', cellWidth: lineW2 },
      3: { halign: 'right', cellWidth: lineW3 },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 8;

  const notice =
    'Draw your al payments to Kenilworth International Lanka (Pvt) Ltd(KWIL) only. company wil not liable for any payments to not reached under KWIL Any discrepancy kindly inform to the "finance@kenilworthinternational.com" with in 07 days from the date mentioned above. We wil not accept any complains after the due date. This is a computer guaranteed invoice hence no signature required.';

  const colMid = pageWidth / 2;
  doc.setFontSize(7);
  const noticeLines = doc.splitTextToSize(notice, colMid - margin - 4);
  doc.text(noticeLines, margin, y);

  const totalsX = colMid + 4;
  const totalW = pageWidth - margin - totalsX;
  const drawTotal = (label, value, yy, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9);
    doc.text(label, totalsX, yy);
    doc.text(value, pageWidth - margin, yy, { align: 'right' });
  };
  let ty = y;
  drawTotal('SUBTOTAL', formatMoney(invoice.subtotal), ty);
  ty += 5;
  drawTotal('TAX', formatMoney(invoice.tax_total), ty);
  ty += 5;
  drawTotal('TOTAL', formatMoney(invoice.total), ty);
  ty += 7;
  if (Number(invoice.prepaid_applied) > 0) {
    drawTotal('PREPAID', `− ${formatMoney(invoice.prepaid_applied)}`, ty);
    ty += 5;
  }
  const isCredit =
    String(invoice.invoice_type) === 'credit_note' || Number(invoice.credit_amount) > 0;
  drawTotal(
    isCredit ? 'CREDIT AMOUNT' : 'BALANCE DUE',
    `LKR ${formatMoney(isCredit ? invoice.credit_amount : invoice.balance_due ?? invoice.total)}`,
    ty,
    true
  );

  y = Math.max(y + noticeLines.length * 3.5, ty) + 8;

  const taxRows = (invoice.tax_lines || []).map((t) => [
    t.tax_name || '',
    t.rate_percent != null ? `${Number(t.rate_percent)}%` : '',
    formatMoney(t.tax_amount),
    formatMoney(t.net_amount),
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 76, 117);
  doc.text('TAX SUMMARY', margin, y);
  doc.setTextColor(0, 0, 0);
  y += 4;

  const [taxW0, taxW1, taxW2, taxW3] = splitTableWidths(tableWidth, [0.4, 0.15, 0.225, 0.225]);

  autoTable(doc, {
    head: [['', 'RATE', 'TAX', 'NET']],
    body: taxRows,
    startY: y,
    tableWidth,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [232, 244, 252], textColor: [15, 76, 117], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: taxW0 },
      1: { halign: 'center', cellWidth: taxW1 },
      2: { halign: 'right', cellWidth: taxW2 },
      3: { halign: 'right', cellWidth: taxW3 },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 6;

  if (invoice.vat_no) {
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
    doc.setFontSize(8);
    doc.text(`VAT Registration No: ${invoice.vat_no}`, margin + 2, y + 5);
  }

  const footerY = pageHeight - 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Thank you for doing business with us.', pageWidth / 2, footerY, { align: 'center' });

  const safeNo = String(invoice.invoice_no || 'invoice').replace(/[^\w-]+/g, '_');
  doc.save(`Tax_Invoice_${safeNo}.pdf`);
}

/**
 * Estate spraying statement PDF - for information only (not a tax invoice).
 * @param {object} statement
 */
export function downloadEstateStatementPdf(statement) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;
  let y = 14;

  tryAddLogo(doc, margin, y, 28, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(statement.org_name || 'Organization', pageWidth - margin, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let orgY = y + 9;
  const orgAddr = statement.org_address_lines?.length
    ? statement.org_address_lines
    : addressLines(statement.org_address);
  orgAddr.forEach((line) => {
    doc.text(line, pageWidth - margin, orgY, { align: 'right' });
    orgY += 4;
  });

  y = Math.max(y + 32, orgY + 4);

  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, y, tableWidth, 12, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text('FOR INFORMATION ONLY - NOT A TAX INVOICE', margin + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    'Estate spraying statement. Payment, if any, is against the plantation tax invoice only.',
    margin + 3,
    y + 9.5
  );
  doc.setTextColor(0, 0, 0);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 76, 117);
  doc.text('Estate spraying statement', margin, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  const partiesY = y;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Plantation', margin, partiesY);
  doc.text('Estates', margin + 70, partiesY);
  doc.setFont('helvetica', 'normal');
  let rowY = partiesY + 5;
  if (statement.plantation_name) {
    doc.setFont('helvetica', 'bold');
    doc.text(String(statement.plantation_name), margin, rowY);
    doc.setFont('helvetica', 'normal');
    rowY += 4;
  }
  const estateNames = (statement.estate_names || []).filter(Boolean);
  estateNames.forEach((name, idx) => {
    doc.text(String(name), margin + 70, partiesY + 5 + idx * 4);
  });
  const metaY = partiesY;
  doc.setFont('helvetica', 'bold');
  doc.text('REF', pageWidth - margin - 52, metaY);
  doc.text('DATE', pageWidth - margin - 52, metaY + 5);
  doc.text('PERIOD', pageWidth - margin - 52, metaY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(String(statement.statement_ref || 'ESTATE-STMT'), pageWidth - margin, metaY, {
    align: 'right',
  });
  doc.text(formatDisplayDate(statement.statement_date), pageWidth - margin, metaY + 5, {
    align: 'right',
  });
  doc.text(
    `${formatDisplayDate(statement.period_start)} – ${formatDisplayDate(statement.period_end)}`,
    pageWidth - margin,
    metaY + 10,
    { align: 'right' }
  );

  y = Math.max(rowY, partiesY + 5 + estateNames.length * 4, metaY + 16) + 4;

  const lineRows = (statement.line_items || []).map((row) => [
    `${row.activity || ''}\n${row.description || ''}`,
    formatMoney(row.qty),
    formatMoney(row.rate),
    formatMoney(row.amount),
  ]);
  const [lineW0, lineW1, lineW2, lineW3] = splitTableWidths(tableWidth, [0.52, 0.16, 0.16, 0.16]);

  autoTable(doc, {
    head: [['ACTIVITY', 'QTY', 'Rate (per Ha)', 'AMOUNT']],
    body: lineRows,
    startY: y,
    tableWidth,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: {
      fillColor: [232, 244, 252],
      textColor: [15, 76, 117],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: lineW0, halign: 'left' },
      1: { halign: 'right', cellWidth: lineW1 },
      2: { halign: 'right', cellWidth: lineW2 },
      3: { halign: 'right', cellWidth: lineW3 },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 8;
  const colMid = pageWidth / 2;
  doc.setFontSize(7);
  const notice =
    'This estate statement summarises sprayed / billed hectares for the selected estates. It is issued for operational information only and is not a tax invoice. Payment is against the plantation tax invoice only.';
  const noticeLines = doc.splitTextToSize(notice, colMid - margin - 4);
  doc.text(noticeLines, margin, y);

  let ty = y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('SUBTOTAL', colMid + 4, ty);
  doc.text(formatMoney(statement.subtotal), pageWidth - margin, ty, { align: 'right' });
  ty += 5;
  if (statement.tax_total != null && Number(statement.tax_total) > 0) {
    doc.text('TAX (indicative)', colMid + 4, ty);
    doc.text(formatMoney(statement.tax_total), pageWidth - margin, ty, { align: 'right' });
    ty += 5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL (indicative)', colMid + 4, ty);
  doc.text(formatMoney(statement.total ?? statement.subtotal), pageWidth - margin, ty, {
    align: 'right',
  });
  ty += 6;
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  doc.text('STATUS: Not an invoice', colMid + 4, ty);
  doc.setTextColor(0, 0, 0);

  const footerY = pageHeight - 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Estate statement · not a tax invoice', pageWidth / 2, footerY, { align: 'center' });

  const plantation = String(statement.plantation_name || 'estate')
    .replace(/[^\w-]+/g, '_')
    .slice(0, 40);
  const period = String(statement.period_end || '').slice(0, 10);
  doc.save(`Estate_Statement_${plantation}_${period}.pdf`);
}
