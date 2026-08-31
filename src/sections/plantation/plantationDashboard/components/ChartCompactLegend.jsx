import React from 'react';

/**
 * Compact legend for plantation dashboard charts — horizontal wrap on desktop, scroll row on mobile.
 */
export default function ChartCompactLegend({ payload, extraItems = [], isMobile = false }) {
  if ((!payload || payload.length === 0) && extraItems.length === 0) return null;

  return (
    <div
      className={`pd-chart-legend${isMobile ? ' pd-chart-legend--mobile' : ''}`}
      role="list"
      aria-label="Chart legend"
    >
      {(payload || []).map((entry, i) => (
        <div key={`${entry.value}-${i}`} className="pd-chart-legend-item" role="listitem">
          <span
            className="pd-chart-legend-swatch pd-chart-legend-swatch--bar"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          <span className="pd-chart-legend-label">{entry.value}</span>
        </div>
      ))}
      {extraItems.map((item, i) => (
        <div key={`extra-${i}`} className="pd-chart-legend-item" role="listitem">
          <span
            className={`pd-chart-legend-swatch pd-chart-legend-swatch--${item.type || 'line'}`}
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="pd-chart-legend-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
