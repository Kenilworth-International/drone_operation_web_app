import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  useCreateHrOpsLeaveMutation,
  useEstimateHrOpsLeaveMutation,
  useGetHrLeaveTypesAllQuery,
  useLazyGetHrLeaveOpsBalancesQuery,
} from '../../../api/services NodeJs/hrLeaveApi';
import { getEmployeeDisplayName } from '../employeeProfile/employeeProfileUtils';
import HrLeaveDatePicker from './HrLeaveDatePicker';

const DEFAULT_SHORT_LEAVE_MINUTES = 120;

function parseAccessCodes(value) {
  if (Array.isArray(value)) {
    return value.map((c) => String(c || '').trim().toLowerCase()).filter(Boolean);
  }
  if (!value) return [];
  return String(value)
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

export default function HrAddLeaveModal({
  open,
  onClose,
  employees = [],
  onSuccess,
  initialEmployeeId = '',
  initialStartDate = '',
  initialEndDate = '',
}) {
  const { data: typesResponse } = useGetHrLeaveTypesAllQuery(undefined, { skip: !open });
  const [createLeave, { isLoading }] = useCreateHrOpsLeaveMutation();
  const [estimateLeave] = useEstimateHrOpsLeaveMutation();
  const [fetchBalances] = useLazyGetHrLeaveOpsBalancesQuery();

  const allLeaveTypes = useMemo(() => {
    const list = typesResponse?.data || typesResponse || [];
    return (Array.isArray(list) ? list : []).filter((t) => Number(t.status ?? 1) === 1);
  }, [typesResponse]);

  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeCode, setLeaveTypeCode] = useState('');
  const [requestMode, setRequestMode] = useState('full_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [approvalMode, setApprovalMode] = useState('normal');
  const [halfDaySession, setHalfDaySession] = useState('morning');
  const [shortLeaveMinutes, setShortLeaveMinutes] = useState(String(DEFAULT_SHORT_LEAVE_MINUTES));
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [balanceDetail, setBalanceDetail] = useState(null);
  const [dayEstimate, setDayEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [autoConfirmOpen, setAutoConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prefEmp = initialEmployeeId ? String(initialEmployeeId) : '';
    const prefStart = initialStartDate || '';
    const prefEnd = initialEndDate || prefStart;
    setEmployeeId(prefEmp);
    setLeaveTypeCode('');
    setRequestMode('full_day');
    setStartDate(prefStart);
    setEndDate(prefEnd);
    setReason('');
    setApprovalMode('normal');
    setHalfDaySession('morning');
    setShortLeaveMinutes(String(DEFAULT_SHORT_LEAVE_MINUTES));
    setEmployeeSearch('');
    setShowAllTypes(false);
    setBalanceDetail(null);
    setDayEstimate(null);
    setShowEmployeePicker(!prefEmp);
    setAutoConfirmOpen(false);
  }, [open, initialEmployeeId, initialStartDate, initialEndDate]);

  const selectedEmployee = useMemo(
    () => (employees || []).find((emp) => Number(emp.id) === Number(employeeId)) || null,
    [employees, employeeId],
  );

  const accessCodes = useMemo(() => {
    const fromBalances = balanceDetail?.employee?.leaveTypeAccess;
    if (Array.isArray(fromBalances) && fromBalances.length) return fromBalances;
    return parseAccessCodes(
      selectedEmployee?.leaveTypeAccess
        || selectedEmployee?.leave_type_access
        || '',
    );
  }, [balanceDetail, selectedEmployee]);

  const leaveTypes = useMemo(() => {
    if (showAllTypes || !accessCodes.length) return allLeaveTypes;
    const allowed = new Set(accessCodes);
    const filtered = allLeaveTypes.filter((t) => allowed.has(String(t.code || '').toLowerCase()));
    return filtered.length ? filtered : allLeaveTypes;
  }, [allLeaveTypes, accessCodes, showAllTypes]);

  const selectedBalance = useMemo(() => {
    const rows = balanceDetail?.balances || [];
    return rows.find((r) => String(r.leaveTypeCode) === String(leaveTypeCode)) || null;
  }, [balanceDetail, leaveTypeCode]);

  useEffect(() => {
    if (!open || !employeeId) {
      setBalanceDetail(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const year = startDate
          ? Number(String(startDate).slice(0, 4))
          : new Date().getFullYear();
        const data = await fetchBalances({
          employeeId: Number(employeeId),
          year,
        }).unwrap();
        if (!cancelled) setBalanceDetail(data);
      } catch {
        if (!cancelled) setBalanceDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, employeeId, startDate, fetchBalances]);

  const estimateInputsKey = useMemo(
    () => [
      open ? '1' : '0',
      employeeId || '',
      leaveTypeCode || '',
      startDate || '',
      endDate || '',
      requestMode || '',
      halfDaySession || '',
      shortLeaveMinutes || '',
    ].join('|'),
    [
      open,
      employeeId,
      leaveTypeCode,
      startDate,
      endDate,
      requestMode,
      halfDaySession,
      shortLeaveMinutes,
    ],
  );

  useEffect(() => {
    if (!open || !employeeId || !startDate || !requestMode) {
      setDayEstimate(null);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setEstimating(true);
      try {
        const data = await estimateLeave({
          employeeId: Number(employeeId),
          leaveTypeCode,
          requestMode,
          startDate,
          endDate: requestMode === 'full_day' ? (endDate || startDate) : startDate,
          halfDaySession:
            requestMode === 'half_day' || requestMode === 'short' ? halfDaySession : undefined,
          shortLeaveSession: requestMode === 'short' ? halfDaySession : undefined,
          shortLeaveMinutes:
            requestMode === 'short'
              ? Math.min(120, Math.max(1, Number(shortLeaveMinutes) || DEFAULT_SHORT_LEAVE_MINUTES))
              : undefined,
        }).unwrap();
        setDayEstimate(data);
      } catch (err) {
        setDayEstimate({
          error: true,
          message: err?.data?.message || err?.error || err?.message || 'Could not estimate leave days.',
        });
      } finally {
        setEstimating(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [estimateInputsKey, estimateLeave]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    const list = !q
      ? employees
      : employees.filter((emp) => {
        const name = getEmployeeDisplayName(emp, '').toLowerCase();
        const empNo = String(emp.empNo || emp.emp_no || '').toLowerCase();
        const dept = String(emp.departmentName || emp.department || '').toLowerCase();
        return name.includes(q) || empNo.includes(q) || dept.includes(q);
      });
    return list.slice(0, 60);
  }, [employees, employeeSearch]);

  if (!open) return null;

  const handleLeaveTypeChange = (code) => {
    setLeaveTypeCode(code);
    if (String(code).toLowerCase() === 'short_leave') {
      setRequestMode('short');
    }
  };

  const handleModeChange = (mode) => {
    setRequestMode(mode);
    if (mode === 'short') {
      setLeaveTypeCode((prev) => prev || 'short_leave');
    } else if (String(leaveTypeCode).toLowerCase() === 'short_leave' && mode !== 'short') {
      setLeaveTypeCode('');
    }
    if (mode !== 'full_day') {
      setEndDate(startDate || '');
    }
  };

  const selectEmployee = (emp) => {
    setEmployeeId(String(emp.id));
    setLeaveTypeCode('');
    setEmployeeSearch('');
    setShowEmployeePicker(false);
  };

  const clearEmployee = () => {
    setEmployeeId('');
    setLeaveTypeCode('');
    setEmployeeSearch('');
    setShowEmployeePicker(true);
  };

  const submitLeave = async () => {
    try {
      const effectiveMode =
        String(leaveTypeCode).toLowerCase() === 'short_leave' ? 'short' : requestMode;
      const body = {
        employeeId: Number(employeeId),
        leaveTypeCode,
        requestMode: effectiveMode,
        startDate,
        endDate: effectiveMode === 'full_day' ? (endDate || startDate) : startDate,
        reason: reason || undefined,
        approvalMode,
      };
      if (effectiveMode === 'half_day' || effectiveMode === 'short') {
        body.halfDaySession = halfDaySession;
        body.shortLeaveSession = halfDaySession;
      }
      if (effectiveMode === 'short') {
        body.shortLeaveMinutes = Math.min(
          120,
          Math.max(1, Number(shortLeaveMinutes) || DEFAULT_SHORT_LEAVE_MINUTES),
        );
      }
      const result = await createLeave(body).unwrap();
      if (result?.status === false) {
        toast.error(result?.message || 'Failed to create leave');
        return;
      }
      const units = result?.data?.units ?? result?.data?.leaveDays;
      toast.success(
        approvalMode === 'auto'
          ? `Leave created and auto-approved${units != null ? ` (${units} day(s))` : ''}.`
          : `Leave created and sent for RO/HOD approval${units != null ? ` (${units} day(s))` : ''}.`,
      );
      setAutoConfirmOpen(false);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.data?.message || err?.error || err?.message || 'Failed to create leave');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !leaveTypeCode || !startDate) {
      toast.warning('Employee, leave type, and start date are required.');
      return;
    }
    if (dayEstimate?.hasConflicts) {
      toast.error(dayEstimate.conflictMessage || 'Selected dates conflict with existing leave.');
      return;
    }
    if (dayEstimate && !dayEstimate.error && Number(dayEstimate.units || 0) <= 0) {
      toast.warning(dayEstimate.message || 'No chargeable leave days in this range (weekends/holidays skipped).');
      return;
    }
    if (approvalMode === 'auto') {
      setAutoConfirmOpen(true);
      return;
    }
    await submitLeave();
  };

  const weekendsSkipped = Array.isArray(dayEstimate?.skipped?.weekends)
    ? dayEstimate.skipped.weekends
    : [];
  const holidaysSkipped = Array.isArray(dayEstimate?.skipped?.holidays)
    ? dayEstimate.skipped.holidays
    : [];
  const bulkSkipped = Array.isArray(dayEstimate?.skipped?.bulkLeave)
    ? dayEstimate.skipped.bulkLeave
    : [];

  const selectedEmpNo = selectedEmployee
    ? (selectedEmployee.empNo || selectedEmployee.emp_no || '—')
    : '';
  const selectedEmpName = selectedEmployee
    ? getEmployeeDisplayName(selectedEmployee)
    : '';
  const selectedEmpDept = selectedEmployee
    ? (selectedEmployee.departmentName || selectedEmployee.department || '')
    : '';

  return (
    <div className="leave-ops-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="leave-ops-modal leave-ops-modal--add-leave"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
      >
        <header>
          <h3>Add leave</h3>
          <button type="button" className="leave-ops-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="leave-ops-modal-body">
            <div className="leave-ops-emp-picker">
              <span className="leave-ops-emp-picker-label">Employee</span>
              {selectedEmployee ? (
                <div className="leave-ops-emp-selected">
                  <div className="leave-ops-emp-selected-main">
                    <strong>{selectedEmpNo} · {selectedEmpName}</strong>
                    {selectedEmpDept ? (
                      <span className="leave-ops-emp-selected-meta">{selectedEmpDept}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="leave-ops-btn leave-ops-btn--tiny"
                    onClick={clearEmployee}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeePicker(true);
                    }}
                    onFocus={() => setShowEmployeePicker(true)}
                    placeholder="Search by name, EMP no, or department"
                    autoComplete="off"
                  />
                  {showEmployeePicker ? (
                    <ul className="leave-ops-emp-results" role="listbox">
                      {filteredEmployees.length === 0 ? (
                        <li className="leave-ops-emp-results-empty">No employees match</li>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <li key={emp.id}>
                            <button
                              type="button"
                              className="leave-ops-emp-result-btn"
                              onClick={() => selectEmployee(emp)}
                            >
                              <span className="leave-ops-emp-result-name">
                                {emp.empNo || emp.emp_no || '—'} · {getEmployeeDisplayName(emp)}
                              </span>
                              <span className="leave-ops-emp-result-meta">
                                {emp.departmentName || emp.department || '—'}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </>
              )}
            </div>

            {employeeId ? (
              <div className="leave-ops-add-meta">
                {balanceDetail?.employee?.bulkLeaveAvailable ? (
                  <span className="leave-ops-pill leave-ops-pill--warn">Weekends count (bulk leave)</span>
                ) : (
                  <span className="leave-ops-pill">Weekends skipped</span>
                )}
                {accessCodes.length ? (
                  <span className="leave-ops-pill">{accessCodes.length} leave type(s) assigned</span>
                ) : (
                  <span className="leave-ops-pill leave-ops-pill--muted">No leave availability set — showing all types</span>
                )}
              </div>
            ) : null}

            <label>
              Leave type
              <select
                value={leaveTypeCode}
                onChange={(e) => handleLeaveTypeChange(e.target.value)}
                required
                disabled={!employeeId}
              >
                <option value="">Select type</option>
                {leaveTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name || t.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="leave-ops-check-row">
              <input
                type="checkbox"
                checked={showAllTypes}
                onChange={(e) => setShowAllTypes(e.target.checked)}
              />
              Show all leave types (HR override)
            </label>

            {selectedBalance ? (
              <div className="leave-ops-balance-preview">
                <strong>{selectedBalance.leaveTypeName || leaveTypeCode}</strong>
                {' · '}
                Quota {Number(selectedBalance.availableQuota || 0).toFixed(1)}
                {' · '}
                Used {Number(selectedBalance.used || 0).toFixed(1)}
                {' · '}
                Pending {Number(selectedBalance.pending || 0).toFixed(1)}
                {' · '}
                Remaining <strong>{Number(selectedBalance.remaining || 0).toFixed(1)}</strong>
              </div>
            ) : null}

            <label>
              Mode
              <select
                value={requestMode}
                onChange={(e) => handleModeChange(e.target.value)}
                disabled={String(leaveTypeCode).toLowerCase() === 'short_leave'}
              >
                <option value="full_day">Full day</option>
                <option value="half_day">Half day</option>
                <option value="short">Short leave</option>
              </select>
            </label>

            {(requestMode === 'half_day' || requestMode === 'short') && (
              <label>
                Session
                <select value={halfDaySession} onChange={(e) => setHalfDaySession(e.target.value)}>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </label>
            )}

            {requestMode === 'short' ? (
              <label>
                Short leave minutes
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={shortLeaveMinutes}
                  onChange={(e) => setShortLeaveMinutes(e.target.value)}
                />
              </label>
            ) : null}

            <HrLeaveDatePicker
              employeeId={employeeId}
              requestMode={requestMode}
              startDate={startDate}
              endDate={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
              disabled={!employeeId}
            />
            <input type="hidden" value={startDate} required readOnly />

            {(estimating || dayEstimate) && (
              <div
                className={`leave-ops-estimate${
                  dayEstimate?.hasConflicts || dayEstimate?.error ? ' leave-ops-estimate--warn' : ''
                }`}
              >
                {estimating ? (
                  <span>Calculating leave days…</span>
                ) : dayEstimate?.error ? (
                  <span>{dayEstimate.message}</span>
                ) : (
                  <>
                    <strong>
                      {Number(dayEstimate?.units || 0).toFixed(2)} day(s)
                      {dayEstimate?.includeWeekends ? ' (weekends included)' : ' (weekends skipped)'}
                    </strong>
                    {dayEstimate?.message ? <div>{dayEstimate.message}</div> : null}
                    {weekendsSkipped.length ? (
                      <div>Skipped weekends: {weekendsSkipped.join(', ')}</div>
                    ) : null}
                    {holidaysSkipped.length ? (
                      <div>Skipped holidays: {holidaysSkipped.join(', ')}</div>
                    ) : null}
                    {bulkSkipped.length ? (
                      <div>Skipped roster leave days: {bulkSkipped.join(', ')}</div>
                    ) : null}
                    {dayEstimate?.hasConflicts ? (
                      <div className="leave-ops-estimate-conflict">
                        {dayEstimate.conflictMessage || 'Conflicts with existing leave.'}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}

            <label>
              Approval
              <select value={approvalMode} onChange={(e) => setApprovalMode(e.target.value)}>
                <option value="normal">Normal (RO + HOD)</option>
                <option value="auto">Auto-approved (no RO/HOD)</option>
              </select>
            </label>
            {approvalMode === 'auto' ? (
              <p className="leave-ops-approval-hint">
                Auto-approved leave skips RO and HOD and is approved immediately.
              </p>
            ) : null}
            <label>
              Reason
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          </div>
          <div className="leave-ops-modal-footer">
            <button type="button" className="leave-ops-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="leave-ops-btn leave-ops-btn--primary"
              disabled={isLoading || estimating || Boolean(dayEstimate?.hasConflicts)}
            >
              {isLoading ? 'Saving…' : 'Create leave'}
            </button>
          </div>
        </form>

        {autoConfirmOpen ? (
          <div className="leave-ops-confirm-overlay" role="presentation">
            <div className="leave-ops-confirm-panel" role="dialog" aria-modal="true">
              <h4>Confirm auto-approval</h4>
              <p>
                This leave will skip RO and HOD approval and be approved immediately. Continue?
              </p>
              <div className="leave-ops-confirm-actions">
                <button
                  type="button"
                  className="leave-ops-btn"
                  onClick={() => setAutoConfirmOpen(false)}
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="leave-ops-btn leave-ops-btn--primary"
                  onClick={submitLeave}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving…' : 'Yes, auto-approve'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
