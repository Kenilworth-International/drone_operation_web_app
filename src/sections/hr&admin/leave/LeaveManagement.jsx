import React, { useState } from 'react';
import {
  useGetHrLeaveTypesAllQuery,
} from '../../../api/services NodeJs/hrLeaveApi';
import {
  useGetAllEmployeeRegistrationsQuery,
  useUpdateEmployeeRegistrationMutation,
} from '../../../api/services NodeJs/jdManagementApi';
import LeaveTypesPanel from './LeaveTypesPanel';
import LeavePoliciesPanel from './LeavePoliciesPanel';
import LeaveEntitlementPanel from './LeaveEntitlementPanel';
import EmployeeLeaveAccessPanel from './EmployeeLeaveAccessPanel';
import { getEmployeeDisplayName } from '../employeeProfile/employeeProfileUtils';
import { HrmPageHeader, HrmSubTabs } from '../shell/HrmShell';
import '../../../styles/leavemanagement.css';

const TABS = [
  { key: 'leave_types', label: 'Leave Types' },
  { key: 'leave_policies', label: 'Leave Policies' },
  { key: 'entitlement_rules', label: 'Entitlement Rules' },
  { key: 'data_handling', label: 'Employee Access' },
];

const LeaveManagement = () => {
  const [activeTab, setActiveTab] = useState('leave_types');
  const { data: leaveTypesResponse } = useGetHrLeaveTypesAllQuery();
  const { data: allEmployeesResponse, refetch: refetchEmployees } = useGetAllEmployeeRegistrationsQuery();
  const [updateEmployeeRegistration, { isLoading: updatingEmployee }] = useUpdateEmployeeRegistrationMutation();
  const [message, setMessage] = useState('');
  const [savingEmployeeId, setSavingEmployeeId] = useState(null);
  const [editedAccessByEmployee, setEditedAccessByEmployee] = useState({});

  const leaveTypes = leaveTypesResponse?.data || [];
  const allEmployees = Array.isArray(allEmployeesResponse)
    ? allEmployeesResponse
    : Array.isArray(allEmployeesResponse?.data)
      ? allEmployeesResponse.data
      : Array.isArray(allEmployeesResponse?.data?.data)
        ? allEmployeesResponse.data.data
        : [];

  const showMessage = (text, isError = false) => {
    setMessage(isError ? `Failed: ${text}` : text);
  };

  const normalizeCsvCodes = (value) =>
    Array.from(
      new Set(
        String(value || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    )
      .sort()
      .join(',');

  const onToggleLeaveTypeAccess = (employeeId, leaveCode) => {
    const normalizedCode = String(leaveCode || '').trim().toLowerCase();
    setEditedAccessByEmployee((prev) => {
      const existingRaw =
        prev[employeeId] !== undefined
          ? prev[employeeId]
          : String(allEmployees.find((item) => String(item.id) === String(employeeId))?.leaveTypeAccess || '');
      const existingSet = new Set(
        existingRaw
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      );
      if (existingSet.has(normalizedCode)) existingSet.delete(normalizedCode);
      else existingSet.add(normalizedCode);
      return {
        ...prev,
        [employeeId]: Array.from(existingSet).join(','),
      };
    });
  };

  const onSaveLeaveTypeAccess = async (employee) => {
    try {
      setSavingEmployeeId(employee.id);
      const leaveTypeAccessRaw =
        editedAccessByEmployee[employee.id] !== undefined
          ? editedAccessByEmployee[employee.id]
          : String(employee.leaveTypeAccess || '');
      const visibleCodes = new Set(
        leaveTypes.map((type) => String(type.code || '').trim().toLowerCase()).filter(Boolean),
      );
      const existingCodes = String(employee.leaveTypeAccess || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      const selectedCodes = leaveTypeAccessRaw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      const hiddenExistingCodes = existingCodes.filter((code) => !visibleCodes.has(code));
      const finalCodes = Array.from(new Set([...selectedCodes, ...hiddenExistingCodes]));
      const leaveTypeAccess = finalCodes.join(',');
      await updateEmployeeRegistration({
        id: employee.id,
        leaveTypeAccess,
      }).unwrap();
      setEditedAccessByEmployee((prev) => {
        const next = { ...prev };
        delete next[employee.id];
        return next;
      });
      await refetchEmployees();
      showMessage(`Updated leave types for ${getEmployeeDisplayName(employee, employee.empNo || employee.id)}`);
    } catch (error) {
      showMessage(error?.data?.message || 'Failed to update employee leave types', true);
    } finally {
      setSavingEmployeeId(null);
    }
  };

  return (
    <div className="leave-page-leavemgt">
      <HrmPageHeader
        title="Leave Setup"
        hint="Configure leave types, policies, entitlement rules, and per-employee access."
      />
      <HrmSubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'leave_types' ? <LeaveTypesPanel onMessage={showMessage} /> : null}
      {activeTab === 'leave_policies' ? <LeavePoliciesPanel onMessage={showMessage} /> : null}
      {activeTab === 'entitlement_rules' ? <LeaveEntitlementPanel onMessage={showMessage} /> : null}
      {activeTab === 'data_handling' ? (
        <EmployeeLeaveAccessPanel
          allEmployees={allEmployees}
          leaveTypes={leaveTypes}
          editedAccessByEmployee={editedAccessByEmployee}
          onToggleLeaveTypeAccess={onToggleLeaveTypeAccess}
          onSaveLeaveTypeAccess={onSaveLeaveTypeAccess}
          normalizeCsvCodes={normalizeCsvCodes}
          updatingEmployee={updatingEmployee}
          savingEmployeeId={savingEmployeeId}
        />
      ) : null}

      {message ? (
        <div className={`leave-message-leavemgt ${message.toLowerCase().includes('failed') ? 'error-leavemgt' : 'success-leavemgt'}`}>
          {message}
        </div>
      ) : null}
    </div>
  );
};

export default LeaveManagement;
