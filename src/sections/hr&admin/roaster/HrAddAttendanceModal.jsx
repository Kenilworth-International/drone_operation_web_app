import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useCreateHrOpsAttendanceMutation } from '../../../api/services NodeJs/hrLeaveApi';
import { getNodeBackendUrl, getToken } from '../../../api/services NodeJs/nodeBackendUrl';
import { getEmployeeDisplayName } from '../employeeProfile/employeeProfileUtils';

async function uploadAttendanceProof(file) {
  const formData = new FormData();
  formData.append('proof', file);
  const token = getToken();
  const res = await fetch(`${getNodeBackendUrl()}/api/hr-leave/admin/ops/attendance/proof/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || 'Proof upload failed');
  }
  return json?.data?.filename;
}

export default function HrAddAttendanceModal({
  open,
  onClose,
  employee = null,
  attendanceDate = '',
  onSuccess,
}) {
  const [createAttendance, { isLoading }] = useCreateHrOpsAttendanceMutation();
  const [markInTime, setMarkInTime] = useState('08:00');
  const [markOutTime, setMarkOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [proofFiles, setProofFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMarkInTime('08:00');
    setMarkOutTime('');
    setReason('');
    setProofFiles([]);
    setUploading(false);
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
    if (!markInTime) {
      toast.warning('Mark-in time is required.');
      return;
    }
    if (!String(reason || '').trim()) {
      toast.warning('Please enter why HR is adding this attendance.');
      return;
    }

    setUploading(true);
    try {
      const proofUrls = [];
      for (const file of proofFiles) {
        const filename = await uploadAttendanceProof(file);
        if (filename) proofUrls.push(filename);
      }
      if (proofFiles.length && !proofUrls.length) {
        toast.error('Ref image upload failed.');
        return;
      }

      const result = await createAttendance({
        employeeId: Number(employee.id),
        attendanceDate,
        markInTime,
        markOutTime: markOutTime || null,
        reason: String(reason).trim(),
        proofUrls,
      }).unwrap();

      if (result?.status === false) {
        toast.error(result?.message || 'Failed to add attendance');
        return;
      }
      const data = result?.data || {};
      if (data.noPayApplied) {
        toast.success('Attendance recorded. Late mark-in hit an automatic short-leave no-pay slot.');
      } else if (data.autoShortLeave) {
        toast.success('Attendance recorded. Automatic morning short leave was created.');
      } else if (data.autoHalfDay) {
        toast.success('Attendance recorded. Automatic morning half-day was applied.');
      } else {
        toast.success('Attendance recorded by HR.');
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.data?.message || err?.error || err?.message || 'Failed to add attendance');
    } finally {
      setUploading(false);
    }
  };

  const busy = isLoading || uploading;

  return (
    <div className="leave-ops-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="leave-ops-modal leave-ops-modal--add-leave"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <h3>Add attendance (HR)</h3>
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
              Same late-arrival rules as the HR app: mark-in after 08:15 creates automatic morning short leave
              (or half-day after the short-leave window). Sat/Sun need bulk leave or approved WFH.
              Your user is stored as who added this record. Ref image is optional.
            </p>

            <div className="leave-ops-date-row">
              <label>
                Mark in
                <input
                  type="time"
                  value={markInTime}
                  onChange={(e) => setMarkInTime(e.target.value)}
                  required
                />
              </label>
              <label>
                Mark out (optional)
                <input
                  type="time"
                  value={markOutTime}
                  onChange={(e) => setMarkOutTime(e.target.value)}
                />
              </label>
            </div>

            <label>
              Why is HR adding this?
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Phone GPS failed; employee was on site — see Maps timeline"
                required
              />
            </label>

            <label>
              Ref image (optional)
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                multiple
                onChange={(e) => setProofFiles(Array.from(e.target.files || []))}
              />
            </label>
            {proofFiles.length ? (
              <div className="leave-ops-add-meta">
                {proofFiles.map((f) => (
                  <span key={`${f.name}-${f.size}`} className="leave-ops-pill">
                    {f.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="leave-ops-approval-hint">
                Optional: Maps timeline or other reference image/PDF.
              </p>
            )}
          </div>
          <div className="leave-ops-modal-footer">
            <button type="button" className="leave-ops-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="leave-ops-btn leave-ops-btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
