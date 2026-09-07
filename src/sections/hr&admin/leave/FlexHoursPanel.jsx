import React from 'react';
import { getEmployeeDisplayName } from '../employeeProfile/employeeProfileUtils';

export default function FlexHoursPanel({
  flexSearchText,
  setFlexSearchText,
  flexStatusFilter,
  setFlexStatusFilter,
  filteredFlexEmployees,
  getEffectiveFlex,
  onFlexEnabledChange,
  onFlexMinutesChange,
  onSaveFlexHours,
  updatingEmployee,
  savingEmployeeId,
}) {
  return (
    <div className="leave-grid-leavemgt">
      <div className="leave-card-leavemgt leave-span-2-leavemgt">
        <div className="leave-card-header-leavemgt">
          <h3>Employee Flex Hours</h3>
          <span className="leave-muted-leavemgt">Enable and maintain flex-hours minutes per employee</span>
        </div>
        <div className="leave-flex-filter-row-leavemgt">
          <input
            type="search"
            className="leave-input-leavemgt leave-flex-search-input-leavemgt"
            placeholder="Search by employee name or emp no"
            value={flexSearchText}
            onChange={(e) => setFlexSearchText(e.target.value)}
          />
          <select
            className="leave-input-leavemgt leave-flex-status-select-leavemgt"
            value={flexStatusFilter}
            onChange={(e) => setFlexStatusFilter(e.target.value)}
          >
            <option value="all">All employees</option>
            <option value="enabled">Flex enabled</option>
            <option value="disabled">Flex disabled</option>
          </select>
        </div>
        <div className="leave-list-leavemgt">
          {filteredFlexEmployees.length === 0 && <div className="leave-empty-leavemgt">No employees found.</div>}
          {filteredFlexEmployees.map((employee) => {
            const effective = getEffectiveFlex(employee);
            const isSaving = updatingEmployee && String(savingEmployeeId) === String(employee.id);
            return (
              <div key={employee.id} className="leave-item-leavemgt leave-item-data-leavemgt leave-item-flex-leavemgt">
                <div className="leave-item-top-leavemgt leave-item-top-flex-leavemgt">
                  <div className="leave-employee-meta-leavemgt">
                    <strong>{getEmployeeDisplayName(employee, employee.empNo || `Employee ${employee.id}`)}</strong>
                    <div className="leave-subtext-leavemgt">Emp No: {employee.empNo || '-'}</div>
                  </div>
                  <div className="leave-flex-controls-leavemgt">
                    <label className="leave-checkbox-chip-leavemgt">
                      <input
                        type="checkbox"
                        checked={effective.enabled}
                        onChange={(e) => onFlexEnabledChange(employee, e.target.checked)}
                      />
                      Flex hours enabled
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="leave-input-leavemgt leave-flex-minutes-input-leavemgt"
                      value={effective.enabled ? (effective.minutes > 0 ? String(effective.minutes) : '') : ''}
                      disabled={!effective.enabled}
                      placeholder="Enter minutes"
                      onChange={(e) => onFlexMinutesChange(employee, e.target.value)}
                    />
                    <span className="leave-subtext-leavemgt leave-flex-unit-leavemgt">minutes</span>
                  </div>
                  <div className="leave-top-actions-leavemgt">
                    <button
                      className="leave-btn-leavemgt leave-btn-approve-leavemgt"
                      type="button"
                      disabled={isSaving}
                      onClick={() => onSaveFlexHours(employee)}
                    >
                      {isSaving ? 'Saving...' : 'Save Flex'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
