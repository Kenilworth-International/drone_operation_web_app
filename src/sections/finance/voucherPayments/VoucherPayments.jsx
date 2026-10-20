import React, { useMemo, useState } from 'react';
import { FaPrint, FaCheckCircle, FaSyncAlt, FaFileInvoice } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  useGetVoucherPaymentsQuery,
  useLazyGetVoucherPaymentDetailQuery,
  useMarkVoucherPaidMutation,
} from '../../../api/services NodeJs/voucherPaymentsApi';
import { useGetMyPermissionsQuery } from '../../../api/services NodeJs/featurePermissionsApi';
import TransportVoucherPrint from '../financialCards/TransportVoucherPrint';
import {
  isGeneratorFuelVoucher,
  resolveVoucherCardsSummary,
} from '../financialCards/transportVoucherPrintUtils';
import { isPdfProofUrl } from '../financialCards/fuelTransportVoucherUi';
import { FEATURE_CODES } from '../../../utils/featurePermissions';
import { isInternalDeveloper } from '../../../utils/authUtils';
import '../../../styles/voucherPayments.css';

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const RECEIPT_MAX_LABEL = '10 MB';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cheque', label: 'Cheque', referenceLabel: 'Cheque no', allowsReceipt: false },
  { value: 'card', label: 'Card', referenceLabel: 'Card receipt / approval no', allowsReceipt: true },
  { value: 'bank_transfer', label: 'Transfer', referenceLabel: 'Transfer reference', allowsReceipt: true },
  { value: 'cash', label: 'Cash', referenceLabel: 'Receipt no', allowsReceipt: false },
];

const EMPTY_PAY_FORM = { method: 'cheque', reference: '', note: '', receipt: null };

const fileToDataUri = (file) =>
  new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const formatMoney = (value) =>
  `LKR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateShort = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
};

const shortCardNo = (value) => {
  const text = String(value || '').replace(/\s+/g, '');
  if (!text) return '-';
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 4) return `****${digits.slice(-4)}`;
  return text.length > 8 ? `…${text.slice(-4)}` : text;
};

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const recentMonthOptions = (count = 18) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' }),
    };
  });
};

const VoucherPayments = () => {
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const userId = userData?.id || null;
  const isDeveloper = isInternalDeveloper(userData);
  const { data: featurePermissionsData = {} } = useGetMyPermissionsQuery(undefined, { skip: !userId });

  const checkFeatureAccess = (featureCode) => {
    if (isDeveloper) return true;
    if (!featurePermissionsData || typeof featurePermissionsData !== 'object') return false;
    if (featurePermissionsData.features && featurePermissionsData.features[featureCode] === true) {
      return true;
    }
    const categories = featurePermissionsData.categories || featurePermissionsData;
    for (const category in categories) {
      if (category === 'paths' || category === 'features') continue;
      const categoryData = categories[category];
      if (Array.isArray(categoryData) && categoryData.includes(featureCode)) {
        return true;
      }
    }
    return false;
  };
  const canMarkPaid = checkFeatureAccess(FEATURE_CODES.FINANCIAL_CARDS_SETTLE_FUEL_BILL);

  const [voucherType, setVoucherType] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [month, setMonth] = useState('');
  const [search, setSearch] = useState('');
  const [payVoucher, setPayVoucher] = useState(null);
  const [payForm, setPayForm] = useState(EMPTY_PAY_FORM);
  const [loadingPayDetail, setLoadingPayDetail] = useState(false);
  const [printVoucher, setPrintVoucher] = useState(null);
  const [loadingPrintId, setLoadingPrintId] = useState(null);

  const monthOptions = useMemo(() => recentMonthOptions(), []);

  const {
    data: paymentsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetVoucherPaymentsQuery({ voucherType, paymentStatus, month });
  const [fetchVoucherDetail] = useLazyGetVoucherPaymentDetailQuery();
  const [markVoucherPaid, { isLoading: markingPaid }] = useMarkVoucherPaidMutation();

  const vouchers = useMemo(() => paymentsData?.vouchers || [], [paymentsData]);
  const paymentColumnsReady = paymentsData?.payment_columns_ready !== false;

  const filteredVouchers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter(
      (v) =>
        v.voucher_no?.toLowerCase().includes(q) ||
        v.approved_by_name?.toLowerCase().includes(q) ||
        v.payment_reference?.toLowerCase().includes(q) ||
        String(v.total_amount || '').includes(q)
    );
  }, [vouchers, search]);

  const totals = useMemo(() => {
    const pending = filteredVouchers.filter((v) => v.payment_status !== 'paid');
    const paid = filteredVouchers.filter((v) => v.payment_status === 'paid');
    const sum = (rows) => rows.reduce((acc, v) => acc + (Number(v.total_amount) || 0), 0);
    return {
      pendingCount: pending.length,
      pendingAmount: sum(pending),
      paidCount: paid.length,
      paidAmount: sum(paid),
    };
  }, [filteredVouchers]);

  const selectedMethod =
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === payForm.method) || PAYMENT_METHOD_OPTIONS[0];

  const openPayModal = async (voucher) => {
    setPayForm(EMPTY_PAY_FORM);
    setPayVoucher(voucher);
    if (Array.isArray(voucher?.cards_summary) && voucher.cards_summary.length) return;
    setLoadingPayDetail(true);
    try {
      const detail = await fetchVoucherDetail(voucher.id).unwrap();
      setPayVoucher((prev) => (prev?.id === voucher.id ? { ...prev, ...detail } : prev));
    } catch (_) {
      /* list row still usable; cards may be missing until backend deploy */
    } finally {
      setLoadingPayDetail(false);
    }
  };

  const closePayModal = () => {
    if (markingPaid) return;
    setPayVoucher(null);
    setPayForm(EMPTY_PAY_FORM);
    setLoadingPayDetail(false);
  };

  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > RECEIPT_MAX_BYTES) {
      toast.error(`File is too large. Maximum size is ${RECEIPT_MAX_LABEL}.`);
      e.target.value = '';
      return;
    }
    setPayForm((prev) => ({ ...prev, receipt: file }));
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!payVoucher?.id) return;
    if (!canMarkPaid) {
      toast.error('Access denied. Ask ICT to enable Settle fuel bill under Auth Controls → Features.');
      return;
    }
    try {
      const receiptDataUri = selectedMethod.allowsReceipt ? await fileToDataUri(payForm.receipt) : null;
      await markVoucherPaid({
        id: payVoucher.id,
        payment_method: payForm.method,
        payment_reference: payForm.reference.trim() || null,
        payment_note: payForm.note.trim() || null,
        payment_receipt_image: receiptDataUri,
      }).unwrap();
      toast.success(`${payVoucher.voucher_no} marked as paid`);
      setPayVoucher(null);
      setPayForm(EMPTY_PAY_FORM);
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to mark voucher as paid');
    }
  };

  const handlePrint = async (voucher) => {
    setLoadingPrintId(voucher.id);
    try {
      const detail = await fetchVoucherDetail(voucher.id).unwrap();
      setPrintVoucher({ ...voucher, ...detail });
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to load voucher');
    } finally {
      setLoadingPrintId(null);
    }
  };

  const openReceipt = (url) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const payCards = payVoucher ? resolveVoucherCardsSummary(payVoucher) : [];
  const payIsGenerator = payVoucher ? isGeneratorFuelVoucher(payVoucher) : false;
  const payAlreadySettled = payVoucher ? Number(payVoucher.settled) === 1 : false;

  return (
    <div className="voucher-payments-page">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="voucher-payments-top">
        <div className="voucher-payments-title-block">
          <h2>
            <FaFileInvoice aria-hidden /> Voucher Payments
          </h2>
          <p>Mark approved fuel vouchers as paid to settle cards.</p>
        </div>
        <div className="voucher-payments-summary">
          <div className="voucher-payments-summary-card pending">
            <span>Pending</span>
            <strong>{totals.pendingCount}</strong>
            <small>{formatMoney(totals.pendingAmount)}</small>
          </div>
          <div className="voucher-payments-summary-card paid">
            <span>Paid</span>
            <strong>{totals.paidCount}</strong>
            <small>{formatMoney(totals.paidAmount)}</small>
          </div>
        </div>
        <button
          type="button"
          className="voucher-payments-btn-secondary"
          onClick={refetch}
          disabled={isFetching}
          title="Refresh"
        >
          <FaSyncAlt className={isFetching ? 'voucher-payments-spin' : ''} /> Refresh
        </button>
      </div>

      {!paymentColumnsReady ? (
        <div className="voucher-payments-warning">
          Payment columns are not on the database yet. Run <code>sql/20261014_voucher_payments.sql</code> before
          marking vouchers as paid. Status below is based on settlement only.
        </div>
      ) : null}

      <div className="voucher-payments-filters">
        <div className="voucher-payments-filter">
          <label htmlFor="vp-search">Search</label>
          <input
            id="vp-search"
            type="search"
            placeholder="Voucher no, approver…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="voucher-payments-search"
            autoComplete="off"
          />
        </div>
        <div className="voucher-payments-filter">
          <label htmlFor="vp-type">Type</label>
          <select
            id="vp-type"
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="transport">Transport</option>
            <option value="generator">Generator</option>
          </select>
        </div>
        <div className="voucher-payments-filter">
          <label htmlFor="vp-status">Status</label>
          <select
            id="vp-status"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="voucher-payments-filter">
          <label htmlFor="vp-month">Month</label>
          <select
            id="vp-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            title="Month the voucher was approved"
          >
            <option value="">All months</option>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.value === currentMonthKey() ? ' (this month)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="voucher-payments-table-wrap">
        <table className="voucher-payments-table">
          <thead>
            <tr>
              <th className="vp-col-voucher">Voucher</th>
              <th className="vp-col-type">Type</th>
              <th className="vp-col-approved">Approved</th>
              <th className="vp-col-cards">Cards</th>
              <th className="num vp-col-amount">Amount</th>
              <th className="vp-col-status">Status</th>
              <th className="vp-col-details">Payment details</th>
              <th className="vp-col-actions" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="voucher-payments-empty">Loading vouchers...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="voucher-payments-empty error">
                  {error?.data?.message || 'Failed to load vouchers'}
                </td>
              </tr>
            ) : filteredVouchers.length === 0 ? (
              <tr>
                <td colSpan={8} className="voucher-payments-empty">No approved vouchers match these filters</td>
              </tr>
            ) : (
              filteredVouchers.map((voucher) => {
                const isPaid = voucher.payment_status === 'paid';
                const isGenerator = isGeneratorFuelVoucher(voucher);
                const cards = resolveVoucherCardsSummary(voucher);
                const visibleCards = cards.slice(0, 2);
                const extraCards = Math.max(0, cards.length - visibleCards.length);
                const cardsTitle = cards
                  .map(
                    (c) =>
                      `${c.card_number || '-'} ${c.card_holder || ''} · ${c.transaction_count} tx · ${formatMoney(c.amount)}`
                  )
                  .join('\n');
                return (
                  <tr key={voucher.id}>
                    <td className="voucher-no" title={voucher.voucher_no}>
                      {voucher.voucher_no}
                    </td>
                    <td>
                      <span className={`voucher-payments-type ${isGenerator ? 'generator' : 'transport'}`}>
                        {isGenerator ? 'Gen' : 'Transport'}
                      </span>
                    </td>
                    <td className="vp-approved-cell">
                      <div>{formatDateShort(voucher.approved_at || voucher.created_at)}</div>
                      <small title={voucher.approved_by_name || ''}>
                        {voucher.approved_by_name ||
                          (voucher.approval_mode === 'physical' ? 'Physical' : '-')}
                      </small>
                    </td>
                    <td className="voucher-payments-cards-cell" title={cardsTitle || undefined}>
                      {cards.length === 0 ? (
                        <span className="vp-muted">-</span>
                      ) : (
                        <div className="voucher-payments-cards-compact">
                          {visibleCards.map((card) => (
                            <div key={card.card_id || card.card_number} className="voucher-payments-card-chip">
                              <strong>{shortCardNo(card.card_number)}</strong>
                              <span>
                                {card.transaction_count}tx · {formatMoney(card.amount)}
                              </span>
                            </div>
                          ))}
                          {extraCards > 0 ? (
                            <div className="voucher-payments-card-more">+{extraCards} more</div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="num vp-amount-cell">
                      <strong>{formatMoney(voucher.total_amount)}</strong>
                      <small>{voucher.transaction_count || 0} lines</small>
                    </td>
                    <td>
                      <span className={`voucher-payments-status ${isPaid ? 'paid' : 'pending'}`}>
                        {isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="vp-details-cell">
                      {isPaid ? (
                        <>
                          <div>{voucher.payment_method_label || '-'}</div>
                          {voucher.payment_reference ? (
                            <small>{voucher.payment_reference}</small>
                          ) : null}
                          {voucher.paid_by_name ? (
                            <small>
                              {voucher.paid_by_name}
                              {voucher.paid_at ? ` · ${formatDateShort(voucher.paid_at)}` : ''}
                            </small>
                          ) : null}
                          {voucher.payment_receipt_image_url ? (
                            <button
                              type="button"
                              className="voucher-payments-link"
                              onClick={() => openReceipt(voucher.payment_receipt_image_url)}
                            >
                              {isPdfProofUrl(voucher.payment_receipt_image_url) ? 'PDF' : 'Receipt'}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <span className="vp-muted">Awaiting payment</span>
                      )}
                    </td>
                    <td>
                      <div className="voucher-payments-actions">
                        <button
                          type="button"
                          className="voucher-payments-icon-btn"
                          onClick={() => handlePrint(voucher)}
                          disabled={loadingPrintId === voucher.id}
                          title="Print voucher"
                          aria-label="Print voucher"
                        >
                          <FaPrint />
                        </button>
                        {!isPaid && canMarkPaid ? (
                          <button
                            type="button"
                            className="voucher-payments-btn-primary"
                            onClick={() => openPayModal(voucher)}
                            disabled={!paymentColumnsReady}
                            title={
                              paymentColumnsReady
                                ? 'Mark as paid'
                                : 'Run the voucher payments migration first'
                            }
                          >
                            <FaCheckCircle /> Pay
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {payVoucher ? (
        <div
          className="voucher-payments-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closePayModal()}
        >
          <form className="voucher-payments-modal" onSubmit={handleMarkPaid}>
            <header className="voucher-payments-modal-header">
              <div className="voucher-payments-modal-header-main">
                <div className="voucher-payments-modal-eyebrow">
                  <FaCheckCircle aria-hidden />
                  <span>Mark as paid</span>
                </div>
                <div className="voucher-payments-modal-title-row">
                  <h3>{payVoucher.voucher_no}</h3>
                  <span className={`voucher-payments-type ${payIsGenerator ? 'generator' : 'transport'}`}>
                    {payIsGenerator ? 'Generator' : 'Transport'}
                  </span>
                </div>
                <p>Record payment and top up the fuel card(s). This cannot be undone.</p>
              </div>
              <button
                type="button"
                className="voucher-payments-modal-close"
                onClick={closePayModal}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="voucher-payments-modal-body">
              <div className="voucher-payments-modal-hero">
                <div>
                  <span className="voucher-payments-modal-hero-label">Amount due</span>
                  <strong className="voucher-payments-modal-hero-value">
                    {formatMoney(payVoucher.total_amount)}
                  </strong>
                </div>
                <div className="voucher-payments-modal-kpis">
                  <div>
                    <span>Lines</span>
                    <strong>{payVoucher.transaction_count || 0}</strong>
                  </div>
                  <div>
                    <span>Cards</span>
                    <strong>{payCards.length || '-'}</strong>
                  </div>
                </div>
              </div>

              <section className="voucher-payments-cards-box">
                <div className="voucher-payments-cards-box-head">
                  <strong>Cards to top up</strong>
                  {payCards.length > 0 ? <span>{payCards.length}</span> : null}
                </div>
                {loadingPayDetail ? (
                  <p className="vp-muted">Loading card details...</p>
                ) : payCards.length === 0 ? (
                  <p className="vp-muted">Card details unavailable until the backend is updated.</p>
                ) : (
                  <ul>
                    {payCards.map((card) => (
                      <li key={card.card_id || card.card_number}>
                        <div className="voucher-payments-card-main">
                          <span className="voucher-payments-card-no">{shortCardNo(card.card_number)}</span>
                          {card.card_holder ? (
                            <span className="voucher-payments-card-holder">{card.card_holder}</span>
                          ) : null}
                        </div>
                        <span className="voucher-payments-card-meta">
                          {card.transaction_count} tx · {formatMoney(card.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <fieldset className="voucher-payments-methods">
                <legend>Payment method</legend>
                <div className="voucher-payments-methods-grid">
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <label key={option.value} className={payForm.method === option.value ? 'active' : ''}>
                      <input
                        type="radio"
                        name="payment_method"
                        value={option.value}
                        checked={payForm.method === option.value}
                        onChange={() =>
                          setPayForm((prev) => ({
                            ...prev,
                            method: option.value,
                            receipt: option.allowsReceipt ? prev.receipt : null,
                          }))
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="voucher-payments-form-row">
                <label className="voucher-payments-field">
                  <span>
                    {selectedMethod.referenceLabel} <em>optional</em>
                  </span>
                  <input
                    type="text"
                    maxLength={100}
                    value={payForm.reference}
                    onChange={(e) => setPayForm((prev) => ({ ...prev, reference: e.target.value }))}
                  />
                </label>
                {selectedMethod.allowsReceipt ? (
                  <label className="voucher-payments-field">
                    <span>
                      Receipt / slip <em>optional · max {RECEIPT_MAX_LABEL}</em>
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleReceiptChange}
                    />
                    {payForm.receipt ? (
                      <small className="voucher-payments-file-name">{payForm.receipt.name}</small>
                    ) : null}
                  </label>
                ) : null}
              </div>

              <label className="voucher-payments-field">
                <span>
                  Note <em>optional</em>
                </span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={payForm.note}
                  onChange={(e) => setPayForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </label>

              <div
                className={`voucher-payments-confirm-note${
                  payAlreadySettled ? ' voucher-payments-confirm-note--info' : ''
                }`}
              >
                {payAlreadySettled
                  ? 'Already settled. Only payment details will be recorded.'
                  : payCards.length > 1
                    ? `Tops up each of the ${payCards.length} cards for its own lines, then closes the voucher.`
                    : 'Settles the fuel card (top-up) for all lines, then closes the voucher.'}
              </div>
            </div>

            <div className="voucher-payments-modal-footer">
              <button
                type="button"
                className="voucher-payments-btn-secondary"
                onClick={closePayModal}
                disabled={markingPaid}
              >
                Cancel
              </button>
              <button type="submit" className="voucher-payments-btn-primary" disabled={markingPaid}>
                <FaCheckCircle aria-hidden />
                {markingPaid ? 'Saving...' : 'Confirm paid'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {printVoucher ? (
        <TransportVoucherPrint voucher={printVoucher} onClose={() => setPrintVoucher(null)} />
      ) : null}
    </div>
  );
};

export default VoucherPayments;
