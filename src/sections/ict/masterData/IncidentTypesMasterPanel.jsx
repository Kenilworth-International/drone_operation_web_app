import React, { useMemo, useState } from 'react';
import {
  useGetIncidentTypesQuery,
  useCreateIncidentTypeMutation,
  useUpdateIncidentTypeMutation,
} from '../../../api/services NodeJs/incidentTypesApi';

/**
 * ICT master: pilot incident report type dropdown (incident_types).
 */
export default function IncidentTypesMasterPanel({ onMessage }) {
  const { data: rowsRaw = [], refetch, isLoading } = useGetIncidentTypesQuery({
    include_inactive: true,
  });
  const [createType] = useCreateIncidentTypeMutation();
  const [updateType] = useUpdateIncidentTypeMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draftType, setDraftType] = useState('');
  const [draftActivated, setDraftActivated] = useState('1');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = Array.isArray(rowsRaw) ? [...rowsRaw] : [];
    list.sort((a, b) =>
      String(a.type || '').localeCompare(String(b.type || ''), undefined, { sensitivity: 'base' })
    );
    return list;
  }, [rowsRaw]);

  const openAdd = () => {
    setEditing(null);
    setDraftType('');
    setDraftActivated('1');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDraftType(row.type || '');
    setDraftActivated(String(Number(row.activated) === 0 ? 0 : 1));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setDraftType('');
    setDraftActivated('1');
  };

  const save = async () => {
    const type = String(draftType || '').trim();
    if (!type) {
      onMessage?.({ type: 'error', text: 'Incident type name is required.' });
      return;
    }
    setSaving(true);
    try {
      if (editing?.id) {
        await updateType({
          id: editing.id,
          type,
          activated: Number(draftActivated) === 0 ? 0 : 1,
        }).unwrap();
        onMessage?.({ type: 'success', text: 'Incident type updated.' });
      } else {
        await createType({ type, activated: 1 }).unwrap();
        onMessage?.({ type: 'success', text: 'Incident type added.' });
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
          <h3>Incident Types</h3>
          <p className="vehicle-master-note-master-data">
            Types shown in the Pilot app incident report dropdown (`incident_types`).
          </p>
        </div>
        <button
          type="button"
          className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
          onClick={openAdd}
        >
          Add incident type
        </button>
      </div>

      <div className="vehicle-table-wrap-master-data" style={{ marginTop: 12 }}>
        {isLoading ? (
          <p className="vehicle-master-note-master-data">Loading…</p>
        ) : (
          <table className="vehicle-table-master-data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>No incident types yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.type}</td>
                    <td>
                      <span
                        className={
                          Number(row.activated) === 1
                            ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                            : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                        }
                      >
                        {Number(row.activated) === 1 ? 'Active' : 'Inactive'}
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
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen ? (
        <div className="update-popup-overlay-master-data" role="presentation" onClick={closeModal}>
          <div
            className="update-popup-card-master-data"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editing ? 'Edit incident type' : 'Add incident type'}</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="incident-type-name">Type name</label>
                <input
                  id="incident-type-name"
                  className="master-edit-input-master-data"
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value)}
                  placeholder="e.g. Crash landing"
                  autoComplete="off"
                />
              </div>
              {editing ? (
                <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                  <label htmlFor="incident-type-status">Status</label>
                  <select
                    id="incident-type-status"
                    className="master-edit-input-master-data"
                    value={draftActivated}
                    onChange={(e) => setDraftActivated(e.target.value)}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              ) : null}
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
