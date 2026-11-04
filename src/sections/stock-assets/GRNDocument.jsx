import React from 'react';
import { COMPANY } from '../../config/companyConstants';

/**
 * Printable Goods Received Note (GRN) with full layout.
 * Use with window.print() or "Print" → "Save as PDF".
 */
export default function GRNDocument({ grn }) {
  if (!grn) return null;
  const items = grn.items || [];
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
  const formatDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  const grnDate = formatDate(grn.received_date || grn.created_at);
  const poDate = formatDate(grn.po_date);
  const receiptDateTime = formatDateTime(grn.receipt_datetime || grn.created_at);

  return (
    <div className="grn-document" style={{ fontFamily: 'Arial, sans-serif', maxWidth: 800, margin: '0 auto', padding: 24 }}>
      {/* Company Header */}
      <div style={{ marginBottom: 20 }}>
        <img src={COMPANY.logoPath} alt={COMPANY.name} style={{ maxHeight: 50, marginBottom: 6 }} />
        <div style={{ fontWeight: 'bold', fontSize: 15 }}>{COMPANY.name}</div>
        <div>{COMPANY.address}</div>
        <div>{COMPANY.city}</div>
        {COMPANY.postalCode && <div>Postal: {COMPANY.postalCode}</div>}
        {(COMPANY.phone || COMPANY.email) && (
          <div>{[COMPANY.phone, COMPANY.email].filter(Boolean).join(' / ')}</div>
        )}
      </div>

      {/* GRN Title */}
      <h1 style={{ textAlign: 'center', color: '#1a5276', fontSize: 22, marginBottom: 16 }}>
        GOODS RECEIVED NOTE
      </h1>

      {/* GRN No, Date, Received at */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <div><strong>GRN No.:</strong> {grn.grn_no || '-'}</div>
        <div><strong>Date:</strong> {grnDate}</div>
        <div><strong>Received at:</strong> {grn.received_at_location || '________________'}</div>
      </div>

      {/* Supplier Details */}
      <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 4 }}>
        <strong>Supplier Details</strong>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><strong>Supplier Name:</strong> {grn.supplier_name || '________________'}</div>
          <div><strong>Supplier Address:</strong> {grn.supplier_address || '________________'}</div>
          <div><strong>Supplier Invoice No.:</strong> {grn.supplier_invoice_no || '________________'}</div>
          <div><strong>Supplier Invoice Date:</strong> {formatDate(grn.supplier_invoice_date) || '________________'}</div>
          <div><strong>Purchase Order (PO) No.:</strong> {grn.po_no || '________________'}</div>
          <div><strong>PO Date:</strong> {poDate || '________________'}</div>
          <div><strong>Delivery Note / Waybill No.:</strong> {grn.delivery_note_waybill_no || '________________'}</div>
          <div><strong>Vehicle No. / Transport:</strong> {grn.vehicle_no_transport || '________________'}</div>
        </div>
      </div>

      {/* Delivery Details */}
      <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 4 }}>
        <strong>Delivery Details</strong>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div><strong>Received by:</strong> {grn.received_by_name || '________________'} {grn.received_by_designation && `(${grn.received_by_designation})`}</div>
          <div><strong>Date & Time of Receipt:</strong> {receiptDateTime || '________________'}</div>
          <div><strong>Delivery Inspected by:</strong> {grn.inspected_by_name || '________________'}</div>
        </div>
      </div>

      {/* Items Table */}
      <table width="100%" style={{ borderCollapse: 'collapse', marginBottom: 16, fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: '#e8e8e8' }}>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'center' }}>S.No</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'left' }}>Item Description</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'left' }}>Item Code / SKU</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'center' }}>Unit</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>Qty Ordered</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>Qty Received</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>Qty Accepted</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>Short / Excess</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>Unit Price</th>
            <th style={{ border: '1px solid #ccc', padding: 6, textAlign: 'left' }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const qtyOrdered = Number(item.qty_ordered) || 0;
            const qtyReceived = Number(item.received_qty) || 0;
            const rejected = Number(item.rejected_qty) || 0;
            const damaged = Number(item.damaged_qty) || 0;
            const qtyAccepted = Math.max(0, qtyReceived - rejected - damaged);
            const shortExcess = qtyReceived - qtyOrdered;
            const unitPrice = Number(item.unit_price) || 0;
            return (
              <tr key={item.id}>
                <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #ccc', padding: 6 }}>{item.item_name || '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: 6 }}>{item.item_code || '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'center' }}>{item.unit || '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>{qtyOrdered}</td>
                <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>{qtyReceived}</td>
                <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>{qtyAccepted}</td>
                <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>{shortExcess !== 0 ? shortExcess : '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>{unitPrice.toFixed(2)}</td>
                <td style={{ border: '1px solid #ccc', padding: 6 }}>{item.remarks_condition_damage || '-'}</td>
              </tr>
            );
          })}
          <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
            <td colSpan={4} style={{ border: '1px solid #ccc', padding: 6 }}>Total</td>
            <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>
              {items.reduce((s, i) => s + (Number(i.qty_ordered) || 0), 0)}
            </td>
            <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>
              {items.reduce((s, i) => s + (Number(i.received_qty) || 0), 0)}
            </td>
            <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>
              {items.reduce((s, i) => {
                const r = Number(i.received_qty) || 0;
                const rej = Number(i.rejected_qty) || 0;
                const dam = Number(i.damaged_qty) || 0;
                return s + Math.max(0, r - rej - dam);
              }, 0)}
            </td>
            <td colSpan={3} style={{ border: '1px solid #ccc', padding: 6 }} />
          </tr>
        </tbody>
      </table>

      {/* Inspection Summary */}
      <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 4 }}>
        <strong>Inspection Summary</strong>
        <div style={{ marginTop: 8 }}>
          <div>Goods received in {grn.inspection_condition === 'with_discrepancies' ? 'with discrepancies' : 'good condition'}</div>
          {grn.discrepancies_notes && <div style={{ marginTop: 4 }}><strong>Discrepancies / Damages / Rejections:</strong> {grn.discrepancies_notes}</div>}
          {grn.shortage_excess_notes && <div style={{ marginTop: 4 }}><strong>Shortage / Excess explanation:</strong> {grn.shortage_excess_notes}</div>}
        </div>
      </div>

      {/* Certification */}
      <div style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
        <div style={{ marginBottom: 8, fontStyle: 'italic' }}>
          We certify that the above goods have been received, inspected, and found to be as per the purchase order / delivery challan except as noted above.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <div>
            <strong>Received & Verified by:</strong>
            <div>Name: {grn.verified_by_name || '________________'}</div>
            <div>Signature: ________________</div>
            <div>Date: {formatDate(grn.verified_by_date) || '________________'}</div>
          </div>
          <div>
            <strong>Approved by (Store / Warehouse In-charge):</strong>
            <div>Name: {grn.approved_by_name || '________________'}</div>
            <div>Signature: ________________</div>
            <div>Date: {formatDate(grn.approved_by_date) || '________________'}</div>
          </div>
        </div>
      </div>

      {/* Accounts / Purchase Department Use Only */}
      <div style={{ marginTop: 20, padding: 12, backgroundColor: '#fff5e6', borderRadius: 4, fontSize: 12 }}>
        <strong>Accounts / Purchase Department Use Only</strong>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>GRN Entered in System: {grn.id ? 'Yes' : 'No'}</div>
          <div>Posted to Inventory: {grn.status === 'posted' ? 'Yes' : 'No'}</div>
          <div><strong>Remarks:</strong> {grn.accounts_remarks || '________________'}</div>
          <div>Signature: ________________ Date: {formatDate(grn.accounts_date) || '________________'}</div>
        </div>
      </div>

      {grn.notes && (
        <div style={{ marginTop: 16 }}>
          <strong>Additional Notes:</strong>
          <div style={{ marginTop: 4 }}>{grn.notes}</div>
        </div>
      )}
    </div>
  );
}
