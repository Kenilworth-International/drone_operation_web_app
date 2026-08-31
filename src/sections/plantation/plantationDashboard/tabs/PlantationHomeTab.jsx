import React from 'react';
import { FaSync } from 'react-icons/fa';
import PlantationDashboard from '../PlantationDashboard';
import FieldAvailabilitySection from '../components/FieldAvailabilitySection';
import PlantationPageLayout from '../components/PlantationPageLayout';
import { usePlantationSession } from '../../hooks/usePlantationSession';
import '../../../../styles/plantationDashboard.css';

export default function PlantationHomeTab() {
  const { refresh, isFetching, jobRoleCode } = usePlantationSession();
  const basePath = '/home/plantation-dashboard';

  const subtitle = jobRoleCode
    ? `Mission overview and performance for your ${String(jobRoleCode).toUpperCase()} scope`
    : 'Mission overview and performance for your estate';

  return (
    <PlantationPageLayout
      title="Dashboard"
      subtitle={subtitle}
      actions={(
        <button
          type="button"
          className="pd-refresh-btn pd-refresh-btn--icon"
          onClick={refresh}
          disabled={isFetching}
          aria-label="Refresh"
        >
          <FaSync className={isFetching ? 'pd-spin' : ''} aria-hidden="true" />
        </button>
      )}
      flush
    >
      <FieldAvailabilitySection basePath={basePath} />
      <PlantationDashboard
        basePath={basePath}
        showUserHierarchy={false}
        showTopHeader={false}
        embeddedInExternalShell
      />
    </PlantationPageLayout>
  );
}
