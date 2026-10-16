import React, { useState } from 'react';
import { toast } from 'react-toastify';
import '../../../styles/plantationInvoice.css';
import '../../../styles/invoiceFlows.css';
import { downloadEstateStatementPdf } from './plantationInvoicePdfExport';

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayDate = (d) => {
  if (!d) return '-';
  const text = String(d).slice(0, 10);
  const [y, m, day] = text.split('-');
  if (!y || !m || !day) return text;
  return `${m}/${day}/${y}`;
};

function formatAddressLines(text) {
  if (text == null || String(text).trim() === '') return [];
  return String(text)
    .split(/[,\n\r]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Estate spraying statement - for information only.
 * Not a tax invoice and never stored in plantation_invoices / payment tracking.
 */
export default function EstateStatementPrint({ statement, onClose }) {
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!statement) return null;

  const logoSrc = `${process.env.PUBLIC_URL || ''}${statement.logo_path || '/assets/images/kenilowrthlogoDark.png'}`;
  const billToLines = statement.bill_to_lines?.length
    ? statement.bill_to_lines
    : formatAddressLines(statement.bill_to_address);
  const shipToLines = statement.ship_to_lines?.length
    ? statement.ship_to_lines
    : formatAddressLines(statement.ship_to_address);
  const orgLines = statement.org_address_lines?.length
    ? statement.org_address_lines
    : formatAddressLines(statement.org_address);
  const estateNames = (statement.estate_names || []).filter(Boolean);

  const handleCreatePdf = async () => {
    setPdfLoading(true);
    try {
      downloadEstateStatementPdf(statement);
      toast.success('Estate statement PDF downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div
      className="plantation-invoice-print-overlay plantation-invoice-preview-popup"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="plantation-invoice-preview-shell"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Estate statement preview"
      >
        <div className="plantation-invoice-print-toolbar">
          <button type="button" className="plantation-invoice-btn plantation-invoice-btn-secondary" onClick={onClose}>
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
            <button
              type="button"
              className="plantation-invoice-btn plantation-invoice-btn-primary"
              onClick={() => window.print()}
            >
              Print
            </button>
            <button type="button" className="plantation-invoice-btn plantation-invoice-btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <article className="plantation-invoice-document estate-statement-document">
          <div className="plantation-invoice-doc-main">
            <div className="estate-statement-banner">
              <strong>Estate statement - for information only</strong>
              <span>
                This is not a tax invoice and is not payable. The plantation invoice (if any) is the
                billing document.
              </span>
            </div>

            <header className="plantation-invoice-doc-header">
              <div className="plantation-invoice-doc-logo">
                <img src={logoSrc} alt="Kenilworth International" />
              </div>
              <div className="plantation-invoice-doc-org">
                <strong>{statement.org_name}</strong>
                {orgLines.map((line, idx) => (
                  <span key={`org-addr-${idx}`} className="address-line">
                    {line}
                  </span>
                ))}
                {statement.telephone ? (
                  <span className="address-line">{statement.telephone}</span>
                ) : null}
                {statement.email ? <span className="address-line">{statement.email}</span> : null}
              </div>
            </header>

            <h1 className="plantation-invoice-doc-title estate-statement-title">Estate spraying statement</h1>

            <div className="plantation-invoice-doc-parties">
              <div>
                <h5>Plantation</h5>
                {statement.plantation_name ? (
                  <span className="plantation-invoice-party-name">{statement.plantation_name}</span>
                ) : null}
                {billToLines.map((line, idx) => (
                  <span key={`bill-${idx}-${line}`} className="address-line">
                    {line}
                  </span>
                ))}
              </div>
              <div>
                <h5>Estates (this statement)</h5>
                {estateNames.length ? (
                  estateNames.map((name) => (
                    <span key={name} className="address-line">
                      {name}
                    </span>
                  ))
                ) : shipToLines.length ? (
                  shipToLines.map((line, idx) => (
                    <span key={`ship-${idx}-${line}`} className="address-line">
                      {line}
                    </span>
                  ))
                ) : (
                  <span className="address-line">-</span>
                )}
              </div>
              <div className="plantation-invoice-doc-meta">
                <div className="plantation-invoice-meta-row">
                  <span className="plantation-invoice-meta-label">REF</span>
                  <span className="plantation-invoice-meta-value">
                    {statement.statement_ref || 'ESTATE-STMT'}
                  </span>
                </div>
                <div className="plantation-invoice-meta-row">
                  <span className="plantation-invoice-meta-label">DATE</span>
                  <span className="plantation-invoice-meta-value">
                    {formatDisplayDate(statement.statement_date)}
                  </span>
                </div>
                <div className="plantation-invoice-meta-row">
                  <span className="plantation-invoice-meta-label">PERIOD</span>
                  <span className="plantation-invoice-meta-value">
                    {formatDisplayDate(statement.period_start)} –{' '}
                    {formatDisplayDate(statement.period_end)}
                  </span>
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
                {(statement.line_items || []).map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="activity-name">{row.activity}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        {row.description}
                      </div>
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
                    This estate statement summarises sprayed / billed hectares for the selected estates.
                    It is issued for operational or plantation–estate information only. Payment, if any,
                    is against the plantation tax invoice only - not this document.
                  </p>
                </div>
                <div className="plantation-invoice-doc-summary-box">
                  <div>
                    <span>SUBTOTAL</span>
                    <span>{formatMoney(statement.subtotal)}</span>
                  </div>
                  {statement.tax_total != null && Number(statement.tax_total) > 0 ? (
                    <div>
                      <span>TAX (indicative)</span>
                      <span>{formatMoney(statement.tax_total)}</span>
                    </div>
                  ) : null}
                  <div className="summary-total-row">
                    <span>TOTAL (indicative)</span>
                    <span>{formatMoney(statement.total ?? statement.subtotal)}</span>
                  </div>
                  <div className="total-line">
                    <span>STATUS</span>
                    <span className="balance-due-amount" style={{ fontSize: 14 }}>
                      Not an invoice
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer className="plantation-invoice-doc-footer">
            Estate statement · not a tax invoice
          </footer>
        </article>
      </div>
    </div>
  );
}
