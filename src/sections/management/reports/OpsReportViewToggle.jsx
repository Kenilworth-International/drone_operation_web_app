import React from 'react';

/**
 * Chart | Table toggle for Ops Room reports. Default view should be 'chart'.
 */
export default function OpsReportViewToggle({ view, onChange }) {
  return (
    <div className="rds-ops-controls-block rds-ops-controls-inline">
      <span className="rds-ops-controls-label">View</span>
      <div className="rds-ops-view-toggle" role="group" aria-label="Chart or table">
        {[
          ['chart', 'Chart'],
          ['table', 'Table'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rds-ops-view-btn${view === key ? ' is-active' : ''}`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
