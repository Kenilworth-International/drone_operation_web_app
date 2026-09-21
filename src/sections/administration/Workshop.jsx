import React, { useState, useMemo, useEffect } from 'react';
import { FaEye, FaEdit, FaCheck, FaExclamationTriangle, FaBan, FaWrench } from 'react-icons/fa';
import {
  useGetMaintenanceQuery,
  useUpdateMaintenanceStatusMutation,
} from '../../api/services NodeJs/maintenanceApi';
import '../../styles/maintenance.css';

/**
 * Workshop — technician workbench for jobs after incident approval
 * (and other assigned maintenance). No create/admin add flow.
 */
const Workshop = () => {
  const [statusFilter, setStatusFilter] = useState('p');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: 'p',
    status_reason: '',
    completed_date: '',
    repair_notes: '',
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const userData = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('userData') || '{}');
    } catch {
      return {};
    }
  }, []);

  const isTechnician = userData?.job_role === 'tec';
  const userId = userData?.id || null;

  const queryFilters = useMemo(() => {
    const f = {};
    if (statusFilter) f.status = statusFilter;
    if (isTechnician && userId) f.technician_id = userId;
    return f;
  }, [statusFilter, isTechnician, userId]);

  const { data: maintenanceData, isLoading, error, refetch } = useGetMaintenanceQuery(queryFilters);
  const [updateStatus] = useUpdateMaintenanceStatusMutation();

  const records = Array.isArray(maintenanceData)
    ? maintenanceData
    : maintenanceData
      ? [maintenanceData]
      : [];

  // Prefer approved-incident jobs; still show other assigned pending work
  const workshopJobs = useMemo(() => {
    let list = records.filter((r) => r && r.id);
    // After approval: incident-linked jobs first; standalone assigned maintenance still visible
    list = [...list].sort((a, b) => {
      const ai = a.incident_id ? 0 : 1;
      const bi = b.incident_id ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return (b.id || 0) - (a.id || 0);
    });
    const term = searchTerm.trim().toLowerCase();
    if (!term) return list;
    return list.filter((r) => {
      return (
        String(r.id || '').includes(term)
        || String(r.incident_id || '').includes(term)
        || (r.drone_tag && String(r.drone_tag).toLowerCase().includes(term))
        || (r.drone_serial && String(r.drone_serial).toLowerCase().includes(term))
        || (r.description && String(r.description).toLowerCase().includes(term))
        || (r.suggestions && String(r.suggestions).toLowerCase().includes(term))
        || (r.technician_name && String(r.technician_name).toLowerCase().includes(term))
      );
    });
  }, [records, searchTerm]);

  useEffect(() => {
    if (!message || messageType !== 'success') return undefined;
    const t = setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
    return () => clearTimeout(t);
  }, [message, messageType]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      p: { label: 'Pending', color: '#f59e0b', icon: FaExclamationTriangle },
      c: { label: 'Complete', color: '#10b981', icon: FaCheck },
      pc: { label: 'Partially Complete', color: '#3b82f6', icon: FaEdit },
      z: { label: 'Cannot Rebuild', color: '#ef4444', icon: FaBan },
    };
    const config = statusConfig[status] || statusConfig.p;
    const Icon = config.icon;
    return (
      <span
        className="maintenance-status-badge-maintenance"
        style={{ backgroundColor: `${config.color}20`, color: config.color }}
      >
        <Icon style={{ marginRight: '4px' }} />
        {config.label}
      </span>
    );
  };

  const openStatus = (record) => {
    setSelected(record);
    setStatusForm({
      status: record.status || 'p',
      status_reason: record.status_reason || '',
      completed_date: record.completed_date || '',
      repair_notes: record.repair_notes || '',
    });
    setShowStatusModal(true);
  };

  const closeStatus = () => {
    setShowStatusModal(false);
    setSelected(null);
    setStatusForm({ status: 'p', status_reason: '', completed_date: '', repair_notes: '' });
  };

  const submitStatus = async (e) => {
    e.preventDefault();
    if (!selected) return;
    if ((statusForm.status === 'c' || statusForm.status === 'pc') && !String(statusForm.repair_notes || '').trim()) {
      setMessage('Please enter what was repaired.');
      setMessageType('warning');
      return;
    }
    try {
      await updateStatus({
        id: selected.id,
        status: statusForm.status,
        status_reason: statusForm.status_reason,
        completed_date: statusForm.completed_date || null,
        repair_notes: statusForm.repair_notes || null,
      }).unwrap();
      closeStatus();
      refetch();
      setMessage('Job status updated.');
      setMessageType('success');
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Could not update status.');
      setMessageType('warning');
    }
  };

  return (
    <div className="maintenance-container-maintenance">
      <div className="maintenance-header-maintenance">
        <div>
          <h1>
            <FaWrench style={{ marginRight: 8 }} />
            Workshop
          </h1>
          <p style={{ margin: '4px 0 0', color: '#5b6b7c', fontSize: 14 }}>
            Technician jobs after incident approval (and assigned maintenance).
            {isTechnician ? ' Showing your assigned jobs.' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="maintenance-filter-select-maintenance"
            style={{ minWidth: 160 }}
          >
            <option value="p">Pending</option>
            <option value="c">Complete</option>
            <option value="pc">Partially Complete</option>
            <option value="z">Cannot Rebuild</option>
            <option value="">All statuses</option>
          </select>
        </div>
      </div>

      {message ? (
        <div className={`maintenance-feedback-maintenance ${messageType}`}>{message}</div>
      ) : null}

      <div className="maintenance-search-bar-maintenance">
        <input
          type="text"
          placeholder="Search by job ID, incident, serial, suggestions…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="maintenance-search-input-maintenance"
        />
      </div>

      <div className="maintenance-status-info-maintenance">
        <strong>Queue:</strong>{' '}
        {isLoading ? 'Loading…' : `${workshopJobs.length} job(s)`}
      </div>

      <div className="maintenance-table-wrapper-maintenance">
        <table className="maintenance-table-maintenance">
          <thead>
            <tr>
              <th>Job</th>
              <th>Incident</th>
              <th>Asset</th>
              <th>Technician</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Suggestions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="8" className="maintenance-loading-cell-maintenance">
                  Loading workshop jobs…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="8" className="maintenance-error-cell-maintenance">
                  Unable to load jobs. Refresh and try again.
                </td>
              </tr>
            ) : workshopJobs.length > 0 ? (
              workshopJobs.map((record) => (
                <tr key={`workshop-${record.id}`}>
                  <td>#{record.id}</td>
                  <td>{record.incident_id ? `#${record.incident_id}` : '—'}</td>
                  <td>
                    {record.drone_tag || record.drone_serial || 'N/A'}
                    {record.drone_serial && record.drone_tag ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>{record.drone_serial}</div>
                    ) : null}
                  </td>
                  <td>{record.technician_name || 'Unassigned'}</td>
                  <td>{formatDate(record.scheduled_date)}</td>
                  <td>{getStatusBadge(record.status)}</td>
                  <td className="maintenance-description-cell-maintenance">
                    {(record.suggestions || record.description || '—').length > 60
                      ? `${String(record.suggestions || record.description).slice(0, 60)}…`
                      : (record.suggestions || record.description || '—')}
                  </td>
                  <td>
                    <div className="maintenance-actions-maintenance">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(record);
                          setShowDetails(true);
                        }}
                        className="maintenance-action-button-maintenance"
                        title="View"
                      >
                        <FaEye />
                      </button>
                      <button
                        type="button"
                        onClick={() => openStatus(record)}
                        className="maintenance-action-button-maintenance"
                        title="Update work / what repaired"
                      >
                        <FaEdit />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="maintenance-empty-cell-maintenance">
                  No workshop jobs in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showDetails && selected ? (
        <div className="maintenance-modal-overlay-maintenance">
          <div className="maintenance-modal-content-maintenance">
            <div className="maintenance-modal-header-maintenance">
              <h2>Workshop job #{selected.id}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowDetails(false);
                  setSelected(null);
                }}
                className="maintenance-modal-close-maintenance"
              >
                ×
              </button>
            </div>
            <div className="maintenance-modal-details-grid-maintenance">
              <div><strong>Incident:</strong> {selected.incident_id ? `#${selected.incident_id}` : 'N/A'}</div>
              <div><strong>Asset:</strong> {selected.drone_tag || selected.drone_serial || 'N/A'}</div>
              <div><strong>Technician:</strong> {selected.technician_name || 'N/A'}</div>
              <div><strong>Scheduled:</strong> {formatDate(selected.scheduled_date)}</div>
              <div><strong>Status:</strong> {getStatusBadge(selected.status)}</div>
              <div className="maintenance-description-full-maintenance">
                <strong>Suggestions / instructions:</strong>
                <p>{selected.suggestions || selected.description || 'N/A'}</p>
              </div>
              {selected.description && selected.suggestions ? (
                <div className="maintenance-description-full-maintenance">
                  <strong>Description:</strong>
                  <p>{selected.description}</p>
                </div>
              ) : null}
              {selected.repair_notes ? (
                <div className="maintenance-description-full-maintenance">
                  <strong>What was repaired:</strong>
                  <p>{selected.repair_notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showStatusModal && selected ? (
        <div className="maintenance-modal-overlay-maintenance">
          <div className="maintenance-modal-content-maintenance">
            <div className="maintenance-modal-header-maintenance">
              <h2>Update job #{selected.id}</h2>
              <button type="button" onClick={closeStatus} className="maintenance-modal-close-maintenance">
                ×
              </button>
            </div>
            <form onSubmit={submitStatus} className="maintenance-status-form-maintenance">
              {(selected.suggestions || selected.description) ? (
                <div className="maintenance-form-group-maintenance">
                  <label>Approved suggestions</label>
                  <p style={{ margin: 0, color: '#334155', whiteSpace: 'pre-wrap' }}>
                    {selected.suggestions || selected.description}
                  </p>
                </div>
              ) : null}
              <div className="maintenance-form-group-maintenance">
                <label>Status *</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, status: e.target.value }))}
                  required
                  className="maintenance-form-input-maintenance"
                >
                  <option value="p">Pending</option>
                  <option value="c">Complete</option>
                  <option value="pc">Partially Complete</option>
                  <option value="z">Cannot Rebuild</option>
                </select>
              </div>
              {(statusForm.status === 'pc' || statusForm.status === 'z') && (
                <div className="maintenance-form-group-maintenance">
                  <label>Status reason *</label>
                  <textarea
                    value={statusForm.status_reason}
                    onChange={(e) => setStatusForm((prev) => ({ ...prev, status_reason: e.target.value }))}
                    required
                    className="maintenance-form-textarea-maintenance"
                    rows="3"
                  />
                </div>
              )}
              {(statusForm.status === 'c' || statusForm.status === 'pc') && (
                <div className="maintenance-form-group-maintenance">
                  <label>What was repaired *</label>
                  <textarea
                    value={statusForm.repair_notes}
                    onChange={(e) => setStatusForm((prev) => ({ ...prev, repair_notes: e.target.value }))}
                    required
                    className="maintenance-form-textarea-maintenance"
                    rows="4"
                    placeholder="Describe what you repaired"
                  />
                </div>
              )}
              {statusForm.status === 'c' && (
                <div className="maintenance-form-group-maintenance">
                  <label>Completed date</label>
                  <input
                    type="date"
                    value={statusForm.completed_date}
                    onChange={(e) => setStatusForm((prev) => ({ ...prev, completed_date: e.target.value }))}
                    className="maintenance-form-input-maintenance"
                  />
                </div>
              )}
              <div className="maintenance-form-actions-maintenance">
                <button type="button" onClick={closeStatus} className="maintenance-button-secondary-maintenance">
                  Cancel
                </button>
                <button type="submit" className="maintenance-button-primary-maintenance">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Workshop;
