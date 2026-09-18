import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useCreateHrOpsNoPayDayMutation } from '../../../api/services NodeJs/hrLeaveApi';
import { getEmployeeDisplayName } from '../employeeProfile/employeeProfileUtils';

export default function HrAddNoPayDayModal({
  open,
  onClose,
  employee = null,
  attendanceDate = '',
  onSuccess,
}) {
  const [createNoPayDay, { isLoading }] = useCreateHrOpsNoPayDayMutation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
  }, [open, employee?.id, attendanceDate]);

  if (!open) return null;

  const empName = getEmployeeDisplayName(employee, employee?.name || 'Employee');
  const empNo = employee?.empNo || employee?.emp_no || '—';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employee?.id || !attendanceDate) {
      toast.warning('Employee and date are required.');
      return;
    }
    if (!String(reason || '').trim()) {
      toast.warning('Please enter why HR is marking this as a no-pay day.');
      return;
    }

    try {
      const result = await createNoPayDay({
        employeeId: Number(employee.id),
        attendanceDate,
        reason: String(reason).trim(),
      }).unwrap();

      if (result?.status === false) {
        toast.error(result?.message || 'Failed to mark no-pay day');
        return;
      }
      toast.success('No-pay day recorded by HR.');
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.data?.message || err?.error || err?.message || 'Failed to mark no-pay day');
    }
  };

  return (
    <div className="leave-ops-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="leave-ops-modal leave-ops-modal--add-leave"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <h3>Mark no-pay day (HR)</h3>
          <button type="button" className="leave-ops-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="leave-ops-modal-body">
            <div className="leave-ops-balance-preview">
              <strong>{empNo} · {empName}</strong>
              {' · '}
              {attendanceDate}
            </div>
            <p className="leave-ops-approval-hint">
              Use when the employee did not attend and has no leave request. Your user is stored as who marked this.
            </p>
            <label>
              Why is HR marking no-pay?
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Absent without leave request; unpaid day"
                required
              />
            </label>
          </div>
          <div className="leave-ops-modal-footer">
            <button type="button" className="leave-ops-btn" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="leave-ops-btn leave-ops-btn--primary" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Save no-pay day'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
