import React, { useMemo, useState } from 'react';
import {
  useListHrLeaveAdminTypesQuery,
  useSaveHrLeaveAdminTypeMutation,
  useSetHrLeaveAdminTypeStatusMutation,
} from '../../../api/services NodeJs/hrLeaveApi';

const CATEGORIES = [
  { value: 'standard', label: 'Standard' },
  { value: 'special', label: 'Special' },
  { value: 'hr', label: 'HR only' },
  { value: 'general', label: 'General' },
];

function emptyDraft() {
  return {
    code: '',
    name: '',
    category: 'general',
    description: '',
    employee_requestable: '1',
    hr_only: '0',
    requires_medical: '0',
    requires_wfh_monitoring: '0',
    sort_order: '0',
  };
}

export default function LeaveTypesPanel({ onMessage }) {
  const { data: response, isLoading, refetch } = useListHrLeaveAdminTypesQuery({ includeInactive: 1 });
  const [saveType, { isLoading: saving }] = useSaveHrLeaveAdminTypeMutation();
  const [setStatus, { isLoading: updatingStatus }] = useSetHrLeaveAdminTypeStatusMutation();
  const [editRow, setEditRow] = useState(null);
  const [draft, setDraft] = useState(null);

  const rows = useMemo(() => {
    const list = response?.data || [];
    return [...list].sort((a, b) => (Number(a.sort_order || 0) - Number(b.sort_order || 0)) || String(a.name).localeCompare(String(b.name)));
  }, [response]);

  const notify = (text, isError = false) => onMessage?.(text, isError);

  const openAdd = () => {
    setEditRow(null);
    setDraft(emptyDraft());
  };

  const openEdit = (row) => {
    setEditRow(row);
    setDraft({
      code: row.code || '',
      name: row.name || '',
      category: row.category || 'general',
      description: row.description || '',
      employee_requestable: String(Number(row.employee_requestable ?? 1) === 1 ? 1 : 0),
      hr_only: String(Number(row.hr_only ?? 0) === 1 ? 1 : 0),
      requires_medical: String(Number(row.requires_medical ?? 0) === 1 ? 1 : 0),
      requires_wfh_monitoring: String(Number(row.requires_wfh_monitoring ?? 0) === 1 ? 1 : 0),
      sort_order: String(row.sort_order ?? 0),
    });
  };

  const closeModal = () => {
    setEditRow(null);
    setDraft(null);
  };

  const onSave = async () => {
    if (!draft) return;
    const code = String(draft.code || '').trim();
    const name = String(draft.name || '').trim();
    if (!code || !name) {
      notify('Code and name are required.', true);
      return;
    }
    try {
      await saveType({
        ...draft,
        code,
        name,
        isUpdate: editRow ? 1 : 0,
        sort_order: parseInt(draft.sort_order, 10) || 0,
        employee_requestable: parseInt(draft.employee_requestable, 10) === 1 ? 1 : 0,
        hr_only: parseInt(draft.hr_only, 10) === 1 ? 1 : 0,
        requires_medical: parseInt(draft.requires_medical, 10) === 1 ? 1 : 0,
        requires_wfh_monitoring: parseInt(draft.requires_wfh_monitoring, 10) === 1 ? 1 : 0,
        status: editRow ? (Number(editRow.status ?? 1) === 1 ? 1 : 0) : 1,
      }).unwrap();
      notify(editRow ? 'Leave type updated.' : 'Leave type created.');
      closeModal();
      refetch();
    } catch (err) {
      notify(err?.data?.message || 'Failed to save leave type.', true);
    }
  };

  const onToggleStatus = async (row) => {
    const nextStatus = Number(row.status ?? 1) === 1 ? 0 : 1;
    try {
      await setStatus({ code: row.code, status: nextStatus }).unwrap();
      notify(nextStatus === 1 ? 'Leave type activated.' : 'Leave type deactivated.');
      refetch();
    } catch (err) {
      notify(err?.data?.message || 'Failed to update status.', true);
    }
  };

  return (
    <div className="leave-grid-leavemgt">
      <div className="leave-card-leavemgt leave-span-2-leavemgt">
        <div className="leave-card-header-leavemgt leave-admin-header-leavemgt">
          <div>
            <h3>Leave Types</h3>
            <span className="leave-muted-leavemgt">Master catalog of leave types</span>
          </div>
          <button type="button" className="leave-btn-leavemgt leave-btn-approve-leavemgt" onClick={openAdd}>
            Add leave type
          </button>
        </div>
        <div className="leave-admin-table-wrap-leavemgt">
          <table className="leave-admin-table-leavemgt">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Requestable</th>
                <th>HR only</th>
                <th>Medical</th>
                <th>WFH mon.</th>
                <th>Sort</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9}>No leave types found.</td></tr>
              ) : (
                rows.map((row) => {
                  const isActive = Number(row.status ?? 1) === 1;
                  return (
                  <tr key={row.code}>
                    <td><code>{row.code}</code></td>
                    <td>{row.name}</td>
                    <td>{row.category || '-'}</td>
                    <td>{Number(row.employee_requestable ?? 0) === 1 ? 'Yes' : 'No'}</td>
                    <td>{Number(row.hr_only ?? 0) === 1 ? 'Yes' : 'No'}</td>
                    <td>{Number(row.requires_medical ?? 0) === 1 ? 'Yes' : 'No'}</td>
                    <td>{Number(row.requires_wfh_monitoring ?? 0) === 1 ? 'Yes' : 'No'}</td>
                    <td>{row.sort_order ?? 0}</td>
                    <td className="leave-admin-actions-leavemgt">
                      <button type="button" className="leave-btn-leavemgt leave-btn-secondary-leavemgt" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`leave-btn-leavemgt leave-status-toggle-leavemgt ${isActive ? 'active-leavemgt' : 'inactive-leavemgt'}`}
                        disabled={updatingStatus}
                        onClick={() => onToggleStatus(row)}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {draft ? (
        <div className="leave-holiday-modal-overlay-leavemgt" role="presentation" onClick={closeModal}>
          <div className="leave-holiday-modal-leavemgt leave-admin-modal-leavemgt" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h4>{editRow ? 'Edit leave type' : 'Add leave type'}</h4>
            <label className="leave-holiday-modal-label-leavemgt">Code</label>
            <input
              className="leave-holiday-modal-input-leavemgt"
              value={draft.code}
              disabled={Boolean(editRow)}
              onChange={(e) => setDraft((prev) => ({ ...prev, code: e.target.value }))}
              placeholder="e.g. annual_leave"
            />
            <label className="leave-holiday-modal-label-leavemgt">Name</label>
            <input
              className="leave-holiday-modal-input-leavemgt"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
            <label className="leave-holiday-modal-label-leavemgt">Category</label>
            <select
              className="leave-holiday-modal-select-leavemgt"
              value={draft.category}
              onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <label className="leave-holiday-modal-label-leavemgt">Description</label>
            <textarea
              className="leave-holiday-modal-input-leavemgt leave-admin-textarea-leavemgt"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            />
            <div className="leave-admin-form-grid-leavemgt">
              <label className="leave-checkbox-chip-leavemgt">
                <input
                  type="checkbox"
                  checked={draft.employee_requestable === '1'}
                  onChange={(e) => setDraft((prev) => ({ ...prev, employee_requestable: e.target.checked ? '1' : '0' }))}
                />
                Employee requestable
              </label>
              <label className="leave-checkbox-chip-leavemgt">
                <input
                  type="checkbox"
                  checked={draft.hr_only === '1'}
                  onChange={(e) => setDraft((prev) => ({ ...prev, hr_only: e.target.checked ? '1' : '0' }))}
                />
                HR only
              </label>
              <label className="leave-checkbox-chip-leavemgt">
                <input
                  type="checkbox"
                  checked={draft.requires_medical === '1'}
                  onChange={(e) => setDraft((prev) => ({ ...prev, requires_medical: e.target.checked ? '1' : '0' }))}
                />
                Requires medical
              </label>
              <label className="leave-checkbox-chip-leavemgt">
                <input
                  type="checkbox"
                  checked={draft.requires_wfh_monitoring === '1'}
                  onChange={(e) => setDraft((prev) => ({ ...prev, requires_wfh_monitoring: e.target.checked ? '1' : '0' }))}
                />
                Requires WFH monitoring
              </label>
            </div>
            <label className="leave-holiday-modal-label-leavemgt">Sort order</label>
            <input
              type="number"
              className="leave-holiday-modal-input-leavemgt"
              value={draft.sort_order}
              onChange={(e) => setDraft((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
            <div className="leave-holiday-modal-actions-leavemgt">
              <button type="button" className="leave-btn-leavemgt leave-btn-approve-leavemgt" disabled={saving} onClick={onSave}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="leave-btn-leavemgt leave-btn-secondary-leavemgt" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
