import React, { useMemo, useState } from 'react';
import { employeeInitials, getEmployeePhotoUrl } from './employeeProfileUtils';

export default function EmployeeListSidebar({
  employees,
  selectedId,
  onSelect,
  isLoading,
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const preferred = (emp.preferredName || '').toLowerCase();
      const fullName = (emp.employeeName || '').toLowerCase();
      const empNo = (emp.empNo || '').toLowerCase();
      const nic = (emp.nic || '').toLowerCase();
      return preferred.includes(q) || fullName.includes(q) || empNo.includes(q) || nic.includes(q);
    });
  }, [employees, search]);

  return (
    <aside className="ep-sidebar">
      <div className="ep-sidebar-search-wrap">
        <input
          type="search"
          className="ep-sidebar-search"
          placeholder="Search name, EMP no, NIC…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="ep-sidebar-count">
        {isLoading ? 'Loading…' : `${filtered.length} employee${filtered.length === 1 ? '' : 's'}`}
      </div>
      <div className="ep-sidebar-list" role="listbox" aria-label="Employees">
        {isLoading ? (
          <p className="ep-sidebar-empty">Loading employees…</p>
        ) : filtered.length === 0 ? (
          <p className="ep-sidebar-empty">No employees match your search.</p>
        ) : (
          filtered.map((emp) => {
            const id = String(emp.id);
            const selected = id === String(selectedId);
            const name = emp.preferredName || emp.employeeName || `Employee ${emp.id}`;
            const photoUrl = getEmployeePhotoUrl(emp);
            return (
              <button
                key={emp.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`ep-sidebar-item ${selected ? 'ep-sidebar-item--selected' : ''}`}
                onClick={() => onSelect(id)}
              >
                <span className="ep-sidebar-avatar">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" />
                  ) : (
                    <span>{employeeInitials(name)}</span>
                  )}
                </span>
                <span className="ep-sidebar-item-text">
                  <span className="ep-sidebar-item-name">{name}</span>
                  <span className="ep-sidebar-item-meta">{emp.empNo || '—'}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
