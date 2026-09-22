import React, { useMemo, useState } from 'react';
import {
  useCreateCentralStoreRequestMutation,
  useGetCentralStoreRequestsQuery,
} from '../../api/services NodeJs/centralProcurementApi';
import {
  useGetMainCategoriesQuery,
  useGetSubCategoriesQuery,
  useGetInventoryItemsQuery,
} from '../../api/services NodeJs/stockAssetsApi';
import { useGetEmpDepartmentsQuery } from '../../api/services NodeJs/empOrgStructureApi';
import { useGetAllEmployeeRegistrationsQuery } from '../../api/services NodeJs/jdManagementApi';
import {
  getEmployeeDisplayName,
  isSeniorManagementCategory,
} from '../hr&admin/employeeProfile/employeeProfileUtils';
import { AdminPanel } from './shell/AdminStockShell';

const EMPTY_LINE = { inventory_item_id: '', requested_qty: '', main_category_id: '', sub_category_id: '' };
const SENIOR_MGMT_KEY = '_senior_mgmt';

function getUserId() {
  try {
    return JSON.parse(localStorage.getItem('userData') || '{}')?.id || null;
  } catch {
    return null;
  }
}

function statusChipClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'issued' || s === 'completed' || s === 'closed') return 'admin-stock-chip admin-stock-chip--ok';
  if (s === 'requested' || s === 'pending') return 'admin-stock-chip admin-stock-chip--warn';
  return 'admin-stock-chip admin-stock-chip--muted';
}

function employeeMatchesDepartment(employee, departmentId, departments) {
  if (!departmentId) return true;
  if (departmentId === SENIOR_MGMT_KEY) {
    return isSeniorManagementCategory(employee?.employmentCategory || employee?.employment_category);
  }

  const targetId = Number(departmentId);
  if (employee?.emp_department_id != null && Number(employee.emp_department_id) === targetId) {
    return true;
  }

  const dept = departments.find((row) => Number(row.id) === targetId);
  const deptCode = String(dept?.dept_code || '').trim().toLowerCase();
  const deptName = String(dept?.department_name || '').trim().toLowerCase();

  const legacyRaw = String(employee?.department ?? '').trim();
  if (legacyRaw) {
    const legacyNum = Number(legacyRaw);
    if (Number.isInteger(legacyNum) && legacyNum === targetId) return true;
    if (deptCode && legacyRaw.toLowerCase() === deptCode) return true;
  }

  const employeeDeptName = String(employee?.departmentName || employee?.department_name || '').trim().toLowerCase();
  if (employeeDeptName && deptName && employeeDeptName === deptName) return true;

  return false;
}

const AssetRequest = ({ embedded = false }) => {
  const [form, setForm] = useState({
    destination_type: 'workshop',
    emp_department_id: '',
    requested_for_employee_id: '',
    remarks: '',
    items: [{ ...EMPTY_LINE }],
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('ok');

  const { data: mainCategoriesData } = useGetMainCategoriesQuery();
  const { data: subCategoriesData } = useGetSubCategoriesQuery({});
  const { data: inventoryItemsData } = useGetInventoryItemsQuery({});
  const { data: departmentsData } = useGetEmpDepartmentsQuery({});
  const { data: employeeListData } = useGetAllEmployeeRegistrationsQuery({ light: 1 });
  const { data: requestsData, refetch } = useGetCentralStoreRequestsQuery({});
  const [createRequest, { isLoading: creating }] = useCreateCentralStoreRequestMutation();

  const mainCategories = Array.isArray(mainCategoriesData) ? mainCategoriesData : [];
  const subCategories = Array.isArray(subCategoriesData) ? subCategoriesData : [];
  const inventoryItems = Array.isArray(inventoryItemsData) ? inventoryItemsData : [];
  const requests = Array.isArray(requestsData) ? requestsData : [];

  const departments = useMemo(() => {
    const list = Array.isArray(departmentsData) ? departmentsData : [];
    return list.filter((d) => Number(d.activated) !== 0);
  }, [departmentsData]);

  const allEmployees = useMemo(() => {
    if (Array.isArray(employeeListData)) return employeeListData;
    if (Array.isArray(employeeListData?.data)) return employeeListData.data;
    return [];
  }, [employeeListData]);

  const isWorkshopDest = form.destination_type === 'workshop';
  const isEmployeeDest = form.destination_type === 'employee';

  const peopleInDepartment = useMemo(() => {
    if (!isEmployeeDest || !form.emp_department_id) return [];
    return allEmployees
      .filter((emp) => employeeMatchesDepartment(emp, form.emp_department_id, departments))
      .slice()
      .sort((a, b) => getEmployeeDisplayName(a).localeCompare(getEmployeeDisplayName(b)));
  }, [allEmployees, form.emp_department_id, departments, isEmployeeDest]);

  const itemsForLine = (line) => {
    let list = inventoryItems.filter((i) => String(i.status || 'active').toLowerCase() !== 'inactive');
    if (line.main_category_id) {
      list = list.filter((i) => Number(i.main_category_id) === Number(line.main_category_id));
    }
    if (line.sub_category_id) {
      list = list.filter((i) => Number(i.sub_category_id) === Number(line.sub_category_id));
    }
    return list;
  };

  const subsForLine = (line) => {
    if (!line.main_category_id) return [];
    return subCategories.filter((s) => Number(s.main_category_id) === Number(line.main_category_id));
  };

  const updateLine = (idx, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((line, i) => {
        if (i !== idx) return line;
        const next = { ...line, [key]: value };
        if (key === 'main_category_id') {
          next.sub_category_id = '';
          next.inventory_item_id = '';
        }
        if (key === 'sub_category_id') next.inventory_item_id = '';
        return next;
      }),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userId = getUserId();
    if (!userId) {
      setMessageType('warn');
      setMessage('Please sign in again.');
      return;
    }

    if (isEmployeeDest) {
      if (!form.emp_department_id) {
        setMessageType('warn');
        setMessage('Select a department (or Senior Management).');
        return;
      }
      if (!form.requested_for_employee_id) {
        setMessageType('warn');
        setMessage('Select the employee this request is for.');
        return;
      }
    }

    const items = form.items
      .map((line) => ({
        inventory_item_id: Number(line.inventory_item_id),
        requested_qty: Number(line.requested_qty),
      }))
      .filter((x) => x.inventory_item_id > 0 && x.requested_qty > 0);
    if (!items.length) {
      setMessageType('warn');
      setMessage('Add at least one catalog item with quantity.');
      return;
    }

    const payload = {
      remarks: form.remarks || null,
      requested_by: userId,
      destination_type: form.destination_type,
      items,
    };

    if (isEmployeeDest) {
      payload.requested_for_employee_id = Number(form.requested_for_employee_id);
      payload.emp_department_id = form.emp_department_id === SENIOR_MGMT_KEY
        ? null
        : Number(form.emp_department_id);
    }

    try {
      await createRequest(payload).unwrap();
      setForm({
        destination_type: form.destination_type,
        emp_department_id: '',
        requested_for_employee_id: '',
        remarks: '',
        items: [{ ...EMPTY_LINE }],
      });
      setMessageType('ok');
      setMessage('Request created. Central Stores will issue or send to procurement.');
      refetch();
    } catch (err) {
      setMessageType('warn');
      setMessage(err?.data?.message || err?.message || 'Failed to create request.');
    }
  };

  return (
    <div className={`asset-request-container${embedded ? ' asset-request-container--embedded' : ''} admin-stock-body`}>
      {!embedded ? (
        <h2 className="admin-stock-title" style={{ marginBottom: 12 }}>Asset Request</h2>
      ) : null}

      <div className="admin-stock-stack">
        {message ? (
          <div className={`admin-stock-msg admin-stock-msg--${messageType === 'ok' ? 'ok' : 'warn'}`}>
            {message}
          </div>
        ) : null}

        <AdminPanel>
          <h3 className="admin-stock-section-title">New request</h3>
          <p className="admin-stock-section-hint">
            Request catalog items from Central Stores. Workshop needs no department; employee requests pick department then person.
          </p>

          <form onSubmit={handleSubmit}>
            <div className={`admin-stock-grid-2${isWorkshopDest ? ' admin-stock-grid-2--single' : ''}`}>
              <div className="admin-stock-field">
                <label htmlFor="ws-req-dest">Destination *</label>
                <select
                  id="ws-req-dest"
                  value={form.destination_type}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    destination_type: e.target.value,
                    emp_department_id: '',
                    requested_for_employee_id: '',
                  }))}
                  required
                >
                  <option value="workshop">Workshop</option>
                  <option value="employee">Employee</option>
                </select>
              </div>

              {isEmployeeDest ? (
                <div className="admin-stock-field">
                  <label htmlFor="ws-req-dept">Department *</label>
                  <select
                    id="ws-req-dept"
                    value={form.emp_department_id}
                    onChange={(e) => setForm((p) => ({
                      ...p,
                      emp_department_id: e.target.value,
                      requested_for_employee_id: '',
                    }))}
                    required
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.department_name}
                        {d.dept_code ? ` (${d.dept_code})` : ''}
                      </option>
                    ))}
                    <option value={SENIOR_MGMT_KEY}>Senior Management</option>
                  </select>
                </div>
              ) : null}
            </div>

            {isEmployeeDest ? (
              <div className="admin-stock-field">
                <label htmlFor="ws-req-person">Employee *</label>
                <select
                  id="ws-req-person"
                  value={form.requested_for_employee_id}
                  onChange={(e) => setForm((p) => ({ ...p, requested_for_employee_id: e.target.value }))}
                  required
                  disabled={!form.emp_department_id}
                >
                  <option value="">
                    {!form.emp_department_id
                      ? 'Select department first'
                      : peopleInDepartment.length
                        ? 'Select employee'
                        : 'No people in this department'}
                  </option>
                  {peopleInDepartment.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {getEmployeeDisplayName(emp)}
                      {emp.empNo || emp.emp_no ? ` · ${emp.empNo || emp.emp_no}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="admin-stock-field">
              <label htmlFor="ws-req-remarks">Purpose / remarks</label>
              <textarea
                id="ws-req-remarks"
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                placeholder="Optional notes for this request"
              />
            </div>

            <h3 className="admin-stock-section-title" style={{ marginTop: 8 }}>Catalog lines</h3>
            {form.items.map((line, idx) => (
              <div key={`line-${idx}`} className="admin-stock-line admin-stock-line--request">
                <div className="admin-stock-field">
                  <label>Main category</label>
                  <select
                    value={line.main_category_id}
                    onChange={(e) => updateLine(idx, 'main_category_id', e.target.value)}
                  >
                    <option value="">All</option>
                    {mainCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.category_name || c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-stock-field">
                  <label>Sub category</label>
                  <select
                    value={line.sub_category_id}
                    onChange={(e) => updateLine(idx, 'sub_category_id', e.target.value)}
                  >
                    <option value="">All</option>
                    {subsForLine(line).map((s) => (
                      <option key={s.id} value={s.id}>{s.sub_category_name || s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-stock-field">
                  <label>Item *</label>
                  <select
                    value={line.inventory_item_id}
                    onChange={(e) => updateLine(idx, 'inventory_item_id', e.target.value)}
                    required
                  >
                    <option value="">Select registered item</option>
                    {itemsForLine(line).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_code} — {item.item_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-stock-field">
                  <label>Qty *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.requested_qty}
                    onChange={(e) => updateLine(idx, 'requested_qty', e.target.value)}
                    required
                  />
                </div>
                <button
                  type="button"
                  className="admin-stock-btn admin-stock-btn--ghost"
                  onClick={() => setForm((p) => ({
                    ...p,
                    items: p.items.length > 1 ? p.items.filter((_, i) => i !== idx) : [{ ...EMPTY_LINE }],
                  }))}
                >
                  Remove
                </button>
              </div>
            ))}

            <div className="admin-stock-actions">
              <button
                type="button"
                className="admin-stock-btn"
                onClick={() => setForm((p) => ({ ...p, items: [...p.items, { ...EMPTY_LINE }] }))}
              >
                + Add line
              </button>
              <button type="submit" className="admin-stock-btn admin-stock-btn--primary" disabled={creating}>
                {creating ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        </AdminPanel>

        <AdminPanel>
          <h3 className="admin-stock-section-title">Recent requests</h3>
          <div className="admin-stock-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="admin-stock-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Destination</th>
                  <th>For</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Requested</th>
                  <th>Issued</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.length ? (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.request_no || `#${r.id}`}</strong></td>
                      <td>
                        <span className="admin-stock-chip admin-stock-chip--muted">
                          {r.destination_type || 'wing'}
                        </span>
                      </td>
                      <td>
                        {r.destination_type === 'workshop'
                          ? 'Workshop'
                          : r.destination_type === 'employee'
                            ? (
                              <>
                                {r.requested_for_employee_name || `Employee #${r.requested_for_employee_id || '—'}`}
                                {r.emp_department_name ? (
                                  <div style={{ fontSize: 12, color: '#64748b' }}>{r.emp_department_name}</div>
                                ) : r.requested_for_employee_id && !r.emp_department_id ? (
                                  <div style={{ fontSize: 12, color: '#64748b' }}>Senior Management</div>
                                ) : null}
                              </>
                            )
                            : (r.wing_name || '—')}
                      </td>
                      <td><span className={statusChipClass(r.status)}>{r.status}</span></td>
                      <td>{r.item_count ?? '—'}</td>
                      <td>{r.total_requested_qty ?? '—'}</td>
                      <td>{r.total_issued_qty ?? '—'}</td>
                      <td>{r.created_at ? String(r.created_at).slice(0, 19).replace('T', ' ') : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="admin-stock-empty">No requests yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
};

export default AssetRequest;
