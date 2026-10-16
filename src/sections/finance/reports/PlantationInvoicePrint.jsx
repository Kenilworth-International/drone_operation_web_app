import React, { useState } from 'react';
import { toast } from 'react-toastify';
import '../../../styles/plantationInvoice.css';
import { downloadPlantationInvoicePdf } from './plantationInvoicePdfExport';

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayDate = (d) => {
  if (!d) return '-';
  const text = String(d).slice(0, 10);
  const [y, m, day] = text.split('-');
  if (!y || !m || !day) return text;
  return `${m}/${day}/${y}`;
};

/** Split stored address text into one line per segment (comma or newline separated). */
function formatAddressLines(text) {
  if (text == null || String(text).trim() === '') return [];
  return String(text)
    .split(/[,\n\r]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function PlantationInvoicePrint({ invoice, onClose, onBack, variant = 'preview' }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const isPreview = variant === 'preview';
  const handleBack = onBack || onClose;

  const handleCreatePdf = async () => {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      downloadPlantationInvoicePdf(invoice);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  if (!invoice) return null;

  const logoSrc = `${process.env.PUBLIC_URL || ''}${invoice.logo_path || '/assets/images/kenilowrthlogoDark.png'}`;
  const billToLines = invoice.bill_to_lines?.length
    ? invoice.bill_to_lines
    : formatAddressLines(invoice.bill_to_address);
  const shipToLines = invoice.ship_to_lines?.length
    ? invoice.ship_to_lines
    : formatAddressLines(invoice.ship_to_address);
  const orgLines = invoice.org_address_lines?.length
    ? invoice.org_address_lines
    : formatAddressLines(invoice.org_address);

  return (
    <div
      className={`plantation-invoice-print-overlay${isPreview ? ' plantation-invoice-preview-popup' : ''}`}
      role="presentation"
      onClick={isPreview ? onClose : undefined}
    >
      <div
        className="plantation-invoice-preview-shell"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Invoice preview"
      >
        <div className="plantation-invoice-print-toolbar">
          <button type="button" className="plantation-invoice-btn plantation-invoice-btn-secondary" onClick={handleBack}>
            Back
          </button>
          <div className="plantation-invoice-print-toolbar-actions">
            <button
              type="button"
              className="plantation-invoice-btn plantation-invoice-btn-secondary"
              disabled={pdfLoading}
              onClick={() => void handleCreatePdf()}
            >
              {pdfLoading ? 'Creating PDF…' : 'Create PDF'}
            </button>
            <button type="button" className="plantation-invoice-btn plantation-invoice-btn-primary" onClick={() => window.print()}>
              Print
            </button>
            <button type="button" className="plantation-invoice-btn plantation-invoice-btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <article className="plantation-invoice-document">
        <div className="plantation-invoice-doc-main">
        <header className="plantation-invoice-doc-header">
          <div className="plantation-invoice-doc-logo">
            <img src={logoSrc} alt="Kenilworth International" />
          </div>
          <div className="plantation-invoice-doc-org">
            <strong>{invoice.org_name}</strong>
            {orgLines.map((line, idx) => (
              <span key={`org-addr-${idx}`} className="address-line">
                {line}
              </span>
            ))}
            {invoice.telephone ? (
              <span className="address-line">{invoice.telephone}</span>
            ) : null}
            {invoice.email ? <span className="address-line">{invoice.email}</span> : null}
            {invoice.br ? <span className="address-line">Govt. UID: {invoice.br}</span> : null}
          </div>
        </header>

        <h1 className="plantation-invoice-doc-title">
          {String(invoice.invoice_type || '') === 'pre'
            ? 'Tax Invoice (Pre / Advance)'
            : String(invoice.invoice_type || '') === 'credit_note'
              ? 'Credit Note'
              : 'Tax Invoice'}
        </h1>

        {String(invoice.invoice_type || '') === 'pre' &&
        (invoice.plan_count != null || invoice.estimated_ha != null) ? (
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 12px' }}>
            Pre-invoice basis: {invoice.plan_count ?? '-'} scheduled plans ×{' '}
            {formatMoney(invoice.ha_per_plan)} Ha/plan = {formatMoney(invoice.estimated_ha)} Ha
            estimated.
          </p>
        ) : null}

        {(Number(invoice.prepaid_applied) > 0 || invoice.linked_pre_invoice) &&
        String(invoice.invoice_type || '') !== 'pre' ? (
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 12px' }}>
            Reconciliation: prepaid LKR {formatMoney(invoice.prepaid_applied)}
            {invoice.linked_pre_invoice?.invoice_no
              ? ` from pre-invoice #${invoice.linked_pre_invoice.invoice_no}`
              : ''}
            {String(invoice.invoice_type) === 'credit_note' || Number(invoice.credit_amount) > 0
              ? `. Credit amount LKR ${formatMoney(invoice.credit_amount || 0)}.`
              : `. Net balance due LKR ${formatMoney(invoice.balance_due ?? invoice.total)}.`}
          </p>
        ) : null}

        <div className="plantation-invoice-doc-parties">
          <div>
            <h5>Bill To</h5>
            {invoice.plantation_name ? (
              <span className="plantation-invoice-party-name">{invoice.plantation_name}</span>
            ) : null}
            {billToLines.map((line, idx) => (
              <span key={`bill-${idx}-${line}`} className="address-line">
                {line}
              </span>
            ))}
          </div>
          <div>
            <h5>Ship To</h5>
            {invoice.plantation_name ? (
              <span className="plantation-invoice-party-name">{invoice.plantation_name}</span>
            ) : null}
            {shipToLines.map((line, idx) => (
              <span key={`ship-${idx}-${line}`} className="address-line">
                {line}
              </span>
            ))}
          </div>
          <div className="plantation-invoice-doc-meta">
            <div className="plantation-invoice-meta-row">
              <span className="plantation-invoice-meta-label">
                {String(invoice.invoice_type) === 'credit_note' ? 'CREDIT NOTE' : 'INVOICE'}
              </span>
              <span className="plantation-invoice-meta-value">{invoice.invoice_no}</span>
            </div>
            <div className="plantation-invoice-meta-row">
              <span className="plantation-invoice-meta-label">DATE</span>
              <span className="plantation-invoice-meta-value">{formatDisplayDate(invoice.invoice_date)}</span>
            </div>
            <div className="plantation-invoice-meta-row">
              <span className="plantation-invoice-meta-label">DUE DATE</span>
              <span className="plantation-invoice-meta-value">{formatDisplayDate(invoice.due_date)}</span>
            </div>
          </div>
        </div>

        <table className="plantation-invoice-doc-table">
          <thead>
            <tr>
              <th>ACTIVITY</th>
              <th>QTY</th>
              <th>Rate (per Ha)</th>
              <th>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.line_items || []).map((row, idx) => (
              <tr key={idx}>
                <td>
                  <div className="activity-name">{row.activity}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{row.description}</div>
                </td>
                <td>{formatMoney(row.qty)}</td>
                <td>{formatMoney(row.rate)}</td>
                <td>{formatMoney(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="plantation-invoice-doc-bottom">
          <div className="plantation-invoice-doc-bottom-row">
            <div className="plantation-invoice-payment-notice">
              <p>
                Draw your al payments to Kenilworth International Lanka (Pvt) Ltd(KWIL) only. company wil not liable
                for any payments to not reached under KWIL Any discrepancy kindly inform to the
                &quot;finance@kenilworthinternational.com&quot; with in 07 days from the date mentioned above. We wil
                not accept any complains after the due date. This is a computer guaranteed invoice hence no signature
                required.
              </p>
            </div>
            <div className="plantation-invoice-doc-summary-box">
              <div>
                <span>SUBTOTAL</span>
                <span>{formatMoney(invoice.subtotal)}</span>
              </div>
              <div>
                <span>TAX</span>
                <span>{formatMoney(invoice.tax_total)}</span>
              </div>
              <div className="summary-total-row">
                <span>TOTAL</span>
                <span>{formatMoney(invoice.total)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 ? (
                <div>
                  <span>AMOUNT PAID</span>
                  <span>{formatMoney(invoice.amount_paid)}</span>
                </div>
              ) : null}
              {Number(invoice.prepaid_applied) > 0 ? (
                <div>
                  <span>PREPAID APPLIED</span>
                  <span>{formatMoney(invoice.prepaid_applied)}</span>
                </div>
              ) : null}
              <div className="total-line">
                <span>
                  {String(invoice.invoice_type) === 'credit_note' || Number(invoice.credit_amount) > 0
                    ? 'CREDIT AMOUNT'
                    : 'BALANCE DUE'}
                </span>
                <span className="balance-due-amount">
                  LKR{' '}
                  {formatMoney(
                    String(invoice.invoice_type) === 'credit_note' || Number(invoice.credit_amount) > 0
                      ? invoice.credit_amount
                      : invoice.balance_due ?? invoice.total
                  )}
                </span>
              </div>
            </div>
          </div>

          <section className="plantation-invoice-tax-summary">
            <h4>TAX SUMMARY</h4>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>RATE</th>
                  <th>TAX</th>
                  <th>NET</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.tax_lines || []).map((t) => (
                  <tr key={t.tax_type_id || t.tax_name}>
                    <td>{t.tax_name}</td>
                    <td>
                      {t.rate_percent != null && t.rate_percent !== ''
                        ? `${Number(t.rate_percent)}%`
                        : ''}
                    </td>
                    <td>{formatMoney(t.tax_amount)}</td>
                    <td>{formatMoney(t.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invoice.vat_no ? (
              <div className="plantation-invoice-vat-bar">VAT Registration No: {invoice.vat_no}</div>
            ) : null}
          </section>
        </div>
        </div>

        <footer className="plantation-invoice-doc-footer">
          Thank you for doing business with us.
        </footer>
        </article>
      </div>
    </div>
  );
}
