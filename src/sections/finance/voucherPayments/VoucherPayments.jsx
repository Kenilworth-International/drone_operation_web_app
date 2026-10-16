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
  { value: 'card', label: 'Card payment', referenceLabel: 'Card receipt / approval no', allowsReceipt: true },
  { value: 'bank_transfer', label: 'Bank transfer', referenceLabel: 'Transfer reference', allowsReceipt: true },
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
  if (!value) return '—';
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

  return (
    <div className="voucher-payments-page">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="voucher-payments-header">
        <div>
          <h2>
            <FaFileInvoice /> Voucher Payments
          </h2>
          <p>Approved fuel vouchers. Mark a voucher as paid to settle the cards and close the process.</p>
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

      <div className="voucher-payments-summary">
        <div className="voucher-payments-summary-card pending">
          <span>Pending payment</span>
          <strong>{totals.pendingCount}</strong>
          <small>{formatMoney(totals.pendingAmount)}</small>
        </div>
        <div className="voucher-payments-summary-card paid">
          <span>Paid</span>
          <strong>{totals.paidCount}</strong>
          <small>{formatMoney(totals.paidAmount)}</small>
        </div>
      </div>

      <div className="voucher-payments-filters">
        <input
          type="text"
          placeholder="Search voucher no, approver, reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="voucher-payments-search"
        />
        <select value={voucherType} onChange={(e) => setVoucherType(e.target.value)} aria-label="Voucher type">
          <option value="all">All fuel vouchers</option>
          <option value="transport">Transport fuel</option>
          <option value="generator">Generator fuel</option>
        </select>
        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} aria-label="Payment status">
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="all">All statuses</option>
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Approved month"
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

      <div className="voucher-payments-table-wrap">
        <table className="voucher-payments-table">
          <thead>
            <tr>
              <th>Voucher</th>
              <th>Type</th>
              <th>Approved</th>
              <th>Cards</th>
              <th>Lines</th>
              <th className="num">Amount</th>
              <th>Payment</th>
              <th>Method / Reference</th>
              <th>Receipt</th>
              <th>Paid by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={11} className="voucher-payments-empty">Loading vouchers...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={11} className="voucher-payments-empty error">
                  {error?.data?.message || 'Failed to load vouchers'}
                </td>
              </tr>
            ) : filteredVouchers.length === 0 ? (
              <tr>
                <td colSpan={11} className="voucher-payments-empty">No approved vouchers match these filters</td>
              </tr>
            ) : (
              filteredVouchers.map((voucher) => {
                const isPaid = voucher.payment_status === 'paid';
                const isGenerator = isGeneratorFuelVoucher(voucher);
                const cards = resolveVoucherCardsSummary(voucher);
                return (
                  <tr key={voucher.id}>
                    <td className="voucher-no">{voucher.voucher_no}</td>
                    <td>
                      <span className={`voucher-payments-type ${isGenerator ? 'generator' : 'transport'}`}>
                        {isGenerator ? 'Generator fuel' : 'Transport fuel'}
                      </span>
                    </td>
                    <td>
                      <div>{formatDateTime(voucher.approved_at || voucher.created_at)}</div>
                      <small>{voucher.approved_by_name || (voucher.approval_mode === 'physical' ? 'Physical approval' : '—')}</small>
                    </td>
                    <td className="voucher-payments-cards-cell">
                      {cards.length === 0 ? (
                        '—'
                      ) : (
                        cards.map((card) => (
                          <div key={card.card_id || card.card_number} className="voucher-payments-card-row">
                            <strong>{card.card_number || '—'}</strong>
                            {card.card_holder ? <small>{card.card_holder}</small> : null}
                            <small>
                              {card.transaction_count} tx · {formatMoney(card.amount)}
                            </small>
                          </div>
                        ))
                      )}
                    </td>
                    <td>{voucher.transaction_count || 0}</td>
                    <td className="num">{formatMoney(voucher.total_amount)}</td>
                    <td>
                      <span className={`voucher-payments-status ${isPaid ? 'paid' : 'pending'}`}>
                        {isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      {isPaid ? (
                        <>
                          <div>{voucher.payment_method_label || '—'}</div>
                          {voucher.payment_reference ? <small>{voucher.payment_reference}</small> : null}
                          {voucher.payment_note ? <small className="note">{voucher.payment_note}</small> : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {voucher.payment_receipt_image_url ? (
                        <button
                          type="button"
                          className="voucher-payments-link"
                          onClick={() => openReceipt(voucher.payment_receipt_image_url)}
                        >
                          {isPdfProofUrl(voucher.payment_receipt_image_url) ? 'View PDF' : 'View receipt'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {isPaid ? (
                        <>
                          <div>{voucher.paid_by_name || '—'}</div>
                          <small>{formatDateTime(voucher.paid_at)}</small>
                        </>
                      ) : (
                        '—'
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
                        >
                          <FaPrint />
                        </button>
                        {!isPaid && canMarkPaid ? (
                          <button
                            type="button"
                            className="voucher-payments-btn-primary"
                            onClick={() => openPayModal(voucher)}
                            disabled={!paymentColumnsReady}
                            title={paymentColumnsReady ? 'Mark as paid' : 'Run the voucher payments migration first'}
                          >
                            <FaCheckCircle /> Mark paid
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
        <div className="voucher-payments-modal-overlay" onClick={(e) => e.target === e.currentTarget && closePayModal()}>
          <form className="voucher-payments-modal" onSubmit={handleMarkPaid}>
            <div className="voucher-payments-modal-header">
              <h3>Mark {payVoucher.voucher_no} as paid</h3>
              <button type="button" className="voucher-payments-modal-close" onClick={closePayModal}>×</button>
            </div>

            <div className="voucher-payments-modal-body">
              <div className="voucher-payments-modal-amount">
                <span>{isGeneratorFuelVoucher(payVoucher) ? 'Generator fuel voucher' : 'Transport fuel voucher'}</span>
                <strong>{formatMoney(payVoucher.total_amount)}</strong>
                <small>{payVoucher.transaction_count || 0} transaction{Number(payVoucher.transaction_count) === 1 ? '' : 's'}</small>
              </div>

              <div className="voucher-payments-cards-box">
                <strong>Cards that will be topped up</strong>
                {loadingPayDetail ? (
                  <p>Loading card details...</p>
                ) : resolveVoucherCardsSummary(payVoucher).length === 0 ? (
                  <p>Card details unavailable until the backend is updated.</p>
                ) : (
                  <ul>
                    {resolveVoucherCardsSummary(payVoucher).map((card) => (
                      <li key={card.card_id || card.card_number}>
                        <span className="voucher-payments-card-no">{card.card_number || '—'}</span>
                        {card.card_holder ? <span>{card.card_holder}</span> : null}
                        <span>
                          {card.transaction_count} tx · {formatMoney(card.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <fieldset className="voucher-payments-methods">
                <legend>Payment method</legend>
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
              </fieldset>

              <label className="voucher-payments-field">
                <span>{selectedMethod.referenceLabel} <em>(optional)</em></span>
                <input
                  type="text"
                  maxLength={100}
                  value={payForm.reference}
                  onChange={(e) => setPayForm((prev) => ({ ...prev, reference: e.target.value }))}
                />
              </label>

              {selectedMethod.allowsReceipt ? (
                <label className="voucher-payments-field">
                  <span>Receipt / slip (image or PDF, max {RECEIPT_MAX_LABEL}) <em>(optional)</em></span>
                  <input type="file" accept="image/*,application/pdf" onChange={handleReceiptChange} />
                </label>
              ) : null}

              <label className="voucher-payments-field">
                <span>Note <em>(optional)</em></span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={payForm.note}
                  onChange={(e) => setPayForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </label>

              <div className="voucher-payments-confirm-note">
                {Number(payVoucher.settled) === 1
                  ? 'This voucher is already settled. Only the payment details will be recorded.'
                  : resolveVoucherCardsSummary(payVoucher).length > 1
                    ? `Marking as paid tops up each of the ${resolveVoucherCardsSummary(payVoucher).length} cards above for its own lines, then ends the process. This cannot be undone.`
                    : 'Marking as paid settles the fuel card (top-up) for all lines in this voucher and ends the process. This cannot be undone.'}
              </div>
            </div>

            <div className="voucher-payments-modal-footer">
              <button type="button" className="voucher-payments-btn-secondary" onClick={closePayModal} disabled={markingPaid}>
                Cancel
              </button>
              <button type="submit" className="voucher-payments-btn-primary" disabled={markingPaid}>
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
