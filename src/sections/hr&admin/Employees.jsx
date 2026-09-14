import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useGetAllEmployeeRegistrationsQuery } from '../../api/services NodeJs/jdManagementApi';
import { AddEmployeeModal } from './employeeProfile/EmployeeProfileCoreTabs';
import EmployeeListSidebar from './employeeProfile/EmployeeListSidebar';
import EmployeeProfileTabbedView from './employeeProfile/EmployeeProfileTabbedView';
import { useNavbarPermissions } from '../../hooks/useNavbarPermissions';
import '../../styles/employeeProfileDetails.css';
import '../../styles/employees.css';

function getWingFromUrl(searchParams, location) {
  const fromParams = searchParams.get('wing');
  if (fromParams) return fromParams;
  const fromLocation = new URLSearchParams(location.search || '').get('wing');
  if (fromLocation) return fromLocation;
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx >= 0) {
    return new URLSearchParams(hash.slice(qIdx + 1)).get('wing') || '';
  }
  return '';
}

const Employees = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const wingQuery = getWingFromUrl(searchParams, location);
  const employeeParam = searchParams.get('employee') || '';

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeParam);
  const [showAddModal, setShowAddModal] = useState(false);

  // Determine if this user has edit access (was allowed /home/employeeProfileDetails)
  const { allowedPaths } = useNavbarPermissions();
  const canEdit = allowedPaths.includes('/home/employeeProfileDetails') || allowedPaths.includes('/home/employees');

  const {
    data: employeesData,
    isLoading: loadingEmployees,
    refetch: refetchEmployees,
  } = useGetAllEmployeeRegistrationsQuery();

  const employees = useMemo(() => {
    if (!employeesData) return [];
    if (Array.isArray(employeesData)) return employeesData;
    if (Array.isArray(employeesData.data)) return employeesData.data;
    return [];
  }, [employeesData]);

  useEffect(() => {
    const root = document.querySelector('.content-dashboard');
    root?.classList.add('content-dashboard--employee-profile');
    return () => root?.classList.remove('content-dashboard--employee-profile');
  }, []);

  useEffect(() => {
    setSelectedEmployeeId(employeeParam);
  }, [employeeParam]);

  const handleSelectEmployee = (id) => {
    const idStr = String(id);
    setSelectedEmployeeId(idStr);
    const next = new URLSearchParams(searchParams);
    next.set('employee', idStr);
    if (wingQuery) next.set('wing', wingQuery);
    setSearchParams(next, { replace: true });
  };

  const wingLabel = wingQuery
    ? decodeURIComponent(wingQuery.replace(/\+/g, ' '))
    : null;

  return (
    <div className="epd-container ep-shell">
      <div className="epd-header-row ep-page-header">
        <div>
          <h2 className="epd-title">Employees</h2>
          <p className="ep-page-hint">
            {canEdit
              ? 'Select an employee to view and manage their full HR profile.'
              : 'Select an employee to view their full profile.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {wingLabel && <span className="ep-employees-wing-badge">{wingLabel}</span>}
          {canEdit && (
            <button
              type="button"
              className="epd-btn epd-btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              + Add Employee
            </button>
          )}
        </div>
      </div>

      <div className="ep-layout">
        <EmployeeListSidebar
          employees={employees}
          selectedId={selectedEmployeeId}
          onSelect={handleSelectEmployee}
          isLoading={loadingEmployees}
        />

        <main className="ep-main">
          {!selectedEmployeeId ? (
            <div className="ep-main-empty">
              <h3>Select an employee</h3>
              <p>Choose someone from the list on the left to view their profile.</p>
            </div>
          ) : (
            <EmployeeProfileTabbedView
              employeeId={selectedEmployeeId}
              key={selectedEmployeeId}
              readOnly={!canEdit}
            />
          )}
        </main>
      </div>

      {showAddModal && canEdit && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onCreated={(data) => {
            refetchEmployees();
            if (data?.id) {
              handleSelectEmployee(String(data.id));
            }
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Employees;
