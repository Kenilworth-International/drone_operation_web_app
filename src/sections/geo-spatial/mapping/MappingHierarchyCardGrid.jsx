import React from 'react';
import {
  FaToggleOn, FaToggleOff, FaSlidersH, FaMapMarkerAlt, FaImage,
  FaCheck, FaTimesCircle, FaSpinner, FaInbox,
} from 'react-icons/fa';

const CardLoadingSpinner = ({ text }) => (
  <div className="loading-map-update">
    <FaSpinner className="spinner-icon-map-update" />
    <span>{text}</span>
  </div>
);

const CardEmptyState = ({ icon: Icon = FaInbox, title, description }) => (
  <div className="empty-state-map-update">
    <Icon className="empty-icon-map-update" />
    <p className="empty-title-map-update">{title}</p>
    {description && <p className="empty-desc-map-update">{description}</p>}
  </div>
);

const HierarchyCard = ({
  level,
  item,
  nameField,
  isSelected,
  onSelect,
  onToggleActivation,
  hasActivateFeature,
  hasEditFeature,
  onPlanSizeModal,
  onCoordinateModal,
  onMapImageModal,
  onSetFinalized,
  estatePlanSizeSummary,
  estateCoordinateSummary,
  estateCoordinatesMissing,
  levelIcon: LevelIcon,
}) => {
  const missing = (level === 'estate' || level === 'division') && estateCoordinatesMissing(item);
  const planSizeSummary = level === 'estate' ? estatePlanSizeSummary(item) : null;
  const coordSummary = (level === 'estate' || level === 'division') ? estateCoordinateSummary(item) : null;

  const cardClass = [
    'hierarchy-card-map-update',
    isSelected ? 'hierarchy-card-selected-map-update' : '',
    !item.activated ? 'hierarchy-card-inactive-map-update' : '',
    level === 'estate' && item.finalized === 1 ? 'hierarchy-card-finalized-map-update' : '',
    level === 'estate' && item.finalized !== 1 ? 'hierarchy-card-not-finalized-map-update' : '',
    missing ? 'hierarchy-card-missing-coords-map-update' : '',
  ].filter(Boolean).join(' ');

  const hasActions =
    hasActivateFeature
    || hasEditFeature;

  return (
    <div
      className={cardClass}
      onClick={() => onSelect(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item.id); }
      }}
    >
      <div className="hierarchy-card-body-map-update">
        <div className="hierarchy-card-icon-wrap-map-update">
          <LevelIcon className="hierarchy-card-icon-map-update" />
        </div>
        <div className="hierarchy-card-content-map-update">
          <span className="hierarchy-card-name-map-update">{item[nameField]}</span>
          {planSizeSummary && (
            <span className="hierarchy-card-meta-map-update">{planSizeSummary}</span>
          )}
          {coordSummary && !missing && (
            <span className="hierarchy-card-meta-map-update">{coordSummary}</span>
          )}
          {missing && (
            <span className="hierarchy-card-meta-map-update hierarchy-card-meta-warn-map-update">
              Coordinates missing
            </span>
          )}
          {!item.activated && (
            <span className="hierarchy-card-badge-inactive-map-update">Inactive</span>
          )}
          {level === 'estate' && item.finalized === 1 && (
            <span className="hierarchy-card-badge-finalized-map-update">Finalized</span>
          )}
          {item.map_image && (
            <span className="hierarchy-card-badge-map-image-map-update">Map uploaded</span>
          )}
        </div>
      </div>

      {hasActions && (
        <div className="hierarchy-card-actions-map-update" onClick={(e) => e.stopPropagation()}>
          {hasActivateFeature && (
            <button
              type="button"
              className={`card-action-btn-map-update ${item.activated ? 'card-action-btn-on-map-update' : 'card-action-btn-off-map-update'}`}
              onClick={(e) => { e.stopPropagation(); onToggleActivation(item.id); }}
              title={item.activated ? 'Deactivate' : 'Activate'}
            >
              {item.activated ? <FaToggleOn /> : <FaToggleOff />}
            </button>
          )}

          {hasEditFeature && (
            <button
              type="button"
              className={`card-action-btn-map-update ${item.map_image ? 'card-action-btn-success-map-update' : 'card-action-btn-neutral-map-update'}`}
              onClick={(e) => { e.stopPropagation(); onMapImageModal(level, item.id); }}
              title={item.map_image ? 'View / update map image' : 'Upload map image'}
            >
              <FaImage />
            </button>
          )}

          {hasEditFeature && level === 'estate' && (
            <>
              <button
                type="button"
                className="card-action-btn-map-update card-action-btn-neutral-map-update"
                onClick={(e) => { e.stopPropagation(); onPlanSizeModal(item.id); }}
                title="Update min / max plan size"
              >
                <FaSlidersH />
              </button>
              <button
                type="button"
                className="card-action-btn-map-update card-action-btn-neutral-map-update"
                onClick={(e) => { e.stopPropagation(); onCoordinateModal(item.id); }}
                title="Update coordinates"
              >
                <FaMapMarkerAlt />
              </button>
              {item.finalized === 1 ? (
                <button
                  type="button"
                  className="card-action-btn-map-update card-action-btn-danger-map-update"
                  onClick={(e) => { e.stopPropagation(); onSetFinalized(item.id, 0); }}
                  title="Set as Not Finalized"
                >
                  <FaTimesCircle />
                </button>
              ) : (
                <button
                  type="button"
                  className="card-action-btn-map-update card-action-btn-success-map-update"
                  onClick={(e) => { e.stopPropagation(); onSetFinalized(item.id, 1); }}
                  title="Set as Finalized"
                >
                  <FaCheck />
                </button>
              )}
            </>
          )}

          {hasEditFeature && level === 'division' && (
            <button
              type="button"
              className="card-action-btn-map-update card-action-btn-neutral-map-update"
              onClick={(e) => { e.stopPropagation(); onCoordinateModal(item.id); }}
              title="Update coordinates"
            >
              <FaMapMarkerAlt />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MappingHierarchyCardGrid = ({
  level,
  levelConfig,
  data,
  loading,
  selectedId,
  onSelect,
  onToggleActivation,
  hasActivateFeature,
  hasEditFeature,
  hasAddFeature,
  onPlanSizeModal,
  onCoordinateModal,
  onMapImageModal,
  onSetFinalized,
  estatePlanSizeSummary,
  estateCoordinateSummary,
  estateCoordinatesMissing,
  animKey,
}) => {
  const { nameField, label, icon: LevelIcon } = levelConfig;

  if (loading) {
    return <CardLoadingSpinner text={`Loading ${label.toLowerCase()}s...`} />;
  }

  if (data.length === 0) {
    return (
      <CardEmptyState
        icon={LevelIcon}
        title={`No ${label.toLowerCase()}s found`}
        description={
          hasAddFeature
            ? `Click "+ Add ${label}" above to create one`
            : `No ${label.toLowerCase()}s available.`
        }
      />
    );
  }

  return (
    <div className="card-grid-map-update" key={animKey}>
      {data.map((item) => (
        <HierarchyCard
          key={item.id}
          level={level}
          item={item}
          nameField={nameField}
          isSelected={selectedId === item.id}
          onSelect={onSelect}
          onToggleActivation={onToggleActivation}
          hasActivateFeature={hasActivateFeature}
          hasEditFeature={hasEditFeature}
          onPlanSizeModal={onPlanSizeModal}
          onCoordinateModal={onCoordinateModal}
          onMapImageModal={onMapImageModal}
          onSetFinalized={onSetFinalized}
          estatePlanSizeSummary={estatePlanSizeSummary}
          estateCoordinateSummary={estateCoordinateSummary}
          estateCoordinatesMissing={estateCoordinatesMissing}
          levelIcon={LevelIcon}
        />
      ))}
    </div>
  );
};

export default MappingHierarchyCardGrid;
