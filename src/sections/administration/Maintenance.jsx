import React, { useState, useMemo, useEffect } from 'react';
import {
  FaFilter,
  FaTimes,
  FaEye,
  FaEdit,
  FaCheck,
  FaExclamationTriangle,
  FaBan,
  FaPlus,
  FaSearch,
} from 'react-icons/fa';
import {
  useGetMaintenanceQuery,
  useUpdateMaintenanceStatusMutation,
  useGetTechniciansQuery,
  useCreateMaintenanceMutation,
} from '../../api/services NodeJs/maintenanceApi';
import MaintenanceDetailStory, {
  MaintenanceProgressPills,
} from './maintenance/MaintenanceDetailStory';
import '../../styles/maintenance.css';

const Maintenance = () => {
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    status: '',
    technician_id: '',
    incident_id: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: '',
    status_reason: '',
    completed_date: '',
    repair_notes: '',
  });
  const [addForm, setAddForm] = useState({
    device_serial: '',
    technician_id: '',
    description: '',
    scheduled_date: '',
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const getCurrentUserId = () => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData?.id || null;
  };

  const cleanFilters = useMemo(() => {
    const cleaned = {};
    Object.keys(filters).forEach((key) => {
      if (filters[key] && filters[key] !== '') cleaned[key] = filters[key];
    });
    return cleaned;
  }, [filters]);

  const { data: maintenanceData, isLoading, error, refetch } = useGetMaintenanceQuery(cleanFilters);
  const { data: techniciansData } = useGetTechniciansQuery();
  const [updateStatus] = useUpdateMaintenanceStatusMutation();
  const [createMaintenance, { isLoading: isCreating }] = useCreateMaintenanceMutation();

  useEffect(() => {
    if (message && messageType === 'success') {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, messageType]);

  const maintenance = Array.isArray(maintenanceData)
    ? maintenanceData
    : maintenanceData
      ? [maintenanceData]
      : [];
  const technicians = Array.isArray(techniciansData)
    ? techniciansData
    : techniciansData
      ? [techniciansData]
      : [];

  const filteredMaintenance = useMemo(() => {
    if (!maintenance || !Array.isArray(maintenance) || maintenance.length === 0) return [];
    if (!searchTerm || searchTerm.trim() === '') return maintenance;
    const term = searchTerm.toLowerCase().trim();
    return maintenance.filter((record) => {
      if (!record) return false;
      return (
        String(record.id || '').includes(term)
        || String(record.incident_id || '').includes(term)
        || (record.drone_tag && String(record.drone_tag).toLowerCase().includes(term))
        || (record.drone_serial && String(record.drone_serial).toLowerCase().includes(term))
        || (record.technician_name && String(record.technician_name).toLowerCase().includes(term))
        || (record.creator_name && String(record.creator_name).toLowerCase().includes(term))
        || (record.description && String(record.description).toLowerCase().includes(term))
        || (record.repair_notes && String(record.repair_notes).toLowerCase().includes(term))
        || (record.suggestions && String(record.suggestions).toLowerCase().includes(term))
      );
    });
  }, [maintenance, searchTerm]);

  const statusCounts = useMemo(() => {
    const counts = { p: 0, c: 0, pc: 0, z: 0 };
    maintenance.forEach((r) => {
      if (r?.status && counts[r.status] !== undefined) counts[r.status] += 1;
    });
    return counts;
  }, [maintenance]);

  const handleViewDetails = (record) => {
    setSelectedMaintenance(record);
    setShowDetailsModal(true);
  };

  const handleCloseDetails = () => {
    setShowDetailsModal(false);
    setSelectedMaintenance(null);
  };

  const handleStatusUpdate = (record) => {
    setSelectedMaintenance(record);
    setStatusForm({
      status: record.status || 'p',
      status_reason: record.status_reason || '',
      completed_date: record.completed_date || '',
      repair_notes: record.repair_notes || '',
    });
    setShowStatusModal(true);
  };

  const handleCloseStatusModal = () => {
    setShowStatusModal(false);
    setSelectedMaintenance(null);
    setStatusForm({ status: '', status_reason: '', completed_date: '', repair_notes: '' });
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMaintenance) return;

    if ((statusForm.status === 'c' || statusForm.status === 'pc') && !String(statusForm.repair_notes || '').trim()) {
      setMessage('Please enter what was repaired.');
      setMessageType('warning');
      return;
    }

    try {
      await updateStatus({
        id: selectedMaintenance.id,
        status: statusForm.status,
        status_reason: statusForm.status_reason,
        completed_date: statusForm.completed_date || null,
        repair_notes: statusForm.repair_notes || null,
      }).unwrap();
      handleCloseStatusModal();
      refetch();
      setMessage('Maintenance status updated.');
      setMessageType('success');
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Could not update status.');
      setMessageType('warning');
    }
  };

  const handleOpenAddModal = () => {
    setAddForm({
      device_serial: '',
      technician_id: '',
      description: '',
      scheduled_date: '',
    });
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setAddForm({
      device_serial: '',
      technician_id: '',
      description: '',
      scheduled_date: '',
    });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const userId = getCurrentUserId();
    if (!userId) {
      setMessage('Please sign in again to continue.');
      setMessageType('warning');
      return;
    }
    if (!addForm.device_serial.trim() || !addForm.description.trim()) {
      setMessage('Device serial and description are required.');
      setMessageType('warning');
      return;
    }

    try {
      await createMaintenance({
        created_by: userId,
        device_serial: addForm.device_serial.trim(),
        technician_id: addForm.technician_id ? parseInt(addForm.technician_id, 10) : null,
        description: addForm.description.trim(),
        scheduled_date: addForm.scheduled_date || null,
        status: 'p',
      }).unwrap();
      handleCloseAddModal();
      refetch();
      setMessage('Maintenance record created.');
      setMessageType('success');
    } catch (err) {
      setMessage(err?.data?.message || err?.message || 'Could not create maintenance record.');
      setMessageType('warning');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      status: '',
      technician_id: '',
      incident_id: '',
    });
  };

  const formatDate = (date) => {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      p: { label: 'Pending', color: '#c47a12', icon: FaExclamationTriangle },
      c: { label: 'Complete', color: '#0f7a4f', icon: FaCheck },
      pc: { label: 'Partial', color: '#1d6fb8', icon: FaEdit },
      z: { label: 'Cannot rebuild', color: '#b42318', icon: FaBan },
    };
    const config = statusConfig[status] || statusConfig.p;
    const Icon = config.icon;
    return (
      <span
        className="maintenance-status-badge-maintenance"
        style={{ backgroundColor: `${config.color}18`, color: config.color }}
      >
        <Icon style={{ marginRight: '4px' }} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="maintenance-container-maintenance maint-page">
      <div className="maint-page-header">
        <div>
          <h1>Maintenance Management</h1>
          <p className="maint-page-subtitle">
            Track each job from incident report → condition → repair → technician.
          </p>
        </div>
        <div className="maint-page-actions">
          <button type="button" onClick={handleOpenAddModal} className="maintenance-button-primary-maintenance">
            <FaPlus /> Add job
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="maintenance-filter-button-maintenance"
          >
            <FaFilter /> {showFilters ? 'Hide filters' : 'Filters'}
          </button>
        </div>
      </div>

      <div className="maint-stat-row">
        <div className="maint-stat">
          <span className="maint-stat-value">{maintenance.length}</span>
          <span className="maint-stat-label">Total</span>
        </div>
        <div className="maint-stat maint-stat--pending">
          <span className="maint-stat-value">{statusCounts.p}</span>
          <span className="maint-stat-label">Pending</span>
        </div>
        <div className="maint-stat maint-stat--done">
          <span className="maint-stat-value">{statusCounts.c}</span>
          <span className="maint-stat-label">Complete</span>
        </div>
        <div className="maint-stat maint-stat--partial">
          <span className="maint-stat-value">{statusCounts.pc}</span>
          <span className="maint-stat-label">Partial</span>
        </div>
      </div>

      {message ? (
        <div className={`maintenance-feedback-maintenance ${messageType}`}>{message}</div>
      ) : null}

      {showFilters ? (
        <div className="maintenance-filters-maintenance">
          <div className="maintenance-filters-header-maintenance">
            <h3>Filters</h3>
            <button type="button" onClick={clearFilters} className="maintenance-clear-filters-maintenance">
              Clear all
            </button>
          </div>
          <div className="maintenance-filter-grid-maintenance">
            <div className="maintenance-filter-group-maintenance">
              <label>Start date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="maintenance-filter-input-maintenance"
              />
            </div>
            <div className="maintenance-filter-group-maintenance">
              <label>End date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="maintenance-filter-input-maintenance"
              />
            </div>
            <div className="maintenance-filter-group-maintenance">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="maintenance-filter-select-maintenance"
              >
                <option value="">All</option>
                <option value="p">Pending</option>
                <option value="c">Complete</option>
                <option value="pc">Partially complete</option>
                <option value="z">Cannot rebuild</option>
              </select>
            </div>
            <div className="maintenance-filter-group-maintenance">
              <label>Technician</label>
              <select
                value={filters.technician_id}
                onChange={(e) => handleFilterChange('technician_id', e.target.value)}
                className="maintenance-filter-select-maintenance"
              >
                <option value="">All</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>{tech.name}</option>
                ))}
              </select>
            </div>
            <div className="maintenance-filter-group-maintenance">
              <label>Incident ID</label>
              <input
                type="number"
                value={filters.incident_id}
                onChange={(e) => handleFilterChange('incident_id', e.target.value)}
                placeholder="e.g. 42"
                className="maintenance-filter-input-maintenance"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="maint-toolbar">
        <div className="maint-search-wrap">
          <FaSearch className="maint-search-icon" aria-hidden />
          <input
            type="text"
            placeholder="Search job, incident, serial, technician, repair notes…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="maintenance-search-input-maintenance"
          />
        </div>
        <div className="maint-toolbar-count">
          {isLoading ? 'Loading…' : `${filteredMaintenance.length} job(s)`}
        </div>
      </div>

      <div className="maintenance-table-wrapper-maintenance maint-table-shell">
        <table className="maintenance-table-maintenance">
          <thead>
            <tr>
              <th>Job</th>
              <th>Asset</th>
              <th>Source</th>
              <th>Technician</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="8" className="maintenance-loading-cell-maintenance">
                  Loading maintenance jobs…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="8" className="maintenance-error-cell-maintenance">
                  Unable to load records. Refresh and try again.
                </td>
              </tr>
            ) : Array.isArray(filteredMaintenance) && filteredMaintenance.length > 0 ? (
              filteredMaintenance.map((record, index) => {
                if (!record || !record.id) return null;
                return (
                  <tr key={`maintenance-${record.id}-${index}`}>
                    <td>
                      <button
                        type="button"
                        className="maint-job-link"
                        onClick={() => handleViewDetails(record)}
                      >
                        #{record.id}
                      </button>
                    </td>
                    <td>
                      <div className="maint-asset-cell">
                        <strong>{record.drone_tag || record.drone_serial || '—'}</strong>
                        {record.drone_tag && record.drone_serial ? (
                          <span>{record.drone_serial}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      {record.incident_id ? (
                        <span className="maint-source-chip">Incident #{record.incident_id}</span>
                      ) : (
                        <span className="maint-source-chip maint-source-chip--muted">Standalone</span>
                      )}
                    </td>
                    <td>{record.technician_name || 'Unassigned'}</td>
                    <td><MaintenanceProgressPills record={record} /></td>
                    <td>{getStatusBadge(record.status)}</td>
                    <td>{formatDate(record.scheduled_date)}</td>
                    <td>
                      <div className="maintenance-actions-maintenance">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(record)}
                          className="maintenance-action-button-maintenance"
                          title="View repair story"
                        >
                          <FaEye />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate(record)}
                          className="maintenance-action-button-maintenance"
                          title="Update status"
                        >
                          <FaEdit />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="maintenance-empty-cell-maintenance">
                  No maintenance jobs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showDetailsModal && selectedMaintenance ? (
        <div className="maintenance-modal-overlay-maintenance" role="presentation">
          <div
            className="maintenance-modal-content-maintenance maint-modal--story"
            role="dialog"
            aria-modal="true"
            aria-labelledby="maint-detail-title"
          >
            <div className="maintenance-modal-header-maintenance">
              <div>
                <h2 id="maint-detail-title">Repair story</h2>
                <p className="maint-modal-subtitle">Report → condition → what was fixed → who fixed</p>
              </div>
              <button type="button" onClick={handleCloseDetails} className="maintenance-modal-close-maintenance" aria-label="Close">
                <FaTimes />
              </button>
            </div>
            <MaintenanceDetailStory
              record={selectedMaintenance}
              statusBadge={getStatusBadge(selectedMaintenance.status)}
            />
            <div className="maint-modal-footer">
              <button type="button" onClick={handleCloseDetails} className="maintenance-button-secondary-maintenance">
                Close
              </button>
              <button
                type="button"
                className="maintenance-button-primary-maintenance"
                onClick={() => {
                  setShowDetailsModal(false);
                  handleStatusUpdate(selectedMaintenance);
                }}
              >
                Update status
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStatusModal && selectedMaintenance ? (
        <div className="maintenance-modal-overlay-maintenance">
          <div className="maintenance-modal-content-maintenance">
            <div className="maintenance-modal-header-maintenance">
              <h2>Update job #{selectedMaintenance.id}</h2>
              <button type="button" onClick={handleCloseStatusModal} className="maintenance-modal-close-maintenance">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleStatusSubmit} className="maintenance-status-form-maintenance">
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
                  <option value="pc">Partially complete</option>
                  <option value="z">Cannot rebuild</option>
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
                    placeholder="Why this status"
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
                    placeholder="Describe what was fixed"
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
                <button type="button" onClick={handleCloseStatusModal} className="maintenance-button-secondary-maintenance">
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

      {showAddModal ? (
        <div className="maintenance-modal-overlay-maintenance">
          <div className="maintenance-modal-content-maintenance">
            <div className="maintenance-modal-header-maintenance">
              <h2>Add maintenance job</h2>
              <button type="button" onClick={handleCloseAddModal} className="maintenance-modal-close-maintenance">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="maintenance-status-form-maintenance">
              <div className="maintenance-form-group-maintenance">
                <label>Device serial *</label>
                <input
                  type="text"
                  value={addForm.device_serial}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, device_serial: e.target.value }))}
                  required
                  className="maintenance-form-input-maintenance"
                  placeholder="Drone serial"
                />
              </div>
              <div className="maintenance-form-group-maintenance">
                <label>Technician</label>
                <select
                  value={addForm.technician_id}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, technician_id: e.target.value }))}
                  className="maintenance-form-input-maintenance"
                >
                  <option value="">Assign later</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </div>
              <div className="maintenance-form-group-maintenance">
                <label>Condition / work required *</label>
                <textarea
                  value={addForm.description}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, description: e.target.value }))}
                  required
                  className="maintenance-form-textarea-maintenance"
                  rows="4"
                  placeholder="What is wrong / what needs doing"
                />
              </div>
              <div className="maintenance-form-group-maintenance">
                <label>Scheduled date</label>
                <input
                  type="date"
                  value={addForm.scheduled_date}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, scheduled_date: e.target.value }))}
                  className="maintenance-form-input-maintenance"
                />
              </div>
              <div className="maintenance-form-actions-maintenance">
                <button type="button" onClick={handleCloseAddModal} className="maintenance-button-secondary-maintenance">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating} className="maintenance-button-primary-maintenance">
                  {isCreating ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Maintenance;
