import React from 'react';
import {
  FaChevronRight, FaCubes, FaFileExcel, FaPlus, FaLeaf,
} from 'react-icons/fa';

const MappingHierarchyNav = ({
  breadcrumbs,
  currentViewLevel,
  onRootClick,
  onBreadcrumbClick,
  onAddClick,
  hasAddFeature,
  onAllFieldsReport,
  allFieldsLoading,
}) => {
  const addLabel =
    currentViewLevel === 'fields'
      ? 'Add Field'
      : `Add ${currentViewLevel.charAt(0).toUpperCase() + currentViewLevel.slice(1)}`;

  const currentLevelLabel =
    currentViewLevel === 'fields'
      ? null
      : `${currentViewLevel.charAt(0).toUpperCase() + currentViewLevel.slice(1)}s`;

  return (
    <header className="nav-bar-map-update">
      <div className="nav-bar-left-map-update">
        <button
          type="button"
          className={`nav-crumb-map-update ${breadcrumbs.length === 0 ? 'nav-crumb-current-map-update' : ''}`}
          onClick={onRootClick}
          title="View all groups"
        >
          <FaCubes className="nav-crumb-icon-map-update" />
          <span>Groups</span>
        </button>

        {breadcrumbs.map((crumb, idx) => {
          const Icon = crumb.icon;
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.key}>
              <FaChevronRight className="nav-crumb-sep-map-update" />
              <button
                type="button"
                className={`nav-crumb-map-update ${isLast && currentViewLevel === 'fields' ? 'nav-crumb-current-map-update' : ''}`}
                onClick={() => onBreadcrumbClick(crumb.key)}
                title={`Go back to ${crumb.label}`}
              >
                <Icon className="nav-crumb-icon-map-update" />
                <span>{crumb.value}</span>
              </button>
            </React.Fragment>
          );
        })}

        {currentLevelLabel && (
          <>
            <FaChevronRight className="nav-crumb-sep-map-update" />
            <span className="nav-level-label-map-update">{currentLevelLabel}</span>
          </>
        )}

        {currentViewLevel === 'fields' && (
          <>
            <FaChevronRight className="nav-crumb-sep-map-update" />
            <span className="nav-level-label-map-update">
              <FaLeaf style={{ fontSize: 11 }} />
              Fields
            </span>
          </>
        )}
      </div>

      <div className="nav-bar-right-map-update">
        {hasAddFeature && (
          <button
            type="button"
            className="nav-add-btn-map-update"
            onClick={onAddClick}
            title={addLabel}
          >
            <FaPlus />
            <span>{addLabel}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onAllFieldsReport}
          className="btn-all-report-map-update"
          disabled={allFieldsLoading}
        >
          <FaFileExcel />
          {allFieldsLoading ? 'Downloading...' : 'All Fields Report'}
        </button>
      </div>
    </header>
  );
};

export default MappingHierarchyNav;
