/**
 * MaintenanceVoucherPrint.jsx
 *
 * Print / preview overlay for a maintenance voucher.
 * Adapts TransportVoucherPrint patterns for maintenance line fields.
 */

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { voucherStatusLabel } from '../financialCards/fuelTransportVoucherUi';
import '../../../styles/plantationInvoice.css';

const VOUCHER_ORG = {
  org_name: 'Kenilworth International Lanka (Pvt) Ltd',
  email:    'finance@kenilworthinternational.com',
};

function toDateOnly(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text || '-';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function formatLkr(value) {
  return `LKR ${Number(value || 0).toFixed(2)}`;
}

function getApprovedBy(voucher) {
  if (!voucher) return '-';
  return (
    voucher.approved_by_display ||
    voucher.physical_approved_by_name ||
    voucher.approved_by_name ||
    '-'
  );
}

function getApprovalType(voucher) {
  const mode = String(voucher?.approval_mode || '').toLowerCase();
  if (mode === 'system') return 'System (MD)';
  if (mode === 'print')  return 'Physical';
  return null;
}

function MaintenanceVoucherPrint({ voucher, onClose }) {
  const [printing, setPrinting] = useState(false);
  const lines       = voucher?.lines || [];
  const txCount     = voucher?.transaction_count || lines.length || 0;
  const approvedBy  = getApprovedBy(voucher);
  const approvalType = getApprovalType(voucher);
  const isDeclined  = voucher?.status === 'declined';
  const checkedBy   = voucher?.checked_by_name || voucher?.created_by_name || 'Finance';
  const logoSrc     = `${process.env.PUBLIC_URL || ''}/assets/images/kenilowrthlogoDark.png`;
  const showApproval = voucher && ['approved', 'declined'].includes(voucher.status);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="plantation-invoice-print-overlay plantation-invoice-preview-popup fuel-transport-voucher-print-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="plantation-invoice-preview-shell"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Maintenance voucher preview"
      >
        <div className="plantation-invoice-print-toolbar">
          <button type="button" className="plantation-invoice-btn plantation-invoice-btn-secondary" onClick={onClose}>
            Back
          </button>
          <div className="plantation-invoice-print-toolbar-actions">
            <button
              type="button"
              className="plantation-invoice-btn plantation-invoice-btn-primary"
              onClick={handlePrint}
            >
              Print
            </button>
            <button type="button" className="plantation-invoice-btn plantation-invoice-btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <article className="plantation-invoice-document fuel-transport-voucher-document">
          <div className="plantation-invoice-doc-main">
            <header className="plantation-invoice-doc-header">
              <div className="plantation-invoice-doc-logo">
                <img src={logoSrc} alt="Kenilworth International" />
              </div>
              <div className="plantation-invoice-doc-org">
                <strong>{VOUCHER_ORG.org_name}</strong>
                {VOUCHER_ORG.email ? <span className="address-line">{VOUCHER_ORG.email}</span> : null}
              </div>
            </header>

            <h1 className="plantation-invoice-doc-title fuel-transport-voucher-doc-title">
              Maintenance Payment Voucher
            </h1>

            <div className="plantation-invoice-doc-parties fuel-transport-voucher-doc-parties">
              <div>
                <h5>Prepared By</h5>
                <span className="plantation-invoice-party-name">{checkedBy}</span>
                <span className="address-line">Finance Settlement</span>
              </div>
              <div>
                {showApproval ? (
                  <>
                    <h5>Approval</h5>
                    {approvalType ? <span className="plantation-invoice-party-name">{approvalType}</span> : null}
                    {approvedBy && approvedBy !== '-' ? <span className="address-line">{approvedBy}</span> : null}
                    {isDeclined && voucher?.decline_reason ? (
                      <span className="address-line fuel-transport-voucher-decline-reason">
                        Reason: {voucher.decline_reason}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="plantation-invoice-doc-meta fuel-transport-voucher-doc-meta">
                <div className="plantation-invoice-meta-row">
                  <span className="plantation-invoice-meta-label">VOUCHER</span>
                  <span className="plantation-invoice-meta-value">{voucher?.voucher_no || '—'}</span>
                </div>
                <div className="plantation-invoice-meta-row">
                  <span className="plantation-invoice-meta-label">DATE</span>
                  <span className="plantation-invoice-meta-value">{toDateOnly(voucher?.created_at)}</span>
                </div>
                <div className="plantation-invoice-meta-row">
                  <span className="plantation-invoice-meta-label">ITEMS</span>
                  <span className="plantation-invoice-meta-value">{txCount}</span>
                </div>
              </div>
            </div>

            <table className="plantation-invoice-doc-table fuel-transport-voucher-doc-table">
              <thead>
                <tr>
                  <th>VEHICLE</th>
                  <th>DRIVER</th>
                  <th>DATE</th>
                  <th>CATEGORY</th>
                  <th>DESCRIPTION</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.line_id || line.maintenance_request_id}>
                    <td>{line.vehicle_no || '-'}</td>
                    <td>{line.driver_name || '-'}</td>
                    <td>{toDateOnly(line.date)}</td>
                    <td>{line.category_name || '-'}</td>
                    <td>{String(line.description || '').trim() || '-'}</td>
                    <td>{line.amount != null ? formatLkr(line.amount) : (line.cost_estimation != null ? formatLkr(line.cost_estimation) : '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="plantation-invoice-doc-bottom">
              <div className="plantation-invoice-doc-bottom-row">
                <div className="plantation-invoice-payment-notice">
                  <p>
                    This maintenance payment voucher authorises settlement for vehicle maintenance
                    requests approved by HR and Finance. Settlement proof must be uploaded when settling.
                  </p>
                </div>
                <div className="plantation-invoice-doc-summary-box">
                  <div>
                    <span>ITEMS</span>
                    <span>{txCount}</span>
                  </div>
                  <div className="total-line">
                    <span>TOTAL AMOUNT</span>
                    <span className="balance-due-amount">{formatLkr(voucher?.total_amount)}</span>
                  </div>
                </div>
              </div>

              <section className="fuel-transport-voucher-signatures">
                <div className="fuel-transport-voucher-signature-block">
                  <span className="fuel-transport-voucher-signature-label">Checked By</span>
                  <span className="fuel-transport-voucher-signature-name">{checkedBy}</span>
                  <span className="fuel-transport-voucher-signature-line" />
                </div>
                <div className="fuel-transport-voucher-signature-block">
                  <span className="fuel-transport-voucher-signature-label">{isDeclined ? 'Declined By' : 'Approved By'}</span>
                  <span className="fuel-transport-voucher-signature-name">{approvedBy !== '-' ? approvedBy : ''}</span>
                  <span className="fuel-transport-voucher-signature-line" />
                </div>
              </section>
            </div>
          </div>

          {voucher?.notes ? (
            <div className="fuel-transport-voucher-notes">
              <strong>Notes:</strong> {voucher.notes}
            </div>
          ) : null}

          <footer className="plantation-invoice-doc-footer">
            DSMS Finance Settlement Document — Maintenance
          </footer>
        </article>
      </div>
    </div>
  );
}

export default MaintenanceVoucherPrint;
