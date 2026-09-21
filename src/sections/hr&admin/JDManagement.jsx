import React, { useState, useEffect, useMemo } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  useCreateUserJobDescriptionMutation,
  useUpdateUserJobDescriptionMutation,
  useUpdateTaskOrdersMutation,
  useGetStructuredJobDescriptionQuery,
  useSaveJobSummaryMutation,
  useSaveResponsibilityCategoryMutation,
  useDeleteResponsibilityCategoryMutation,
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

function sortDesignationsForList(items) {
  return [...items].sort((a, b) => {
    const powerDiff = Number(b.power ?? 0) - Number(a.power ?? 0);
    if (powerDiff !== 0) return powerDiff;
    return String(a.designation_title || '').localeCompare(String(b.designation_title || ''));
  });
}

/** Drop repeated dept prefix from titles shown under a department group. */
function shortDesignationTitle(title, deptName) {
  const raw = String(title || '').trim();
  const dept = String(deptName || '').trim();
  if (!raw) return '';
  if (dept) {
    const prefix = `${dept} - `;
    if (raw.toLowerCase().startsWith(prefix.toLowerCase())) {
      return raw.slice(prefix.length).trim() || raw;
    }
  }
  const dash = raw.indexOf(' - ');
  if (dash > 0) return raw.slice(dash + 3).trim() || raw;
  return raw;
}

function getJdErrorMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;
  const data = err.data;
  if (typeof data === 'string' && data.trim()) {
    const trimmed = data.trim();
    if (trimmed.startsWith('<')) return fallback;
    return trimmed.slice(0, 240);
  }
  const fromData = data?.message || data?.error;
  if (fromData) return String(fromData).slice(0, 240);
  if (err.error && typeof err.error === 'string') return err.error.slice(0, 240);
  if (err.message && !/^rejected$/i.test(err.message)) return String(err.message).slice(0, 240);
  if (err.status === 'FETCH_ERROR') return 'Cannot reach the API. Check your connection or backend.';
  if (err.status === 404) return 'API endpoint not found. Deploy or point the app to dsms_backend_dev.';
  if (err.status === 401) return 'Session expired. Please sign in again.';
  if (err.status === 403) return 'You do not have permission for this action.';
  if (err.status === 504) return 'API timed out. Try again in a moment.';
  return fallback;
}

const JDManagement = () => {
  const { data: departments = [], isLoading: loadingDepts } = useGetEmpDepartmentsQuery();
  const { data: allDesignations = [], isLoading: loadingDes } = useGetEmpDesignationsQuery({ activated: 1 });

  const [createJobDescription, { isLoading: creatingDescription }] = useCreateUserJobDescriptionMutation();
  const [updateJobDescription, { isLoading: updatingDescription }] = useUpdateUserJobDescriptionMutation();
  const [updateTaskOrders] = useUpdateTaskOrdersMutation();
  const [saveJobSummary, { isLoading: savingSummary }] = useSaveJobSummaryMutation();
  const [saveCategory, { isLoading: savingCategory }] = useSaveResponsibilityCategoryMutation();
  const [deleteCategory] = useDeleteResponsibilityCategoryMutation();

  const getCurrentUserId = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      return userData?.id || null;
    } catch {
      return null;
    }
  };

  const [selectedDesignationId, setSelectedDesignationId] = useState(null);
  const [deptFilter, setDeptFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [editMode, setEditMode] = useState(false);

  const [summaryDraft, setSummaryDraft] = useState('');
  const [showSummaryEditor, setShowSummaryEditor] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ id: null, category_name: '' });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskDraft, setTaskDraft] = useState({
    id: null,
    category_id: null,
    taskDescription: '',
    status: 1,
  });

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
      .sort((a, b) => String(a.dept.department_name).localeCompare(String(b.dept.department_name)))
      .map((g) => ({ ...g, items: sortDesignationsForList(g.items) }));
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
    return list;
  }, [jdDesignations, deptFilter, listSearch]);

  /** Same order as the left list (dept groups → power). Used for reliable first-item select. */
  const orderedVisibleDesignations = useMemo(() => {
    const idSet = new Set(flatDesignations.map((d) => Number(d.id)));
    const ordered = [];
    designationsByDept
      .filter((g) => deptFilter === 'all' || Number(g.dept.id) === Number(deptFilter))
      .forEach((group) => {
        group.items.forEach((des) => {
          if (idSet.has(Number(des.id))) ordered.push(des);
        });
      });
    return ordered;
  }, [designationsByDept, flatDesignations, deptFilter]);

  const selectedDesignation = useMemo(() => {
    if (!orderedVisibleDesignations.length) return null;
    if (selectedDesignationId != null) {
      const found = orderedVisibleDesignations.find(
        (d) => Number(d.id) === Number(selectedDesignationId),
      );
      if (found) return found;
    }
    return orderedVisibleDesignations[0];
  }, [orderedVisibleDesignations, selectedDesignationId]);

  const designationId = selectedDesignation?.id ? Number(selectedDesignation.id) : null;

  const {
    data: structuredJd,
    isLoading: loadingStructured,
    isFetching: fetchingStructured,
    isError: structuredLoadFailed,
    error: structuredLoadError,
    refetch: refetchStructured,
  } = useGetStructuredJobDescriptionQuery(
    { emp_designation_id: designationId },
    { skip: !designationId },
  );

  useEffect(() => {
    setSummaryDraft(structuredJd?.jobSummary || '');
    setShowSummaryEditor(false);
    setEditMode(false);
  }, [designationId, structuredJd?.jobSummary]);

  // Keep selection id in sync when filter changes so the resolved first item stays stable.
  useEffect(() => {
    if (!orderedVisibleDesignations.length) {
      if (selectedDesignationId != null) setSelectedDesignationId(null);
      return;
    }
    const stillVisible = orderedVisibleDesignations.some(
      (d) => Number(d.id) === Number(selectedDesignationId),
    );
    if (!stillVisible) {
      setSelectedDesignationId(Number(orderedVisibleDesignations[0].id));
    }
  }, [orderedVisibleDesignations, selectedDesignationId]);

  const activeCategories = useMemo(
    () => (structuredJd?.categories || []).filter((c) => Number(c.status) === 1),
    [structuredJd],
  );
  const inactiveCategories = useMemo(
    () => (structuredJd?.categories || []).filter((c) => Number(c.status) !== 1),
    [structuredJd],
  );
  const uncategorizedTasks = structuredJd?.uncategorizedTasks || [];

  const visibleCategories = editMode
    ? [...activeCategories, ...inactiveCategories]
    : activeCategories;

  const handleSaveSummary = async () => {
    if (!designationId) return;
    setFormError('');
    try {
      await saveJobSummary({
        emp_designation_id: designationId,
        job_summary: summaryDraft,
        updatedBy: getCurrentUserId(),
      }).unwrap();
      setShowSummaryEditor(false);
      toast.success('Job summary saved');
      await refetchStructured();
    } catch (err) {
      toast.error(getJdErrorMessage(err, 'Failed to save job summary'));
    }
  };

  const openAddCategory = () => {
    setCategoryDraft({ id: null, category_name: '' });
    setShowCategoryModal(true);
    setFormError('');
  };

  const openEditCategory = (cat) => {
    setCategoryDraft({ id: cat.id, category_name: cat.categoryName || '' });
    setShowCategoryModal(true);
    setFormError('');
  };

  const handleSaveCategory = async () => {
    if (!designationId) return;
    if (!String(categoryDraft.category_name || '').trim()) {
      setFormError('Category name is required');
      return;
    }
    setFormError('');
    try {
      await saveCategory({
        id: categoryDraft.id || undefined,
        emp_designation_id: designationId,
        category_name: String(categoryDraft.category_name).trim(),
        updatedBy: getCurrentUserId(),
        createdBy: getCurrentUserId(),
      }).unwrap();
      setShowCategoryModal(false);
      toast.success(categoryDraft.id ? 'Category updated' : 'Category added');
      await refetchStructured();
    } catch (err) {
      const message = getJdErrorMessage(err, 'Failed to save category');
      setFormError(message);
      toast.error(message);
    }
  };

  const handleDeactivateCategory = async (cat) => {
    if (!window.confirm(`Deactivate category "${cat.categoryName}"? It can be activated again later.`)) return;
    setFormError('');
    try {
      await deleteCategory({ id: cat.id }).unwrap();
      toast.success('Category deactivated');
      await refetchStructured();
    } catch (err) {
      toast.error(getJdErrorMessage(err, 'Failed to deactivate category'));
    }
  };

  const handleActivateCategory = async (cat) => {
    setFormError('');
    try {
      await saveCategory({
        id: cat.id,
        emp_designation_id: designationId,
        category_name: cat.categoryName,
        status: 1,
        updatedBy: getCurrentUserId(),
      }).unwrap();
      toast.success('Category activated');
      await refetchStructured();
    } catch (err) {
      toast.error(getJdErrorMessage(err, 'Failed to activate category'));
    }
  };

  const openAddTask = (categoryId = null) => {
    setTaskDraft({
      id: null,
      category_id: categoryId,
      taskDescription: '',
      status: 1,
    });
    setShowTaskModal(true);
    setFormError('');
  };

  const openEditTask = (task) => {
    setTaskDraft({
      id: task.id,
      category_id: task.category_id || null,
      taskDescription: task.taskDescription || '',
      status: task.status ?? 1,
    });
    setShowTaskModal(true);
    setFormError('');
  };

  const handleSaveTask = async () => {
    if (!designationId) return;
    if (!String(taskDraft.taskDescription || '').trim()) {
      setFormError('Task description is required');
      return;
    }
    setFormError('');
    try {
      if (taskDraft.id) {
        await updateJobDescription({
          id: taskDraft.id,
          taskDescription: taskDraft.taskDescription.trim(),
          category_id: taskDraft.category_id,
          status: taskDraft.status,
          updatedBy: getCurrentUserId(),
        }).unwrap();
      } else {
        await createJobDescription({
          emp_designation_id: designationId,
          category_id: taskDraft.category_id,
          taskDescription: taskDraft.taskDescription.trim(),
          status: taskDraft.status,
          createdBy: getCurrentUserId(),
        }).unwrap();
      }
      setShowTaskModal(false);
      toast.success(taskDraft.id ? 'Task updated' : 'Task added');
      await refetchStructured();
    } catch (err) {
      const message = getJdErrorMessage(err, 'Failed to save task');
      setFormError(message);
      toast.error(message);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      await updateJobDescription({
        id: task.id,
        status: Number(task.status) === 1 ? 0 : 1,
        updatedBy: getCurrentUserId(),
      }).unwrap();
      await refetchStructured();
    } catch (err) {
      toast.error(getJdErrorMessage(err, 'Failed to update task status'));
    }
  };

  const handleReorderTasksInCategory = async (categoryId, tasks, fromIndex, toIndex) => {
    if (fromIndex === toIndex || !designationId) return;
    const next = [...tasks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const taskOrders = next.map((t, i) => ({ id: t.id, taskOrder: i + 1 }));
    try {
      await updateTaskOrders({
        emp_designation_id: designationId,
        taskOrders,
      }).unwrap();
      await refetchStructured();
    } catch (err) {
      toast.error(getJdErrorMessage(err, 'Failed to reorder tasks'));
    }
  };

  const renderTaskList = (tasks, categoryId) => {
    const active = (tasks || []).filter((t) => Number(t.status) === 1);
    const inactive = (tasks || []).filter((t) => Number(t.status) !== 1);
    const ordered = [...active, ...inactive];
    if (!ordered.length) {
      return (
        <div className="jd-empty-tasks-jd-mgmt">
          No tasks in this category.
          {editMode ? (
            <button type="button" className="jd-link-btn-jd-mgmt" onClick={() => openAddTask(categoryId)}>
              Add task
            </button>
          ) : null}
        </div>
      );
    }
    return (
      <ul className="jd-structured-task-list-jd-mgmt">
        {ordered.map((task, index) => (
          <li
            key={task.id}
            className={`jd-structured-task-jd-mgmt${Number(task.status) !== 1 ? ' is-inactive' : ''}`}
            draggable={editMode && Number(task.status) === 1}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', String(index));
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData('text/plain'));
              if (Number.isFinite(from)) {
                handleReorderTasksInCategory(categoryId, active, from, index);
              }
            }}
          >
            <span className="jd-structured-task-bullet-jd-mgmt">•</span>
            <span className="jd-structured-task-text-jd-mgmt">{task.taskDescription}</span>
            {editMode ? (
              <span className="jd-structured-task-actions-jd-mgmt">
                <button type="button" title="Edit" onClick={() => openEditTask(task)}>✎</button>
                <button
                  type="button"
                  title={Number(task.status) === 1 ? 'Deactivate' : 'Activate'}
                  onClick={() => handleToggleTask(task)}
                >
                  {Number(task.status) === 1 ? '✓' : '○'}
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  };

  if (loadingDepts || loadingDes) {
    return (
      <div className="jd-management-container-jd-mgmt">
        <div style={{ textAlign: 'center', padding: '50px' }}>Loading…</div>
      </div>
    );
  }

  const busy = creatingDescription || updatingDescription || savingSummary || savingCategory;

  return (
    <div className="jd-management-container-jd-mgmt">
      <ToastContainer position="top-right" autoClose={3500} newestOnTop closeOnClick pauseOnHover theme="light" />

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
            <h2 className="jd-panel-title-jd-mgmt">Designations</h2>
          </div>
          <div className="jd-designations-list-jd-mgmt">
            {orderedVisibleDesignations.length === 0 ? (
              <div className="jd-empty-state-jd-mgmt">No designations found.</div>
            ) : (
              designationsByDept
                .filter((g) => deptFilter === 'all' || Number(g.dept.id) === Number(deptFilter))
                .map((group) => {
                  const items = group.items.filter((d) =>
                    orderedVisibleDesignations.some((f) => Number(f.id) === Number(d.id)),
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={group.dept.id} className="jd-dept-group-jd-mgmt">
                      <div className="jd-dept-group-label-jd-mgmt">
                        {group.dept.department_name}
                      </div>
                      {items.map((des) => {
                        const isActive = Number(selectedDesignation?.id) === Number(des.id);
                        return (
                          <div
                            key={des.id}
                            className={`jd-designation-item-jd-mgmt${isActive ? ' active-jd-mgmt' : ''}`}
                            onClick={() => setSelectedDesignationId(Number(des.id))}
                          >
                            <div className="jd-designation-content-jd-mgmt">
                              <span className="jd-designation-name-jd-mgmt">
                                {shortDesignationTitle(des.designation_title, group.dept.department_name)}
                              </span>
                              {des.des_code ? (
                                <span className="jd-member-type-jd-mgmt">{des.des_code}</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
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
                  <p className="jd-selected-meta-jd-mgmt">
                    {selectedDesignation.department_name || ''}
                    {selectedDesignation.job_role ? ` · ${selectedDesignation.job_role}` : ''}
                    {selectedDesignation.power != null ? ` · Power ${selectedDesignation.power}` : ''}
                  </p>
                </div>
                <div className="jd-header-actions-jd-mgmt">
                  <button
                    type="button"
                    className={`jd-mode-btn-jd-mgmt${editMode ? ' is-active' : ''}`}
                    onClick={() => {
                      if (editMode) {
                        setShowSummaryEditor(false);
                        setSummaryDraft(structuredJd?.jobSummary || '');
                        setShowCategoryModal(false);
                        setShowTaskModal(false);
                        setFormError('');
                        setEditMode(false);
                        return;
                      }
                      setEditMode(true);
                    }}
                  >
                    {editMode ? 'Done editing' : 'Update'}
                  </button>
                </div>
              </div>

              {loadingStructured && !structuredJd ? (
                <div className="jd-empty-tasks-jd-mgmt">Loading job description…</div>
              ) : structuredLoadFailed && !structuredJd ? (
                <div className="jd-inline-alert-jd-mgmt" role="alert">
                  <span>{getJdErrorMessage(structuredLoadError, 'Failed to load job description')}</span>
                  <button type="button" onClick={() => refetchStructured()}>Retry</button>
                </div>
              ) : (
                <div className={`jd-structured-body-jd-mgmt${fetchingStructured ? ' is-refreshing' : ''}`}>
                  <section className="jd-structured-section-jd-mgmt">
                    <div className="jd-structured-section-head-jd-mgmt">
                      <h3>Job Summary</h3>
                      {editMode && !showSummaryEditor ? (
                        <button
                          type="button"
                          className="jd-add-task-button-jd-mgmt"
                          onClick={() => {
                            setSummaryDraft(structuredJd?.jobSummary || '');
                            setShowSummaryEditor(true);
                          }}
                        >
                          {structuredJd?.jobSummary ? 'Edit summary' : 'Add summary'}
                        </button>
                      ) : null}
                    </div>
                    {editMode && showSummaryEditor ? (
                      <div className="jd-summary-editor-jd-mgmt">
                        <textarea
                          rows={5}
                          value={summaryDraft}
                          onChange={(e) => setSummaryDraft(e.target.value)}
                          placeholder="Enter the job summary for this designation…"
                        />
                        <div className="jd-inline-actions-jd-mgmt">
                          <button
                            type="button"
                            className="jd-btn-cancel-jd-mgmt"
                            onClick={() => {
                              setSummaryDraft(structuredJd?.jobSummary || '');
                              setShowSummaryEditor(false);
                            }}
                          >
                            Cancel
                          </button>
                          <button type="button" className="jd-btn-save-jd-mgmt" onClick={handleSaveSummary} disabled={busy}>
                            {savingSummary ? 'Saving…' : 'Save summary'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="jd-summary-text-jd-mgmt">
                        {structuredJd?.jobSummary
                          ? structuredJd.jobSummary
                          : 'No job summary yet.'}
                      </p>
                    )}
                  </section>

                  <section className="jd-structured-section-jd-mgmt">
                    <div className="jd-structured-section-head-jd-mgmt">
                      <h3>Key Responsibilities</h3>
                      {editMode ? (
                        <button type="button" className="jd-add-task-button-jd-mgmt" onClick={openAddCategory}>
                          + Add category
                        </button>
                      ) : null}
                    </div>

                    {activeCategories.length === 0 && uncategorizedTasks.length === 0 && !(editMode && inactiveCategories.length) ? (
                      <div className="jd-empty-tasks-jd-mgmt">
                        No responsibilities yet.
                        {editMode ? ' Add a category, then add tasks under it.' : ''}
                      </div>
                    ) : null}

                    {visibleCategories.map((cat) => {
                      const isActive = Number(cat.status) === 1;
                      const letterIndex = isActive
                        ? activeCategories.findIndex((c) => c.id === cat.id)
                        : -1;
                      return (
                      <div
                        key={cat.id}
                        className={`jd-category-block-jd-mgmt${isActive ? '' : ' is-inactive-jd-mgmt'}`}
                      >
                        <div className="jd-category-head-jd-mgmt">
                          <h4>
                            {isActive
                              ? `${String.fromCharCode(65 + (Math.max(letterIndex, 0) % 26))}. ${cat.categoryName}`
                              : `${cat.categoryName} (inactive)`}
                          </h4>
                          {editMode ? (
                            <div className="jd-category-actions-jd-mgmt">
                              {isActive ? (
                                <>
                                  <button type="button" onClick={() => openAddTask(cat.id)}>+ Task</button>
                                  <button type="button" onClick={() => openEditCategory(cat)}>Rename</button>
                                  <button type="button" onClick={() => handleDeactivateCategory(cat)}>Deactivate</button>
                                </>
                              ) : (
                                <button type="button" onClick={() => handleActivateCategory(cat)}>Activate</button>
                              )}
                            </div>
                          ) : null}
                        </div>
                        {isActive ? renderTaskList(cat.tasks || [], cat.id) : (
                          <p className="jd-panel-hint-jd-mgmt">
                            Inactive — tasks are kept. Activate to edit again.
                          </p>
                        )}
                      </div>
                      );
                    })}

                    {uncategorizedTasks.length > 0 ? (
                      <div className="jd-category-block-jd-mgmt jd-category-block--legacy-jd-mgmt">
                        <div className="jd-category-head-jd-mgmt">
                          <h4>Uncategorized tasks</h4>
                          {editMode ? (
                            <div className="jd-category-actions-jd-mgmt">
                              <button type="button" onClick={() => openAddTask(null)}>+ Task</button>
                            </div>
                          ) : null}
                        </div>
                        <p className="jd-panel-hint-jd-mgmt">
                          Legacy tasks without a category. Edit a task and assign a category, or create categories above.
                        </p>
                        {renderTaskList(uncategorizedTasks, null)}
                      </div>
                    ) : null}
                  </section>
                </div>
              )}
            </>
          ) : (
            <div className="jd-no-selection-jd-mgmt">
              <p>Select a designation from the left panel to view the job description.</p>
            </div>
          )}
        </div>
      </div>

      {showCategoryModal ? (
        <div className="jd-modal-overlay-jd-mgmt" onClick={() => setShowCategoryModal(false)} role="presentation">
          <div className="jd-modal-content-jd-mgmt jd-structured-modal-jd-mgmt" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="jd-modal-header-jd-mgmt">
              <h2>{categoryDraft.id ? 'Rename category' : 'Add category'}</h2>
              <button type="button" className="jd-modal-close-jd-mgmt" onClick={() => setShowCategoryModal(false)}>×</button>
            </div>
            <div className="jd-modal-body-jd-mgmt">
              {formError ? <div className="jd-form-error-jd-mgmt">{formError}</div> : null}
              <div className="jd-form-group-jd-mgmt">
                <label>Category name *</label>
                <input
                  type="text"
                  value={categoryDraft.category_name}
                  onChange={(e) => setCategoryDraft({ ...categoryDraft, category_name: e.target.value })}
                  placeholder="e.g. Human Resources Management"
                  autoFocus
                />
              </div>
            </div>
            <div className="jd-modal-footer-jd-mgmt">
              <button type="button" className="jd-btn-cancel-jd-mgmt" onClick={() => setShowCategoryModal(false)}>Cancel</button>
              <button type="button" className="jd-btn-save-jd-mgmt" onClick={handleSaveCategory} disabled={busy}>
                {savingCategory ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showTaskModal ? (
        <div className="jd-modal-overlay-jd-mgmt" onClick={() => setShowTaskModal(false)} role="presentation">
          <div className="jd-modal-content-jd-mgmt jd-structured-modal-jd-mgmt" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="jd-modal-header-jd-mgmt">
              <h2>{taskDraft.id ? 'Edit task' : 'Add task'}</h2>
              <button type="button" className="jd-modal-close-jd-mgmt" onClick={() => setShowTaskModal(false)}>×</button>
            </div>
            <div className="jd-modal-body-jd-mgmt">
              {formError ? <div className="jd-form-error-jd-mgmt">{formError}</div> : null}
              <div className="jd-form-group-jd-mgmt">
                <label>Category</label>
                <select
                  value={taskDraft.category_id || ''}
                  onChange={(e) => setTaskDraft({
                    ...taskDraft,
                    category_id: e.target.value ? Number(e.target.value) : null,
                  })}
                >
                  <option value="">Uncategorized</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.categoryName}</option>
                  ))}
                </select>
              </div>
              <div className="jd-form-group-jd-mgmt">
                <label>Task *</label>
                <textarea
                  rows={4}
                  value={taskDraft.taskDescription}
                  onChange={(e) => setTaskDraft({ ...taskDraft, taskDescription: e.target.value })}
                  placeholder="Enter responsibility / task"
                  autoFocus
                />
              </div>
              <div className="jd-form-group-jd-mgmt">
                <label className="jd-checkbox-label-jd-mgmt">
                  <input
                    type="checkbox"
                    checked={Number(taskDraft.status) === 1}
                    onChange={(e) => setTaskDraft({ ...taskDraft, status: e.target.checked ? 1 : 0 })}
                  />
                  <span>Active</span>
                </label>
              </div>
            </div>
            <div className="jd-modal-footer-jd-mgmt">
              <button type="button" className="jd-btn-cancel-jd-mgmt" onClick={() => setShowTaskModal(false)}>Cancel</button>
              <button type="button" className="jd-btn-save-jd-mgmt" onClick={handleSaveTask} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default JDManagement;
