import React from 'react';
import {
  FaLeaf, FaPlus, FaFileExcel, FaSearch, FaTimes,
  FaEdit, FaToggleOn, FaToggleOff, FaProjectDiagram,
  FaSpinner, FaInbox,
} from 'react-icons/fa';

const LoadingSpinner = ({ text = 'Loading...' }) => (
  <div className="loading-map-update">
    <FaSpinner className="spinner-icon-map-update" />
    <span>{text}</span>
  </div>
);

const EmptyState = ({ icon: Icon = FaInbox, title, description }) => (
  <div className="empty-state-map-update">
    <Icon className="empty-icon-map-update" />
    <p className="empty-title-map-update">{title}</p>
    {description && <p className="empty-desc-map-update">{description}</p>}
  </div>
);

const formatHa = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return (Math.round(n * 100) / 100).toString();
};

const FieldDayendStats = ({ field }) => {
  const missionCount = Number(field.ops_missions_1y) || 0;
  const minArea = formatHa(field.ops_min_dji_area_1y);
  const maxArea = formatHa(field.ops_max_dji_area_1y);
  const hasCoverage = minArea != null && maxArea != null;

  return (
    <div className="field-card-dayend-stats-map-update">
      <div className="field-card-dayend-stat-map-update">
        <span className="field-card-dayend-label-map-update">Spray/Spread (1Y)</span>
        <span className="field-card-dayend-value-map-update">{missionCount}</span>
      </div>
      <div className="field-card-dayend-stat-map-update">
        <span className="field-card-dayend-label-map-update">DJI area (1Y)</span>
        <span className="field-card-dayend-value-map-update">
          {hasCoverage ? `${minArea} – ${maxArea} Ha` : '—'}
        </span>
      </div>
    </div>
  );
};

const AvailabilityCell = ({ field, type, missionReasons, onEdit, canEdit }) => {
  const canValue = type === 'spread' ? field.can_spread : field.can_spray;
  const textCol = type === 'spread' ? field.can_spread_text : field.can_spray_text;
  const isYes = Number(canValue) === 1;
  const reasonObj = !isYes ? missionReasons.find((r) => String(r.id) === String(textCol)) : null;
  const hasMissingReason = !isYes && !reasonObj;
  const label = type === 'spread' ? 'Spread' : 'Spray';

  const content = isYes ? (
    <span className="yn-badge-map-update yn-yes-map-update">Yes</span>
  ) : (
    <span className="yn-badge-map-update yn-no-map-update">
      No
      {reasonObj && (
        <span className="yn-tooltip-map-update">{reasonObj.reason}</span>
      )}
    </span>
  );

  if (!canEdit) {
    return (
      <div className="field-card-availability-item-map-update">
        <span className="field-card-availability-label-map-update">{label}</span>
        {content}
      </div>
    );
  }

  return (
    <div className="field-card-availability-item-map-update">
      <span className="field-card-availability-label-map-update">{label}</span>
      <button
        type="button"
        className={`availability-cell-map-update${hasMissingReason ? ' availability-cell--missing-reason-map-update' : ''}`}
        onClick={() => onEdit(field, type)}
        title={`Edit ${type} availability`}
      >
        {content}
      </button>
    </div>
  );
};

const FieldCard = ({
  field,
  hasEditFeature,
  hasActivateFeature,
  showFieldActionsColumn,
  missionReasons,
  onFieldEdit,
  onAvailabilityModal,
  onToggleFieldActivation,
}) => {
  const hasActions = showFieldActionsColumn && (hasEditFeature || hasActivateFeature);

  return (
    <div
      className={`field-card-map-update hierarchy-card-map-update ${field.activated ? 'field-card-active-map-update' : 'field-card-inactive-map-update'}`}
    >
      <div className="field-card-body-map-update">
        <div className="field-card-header-map-update">
          <div className="hierarchy-card-icon-wrap-map-update">
            <FaLeaf className="hierarchy-card-icon-map-update" />
          </div>
          <div className="field-card-header-text-map-update">
            <span className="hierarchy-card-name-map-update">{field.short_name || field.field}</span>
            {field.area != null && field.area !== '' && (
              <span className="hierarchy-card-meta-map-update">Area: {field.area}</span>
            )}
          </div>
        </div>
        <FieldDayendStats field={field} />
        <div className="field-card-availability-row-map-update">
          <AvailabilityCell
            field={field}
            type="spread"
            missionReasons={missionReasons}
            onEdit={onAvailabilityModal}
            canEdit={hasEditFeature}
          />
          <AvailabilityCell
            field={field}
            type="spray"
            missionReasons={missionReasons}
            onEdit={onAvailabilityModal}
            canEdit={hasEditFeature}
          />
        </div>
      </div>

      {hasActions && (
        <div className="hierarchy-card-actions-map-update">
          {hasEditFeature && (
            <button
              type="button"
              onClick={() => onFieldEdit(field)}
              className="card-action-btn-map-update card-action-btn-neutral-map-update"
              title="Edit field"
            >
              <FaEdit />
            </button>
          )}
          {hasActivateFeature && (
            <button
              type="button"
              onClick={() => onToggleFieldActivation(field.id)}
              className={`card-action-btn-map-update ${field.activated ? 'card-action-btn-on-map-update' : 'card-action-btn-off-map-update'}`}
              title={field.activated ? 'Deactivate' : 'Activate'}
            >
              {field.activated ? <FaToggleOn /> : <FaToggleOff />}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MappingFieldsPanel = ({
  filteredFields,
  fieldsLoading,
  searchTerm,
  setSearchTerm,
  selectedDivision,
  hasEditFeature,
  hasActivateFeature,
  hasAddFeature,
  showFieldActionsColumn,
  missionReasons,
  onFieldEdit,
  onAvailabilityModal,
  onToggleFieldActivation,
  onAddField,
  onDownloadExcel,
  onBlockReasons,
}) => {
  return (
    <div className="fields-card-map-update">
      <div className="fields-card-header-map-update">
        <div className="fields-card-title-row-map-update">
          <div className="fields-card-title-group-map-update">
            <FaLeaf className="fields-card-icon-map-update" />
            <h2 className="fields-card-title-map-update">Fields</h2>
            {selectedDivision && (
              <span className="fields-card-count-map-update">
                {filteredFields.length} field{filteredFields.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {selectedDivision && (
            <div className="fields-card-actions-map-update">
              {hasEditFeature && (
                <button
                  type="button"
                  onClick={onBlockReasons}
                  className="btn-ghost-sm-map-update"
                  title="Add or edit block reason catalog"
                >
                  Block reasons
                </button>
              )}
              <button
                onClick={onDownloadExcel}
                className="btn-excel-map-update"
                title="Download Excel"
              >
                <FaFileExcel /> Export
              </button>
              {hasAddFeature && (
                <button
                  onClick={onAddField}
                  className="btn-primary-sm-map-update"
                  title="Create Field"
                >
                  <FaPlus /> Add Field
                </button>
              )}
            </div>
          )}
        </div>

        {selectedDivision && (
          <div className="search-map-update">
            <FaSearch className="search-icon-map-update" />
            <input
              type="text"
              className="search-input-map-update"
              placeholder="Search by field name or short name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="search-clear-map-update" onClick={() => setSearchTerm('')}>
                <FaTimes />
              </button>
            )}
          </div>
        )}
      </div>

      {!selectedDivision ? (
        <EmptyState
          icon={FaProjectDiagram}
          title="No division selected"
          description="Select a division from the hierarchy above to view and manage its fields."
        />
      ) : fieldsLoading ? (
        <LoadingSpinner text="Loading fields..." />
      ) : filteredFields.length === 0 ? (
        <EmptyState
          icon={FaLeaf}
          title={searchTerm ? 'No matching fields' : 'No fields yet'}
          description={
            searchTerm
              ? 'Try a different search term.'
              : hasAddFeature
                ? 'Click "Add Field" to create the first field in this division.'
                : 'No fields available to view in this division.'
          }
        />
      ) : (
        <div className="card-grid-map-update fields-card-grid-map-update">
          {filteredFields.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              hasEditFeature={hasEditFeature}
              hasActivateFeature={hasActivateFeature}
              showFieldActionsColumn={showFieldActionsColumn}
              missionReasons={missionReasons}
              onFieldEdit={onFieldEdit}
              onAvailabilityModal={onAvailabilityModal}
              onToggleFieldActivation={onToggleFieldActivation}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MappingFieldsPanel;
