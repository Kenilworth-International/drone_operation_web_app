import React, { useEffect } from 'react';
import { FaTimes, FaPrint } from 'react-icons/fa';

function fmtLkr(value) {
  return `LKR ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function PurchaseOrderVoucherPrint({ voucher, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!voucher) return null;
  const lines = voucher.lines || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="pov-print-overlay" role="presentation" onClick={onClose}>
      <div className="pov-print-sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="pov-print-toolbar no-print">
          <button type="button" onClick={handlePrint}>
            <FaPrint /> Print
          </button>
          <button type="button" onClick={onClose}>
            <FaTimes /> Close
          </button>
        </div>

        <div className="pov-print-body">
          <header>
            <h1>Purchase Order Payment Voucher</h1>
            <div className="pov-print-meta">
              <div>
                <strong>{voucher.voucher_no}</strong>
              </div>
              <div>Status: {voucher.status}</div>
              <div>Created: {formatDate(voucher.created_at)}</div>
              <div>Prepared by: {voucher.checked_by_name || voucher.created_by_name || '-'}</div>
              {voucher.approved_by_display ? (
                <div>Approved by: {voucher.approved_by_display}</div>
              ) : null}
            </div>
          </header>

          <table>
            <thead>
              <tr>
                <th>PO No</th>
                <th>Supplier</th>
                <th>PO status</th>
                <th>Issued</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.line_id || line.purchase_order_id}>
                  <td>{line.po_no}</td>
                  <td>
                    {line.supplier_name || '-'}
                    {line.supplier_code ? ` (${line.supplier_code})` : ''}
                  </td>
                  <td>{line.po_status}</td>
                  <td>{formatDate(line.po_issued_at)}</td>
                  <td className="num">{fmtLkr(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>
                  Total ({lines.length} PO{lines.length === 1 ? '' : 's'})
                </td>
                <td className="num">{fmtLkr(voucher.total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          {voucher.decline_reason ? (
            <p className="pov-print-note">Decline reason: {voucher.decline_reason}</p>
          ) : null}
          {voucher.payment_status === 'paid' ? (
            <p className="pov-print-note">
              Paid via {voucher.payment_method || '-'}
              {voucher.payment_reference ? ` · Ref ${voucher.payment_reference}` : ''}
              {voucher.paid_at ? ` · ${formatDate(voucher.paid_at)}` : ''}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
