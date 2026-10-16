import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Bars } from 'react-loader-spinner';
import {
  FiCreditCard,
  FiEye,
  FiRefreshCw,
  FiPlus,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiCheckCircle,
  FiPaperclip,
} from 'react-icons/fi';
import {
  useListPlantationInvoicesQuery,
  useLazyGetPlantationInvoiceByIdQuery,
  useVoidPlantationInvoiceMutation,
  useListPlantationInvoicePaymentsQuery,
  useAddPlantationInvoicePaymentMutation,
  useVoidPlantationInvoicePaymentMutation,
} from '../../../api/services NodeJs/plantationInvoiceApi';
import { useLazyGetPlantationsListQuery } from '../../../api/services NodeJs/plantationDashboardApi';
import '../../../styles/plantationInvoice.css';
import '../../../styles/invoiceFlows.css';

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayDate = (d) => {
  if (!d) return '-';
  const text = String(d).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return text;
};

const extractListData = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
};

const METHOD_LABELS = {
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  cash: 'Cash',
};

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  reasonLabel = null,
  reasonDefault = '',
  reasonPlaceholder = '',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState(reasonDefault);

  useEffect(() => {
    if (open) setReason(reasonDefault || '');
  }, [open, reasonDefault]);

  if (!open) return null;

  return (
    <div className="plantation-invoice-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="plantation-invoice-modal inv-confirm-dialog"
        style={{ maxWidth: 440 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="plantation-invoice-modal-header">
          <h3 id="inv-confirm-title" style={{ margin: 0 }}>
            {title}
          </h3>
          <button
            type="button"
            className="plantation-invoice-modal-close"
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="plantation-invoice-modal-body">
          <p className="inv-confirm-message">{message}</p>
          {reasonLabel != null ? (
            <div className="inv-field" style={{ marginTop: 14 }}>
              <label htmlFor="inv-confirm-reason">{reasonLabel}</label>
              <input
                id="inv-confirm-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                autoFocus
              />
            </div>
          ) : null}
        </div>
        <footer className="plantation-invoice-modal-footer">
          <button
            type="button"
            className="inv-btn inv-btn--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inv-btn ${danger ? 'inv-btn--danger' : 'inv-btn--primary'}`}
            onClick={() => onConfirm(reasonLabel != null ? reason : undefined)}
            disabled={busy}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PaymentDrawer({ invoice, onClose, onInvoiceUpdated }) {
  const isCreditNote = String(invoice?.invoice_type) === 'credit_note';
  const creditAmount = Number(invoice?.credit_amount) || 0;
  const creditRemaining =
    invoice?.credit_remaining != null
      ? Number(invoice.credit_remaining)
      : Math.max(0, creditAmount - (Number(invoice?.amount_paid) || 0));
  const balanceDue = Number(invoice?.balance_due) || 0;
  const maxAmount = isCreditNote ? creditRemaining : balanceDue;

  const { data: payments = [], isLoading, refetch } = useListPlantationInvoicePaymentsQuery(invoice.id, {
    skip: !invoice?.id,
  });
  const [addPayment, { isLoading: saving }] = useAddPlantationInvoicePaymentMutation();
  const [voidPayment, { isLoading: voiding }] = useVoidPlantationInvoicePaymentMutation();

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [voidPaymentId, setVoidPaymentId] = useState(null);

  useEffect(() => {
    if (maxAmount > 0.009) {
      setAmount(String(maxAmount));
    } else {
      setAmount('');
    }
  }, [invoice?.id, maxAmount]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error(isCreditNote ? 'Enter a valid refund amount' : 'Enter a valid payment amount');
      return;
    }
    if (maxAmount > 0 && num > maxAmount + 0.009) {
      toast.error(
        isCreditNote
          ? `Refund cannot exceed remaining credit (LKR ${formatMoney(maxAmount)})`
          : `Payment cannot exceed balance due (LKR ${formatMoney(maxAmount)})`
      );
      return;
    }
    try {
      const result = await addPayment({
        invoiceId: invoice.id,
        amount: num,
        payment_date: paymentDate,
        payment_method: method,
        payment_reference: reference,
        payment_note: note,
        payment_receipt: receiptFile || undefined,
      }).unwrap();
      toast.success(isCreditNote ? 'Refund recorded' : 'Payment recorded');
      setReference('');
      setNote('');
      setReceiptFile(null);
      if (result?.invoice) onInvoiceUpdated?.(result.invoice);
      refetch();
    } catch (err) {
      toast.error(
        err?.data?.message ||
          err?.message ||
          (isCreditNote ? 'Failed to record refund' : 'Failed to record payment')
      );
    }
  };

  const confirmVoidPayment = async () => {
    if (!voidPaymentId) return;
    try {
      const result = await voidPayment(voidPaymentId).unwrap();
      toast.success(isCreditNote ? 'Refund voided' : 'Payment voided');
      setVoidPaymentId(null);
      if (result?.invoice) onInvoiceUpdated?.(result.invoice);
      refetch();
    } catch (err) {
      toast.error(
        err?.data?.message ||
          err?.message ||
          (isCreditNote ? 'Failed to void refund' : 'Failed to void payment')
      );
    }
  };

  const status = String(invoice.status || 'unpaid');
  const settled = maxAmount <= 0.009;
  const typeLabel =
    isCreditNote ? 'Credit note' : String(invoice.invoice_type) === 'pre' ? 'Pre-invoice' : 'Final invoice';
  const DirectionIcon = isCreditNote ? FiArrowDownLeft : FiArrowUpRight;

  return (
    <div className="plantation-invoice-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`plantation-invoice-modal inv-settle ${isCreditNote ? 'inv-settle--refund' : 'inv-settle--pay'}`}
        role="dialog"
        aria-modal="true"
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className="inv-settle-header">
          <div className="inv-settle-header-main">
            <div className={`inv-settle-direction ${isCreditNote ? 'inv-settle-direction--out' : 'inv-settle-direction--in'}`}>
              <DirectionIcon aria-hidden />
              <div>
                <strong>{isCreditNote ? 'We pay the plantation' : 'Plantation pays us'}</strong>
                <span>
                  {isCreditNote
                    ? 'Record refunds until the credit is settled'
                    : 'Record receipts until the balance is cleared'}
                </span>
              </div>
            </div>
            <div className="inv-settle-doc">
              <div className="inv-settle-doc-title">
                <h3>#{invoice.invoice_no}</h3>
                <span className={`inv-badge inv-badge--${isCreditNote ? 'credit' : String(invoice.invoice_type) === 'pre' ? 'pre' : 'post'}`}>
                  {typeLabel}
                </span>
                <span className={`inv-badge inv-badge--${status}`}>{status}</span>
              </div>
              <p>{invoice.plantation_name || 'Plantation'}</p>
            </div>
          </div>
          <button type="button" className="plantation-invoice-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="inv-settle-body">
          <div className="inv-settle-hero">
            <div className="inv-settle-hero-label">
              {isCreditNote ? 'Credit remaining' : 'Balance due'}
            </div>
            <div className="inv-settle-hero-value">
              LKR {formatMoney(isCreditNote ? creditRemaining : balanceDue)}
            </div>
            <div className="inv-settle-kpis">
              <div>
                <span>{isCreditNote ? 'Work total' : 'Invoice total'}</span>
                <strong>{formatMoney(invoice.total)}</strong>
              </div>
              {isCreditNote ? (
                <>
                  <div>
                    <span>Prepaid</span>
                    <strong>{formatMoney(invoice.prepaid_applied)}</strong>
                  </div>
                  <div>
                    <span>Credit</span>
                    <strong>{formatMoney(creditAmount)}</strong>
                  </div>
                  <div>
                    <span>Refunded</span>
                    <strong>{formatMoney(invoice.amount_paid)}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>Received</span>
                    <strong>{formatMoney(invoice.amount_paid)}</strong>
                  </div>
                  {Number(invoice.prepaid_applied) > 0 ? (
                    <div>
                      <span>Prepaid</span>
                      <strong>{formatMoney(invoice.prepaid_applied)}</strong>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="inv-settle-grid">
            <section className="inv-settle-panel">
              {settled ? (
                <div className="inv-settle-done">
                  <FiCheckCircle aria-hidden />
                  <div>
                    <strong>{isCreditNote ? 'Credit fully refunded' : 'Invoice fully paid'}</strong>
                    <p>
                      {isCreditNote
                        ? 'No further refunds are needed for this credit note.'
                        : 'No further payments are needed for this invoice.'}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="inv-settle-panel-head">
                    <h4>{isCreditNote ? 'New refund' : 'New payment'}</h4>
                    <p>Partial amounts are allowed. Max LKR {formatMoney(maxAmount)}.</p>
                  </div>
                  <form onSubmit={handleAdd} className="inv-settle-form">
                    <div className="inv-field inv-settle-amount">
                      <label htmlFor="pay-amount">
                        {isCreditNote ? 'Refund amount (LKR)' : 'Amount received (LKR)'}
                      </label>
                      <input
                        id="pay-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={maxAmount > 0 ? maxAmount : undefined}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="inv-settle-form-row">
                      <div className="inv-field">
                        <label htmlFor="pay-date">Date</label>
                        <input
                          id="pay-date"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="inv-field">
                        <label htmlFor="pay-method">Method</label>
                        <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                          <option value="bank_transfer">Bank transfer</option>
                          <option value="cheque">Cheque</option>
                          <option value="card">Card</option>
                          <option value="cash">Cash</option>
                        </select>
                      </div>
                    </div>
                    <div className="inv-field">
                      <label htmlFor="pay-ref">Reference</label>
                      <input
                        id="pay-ref"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Cheque / transfer no."
                      />
                    </div>
                    <div className="inv-field">
                      <label htmlFor="pay-note">Note</label>
                      <input
                        id="pay-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="inv-field">
                      <label htmlFor="pay-file">
                        <FiPaperclip aria-hidden style={{ marginRight: 4 }} />
                        Proof (image or PDF)
                      </label>
                      <input
                        id="pay-file"
                        className="inv-file-input"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      />
                      {receiptFile ? (
                        <small className="inv-settle-file-name">{receiptFile.name}</small>
                      ) : null}
                    </div>
                    <button
                      type="submit"
                      className={`inv-btn inv-settle-submit ${isCreditNote ? 'inv-settle-submit--refund' : ''}`}
                      disabled={saving}
                    >
                      <FiPlus />
                      {saving
                        ? 'Saving…'
                        : isCreditNote
                          ? 'Save refund'
                          : 'Save payment'}
                    </button>
                  </form>
                </>
              )}
            </section>

            <section className="inv-settle-panel inv-settle-panel--history">
              <div className="inv-settle-panel-head">
                <h4>{isCreditNote ? 'Refund history' : 'Payment history'}</h4>
                <p>
                  {payments.length
                    ? `${payments.length} record${payments.length === 1 ? '' : 's'}`
                    : 'Nothing recorded yet'}
                </p>
              </div>
              {isLoading ? (
                <div className="inv-loading" style={{ padding: '24px 0' }}>
                  <Bars height={32} width={32} color="#1d4ed8" ariaLabel="loading" />
                </div>
              ) : payments.length === 0 ? (
                <div className="inv-settle-history-empty">
                  {isCreditNote
                    ? 'Refunds you record will show here.'
                    : 'Payments you record will show here.'}
                </div>
              ) : (
                <ul className="inv-settle-history">
                  {payments.map((p) => (
                    <li key={p.id} className="inv-settle-history-item">
                      <div className="inv-settle-history-main">
                        <strong>LKR {formatMoney(p.amount)}</strong>
                        <span>{formatDisplayDate(p.payment_date)}</span>
                      </div>
                      <div className="inv-settle-history-meta">
                        <span>{METHOD_LABELS[p.payment_method] || p.payment_method || '-'}</span>
                        {p.payment_reference ? <span>{p.payment_reference}</span> : null}
                        {p.payment_receipt_image_url ? (
                          <a href={p.payment_receipt_image_url} target="_blank" rel="noreferrer">
                            Proof
                          </a>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="inv-btn inv-btn--ghost inv-btn--danger-ghost inv-settle-void"
                        disabled={voiding}
                        onClick={() => setVoidPaymentId(p.id)}
                      >
                        Void
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <ConfirmDialog
          open={voidPaymentId != null}
          title={isCreditNote ? 'Void refund' : 'Void payment'}
          message={
            isCreditNote
              ? 'Void this refund? It stays in history but is excluded from totals.'
              : 'Void this payment receipt? It stays in history but is excluded from totals.'
          }
          confirmLabel={isCreditNote ? 'Void refund' : 'Void payment'}
          danger
          busy={voiding}
          onCancel={() => setVoidPaymentId(null)}
          onConfirm={() => void confirmVoidPayment()}
        />
      </div>
    </div>
  );
}

const MONTH_OPTIONS = [
  { value: '', label: 'All months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function buildYearOptions(span = 6) {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= current - span; y -= 1) {
    years.push(y);
  }
  return years;
}

export default function PlantationInvoiceHistory({ onInvoicePreview }) {
  const [triggerPlantationsList] = useLazyGetPlantationsListQuery();
  const [plantations, setPlantations] = useState([]);
  const now = useMemo(() => new Date(), []);
  const [yearFilter, setYearFilter] = useState(() => String(now.getFullYear()));
  const [monthFilter, setMonthFilter] = useState(() => String(now.getMonth() + 1));
  const [plantationFilter, setPlantationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [loadInvoice, { isLoading: loadingOne }] = useLazyGetPlantationInvoiceByIdQuery();
  const [voidInvoice, { isLoading: voidingInvoice }] = useVoidPlantationInvoiceMutation();

  const yearOptions = useMemo(() => buildYearOptions(8), []);

  const { data: invoices = [], isLoading, isFetching, refetch } = useListPlantationInvoicesQuery(
    {
      year: yearFilter || undefined,
      month: monthFilter || undefined,
      plantation_id: plantationFilter || undefined,
      invoice_type: typeFilter || undefined,
      status: statusFilter || undefined,
      include_voided: showVoided ? 1 : undefined,
      limit: 200,
    },
    { skip: !yearFilter }
  );

  useEffect(() => {
    const load = async () => {
      try {
        const result = await triggerPlantationsList(undefined, true);
        setPlantations(extractListData(result?.data));
      } catch {
        setPlantations([]);
      }
    };
    load();
  }, [triggerPlantationsList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const hay = [
        inv.invoice_no,
        inv.plantation_name,
        inv.organization_name,
        inv.period_start,
        inv.period_end,
        inv.invoice_type,
        inv.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [invoices, search]);

  const openInvoice = async (id) => {
    try {
      const full = await loadInvoice(id).unwrap();
      onInvoicePreview?.(full);
    } catch {
      toast.error('Could not load invoice');
    }
  };

  const openPayments = async (row) => {
    if (Number(row.is_active) === 0) {
      toast.info('This invoice is voided. Payments cannot be added.');
      return;
    }
    try {
      const full = await loadInvoice(row.id).unwrap();
      setPaymentInvoice(full || row);
    } catch {
      setPaymentInvoice(row);
    }
  };

  const openVoidInvoice = (row) => {
    setVoidTarget(row);
  };

  const confirmVoidInvoice = async (reason) => {
    if (!voidTarget) return;
    try {
      await voidInvoice({
        id: voidTarget.id,
        reason: reason?.trim() || undefined,
      }).unwrap();
      toast.success(`Invoice #${voidTarget.invoice_no} voided`);
      setVoidTarget(null);
      refetch();
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to void invoice');
    }
  };

  const loading = isLoading || isFetching;

  return (
    <div className="inv-flow-page plantation-invoice-history">
      <div className="inv-panel inv-panel-pad" style={{ marginBottom: 14 }}>
        <div className="inv-toolbar">
          <div className="inv-toolbar-fields">
            <div className="inv-field inv-field--year">
              <label htmlFor="inv-history-year">Year</label>
              <select
                id="inv-history-year"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="inv-field inv-field--month">
              <label htmlFor="inv-history-month">Month</label>
              <select
                id="inv-history-month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value || 'all'} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="inv-field inv-field--plantation">
              <label htmlFor="inv-history-plantation">Plantation</label>
              <select
                id="inv-history-plantation"
                value={plantationFilter}
                onChange={(e) => setPlantationFilter(e.target.value)}
              >
                <option value="">All plantations</option>
                {plantations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plantation}
                  </option>
                ))}
              </select>
            </div>
            <div className="inv-field inv-field--type">
              <label htmlFor="inv-history-type">Type</label>
              <select
                id="inv-history-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All types</option>
                <option value="pre">Pre-invoice</option>
                <option value="post">Final invoice</option>
                <option value="credit_note">Credit note</option>
              </select>
            </div>
            <div className="inv-field inv-field--status">
              <label htmlFor="inv-history-status">Status</label>
              <select
                id="inv-history-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div className="inv-field inv-field--search">
              <label htmlFor="inv-history-search">Search</label>
              <input
                id="inv-history-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Invoice no…"
                autoComplete="off"
              />
            </div>
            <div className="inv-toggle-field">
              <span className="inv-toggle-label">Voided</span>
              <button
                type="button"
                role="switch"
                aria-checked={showVoided}
                aria-label="Show voided invoices"
                className={`inv-toggle${showVoided ? ' inv-toggle--on' : ''}`}
                onClick={() => setShowVoided((v) => !v)}
              >
                <span className="inv-toggle-thumb" />
              </button>
            </div>
          </div>
          <div className="inv-toolbar-actions">
            <button
              type="button"
              className="inv-btn inv-btn--secondary"
              onClick={() => refetch()}
              disabled={loading}
              title="Refresh"
            >
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="inv-loading">
          <Bars height={48} width={48} color="#1d4ed8" ariaLabel="loading" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="inv-empty">
          <div className="inv-empty-icon" aria-hidden>
            <FiCreditCard />
          </div>
          <strong>No invoices for this period</strong>
          <p>
            Try another year or month, or send a pre-invoice / final invoice first, then manage
            receipts here.
          </p>
        </div>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th className="inv-col-invoice">Inv</th>
                <th className="inv-col-type">Type</th>
                <th className="inv-col-status">Status</th>
                <th className="inv-col-plantation">Plantation</th>
                <th className="inv-col-date">Date</th>
                <th className="inv-col-period">Period</th>
                <th className="num inv-col-money">Total</th>
                <th className="num inv-col-money">Paid</th>
                <th className="num inv-col-money">Balance</th>
                <th className="inv-col-actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const type = String(row.invoice_type || 'post');
                const status = String(row.status || 'unpaid');
                const isVoided = Number(row.is_active) === 0;
                const typeLabel =
                  type === 'pre' ? 'Pre' : type === 'credit_note' ? 'Credit' : 'Final';
                const payLabel = type === 'credit_note' ? 'Refund' : 'Pay';
                return (
                  <tr key={row.id} style={isVoided ? { opacity: 0.65 } : undefined}>
                    <td className="inv-cell-invoice">#{row.invoice_no}</td>
                    <td>
                      <span
                        className={`inv-badge inv-badge--${
                          type === 'pre' ? 'pre' : type === 'credit_note' ? 'credit' : 'post'
                        }`}
                      >
                        {typeLabel}
                      </span>
                    </td>
                    <td>
                      {isVoided ? (
                        <span className="inv-badge inv-badge--voided">Void</span>
                      ) : (
                        <span className={`inv-badge inv-badge--${status}`}>{status}</span>
                      )}
                    </td>
                    <td className="inv-cell-plantation" title={row.plantation_name || ''}>
                      {row.plantation_name || '-'}
                    </td>
                    <td>{formatDisplayDate(row.invoice_date)}</td>
                    <td className="inv-cell-period">
                      {formatDisplayDate(row.period_start)}-{formatDisplayDate(row.period_end)}
                    </td>
                    <td className="num">{formatMoney(row.total)}</td>
                    <td className="num">{formatMoney(row.amount_paid)}</td>
                    <td className="num">
                      {type === 'credit_note' || Number(row.credit_amount) > 0
                        ? `CR ${formatMoney(
                            row.credit_remaining != null ? row.credit_remaining : row.credit_amount
                          )}`
                        : formatMoney(row.balance_due)}
                    </td>
                    <td>
                      <div className="inv-table-actions">
                        <button
                          type="button"
                          className="inv-btn inv-btn--ghost inv-btn--icon"
                          disabled={loadingOne}
                          onClick={() => openInvoice(row.id)}
                          title="View invoice"
                          aria-label="View invoice"
                        >
                          <FiEye />
                        </button>
                        {!isVoided ? (
                          <>
                            <button
                              type="button"
                              className="inv-btn inv-btn--ghost inv-btn--icon"
                              disabled={loadingOne}
                              onClick={() => void openPayments(row)}
                              title={
                                type === 'credit_note'
                                  ? 'Record refund we pay to the plantation'
                                  : 'Record payment received from the plantation'
                              }
                              aria-label={payLabel}
                            >
                              <FiCreditCard />
                            </button>
                            <button
                              type="button"
                              className="inv-btn inv-btn--ghost inv-btn--danger-ghost"
                              disabled={voidingInvoice}
                              onClick={() => openVoidInvoice(row)}
                              title="Void so a corrected invoice can be created"
                            >
                              Void
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {paymentInvoice ? (
        <PaymentDrawer
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onInvoiceUpdated={(inv) => {
            setPaymentInvoice(inv);
            refetch();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={voidTarget != null}
        title={`Void ${
          String(voidTarget?.invoice_type) === 'pre'
            ? 'pre-invoice'
            : String(voidTarget?.invoice_type) === 'credit_note'
              ? 'credit note'
              : 'final invoice'
        }`}
        message={`Void #${voidTarget?.invoice_no}? It stays in history, but you can create a corrected invoice for the same estates and period.`}
        reasonLabel="Reason (optional)"
        reasonDefault="Corrected plan / estate selection"
        reasonPlaceholder="Why is this invoice being voided?"
        confirmLabel="Void invoice"
        danger
        busy={voidingInvoice}
        onCancel={() => setVoidTarget(null)}
        onConfirm={(reason) => void confirmVoidInvoice(reason)}
      />
    </div>
  );
}
