import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useGetIctMetricsSummaryQuery,
  useGetIctProjectsQuery,
  useGetIctSprintsQuery,
  useGetIctWorkItemsQuery,
} from '../../../api/services NodeJs/ictDevelopmentApi';
import { getUserData } from '../../../utils/authUtils';
import '../../../styles/ictDevCenter.css';

function toTitleCase(value) {
  if (!value) return '-';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentUserId(userData) {
  return Number(
    userData?.id
      || userData?.user_id
      || userData?.userId
      || userData?.employee_id
      || 0
  );
}

function isTaskAssignedToMe(item, myUserId) {
  if (!myUserId || !item) return false;
  if (Number(item.assignee_user_id) === Number(myUserId)) return true;
  return (item.assignees || []).some((assignee) => Number(assignee.user_id) === Number(myUserId));
}

function DevCenterDashboard() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const go = (pathname) => navigate({ pathname, search: routerLocation.search });
  const currentUser = getUserData();
  const myUserId = getCurrentUserId(currentUser);

  const [projectId, setProjectId] = useState('');
  const [sprintId, setSprintId] = useState('');

  const { data: projects = [] } = useGetIctProjectsQuery();
  const { data: sprints = [] } = useGetIctSprintsQuery(projectId ? { project_id: Number(projectId) } : {});

  const summaryFilter = useMemo(() => {
    const query = {};
    if (projectId) query.project_id = Number(projectId);
    if (sprintId) query.sprint_id = Number(sprintId);
    return query;
  }, [projectId, sprintId]);

  const { data: summary = {}, isLoading: loadingSummary } = useGetIctMetricsSummaryQuery(summaryFilter);

  const { data: allWorkItems = [], isLoading: loadingItems } = useGetIctWorkItemsQuery(summaryFilter);

  const mySprintTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allWorkItems
      .filter((item) => item.work_mode === 'sprint')
      .filter((item) => item.workflow_status !== 'done' && item.workflow_status !== 'cancelled')
      .filter((item) => isTaskAssignedToMe(item, myUserId))
      .map((item) => {
        const due = item.due_date ? new Date(item.due_date) : null;
        if (due) due.setHours(0, 0, 0, 0);

        const isOverdue = due ? due < today : false;
        const isDueToday = due ? due.getTime() === today.getTime() : false;
        const isUrgentPriority = item.priority === 'critical' || item.priority === 'high';
        const needsAsap = isOverdue || isDueToday || isUrgentPriority;

        return {
          ...item,
          isOverdue,
          isDueToday,
          needsAsap,
        };
      })
      .sort((a, b) => Number(b.needsAsap) - Number(a.needsAsap) || Number(b.isOverdue) - Number(a.isOverdue))
      .slice(0, 8);
  }, [allWorkItems, myUserId]);

  const totals = summary.totals || {};
  const devCenterBgUrl = `${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg`;

  return (
    <div
      className="ictdc-page ictdc-stack"
      style={{ '--ictdc-bg-url': `url("${devCenterBgUrl}")` }}
    >
      <div className="ictdc-hero">
        <div>
          <h2 className="ictdc-title">ICT Dev Center</h2>
          <p className="ictdc-subtitle">
            Professional control center for sprint, board, extra work, and delivery performance.
          </p>
        </div>
        <div className="ictdc-actions">
          <button className="ictdc-btn-secondary" type="button" onClick={() => go('/home/ict/development/board')}>
            Go to Board
          </button>
        </div>
      </div>

      <div className="ictdc-card">
        <div className="ictdc-grid-2">
          <div>
            <label className="ictdc-label" htmlFor="wf_project_filter">Project</label>
            <select
              id="wf_project_filter"
              className="ictdc-select"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSprintId('');
              }}
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  {project.project_code} - {project.project_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ictdc-label" htmlFor="wf_sprint_filter">Sprint</label>
            <select
              id="wf_sprint_filter"
              className="ictdc-select"
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
            >
              <option value="">All sprints</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={String(sprint.id)}>
                  {sprint.sprint_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="ictdc-kpi-grid">
        <div className="ictdc-card">
          <div className="ictdc-kpi-title">Total Items</div>
          <div className="ictdc-kpi-value">{loadingSummary ? '...' : (totals.total_items || 0)}</div>
        </div>
        <div className="ictdc-card">
          <div className="ictdc-kpi-title">Completed</div>
          <div className="ictdc-kpi-value">{loadingSummary ? '...' : (totals.completed_items || 0)}</div>
        </div>
        <div className="ictdc-card">
          <div className="ictdc-kpi-title">Pending</div>
          <div className="ictdc-kpi-value">{loadingSummary ? '...' : (totals.pending_items || 0)}</div>
        </div>
        <div className="ictdc-card">
          <div className="ictdc-kpi-title">Sprint Work</div>
          <div className="ictdc-kpi-value">{loadingSummary ? '...' : (totals.sprint_items || 0)}</div>
        </div>
        <div className="ictdc-card">
          <div className="ictdc-kpi-title">Extra Work</div>
          <div className="ictdc-kpi-value">{loadingSummary ? '...' : (totals.extra_items || 0)}</div>
        </div>
      </div>

      <div className="ictdc-grid-2">
        <div className="ictdc-card">
          <h3 className="ictdc-section-title">Process Modules</h3>
          <div className="ictdc-workflow-actions">
            <button className="ictdc-btn" type="button" onClick={() => go('/home/ict/development/sprints')}>
              Sprint Planning
            </button>
            <button className="ictdc-btn" type="button" onClick={() => go('/home/ict/development/board')}>
              Development Board
            </button>
            <button className="ictdc-btn" type="button" onClick={() => go('/home/ict/development/extra-work')}>
              Extra Work Queue
            </button>
            <button className="ictdc-btn" type="button" onClick={() => go('/home/ict/development/metrics')}>
              Metrics Dashboard
            </button>
            <button className="ictdc-btn" type="button" onClick={() => go('/home/ict/system-admin/app-versions')}>
              App Versions
            </button>
            <button className="ictdc-btn" type="button" onClick={() => go('/home/ict/system-admin/app-features')}>
              App Features
            </button>
          </div>
        </div>

        <div className="ictdc-card">
          <h3 className="ictdc-section-title">Execution Flow</h3>
          <div className="ictdc-meta">1. Plan sprint and set task estimated end dates.</div>
          <div className="ictdc-meta">2. Developers work in Development and move to Testing.</div>
          <div className="ictdc-meta">3. QA verifies, reports bugs, and closes or reopens.</div>
          <div className="ictdc-meta">4. Handle urgent ad-hoc work via Extra Work Queue.</div>
        </div>
      </div>

      <div className="ictdc-card">
        <h3 className="ictdc-section-title">My Sprint Tasks - Attend ASAP</h3>
        {loadingItems && <p className="ictdc-loading-state">Loading your tasks...</p>}
        {!loadingItems && mySprintTasks.length === 0 && (
          <p className="ictdc-empty-state">No active sprint tasks assigned to you for this filter.</p>
        )}
        {mySprintTasks.length > 0 && (
          <div className="ictdc-table-wrap">
            <table className="ictdc-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Title</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Estimated End Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {mySprintTasks.map((item) => (
                  <tr key={item.id}>
                    <td>{item.work_key}</td>
                    <td>
                      <div>{item.title}</div>
                      {item.needsAsap && <span className="ictdc-chip ictdc-chip-asap">ASAP</span>}
                    </td>
                    <td>{toTitleCase(item.workflow_stage)}</td>
                    <td>{toTitleCase(item.workflow_status)}</td>
                    <td>{toTitleCase(item.priority)}</td>
                    <td>{formatDate(item.due_date)}</td>
                    <td>
                      <button
                        className="ictdc-btn-secondary ictdc-btn-compact"
                        type="button"
                        onClick={() => go('/home/ict/development/board')}
                      >
                        Open Board
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DevCenterDashboard;
