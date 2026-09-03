/**
 * MaintenanceFinance.jsx
 *
 * Professional redesign – Finance view for vehicle maintenance requests.
 * Full voucher flow: finance-approve → create voucher → MD approve → settle.
 */

import React, { useMemo, useState } from 'react';
import { CircularProgress } from '@mui/material';
import {
  FaFileInvoiceDollar,
  FaHistory,
  FaCheck,
  FaTimes,
  FaStamp,
  FaCashRegister,
  FaPaperPlane,
  FaUpload,
  FaWrench,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaMinusCircle,
} from 'react-icons/fa';
import {
  useCreateMaintenanceVoucherMutation,
  useApproveMaintenanceVoucherMutation,
  useDeclineMaintenanceVoucherMutation,
  useRecordMaintenanceVoucherPhysicalApprovalMutation,
  useSettleMaintenanceVoucherMutation,
  useGetMaintenanceVoucherHistoryQuery,
  useGetMaintenanceVoucherByIdQuery,
} from '../../../api/services NodeJs/maintenanceVoucherApi';
import {
  useFinanceDecideVehicleMaintenanceRequestMutation,
  useGetVehicleAppMaintenanceRequestsQuery,
} from '../../../api/services NodeJs/vehicleAppApi';
import { useGetUsersQuery } from '../../../api/services NodeJs/financialCardsApi';
import { useGetMyPermissionsQuery } from '../../../api/services NodeJs/featurePermissionsApi';
import { getUserData, isInternalDeveloper } from '../../../utils/authUtils';
import { FEATURE_CODES } from '../../../utils/featurePermissions';
import {
  voucherStatusLabel,
  getVoucherDecidedBy,
  getVoucherApprovalTypeLabel,
} from '../../finance/financialCards/fuelTransportVoucherUi';
import MaintenanceVoucherPrint from './MaintenanceVoucherPrint';
import '../../../styles/transportFinanceMaintenance.css';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getRollingMonthOptions(monthsBack = 36) {
  const now = new Date();
  return Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { value, label };
  });
}

function toDateOnly(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '-';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function fmtLkr(value) {
  return `LKR ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── chip helpers ─────────────────────────────────────────────────────────────

function HrChip({ row }) {
  const s = String(row?.hr_approval || row?.approval || 'p');
  if (s === 'a') return <span className="mf-chip mf-chip-hr-approved"><span className="mf-chip-dot" />HR Approved</span>;
  if (s === 'd') return <span className="mf-chip mf-chip-hr-declined"><span className="mf-chip-dot" />HR Declined</span>;
  return <span className="mf-chip mf-chip-hr-pending"><span className="mf-chip-dot" />Awaiting HR</span>;
}

function FinChip({ row }) {
  const s = String(row?.finance_approval || 'p');
  if (s === 'a') return <span className="mf-chip mf-chip-fin-approved"><span className="mf-chip-dot" />Fin Approved</span>;
  if (s === 'd') return <span className="mf-chip mf-chip-fin-declined"><span className="mf-chip-dot" />Fin Declined</span>;
  return <span className="mf-chip mf-chip-fin-pending"><span className="mf-chip-dot" />Fin Pending</span>;
}

function VoucherChip({ status }) {
  const map = {
    not_create:       ['mf-chip-v-none',       'Not Vouchered'],
    pending:          ['mf-chip-v-pending',     'Pending MD'],
    approved:         ['mf-chip-v-approved',    'Approved'],
    settled:          ['mf-chip-v-settled',     'Settled'],
    declined:         ['mf-chip-v-declined',    'Declined'],
    finance_declined: ['mf-chip-v-findecline',  'Fin Declined'],
  };
  const [cls, label] = map[status] || map.not_create;
  return <span className={`mf-chip ${cls}`}><span className="mf-chip-dot" />{label}</span>;
}

const ELIGIBLE_STATUSES = ['not_create', 'declined', 'finance_declined'];

// ─── component ───────────────────────────────────────────────────────────────

function MaintenanceFinance({
  embedded          = false,
  externalMonth,
  onMonthChange     = null,
  prefetchedRows    = null,
  prefetchedLoading = null,
}) {
  const userData = getUserData();
  const isDev    = isInternalDeveloper(userData);
  const userId   = Number(userData?.id || userData?.user_id) || 0;

  const { data: featurePermissionsData = {} } = useGetMyPermissionsQuery(undefined, { skip: !userId });
  const checkFeat = (code) => {
    if (isDev) return true;
    if (!featurePermissionsData || typeof featurePermissionsData !== 'object') return false;
    if (featurePermissionsData.features?.[code] === true) return true;
    const cats = featurePermissionsData.categories || featurePermissionsData;
    for (const cat in cats) {
      if (cat === 'paths' || cat === 'features') continue;
      if (Array.isArray(cats[cat]) && cats[cat].includes(code)) return true;
    }
    return false;
  };

  const canCreate  = checkFeat(FEATURE_CODES.MAINTENANCE_VOUCHER_CREATE);
  const canSettle  = checkFeat(FEATURE_CODES.MAINTENANCE_VOUCHER_SETTLE);

  // ── filters ────────────────────────────────────────────────────────────────
  const [internalMonth, setInternalMonth]         = useState('');
  const [vehicleFilter, setVehicleFilter]         = useState('');
  const [statusFilter, setStatusFilter]           = useState('all');
  const selectedMonth = typeof externalMonth === 'string' ? externalMonth : internalMonth;
  const monthOptions  = useMemo(() => getRollingMonthOptions(36), []);

  // ── data ───────────────────────────────────────────────────────────────────
  // Always subscribe so we can force-refetch after finance approve (shared RTK cache with parent).
  const {
    data: fetchedRows,
    isLoading: fetchedLoading,
    refetch: refetchRequests,
  } = useGetVehicleAppMaintenanceRequestsQuery(selectedMonth || '');

  // Instant UI patches after approve/decline until server refetch lands.
  const [rowOverrides, setRowOverrides] = useState({});

  const baseRows = fetchedRows != null
    ? fetchedRows
    : (Array.isArray(prefetchedRows) ? prefetchedRows : []);

  const rows = useMemo(
    () => (baseRows || []).map((row) => {
      const patch = rowOverrides[row.id];
      return patch ? { ...row, ...patch } : row;
    }),
    [baseRows, rowOverrides]
  );

  const isLoading = (fetchedLoading || Boolean(prefetchedLoading)) && !rows.length;

  const { data: voucherHistory = [], isLoading: historyLoading, refetch: refetchHistory } =
    useGetMaintenanceVoucherHistoryQuery();

  // ── selection ──────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleId = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // ── history panel ──────────────────────────────────────────────────────────
  const [showHistory, setShowHistory]   = useState(false);
  const [historyTab, setHistoryTab]     = useState('all');

  // ── modals state ───────────────────────────────────────────────────────────
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [declineModal,  setDeclineModal]  = useState(null);  // { voucherId }
  const [declineReason, setDeclineReason] = useState('');
  const [declineError,  setDeclineError]  = useState('');
  const [physicalModal, setPhysicalModal] = useState(null);  // { voucherId }
  const [physApproverId, setPhysApproverId] = useState('');
  const [physImageUri,   setPhysImageUri]   = useState(null);
  const [physImageFile,  setPhysImageFile]  = useState(null);
  const [physError,      setPhysError]      = useState('');
  const [settleModal,   setSettleModal]   = useState(null);  // { voucherId }
  const [settleProofUri,  setSettleProofUri]  = useState(null);
  const [settleProofFile, setSettleProofFile] = useState(null);
  const [settleNote,      setSettleNote]      = useState('');
  const [settleError,     setSettleError]     = useState('');
  const [finDecisionModal, setFinDecisionModal] = useState(null); // { row, approval }
  const [finDeclineReason, setFinDeclineReason] = useState('');
  const [finDeclineError,  setFinDeclineError]  = useState('');
  const [notice, setNotice]       = useState(null); // { title, message, tone }
  const [printVoucher, setPrintVoucher] = useState(null);
  const [detailVoucherId, setDetailVoucherId] = useState(null);
  const { data: detailVoucherData } = useGetMaintenanceVoucherByIdQuery(detailVoucherId, { skip: !detailVoucherId });

  // ── mutations ──────────────────────────────────────────────────────────────
  const [createVoucher,    { isLoading: creating }]   = useCreateMaintenanceVoucherMutation();
  const [approveVoucher,   { isLoading: approving }]  = useApproveMaintenanceVoucherMutation();
  const [declineVoucher,   { isLoading: declining }]  = useDeclineMaintenanceVoucherMutation();
  const [physApproval,     { isLoading: physing }]    = useRecordMaintenanceVoucherPhysicalApprovalMutation();
  const [settleVoucher,    { isLoading: settling }]   = useSettleMaintenanceVoucherMutation();
  const [finDecide,        { isLoading: finDeciding }]= useFinanceDecideVehicleMaintenanceRequestMutation();

  const { data: usersData } = useGetUsersQuery();
  const mdUsers = useMemo(
    () => (usersData || []).filter((u) => String(u.job_role || '').trim().toLowerCase() === 'md' && Number(u.activated) !== 0),
    [usersData]
  );

  // ── derived ────────────────────────────────────────────────────────────────
  const vehicleOptions = useMemo(
    () => [...new Set((rows || []).map((r) => String(r?.vehicle_no || '').trim()).filter(Boolean))].sort(),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const vKey = vehicleFilter.trim().toLowerCase();
    return (rows || []).filter((row) => {
      const hr   = String(row?.hr_approval || row?.approval || 'p');
      if (hr === 'd') return false;
      const fin  = String(row?.finance_approval || 'p');
      const paid = Number(row?.finance_paid || 0) === 1;
      const vs   = String(row?.voucher_status || 'not_create');

      if (statusFilter === 'awaiting_hr')           { if (hr !== 'p') return false; }
      else if (statusFilter === 'pending_finance')  { if (!(hr === 'a' && fin === 'p')) return false; }
      else if (statusFilter === 'approved_not_voucher') { if (!(fin === 'a' && ELIGIBLE_STATUSES.includes(vs))) return false; }
      else if (statusFilter === 'voucher_pending')  { if (vs !== 'pending') return false; }
      else if (statusFilter === 'voucher_approved') { if (vs !== 'approved') return false; }
      else if (statusFilter === 'settled')          { if (!paid && vs !== 'settled') return false; }
      else if (statusFilter === 'fin_declined')     { if (fin !== 'd') return false; }

      if (vKey && String(row?.vehicle_no || '').trim().toLowerCase() !== vKey) return false;
      return true;
    });
  }, [rows, vehicleFilter, statusFilter]);

  const eligibleSelected = useMemo(
    () => (rows || []).filter((row) => {
      const hr   = String(row?.hr_approval || row?.approval || 'p');
      const fin  = String(row?.finance_approval || 'p');
      const paid = Number(row?.finance_paid || 0) === 1;
      const vs   = String(row?.voucher_status || 'not_create');
      return hr === 'a' && fin === 'a' && !paid && ELIGIBLE_STATUSES.includes(vs) && selectedIds.includes(row.id);
    }),
    [rows, selectedIds]
  );

  const histFiltered = useMemo(() => {
    if (historyTab === 'pending')  return voucherHistory.filter((v) => v.status === 'pending');
    if (historyTab === 'approved') return voucherHistory.filter((v) => v.status === 'approved' && !v.settled);
    if (historyTab === 'settled')  return voucherHistory.filter((v) => Number(v.settled) === 1);
    if (historyTab === 'declined') return voucherHistory.filter((v) => v.status === 'declined');
    return voucherHistory;
  }, [voucherHistory, historyTab]);

  const kpi = useMemo(() => ({
    awaitingHr:        rows.filter((r) => String(r?.hr_approval || r?.approval || 'p') === 'p').length,
    pendingFin:        rows.filter((r) => String(r?.hr_approval || r?.approval || 'p') === 'a' && String(r?.finance_approval || 'p') === 'p').length,
    eligibleVoucher:   rows.filter((r) => String(r?.finance_approval || 'p') === 'a' && ELIGIBLE_STATUSES.includes(String(r?.voucher_status || 'not_create'))).length,
    voucherPending:    voucherHistory.filter((v) => v.status === 'pending').length,
    voucherApproved:   voucherHistory.filter((v) => v.status === 'approved' && !v.settled).length,
    settled:           rows.filter((r) => Number(r?.finance_paid || 0) === 1).length,
  }), [rows, voucherHistory]);

  const pendingOrApprovedCount = kpi.voucherPending + kpi.voucherApproved;

  // ── handlers ───────────────────────────────────────────────────────────────
  const updateMonth = (v) => { if (typeof onMonthChange === 'function') { onMonthChange(v); } else { setInternalMonth(v); } };
  const showNotice = (title, message, tone = 'success') => setNotice({ title, message, tone });

  const handleCreateVoucher = async () => {
    if (!canCreate) { showNotice('Access Denied', 'Enable Maintenance Voucher Create in Auth Controls.', 'error'); return; }
    if (!eligibleSelected.length) return;
    try {
      const result = await createVoucher({ maintenance_request_ids: eligibleSelected.map((r) => r.id) }).unwrap();
      setConfirmCreateOpen(false);
      setSelectedIds([]);
      setDetailVoucherId(result.id);
      setPrintVoucher(result);
      await Promise.all([refetchHistory(), refetchRequests()]);
      showNotice('Voucher Created', `${result.voucher_no} created and pending MD approval.`);
    } catch (e) {
      showNotice('Error', e?.data?.message || e?.message || 'Failed to create voucher', 'error');
    }
  };

  const handleApprove = async (voucherId) => {
    try {
      await approveVoucher(voucherId).unwrap();
      await Promise.all([refetchHistory(), refetchRequests()]);
      showNotice('Approved', 'Voucher approved successfully.');
    } catch (e) { showNotice('Error', e?.data?.message || e?.message || 'Failed', 'error'); }
  };

  const openDecline = (voucherId) => { setDeclineModal({ voucherId }); setDeclineReason(''); setDeclineError(''); };
  const submitDecline = async () => {
    if (!declineReason.trim()) { setDeclineError('Decline reason is required.'); return; }
    try {
      await declineVoucher({ id: declineModal.voucherId, reason: declineReason.trim() }).unwrap();
      setDeclineModal(null);
      await Promise.all([refetchHistory(), refetchRequests()]);
      showNotice('Declined', 'Voucher declined.');
    } catch (e) { setDeclineError(e?.data?.message || e?.message || 'Failed'); }
  };

  const openPhysical = (voucherId) => { setPhysicalModal({ voucherId }); setPhysApproverId(''); setPhysImageFile(null); setPhysImageUri(null); setPhysError(''); };
  const submitPhysical = async () => {
    if (!physApproverId) { setPhysError('Select an MD approver.'); return; }
    if (!physImageUri)   { setPhysError('Signed voucher image is required.'); return; }
    try {
      await physApproval({ id: physicalModal.voucherId, approved_by: Number(physApproverId), physical_approval_image: physImageUri }).unwrap();
      setPhysicalModal(null);
      await Promise.all([refetchHistory(), refetchRequests()]);
      showNotice('Physical Approval', 'Voucher approved via physical signature.');
    } catch (e) { setPhysError(e?.data?.message || e?.message || 'Failed'); }
  };

  const openSettle = (voucherId) => { setSettleModal({ voucherId }); setSettleProofFile(null); setSettleProofUri(null); setSettleNote(''); setSettleError(''); };
  const submitSettle = async () => {
    if (!canSettle)     { setSettleError('Enable Maintenance Voucher Settle in Auth Controls.'); return; }
    if (!settleProofUri){ setSettleError('Payment proof is required.'); return; }
    try {
      await settleVoucher({ id: settleModal.voucherId, payment_image: settleProofUri, payment_note: settleNote || null }).unwrap();
      setSettleModal(null);
      await Promise.all([refetchHistory(), refetchRequests()]);
      showNotice('Settled', 'Voucher settled. Linked requests marked as paid.');
    } catch (e) { setSettleError(e?.data?.message || e?.message || 'Failed'); }
  };

  const openFinDecision = (row, approval) => { setFinDecisionModal({ row, approval }); setFinDeclineReason(''); setFinDeclineError(''); };
  const submitFinDecision = async () => {
    const { row, approval } = finDecisionModal;
    if (approval === 'd' && !finDeclineReason.trim()) { setFinDeclineError('Decline reason is required.'); return; }
    try {
      await finDecide({
        id: row.id,
        approval,
        decline_reason: approval === 'd' ? finDeclineReason.trim() : null,
      }).unwrap();

      // Optimistic patch so "Select to create voucher" appears immediately.
      setRowOverrides((prev) => ({
        ...prev,
        [row.id]: {
          finance_approval: approval,
          ...(approval === 'd'
            ? { finance_decline_reason: finDeclineReason.trim() }
            : { voucher_status: String(row.voucher_status || 'not_create') }),
        },
      }));
      setFinDecisionModal(null);
      showNotice('Done', `Request #${row.id} finance ${approval === 'a' ? 'approved' : 'declined'}.`);

      // Force list refresh (tag invalidation alone can lag behind the UI).
      try {
        await refetchRequests();
        setRowOverrides((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
      } catch (_) { /* keep optimistic patch if refetch fails */ }
    } catch (e) {
      setFinDeclineError(e?.data?.message || e?.message || 'Failed');
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`mf-root${embedded ? ' mf-embedded' : ''}`}>

      {/* ── Page header ──────────────────────────────────── */}
      <div className="mf-header">
        <div className="mf-header-left">
          <h2>Maintenance Finance Queue</h2>
          <p>Finance approval → voucher creation → MD approval → settlement</p>
        </div>
        <div className="mf-header-actions">
          {selectedIds.length > 0 && (
            <button type="button" className="mf-btn mf-btn-primary" onClick={() => setConfirmCreateOpen(true)} disabled={!eligibleSelected.length}>
              <FaFileInvoiceDollar />
              Create Voucher ({eligibleSelected.length})
            </button>
          )}
          <button
            type="button"
            className={`mf-btn mf-btn-secondary${showHistory ? ' mf-btn-active' : ''}`}
            onClick={() => setShowHistory((p) => !p)}
          >
            <FaHistory />
            Voucher History
            {pendingOrApprovedCount > 0 && <span className="mf-badge">{pendingOrApprovedCount}</span>}
          </button>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────── */}
      <div className="mf-kpi-strip">
        <div className="mf-kpi-card mf-kpi-warning">
          <span className="mf-kpi-label">Awaiting HR</span>
          <span className="mf-kpi-value">{kpi.awaitingHr}</span>
        </div>
        <div className="mf-kpi-card mf-kpi-warning">
          <span className="mf-kpi-label">Pending Finance</span>
          <span className="mf-kpi-value">{kpi.pendingFin}</span>
        </div>
        <div className="mf-kpi-card">
          <span className="mf-kpi-label">Create Voucher</span>
          <span className="mf-kpi-value">{kpi.eligibleVoucher}</span>
        </div>
        <div className={`mf-kpi-card${kpi.voucherPending > 0 ? ' mf-kpi-warning' : ''}`}>
          <span className="mf-kpi-label">Pending MD</span>
          <span className="mf-kpi-value">{kpi.voucherPending}</span>
        </div>
        <div className={`mf-kpi-card${kpi.voucherApproved > 0 ? ' mf-kpi-info' : ''}`}>
          <span className="mf-kpi-label">Settle Now</span>
          <span className="mf-kpi-value">{kpi.voucherApproved}</span>
        </div>
        <div className="mf-kpi-card mf-kpi-success">
          <span className="mf-kpi-label">Settled / Paid</span>
          <span className="mf-kpi-value">{kpi.settled}</span>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="mf-filter-bar">
        <div className="mf-filter-group">
          <span className="mf-filter-label">Month</span>
          <select className="mf-select" value={selectedMonth} onChange={(e) => updateMonth(e.target.value)}>
            <option value="">All Months</option>
            {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="mf-filter-group">
          <span className="mf-filter-label">Status</span>
          <select className="mf-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="awaiting_hr">Awaiting HR Approval</option>
            <option value="pending_finance">Pending Finance Review</option>
            <option value="approved_not_voucher">Finance Approved — Create Voucher</option>
            <option value="voucher_pending">Voucher Pending MD Approval</option>
            <option value="voucher_approved">Voucher Approved — Settle</option>
            <option value="settled">Settled / Paid</option>
            <option value="fin_declined">Finance Declined</option>
          </select>
        </div>
        <div className="mf-filter-group">
          <span className="mf-filter-label">Vehicle</span>
          <select className="mf-select" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="">All Vehicles</option>
            {vehicleOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* ── Voucher history panel ─────────────────────────── */}
      {showHistory ? (
        <div className="mf-section-card" style={{ marginBottom: 16 }}>
          <div className="mf-section-header">
            <div className="mf-section-title">
              <div className="mf-section-icon"><FaHistory /></div>
              Voucher History
            </div>
            <div className="mf-section-header-right">
              <div className="mf-history-filter-row">
                {['all', 'pending', 'approved', 'settled', 'declined'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`mf-history-filter-pill${historyTab === t ? ' active' : ''}`}
                    onClick={() => setHistoryTab(t)}
                  >
                    {t === 'all' ? 'All' : t === 'approved' ? 'Approved (unsettled)' : t.charAt(0).toUpperCase() + t.slice(1)}
                    {t === 'pending' && kpi.voucherPending > 0 ? <span className="mf-badge">{kpi.voucherPending}</span> : null}
                    {t === 'approved' && kpi.voucherApproved > 0 ? <span className="mf-badge">{kpi.voucherApproved}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {historyLoading ? (
            <div className="mf-loading"><CircularProgress size={22} /><span>Loading vouchers…</span></div>
          ) : (
            <div className="mf-table-wrap">
              <table className="mf-table">
                <thead>
                  <tr>
                    <th>Voucher No</th>
                    <th>Created</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Approval</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {histFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="mf-table-empty">
                      <div className="mf-table-empty-inner">
                        <span className="mf-table-empty-icon">📄</span>
                        <span className="mf-table-empty-text">No vouchers in this view</span>
                      </div>
                    </td></tr>
                  ) : histFiltered.map((v) => {
                    const isSettled  = Number(v.settled) === 1;
                    const vsDisplay  = isSettled ? 'settled' : v.status;
                    const canApprove = v.status === 'pending';
                    const canSettleV = v.status === 'approved' && !isSettled;
                    return (
                      <tr key={v.id}>
                        <td>
                          <button type="button" className="mf-voucher-no-btn" onClick={() => { setDetailVoucherId(v.id); setPrintVoucher(v); }}>
                            {v.voucher_no}
                          </button>
                        </td>
                        <td>{toDateOnly(v.created_at)}</td>
                        <td style={{ fontWeight: 600 }}>{v.transaction_count || 0}</td>
                        <td style={{ fontWeight: 700 }}>{fmtLkr(v.total_amount)}</td>
                        <td><VoucherChip status={vsDisplay} /></td>
                        <td>
                          <div style={{ fontSize: 12, color: '#5b7a90' }}>
                            {getVoucherApprovalTypeLabel(v)}
                            {getVoucherDecidedBy(v) !== '-' ? <div style={{ fontWeight: 600, color: '#1e3348', marginTop: 2 }}>{getVoucherDecidedBy(v)}</div> : null}
                          </div>
                        </td>
                        <td className="mf-action-cell">
                          <div className="mf-actions-row">
                            {canApprove ? (
                              <>
                                <button type="button" className="mf-btn mf-btn-success mf-btn-sm" disabled={approving} onClick={() => handleApprove(v.id)}>
                                  <FaCheck /> Approve
                                </button>
                                <button type="button" className="mf-btn mf-btn-secondary mf-btn-sm" onClick={() => openPhysical(v.id)}>
                                  <FaStamp /> Physical
                                </button>
                                <button type="button" className="mf-btn mf-btn-danger mf-btn-sm" onClick={() => openDecline(v.id)}>
                                  <FaTimes /> Decline
                                </button>
                              </>
                            ) : canSettleV ? (
                              <button type="button" className="mf-btn mf-btn-primary mf-btn-sm" onClick={() => openSettle(v.id)}>
                                <FaCashRegister /> Settle
                              </button>
                            ) : isSettled ? (
                              <span className="mf-chip mf-chip-v-settled"><FaCheckCircle /> Settled</span>
                            ) : (
                              <span className="mf-muted">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Requests table ───────────────────────────────── */}
      <div className="mf-section-card">
        <div className="mf-section-header">
          <div className="mf-section-title">
            <div className="mf-section-icon"><FaWrench /></div>
            Maintenance Requests
            {filteredRows.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: '#7a9ab0', marginLeft: 4 }}>
                ({filteredRows.length} {filteredRows.length === 1 ? 'record' : 'records'})
              </span>
            )}
          </div>
          {selectedIds.length > 0 && (
            <div className="mf-section-header-right">
              <span style={{ fontSize: 12, color: '#5b7a90' }}>
                {eligibleSelected.length} eligible of {selectedIds.length} selected
              </span>
              <button type="button" className="mf-btn mf-btn-ghost mf-btn-sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </button>
            </div>
          )}
        </div>

        {isLoading && !rows.length ? (
          <div className="mf-loading"><CircularProgress size={28} /><span>Loading maintenance records…</span></div>
        ) : (
          <div className="mf-table-wrap">
            <table className="mf-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>#</th>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Category</th>
                  <th>Cost (LKR)</th>
                  <th>HR Status</th>
                  <th>Finance</th>
                  <th>Voucher</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={11} className="mf-table-empty">
                    <div className="mf-table-empty-inner">
                      <span className="mf-table-empty-icon">🔧</span>
                      <span className="mf-table-empty-text">No records match the current filters</span>
                    </div>
                  </td></tr>
                ) : filteredRows.map((row) => {
                  const hr      = String(row?.hr_approval || row?.approval || 'p');
                  const fin     = String(row?.finance_approval || 'p');
                  const paid    = Number(row?.finance_paid || 0) === 1;
                  const vs      = String(row?.voucher_status || 'not_create');
                  const isEligible = hr === 'a' && fin === 'a' && !paid && ELIGIBLE_STATUSES.includes(vs);
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <tr key={row.id} className={isSelected ? 'mf-row-selected' : ''}>
                      <td>
                        {isEligible ? (
                          <input type="checkbox" className="mf-checkbox" checked={isSelected} onChange={() => toggleId(row.id)} />
                        ) : null}
                      </td>
                      <td style={{ fontWeight: 600, color: '#5b7a90' }}>#{row.id}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{toDateOnly(row.date)}</td>
                      <td style={{ fontWeight: 600 }}>{row.vehicle_no || '-'}</td>
                      <td>{row.driver_name || '-'}</td>
                      <td>{row.category_name || '-'}</td>
                      <td style={{ fontWeight: 700 }}>
                        {row.cost_estimation != null ? Number(row.cost_estimation).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td><HrChip row={row} /></td>
                      <td><FinChip row={row} /></td>
                      <td>
                        <VoucherChip status={paid ? 'settled' : vs} />
                        {row.voucher_no ? <div className="mf-cell-sub">{row.voucher_no}</div> : null}
                      </td>
                      <td className="mf-action-cell">
                        {hr !== 'a' ? (
                          <span className="mf-muted">Awaiting HR</span>
                        ) : fin === 'p' ? (
                          <div className="mf-actions-row">
                            <button type="button" className="mf-btn mf-btn-success mf-btn-sm" disabled={finDeciding} onClick={() => openFinDecision(row, 'a')}>
                              <FaCheck /> Approve
                            </button>
                            <button type="button" className="mf-btn mf-btn-danger mf-btn-sm" disabled={finDeciding} onClick={() => openFinDecision(row, 'd')}>
                              <FaTimes /> Decline
                            </button>
                          </div>
                        ) : fin === 'd' ? (
                          <span className="mf-muted">Fin Declined</span>
                        ) : paid ? (
                          <span className="mf-chip mf-chip-v-settled"><FaCheckCircle /> Paid</span>
                        ) : isEligible ? (
                          <span className="mf-muted">Select to create voucher</span>
                        ) : vs === 'pending' ? (
                          <span className="mf-muted"><FaClock /> Pending MD</span>
                        ) : vs === 'approved' ? (
                          <button type="button" className="mf-btn mf-btn-primary mf-btn-sm" onClick={() => openSettle(row.voucher_id)}>
                            <FaCashRegister /> Settle
                          </button>
                        ) : (
                          <span className="mf-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: Confirm Create Voucher ─────────────────── */}
      {confirmCreateOpen ? (
        <div className="mf-overlay" role="presentation" onClick={() => setConfirmCreateOpen(false)}>
          <div className="mf-modal mf-modal-md" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mf-modal-head">
              <div className="mf-modal-head-icon"><FaFileInvoiceDollar /></div>
              <div className="mf-modal-head-text">
                <h3 className="mf-modal-title">Create Maintenance Voucher</h3>
                <p className="mf-modal-subtitle">{eligibleSelected.length} request(s) will be bundled</p>
              </div>
              <button type="button" className="mf-modal-close-btn" onClick={() => setConfirmCreateOpen(false)}>×</button>
            </div>
            <div className="mf-modal-body">
              <div className="mf-summary-box">
                <div className="mf-summary-item">
                  <span className="mf-summary-label">Requests</span>
                  <span className="mf-summary-value">{eligibleSelected.length}</span>
                </div>
                <div className="mf-summary-item">
                  <span className="mf-summary-label">Total Amount</span>
                  <span className="mf-summary-value">{fmtLkr(eligibleSelected.reduce((s, r) => s + Number(r.cost_estimation || 0), 0))}</span>
                </div>
              </div>
              <table className="mf-mini-table">
                <thead><tr><th>ID</th><th>Vehicle</th><th>Driver</th><th>Category</th><th>Cost (LKR)</th></tr></thead>
                <tbody>
                  {eligibleSelected.map((r) => (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td>{r.vehicle_no || '-'}</td>
                      <td>{r.driver_name || '-'}</td>
                      <td>{r.category_name || '-'}</td>
                      <td>{Number(r.cost_estimation || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: 0, fontSize: 12.5, color: '#5b7a90', lineHeight: 1.5 }}>
                After creation the voucher will be sent to MD for system or physical approval before settlement.
              </p>
            </div>
            <div className="mf-modal-footer">
              <button type="button" className="mf-btn mf-btn-secondary" onClick={() => setConfirmCreateOpen(false)} disabled={creating}>Cancel</button>
              <button type="button" className="mf-btn mf-btn-primary" onClick={handleCreateVoucher} disabled={creating}>
                {creating ? <><CircularProgress size={14} style={{ color: '#fff', marginRight: 6 }} />Creating…</> : <><FaPaperPlane /> Confirm &amp; Create</>}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── MODAL: Finance Decision ────────────────────────── */}
      {finDecisionModal ? (
        <div className="mf-overlay" role="presentation" onClick={() => setFinDecisionModal(null)}>
          <div className="mf-modal mf-modal-sm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className={`mf-modal-head ${finDecisionModal.approval === 'd' ? 'mf-notice-modal-head-error' : ''}`}>
              <div className="mf-modal-head-icon">
                {finDecisionModal.approval === 'a' ? <FaCheckCircle /> : <FaTimesCircle />}
              </div>
              <div className="mf-modal-head-text">
                <h3 className="mf-modal-title">Finance {finDecisionModal.approval === 'a' ? 'Approve' : 'Decline'}</h3>
                <p className="mf-modal-subtitle">Request #{finDecisionModal.row?.id} · {finDecisionModal.row?.vehicle_no || '-'}</p>
              </div>
              <button type="button" className="mf-modal-close-btn" onClick={() => setFinDecisionModal(null)}>×</button>
            </div>
            <div className="mf-modal-body">
              {finDecisionModal.approval === 'a' ? (
                <div className="mf-summary-box">
                  <div className="mf-summary-item"><span className="mf-summary-label">Driver</span><span className="mf-summary-value">{finDecisionModal.row?.driver_name || '-'}</span></div>
                  <div className="mf-summary-item"><span className="mf-summary-label">Category</span><span className="mf-summary-value">{finDecisionModal.row?.category_name || '-'}</span></div>
                  <div className="mf-summary-item"><span className="mf-summary-label">Cost</span><span className="mf-summary-value">{fmtLkr(finDecisionModal.row?.cost_estimation)}</span></div>
                </div>
              ) : (
                <div className="mf-field">
                  <label className="mf-field-label" htmlFor="fin-dec-reason">Decline Reason <span>*</span></label>
                  <textarea id="fin-dec-reason" className="mf-textarea" value={finDeclineReason} onChange={(e) => { setFinDeclineReason(e.target.value); setFinDeclineError(''); }} placeholder="State the reason for declining this maintenance request" />
                </div>
              )}
              {finDeclineError ? <div className="mf-error-msg">⚠ {finDeclineError}</div> : null}
            </div>
            <div className="mf-modal-footer">
              <button type="button" className="mf-btn mf-btn-secondary" onClick={() => setFinDecisionModal(null)} disabled={finDeciding}>Cancel</button>
              <button type="button" className={`mf-btn ${finDecisionModal.approval === 'a' ? 'mf-btn-primary' : 'mf-btn-danger'}`} onClick={submitFinDecision} disabled={finDeciding}>
                {finDeciding ? 'Saving…' : (finDecisionModal.approval === 'a' ? 'Confirm Approval' : 'Confirm Decline')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── MODAL: Decline Voucher ────────────────────────── */}
      {declineModal ? (
        <div className="mf-overlay" role="presentation" onClick={() => setDeclineModal(null)}>
          <div className="mf-modal mf-modal-sm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mf-modal-head mf-notice-modal-head-error">
              <div className="mf-modal-head-icon"><FaMinusCircle /></div>
              <div className="mf-modal-head-text">
                <h3 className="mf-modal-title">Decline Voucher</h3>
                <p className="mf-modal-subtitle">MD role required to decline</p>
              </div>
              <button type="button" className="mf-modal-close-btn" onClick={() => setDeclineModal(null)}>×</button>
            </div>
            <div className="mf-modal-body">
              <div className="mf-field">
                <label className="mf-field-label" htmlFor="vdecline-reason">Decline Reason <span>*</span></label>
                <textarea id="vdecline-reason" className="mf-textarea" value={declineReason} onChange={(e) => { setDeclineReason(e.target.value); setDeclineError(''); }} placeholder="Explain why this voucher is being declined. Finance can re-voucher after correction." />
              </div>
              {declineError ? <div className="mf-error-msg">⚠ {declineError}</div> : null}
            </div>
            <div className="mf-modal-footer">
              <button type="button" className="mf-btn mf-btn-secondary" onClick={() => setDeclineModal(null)} disabled={declining}>Cancel</button>
              <button type="button" className="mf-btn mf-btn-danger" onClick={submitDecline} disabled={declining}>
                {declining ? 'Declining…' : <><FaTimes /> Confirm Decline</>}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── MODAL: Physical Approval ──────────────────────── */}
      {physicalModal ? (
        <div className="mf-overlay" role="presentation" onClick={() => setPhysicalModal(null)}>
          <div className="mf-modal mf-modal-sm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mf-modal-head">
              <div className="mf-modal-head-icon"><FaStamp /></div>
              <div className="mf-modal-head-text">
                <h3 className="mf-modal-title">Record Physical Approval</h3>
                <p className="mf-modal-subtitle">Upload signed voucher image + select MD approver</p>
              </div>
              <button type="button" className="mf-modal-close-btn" onClick={() => setPhysicalModal(null)}>×</button>
            </div>
            <div className="mf-modal-body">
              <div className="mf-field">
                <label className="mf-field-label" htmlFor="phys-approver">MD Approver <span>*</span></label>
                <select id="phys-approver" className="mf-input mf-select-full" value={physApproverId} onChange={(e) => { setPhysApproverId(e.target.value); setPhysError(''); }}>
                  <option value="">— Select MD User —</option>
                  {mdUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="mf-field">
                <label className="mf-field-label">Signed Voucher Image <span>*</span></label>
                <div className={`mf-file-upload-area${physImageFile ? ' has-file' : ''}`}>
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setPhysImageFile(f); setPhysImageUri(await fileToDataUri(f)); setPhysError('');
                  }} />
                  {physImageFile ? (
                    <span className="mf-file-name-pill">✓ {physImageFile.name}</span>
                  ) : (
                    <>
                      <div className="mf-file-upload-icon">📷</div>
                      <div className="mf-file-upload-text">Click to upload or drag image here</div>
                      <div className="mf-file-upload-sub">JPEG, PNG, WEBP</div>
                    </>
                  )}
                </div>
              </div>
              {physError ? <div className="mf-error-msg">⚠ {physError}</div> : null}
            </div>
            <div className="mf-modal-footer">
              <button type="button" className="mf-btn mf-btn-secondary" onClick={() => setPhysicalModal(null)} disabled={physing}>Cancel</button>
              <button type="button" className="mf-btn mf-btn-primary" onClick={submitPhysical} disabled={physing}>
                {physing ? 'Saving…' : <><FaStamp /> Record Approval</>}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── MODAL: Settle Voucher ─────────────────────────── */}
      {settleModal ? (
        <div className="mf-overlay" role="presentation" onClick={() => setSettleModal(null)}>
          <div className="mf-modal mf-modal-sm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="mf-modal-head mf-notice-modal-head-success">
              <div className="mf-modal-head-icon"><FaCashRegister /></div>
              <div className="mf-modal-head-text">
                <h3 className="mf-modal-title">Settle Voucher</h3>
                <p className="mf-modal-subtitle">Upload payment proof to mark all linked requests as paid</p>
              </div>
              <button type="button" className="mf-modal-close-btn" onClick={() => setSettleModal(null)}>×</button>
            </div>
            <div className="mf-modal-body">
              <div className="mf-field">
                <label className="mf-field-label">Payment Proof <span>*</span></label>
                <div className={`mf-file-upload-area${settleProofFile ? ' has-file' : ''}`}>
                  <input type="file" accept="image/*,.pdf" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setSettleProofFile(f); setSettleProofUri(await fileToDataUri(f)); setSettleError('');
                  }} />
                  {settleProofFile ? (
                    <span className="mf-file-name-pill">✓ {settleProofFile.name}</span>
                  ) : (
                    <>
                      <div className="mf-file-upload-icon"><FaUpload /></div>
                      <div className="mf-file-upload-text">Upload payment receipt / bank confirmation</div>
                      <div className="mf-file-upload-sub">JPEG, PNG, PDF accepted</div>
                    </>
                  )}
                </div>
              </div>
              <div className="mf-field">
                <label className="mf-field-label" htmlFor="settle-note">Payment Note <span style={{ fontWeight: 400, color: '#7a9ab0', fontSize: 11 }}>(optional)</span></label>
                <input id="settle-note" type="text" className="mf-input" value={settleNote} onChange={(e) => setSettleNote(e.target.value)} placeholder="Bank ref no., cheque no., transfer ID…" />
              </div>
              {settleError ? <div className="mf-error-msg">⚠ {settleError}</div> : null}
            </div>
            <div className="mf-modal-footer">
              <button type="button" className="mf-btn mf-btn-secondary" onClick={() => setSettleModal(null)} disabled={settling}>Cancel</button>
              <button type="button" className="mf-btn mf-btn-primary" onClick={submitSettle} disabled={settling}>
                {settling ? <><CircularProgress size={14} style={{ color: '#fff', marginRight: 6 }} />Settling…</> : <><FaCheckCircle /> Submit Settlement</>}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── MODAL: Notice ─────────────────────────────────── */}
      {notice ? (
        <div className="mf-overlay" role="presentation" onClick={() => setNotice(null)}>
          <div className="mf-modal mf-modal-sm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className={`mf-modal-head ${notice.tone === 'error' ? 'mf-notice-modal-head-error' : 'mf-notice-modal-head-success'}`}>
              <div className="mf-modal-head-icon">
                {notice.tone === 'error' ? <FaTimesCircle /> : <FaCheckCircle />}
              </div>
              <div className="mf-modal-head-text">
                <h3 className="mf-modal-title">{notice.title}</h3>
              </div>
              <button type="button" className="mf-modal-close-btn" onClick={() => setNotice(null)}>×</button>
            </div>
            <div className="mf-modal-body">
              <p style={{ margin: 0, fontSize: 14, color: '#1e3348', lineHeight: 1.6 }}>{notice.message}</p>
            </div>
            <div className="mf-modal-footer">
              <button type="button" className="mf-btn mf-btn-primary" onClick={() => setNotice(null)}>OK</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Print preview ─────────────────────────────────── */}
      {printVoucher ? (
        <MaintenanceVoucherPrint
          voucher={detailVoucherData || printVoucher}
          onClose={() => { setPrintVoucher(null); setDetailVoucherId(null); }}
        />
      ) : null}

    </div>
  );
}

export default MaintenanceFinance;
