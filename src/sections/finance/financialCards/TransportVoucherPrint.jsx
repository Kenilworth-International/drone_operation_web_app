import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import '../../../styles/plantationInvoice.css';
import { downloadTransportVoucherPdf } from './transportVoucherPdfExport';
import { formatFuelMoney, getFuelLineDisplayParts } from './fuelVoucherDescription';
import {
  formatVoucherDisplayDate,
  getFuelVoucherLabels,
  hasVoucherApprovalInfo,
  resolveVoucherApprovalType,
  resolveVoucherApprovedBy,
  resolveVoucherDriverName,
  resolveVoucherCardNumber,
  resolveVoucherCardsSummary,
} from './transportVoucherPrintUtils';

const VOUCHER_ORG = {
  org_name: 'Kenilworth International Lanka (Pvt) Ltd',
  email: 'finance@kenilworthinternational.com',
};

const TransportVoucherPrint = ({ voucher, onClose, onPrint }) => {
  const [pdfLoading, setPdfLoading] = useState(false);
  const labels = getFuelVoucherLabels(voucher);
  const lines = useMemo(() => voucher?.lines || [], [voucher?.lines]);
  const cardsSummary = useMemo(() => resolveVoucherCardsSummary(voucher), [voucher]);
  const txCount = voucher?.transaction_count || lines.length || 0;
  const approvedBy = resolveVoucherApprovedBy(voucher);
  const approvalType = resolveVoucherApprovalType(voucher);
  const isDeclined = voucher?.status === 'declined';
  const showApproval = hasVoucherApprovalInfo(voucher);
  const checkedBy = voucher?.checked_by_name || voucher?.created_by_name || 'Finance';
  const logoSrc = `${process.env.PUBLIC_URL || ''}/assets/images/kenilowrthlogoDark.png`;

  const handleDownloadPdf = async () => {
    if (!voucher) return;
    setPdfLoading(true);
    try {
      downloadTransportVoucherPdf(voucher);
      toast.success('PDF downloaded');
    } catch (error) {
      console.error(error);
      toast.error('Failed to download PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    if (typeof onPrint === 'function') {
      onPrint();
      return;
    }
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
        aria-label={`${labels.title} preview`}
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
              onClick={() => void handleDownloadPdf()}
            >
              {pdfLoading ? 'Creating PDF…' : 'Create PDF'}
            </button>
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
                {VOUCHER_ORG.email ? (
                  <span className="address-line">{VOUCHER_ORG.email}</span>
                ) : null}
              </div>
            </header>

            <h1 className="plantation-invoice-doc-title fuel-transport-voucher-doc-title">
              {labels.title}
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
                    {approvalType ? (
                      <span className="plantation-invoice-party-name">{approvalType}</span>
                    ) : null}
                    {approvedBy ? <span className="address-line">{approvedBy}</span> : null}
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
                  <span className="plantation-invoice-meta-value">
                    {formatVoucherDisplayDate(voucher?.created_at)}
                  </span>
                </div>
                <div className="plantation-invoice-meta-row">
                  <span className="plantation-invoice-meta-label">TXNS</span>
                  <span className="plantation-invoice-meta-value">{txCount}</span>
                </div>
              </div>
            </div>

            {cardsSummary.length > 0 ? (
              <div className="fuel-transport-voucher-cards-summary">
                <strong>Cards to top up ({cardsSummary.length})</strong>
                <ul>
                  {cardsSummary.map((card) => (
                    <li key={card.card_id || card.card_number}>
                      <span className="fuel-transport-voucher-card-no">{card.card_number || '—'}</span>
                      {card.card_holder ? <span className="fuel-transport-voucher-card-holder">{card.card_holder}</span> : null}
                      <span>
                        {card.transaction_count} tx · LKR {formatFuelMoney(card.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <table className="plantation-invoice-doc-table fuel-transport-voucher-doc-table">
              <thead>
                <tr>
                  <th>{labels.personHeader}</th>
                  <th>CARD NO</th>
                  <th>FUEL DATE</th>
                  <th>LITERS</th>
                  <th>AMOUNT</th>
                  <th>ADMIN APPROVER</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const parts = getFuelLineDisplayParts(line);
                  return (
                    <tr key={line.line_id || line.transaction_id}>
                      <td>
                        <div className="activity-name">{resolveVoucherDriverName(line)}</div>
                      </td>
                      <td>
                        <div className="activity-name">{resolveVoucherCardNumber(line)}</div>
                        {line.card_holder ? (
                          <div className="fuel-transport-voucher-card-holder-sub">{line.card_holder}</div>
                        ) : null}
                      </td>
                      <td>{parts.fuelDate}</td>
                      <td>{parts.liters}</td>
                      <td>{parts.amount}</td>
                      <td>{line.approved_by_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="plantation-invoice-doc-bottom">
              <div className="plantation-invoice-doc-bottom-row">
                <div className="plantation-invoice-payment-notice">
                  <p>{labels.notice}</p>
                </div>
                <div className="plantation-invoice-doc-summary-box">
                  <div>
                    <span>TRANSACTIONS</span>
                    <span>{txCount}</span>
                  </div>
                  <div className="total-line">
                    <span>TOTAL AMOUNT</span>
                    <span className="balance-due-amount">
                      LKR {formatFuelMoney(voucher?.total_amount)}
                    </span>
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
                  <span className="fuel-transport-voucher-signature-label">
                    {isDeclined ? 'Declined By' : 'Approved By'}
                  </span>
                  <span className="fuel-transport-voucher-signature-name">{approvedBy || ''}</span>
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
            DSMS Finance Settlement Document
          </footer>
        </article>
      </div>
    </div>
  );
};

export default TransportVoucherPrint;
