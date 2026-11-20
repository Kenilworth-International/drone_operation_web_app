import React, { useMemo } from 'react';
import { toYmd } from './reportsExcelExport';

/** From–To native date range (compact inline). Optional Week / Month / Last presets. */
export function OpsDateRangeControls({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  label = 'Period',
  showPresets = false,
  activePreset = null,
  onPreset = null,
}) {
  const startYmd = toYmd(startDate);
  const endYmd = toYmd(endDate);
  const todayYmd = toYmd(new Date());

  return (
    <div className="rds-ops-controls-block rds-ops-controls-inline">
      <span className="rds-ops-controls-label">{label}</span>
      <label className="rds-ops-field rds-ops-field-inline">
        <span>From</span>
        <input
          type="date"
          value={startYmd}
          max={endYmd}
          onChange={(e) => {
            if (!e.target.value) return;
            onStartChange(new Date(`${e.target.value}T00:00:00`));
          }}
        />
      </label>
      <label className="rds-ops-field rds-ops-field-inline">
        <span>To</span>
        <input
          type="date"
          value={endYmd}
          min={startYmd}
          max={todayYmd}
          onChange={(e) => {
            if (!e.target.value) return;
            onEndChange(new Date(`${e.target.value}T00:00:00`));
          }}
        />
      </label>
      {showPresets && typeof onPreset === 'function' && (
        <div className="rds-ops-view-toggle">
          {[
            ['week', 'Week'],
            ['month', 'Month'],
            ['last', 'Last'],
          ].map(([key, text]) => (
            <button
              key={key}
              type="button"
              className={`rds-ops-view-btn${activePreset === key ? ' is-active' : ''}`}
              onClick={() => onPreset(key)}
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Single month picker (`YYYY-MM`). */
export function OpsMonthControls({ yearMonth, onChange, label = 'Month' }) {
  return (
    <div className="rds-ops-controls-block rds-ops-controls-inline">
      <span className="rds-ops-controls-label">{label}</span>
      <label className="rds-ops-field rds-ops-field-inline">
        <input
          type="month"
          value={yearMonth || ''}
          max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

/**
 * Chip list capped to 2 rows (scroll sideways if more). options: [{ value, label }]
 */
export function OpsChipFold({
  label,
  options = [],
  selected = [],
  onToggle,
  onSelectAll,
  onClear,
  disabled = false,
  emptyText = 'None',
}) {
  const selectedCount = selected.length;
  const summary =
    selectedCount === 0
      ? emptyText
      : selectedCount === options.length && options.length > 0
        ? 'All'
        : `${selectedCount} selected`;

  return (
    <div className="rds-ops-chip-fold is-open">
      <div className="rds-ops-chip-fold-bar">
        <span className="rds-ops-controls-label">{label}</span>
        <span className="rds-ops-chip-fold-summary">{summary}</span>
        {(onSelectAll || onClear) && (
          <div className="rds-ops-view-toggle">
            {onSelectAll && (
              <button type="button" className="rds-ops-view-btn" onClick={onSelectAll} disabled={disabled}>
                All
              </button>
            )}
            {onClear && (
              <button
                type="button"
                className="rds-ops-view-btn"
                onClick={onClear}
                disabled={disabled || selectedCount === 0}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
      <div className="rds-ops-chip-grid" role="group" aria-label={label}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              className={`rds-ops-view-btn${on ? ' is-active' : ''}`}
              onClick={() => onToggle?.(o.value)}
              disabled={disabled}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Multi-select month chips (`YYYY-MM`) with 2-row fold. */
export function OpsMultiMonthControls({
  options = [],
  selected = [],
  onToggle,
  onSelectAll,
  onClear,
  label = 'Months',
  disabled = false,
}) {
  return (
    <OpsChipFold
      label={label}
      options={options}
      selected={selected}
      onToggle={onToggle}
      onSelectAll={onSelectAll}
      onClear={onClear}
      disabled={disabled}
    />
  );
}

/** Plantation multi-select as chips (same 2-row fold). */
export function OpsPlantationChipControls({
  plantations = [],
  selected = [],
  onToggle,
  onSelectAll,
  onClear,
  loading = false,
  disabled = false,
  label = 'Plantations',
}) {
  const options = useMemo(
    () => plantations.map((pl) => ({ value: pl.id, label: pl.name })),
    [plantations]
  );

  if (loading) {
    return (
      <div className="rds-ops-chip-fold">
        <div className="rds-ops-chip-fold-bar">
          <span className="rds-ops-controls-label">{label}</span>
          <span className="rds-ops-chip-fold-summary">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <OpsChipFold
      label={label}
      options={options}
      selected={selected}
      onToggle={onToggle}
      onSelectAll={onSelectAll}
      onClear={onClear}
      disabled={disabled}
    />
  );
}

/**
 * Toolbar shell: primary strip (always) + optional fold panel for dense filters.
 * Put View / Mission / Generate in `primary`; months + plantations in `filters`.
 */
export function OpsFilterToolbar({ primary, filters, filtersOpen, onToggleFilters, filterSummary }) {
  const hasFilters = Boolean(filters);
  return (
    <div className="rds-ops-controls rds-ops-toolbar">
      <div className="rds-ops-toolbar-primary">
        {primary}
        {hasFilters && (
          <button
            type="button"
            className={`rds-ops-view-btn rds-ops-filters-toggle${filtersOpen ? ' is-active' : ''}`}
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
          >
            {filtersOpen ? 'Hide filters' : filterSummary || 'Filters'}
          </button>
        )}
      </div>
      {hasFilters && filtersOpen && <div className="rds-ops-toolbar-fold">{filters}</div>}
    </div>
  );
}

export function startOfMonthDate(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function yearMonthFromDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(yearMonth) {
  const [y, m] = String(yearMonth || '').split('-').map(Number);
  if (!y || !m) {
    const now = new Date();
    return { start: startOfMonthDate(now), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
  }
  return {
    start: new Date(y, m - 1, 1),
    end: new Date(y, m, 0),
  };
}
