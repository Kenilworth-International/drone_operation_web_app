import React from 'react';
import {
  FaEye,
  FaBan,
  FaWrench,
  FaSearch,
  FaClipboardList,
  FaCheckCircle,
  FaFileAlt,
} from 'react-icons/fa';
import { formatDate, formatTime, getEquipmentLabel, getAvailableActions } from '../utils/formatters';
import StatusBadge from './StatusBadge';
import MediaIndicators from './MediaIndicators';

export default function ReportsTable({
  reports,
  isLoading,
  error,
  totalCount,
  onView,
  onAction,
}) {
  return (
    <div className="accidentreports-table-wrapper">
      <table className="accidentreports-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Date</th>
            <th>Time</th>
            <th>Pilot</th>
            <th>Estate</th>
            <th>Incident type</th>
            <th>Equipment</th>
            <th>Serial</th>
            <th>Attachments</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan="11" className="accidentreports-loading-cell">
                Loading incident reports…
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan="11" className="accidentreports-error-cell">
                Unable to load reports. Refresh the page and try again.
              </td>
            </tr>
          ) : reports.length > 0 ? (
            reports.map((report) => {
              const actions = getAvailableActions(report);
              return (
                <tr key={report.id}>
                  <td>#{report.id}</td>
                  <td>{formatDate(report.date)}</td>
                  <td>{formatTime(report.time)}</td>
                  <td>{report.pilot_name || 'N/A'}</td>
                  <td>{report.estate_name || 'N/A'}</td>
                  <td>{report.incident_type_name || 'N/A'}</td>
                  <td className="accidentreports-cell-wrap">{getEquipmentLabel(report)}</td>
                  <td>{report.device_serial || 'N/A'}</td>
                  <td>
                    <MediaIndicators report={report} />
                  </td>
                  <td>
                    <StatusBadge report={report} />
                  </td>
                  <td>
                    <div className="accidentreports-row-actions">
                      <button
                        type="button"
                        onClick={() => onView(report)}
                        className="accidentreports-view-button"
                        title="View details"
                      >
                        <FaEye />
                      </button>
                      {actions.includes('decline') ? (
                        <button
                          type="button"
                          className="accidentreports-action-button accidentreports-action-button--decline"
                          onClick={() => onAction(report, 'decline')}
                          title="Decline"
                        >
                          <FaBan />
                        </button>
                      ) : null}
                      {actions.includes('recommend_investigation') ? (
                        <button
                          type="button"
                          className="accidentreports-action-button accidentreports-action-button--investigate"
                          onClick={() => onAction(report, 'recommend_investigation')}
                          title="Recommend investigation to HR"
                        >
                          <FaSearch />
                        </button>
                      ) : null}
                      {actions.includes('start_investigation') ? (
                        <button
                          type="button"
                          className="accidentreports-action-button accidentreports-action-button--investigate"
                          onClick={() => onAction(report, 'start_investigation')}
                          title="Start investigation"
                        >
                          <FaSearch />
                        </button>
                      ) : null}
                      {actions.includes('investigation_notes') ? (
                        <button
                          type="button"
                          className="accidentreports-action-button accidentreports-action-button--notes"
                          onClick={() => onAction(report, 'investigation_notes')}
                          title="Investigation notes"
                        >
                          <FaFileAlt />
                        </button>
                      ) : null}
                      {actions.includes('submit_review') ? (
                        <button
                          type="button"
                          className="accidentreports-action-button accidentreports-action-button--review"
                          onClick={() => onAction(report, 'submit_review')}
                          title="Submit for review"
                        >
                          <FaClipboardList />
                        </button>
                      ) : null}
                      {actions.includes('complete_investigation') ? (
                        <button
                          type="button"
                          className="accidentreports-action-button accidentreports-action-button--complete-inv"
                          onClick={() => onAction(report, 'complete_investigation')}
                          title="Complete investigation"
                        >
                          <FaCheckCircle />
                        </button>
                      ) : null}
                      {actions.includes('approve') ? (
                        <button
                          type="button"
                          className="accidentreports-action-button accidentreports-action-button--repair"
                          onClick={() => onAction(report, 'approve')}
                          title="Approve for technician"
                        >
                          <FaWrench />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="11" className="accidentreports-empty-cell">
                No incident reports found
                {totalCount > 0 ? ` (${totalCount} hidden by search/filters)` : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
