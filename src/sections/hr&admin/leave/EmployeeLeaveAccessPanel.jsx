import React from 'react';

export default function EmployeeLeaveAccessPanel({
  allEmployees,
  leaveTypes,
  editedAccessByEmployee,
  onToggleLeaveTypeAccess,
  onSaveLeaveTypeAccess,
  normalizeCsvCodes,
  updatingEmployee,
  savingEmployeeId,
}) {
  return (
    <div className="leave-grid-leavemgt">
      <div className="leave-card-leavemgt leave-span-2-leavemgt">
        <div className="leave-card-header-leavemgt">
          <h3>Employee Leave Availability</h3>
          <span className="leave-muted-leavemgt">Assign leave types per employee. If none are assigned, the employee cannot request leave.</span>
        </div>
        <div className="leave-list-leavemgt">
          {allEmployees.length === 0 && <div className="leave-empty-leavemgt">No employees found.</div>}
          {allEmployees.map((employee) => {
            const effectiveAccess =
              editedAccessByEmployee[employee.id] !== undefined
                ? editedAccessByEmployee[employee.id]
                : String(employee.leaveTypeAccess || '');
            const hasAccessChanges =
              normalizeCsvCodes(effectiveAccess) !== normalizeCsvCodes(employee.leaveTypeAccess || '');
            const selectedCodes = new Set(
              effectiveAccess
                .split(',')
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean)
            );
            const selectedTypeNames = leaveTypes
              .filter((type) => selectedCodes.has(String(type.code || '').trim().toLowerCase()))
              .map((type) => type.name)
              .filter(Boolean);
            const currentAccessText = selectedTypeNames.length > 0
              ? selectedTypeNames.join(', ')
              : 'Not configured — employee cannot request leave until types are assigned';
            return (
              <div key={employee.id} className="leave-item-leavemgt leave-item-data-leavemgt">
                <div className="leave-item-top-leavemgt">
                  <div className="leave-employee-meta-leavemgt">
                    <strong>{employee.employeeName || employee.preferredName || employee.empNo || `Employee ${employee.id}`}</strong>
                    <div className="leave-subtext-leavemgt">Emp No: {employee.empNo || '-'}</div>
                  </div>
                  <div className="leave-current-access-center-leavemgt" title={currentAccessText}>
                    {currentAccessText}
                  </div>
                  <div className="leave-top-actions-leavemgt">
                    <button
                      className="leave-btn-leavemgt leave-btn-approve-leavemgt"
                      type="button"
                      disabled={!hasAccessChanges || (updatingEmployee && String(savingEmployeeId) === String(employee.id))}
                      onClick={() => onSaveLeaveTypeAccess(employee)}
                    >
                      {updatingEmployee && String(savingEmployeeId) === String(employee.id) ? 'Saving...' : 'Save Access'}
                    </button>
                  </div>
                </div>
                <div className="leave-access-grid-leavemgt">
                  {leaveTypes
                    .filter((type) => Number(type?.employee_requestable ?? type?.employeeRequestable ?? 1) === 1 && String(type?.code || '') !== 'bulk_leave')
                    .map((type) => (
                      <label key={`${employee.id}-${type.code}`} className="leave-checkbox-chip-leavemgt">
                        <input
                          type="checkbox"
                          checked={selectedCodes.has(String(type.code || '').trim().toLowerCase())}
                          onChange={() => onToggleLeaveTypeAccess(employee.id, type.code)}
                        />
                        {type.name}
                      </label>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
