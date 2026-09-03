import React, { useMemo } from 'react';
import { useEmployee } from './useEmployee';
import EmployeePhotoUpload from './EmployeePhotoUpload';
import EmployeeAvatar from './EmployeeAvatar';
import {
  formatProfileDate,
  EMPLOYEE_CAREER_DATE_FIELDS,
  splitDate,
} from './employeeProfileUtils';

function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'resigned' || s === 'terminated' || s === 'retired') return 'inactive';
  if (s === 'suspended') return 'warning';
  return 'neutral';
}

export default function EmployeeProfileHero({ employeeId, readOnly = false }) {
  const { employee, isLoading, refetch } = useEmployee(employeeId);

  const careerDates = useMemo(() => {
    if (!employee) return [];
    return EMPLOYEE_CAREER_DATE_FIELDS
      .map(({ key, label }) => ({
        key,
        label,
        display: formatProfileDate(employee[key]),
        iso: splitDate(employee[key]),
      }))
      .filter((item) => item.display);
  }, [employee]);

  if (isLoading || !employee) {
    return (
      <div className="ep-hero ep-hero--loading">
        <p>Loading profile…</p>
      </div>
    );
  }

  const title = employee.preferredName || employee.employeeName || `Employee ${employeeId}`;
  const status = employee.employeeStatus || employee.workStatus || '—';
  const tone = statusTone(status);

  return (
    <div className="ep-hero">
      <div className="ep-hero-main">
        <div className="ep-hero-text">
          <div className="ep-hero-title-row">
            <h2 className="ep-hero-title">{title}</h2>
            <span className={`ep-status-pill ep-status-pill--${tone}`}>{status}</span>
          </div>
          <p className="ep-hero-subtitle">
            {employee.empNo || '—'}
            {employee.departmentName ? ` · ${employee.departmentName}` : ''}
            {(employee.designation_title || employee.designation || employee.employeeJobRoleName)
              ? ` · ${employee.designation_title || employee.designation || employee.employeeJobRoleName}`
              : ''}
          </p>
          <div className="ep-hero-metrics">
            <span><strong>NIC:</strong> {employee.nic || '—'}</span>
            <span><strong>Mobile:</strong> {employee.mobileNumber || '—'}</span>
            {employee.emailAddress ? (
              <span><strong>Email:</strong> {employee.emailAddress}</span>
            ) : null}
            {careerDates.map((item) => (
              <span key={item.key}>
                <strong>{item.label}:</strong>{' '}
                <time dateTime={item.iso}>{item.display}</time>
              </span>
            ))}
          </div>
        </div>
      </div>
      {readOnly ? (
        <div className="ep-photo-upload ep-photo-upload--hero ep-photo-upload--readonly">
          <EmployeeAvatar employee={employee} name={title} size="lg" className="ep-photo-readonly-avatar" />
        </div>
      ) : (
        <EmployeePhotoUpload
          employeeId={employeeId}
          employee={employee}
          onUploaded={refetch}
          size="hero"
        />
      )}
    </div>
  );
}
