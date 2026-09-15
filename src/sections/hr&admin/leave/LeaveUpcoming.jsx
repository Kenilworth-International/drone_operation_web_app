import React from 'react';
import { leaveStatusLabel } from '../../../utils/hrStatusLabels';

export default function LeaveUpcoming({ upcoming }) {
  const rows = upcoming?.rows || [];
  return (
    <section className="leave-ops-section">
      <h3>Upcoming leave</h3>
      <p className="leave-ops-section-hint">
        Employees on leave in the next 7 days
        {upcoming?.from && upcoming?.to ? ` (${upcoming.from} → ${upcoming.to})` : ''}.
      </p>
      <div className="leave-ops-table-wrap">
        {rows.length === 0 ? (
          <div className="leave-ops-empty">No upcoming leave in the next 7 days.</div>
        ) : (
          <table className="leave-ops-table">
            <thead>
              <tr>
                <th>Emp No</th>
                <th>Name</th>
                <th>Department</th>
                <th>Type</th>
                <th>Status</th>
                <th>Dates</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.leaveRequestId}-${row.employeeId}`}>
                  <td>{row.empNo || '—'}</td>
                  <td>{row.employeeName || '—'}</td>
                  <td>{row.departmentName || '—'}</td>
                  <td>{row.leaveTypeName || row.leaveTypeCode || '—'}</td>
                  <td>{leaveStatusLabel(row.status)}</td>
                  <td>
                    {row.firstLeaveDate || row.startDate || '—'}
                    {row.lastLeaveDate && row.lastLeaveDate !== row.firstLeaveDate
                      ? ` → ${row.lastLeaveDate}`
                      : ''}
                  </td>
                  <td>{Number(row.unitsInWindow || 0).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
