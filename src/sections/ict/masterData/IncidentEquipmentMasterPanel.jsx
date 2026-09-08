import React, { useMemo, useState } from 'react';
import {
  useGetIncidentEquipmentQuery,
  useGetIncidentEquipmentSubCategoriesQuery,
  useCreateIncidentEquipmentMutation,
  useUpdateIncidentEquipmentMutation,
} from '../../../api/services NodeJs/incidentEquipmentApi';

/**
 * ICT master: pilot incident equipment dropdown (inventory_items, main_category_id = 4).
 */
export default function IncidentEquipmentMasterPanel({ onMessage }) {
  const { data: rowsRaw = [], refetch, isLoading } = useGetIncidentEquipmentQuery({
    include_inactive: true,
  });
  const { data: subCategories = [] } = useGetIncidentEquipmentSubCategoriesQuery();
  const [createItem] = useCreateIncidentEquipmentMutation();
  const [updateItem] = useUpdateIncidentEquipmentMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [draftCode, setDraftCode] = useState('');
  const [draftSubCategoryId, setDraftSubCategoryId] = useState('');
  const [draftUnit, setDraftUnit] = useState('pcs');
  const [draftStatus, setDraftStatus] = useState('active');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = Array.isArray(rowsRaw) ? [...rowsRaw] : [];
    list.sort((a, b) =>
      String(a.item_name || '').localeCompare(String(b.item_name || ''), undefined, {
        sensitivity: 'base',
      })
    );
    return list;
  }, [rowsRaw]);

  const openAdd = () => {
    setEditing(null);
    setDraftName('');
    setDraftCode('');
    setDraftSubCategoryId(subCategories[0]?.id != null ? String(subCategories[0].id) : '');
    setDraftUnit('pcs');
    setDraftStatus('active');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDraftName(row.item_name || '');
    setDraftCode(row.item_code || '');
    setDraftSubCategoryId(row.sub_category_id != null ? String(row.sub_category_id) : '');
    setDraftUnit(row.unit || 'pcs');
    setDraftStatus(String(row.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const save = async () => {
    const item_name = String(draftName || '').trim();
    if (!item_name) {
      onMessage?.({ type: 'error', text: 'Item name is required.' });
      return;
    }
    if (!draftSubCategoryId && !editing) {
      // create can auto-pick first sub-category on backend if empty
    }
    if (editing && !draftSubCategoryId) {
      onMessage?.({ type: 'error', text: 'Sub category is required.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        item_name,
        item_code: String(draftCode || '').trim() || undefined,
        sub_category_id: draftSubCategoryId ? Number(draftSubCategoryId) : undefined,
        unit: String(draftUnit || 'pcs').trim() || 'pcs',
        status: draftStatus,
      };
      if (editing?.id) {
        await updateItem({ id: editing.id, ...payload, item_code: String(draftCode || '').trim() }).unwrap();
        onMessage?.({ type: 'success', text: 'Equipment item updated.' });
      } else {
        await createItem(payload).unwrap();
        onMessage?.({ type: 'success', text: 'Equipment item added.' });
      }
      await refetch();
      closeModal();
    } catch (err) {
      onMessage?.({
        type: 'error',
        text: err?.data?.message || err?.error || err?.message || 'Save failed',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vehicle-admin-card-master-data">
      <div className="master-data-chemicals-head-master-data">
        <div className="master-data-chemicals-head-text-master-data">
          <h3>Incident Equipment</h3>
          <p className="vehicle-master-note-master-data">
            Equipment list for Pilot incident reports (inventory items in main category 4). Active items appear in the app dropdown.
          </p>
        </div>
        <button
          type="button"
          className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
          onClick={openAdd}
        >
          Add equipment
        </button>
      </div>

      <div className="vehicle-table-wrap-master-data" style={{ marginTop: 12 }}>
        {isLoading ? (
          <p className="vehicle-master-note-master-data">Loading…</p>
        ) : (
          <table className="vehicle-table-master-data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Sub category</th>
                <th>Unit</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>No equipment items in category 4 yet.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const active = String(row.status || '').toLowerCase() === 'active';
                  return (
                    <tr key={row.id}>
                      <td>{row.item_code}</td>
                      <td>{row.item_name}</td>
                      <td>{row.sub_category_name || '—'}</td>
                      <td>{row.unit || '—'}</td>
                      <td>
                        <span
                          className={
                            active
                              ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                              : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                          }
                        >
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="action-btn-master-data neutral-master-data"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen ? (
        <div className="update-popup-overlay-master-data" role="presentation" onClick={closeModal}>
          <div
            className="update-popup-card-master-data update-popup-card-wide-master-data"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editing ? 'Edit equipment' : 'Add equipment'}</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="incident-eq-name">Item name</label>
                <input
                  id="incident-eq-name"
                  className="master-edit-input-master-data"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Agras T40"
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="incident-eq-code">Item code {editing ? '' : '(optional)'}</label>
                <input
                  id="incident-eq-code"
                  className="master-edit-input-master-data"
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value)}
                  placeholder={editing ? '' : 'Auto-generated if blank'}
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="incident-eq-unit">Unit</label>
                <input
                  id="incident-eq-unit"
                  className="master-edit-input-master-data"
                  value={draftUnit}
                  onChange={(e) => setDraftUnit(e.target.value)}
                />
              </div>
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="incident-eq-sub">Sub category</label>
                <select
                  id="incident-eq-sub"
                  className="master-edit-input-master-data"
                  value={draftSubCategoryId}
                  onChange={(e) => setDraftSubCategoryId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {subCategories.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.sub_category_name || sc.sub_category_code || `Sub #${sc.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="incident-eq-status">Status</label>
                <select
                  id="incident-eq-status"
                  className="master-edit-input-master-data"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="update-popup-actions-master-data">
              <button type="button" className="btn-search-master-data" onClick={closeModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit-master-data"
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
