import React from 'react';
import { FaSync } from 'react-icons/fa';
import PlantationDashboard from '../PlantationDashboard';
import FieldAvailabilitySection from '../components/FieldAvailabilitySection';
import { usePlantationSession } from '../../hooks/usePlantationSession';
import '../../../../styles/plantationDashboard.css';

export default function PlantationHomeTab() {
  const { refresh, isFetching } = usePlantationSession();
  const basePath = '/home/plantation-dashboard';

  return (
    <div className="plantation-home-tab">
      <div className="plantation-home-tab-toolbar">
        <h1 className="plantation-home-tab-title">Home</h1>
        <button type="button" className="pd-refresh-btn" onClick={refresh} disabled={isFetching}>
          <FaSync className={isFetching ? 'pd-spin' : ''} /> Refresh
        </button>
      </div>
      <FieldAvailabilitySection basePath={basePath} />
      <PlantationDashboard
        basePath={basePath}
        showUserHierarchy={false}
        showTopHeader={false}
        embeddedInExternalShell
      />
    </div>
  );
}
