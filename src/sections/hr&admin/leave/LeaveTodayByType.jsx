import React from 'react';

export default function LeaveTodayByType({ byType = [], onOpenType }) {
  return (
    <section className="leave-ops-section">
      <h3>Employees on leave today</h3>
      <p className="leave-ops-section-hint">Click a leave type to view employees.</p>
      <div className="leave-ops-kpi-grid">
        {(byType || []).map((item) => {
          const count = Number(item.count || 0);
          return (
            <button
              key={item.leaveTypeCode}
              type="button"
              className={`leave-ops-kpi${count > 0 ? ' leave-ops-kpi--active' : ''}`}
              onClick={() => onOpenType?.(item)}
              title={`View ${item.leaveTypeName}`}
            >
              <span className="leave-ops-kpi-label">{item.leaveTypeName}</span>
              <span className="leave-ops-kpi-count">{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
