import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { FaEye, FaPrint } from 'react-icons/fa';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  useGetPendingFuelTransportVouchersQuery,
  useGetFuelTransportVoucherHistoryQuery,
  useGetFuelTransportVoucherByIdQuery,
  useApproveFuelTransportVoucherMutation,
  useDeclineFuelTransportVoucherMutation,
} from '../../api/services NodeJs/fuelTransportVoucherApi';
import {
  useGetPendingFuelGeneratorVouchersQuery,
  useGetFuelGeneratorVoucherHistoryQuery,
  useGetFuelGeneratorVoucherByIdQuery,
  useApproveFuelGeneratorVoucherMutation,
  useDeclineFuelGeneratorVoucherMutation,
} from '../../api/services NodeJs/fuelGeneratorVoucherApi';
import {
  useGetPendingMaintenanceVouchersQuery,
  useGetMaintenanceVoucherHistoryQuery,
  useApproveMaintenanceVoucherMutation,
  useDeclineMaintenanceVoucherMutation,
} from '../../api/services NodeJs/maintenanceVoucherApi';
import MaintenanceVoucherPrint from '../finance/maintenance/MaintenanceVoucherPrint';
import { getUserData } from '../../utils/authUtils';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TransportVoucherPrint from '../finance/financialCards/TransportVoucherPrint';
import {
  formatFuelMoney,
  formatFuelVoucherDescription,
  getFuelLineDisplayParts,
} from '../finance/financialCards/fuelVoucherDescription';
import {
  getVoucherApprovalTypeLabel,
  getVoucherDecidedBy,
  isPdfProofUrl,
  voucherStatusLabel,
} from '../finance/financialCards/fuelTransportVoucherUi';
import { resolveVoucherDriverName } from '../finance/financialCards/transportVoucherPrintUtils';
import '../../styles/financialCards.css';

const FINANCE_APPROVALS_REFRESH_MS = 5 * 60 * 1000;

const formatRefreshClock = (value) => {
  if (!value) return '—';
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatLkr = (value) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(
    Number(value) || 0
  );

const spmDialogPaperSx = {
  borderRadius: '12px',
  border: '1px solid #d9e5ef',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
  overflow: 'hidden',
};

const spmDialogActionsSx = {
  px: 3,
  py: 2,
  gap: 1,
  borderTop: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
};

const spmVoucherSummaryBoxSx = {
  mt: 1.5,
  p: 1.5,
  background: '#f8fafc',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
};

const StrategicFinanceApprovals = () => {
  const userData = getUserData();
  const isMd = String(userData?.job_role || '').trim().toLowerCase() === 'md';

  const [mainTab, setMainTab] = useState(0);
  const [fuelSource, setFuelSource] = useState('vehicle');
  const [fuelTab, setFuelTab] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [decline, setDecline] = useState(null);
  const [approveConfirm, setApproveConfirm] = useState(null);
  const [printVoucher, setPrintVoucher] = useState(null);
  const [printVoucherId, setPrintVoucherId] = useState(null);
  const [settlementProofPreviewUrl, setSettlementProofPreviewUrl] = useState(null);
  const [voucherSearch, setVoucherSearch] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [approvingVoucherId, setApprovingVoucherId] = useState(null);
  const [decliningVoucherId, setDecliningVoucherId] = useState(null);

  // Maintenance voucher state
  const [maintTab, setMaintTab]                     = useState(0);
  const [maintSearch, setMaintSearch]               = useState('');
  const [maintApproveConfirm, setMaintApproveConfirm] = useState(null);
  const [maintDecline, setMaintDecline]             = useState(null);
  const [maintPrintVoucher, setMaintPrintVoucher]   = useState(null);
  const [approvingMaintId, setApprovingMaintId]     = useState(null);
  const [decliningMaintId, setDecliningMaintId]     = useState(null);

  const { data: transportPending = [], isLoading: transportPendingLoading, refetch: refetchTransportPending } =
    useGetPendingFuelTransportVouchersQuery();
  const { data: transportHistory = [], isLoading: transportHistoryLoading, refetch: refetchTransportHistory } =
    useGetFuelTransportVoucherHistoryQuery();
  const { data: generatorPending = [], isLoading: generatorPendingLoading, refetch: refetchGeneratorPending } =
    useGetPendingFuelGeneratorVouchersQuery();
  const { data: generatorHistory = [], isLoading: generatorHistoryLoading, refetch: refetchGeneratorHistory } =
    useGetFuelGeneratorVoucherHistoryQuery();

  const pending = fuelSource === 'vehicle' ? transportPending : generatorPending;
  const history = fuelSource === 'vehicle' ? transportHistory : generatorHistory;
  const pendingLoading = fuelSource === 'vehicle' ? transportPendingLoading : generatorPendingLoading;
  const historyLoading = fuelSource === 'vehicle' ? transportHistoryLoading : generatorHistoryLoading;
  const refetchPending = fuelSource === 'vehicle' ? refetchTransportPending : refetchGeneratorPending;
  const refetchHistory = fuelSource === 'vehicle' ? refetchTransportHistory : refetchGeneratorHistory;

  const { data: transportDetail, isLoading: transportDetailLoading } = useGetFuelTransportVoucherByIdQuery(selectedId, {
    skip: !selectedId || fuelSource !== 'vehicle',
  });
  const { data: generatorDetail, isLoading: generatorDetailLoading } = useGetFuelGeneratorVoucherByIdQuery(selectedId, {
    skip: !selectedId || fuelSource !== 'generator',
  });
  const detail = fuelSource === 'vehicle' ? transportDetail : generatorDetail;
  const detailLoading = fuelSource === 'vehicle' ? transportDetailLoading : generatorDetailLoading;

  const { data: transportPrintDetail } = useGetFuelTransportVoucherByIdQuery(printVoucherId, {
    skip: !printVoucherId || fuelSource !== 'vehicle',
  });
  const { data: generatorPrintDetail } = useGetFuelGeneratorVoucherByIdQuery(printVoucherId, {
    skip: !printVoucherId || fuelSource !== 'generator',
  });
  const printDetail = fuelSource === 'vehicle' ? transportPrintDetail : generatorPrintDetail;

  // Maintenance voucher queries & mutations
  const { data: maintPending = [], isLoading: maintPendingLoading, refetch: refetchMaintPending } =
    useGetPendingMaintenanceVouchersQuery();
  const { data: maintHistory = [], isLoading: maintHistoryLoading, refetch: refetchMaintHistory } =
    useGetMaintenanceVoucherHistoryQuery();
  const [approveMaintVoucher, { isLoading: approvingMaint }] = useApproveMaintenanceVoucherMutation();
  const [declineMaintVoucher, { isLoading: decliningMaint }] = useDeclineMaintenanceVoucherMutation();

  const [approveTransportVoucher, { isLoading: approvingTransport }] = useApproveFuelTransportVoucherMutation();
  const [declineTransportVoucher, { isLoading: decliningTransport }] = useDeclineFuelTransportVoucherMutation();
  const [approveGeneratorVoucher, { isLoading: approvingGenerator }] = useApproveFuelGeneratorVoucherMutation();
  const [declineGeneratorVoucher, { isLoading: decliningGenerator }] = useDeclineFuelGeneratorVoucherMutation();
  const approving = fuelSource === 'vehicle' ? approvingTransport : approvingGenerator;
  const declining = fuelSource === 'vehicle' ? decliningTransport : decliningGenerator;

  const isVehicleFuel = fuelSource === 'vehicle';
  const fuelSourceLabel = isVehicleFuel ? 'Vehicle Fuel' : 'Generator Fuel';
  const personColumnLabel = isVehicleFuel ? 'Driver' : 'Pilot';

  const sourceRows = fuelTab === 0 ? pending : history;
  const fuelLoading = fuelTab === 0 ? pendingLoading : historyLoading;

  const vehicleFuelTypeCount = transportPending.length + transportHistory.length;
  const generatorFuelTypeCount = generatorPending.length + generatorHistory.length;

  const refreshAllData = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      await Promise.all([
        refetchTransportPending(),
        refetchTransportHistory(),
        refetchGeneratorPending(),
        refetchGeneratorHistory(),
        refetchMaintPending(),
        refetchMaintHistory(),
      ]);
      setLastRefreshedAt(new Date());
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  }, [refetchTransportPending, refetchTransportHistory, refetchGeneratorPending, refetchGeneratorHistory, refetchMaintPending, refetchMaintHistory]);

  useEffect(() => {
    if (lastRefreshedAt) return;
    if (!transportPendingLoading && !generatorPendingLoading) {
      setLastRefreshedAt(new Date());
    }
  }, [transportPendingLoading, generatorPendingLoading, lastRefreshedAt]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      void refreshAllData({ showSpinner: false });
    }, FINANCE_APPROVALS_REFRESH_MS);
    return () => window.clearInterval(timerId);
  }, [refreshAllData]);

  useEffect(() => {
    setSelectedId(null);
    setDecline(null);
    setApproveConfirm(null);
    setPrintVoucherId(null);
    setFuelTab(0);
  }, [fuelSource]);

  useEffect(() => {
    if (printDetail && printVoucherId) {
      setPrintVoucher(printDetail);
      setPrintVoucherId(null);
    }
  }, [printDetail, printVoucherId]);

  const filteredRows = useMemo(() => {
    if (!voucherSearch.trim()) return sourceRows;
    const q = voucherSearch.toLowerCase();
    return sourceRows.filter(
      (row) =>
        row.voucher_no?.toLowerCase().includes(q) ||
        row.created_by_name?.toLowerCase().includes(q) ||
        row.checked_by_name?.toLowerCase().includes(q) ||
        getVoucherDecidedBy(row).toLowerCase().includes(q) ||
        String(row.total_amount || '').includes(q) ||
        String(row.transaction_count || '').includes(q)
    );
  }, [sourceRows, voucherSearch]);

  const openSettlementProof = (url) => {
    if (!url) return;
    if (isPdfProofUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setSettlementProofPreviewUrl(url);
  };

  const openVoucherPrint = (row) => {
    if (row?.lines?.length) {
      setPrintVoucher(row);
      return;
    }
    setPrintVoucherId(row.id);
  };

  const submitApprove = async () => {
    if (!approveConfirm) return;
    setApprovingVoucherId(approveConfirm.id);
    try {
      const approveFn = fuelSource === 'vehicle' ? approveTransportVoucher : approveGeneratorVoucher;
      const result = await approveFn(approveConfirm.id).unwrap();
      setApproveConfirm(null);
      setPrintVoucher(result);
      toast.success('Voucher approved');
      refetchPending();
      refetchHistory();
      setLastRefreshedAt(new Date());
    } catch (e) {
      toast.error(e?.data?.message || 'Failed to approve voucher');
    } finally {
      setApprovingVoucherId(null);
    }
  };

  const submitDecline = async () => {
    if (!decline?.reason?.trim()) return;
    setDecliningVoucherId(decline.row.id);
    try {
      const declineFn = fuelSource === 'vehicle' ? declineTransportVoucher : declineGeneratorVoucher;
      await declineFn({ id: decline.row.id, reason: decline.reason.trim() }).unwrap();
      setDecline(null);
      if (selectedId === decline.row.id) setSelectedId(null);
      toast.success('Voucher declined');
      refetchPending();
      refetchHistory();
      setLastRefreshedAt(new Date());
    } catch (e) {
      toast.error(e?.data?.message || 'Failed to decline voucher');
    } finally {
      setDecliningVoucherId(null);
    }
  };

  const renderSettledCell = (voucher) => (
    <td className="voucher-settled-cell-financial-cards">
      {Number(voucher.settled) === 1 ? (
        voucher.settlement_proof_image_url ? (
          isPdfProofUrl(voucher.settlement_proof_image_url) ? (
            <button
              type="button"
              className="voucher-settlement-proof-link-financial-cards"
              onClick={() => openSettlementProof(voucher.settlement_proof_image_url)}
            >
              View proof
            </button>
          ) : (
            <button
              type="button"
              className="voucher-settlement-proof-thumb-btn-financial-cards"
              onClick={() => openSettlementProof(voucher.settlement_proof_image_url)}
              title="View settlement proof"
              aria-label="View settlement proof"
            >
              <img
                src={voucher.settlement_proof_image_url}
                alt="Settlement proof"
                className="voucher-settlement-proof-thumb-financial-cards"
              />
            </button>
          )
        ) : (
          <span className="voucher-settled-label-financial-cards">Settled</span>
        )
      ) : (
        <span className="voucher-not-settled-financial-cards">Not settled</span>
      )}
    </td>
  );

  const renderActionsCell = (row) => (
    <td className="voucher-history-actions-cell-financial-cards">
      <div className="voucher-history-actions-financial-cards">
        <button
          type="button"
          className="voucher-action-btn-financial-cards voucher-action-btn-outline-financial-cards"
          onClick={() => setSelectedId(row.id)}
          title="View details"
          aria-label="View voucher details"
        >
          <FaEye />
        </button>
        <button
          type="button"
          className="voucher-action-btn-financial-cards voucher-action-btn-outline-financial-cards"
          onClick={() => openVoucherPrint(row)}
          title="Print"
          aria-label="Print voucher"
        >
          <FaPrint />
        </button>
        {fuelTab === 0 && isMd ? (
          <>
            <button
              type="button"
              className={`voucher-action-btn-financial-cards voucher-action-btn-success-financial-cards spm-approve-btn-financial-cards${
                approving && approvingVoucherId === row.id ? ' is-loading' : ''
              }`}
              onClick={() => setApproveConfirm(row)}
              disabled={approving || declining}
              title="Approve voucher"
              aria-label="Approve voucher"
            >
              {approving && approvingVoucherId === row.id ? (
                <>
                  <span className="financial-cards-btn-spinner financial-cards-btn-spinner-light" aria-hidden="true" />
                  <span className="spm-action-btn-label">Approving…</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon fontSize="small" />
                  <span className="spm-action-btn-label">Approve</span>
                </>
              )}
            </button>
            <button
              type="button"
              className={`voucher-action-btn-financial-cards voucher-action-btn-danger-financial-cards spm-decline-btn-financial-cards${
                declining && decliningVoucherId === row.id ? ' is-loading' : ''
              }`}
              onClick={() => setDecline({ row, reason: '' })}
              disabled={approving || declining}
              title="Decline voucher"
              aria-label="Decline voucher"
            >
              {declining && decliningVoucherId === row.id ? (
                <>
                  <span className="financial-cards-btn-spinner" aria-hidden="true" />
                  <span className="spm-action-btn-label">Declining…</span>
                </>
              ) : (
                <>
                  <CancelIcon fontSize="small" />
                  <span className="spm-action-btn-label">Decline</span>
                </>
              )}
            </button>
          </>
        ) : null}
      </div>
    </td>
  );

  return (
    <div className="financial-cards-container spm-finance-approvals-page">
      <div className="financial-cards-header">
        <div>
          <h1>Finance Approvals</h1>
          <p className="spm-finance-page-subtitle">
            Strategic Planning and Monitoring wing — system approvals for finance vouchers
          </p>
        </div>
        <div className="financial-cards-header-right">
          <div className="financial-cards-refresh-meta">
            <span className="financial-cards-refresh-label">Last updated</span>
            <span className="financial-cards-refresh-time">{formatRefreshClock(lastRefreshedAt)}</span>
            <button
              type="button"
              className="financial-cards-refresh-btn"
              onClick={() => void refreshAllData()}
              disabled={isRefreshing}
              title="Refresh data now"
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="financial-cards-tabs">
        <button type="button" className={`financial-cards-tab${mainTab === 0 ? ' active' : ''}`} onClick={() => setMainTab(0)}>
          Fuel Voucher Approvals
          {transportPending.length + generatorPending.length > 0 ? (
            <span className="financial-cards-tab-badge">{transportPending.length + generatorPending.length}</span>
          ) : null}
        </button>
        <button type="button" className={`financial-cards-tab${mainTab === 1 ? ' active' : ''}`} onClick={() => setMainTab(1)}>
          Maintenance Vouchers
          {maintPending.length > 0 ? (
            <span className="financial-cards-tab-badge">{maintPending.length}</span>
          ) : null}
        </button>
      </div>

      {mainTab === 0 ? (
        <div className="pending-settlements-section-financial-cards spm-finance-panel-financial-cards">
          <div className="spm-finance-panel-intro">
            <div>
              <h2 className="spm-finance-panel-title">{fuelSourceLabel} Vouchers</h2>
              <p className="spm-finance-panel-subtitle">
                MD system approval for finance-created {isVehicleFuel ? 'vehicle fuel transport' : 'generator fuel'} vouchers
              </p>
            </div>
            {!isMd ? (
              <div className="spm-finance-readonly-note">View only — MD role required to approve or decline</div>
            ) : null}
          </div>

          <div className="settlements-tab-nav-financial-cards spm-fuel-header-row-financial-cards">
            <div className="settlements-tab-group-financial-cards">
              <span className="settlements-tab-group-label-financial-cards">Fuel type</span>
              <div className="settlements-tab-pills-financial-cards">
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${fuelSource === 'vehicle' ? ' active' : ''}`}
                  onClick={() => setFuelSource('vehicle')}
                >
                  Vehicle Fuel
                  {vehicleFuelTypeCount > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{vehicleFuelTypeCount}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${fuelSource === 'generator' ? ' active' : ''}`}
                  onClick={() => setFuelSource('generator')}
                >
                  Generator Fuel
                  {generatorFuelTypeCount > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{generatorFuelTypeCount}</span>
                  ) : null}
                </button>
              </div>
            </div>
            <div className="settlements-tab-group-financial-cards">
              <span className="settlements-tab-group-label-financial-cards">View</span>
              <div className="settlements-tab-pills-financial-cards">
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${fuelTab === 0 ? ' active' : ''}`}
                  onClick={() => setFuelTab(0)}
                >
                  Pending
                  {pending.length > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{pending.length}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${fuelTab === 1 ? ' active' : ''}`}
                  onClick={() => setFuelTab(1)}
                >
                  History
                  {history.length > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{history.length}</span>
                  ) : null}
                </button>
              </div>
            </div>
          </div>

          <div className="spm-finance-summary-strip">
            <div className="spm-finance-summary-item">
              <span className="spm-finance-summary-label">Pending approval</span>
              <strong>{pending.length}</strong>
            </div>
            <div className="spm-finance-summary-item">
              <span className="spm-finance-summary-label">History records</span>
              <strong>{history.length}</strong>
            </div>
            <div className="spm-finance-summary-item">
              <span className="spm-finance-summary-label">Showing</span>
              <strong>{filteredRows.length}</strong>
            </div>
          </div>

          <div className="settlements-filters-financial-cards spm-finance-search-row">
            <input
              type="text"
              placeholder="Search voucher no, preparer, amount..."
              value={voucherSearch}
              onChange={(e) => setVoucherSearch(e.target.value)}
              className="settlement-search-input-financial-cards"
            />
          </div>

          {fuelLoading ? (
            <div className="spm-finance-loading">
              <CircularProgress size={28} />
              <span>Loading vouchers…</span>
            </div>
          ) : (
            <div className="settlements-table-container-financial-cards">
              <table className="voucher-history-table-financial-cards">
                  <thead>
                    <tr>
                      <th>Voucher No</th>
                      <th>Created</th>
                      <th>Status</th>
                      {fuelTab === 1 ? <th>Approved / Declined By</th> : <th>Prepared By</th>}
                      <th>Details</th>
                      <th>Amount</th>
                      {fuelTab === 1 ? <th>Settled</th> : null}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={fuelTab === 1 ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No vouchers found
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.voucher_no}</td>
                          <td>{formatDate(row.created_at)}</td>
                          <td>
                            <span className={`voucher-status-pill-financial-cards ${row.status}`}>
                              {voucherStatusLabel(row.status)}
                            </span>
                          </td>
                          <td>
                            {fuelTab === 1
                              ? getVoucherDecidedBy(row)
                              : row.checked_by_name || row.created_by_name || '-'}
                          </td>
                          <td className="voucher-details-cell-financial-cards">
                            <div className="voucher-details-main-financial-cards">
                              {getVoucherApprovalTypeLabel(row)} ({row.transaction_count || 0})
                            </div>
                            <div className="voucher-details-sub-financial-cards">
                              {row.transaction_count || 0} transaction
                              {(row.transaction_count || 0) === 1 ? '' : 's'}
                            </div>
                          </td>
                          <td>LKR {Number(row.total_amount || 0).toFixed(2)}</td>
                          {fuelTab === 1 ? renderSettledCell(row) : null}
                          {renderActionsCell(row)}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      ) : null}

      {/* ── Maintenance Vouchers Tab ──────────────────────────────────── */}
      {mainTab === 1 ? (
        <div className="pending-settlements-section-financial-cards spm-finance-panel-financial-cards">
          <div className="spm-finance-panel-intro">
            <div>
              <h2 className="spm-finance-panel-title">Maintenance Vouchers</h2>
              <p className="spm-finance-panel-subtitle">
                MD system approval for finance-created maintenance payment vouchers
              </p>
            </div>
            {!isMd ? (
              <div className="spm-finance-readonly-note">View only — MD role required to approve or decline</div>
            ) : null}
          </div>

          <div className="settlements-tab-nav-financial-cards spm-fuel-header-row-financial-cards">
            <div className="settlements-tab-group-financial-cards">
              <span className="settlements-tab-group-label-financial-cards">View</span>
              <div className="settlements-tab-pills-financial-cards">
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${maintTab === 0 ? ' active' : ''}`}
                  onClick={() => setMaintTab(0)}
                >
                  Pending
                  {maintPending.length > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{maintPending.length}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${maintTab === 1 ? ' active' : ''}`}
                  onClick={() => setMaintTab(1)}
                >
                  History
                </button>
              </div>
            </div>
          </div>

          <div className="spm-finance-summary-strip">
            <div className="spm-finance-summary-item">
              <span className="spm-finance-summary-label">Pending approval</span>
              <strong>{maintPending.length}</strong>
            </div>
            <div className="spm-finance-summary-item">
              <span className="spm-finance-summary-label">History records</span>
              <strong>{maintHistory.length}</strong>
            </div>
          </div>

          <div className="settlements-filters-financial-cards spm-finance-search-row">
            <input
              type="text"
              placeholder="Search voucher no, preparer, amount…"
              value={maintSearch}
              onChange={(e) => setMaintSearch(e.target.value)}
              className="settlement-search-input-financial-cards"
            />
          </div>

          {(maintTab === 0 ? maintPendingLoading : maintHistoryLoading) ? (
            <div className="spm-finance-loading">
              <CircularProgress size={28} />
              <span>Loading vouchers…</span>
            </div>
          ) : (() => {
            const sourceRows   = maintTab === 0 ? maintPending : maintHistory;
            const filteredMaint = maintSearch.trim()
              ? sourceRows.filter((r) =>
                  String(r.voucher_no || '').toLowerCase().includes(maintSearch.toLowerCase()) ||
                  String(r.created_by_name || r.checked_by_name || '').toLowerCase().includes(maintSearch.toLowerCase()) ||
                  String(r.total_amount || '').includes(maintSearch)
                )
              : sourceRows;
            return (
              <div className="settlements-table-container-financial-cards">
                <table className="voucher-history-table-financial-cards">
                  <thead>
                    <tr>
                      <th>Voucher No</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>{maintTab === 1 ? 'Approved / Declined By' : 'Prepared By'}</th>
                      <th>Items</th>
                      <th>Amount</th>
                      {maintTab === 1 ? <th>Settled</th> : null}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaint.length === 0 ? (
                      <tr>
                        <td colSpan={maintTab === 1 ? 8 : 7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No vouchers found
                        </td>
                      </tr>
                    ) : filteredMaint.map((row) => (
                      <tr key={row.id}>
                        <td>{row.voucher_no}</td>
                        <td>{formatDate(row.created_at)}</td>
                        <td>
                          <span className={`voucher-status-pill-financial-cards ${row.status}`}>
                            {voucherStatusLabel(Number(row.settled) === 1 ? 'settled' : row.status)}
                          </span>
                        </td>
                        <td>
                          {maintTab === 1
                            ? getVoucherDecidedBy(row)
                            : row.checked_by_name || row.created_by_name || '-'}
                        </td>
                        <td className="voucher-details-cell-financial-cards">
                          <div className="voucher-details-main-financial-cards">
                            {getVoucherApprovalTypeLabel(row)} ({row.transaction_count || 0})
                          </div>
                          <div className="voucher-details-sub-financial-cards">
                            {row.transaction_count || 0} item
                            {(row.transaction_count || 0) === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td>LKR {Number(row.total_amount || 0).toFixed(2)}</td>
                        {maintTab === 1 ? renderSettledCell(row) : null}
                        <td className="voucher-history-actions-cell-financial-cards">
                          <div className="voucher-history-actions-financial-cards">
                            <button
                              type="button"
                              className="voucher-action-btn-financial-cards voucher-action-btn-outline-financial-cards"
                              onClick={() => setMaintPrintVoucher(row)}
                              title="Print"
                            >
                              <FaPrint />
                            </button>
                            {maintTab === 0 && isMd ? (
                              <>
                                <button
                                  type="button"
                                  className={`voucher-action-btn-financial-cards voucher-action-btn-success-financial-cards spm-approve-btn-financial-cards${approvingMaint && approvingMaintId === row.id ? ' is-loading' : ''}`}
                                  onClick={() => setMaintApproveConfirm(row)}
                                  disabled={approvingMaint || decliningMaint}
                                  title="Approve"
                                >
                                  {approvingMaint && approvingMaintId === row.id ? (
                                    <>
                                      <span className="financial-cards-btn-spinner financial-cards-btn-spinner-light" aria-hidden="true" />
                                      <span className="spm-action-btn-label">Approving…</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircleIcon fontSize="small" />
                                      <span className="spm-action-btn-label">Approve</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className={`voucher-action-btn-financial-cards voucher-action-btn-danger-financial-cards spm-decline-btn-financial-cards${decliningMaint && decliningMaintId === row.id ? ' is-loading' : ''}`}
                                  onClick={() => setMaintDecline({ row, reason: '' })}
                                  disabled={approvingMaint || decliningMaint}
                                  title="Decline"
                                >
                                  {decliningMaint && decliningMaintId === row.id ? (
                                    <>
                                      <span className="financial-cards-btn-spinner" aria-hidden="true" />
                                      <span className="spm-action-btn-label">Declining…</span>
                                    </>
                                  ) : (
                                    <>
                                      <CancelIcon fontSize="small" />
                                      <span className="spm-action-btn-label">Decline</span>
                                    </>
                                  )}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Approve confirm dialog */}
          <Dialog
            open={Boolean(maintApproveConfirm)}
            onClose={() => !approvingMaint && setMaintApproveConfirm(null)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: spmDialogPaperSx }}
          >
            <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1, fontWeight: 700, color: '#102739', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: '#15803d', fontSize: 22 }} />
              Approve Maintenance Voucher
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 1, pb: 2.5 }}>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.55 }}>
                Confirm system approval for voucher{' '}
                <strong>{maintApproveConfirm?.voucher_no}</strong> totaling{' '}
                <strong>LKR {Number(maintApproveConfirm?.total_amount || 0).toFixed(2)}</strong>.
              </Typography>
              {maintApproveConfirm ? (
                <Box sx={spmVoucherSummaryBoxSx}>
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 0.5 }}>
                    Voucher summary
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    {maintApproveConfirm.transaction_count || 0} item
                    {(maintApproveConfirm.transaction_count || 0) === 1 ? '' : 's'}
                  </Typography>
                </Box>
              ) : null}
            </DialogContent>
            <DialogActions sx={spmDialogActionsSx}>
              <Button variant="outlined" onClick={() => setMaintApproveConfirm(null)} disabled={approvingMaint} sx={{ textTransform: 'none', borderColor: '#cbd5e1', color: '#475569' }}>Cancel</Button>
              <Button
                variant="contained"
                color="success"
                disabled={approvingMaint}
                sx={{ textTransform: 'none', minWidth: 110, boxShadow: 'none' }}
                onClick={async () => {
                  setApprovingMaintId(maintApproveConfirm.id);
                  try {
                    await approveMaintVoucher(maintApproveConfirm.id).unwrap();
                    setMaintApproveConfirm(null);
                    toast.success('Maintenance voucher approved');
                    refetchMaintPending();
                    refetchMaintHistory();
                    setLastRefreshedAt(new Date());
                  } catch (e) {
                    toast.error(e?.data?.message || 'Failed to approve');
                  } finally {
                    setApprovingMaintId(null);
                  }
                }}
              >
                {approvingMaint ? 'Approving...' : 'Approve'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Decline dialog */}
          <Dialog
            open={Boolean(maintDecline)}
            onClose={() => !decliningMaint && setMaintDecline(null)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: spmDialogPaperSx }}
          >
            <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1, fontWeight: 700, color: '#102739', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CancelIcon sx={{ color: '#b91c1c', fontSize: 22 }} />
              Decline Maintenance Voucher
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 1, pb: 2.5 }}>
              <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.55, mb: 1.5 }}>
                Please provide a reason for declining. Finance will see the status and can re-voucher.
              </Typography>
              {maintDecline?.row ? (
                <Box sx={{ ...spmVoucherSummaryBoxSx, mt: 0, mb: 2 }}>
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 0.5 }}>Voucher</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    {maintDecline.row.voucher_no} · LKR {Number(maintDecline.row.total_amount || 0).toFixed(2)}
                  </Typography>
                </Box>
              ) : null}
              <Typography component="label" htmlFor="maint-decline-reason" variant="caption" sx={{ display: 'block', fontWeight: 600, color: '#475569', mb: 0.75 }}>
                Decline reason
              </Typography>
              <TextField
                id="maint-decline-reason"
                autoFocus
                fullWidth
                multiline
                minRows={4}
                placeholder="Enter reason for declining this voucher..."
                value={maintDecline?.reason || ''}
                onChange={(e) => setMaintDecline((p) => (p ? { ...p, reason: e.target.value } : p))}
                disabled={decliningMaint}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#fff', fontSize: '0.9rem' } }}
              />
            </DialogContent>
            <DialogActions sx={spmDialogActionsSx}>
              <Button variant="outlined" onClick={() => setMaintDecline(null)} disabled={decliningMaint} sx={{ textTransform: 'none', borderColor: '#cbd5e1', color: '#475569' }}>Cancel</Button>
              <Button
                variant="contained"
                color="error"
                disabled={decliningMaint || !maintDecline?.reason?.trim()}
                sx={{ textTransform: 'none', minWidth: 110, boxShadow: 'none', '&.Mui-disabled': { backgroundColor: '#fecaca', color: '#fff' } }}
                onClick={async () => {
                  if (!maintDecline?.reason?.trim()) return;
                  setDecliningMaintId(maintDecline.row.id);
                  try {
                    await declineMaintVoucher({ id: maintDecline.row.id, reason: maintDecline.reason.trim() }).unwrap();
                    setMaintDecline(null);
                    toast.success('Maintenance voucher declined');
                    refetchMaintPending();
                    refetchMaintHistory();
                    setLastRefreshedAt(new Date());
                  } catch (e) {
                    toast.error(e?.data?.message || 'Failed to decline');
                  } finally {
                    setDecliningMaintId(null);
                  }
                }}
              >
                {decliningMaint ? 'Declining...' : 'Decline'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Print preview */}
          {maintPrintVoucher ? (
            <MaintenanceVoucherPrint
              voucher={maintPrintVoucher}
              onClose={() => setMaintPrintVoucher(null)}
            />
          ) : null}
        </div>
      ) : null}

      <Dialog open={Boolean(selectedId)} onClose={() => setSelectedId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Voucher Detail</DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <CircularProgress size={24} />
          ) : detail ? (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#334155' }}>
                {detail.voucher_no} — LKR {formatFuelMoney(detail.total_amount)} ({detail.transaction_count} transaction
                {(detail.transaction_count || 0) === 1 ? '' : 's'})
              </Typography>
              <div className="settlements-table-container-financial-cards">
                <table className="voucher-history-table-financial-cards">
                  <thead>
                    <tr>
                      <th>{personColumnLabel}</th>
                      <th>Fuel Date</th>
                      <th>Time</th>
                      <th>Fuel Details</th>
                      <th>Admin Approver</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.lines || []).map((line) => {
                      const parts = getFuelLineDisplayParts(line);
                      return (
                        <tr key={line.line_id || line.transaction_id}>
                          <td>{resolveVoucherDriverName(line)}</td>
                          <td>{parts.fuelDate}</td>
                          <td>{line.time || '-'}</td>
                          <td className="fuel-details-cell-financial-cards">
                            {formatFuelVoucherDescription(line)}
                          </td>
                          <td>{line.approved_by_name || '-'}</td>
                          <td>LKR {formatFuelMoney(line.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Box>
          ) : (
            <Typography color="text.secondary">Voucher not found</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {detail ? (
            <Button onClick={() => openVoucherPrint(detail)}>Print</Button>
          ) : null}
          <Button onClick={() => setSelectedId(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(approveConfirm)}
        onClose={() => !approving && setApproveConfirm(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: spmDialogPaperSx }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 2.5,
            pb: 1,
            fontWeight: 700,
            color: '#102739',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CheckCircleIcon sx={{ color: '#15803d', fontSize: 22 }} />
          Approve {fuelSourceLabel} Voucher
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.55 }}>
            Confirm system approval for voucher{' '}
            <strong>{approveConfirm?.voucher_no}</strong> totaling{' '}
            <strong>{formatLkr(approveConfirm?.total_amount)}</strong>.
          </Typography>
          {approveConfirm ? (
            <Box sx={spmVoucherSummaryBoxSx}>
              <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 0.5 }}>
                Voucher summary
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                {approveConfirm.transaction_count || 0} transaction
                {(approveConfirm.transaction_count || 0) === 1 ? '' : 's'} ·{' '}
                {getVoucherApprovalTypeLabel(approveConfirm)}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={spmDialogActionsSx}>
          <Button
            variant="outlined"
            onClick={() => setApproveConfirm(null)}
            disabled={approving}
            sx={{ textTransform: 'none', borderColor: '#cbd5e1', color: '#475569' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={submitApprove}
            disabled={approving}
            sx={{ textTransform: 'none', minWidth: 110, boxShadow: 'none' }}
          >
            {approving ? 'Approving...' : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(decline)}
        onClose={() => !declining && setDecline(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: spmDialogPaperSx }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 2.5,
            pb: 1,
            fontWeight: 700,
            color: '#102739',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CancelIcon sx={{ color: '#b91c1c', fontSize: 22 }} />
          Decline {fuelSourceLabel} Voucher
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.55, mb: 1.5 }}>
            Please provide a reason for declining this voucher. Finance will see the declined status
            and can create a new voucher if needed.
          </Typography>
          {decline?.row ? (
            <Box sx={{ ...spmVoucherSummaryBoxSx, mt: 0, mb: 2 }}>
              <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 0.5 }}>
                Voucher
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                {decline.row.voucher_no} · {formatLkr(decline.row.total_amount)} ·{' '}
                {decline.row.transaction_count || 0} transaction
                {(decline.row.transaction_count || 0) === 1 ? '' : 's'}
              </Typography>
            </Box>
          ) : null}
          <Typography
            component="label"
            htmlFor="spm-decline-reason"
            variant="caption"
            sx={{ display: 'block', fontWeight: 600, color: '#475569', mb: 0.75 }}
          >
            Decline reason
          </Typography>
          <TextField
            id="spm-decline-reason"
            autoFocus
            fullWidth
            multiline
            minRows={4}
            placeholder="Enter reason for declining this voucher..."
            value={decline?.reason || ''}
            onChange={(e) => setDecline((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
            disabled={declining}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                backgroundColor: '#fff',
                fontSize: '0.9rem',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={spmDialogActionsSx}>
          <Button
            variant="outlined"
            onClick={() => setDecline(null)}
            disabled={declining}
            sx={{ textTransform: 'none', borderColor: '#cbd5e1', color: '#475569' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={submitDecline}
            disabled={declining || !decline?.reason?.trim()}
            sx={{
              textTransform: 'none',
              minWidth: 110,
              boxShadow: 'none',
              '&.Mui-disabled': {
                backgroundColor: '#fecaca',
                color: '#fff',
              },
            }}
          >
            {declining ? 'Declining...' : 'Decline'}
          </Button>
        </DialogActions>
      </Dialog>

      {settlementProofPreviewUrl ? (
        <div
          className="modal-overlay-financial-cards settlement-proof-overlay-financial-cards"
          onClick={() => setSettlementProofPreviewUrl(null)}
        >
          <div
            className="settlement-proof-preview-modal-financial-cards"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-financial-cards">
              <h2>Settlement Proof</h2>
              <button
                type="button"
                className="modal-close-financial-cards"
                onClick={() => setSettlementProofPreviewUrl(null)}
              >
                ×
              </button>
            </div>
            <div className="settlement-proof-preview-body-financial-cards">
              <img
                src={settlementProofPreviewUrl}
                alt="Settlement proof"
                className="settlement-proof-preview-image-financial-cards"
              />
            </div>
          </div>
        </div>
      ) : null}

      {printVoucher ? (
        <TransportVoucherPrint
          voucher={printVoucher}
          onClose={() => setPrintVoucher(null)}
          onPrint={() => window.print()}
        />
      ) : null}

      <ToastContainer position="top-right" autoClose={4000} closeOnClick pauseOnHover />
    </div>
  );
};

export default StrategicFinanceApprovals;
