import React, { useEffect, useMemo, useState } from 'react';
import {
  useGetEmpDepartmentsQuery,
  useGetEmpHodAssignmentsQuery,
  useSaveEmpHodAssignmentMutation,
} from '../../../api/services NodeJs/empOrgStructureApi';
import { useGetAllEmployeeRegistrationsQuery } from '../../../api/services NodeJs/jdManagementApi';

function HodModal({ title, onClose, onSubmit, submitLabel, children, submitting, onClear, clearLabel }) {
  return (
    <div className="emp-org-modal-overlay" onClick={onClose} role="presentation">
      <div className="emp-org-modal emp-org-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="emp-org-modal-header">
          <h4>{title}</h4>
          <button type="button" className="emp-org-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="emp-org-modal-body">{children}</div>
          <div className="emp-org-modal-footer" style={{ justifyContent: onClear ? 'space-between' : undefined }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {onClear ? (
                <button
                  type="button"
                  className="emp-org-btn emp-org-btn--danger"
                  onClick={onClear}
                  disabled={submitting}
                >
                  {clearLabel || 'Clear assignment'}
                </button>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button type="button" className="emp-org-btn emp-org-btn--secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="emp-org-btn" disabled={submitting}>
                {submitting ? 'Saving…' : submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HodAssignmentTab({ notify, refreshToken = 0 }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ employee_id: '', dept_ids: [] });
  const [saving, setSaving] = useState(false);

  const { data: assignments = [], refetch } = useGetEmpHodAssignmentsQuery();
  const { data: departments = [], refetch: refetchDepartments } = useGetEmpDepartmentsQuery();
  const { data: employeesData } = useGetAllEmployeeRegistrationsQuery();
  const [saveAssignment] = useSaveEmpHodAssignmentMutation();

  const employees = useMemo(() => {
    if (!employeesData) return [];
    if (Array.isArray(employeesData)) return employeesData;
    if (Array.isArray(employeesData.data)) return employeesData.data;
    return [];
  }, [employeesData]);

  const activeDepartments = useMemo(
    () => departments.filter((d) => Number(d.activated) === 1),
    [departments],
  );

  const hodByDept = useMemo(() => {
    const map = new Map();
    assignments.forEach((row) => {
      (row.dept_ids || []).forEach((deptId) => {
        map.set(Number(deptId), {
          employeeId: row.employee_id,
          employeeName: row.employee_name,
        });
      });
    });
    return map;
  }, [assignments]);

  useEffect(() => {
    if (!refreshToken) return;
    refetch();
    refetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const employeeLabel = (emp) => {
    const name = emp.employeeName || emp.preferredName || 'Employee';
    return emp.empNo ? `${name} (${emp.empNo})` : `${name} #${emp.id}`;
  };

  const openAdd = () => {
    setForm({ employee_id: '', dept_ids: [] });
    setModal('add');
  };

  const openEdit = (row) => {
    setForm({
      employee_id: String(row.employee_id),
      dept_ids: Array.isArray(row.dept_ids) ? row.dept_ids.map(Number) : [],
    });
    setModal('edit');
  };

  const toggleDept = (deptId) => {
    const id = Number(deptId);
    setForm((prev) => {
      const set = new Set(prev.dept_ids || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, dept_ids: Array.from(set) };
    });
  };

  const previewTitle = useMemo(() => {
    const names = activeDepartments
      .filter((d) => (form.dept_ids || []).includes(Number(d.id)))
      .map((d) => d.department_name);
    if (!names.length) return 'Head of Department';
    return `Head of Department (${names.join(', ')})`;
  }, [form.dept_ids, activeDepartments]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id) {
      notify('Select the HOD employee.', 'error');
      return;
    }
    if (!form.dept_ids?.length) {
      notify('Select at least one department, or use Clear assignment.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveAssignment({
        employee_id: Number(form.employee_id),
        dept_ids: form.dept_ids.map(Number),
      }).unwrap();
      refetch();
      refetchDepartments();
      notify(modal === 'edit' ? 'HOD assignment updated.' : 'HOD assignment saved.');
      setModal(null);
    } catch (err) {
      notify(err?.data?.message || 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!form.employee_id) return;
    if (!window.confirm('Clear this HOD from all departments?')) return;
    setSaving(true);
    try {
      await saveAssignment({
        employee_id: Number(form.employee_id),
        dept_ids: [],
        clear: true,
      }).unwrap();
      refetch();
      refetchDepartments();
      notify('HOD assignment cleared.');
      setModal(null);
    } catch (err) {
      notify(err?.data?.message || 'Clear failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="emp-org-panel">
      <p className="emp-org-hint">
        Assign one employee as Head of Department for one or more departments.
        Their designation becomes <strong>Head of Department (Dept A, Dept B)</strong>.
        Job descriptions stay per department in JD Management (one JD list per department HOD designation).
      </p>

      <div className="emp-org-panel-toolbar">
        <button type="button" className="emp-org-btn" onClick={openAdd}>+ Assign HOD</button>
      </div>

      <table className="emp-org-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>EMP no.</th>
            <th>Departments</th>
            <th>Designation</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {assignments.length === 0 ? (
            <tr><td colSpan={5} className="emp-org-empty-cell">No HOD assignments yet.</td></tr>
          ) : assignments.map((row) => (
            <tr key={row.employee_id}>
              <td>{row.employee_name}</td>
              <td>{row.emp_no || '—'}</td>
              <td className="emp-org-dept-list">{row.department_names || '—'}</td>
              <td>{row.designation_title || '—'}</td>
              <td>
                <button type="button" className="emp-org-link-btn" onClick={() => openEdit(row)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <HodModal
          title={modal === 'edit' ? 'Edit HOD assignment' : 'Assign HOD'}
          onClose={() => setModal(null)}
          onSubmit={handleSave}
          submitLabel={modal === 'edit' ? 'Update' : 'Save'}
          submitting={saving}
          onClear={modal === 'edit' ? handleClear : undefined}
          clearLabel="Clear assignment"
        >
          <label className="emp-org-field">
            <span>Employee *</span>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              required
              disabled={modal === 'edit'}
              style={modal === 'edit' ? { background: '#f5f5f5' } : undefined}
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
              ))}
            </select>
          </label>

          <div className="emp-org-field">
            <span>Departments *</span>
            <span className="emp-org-field-hint">
              Each department can have only one HOD. Selecting a department currently held by someone else will replace them.
            </span>
            <div className="emp-org-dept-grid">
              {activeDepartments.map((d) => {
                const heldBy = hodByDept.get(Number(d.id));
                const heldByOther = heldBy
                  && form.employee_id
                  && Number(heldBy.employeeId) !== Number(form.employee_id);
                return (
                  <label
                    key={d.id}
                    className="emp-org-dept-chip"
                    title={heldByOther ? `Currently ${heldBy.employeeName} — will be replaced` : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={(form.dept_ids || []).includes(Number(d.id))}
                      onChange={() => toggleDept(d.id)}
                    />
                    {d.department_name}
                    {heldByOther ? ` (now: ${heldBy.employeeName})` : ''}
                  </label>
                );
              })}
            </div>
          </div>

          <label className="emp-org-field">
            <span>Designation preview</span>
            <input value={previewTitle} readOnly style={{ background: '#f5f5f5' }} />
            <span className="emp-org-field-hint">
              In JD Management, create separate job descriptions under each
              &quot;Head of Department (Department name)&quot; designation.
            </span>
          </label>
        </HodModal>
      )}
    </div>
  );
}
