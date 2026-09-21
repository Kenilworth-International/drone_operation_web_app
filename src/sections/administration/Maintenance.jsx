import React, { useState, useMemo, useEffect } from 'react';
import { FaFilter, FaTimes, FaEye, FaEdit, FaCheck, FaExclamationTriangle, FaBan, FaPlus } from 'react-icons/fa';
import {
  useGetMaintenanceQuery,
  useUpdateMaintenanceStatusMutation,
  useGetTechniciansQuery,
  useCreateMaintenanceMutation,
} from '../../api/services NodeJs/maintenanceApi';
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
  const [statusForm, setStatusForm] = useState({ status: '', status_reason: '', completed_date: '', repair_notes: '' });
  const [addForm, setAddForm] = useState({
    device_serial: '',
    technician_id: '',
    description: '',
    scheduled_date: '',
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const getCurrentUserId = () => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    return userData?.id || null;
  };

  // Clean filters
  const cleanFilters = useMemo(() => {
    const cleaned = {};
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== '') {
        cleaned[key] = filters[key];
      }
    });
    return cleaned;
  }, [filters]);

  // Fetch data
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

  const maintenance = Array.isArray(maintenanceData) ? maintenanceData : (maintenanceData ? [maintenanceData] : []);
  const technicians = Array.isArray(techniciansData) ? techniciansData : (techniciansData ? [techniciansData] : []);

  // Filter maintenance based on search
  const [searchTerm, setSearchTerm] = useState('');
  const filteredMaintenance = useMemo(() => {
    if (!maintenance || !Array.isArray(maintenance) || maintenance.length === 0) {
      return [];
    }
    if (!searchTerm || searchTerm.trim() === '') {
      return maintenance;
    }
    const term = searchTerm.toLowerCase().trim();
    return maintenance.filter(record => {
      if (!record) return false;
      return (
        (record.drone_tag && String(record.drone_tag).toLowerCase().includes(term)) ||
        (record.drone_serial && String(record.drone_serial).toLowerCase().includes(term)) ||
        (record.technician_name && String(record.technician_name).toLowerCase().includes(term)) ||
        (record.creator_name && String(record.creator_name).toLowerCase().includes(term)) ||
        (record.description && String(record.description).toLowerCase().includes(term))
      );
    });
  }, [maintenance, searchTerm]);

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
    setFilters(prev => ({ ...prev, [key]: value }));
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
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'p': { label: 'Pending', color: '#f59e0b', icon: FaExclamationTriangle },
      'c': { label: 'Complete', color: '#10b981', icon: FaCheck },
      'pc': { label: 'Partially Complete', color: '#3b82f6', icon: FaEdit },
      'z': { label: 'Cannot Rebuild', color: '#ef4444', icon: FaBan },
    };
    const config = statusConfig[status] || statusConfig['p'];
    const Icon = config.icon;
    return (
      <span className="maintenance-status-badge-maintenance" style={{ backgroundColor: config.color + '20', color: config.color }}>
        <Icon style={{ marginRight: '4px' }} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="maintenance-container-maintenance">
      <div className="maintenance-header-maintenance">
        <h1>Maintenance Management</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="maintenance-button-primary-maintenance"
          >
            <FaPlus /> Add Maintenance
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="maintenance-filter-button-maintenance"
          >
            <FaFilter /> {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>
      </div>

      {message && (
        <div className={`maintenance-feedback-maintenance ${messageType}`}>
          {message}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="maintenance-filters-maintenance">
          <div className="maintenance-filters-header-maintenance">
            <h3>Filters</h3>
            <button onClick={clearFilters} className="maintenance-clear-filters-maintenance">Clear All</button>
          </div>
          <div className="maintenance-filter-grid-maintenance">
            <div className="maintenance-filter-group-maintenance">
              <label>Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="maintenance-filter-input-maintenance"
              />
            </div>
            <div className="maintenance-filter-group-maintenance">
              <label>End Date</label>
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
                <option value="">All Status</option>
                <option value="p">Pending</option>
                <option value="c">Complete</option>
                <option value="pc">Partially Complete</option>
                <option value="z">Cannot Rebuild</option>
              </select>
            </div>
            <div className="maintenance-filter-group-maintenance">
              <label>Technician</label>
              <select
                value={filters.technician_id}
                onChange={(e) => handleFilterChange('technician_id', e.target.value)}
                className="maintenance-filter-select-maintenance"
              >
                <option value="">All Technicians</option>
                {technicians.map(tech => (
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
                placeholder="Filter by incident ID"
                className="maintenance-filter-input-maintenance"
              />
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="maintenance-search-bar-maintenance">
        <input
          type="text"
          placeholder="Search by drone tag, serial, technician, creator, description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="maintenance-search-input-maintenance"
        />
      </div>

      {/* Status Info */}
      <div className="maintenance-status-info-maintenance">
        <strong>Status:</strong> {isLoading ? 'Loading...' : `Found ${filteredMaintenance?.length || 0} record(s) out of ${maintenance.length} total`}
      </div>

      {/* Maintenance Table */}
      <div className="maintenance-table-wrapper-maintenance">
        <table className="maintenance-table-maintenance">
          <thead>
            <tr>
              <th>ID</th>
              <th>Incident ID</th>
              <th>Drone Tag</th>
              <th>Drone Serial</th>
              <th>Technician</th>
              <th>Created By</th>
              <th>Scheduled Date</th>
              <th>Completed Date</th>
              <th>Status</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="11" className="maintenance-loading-cell-maintenance">
                  <strong>Loading maintenance records...</strong>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="11" className="maintenance-error-cell-maintenance">
                  <strong>Unable to load records.</strong> Refresh the page and try again.
                </td>
              </tr>
            ) : Array.isArray(filteredMaintenance) && filteredMaintenance.length > 0 ? (
              filteredMaintenance.map((record, index) => {
                if (!record || !record.id) {
                  return null;
                }
                return (
                  <tr key={`maintenance-${record.id}-${index}`}>
                    <td>{record.id}</td>
                    <td>{record.incident_id ? `#${record.incident_id}` : 'N/A'}</td>
                    <td>{record.drone_tag || 'N/A'}</td>
                    <td>{record.drone_serial || 'N/A'}</td>
                    <td>{record.technician_name || 'N/A'}</td>
                    <td>{record.creator_name || 'N/A'}</td>
                    <td>{formatDate(record.scheduled_date)}</td>
                    <td>{formatDate(record.completed_date)}</td>
                    <td>{getStatusBadge(record.status)}</td>
                    <td className="maintenance-description-cell-maintenance">
                      {record.description ? (record.description.length > 50 ? record.description.substring(0, 50) + '...' : record.description) : 'N/A'}
                    </td>
                    <td>
                      <div className="maintenance-actions-maintenance">
                        <button
                          onClick={() => handleViewDetails(record)}
                          className="maintenance-action-button-maintenance"
                          title="View Details"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(record)}
                          className="maintenance-action-button-maintenance"
                          title="Update Status"
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
                <td colSpan="11" className="maintenance-empty-cell-maintenance">
                  <strong>No maintenance records found</strong>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedMaintenance && (
        <div className="maintenance-modal-overlay-maintenance">
          <div className="maintenance-modal-content-maintenance">
            <div className="maintenance-modal-header-maintenance">
              <h2>Maintenance Record Details</h2>
              <button onClick={handleCloseDetails} className="maintenance-modal-close-maintenance">
                <FaTimes />
              </button>
            </div>
            <div className="maintenance-modal-details-grid-maintenance">
              <div><strong>ID:</strong> {selectedMaintenance.id}</div>
              <div><strong>Incident ID:</strong> {selectedMaintenance.incident_id || 'N/A'}</div>
              <div><strong>Drone Tag:</strong> {selectedMaintenance.drone_tag || 'N/A'}</div>
              <div><strong>Drone Serial:</strong> {selectedMaintenance.drone_serial || 'N/A'}</div>
              <div><strong>Technician:</strong> {selectedMaintenance.technician_name || 'N/A'}</div>
              <div><strong>Created By:</strong> {selectedMaintenance.creator_name || 'N/A'}</div>
              <div><strong>Scheduled Date:</strong> {formatDate(selectedMaintenance.scheduled_date)}</div>
              <div><strong>Completed Date:</strong> {formatDate(selectedMaintenance.completed_date)}</div>
              <div><strong>Status:</strong> {getStatusBadge(selectedMaintenance.status)}</div>
              {selectedMaintenance.status_reason && (
                <div><strong>Status Reason:</strong> {selectedMaintenance.status_reason}</div>
              )}
              <div className="maintenance-description-full-maintenance">
                <strong>Description:</strong>
                <p>{selectedMaintenance.description || 'N/A'}</p>
              </div>
              {selectedMaintenance.suggestions ? (
                <div className="maintenance-description-full-maintenance">
                  <strong>Suggestions:</strong>
                  <p>{selectedMaintenance.suggestions}</p>
                </div>
              ) : null}
              {selectedMaintenance.repair_notes ? (
                <div className="maintenance-description-full-maintenance">
                  <strong>What was repaired:</strong>
                  <p>{selectedMaintenance.repair_notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedMaintenance && (
        <div className="maintenance-modal-overlay-maintenance">
          <div className="maintenance-modal-content-maintenance">
            <div className="maintenance-modal-header-maintenance">
              <h2>Update Maintenance Status</h2>
              <button onClick={handleCloseStatusModal} className="maintenance-modal-close-maintenance">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleStatusSubmit} className="maintenance-status-form-maintenance">
              <div className="maintenance-form-group-maintenance">
                <label>Status *</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm(prev => ({ ...prev, status: e.target.value }))}
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
                  <label>Status Reason *</label>
                  <textarea
                    value={statusForm.status_reason}
                    onChange={(e) => setStatusForm(prev => ({ ...prev, status_reason: e.target.value }))}
                    required
                    className="maintenance-form-textarea-maintenance"
                    rows="4"
                    placeholder="Enter reason for this status"
                  />
                </div>
              )}
              {(statusForm.status === 'c' || statusForm.status === 'pc') && (
                <div className="maintenance-form-group-maintenance">
                  <label>What was repaired *</label>
                  <textarea
                    value={statusForm.repair_notes}
                    onChange={(e) => setStatusForm(prev => ({ ...prev, repair_notes: e.target.value }))}
                    required
                    className="maintenance-form-textarea-maintenance"
                    rows="4"
                    placeholder="Describe what was repaired / work performed"
                  />
                </div>
              )}
              {statusForm.status === 'c' && (
                <div className="maintenance-form-group-maintenance">
                  <label>Completed Date</label>
                  <input
                    type="date"
                    value={statusForm.completed_date}
                    onChange={(e) => setStatusForm(prev => ({ ...prev, completed_date: e.target.value }))}
                    className="maintenance-form-input-maintenance"
                  />
                </div>
              )}
              <div className="maintenance-form-actions-maintenance">
                <button type="button" onClick={handleCloseStatusModal} className="maintenance-button-secondary-maintenance">
                  Cancel
                </button>
                <button type="submit" className="maintenance-button-primary-maintenance">
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Maintenance Modal */}
      {showAddModal && (
        <div className="maintenance-modal-overlay-maintenance">
          <div className="maintenance-modal-content-maintenance">
            <div className="maintenance-modal-header-maintenance">
              <h2>Add Maintenance Record</h2>
              <button onClick={handleCloseAddModal} className="maintenance-modal-close-maintenance">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="maintenance-status-form-maintenance">
              <div className="maintenance-form-group-maintenance">
                <label>Drone Device Serial *</label>
                <input
                  type="text"
                  value={addForm.device_serial}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, device_serial: e.target.value }))}
                  required
                  className="maintenance-form-input-maintenance"
                  placeholder="Enter drone serial number"
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
                <label>Description *</label>
                <textarea
                  value={addForm.description}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, description: e.target.value }))}
                  required
                  className="maintenance-form-textarea-maintenance"
                  rows="4"
                  placeholder="Describe the maintenance work required"
                />
              </div>
              <div className="maintenance-form-group-maintenance">
                <label>Scheduled Date</label>
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
                  {isCreating ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;

