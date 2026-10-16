import React, { useState } from 'react';
import { toast } from 'react-toastify';
import '../../../styles/plantationInvoice.css';
import {
  downloadWorkSummaryPdfFromSnapshot,
  getWorkSummaryPdfFileName,
  formatPeriodRange,
  formatWorkSummaryTitle,
  normalizeRowForPdf,
} from './workSummaryPdfExport';

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayDate = (d) => {
  if (!d) return '-';
  const text = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, day] = text.split('-');
    return `${m}/${day}/${y}`;
  }
  const dt = new Date(text);
  if (!Number.isNaN(dt.getTime())) {
    return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${dt.getFullYear()}`;
  }
  return text;
};

const formatDateTime = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function WorkSummaryPdfDetailModal({ document: payload, onClose }) {
  const [downloading, setDownloading] = useState(false);

  if (!payload?.document) return null;

  const doc = payload.document;
  const lines = payload.lines || [];
  const pdfId = doc.pdf_id ?? doc.id;
  const summaryTitle = formatWorkSummaryTitle(doc.period_start, pdfId);
  const pdfFileName = getWorkSummaryPdfFileName(pdfId);

  const handleDownloadPdf = () => {
    if (!lines.length) {
      toast.error('No rows in snapshot - cannot rebuild PDF');
      return;
    }
    setDownloading(true);
    try {
      downloadWorkSummaryPdfFromSnapshot({ document: doc, lines });
      toast.success(`Downloaded ${pdfFileName}`);
    } catch (err) {
      toast.error(err?.message || 'Could not generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="plantation-invoice-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="plantation-invoice-modal work-summary-pdf-detail-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="plantation-invoice-modal-header">
          <div>
            <h3 style={{ margin: 0 }}>{summaryTitle}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              {doc.plantation_name ? doc.plantation_name : ''}
              {doc.plantation_name ? ' · ' : ''}
              {formatPeriodRange(doc.period_start, doc.period_end)}
            </p>
          </div>
          <button type="button" className="plantation-invoice-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="plantation-invoice-modal-body">
          <div className="work-summary-pdf-detail-meta">
            <div className="work-summary-pdf-detail-download-block">
              <span className="work-summary-pdf-detail-label">PDF</span>
              <button
                type="button"
                className="plantation-invoice-btn plantation-invoice-btn-link work-summary-pdf-download-link"
                onClick={handleDownloadPdf}
                disabled={downloading || lines.length === 0}
                title={`Download ${pdfFileName}`}
              >
                {downloading ? 'Generating…' : summaryTitle}
              </button>
              <span className="work-summary-pdf-detail-filename">{pdfFileName}</span>
            </div>
            {doc.estate_names ? (
              <div className="work-summary-pdf-detail-download-block">
                <span className="work-summary-pdf-detail-label">Estates</span>
                <span>{doc.estate_names}</span>
              </div>
            ) : null}
            <div>
              <span className="work-summary-pdf-detail-label">Billing (Ha)</span>
              <span>{formatMoney(doc.total_billing_ha)}</span>
            </div>
            <div>
              <span className="work-summary-pdf-detail-label">Rows / excluded</span>
              <span>
                {doc.total_rows ?? 0} / {doc.excluded_rows ?? 0}
              </span>
            </div>
            <div>
              <span className="work-summary-pdf-detail-label">Created by</span>
              <span>{doc.created_by_name || '-'}</span>
            </div>
            <div>
              <span className="work-summary-pdf-detail-label">Created at</span>
              <span>{formatDateTime(doc.created_at)}</span>
            </div>
            {doc.invoice_no ? (
              <div>
                <span className="work-summary-pdf-detail-label">Linked invoice</span>
                <span>#{doc.invoice_no}</span>
              </div>
            ) : null}
          </div>

          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
            Full PDF table as exported. Use <strong>{summaryTitle}</strong> to download the same file again.
          </p>

          {lines.length === 0 ? (
            <p style={{ color: '#b45309' }}>No line snapshot stored for this export.</p>
          ) : (
            <div className="finance-table-container">
              <table className="finance-report-table work-summary-pdf-detail-table">
                <thead>
                  <tr>
                    <th>Plan / Date</th>
                    <th>Field</th>
                    <th>Field (Ha)</th>
                    <th>Completed (Ha)</th>
                    <th>Covered %</th>
                    <th>Billing (Ha)</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row) => {
                    const r = normalizeRowForPdf(row);
                    return (
                    <tr
                      key={`${row.plan_id}-${row.field_id}`}
                      className={Number(row.has_chargeable_reason) === 1 && Number(row.is_included) === 0 ? 'work-summary-pdf-detail-row--excluded' : ''}
                    >
                      <td>
                        {r.planId}-{r.missionType || ''}
                        <br />
                        <small>{formatDisplayDate(r.planDate)}</small>
                      </td>
                      <td>{r.fieldName || '-'}</td>
                      <td>{formatMoney(r.fieldHa)}</td>
                      <td>{formatMoney(r.completedHa)}</td>
                      <td>{formatMoney(r.coveredPercent)}%</td>
                      <td>{formatMoney(r.billingHa)}</td>
                      <td>{r.reason || '-'}</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="plantation-invoice-modal-footer">
          <button type="button" className="plantation-invoice-btn plantation-invoice-btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="plantation-invoice-btn plantation-invoice-btn-primary"
            onClick={handleDownloadPdf}
            disabled={downloading || lines.length === 0}
          >
            {downloading ? 'Generating…' : summaryTitle}
          </button>
        </footer>
      </div>
    </div>
  );
}
