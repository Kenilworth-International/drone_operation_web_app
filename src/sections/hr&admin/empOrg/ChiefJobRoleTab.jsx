import React, { useEffect, useMemo, useState } from 'react';
import {
  useGetEmpChiefJobRolesQuery,
  useSaveEmpChiefJobRoleMutation,
  useGetEmpDepartmentsQuery,
  useGetEmpManagementLayersQuery,
} from '../../../api/services NodeJs/empOrgStructureApi';
import {
  useGetUserJobDescriptionsQuery,
  useCreateUserJobDescriptionMutation,
  useUpdateUserJobDescriptionMutation,
  useGetAllEmployeeRegistrationsQuery,
} from '../../../api/services NodeJs/jdManagementApi';
import {
  findSeniorLayer,
  getLayerPowerBounds,
  isPowerInLayerRange,
  layerPowerHint,
} from './empOrgLayerPower';

const EMPTY_CHIEF = {
  jr_code: '',
  job_role: '',
  mgt_layer_id: '',
  power: 0,
  sort_order: 0,
  activated: 1,
  holder_employee_id: '',
  dept_ids: [],
};

function getCurrentUserId() {
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData?.id || null;
  } catch {
    return null;
  }
}

/** API may return { data: [...] } or nested { data: { data: [...] } }. */
function extractJdList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
}

function ChiefModal({ title, onClose, onSubmit, submitLabel, children, submitting }) {
  return (
    <div className="emp-org-modal-overlay" onClick={onClose} role="presentation">
      <div className="emp-org-modal emp-org-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="emp-org-modal-header">
          <h4>{title}</h4>
          <button type="button" className="emp-org-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="emp-org-modal-body">{children}</div>
          <div className="emp-org-modal-footer">
            <button type="button" className="emp-org-btn emp-org-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="emp-org-btn" disabled={submitting}>
              {submitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ChiefJobRoleTab({ notify, refreshToken = 0 }) {
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [roleModal, setRoleModal] = useState(null);
  const [roleForm, setRoleForm] = useState(EMPTY_CHIEF);
  const [savingRole, setSavingRole] = useState(false);
  const [jdModal, setJdModal] = useState(null);
  const [jdForm, setJdForm] = useState({ taskDescription: '', status: 1 });
  const [savingJd, setSavingJd] = useState(false);

  const { data: chiefRoles = [], refetch: refetchChiefs } = useGetEmpChiefJobRolesQuery();
  const { data: departments = [], refetch: refetchDepartments } = useGetEmpDepartmentsQuery();
  const { data: layers = [], refetch: refetchLayers } = useGetEmpManagementLayersQuery();
  const { data: employeesData } = useGetAllEmployeeRegistrationsQuery();
  const [saveChiefRole] = useSaveEmpChiefJobRoleMutation();
  const [createJd] = useCreateUserJobDescriptionMutation();
  const [updateJd] = useUpdateUserJobDescriptionMutation();

  const employees = useMemo(() => {
    if (!employeesData) return [];
    if (Array.isArray(employeesData)) return employeesData;
    if (Array.isArray(employeesData.data)) return employeesData.data;
    return [];
  }, [employeesData]);

  const employeeLabel = (emp) => {
    const name = emp.employeeName || emp.preferredName || 'Employee';
    return emp.empNo ? `${name} (${emp.empNo})` : `${name} #${emp.id}`;
  };

  const holderLabel = (role) => {
    if (!role?.holder_employee_id) return '—';
    if (role.holder_employee_name || role.holder_emp_no) {
      const name = role.holder_employee_name || 'Employee';
      return role.holder_emp_no ? `${name} (${role.holder_emp_no})` : name;
    }
    const emp = employees.find((e) => Number(e.id) === Number(role.holder_employee_id));
    return emp ? employeeLabel(emp) : `Employee #${role.holder_employee_id}`;
  };

  const selectedRole = useMemo(
    () => chiefRoles.find((r) => String(r.id) === String(selectedRoleId)) || null,
    [chiefRoles, selectedRoleId],
  );

  const { data: jdsResponse, refetch: refetchJds } = useGetUserJobDescriptionsQuery(
    selectedRoleId ? { emp_job_role_id: Number(selectedRoleId) } : undefined,
    { skip: !selectedRoleId },
  );

  const chiefJds = useMemo(() => {
    const list = extractJdList(jdsResponse);
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return b.status - a.status;
      return a.taskOrder - b.taskOrder;
    });
  }, [jdsResponse]);

  useEffect(() => {
    if (!selectedRoleId && chiefRoles.length > 0) {
      setSelectedRoleId(String(chiefRoles[0].id));
    }
  }, [chiefRoles, selectedRoleId]);

  useEffect(() => {
    if (!refreshToken) return;
    refetchChiefs();
    refetchDepartments();
    refetchLayers();
    if (selectedRoleId) refetchJds();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh only when tab is re-selected
  }, [refreshToken]);

  const activeDepartments = useMemo(
    () => departments.filter((d) => Number(d.activated) === 1),
    [departments],
  );

  const seniorLayer = useMemo(() => findSeniorLayer(layers), [layers]);
  const seniorPowerBounds = useMemo(() => getLayerPowerBounds(seniorLayer), [seniorLayer]);

  const assignedDeptByChief = useMemo(() => {
    const map = new Map();
    chiefRoles.forEach((role) => {
      if (Number(role.activated) !== 1) return;
      (role.dept_ids || []).forEach((deptId) => {
        map.set(Number(deptId), { roleId: role.id, roleName: role.job_role });
      });
    });
    return map;
  }, [chiefRoles]);

  const getDeptAssignment = (deptId) => assignedDeptByChief.get(Number(deptId)) || null;

  const isDeptBlocked = (deptId) => {
    const assigned = getDeptAssignment(deptId);
    if (!assigned) return false;
    if (roleForm.id && Number(roleForm.id) === Number(assigned.roleId)) return false;
    return true;
  };

  const getDeptBlockTitle = (deptId) => {
    const assigned = getDeptAssignment(deptId);
    if (!assigned || (roleForm.id && Number(roleForm.id) === Number(assigned.roleId))) return undefined;
    return `Already managed by ${assigned.roleName}`;
  };

  const openAddRole = async () => {
    await refetchChiefs();
    const bounds = getLayerPowerBounds(seniorLayer);
    setRoleForm({
      ...EMPTY_CHIEF,
      mgt_layer_id: seniorLayer ? String(seniorLayer.id) : '',
      power: bounds ? bounds.min : 170,
      holder_employee_id: '',
      dept_ids: [],
    });
    setRoleModal('add');
  };

  const openEditRole = async (row) => {
    await refetchChiefs();
    setRoleForm({
      id: row.id,
      jr_code: row.jr_code || '',
      job_role: row.job_role || '',
      mgt_layer_id: seniorLayer ? String(seniorLayer.id) : (row.mgt_layer_id ? String(row.mgt_layer_id) : ''),
      power: row.power ?? (seniorPowerBounds?.min ?? 170),
      sort_order: row.sort_order ?? 0,
      activated: row.activated ?? 1,
      holder_employee_id: row.holder_employee_id ? String(row.holder_employee_id) : '',
      dept_ids: Array.isArray(row.dept_ids) ? row.dept_ids.map(Number) : [],
    });
    setRoleModal('edit');
  };

  const toggleDept = (deptId) => {
    const id = Number(deptId);
    if (isDeptBlocked(id)) return;
    setRoleForm((prev) => {
      const set = new Set(prev.dept_ids || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, dept_ids: Array.from(set) };
    });
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.dept_ids?.length) {
      notify('Select at least one managed department.', 'error');
      return;
    }
    if (!seniorLayer) {
      notify('Senior Management layer is not configured.', 'error');
      return;
    }
    if (!isPowerInLayerRange(roleForm.power, seniorLayer)) {
      notify(layerPowerHint(seniorLayer) || 'Power is outside the Senior Management range.', 'error');
      return;
    }
    const blockedDepts = (roleForm.dept_ids || []).filter((id) => isDeptBlocked(id));
    if (blockedDepts.length) {
      notify('Selected departments include one or more already managed by another chief role.', 'error');
      return;
    }
    setSavingRole(true);
    try {
      await saveChiefRole({
        ...roleForm,
        mgt_layer_id: Number(seniorLayer.id),
        power: Number(roleForm.power || 0),
        sort_order: roleForm.sort_order === '' || roleForm.sort_order == null
          ? 0
          : Number(roleForm.sort_order),
        holder_employee_id: roleForm.holder_employee_id
          ? Number(roleForm.holder_employee_id)
          : null,
      }).unwrap();
      refetchChiefs();
      notify(roleModal === 'edit' ? 'Chief role updated.' : 'Chief role added.');
      setRoleModal(null);
    } catch (err) {
      notify(err?.data?.message || 'Save failed.', 'error');
    } finally {
      setSavingRole(false);
    }
  };

  const openAddJd = () => {
    setJdForm({ taskDescription: '', status: 1 });
    setJdModal('add');
  };

  const openEditJd = (task) => {
    setJdForm({
      id: task.id,
      taskDescription: task.taskDescription || '',
      status: task.status ?? 1,
    });
    setJdModal('edit');
  };

  const handleSaveJd = async (e) => {
    e.preventDefault();
    if (!jdForm.taskDescription?.trim()) {
      notify('Task description is required.', 'error');
      return;
    }
    setSavingJd(true);
    try {
      const userId = getCurrentUserId();
      if (jdModal === 'edit' && jdForm.id) {
        await updateJd({
          id: jdForm.id,
          taskDescription: jdForm.taskDescription.trim(),
          status: Number(jdForm.status),
          updatedBy: userId,
        }).unwrap();
      } else {
        await createJd({
          emp_job_role_id: Number(selectedRoleId),
          taskDescription: jdForm.taskDescription.trim(),
          status: Number(jdForm.status),
          createdBy: userId,
        }).unwrap();
      }
      refetchJds();
      notify(jdModal === 'edit' ? 'Task updated.' : 'Task added.');
      setJdModal(null);
    } catch (err) {
      notify(err?.data?.message || 'Save failed.', 'error');
    } finally {
      setSavingJd(false);
    }
  };

  return (
    <div className="emp-org-panel">
      <p className="emp-org-hint">
        Chief-level roles (C-suite) oversee multiple departments. Assign the employee who holds each post.
        Higher power means higher authority — CEO should have the highest power.
        Job descriptions here apply to the chief role company-wide (not per department).
      </p>

      <div className="emp-org-panel-toolbar">
        <button type="button" className="emp-org-btn" onClick={openAddRole}>+ Add chief role</button>
      </div>

      <table className="emp-org-table emp-org-table--selectable">
        <thead>
          <tr>
            <th>Code</th>
            <th>Role</th>
            <th>Holder</th>
            <th>Power</th>
            <th>Managed departments</th>
            <th>Layer</th>
            <th>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {chiefRoles.length === 0 ? (
            <tr><td colSpan={8} className="emp-org-empty-cell">No chief roles configured.</td></tr>
          ) : chiefRoles.map((r) => (
            <tr
              key={r.id}
              className={`${Number(r.chief) === 1 ? 'emp-org-row-chief' : ''} ${String(selectedRoleId) === String(r.id) ? 'emp-org-row-selected' : ''}`}
              onClick={() => setSelectedRoleId(String(r.id))}
            >
              <td>{r.jr_code}</td>
              <td>{r.job_role}</td>
              <td>{holderLabel(r)}</td>
              <td><strong>{r.power}</strong></td>
              <td className="emp-org-dept-list">{r.department_names || '—'}</td>
              <td>{r.layer_name || '—'}</td>
              <td>{Number(r.activated) === 1 ? 'Yes' : 'No'}</td>
              <td>
                <button
                  type="button"
                  className="emp-org-link-btn"
                  onClick={(e) => { e.stopPropagation(); openEditRole(r); }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedRole ? (
        <div className="emp-org-chief-jd">
          <div className="emp-org-subsection-header">
            <h4 className="emp-org-subsection-title">
              Job descriptions — {selectedRole.job_role}
            </h4>
            <button type="button" className="emp-org-btn" onClick={openAddJd}>
              + Add task
            </button>
          </div>
          <p className="emp-org-hint">
            Manages: {selectedRole.department_names || 'no departments assigned'}
          </p>
          <table className="emp-org-table">
            <thead>
              <tr><th>#</th><th>Task</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {chiefJds.length === 0 ? (
                <tr><td colSpan={4} className="emp-org-empty-cell">No job description tasks yet.</td></tr>
              ) : chiefJds.map((task, idx) => (
                <tr key={task.id} className={Number(task.status) !== 1 ? 'emp-org-row-muted' : ''}>
                  <td>{idx + 1}</td>
                  <td>{task.taskDescription}</td>
                  <td>{Number(task.status) === 1 ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button type="button" className="emp-org-link-btn" onClick={() => openEditJd(task)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="emp-org-hint">Select a chief role to manage job descriptions.</p>
      )}

      {roleModal && (
        <ChiefModal
          title={roleModal === 'edit' ? 'Edit chief job role' : 'Add chief job role'}
          onClose={() => setRoleModal(null)}
          onSubmit={handleSaveRole}
          submitLabel={roleModal === 'edit' ? 'Update' : 'Add'}
          submitting={savingRole}
        >
          <label className="emp-org-field">
            <span>Role code *</span>
            <input
              value={roleForm.jr_code}
              onChange={(e) => setRoleForm({ ...roleForm, jr_code: e.target.value.toLowerCase().replace(/\s+/g, '') })}
              readOnly={roleModal === 'edit'}
              required
              style={roleModal === 'edit' ? { background: '#f5f5f5' } : undefined}
            />
          </label>
          <label className="emp-org-field">
            <span>Job role title *</span>
            <input
              value={roleForm.job_role}
              onChange={(e) => setRoleForm({ ...roleForm, job_role: e.target.value })}
              required
            />
          </label>
          <label className="emp-org-field">
            <span>Management layer</span>
            <input
              value={seniorLayer ? `${seniorLayer.layer_name}${seniorPowerBounds ? ` (${seniorPowerBounds.min}–${seniorPowerBounds.max})` : ''}` : 'Senior Management'}
              readOnly
              style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
            />
            <span className="emp-org-field-hint">Chief roles are always Senior Management.</span>
          </label>
          <label className="emp-org-field">
            <span>Power *</span>
            <input
              type="number"
              value={roleForm.power}
              onChange={(e) => setRoleForm({ ...roleForm, power: e.target.value })}
              min={seniorPowerBounds?.min}
              max={seniorPowerBounds?.max}
              required
            />
            <span className="emp-org-field-hint">
              {layerPowerHint(seniorLayer) || 'Allowed power: 170–200'}. CEO must have the highest power among chief roles.
            </span>
          </label>
          <label className="emp-org-field">
            <span>Position holder (employee)</span>
            <select
              value={roleForm.holder_employee_id || ''}
              onChange={(e) => setRoleForm({ ...roleForm, holder_employee_id: e.target.value })}
            >
              <option value="">Not set</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {employeeLabel(emp)}
                </option>
              ))}
            </select>
            <span className="emp-org-field-hint">
              Employee who currently holds this chief post. One employee can hold only one chief role.
            </span>
          </label>
          <label className="emp-org-field">
            <span>Sort order</span>
            <input
              type="number"
              value={roleForm.sort_order}
              onChange={(e) => setRoleForm({ ...roleForm, sort_order: e.target.value })}
              min={0}
            />
          </label>
          <label className="emp-org-check">
            <input
              type="checkbox"
              checked={Number(roleForm.activated) === 1}
              onChange={(e) => setRoleForm({ ...roleForm, activated: e.target.checked ? 1 : 0 })}
            />
            Active
          </label>
          <div className="emp-org-field">
            <span>Managed departments *</span>
            <span className="emp-org-field-hint">
              Each department can be assigned to only one chief role at a time.
            </span>
            <div className="emp-org-dept-grid">
              {activeDepartments.map((d) => {
                const blocked = isDeptBlocked(d.id);
                return (
                  <label
                    key={d.id}
                    className={`emp-org-dept-chip${blocked ? ' emp-org-dept-chip--disabled' : ''}`}
                    title={getDeptBlockTitle(d.id)}
                  >
                    <input
                      type="checkbox"
                      checked={(roleForm.dept_ids || []).includes(Number(d.id))}
                      onChange={() => toggleDept(d.id)}
                      disabled={blocked}
                    />
                    {d.department_name}
                  </label>
                );
              })}
            </div>
          </div>
        </ChiefModal>
      )}

      {jdModal && (
        <ChiefModal
          title={jdModal === 'edit' ? 'Edit job description task' : 'Add job description task'}
          onClose={() => setJdModal(null)}
          onSubmit={handleSaveJd}
          submitLabel={jdModal === 'edit' ? 'Update' : 'Add'}
          submitting={savingJd}
        >
          <label className="emp-org-field">
            <span>Task description *</span>
            <textarea
              rows={4}
              value={jdForm.taskDescription}
              onChange={(e) => setJdForm({ ...jdForm, taskDescription: e.target.value })}
              required
            />
          </label>
          <label className="emp-org-field">
            <span>Status</span>
            <select
              value={jdForm.status}
              onChange={(e) => setJdForm({ ...jdForm, status: Number(e.target.value) })}
            >
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </label>
        </ChiefModal>
      )}
    </div>
  );
}
