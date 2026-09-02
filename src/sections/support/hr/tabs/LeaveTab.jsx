import React, { useEffect, useMemo, useRef, useState } from 'react';
import { hrSupportRequest, hrSupportUpload } from '../api/hrSupportApi';
import { buildEmployeeLeaveBalanceCards } from '../utils/employeeLeaveBalances';
import {
  DEFAULT_SHORT_LEAVE_MINUTES,
  leaveRequestStatusLabel,
  overlookingStatusLabel,
  requestModeLabel,
  SHORT_LEAVE_MONTHLY_CAP,
} from '../utils/hrStatusLabels';
import LeaveBalanceCards from '../components/LeaveBalanceCards';
import ApprovalRequestCard from '../components/ApprovalRequestCard';
import RejectModal from '../components/RejectModal';
import { filterDepartmentEmployees, formatDepartmentEmployeeLabel } from '../utils/departmentEmployees';
import {
  getApprovalKind,
  getApprovalTypeBadge,
  isLateDepartureApproval,
} from '../utils/hrApprovals';

const SESSION_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening / Afternoon' },
];

const REQUEST_MODES = [
  { value: 'full_day', label: 'Full Day' },
  { value: 'half_day', label: 'Half Day' },
];

function isShortLeaveTypeCode(code) {
  return String(code || '') === 'short_leave';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return 'hrsup-badge--green';
  if (s.startsWith('pending')) return 'hrsup-badge--yellow';
  if (s === 'rejected') return 'hrsup-badge--red';
  if (s === 'cancelled' || s === 'canceled') return 'hrsup-badge--gray';
  return 'hrsup-badge--gray';
}

export default function LeaveTab({
  token,
  leaveTypes,
  leaveForm,
  setLeaveForm,
  submitLeaveRequest,
  myRequests,
  approvals,
  actApproval,
  canApproveLeaves,
  departmentEmployees,
  departmentName,
  refreshing,
  refresh,
  canRequestLeave,
  attendancePolicy,
  balances,
  policySummary,
}) {
  const [leaveSubTab, setLeaveSubTab] = useState('request');
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [officerSearch, setOfficerSearch] = useState('');
  const [officerPickerOpen, setOfficerPickerOpen] = useState(false);
  const [dayEstimate, setDayEstimate] = useState(null);
  const fileInputRef = useRef(null);
  const formTopRef = useRef(null);
  const submitWrapRef = useRef(null);

  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const shortLeaveCap = Number(attendancePolicy?.shortLeaveMonthlyCap ?? SHORT_LEAVE_MONTHLY_CAP);
  const shortLeaveExceeded = Boolean(attendancePolicy?.shortLeaveMonthlyExceeded ?? Number(attendancePolicy?.shortLeaveMonthlyUsed ?? 0) >= shortLeaveCap);

  const leaveBalanceCards = useMemo(
    () => buildEmployeeLeaveBalanceCards(leaveTypes, policySummary, balances),
    [leaveTypes, policySummary, balances],
  );

  const isShortLeaveType = isShortLeaveTypeCode(leaveForm.leaveTypeCode);
  const isShortLeave = isShortLeaveType || leaveForm.requestMode === 'short';
  const shortLeaveBlocked = isShortLeave && shortLeaveExceeded;
  const leaveDayBlocked = Boolean(dayEstimate?.hasConflicts || dayEstimate?.conflictMessage);
  const leaveDayConflictMessage = dayEstimate?.conflictMessage || null;
  const usingDefaultShortLeaveMinutes = String(leaveForm.shortLeaveMinutes || DEFAULT_SHORT_LEAVE_MINUTES) === String(DEFAULT_SHORT_LEAVE_MINUTES);

  const filteredOfficers = useMemo(
    () => filterDepartmentEmployees(departmentEmployees, officerSearch),
    [departmentEmployees, officerSearch],
  );

  const selectedOfficer = useMemo(
    () => departmentEmployees.find((e) => String(e.id) === String(leaveForm.overlookingOfficerId || '')) || null,
    [departmentEmployees, leaveForm.overlookingOfficerId],
  );

  const closeOfficerPicker = () => {
    setOfficerPickerOpen(false);
    setOfficerSearch('');
  };

  const selectOverlookingOfficer = (employee) => {
    setLeaveForm((f) => ({ ...f, overlookingOfficerId: String(employee.id) }));
    closeOfficerPicker();
  };

  const pendingApprovals = (approvals || []).filter((a) => {
    const s = String(a?.current_status || a?.status || '').toLowerCase();
    return s.startsWith('pending');
  });

  const monthlyHistory = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return (myRequests || []).filter((req) => {
      const d = new Date(req?.attendance_date || req?.start_date || req?.createdAt || req?.created_at || req?.updatedAt || req?.updated_at || '');
      if (Number.isNaN(d.getTime())) return false;
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [myRequests]);

  const updateLeaveTypeCode = (code) => {
    setLeaveForm((prev) => {
      const next = { ...prev, leaveTypeCode: code };
      if (isShortLeaveTypeCode(code)) {
        next.requestMode = 'short';
        next.endDate = prev.startDate;
      } else if (prev.requestMode === 'short') {
        next.requestMode = 'full_day';
      }
      return next;
    });
  };

  const updateRequestMode = (mode) => {
    setLeaveForm((prev) => ({
      ...prev,
      requestMode: mode,
      endDate: mode === 'full_day' ? prev.endDate : prev.startDate,
      shortLeaveMinutes: mode === 'short'
        ? String(prev.shortLeaveMinutes || DEFAULT_SHORT_LEAVE_MINUTES)
        : prev.shortLeaveMinutes,
    }));
  };

  useEffect(() => {
    if (!token || !leaveForm.startDate || !leaveForm.requestMode) {
      setDayEstimate(null);
      return undefined;
    }
    const endDate = leaveForm.requestMode === 'full_day'
      ? (leaveForm.endDate || leaveForm.startDate)
      : leaveForm.startDate;
    if (leaveForm.requestMode === 'full_day' && endDate < leaveForm.startDate) {
      setDayEstimate(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await hrSupportRequest('/api/hr/leave/estimate-days', token, {
          method: 'POST',
          body: JSON.stringify({
            requestMode: leaveForm.requestMode,
            startDate: leaveForm.startDate,
            endDate,
            halfDaySession: leaveForm.halfDaySession === 'evening' ? 'afternoon' : leaveForm.halfDaySession,
            shortLeaveMinutes: leaveForm.shortLeaveMinutes ? Number(leaveForm.shortLeaveMinutes) : undefined,
          }),
        });
        if (!cancelled) setDayEstimate(res || null);
      } catch {
        if (!cancelled) setDayEstimate(null);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    token,
    leaveForm.startDate,
    leaveForm.endDate,
    leaveForm.requestMode,
    leaveForm.halfDaySession,
    leaveForm.shortLeaveMinutes,
  ]);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    const oversized = newFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setFileError(`File too large (max 8 MB): ${oversized.map((f) => f.name).join(', ')}`);
      return;
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setFileError('');
    e.target.value = '';
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    const effectiveRequestMode = isShortLeaveType ? 'short' : (leaveForm.requestMode || 'full_day');
    if (!leaveForm.startDate) {
      setSubmitError('Select a start date.');
      return;
    }
    if (effectiveRequestMode === 'full_day' && leaveForm.endDate && leaveForm.endDate < leaveForm.startDate) {
      setSubmitError('End date cannot be before start date.');
      return;
    }
    if (shortLeaveBlocked) {
      setSubmitError(`You have already used ${shortLeaveCap} requested short leaves this month.`);
      return;
    }
    if (leaveDayBlocked) {
      setSubmitError(leaveDayConflictMessage || 'You already have pending or approved leave on one or more selected dates.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);
    try {
      const uploadedNames = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('attachment', file);
        const data = await hrSupportUpload('/api/hr/leave/attachment/upload', token, fd);
        if (data?.filename) uploadedNames.push(data.filename);
      }
      await submitLeaveRequest({ attachmentUrls: uploadedNames });
      setFiles([]);
      setOfficerSearch('');
      setOfficerPickerOpen(false);
      setSubmitSuccess(true);
      submitWrapRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (err) {
      setSubmitError(err?.message || 'Failed to submit request.');
      submitWrapRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = (requestId, kind = 'leave') => {
    setRejectModal({ requestId, reason: '', kind });
  };

  const submitReject = async () => {
    if (!rejectModal?.reason?.trim()) return;
    try {
      await actApproval(rejectModal.requestId, 'reject', rejectModal.reason.trim(), rejectModal.kind);
      setRejectModal(null);
    } catch {
      /* actApproval handles error */
    }
  };

  const viewHint = leaveSubTab === 'request'
    ? 'Submit a new leave request with dates, reason, and optional attachments.'
    : leaveSubTab === 'approve'
      ? 'Review and approve or reject pending leave and late departure requests from your team.'
      : 'View your leave requests for the current month.';

  return (
    <div className="hrsup-leave-tab">
      {rejectModal && (
        <RejectModal
          value={rejectModal.reason}
          onChange={(v) => setRejectModal((m) => ({ ...m, reason: v }))}
          onSubmit={submitReject}
          onClose={() => setRejectModal(null)}
        />
      )}

      {officerPickerOpen && (
        <div className="hrsup-modal-overlay" onClick={closeOfficerPicker}>
          <div className="hrsup-modal hrsup-officer-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hrsup-modal-head">
              <div>
                <h3 className="hrsup-modal-title">Select Overlooking Officer</h3>
                <p className="hrsup-officer-picker-meta">
                  {departmentEmployees.length} colleague{departmentEmployees.length === 1 ? '' : 's'}
                  {departmentName ? ` in ${departmentName}` : ' in your department'}
                </p>
              </div>
              <button type="button" className="hrsup-modal-close" onClick={closeOfficerPicker}>✕</button>
            </div>
            <div className="hrsup-modal-body hrsup-officer-picker-body">
              <input
                type="text"
                className="hrsup-input"
                placeholder="Search by name or employee no…"
                value={officerSearch}
                onChange={(e) => setOfficerSearch(e.target.value)}
                autoFocus
              />
              <div className="hrsup-officer-picker-list">
                {filteredOfficers.length === 0 ? (
                  <p className="hrsup-leave-officer-empty">No matching employees found.</p>
                ) : (
                  filteredOfficers.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="hrsup-officer-picker-option"
                      onClick={() => selectOverlookingOfficer(e)}
                    >
                      <span className="hrsup-officer-picker-name">{formatDepartmentEmployeeLabel(e)}</span>
                      {e.empNo ? <span className="hrsup-officer-picker-empno">{e.empNo}</span> : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="hrsup-modal-overlay" onClick={() => setPreviewUrl(null)}>
          <div className="hrsup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hrsup-modal-head">
              <h3 className="hrsup-modal-title">Attachment</h3>
              <button type="button" className="hrsup-modal-close" onClick={() => setPreviewUrl(null)}>✕</button>
            </div>
            <div className="hrsup-modal-body" style={{ textAlign: 'center' }}>
              <img src={previewUrl} alt="attachment" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}

      <div className="hrsup-segments">
        <button type="button" className={`hrsup-segment-btn${leaveSubTab === 'request' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => setLeaveSubTab('request')}>Request</button>
        {canApproveLeaves && (
          <button type="button" className={`hrsup-segment-btn${leaveSubTab === 'approve' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => setLeaveSubTab('approve')}>
            Approve
            {pendingApprovals.length > 0 && <span className="hrsup-segment-badge">{pendingApprovals.length > 9 ? '9+' : pendingApprovals.length}</span>}
          </button>
        )}
        <button type="button" className={`hrsup-segment-btn${leaveSubTab === 'history' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => setLeaveSubTab('history')}>History</button>
      </div>
      <p className="hrsup-leave-view-hint">{viewHint}</p>

      {leaveSubTab === 'request' && (
        <div className="hrsup-leave-form" ref={formTopRef}>
          {!canRequestLeave ? (
            <div className="hrsup-leave-unavailable">
              <div className="hrsup-leave-unavailable-icon" aria-hidden="true">⚠</div>
              <h3 className="hrsup-leave-unavailable-title">Leave Request Unavailable</h3>
              <p className="hrsup-leave-unavailable-text">
                Reporting Officer and HOD are not configured. Please contact HR.
              </p>
            </div>
          ) : (
            <>
              <div className="hrsup-card hrsup-leave-section">
                <div className="hrsup-leave-section-head">
                  <h3 className="hrsup-card-title hrsup-leave-section-title">Leave Type</h3>
                  {leaveBalanceCards.length > 0 && (
                    <LeaveBalanceCards cards={leaveBalanceCards} showPopupButton popupButtonLabel="Leave Balance" />
                  )}
                </div>
                <p className="hrsup-leave-section-hint">Choose the leave category you need.</p>
                {leaveTypes.length === 0 ? (
                  <p className="hrsup-empty">No leave types available.</p>
                ) : (
                  <div className="hrsup-chips hrsup-leave-chips">
                    {leaveTypes.map((t) => (
                      <button key={t.code} type="button" className={`hrsup-chip${leaveForm.leaveTypeCode === t.code ? ' hrsup-chip--active' : ''}`} onClick={() => updateLeaveTypeCode(t.code)}>
                        {t.name || t.code}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!isShortLeaveType && (
                <div className="hrsup-card hrsup-leave-section">
                  <h3 className="hrsup-card-title">Request Mode</h3>
                  <p className="hrsup-leave-section-hint">Select full day or half day.</p>
                  <div className="hrsup-leave-mode-row">
                    {REQUEST_MODES.map((opt) => (
                      <button key={opt.value} type="button" className={`hrsup-leave-mode-chip${leaveForm.requestMode === opt.value ? ' hrsup-leave-mode-chip--active' : ''}`} onClick={() => updateRequestMode(opt.value)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="hrsup-card hrsup-leave-section">
                <h3 className="hrsup-card-title">{leaveForm.requestMode === 'full_day' ? 'Leave Dates' : 'Leave Date'}</h3>
                <p className="hrsup-leave-section-hint">
                  {leaveForm.requestMode === 'full_day' ? 'Select start and end dates.' : 'Select the leave date.'}
                </p>
                <div className={leaveForm.requestMode === 'full_day' ? 'hrsup-leave-date-row' : ''}>
                  <div className="hrsup-leave-date-field">
                    <label className="hrsup-leave-field-label">{leaveForm.requestMode === 'full_day' ? 'Start Date' : 'Date'}</label>
                    <input type="date" className="hrsup-leave-date-input" value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value, endDate: f.requestMode === 'full_day' ? f.endDate : e.target.value }))} />
                  </div>
                  {leaveForm.requestMode === 'full_day' && (
                    <div className="hrsup-leave-date-field">
                      <label className="hrsup-leave-field-label">End Date</label>
                      <input type="date" className="hrsup-leave-date-input" min={leaveForm.startDate} value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  )}
                </div>

                {dayEstimate?.message && (
                  <p className="hrsup-leave-section-hint hrsup-leave-day-estimate">{dayEstimate.message}</p>
                )}

                {leaveDayConflictMessage && (
                  <div className="hrsup-notice-box hrsup-notice-box--warn">{leaveDayConflictMessage}</div>
                )}

                {leaveForm.requestMode === 'half_day' && (
                  <div className="hrsup-leave-inline-block">
                    <span className="hrsup-leave-field-label">Half Day Session</span>
                    <div className="hrsup-leave-mode-row">
                      {SESSION_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" className={`hrsup-leave-mode-chip${leaveForm.halfDaySession === opt.value ? ' hrsup-leave-mode-chip--active' : ''}`} onClick={() => setLeaveForm((f) => ({ ...f, halfDaySession: opt.value }))}>
                          {opt.label === 'Morning' ? 'Morning Half' : 'Afternoon Half'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isShortLeave && (
                  <div className="hrsup-leave-inline-block">
                    {shortLeaveBlocked && (
                      <div className="hrsup-notice-box hrsup-notice-box--error">
                        Short leave unavailable — you have already used {shortLeaveCap} requested short leaves this month (automatic short leaves from attendance are separate).
                      </div>
                    )}
                    <span className="hrsup-leave-field-label">Short Leave Session</span>
                    <div className="hrsup-leave-mode-row">
                      {SESSION_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" className={`hrsup-leave-mode-chip${leaveForm.shortLeaveSession === opt.value ? ' hrsup-leave-mode-chip--active' : ''}`} onClick={() => setLeaveForm((f) => ({ ...f, shortLeaveSession: opt.value }))}>
                          {opt.label.split(' / ')[0]}
                        </button>
                      ))}
                    </div>
                    <p className="hrsup-leave-section-hint">
                      {leaveForm.shortLeaveSession === 'evening'
                        ? 'Evening: you may leave early by the selected minutes.'
                        : 'Morning: you may arrive late by the selected minutes.'}
                    </p>
                    <span className="hrsup-leave-field-label">Short Leave Minutes</span>
                    <div className="hrsup-leave-mode-row">
                      <button type="button" className={`hrsup-leave-mode-chip${usingDefaultShortLeaveMinutes ? ' hrsup-leave-mode-chip--active' : ''}`} onClick={() => setLeaveForm((f) => ({ ...f, shortLeaveMinutes: String(DEFAULT_SHORT_LEAVE_MINUTES) }))}>
                        Default ({DEFAULT_SHORT_LEAVE_MINUTES} min)
                      </button>
                      <button type="button" className={`hrsup-leave-mode-chip${!usingDefaultShortLeaveMinutes ? ' hrsup-leave-mode-chip--active' : ''}`} onClick={() => { if (usingDefaultShortLeaveMinutes) setLeaveForm((f) => ({ ...f, shortLeaveMinutes: '' })); }}>
                        Custom
                      </button>
                    </div>
                    <input
                      type="number"
                      className="hrsup-input"
                      min={1}
                      max={DEFAULT_SHORT_LEAVE_MINUTES}
                      disabled={shortLeaveBlocked}
                      value={leaveForm.shortLeaveMinutes}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setLeaveForm((f) => ({ ...f, shortLeaveMinutes: '' }));
                          return;
                        }
                        const n = Math.min(Number(val) || 0, DEFAULT_SHORT_LEAVE_MINUTES);
                        setLeaveForm((f) => ({ ...f, shortLeaveMinutes: String(n) }));
                      }}
                      placeholder={`Default is ${DEFAULT_SHORT_LEAVE_MINUTES} minutes`}
                    />
                  </div>
                )}
              </div>

              <div className="hrsup-card hrsup-leave-section">
                <h3 className="hrsup-card-title">Reason</h3>
                <p className="hrsup-leave-section-hint">Give a clear reason to speed up approvals.</p>
                <textarea className="hrsup-input hrsup-leave-reason" rows={3} placeholder="Why are you requesting this leave? Add short details." value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} />
              </div>

              <div className="hrsup-card hrsup-leave-section hrsup-leave-officer-wrap">
                <h3 className="hrsup-card-title">Overlooking Officer (Optional)</h3>
                <p className="hrsup-leave-section-hint">
                  {departmentName
                    ? `Select a colleague from ${departmentName} if needed.`
                    : 'Select a colleague from your department if needed.'}
                </p>
                {selectedOfficer ? (
                  <div className="hrsup-leave-officer-selected">
                    <div>
                      <div className="hrsup-leave-officer-name">{formatDepartmentEmployeeLabel(selectedOfficer)}</div>
                      <div className="hrsup-leave-officer-meta">Overlooking Officer</div>
                    </div>
                    <button type="button" className="hrsup-leave-officer-clear" onClick={() => { setLeaveForm((f) => ({ ...f, overlookingOfficerId: '' })); setOfficerSearch(''); }}>
                      ✕ Clear
                    </button>
                  </div>
                ) : departmentEmployees.length === 0 ? (
                  <p className="hrsup-leave-officer-empty">No colleagues found in your department.</p>
                ) : (
                  <button type="button" className="hrsup-input hrsup-officer-picker-trigger" onClick={() => setOfficerPickerOpen(true)}>
                    Search by name or employee no…
                  </button>
                )}
              </div>

              <div className="hrsup-card hrsup-leave-section">
                <h3 className="hrsup-card-title">Attachments (Optional)</h3>
                <p className="hrsup-leave-section-hint">Upload image or PDF files, up to 8MB each.</p>
                <div className="hrsup-leave-attach-btns">
                  <button type="button" className="hrsup-leave-attach-btn" onClick={() => fileInputRef.current?.click()}>Add File</button>
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
                {fileError && <div className="hrsup-notice-box hrsup-notice-box--error">{fileError}</div>}
                {files.length > 0 ? (
                  <div className="hrsup-leave-attach-list">
                    {files.map((f, idx) => (
                      <div key={idx} className="hrsup-leave-attach-row">
                        <div className="hrsup-leave-attach-info">
                          <span className="hrsup-leave-attach-name">{f.name}</span>
                          <span className="hrsup-leave-attach-size">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                        </div>
                        <button type="button" className="hrsup-leave-attach-remove" onClick={() => removeFile(idx)}>Remove</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hrsup-empty">No attachments added.</p>
                )}
              </div>

              <div className="hrsup-leave-submit-wrap" ref={submitWrapRef}>
                {submitError && (
                  <div className="hrsup-error-box hrsup-leave-success-card--inline">
                    {submitError}
                    <button type="button" className="hrsup-error-dismiss" onClick={() => setSubmitError('')}>✕</button>
                  </div>
                )}
                {submitSuccess && (
                  <div className="hrsup-leave-success-card hrsup-leave-success-card--inline">
                    <strong>Leave submitted successfully</strong>
                    <button type="button" className="hrsup-error-dismiss" style={{ color: '#166534' }} onClick={() => setSubmitSuccess(false)}>✕</button>
                  </div>
                )}
                <button
                  type="button"
                  className={`hrsup-btn hrsup-btn--primary hrsup-btn--full${submitting ? ' hrsup-btn--loading' : ''}`}
                  disabled={submitting || shortLeaveBlocked || leaveDayBlocked}
                  onClick={handleSubmit}
                >
                  {submitting && <span className="hrsup-btn-spinner" aria-hidden="true" />}
                  {submitting ? 'Submitting…' : 'Submit Leave Request'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {leaveSubTab === 'approve' && canApproveLeaves && (
        <div className="hrsup-leave-approve-list">
          {approvals.length === 0 ? (
            <div className="hrsup-card hrsup-leave-empty-card">
              <p className="hrsup-empty">No pending leave or late departure approvals.</p>
            </div>
          ) : (
            approvals.map((req) => {
              const s = String(req?.current_status || req?.status || '').toLowerCase();
              const isPending = s.startsWith('pending');
              const kind = getApprovalKind(req);

              return (
                <div key={`${kind}-${req.id}`}>
                  <ApprovalRequestCard
                    item={req}
                    formatDate={formatDate}
                    onApprove={() => actApproval(req.id, 'approve', undefined, kind)}
                    onReject={() => handleReject(req.id, kind)}
                    onPreviewAttachment={setPreviewUrl}
                  />
                  {!isPending && (
                    <div style={{ marginTop: -8, marginBottom: 10, textAlign: 'right' }}>
                      <span className={`hrsup-badge ${statusBadgeClass(req.current_status || req.status)}`}>
                        {leaveRequestStatusLabel(req)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {leaveSubTab === 'history' && (
        <div className="hrsup-card hrsup-leave-history-card">
          <div className="hrsup-leave-history-head">
            <h3 className="hrsup-card-title" style={{ margin: 0 }}>My Requests (This Month)</h3>
            <button type="button" className="hrsup-att-history-refresh" onClick={refresh} disabled={refreshing} aria-label="Refresh">
              <span className={refreshing ? 'hrsup-spin' : ''}>↻</span>
            </button>
          </div>
          {monthlyHistory.length === 0 ? (
            <p className="hrsup-empty">No leave or late departure requests found for this month.</p>
          ) : (
            <div className="hrsup-leave-history-list">
              {monthlyHistory.map((req) => {
                const isRejected = String(req.current_status || req.status || '').toLowerCase().startsWith('reject');
                const rejectReason = req.reject_reason_l2 || req.reject_reason_l1 || null;
                const overlookDeclined = String(req.overlooking_status || '') === 'declined';
                return (
                  <div key={req.id} className={`hrsup-leave-history-row${isRejected ? ' hrsup-leave-history-row--rejected' : ''}`}>
                    <div className="hrsup-list-title">{getApprovalTypeBadge(req)}</div>
                    <div className="hrsup-list-meta">
                      {isLateDepartureApproval(req)
                        ? `${formatDate(req.attendance_date || req.start_date)} · until ${String(req.requested_until_time || '').slice(0, 5)}`
                        : `${formatDate(req.start_date)} to ${formatDate(req.end_date)}`}
                    </div>
                    {!isLateDepartureApproval(req) && (
                      <div className="hrsup-list-meta">
                        Mode: {requestModeLabel(req.requestMode || req.request_mode)}
                      </div>
                    )}
                    <div className={`hrsup-list-meta${isRejected ? ' hrsup-leave-history-status--rejected' : ''}`}>
                      Status: {leaveRequestStatusLabel(req)}
                    </div>
                    {isRejected && rejectReason && (
                      <div className="hrsup-leave-history-status--rejected hrsup-list-meta">Reason: {rejectReason}</div>
                    )}
                    {req.overlooking_officer_id && (
                      <div className={`hrsup-list-meta${overlookDeclined ? ' hrsup-leave-history-status--rejected' : ''}`}>
                        Overlooking: {overlookingStatusLabel(req.overlooking_status || 'pending')}
                        {overlookDeclined && req.reject_reason_overlooking ? ` — ${req.reject_reason_overlooking}` : ''}
                      </div>
                    )}
                    {req.reason && <div className="hrsup-list-meta">{req.reason}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
