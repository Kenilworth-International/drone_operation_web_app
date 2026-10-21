import React, { useEffect, useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';
import {
  FaFileInvoiceDollar,
  FaHistory,
  FaCheck,
  FaTimes,
  FaSyncAlt,
  FaShoppingCart,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  useGetEligiblePurchaseOrdersQuery,
  useCreatePurchaseOrderVoucherMutation,
  useFinanceDeclinePurchaseOrdersMutation,
  useGetPurchaseOrderVoucherHistoryQuery,
  useGetPurchaseOrderVoucherByIdQuery,
} from '../../../api/services NodeJs/purchaseOrderVoucherApi';
import {
  useGetPurchaseOrderRefundsQuery,
  useMarkPurchaseOrderRefundRecordedMutation,
} from '../../../api/services NodeJs/centralProcurementApi';
import PurchaseOrderVoucherPrint from './PurchaseOrderVoucherPrint';
import '../../../styles/voucherPayments.css';
import '../../../styles/purchaseOrderPayments.css';

const ELIGIBLE_STATUSES = new Set(['not_create', 'declined']);

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

function VoucherStatusChip({ status }) {
  const map = {
    not_create: ['pov-chip-none', 'Not vouchered'],
    pending: ['pov-chip-pending', 'Pending MD'],
    approved: ['pov-chip-approved', 'Approved'],
    paid: ['pov-chip-paid', 'Paid'],
    declined: ['pov-chip-declined', 'Declined'],
    finance_declined: ['pov-chip-fin-decline', 'Finance declined'],
  };
  const [cls, label] = map[status] || map.not_create;
  return <span className={`pov-chip ${cls}`}>{label}</span>;
}

export default function PurchaseOrderPayments() {
  const [view, setView] = useState('eligible');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(() => currentMonthKey());
  const [selected, setSelected] = useState(() => new Set());
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [printId, setPrintId] = useState(null);

  const monthOptions = useMemo(() => recentMonthOptions(), []);
  const monthLabel = useMemo(
    () => monthOptions.find((o) => o.value === month)?.label || month,
    [month, monthOptions]
  );

  const listParams = useMemo(
    () => ({ search, status: 'all', month }),
    [search, month]
  );

  const {
    data: poRows = [],
    isLoading: poLoading,
    isFetching: poFetching,
    refetch: refetchPos,
  } = useGetEligiblePurchaseOrdersQuery(listParams);

  const {
    data: history = [],
    isLoading: historyLoading,
    isFetching: historyFetching,
    refetch: refetchHistory,
  } = useGetPurchaseOrderVoucherHistoryQuery({ month });

  const [createVoucher, { isLoading: creating }] = useCreatePurchaseOrderVoucherMutation();
  const [financeDecline, { isLoading: declining }] = useFinanceDeclinePurchaseOrdersMutation();

  const {
    data: refunds = [],
    isLoading: refundsLoading,
    isFetching: refundsFetching,
    refetch: refetchRefunds,
  } = useGetPurchaseOrderRefundsQuery({ status: 'all', month });
  const [markRefundRecorded, { isLoading: markingRefund }] = useMarkPurchaseOrderRefundRecordedMutation();

  const pendingRefundCount = useMemo(
    () => (refunds || []).filter((r) => String(r.status) === 'pending').length,
    [refunds]
  );

  const { data: printDetail } = useGetPurchaseOrderVoucherByIdQuery(printId, { skip: !printId });

  const eligibleRows = useMemo(
    () =>
      (poRows || []).filter(
        (r) => ELIGIBLE_STATUSES.has(r.voucher_status) && Number(r.total_amount) > 0
      ),
    [poRows]
  );

  const displayRows = view === 'eligible' ? eligibleRows : poRows;
  const isRefreshing = poFetching || historyFetching || refundsFetching;

  const selectedIds = useMemo(() => [...selected].map(Number).filter((n) => n > 0), [selected]);
  const selectedAmount = useMemo(() => {
    const set = new Set(selectedIds);
    return eligibleRows
      .filter((r) => set.has(Number(r.id)))
      .reduce((s, r) => s + Number(r.total_amount || 0), 0);
  }, [eligibleRows, selectedIds]);

  useEffect(() => {
    setSelected(new Set());
  }, [month, view]);

  const toggleRow = (id) => {
    const n = Number(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const toggleAllEligible = () => {
    if (selectedIds.length === eligibleRows.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(eligibleRows.map((r) => Number(r.id))));
  };

  const refreshAll = () => {
    refetchPos();
    refetchHistory();
    refetchRefunds();
  };

  const onCreate = async () => {
    if (!selectedIds.length) {
      toast.error('Select at least one purchase order');
      return;
    }
    try {
      const data = await createVoucher({ purchase_order_ids: selectedIds }).unwrap();
      toast.success(`Voucher ${data?.voucher_no || ''} created`);
      setSelected(new Set());
      refreshAll();
    } catch (e) {
      toast.error(e?.data?.message || e?.error || 'Create voucher failed');
    }
  };

  const onFinanceDecline = async () => {
    if (!selectedIds.length) {
      toast.error('Select at least one purchase order');
      return;
    }
    if (!String(declineReason || '').trim()) {
      toast.error('Decline reason is required');
      return;
    }
    try {
      await financeDecline({
        purchase_order_ids: selectedIds,
        reason: declineReason.trim(),
      }).unwrap();
      toast.success('Purchase orders declined by finance');
      setDeclineOpen(false);
      setDeclineReason('');
      setSelected(new Set());
      refreshAll();
    } catch (e) {
      toast.error(e?.data?.message || e?.error || 'Finance decline failed');
    }
  };

  return (
    <div className="pov-page">
      <ToastContainer position="top-right" autoClose={2800} />

      <header className="pov-top">
        <div className="pov-title-block">
          <h2>
            <FaShoppingCart aria-hidden /> Purchase Order Payments
          </h2>
          <p>
            Create payment vouchers from issued POs for Strategic MD approval.
            <span className="pov-month-hint"> Showing {monthLabel}</span>
          </p>
        </div>
        <div className="pov-summary">
          <div className="pov-summary-card">
            <span>Eligible</span>
            <strong>{eligibleRows.length}</strong>
          </div>
          <div className="pov-summary-card">
            <span>Selected</span>
            <strong>{selectedIds.length}</strong>
            <small>{fmtLkr(selectedAmount)}</small>
          </div>
          <div className="pov-summary-card">
            <span>Vouchers</span>
            <strong>{history.length}</strong>
          </div>
          <div className="pov-summary-card">
            <span>Refunds</span>
            <strong>{pendingRefundCount}</strong>
          </div>
        </div>
        <button
          type="button"
          className="pov-refresh-btn"
          onClick={refreshAll}
          disabled={isRefreshing}
          title="Refresh"
          aria-label="Refresh"
        >
          <FaSyncAlt className={isRefreshing ? 'pov-spin' : ''} aria-hidden />
          <span>Refresh</span>
        </button>
      </header>

      <div className="pov-filters">
        <div className="pov-filter">
          <label htmlFor="pov-month">Month</label>
          <select
            id="pov-month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            title="Filter by month"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.value === currentMonthKey() ? ' (this month)' : ''}
              </option>
            ))}
          </select>
        </div>
        {(view === 'eligible' || view === 'all') && (
          <div className="pov-filter pov-filter-grow">
            <label htmlFor="pov-search">Search</label>
            <input
              id="pov-search"
              type="search"
              placeholder="PO no, supplier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
        {(view === 'eligible' || view === 'all') && (
          <div className="pov-filter-actions">
            <button
              type="button"
              className="voucher-payments-btn"
              disabled={!selectedIds.length || creating}
              onClick={onCreate}
            >
              <FaCheck /> {creating ? 'Creating…' : 'Create voucher'}
            </button>
            <button
              type="button"
              className="voucher-payments-btn ghost danger"
              disabled={!selectedIds.length || declining}
              onClick={() => setDeclineOpen(true)}
            >
              <FaTimes /> Finance decline
            </button>
          </div>
        )}
      </div>

      <div className="pov-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'eligible'}
          className={view === 'eligible' ? 'active' : ''}
          onClick={() => setView('eligible')}
        >
          <FaFileInvoiceDollar /> Eligible POs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'all'}
          className={view === 'all' ? 'active' : ''}
          onClick={() => setView('all')}
        >
          All issued POs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'history'}
          className={view === 'history' ? 'active' : ''}
          onClick={() => setView('history')}
        >
          <FaHistory /> Voucher history
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'refunds'}
          className={view === 'refunds' ? 'active' : ''}
          onClick={() => setView('refunds')}
        >
          GRN refunds{pendingRefundCount ? ` (${pendingRefundCount})` : ''}
        </button>
      </div>

      <div className="pov-panel">
        {view === 'refunds' ? (
          <>
            <p className="pov-sub pov-panel-hint">
              Return-for-refund qty from Admin GRN for {monthLabel}. Mark recorded after supplier credit / cash refund is done.
            </p>
            {refundsLoading ? (
              <div className="pov-loading">
                <CircularProgress size={28} />
                <span>Loading refunds…</span>
              </div>
            ) : (
              <div className="voucher-payments-table-wrap pov-table-fill">
                <table className="voucher-payments-table">
                  <thead>
                    <tr>
                      <th>GRN</th>
                      <th>PO</th>
                      <th>Supplier</th>
                      <th>Item</th>
                      <th className="num">Qty</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refunds.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="voucher-payments-empty">
                          No return-for-refund lines for {monthLabel}
                        </td>
                      </tr>
                    ) : (
                      refunds.map((row) => (
                        <tr key={row.id}>
                          <td>{row.grn_no}</td>
                          <td>{row.po_no}</td>
                          <td>{row.supplier_name || '-'}</td>
                          <td>
                            {row.item_name || '-'}
                            {row.item_code ? <small className="pov-sub">{row.item_code}</small> : null}
                          </td>
                          <td className="num">{row.qty}</td>
                          <td className="num">{fmtLkr(row.amount)}</td>
                          <td>
                            <VoucherStatusChip
                              status={String(row.status) === 'recorded' ? 'paid' : 'pending'}
                            />
                          </td>
                          <td>
                            {String(row.status) === 'pending' ? (
                              <button
                                type="button"
                                className="voucher-payments-btn"
                                disabled={markingRefund}
                                onClick={async () => {
                                  try {
                                    await markRefundRecorded({ id: row.id }).unwrap();
                                    toast.success('Refund marked recorded');
                                    refetchRefunds();
                                  } catch (e) {
                                    toast.error(e?.data?.message || 'Failed to mark refund');
                                  }
                                }}
                              >
                                <FaCheck /> Mark recorded
                              </button>
                            ) : (
                              <span className="vp-muted">
                                {row.recorded_by_name || 'Recorded'}
                                {row.recorded_at ? ` · ${formatDate(row.recorded_at)}` : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : view !== 'history' ? (
          poLoading ? (
            <div className="pov-loading">
              <CircularProgress size={28} />
              <span>Loading purchase orders…</span>
            </div>
          ) : (
            <div className="voucher-payments-table-wrap pov-table-fill">
              <table className="voucher-payments-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      {view === 'eligible' ? (
                        <input
                          type="checkbox"
                          checked={eligibleRows.length > 0 && selectedIds.length === eligibleRows.length}
                          onChange={toggleAllEligible}
                          aria-label="Select all eligible"
                        />
                      ) : null}
                    </th>
                    <th>PO No</th>
                    <th>Supplier</th>
                    <th>Issued</th>
                    <th>PO status</th>
                    <th>Payment</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="voucher-payments-empty">
                        No purchase orders for {monthLabel}
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => {
                      const canSelect = ELIGIBLE_STATUSES.has(row.voucher_status) && Number(row.total_amount) > 0;
                      return (
                        <tr
                          key={row.id}
                          className={selected.has(Number(row.id)) ? 'is-selected' : ''}
                          onClick={() => canSelect && toggleRow(row.id)}
                          style={{ cursor: canSelect ? 'pointer' : 'default' }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            {canSelect ? (
                              <input
                                type="checkbox"
                                checked={selected.has(Number(row.id))}
                                onChange={() => toggleRow(row.id)}
                              />
                            ) : null}
                          </td>
                          <td>
                            <strong>{row.po_no}</strong>
                            {row.voucher_no ? <small className="pov-sub">{row.voucher_no}</small> : null}
                          </td>
                          <td>
                            {row.supplier_name || '-'}
                            {row.supplier_code ? <small className="pov-sub">{row.supplier_code}</small> : null}
                          </td>
                          <td>{formatDate(row.created_at)}</td>
                          <td>{row.status}</td>
                          <td>
                            <VoucherStatusChip status={row.voucher_status} />
                          </td>
                          <td className="num">{fmtLkr(row.total_amount)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : historyLoading ? (
          <div className="pov-loading">
            <CircularProgress size={28} />
            <span>Loading history…</span>
          </div>
        ) : (
          <div className="voucher-payments-table-wrap pov-table-fill">
            <table className="voucher-payments-table">
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Prepared by</th>
                  <th className="num">POs</th>
                  <th className="num">Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="voucher-payments-empty">
                      No vouchers for {monthLabel}
                    </td>
                  </tr>
                ) : (
                  history.map((row) => (
                    <tr key={row.id}>
                      <td className="voucher-no">{row.voucher_no}</td>
                      <td>{formatDate(row.created_at)}</td>
                      <td>
                        <VoucherStatusChip
                          status={
                            row.status === 'approved' &&
                            (row.payment_status === 'paid' || Number(row.settled) === 1)
                              ? 'paid'
                              : row.status === 'declined' && row.approval_mode === 'finance'
                                ? 'finance_declined'
                                : row.status
                          }
                        />
                      </td>
                      <td>{row.checked_by_name || row.created_by_name || '-'}</td>
                      <td className="num">{row.transaction_count || 0}</td>
                      <td className="num">{fmtLkr(row.total_amount)}</td>
                      <td>
                        <button
                          type="button"
                          className="voucher-payments-btn ghost"
                          onClick={() => setPrintId(row.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {declineOpen ? (
        <div className="pov-modal-overlay" role="presentation" onClick={() => !declining && setDeclineOpen(false)}>
          <div className="pov-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Finance decline</h3>
            <p>
              Decline {selectedIds.length} purchase order{selectedIds.length === 1 ? '' : 's'} without creating a
              payable voucher. This cannot be re-vouchered.
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason…"
            />
            <div className="pov-modal-actions">
              <button type="button" className="voucher-payments-btn ghost" disabled={declining} onClick={() => setDeclineOpen(false)}>
                Cancel
              </button>
              <button type="button" className="voucher-payments-btn danger" disabled={declining} onClick={onFinanceDecline}>
                {declining ? 'Declining…' : 'Confirm decline'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {printId && printDetail ? (
        <PurchaseOrderVoucherPrint
          voucher={printDetail}
          onClose={() => setPrintId(null)}
        />
      ) : null}
    </div>
  );
}
