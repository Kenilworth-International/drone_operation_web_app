import React from 'react';

const ALERTS = [
  { key: 'excessiveLeave', label: 'Excessive leave', hint: 'Used ≥ 80% of available quota', tone: 'rose' },
  { key: 'longDuration', label: 'Long-duration leave', hint: 'Single request ≥ 7 calendar days', tone: 'amber' },
  { key: 'withoutApproval', label: 'Leave without approval', hint: 'Auto / HR auto-approved', tone: 'violet' },
  { key: 'pendingApproval', label: 'Pending approval', hint: 'Waiting RO or HOD', tone: 'sky' },
  { key: 'highBalances', label: 'High leave balances', hint: 'High remaining annual leave', tone: 'teal' },
];

export default function LeaveAlerts({ alerts, onOpenAlert }) {
  return (
    <section className="leave-ops-section">
      <h3>Important alerts</h3>
      <p className="leave-ops-section-hint">Click an alert to open the employee / request list.</p>
      <div className="leave-ops-alert-grid">
        {ALERTS.map((item) => {
          const bucket = alerts?.[item.key] || { count: 0, rows: [] };
          const count = Number(bucket.count || 0);
          return (
            <button
              key={item.key}
              type="button"
              className={`leave-ops-alert leave-ops-alert--${item.tone}${count > 0 ? ' leave-ops-alert--active' : ''}`}
              onClick={() => onOpenAlert?.(item, bucket)}
              title={item.hint}
            >
              <span className="leave-ops-alert-label">{item.label}</span>
              <span className="leave-ops-alert-count">{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
