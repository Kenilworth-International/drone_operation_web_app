import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  useAdjustHrLeaveBalanceMutation,
  useGetHrLeaveTypesAllQuery,
  useLazyGetHrLeaveOpsBalancesQuery,
} from '../../../api/services NodeJs/hrLeaveApi';
import { getEmployeeDisplayName } from '../employeeProfile/employeeProfileUtils';

export default function HrAdjustBalanceModal({ open, onClose, employees = [], onSuccess }) {
  const { data: typesResponse } = useGetHrLeaveTypesAllQuery(undefined, { skip: !open });
  const [fetchBalances] = useLazyGetHrLeaveOpsBalancesQuery();
  const [adjustBalance, { isLoading }] = useAdjustHrLeaveBalanceMutation();

  const leaveTypes = useMemo(() => {
    const list = typesResponse?.data || typesResponse || [];
    return (Array.isArray(list) ? list : []).filter((t) => Number(t.status ?? 1) === 1);
  }, [typesResponse]);

  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [leaveTypeCode, setLeaveTypeCode] = useState('annual_leave');
  const [mode, setMode] = useState('set');
  const [openingBalance, setOpeningBalance] = useState('');
  const [allocated, setAllocated] = useState('');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setEmployeeId('');
    setYear(new Date().getFullYear());
    setLeaveTypeCode('annual_leave');
    setMode('set');
    setOpeningBalance('');
    setAllocated('');
    setNote('');
    setPreview(null);
    setEmployeeSearch('');
  }, [open]);

  useEffect(() => {
    if (!open || !employeeId) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBalances({ employeeId: Number(employeeId), year: Number(year) }).unwrap();
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, employeeId, year, fetchBalances]);

  const currentTypeBalance = useMemo(() => {
    const rows = preview?.balances || [];
    return rows.find((r) => String(r.leaveTypeCode) === String(leaveTypeCode)) || null;
  }, [preview, leaveTypeCode]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees.slice(0, 80);
    return employees
      .filter((emp) => {
        const name = getEmployeeDisplayName(emp, '').toLowerCase();
        const empNo = String(emp.empNo || emp.emp_no || '').toLowerCase();
        return name.includes(q) || empNo.includes(q);
      })
      .slice(0, 80);
  }, [employees, employeeSearch]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId || !leaveTypeCode) {
      toast.warning('Employee and leave type are required.');
      return;
    }
    if (openingBalance === '' && allocated === '') {
      toast.warning('Enter opening balance and/or allocated days.');
      return;
    }
    try {
      const body = {
        employeeId: Number(employeeId),
        leaveTypeCode,
        year: Number(year),
        mode,
        note: note || undefined,
      };
      if (openingBalance !== '') body.openingBalance = Number(openingBalance);
      if (allocated !== '') body.allocated = Number(allocated);
      const result = await adjustBalance(body).unwrap();
      if (result?.status === false) {
        toast.error(result?.message || 'Failed to adjust balance');
        return;
      }
      toast.success('Leave balance updated.');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.data?.message || err?.error || err?.message || 'Failed to adjust balance');
    }
  };

  return (
    <div className="leave-ops-modal-overlay" onClick={onClose} role="presentation">
      <div className="leave-ops-modal" onClick={(ev) => ev.stopPropagation()} role="dialog">
        <header>
          <h3>Adjust leave balance</h3>
          <button type="button" className="leave-ops-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="leave-ops-modal-body">
            <label>
              Search employee
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Name or EMP no"
              />
            </label>
            <label>
              Employee
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                <option value="">Select employee</option>
                {filteredEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.empNo || emp.emp_no || '—'} · {getEmployeeDisplayName(emp)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Year
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020"
                max="2100"
              />
            </label>
            <label>
              Leave type
              <select value={leaveTypeCode} onChange={(e) => setLeaveTypeCode(e.target.value)}>
                {leaveTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name || t.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mode
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="set">Set absolute values</option>
                <option value="add">Add to current values</option>
              </select>
            </label>
            <label>
              Opening balance
              <input
                type="number"
                step="0.5"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Allocated
              <input
                type="number"
                step="0.5"
                min="0"
                value={allocated}
                onChange={(e) => setAllocated(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Note
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Mid-year go-live top-up"
              />
            </label>
            {currentTypeBalance ? (
              <div className="leave-ops-balance-preview">
                Current — opening {currentTypeBalance.openingBalance}, allocated {currentTypeBalance.allocated},
                used {currentTypeBalance.used}, pending {currentTypeBalance.pending}, remaining{' '}
                {currentTypeBalance.remaining}
              </div>
            ) : employeeId ? (
              <div className="leave-ops-balance-preview">No balance row yet for this type/year.</div>
            ) : null}
          </div>
          <div className="leave-ops-modal-footer">
            <button type="button" className="leave-ops-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="leave-ops-btn leave-ops-btn--primary" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Save balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
