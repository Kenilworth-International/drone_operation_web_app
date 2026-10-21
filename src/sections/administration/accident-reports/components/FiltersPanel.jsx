import React from 'react';

export default function FiltersPanel({
  filters,
  pilots,
  onChange,
  onClear,
  hasActiveFilters,
  searchTerm,
  onSearchChange,
}) {
  return (
    <section
      className={`accidentreports-filters-panel accidentreports-controls ${hasActiveFilters ? 'accidentreports-filters-panel--active' : ''}`}
      aria-label="Report filters"
    >
      <div className="accidentreports-filters-row">
        <input
          id="ir-filter-search"
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ID, pilot, serial, estate, incident type"
          className="accidentreports-filter-input accidentreports-filter-input--search"
          aria-label="Search"
        />
        <input
          id="ir-filter-start"
          type="date"
          value={filters.start_date}
          onChange={(e) => onChange('start_date', e.target.value)}
          className="accidentreports-filter-input accidentreports-filter-input--date"
          aria-label="Start date"
          title="Start date"
        />
        <input
          id="ir-filter-end"
          type="date"
          value={filters.end_date}
          onChange={(e) => onChange('end_date', e.target.value)}
          className="accidentreports-filter-input accidentreports-filter-input--date"
          aria-label="End date"
          title="End date"
        />
        <select
          id="ir-filter-pilot"
          value={filters.pilot}
          onChange={(e) => onChange('pilot', e.target.value)}
          className="accidentreports-filter-select accidentreports-filter-select--pilot"
          aria-label="Pilot"
        >
          <option value="">All pilots</option>
          {(Array.isArray(pilots) ? pilots : []).map((pilot, index) => {
            const id = pilot?.id ?? pilot?.pilot_id ?? pilot?.user_id ?? `pilot-${index}`;
            const name = pilot?.name || pilot?.pilot_name || `Pilot ${id}`;
            return (
              <option key={`pilot-opt-${id}-${index}`} value={id}>
                {name}
              </option>
            );
          })}
        </select>
        <input
          id="ir-filter-serial"
          type="text"
          value={filters.device_serial}
          onChange={(e) => onChange('device_serial', e.target.value)}
          placeholder="Search by serial"
          className="accidentreports-filter-input accidentreports-filter-input--serial"
          aria-label="Device serial"
        />
        <button type="button" onClick={onClear} className="accidentreports-clear-button accidentreports-clear-button--inline">
          Clear
        </button>
      </div>
    </section>
  );
}
