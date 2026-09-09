import React, { useEffect, useMemo } from 'react';
import { FaTimes } from 'react-icons/fa';

function cellValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return String(value);
}

/**
 * Drill-down modal for HRM dashboard card / chart clicks.
 */
export default function HrmDashboardBreakdownModal({
  open,
  loading,
  error,
  data,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const title = data?.title || 'Details';

  const periodHint = useMemo(() => {
    const p = data?.period;
    if (!p?.periodKey) return null;
    return `${p.periodType || 'period'}: ${p.periodKey}`;
  }, [data?.period]);

  if (!open) return null;

  return (
    <div
      className="hrm-dash-breakdown-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="hrm-dash-breakdown-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hrm-dash-breakdown-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hrm-dash-breakdown-header">
          <div>
            <h2 id="hrm-dash-breakdown-title">{title}</h2>
            {periodHint ? <p className="hrm-dash-breakdown-period">{periodHint}</p> : null}
          </div>
          <button
            type="button"
            className="hrm-dash-breakdown-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </header>

        {data?.description ? (
          <p className="hrm-dash-breakdown-desc">{data.description}</p>
        ) : null}

        {loading ? <p className="hrm-dash-breakdown-status">Loading details…</p> : null}
        {!loading && error ? (
          <p className="hrm-dash-breakdown-status hrm-dash-breakdown-status--error">
            {error}
          </p>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="hrm-dash-breakdown-meta">
              <strong>{data?.total ?? rows.length}</strong> row
              {(data?.total ?? rows.length) === 1 ? '' : 's'}
              {data?.truncated ? ' (showing first page)' : ''}
            </div>
            <div className="hrm-dash-breakdown-table-wrap">
              {rows.length === 0 ? (
                <p className="hrm-dash-empty">No rows for this selection.</p>
              ) : (
                <table className="hrm-dash-breakdown-table">
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.employeeId || row.leaveRequestId || row.reviewId || row.recordId || idx}>
                        {columns.map((col) => (
                          <td key={col.key}>{cellValue(row[col.key])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
