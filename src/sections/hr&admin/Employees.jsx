import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useGetAllEmployeeRegistrationsQuery } from '../../api/services NodeJs/jdManagementApi';
import EmployeeProfileTabbedView from './employeeProfile/EmployeeProfileTabbedView';
import EmployeeAvatar from './employeeProfile/EmployeeAvatar';
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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeParam);

  const { data: employeesData, isLoading, error } = useGetAllEmployeeRegistrationsQuery();

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

  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const q = searchTerm.toLowerCase();
    return employees.filter((employee) => (
      (employee.employeeName && employee.employeeName.toLowerCase().includes(q))
      || (employee.empNo && employee.empNo.toLowerCase().includes(q))
      || (employee.nic && employee.nic.toLowerCase().includes(q))
      || (employee.emailAddress && employee.emailAddress.toLowerCase().includes(q))
      || (employee.mobileNumber && employee.mobileNumber.includes(searchTerm))
      || (employee.employeeJobRoleName && employee.employeeJobRoleName.toLowerCase().includes(q))
      || (employee.departmentName && employee.departmentName.toLowerCase().includes(q))
      || (employee.designation_title && employee.designation_title.toLowerCase().includes(q))
    ));
  }, [employees, searchTerm]);

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
    <div className="epd-container ep-shell ep-employees-directory">
      <div className="epd-header-row ep-page-header">
        <div>
          <h2 className="epd-title">Employees</h2>
          <p className="ep-page-hint">
            Click an employee to view their full profile (read-only).
          </p>
          </div>
        {wingLabel && (
          <span className="ep-employees-wing-badge">{wingLabel}</span>
        )}
          </div>

      <div className="ep-layout ep-employees-layout">
        <aside className="ep-employees-list-panel" aria-label="Employee directory">
          <div className="ep-employees-list-search">
            <input
              type="search"
              placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
              className="ep-employees-search-input"
          />
          {searchTerm && (
            <button
                type="button"
                className="ep-employees-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
      </div>

          {isLoading && <p className="ep-employees-list-message">Loading employees…</p>}
      {error && (
            <p className="ep-employees-list-message ep-employees-list-message--error">
              {error?.data?.message || error?.message || 'Failed to load employees.'}
            </p>
          )}

          {!isLoading && !error && filteredEmployees.length === 0 && (
            <p className="ep-employees-list-message">
              {searchTerm ? 'No employees match your search.' : 'No employees registered yet.'}
            </p>
          )}

          {!isLoading && !error && filteredEmployees.length > 0 && (
            <ul className="ep-employees-cards" aria-label="Employee list">
              {filteredEmployees.map((employee) => {
                const idStr = String(employee.id);
                const isSelected = selectedEmployeeId === idStr;
                const name = employee.employeeName || employee.preferredName || 'Unnamed';
                return (
                  <li key={employee.id}>
                  <button 
                      type="button"
                      className={`ep-employees-card${isSelected ? ' ep-employees-card--selected' : ''}`}
                      onClick={() => handleSelectEmployee(employee.id)}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <EmployeeAvatar employee={employee} name={name} size="lg" />
                      <span className="ep-employees-card-name">{name}</span>
                  </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!isLoading && !error && filteredEmployees.length > 0 && (
            <p className="ep-employees-count">
              {filteredEmployees.length}
              {' '}
              employee
              {filteredEmployees.length === 1 ? '' : 's'}
            </p>
          )}
        </aside>

        <main className="ep-main">
          {!selectedEmployeeId ? (
            <div className="ep-main-empty">
              <h3>Select an employee</h3>
              <p>Choose someone from the list to view their profile.</p>
            </div>
          ) : (
            <EmployeeProfileTabbedView employeeId={selectedEmployeeId} readOnly />
          )}
        </main>
        </div>
    </div>
  );
};

export default Employees;
