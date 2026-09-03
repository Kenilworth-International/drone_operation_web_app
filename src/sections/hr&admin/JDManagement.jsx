import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  useGetUserJobDescriptionsQuery,
  useCreateUserJobDescriptionMutation,
  useCreateMultipleUserJobDescriptionsMutation,
  useUpdateUserJobDescriptionMutation,
  useUpdateTaskOrdersMutation,
} from '../../api/services NodeJs/jdManagementApi';
import {
  useGetEmpDepartmentsQuery,
  useGetEmpDesignationsQuery,
} from '../../api/services NodeJs/empOrgStructureApi';
import '../../styles/jdManagement.css';

const CHIEF_JR_CODES = new Set(['ceo', 'coo', 'cfo', 'chro']);

function isChiefDesignation(des) {
  if (!des) return false;
  if (Number(des.chief) === 1) return true;
  return CHIEF_JR_CODES.has(String(des.jr_code || '').toLowerCase());
}

const JDManagement = () => {
  const { data: departments = [], isLoading: loadingDepts } = useGetEmpDepartmentsQuery();
  const { data: allDesignations = [], isLoading: loadingDes } = useGetEmpDesignationsQuery({ activated: 1 });
  const { data: jobDescriptionsData, refetch: refetchJobDescriptions } = useGetUserJobDescriptionsQuery();

  const [createJobDescription, { isLoading: creatingDescription }] = useCreateUserJobDescriptionMutation();
  const [createMultipleJobDescriptions, { isLoading: creatingMultipleDescriptions }] = useCreateMultipleUserJobDescriptionsMutation();
  const [updateJobDescription, { isLoading: updatingDescription }] = useUpdateUserJobDescriptionMutation();
  const [updateTaskOrders, { isLoading: updatingTaskOrders }] = useUpdateTaskOrdersMutation();

  const getCurrentUserId = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      return userData?.id || null;
    } catch {
      return null;
    }
  };

  const [selectedDesignation, setSelectedDesignation] = useState(null);
  const [jobDescriptions, setJobDescriptions] = useState([]);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [descriptionFormData, setDescriptionFormData] = useState({
    taskDescription: '',
    status: 1,
    selectedDesignationIds: [],
  });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [designationSearch, setDesignationSearch] = useState('');
  const [showDesignationDropdown, setShowDesignationDropdown] = useState(false);
  const [deptFilter, setDeptFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');

  const allJobDescriptions = jobDescriptionsData?.data || [];
  const prevDescriptionsHashRef = useRef('');
  const prevSelectedDesIdRef = useRef(null);

  const jdDesignations = useMemo(
    () => allDesignations.filter((d) => !isChiefDesignation(d)),
    [allDesignations],
  );

  const designationsByDept = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => map.set(Number(d.id), { dept: d, items: [] }));
    jdDesignations.forEach((des) => {
      const deptId = Number(des.dept_id);
      if (!map.has(deptId)) {
        map.set(deptId, { dept: { id: deptId, department_name: des.department_name || 'Other' }, items: [] });
      }
      map.get(deptId).items.push(des);
    });
    return Array.from(map.values())
      .filter((g) => g.items.length > 0)
      .sort((a, b) => String(a.dept.department_name).localeCompare(String(b.dept.department_name)));
  }, [departments, jdDesignations]);

  const flatDesignations = useMemo(() => {
    let list = jdDesignations.filter((d) => Number(d.activated) === 1);
    if (deptFilter !== 'all') {
      list = list.filter((d) => Number(d.dept_id) === Number(deptFilter));
    }
    const q = listSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((d) =>
        String(d.designation_title || '').toLowerCase().includes(q)
        || String(d.des_code || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => String(a.designation_title).localeCompare(String(b.designation_title)));
  }, [jdDesignations, deptFilter, listSearch]);

  useEffect(() => {
    if (selectedDesignation && isChiefDesignation(selectedDesignation)) {
      setSelectedDesignation(null);
      return;
    }
    if (selectedDesignation && !flatDesignations.some((d) => Number(d.id) === Number(selectedDesignation.id))) {
      setSelectedDesignation(flatDesignations[0] || null);
      return;
    }
    if (!selectedDesignation && flatDesignations.length > 0) {
      setSelectedDesignation(flatDesignations[0]);
    }
  }, [flatDesignations, selectedDesignation]);

  useEffect(() => {
    const currentId = selectedDesignation?.id;
    const descriptionsHash = allJobDescriptions
      ? `${allJobDescriptions.length}-${allJobDescriptions.map((d) => d.id).join(',')}`
      : '';
    const descriptionsChanged = prevDescriptionsHashRef.current !== descriptionsHash;
    const desChanged = prevSelectedDesIdRef.current !== currentId;

    if (descriptionsChanged || desChanged) {
      if (currentId && allJobDescriptions) {
        const descriptions = allJobDescriptions
          .filter((desc) => Number(desc.emp_designation_id) === Number(currentId))
          .sort((a, b) => {
            if (a.status !== b.status) return b.status - a.status;
            return a.taskOrder - b.taskOrder;
          });
        setJobDescriptions(descriptions);
      } else {
        setJobDescriptions([]);
      }
      prevDescriptionsHashRef.current = descriptionsHash;
      prevSelectedDesIdRef.current = currentId;
    }
  }, [selectedDesignation?.id, allJobDescriptions]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDesignationDropdown && !event.target.closest('.jd-multi-select-container-jd-mgmt')) {
        setShowDesignationDropdown(false);
      }
    };
    if (showDesignationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDesignationDropdown]);

  const handleDesignationSelect = (des) => {
    setSelectedDesignation(des);
    setEditingTaskId(null);
  };

  const handleAddDescription = () => {
    setDescriptionFormData({
      taskDescription: '',
      status: 1,
      selectedDesignationIds: selectedDesignation ? [selectedDesignation.id] : [],
    });
    setEditingTaskId(null);
    setShowDescriptionModal(true);
    setError('');
    setDesignationSearch('');
    setShowDesignationDropdown(false);
  };

  const handleEditDescription = (task) => {
    setDescriptionFormData({
      taskDescription: task.taskDescription || '',
      status: task.status || 1,
      selectedDesignationIds: [task.emp_designation_id],
    });
    setEditingTaskId(task.id);
    setShowDescriptionModal(true);
    setError('');
  };

  const handleSaveDescription = async () => {
    if (!descriptionFormData.taskDescription.trim()) {
      setError('Please enter a task description');
      return;
    }
    if (descriptionFormData.selectedDesignationIds.length === 0) {
      setError('Please select at least one designation');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userId = getCurrentUserId();

      if (editingTaskId) {
        await updateJobDescription({
          id: editingTaskId,
          taskDescription: descriptionFormData.taskDescription,
          status: descriptionFormData.status,
          updatedBy: userId,
        }).unwrap();
      } else if (descriptionFormData.selectedDesignationIds.length === 1) {
        await createJobDescription({
          emp_designation_id: descriptionFormData.selectedDesignationIds[0],
          taskDescription: descriptionFormData.taskDescription,
          status: descriptionFormData.status,
          createdBy: userId,
        }).unwrap();
      } else {
        await createMultipleJobDescriptions({
          emp_designation_ids: descriptionFormData.selectedDesignationIds,
          taskDescription: descriptionFormData.taskDescription,
          status: descriptionFormData.status,
          createdBy: userId,
        }).unwrap();
      }

      await refetchJobDescriptions();
      setShowDescriptionModal(false);
      setDescriptionFormData({ taskDescription: '', status: 1, selectedDesignationIds: [] });
      setEditingTaskId(null);
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDescriptionStatus = async (descriptionId, currentStatus) => {
    try {
      const userId = getCurrentUserId();
      const newStatus = currentStatus === 1 ? 0 : 1;
      await updateJobDescription({
        id: descriptionId,
        status: newStatus,
        updatedBy: userId,
      }).unwrap();
      await refetchJobDescriptions();
    } catch (err) {
      setError(err?.data?.message || err?.message || 'Failed to update status');
      await refetchJobDescriptions();
    }
  };

  const handleDragStart = (e, task, index) => {
    setDraggedTask({ task, index });
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => setDragOverIndex(null);

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (!draggedTask || draggedTask.index === dropIndex || !selectedDesignation) {
      setDraggedTask(null);
      return;
    }

    const newTasks = [...jobDescriptions];
    const [removed] = newTasks.splice(draggedTask.index, 1);
    newTasks.splice(dropIndex, 0, removed);

    const taskOrders = newTasks.map((task, index) => ({
      id: task.id,
      taskOrder: index + 1,
    }));

    try {
      setLoading(true);
      await updateTaskOrders({
        emp_designation_id: selectedDesignation.id,
        taskOrders,
      }).unwrap();
      setJobDescriptions(newTasks.map((task, index) => ({ ...task, taskOrder: index + 1 })));
      refetchJobDescriptions();
    } catch {
      setError('Failed to update task order. Please try again.');
    } finally {
      setLoading(false);
      setDraggedTask(null);
    }
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedTask(null);
    setDragOverIndex(null);
  };

  if (loadingDepts || loadingDes) {
    return (
      <div className="jd-management-container-jd-mgmt">
        <div style={{ textAlign: 'center', padding: '50px' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="jd-management-container-jd-mgmt">
      {error && (
        <div className="jd-error-message-jd-mgmt" style={{
          padding: '10px', margin: '10px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px',
        }}>
          {error}
        </div>
      )}

      <div className="jd-top-filter-bar-jd-mgmt">
        <div className="jd-filter-group-jd-mgmt">
          <div className="jd-filter-label-jd-mgmt">Department:</div>
          <select
            className="jd-filter-select-jd-mgmt"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.department_name}</option>
            ))}
          </select>
        </div>
        <div className="jd-filter-group-jd-mgmt">
          <div className="jd-filter-label-jd-mgmt">Search:</div>
          <input
            className="jd-filter-select-jd-mgmt"
            placeholder="Filter designations…"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="jd-management-content-jd-mgmt">
        <div className="jd-left-panel-jd-mgmt">
          <div className="jd-panel-header-jd-mgmt">
            <h2 className="jd-panel-title-jd-mgmt">Emp designations</h2>
            
          </div>

          <div className="jd-designations-list-jd-mgmt">
            {flatDesignations.length === 0 ? (
              <div className="jd-empty-state-jd-mgmt">No designations found. Run org migration and regenerate designations.</div>
            ) : (
              designationsByDept
                .filter((g) => deptFilter === 'all' || Number(g.dept.id) === Number(deptFilter))
                .map((group) => {
                  const items = group.items.filter((d) => flatDesignations.some((f) => f.id === d.id));
                  if (items.length === 0) return null;
                  return (
                    <div key={group.dept.id}>
                      <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: '12px', color: '#004B71', background: '#f0f7fa' }}>
                        {group.dept.department_name}
                      </div>
                      {items.map((des) => (
                        <div
                          key={des.id}
                          className={`jd-designation-item-jd-mgmt ${
                            selectedDesignation?.id === des.id ? 'active-jd-mgmt' : ''
                          } status-active-jd-mgmt`}
                          onClick={() => handleDesignationSelect(des)}
                        >
                          <div className="jd-designation-content-jd-mgmt">
                            <span className="jd-designation-name-jd-mgmt">{des.designation_title}</span>
                            {des.des_code && (
                              <span className="jd-member-type-jd-mgmt">{des.des_code}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
            )}
          </div>
        </div>

        <div className="jd-divider-jd-mgmt" />

        <div className="jd-right-panel-jd-mgmt">
          {selectedDesignation ? (
            <>
              <div className="jd-details-header-jd-mgmt">
                <div>
                  <h2 className="jd-selected-designation-jd-mgmt">{selectedDesignation.designation_title}</h2>
                  <p style={{ margin: '5px 0', color: '#004B71', fontSize: '14px', fontWeight: '600' }}>
                    {selectedDesignation.department_name || ''}
                    {selectedDesignation.job_role ? ` · ${selectedDesignation.job_role}` : ''}
                    {selectedDesignation.power != null ? ` · Power ${selectedDesignation.power}` : ''}
                  </p>
                </div>
              </div>

              <div className="jd-description-section-jd-mgmt">
                <div className="jd-description-header-jd-mgmt">
                  <h3 className="jd-description-title-jd-mgmt">Job Description</h3>
                  <button type="button" className="jd-add-task-button-jd-mgmt" onClick={handleAddDescription}>
                    + Add Task
                  </button>
                </div>

                {jobDescriptions.length === 0 ? (
                  <div className="jd-empty-tasks-jd-mgmt">
                    No tasks defined. Click &quot;+ Add Task&quot; to add job description tasks.
                  </div>
                ) : (
                  <div className="jd-tasks-list-jd-mgmt">
                    {jobDescriptions.map((task, index) => {
                      const sharedDesignations = allJobDescriptions
                        .filter((desc) =>
                          desc.taskDescription === task.taskDescription
                          && desc.id !== task.id
                          && desc.status === 1
                        )
                        .map((desc) => {
                          const des = jdDesignations.find((d) => Number(d.id) === Number(desc.emp_designation_id));
                          return des?.designation_title || null;
                        })
                        .filter(Boolean);

                      const activeTasksCount = jobDescriptions.filter((t) => t.status === 1).length;
                      const taskNumber = task.status === 1
                        ? index + 1
                        : activeTasksCount + (index - activeTasksCount + 1);

                      return (
                        <div
                          key={task.id}
                          draggable={task.status === 1}
                          onDragStart={task.status === 1 ? (e) => handleDragStart(e, task, index) : undefined}
                          onDragOver={task.status === 1 ? (e) => handleDragOver(e, index) : undefined}
                          onDragLeave={task.status === 1 ? handleDragLeave : undefined}
                          onDrop={task.status === 1 ? (e) => handleDrop(e, index) : undefined}
                          onDragEnd={task.status === 1 ? handleDragEnd : undefined}
                          className={`jd-task-item-jd-mgmt ${task.status === 0 ? 'inactive-task-jd-mgmt' : ''} ${
                            dragOverIndex === index ? 'drag-over-jd-mgmt' : ''
                          } ${draggedTask?.index === index ? 'dragging-jd-mgmt' : ''}`}
                          style={{ cursor: task.status === 1 ? 'move' : 'default' }}
                        >
                          <div className="jd-task-content-jd-mgmt">
                            {task.status === 1 && (
                              <span className="jd-drag-handle-jd-mgmt" title="Drag to reorder">☰</span>
                            )}
                            <span className="jd-task-number-jd-mgmt">{taskNumber}.</span>
                            <div style={{ flex: 1 }}>
                              <span className="jd-task-text-jd-mgmt">{task.taskDescription}</span>
                              {sharedDesignations.length > 0 && task.status === 1 && (
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px', fontStyle: 'italic' }}>
                                  Also used in: {sharedDesignations.join(', ')}
                                </div>
                              )}
                            </div>
                            {task.status === 1 && (
                              <span className="jd-task-status-jd-mgmt active-task-badge-jd-mgmt">ACTIVE</span>
                            )}
                          </div>
                          <div className="jd-task-actions-jd-mgmt">
                            {task.status === 1 ? (
                              <>
                                <button type="button" className="jd-edit-task-button-jd-mgmt" onClick={() => handleEditDescription(task)} title="Edit Task">✎</button>
                                <button type="button" className="jd-toggle-task-button-jd-mgmt" onClick={() => handleToggleDescriptionStatus(task.id, task.status)} title="Deactivate">✓</button>
                              </>
                            ) : (
                              <button type="button" className="jd-toggle-task-button-jd-mgmt" onClick={() => handleToggleDescriptionStatus(task.id, task.status)} title="Activate">○</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="jd-no-selection-jd-mgmt">
              <p>Select a designation from the left panel to view job description tasks.</p>
            </div>
          )}
        </div>
      </div>

      {showDescriptionModal && (
        <div className="jd-modal-overlay-jd-mgmt" onClick={() => setShowDescriptionModal(false)}>
          <div className="jd-modal-content-jd-mgmt" onClick={(e) => e.stopPropagation()}>
            <div className="jd-modal-header-jd-mgmt">
              <h2>{editingTaskId ? 'Edit Task' : 'Add New Task'}</h2>
              <button type="button" className="jd-modal-close-jd-mgmt" onClick={() => setShowDescriptionModal(false)}>×</button>
            </div>
            <div className="jd-modal-body-jd-mgmt">
              {error && (
                <div style={{ padding: '10px', marginBottom: '10px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px' }}>
                  {error}
                </div>
              )}
              {!editingTaskId && (
                <div className="jd-form-group-jd-mgmt">
                  <label>Select designation(s): *</label>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    Select one or more emp designations to add the same task to all of them.
                  </p>
                  {descriptionFormData.selectedDesignationIds.length > 0 && (
                    <div className="jd-selected-designations-jd-mgmt">
                      {descriptionFormData.selectedDesignationIds.map((desId) => {
                        const des = jdDesignations.find((d) => d.id === desId);
                        if (!des) return null;
                        return (
                          <span key={desId} className="jd-selected-tag-jd-mgmt">
                            {des.designation_title}
                            <button
                              type="button"
                              className="jd-remove-tag-jd-mgmt"
                              onClick={() => {
                                setDescriptionFormData({
                                  ...descriptionFormData,
                                  selectedDesignationIds: descriptionFormData.selectedDesignationIds.filter((id) => id !== desId),
                                });
                              }}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="jd-multi-select-container-jd-mgmt">
                    <div className="jd-multi-select-input-jd-mgmt" onClick={() => setShowDesignationDropdown(!showDesignationDropdown)}>
                      <input
                        type="text"
                        placeholder="Search designations…"
                        value={designationSearch}
                        onChange={(e) => {
                          setDesignationSearch(e.target.value);
                          setShowDesignationDropdown(true);
                        }}
                        onFocus={() => setShowDesignationDropdown(true)}
                        className="jd-search-input-jd-mgmt"
                      />
                      <span className="jd-dropdown-arrow-jd-mgmt">▼</span>
                    </div>
                    {showDesignationDropdown && (
                      <div className="jd-multi-select-dropdown-jd-mgmt">
                        {jdDesignations
                          .filter((d) => Number(d.activated) === 1)
                          .filter((d) =>
                            String(d.designation_title || '').toLowerCase().includes(designationSearch.toLowerCase())
                            || String(d.des_code || '').toLowerCase().includes(designationSearch.toLowerCase())
                          )
                          .map((des) => {
                            const isSelected = descriptionFormData.selectedDesignationIds.includes(des.id);
                            return (
                              <div
                                key={des.id}
                                className={`jd-multi-select-option-jd-mgmt ${isSelected ? 'selected-jd-mgmt' : ''}`}
                                onClick={() => {
                                  setDescriptionFormData({
                                    ...descriptionFormData,
                                    selectedDesignationIds: isSelected
                                      ? descriptionFormData.selectedDesignationIds.filter((id) => id !== des.id)
                                      : [...descriptionFormData.selectedDesignationIds, des.id],
                                  });
                                }}
                              >
                                <input type="checkbox" checked={isSelected} onChange={() => {}} className="jd-checkbox-jd-mgmt" />
                                <span className="jd-option-text-jd-mgmt">
                                  <strong>{des.designation_title}</strong>
                                  {des.des_code && <span className="jd-option-code-jd-mgmt">({des.des_code})</span>}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="jd-form-group-jd-mgmt">
                <label>Task description: *</label>
                <textarea
                  value={descriptionFormData.taskDescription}
                  onChange={(e) => setDescriptionFormData({ ...descriptionFormData, taskDescription: e.target.value })}
                  placeholder="Enter task description"
                  rows="4"
                  autoFocus={!!editingTaskId}
                />
              </div>
              <div className="jd-form-group-jd-mgmt">
                <label className="jd-checkbox-label-jd-mgmt">
                  <input
                    type="checkbox"
                    checked={descriptionFormData.status === 1}
                    onChange={(e) => setDescriptionFormData({ ...descriptionFormData, status: e.target.checked ? 1 : 0 })}
                  />
                  <span>Active</span>
                </label>
              </div>
            </div>
            <div className="jd-modal-footer-jd-mgmt">
              <button type="button" className="jd-btn-cancel-jd-mgmt" onClick={() => setShowDescriptionModal(false)}>Cancel</button>
              <button
                type="button"
                className="jd-btn-save-jd-mgmt"
                onClick={handleSaveDescription}
                disabled={loading || creatingDescription || updatingDescription || creatingMultipleDescriptions || updatingTaskOrders}
              >
                {loading || creatingDescription || updatingDescription || creatingMultipleDescriptions ? 'Saving…' : (editingTaskId ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JDManagement;
