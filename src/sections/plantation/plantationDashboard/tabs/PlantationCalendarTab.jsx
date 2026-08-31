import React, { useMemo, useState } from 'react';
import PlantationCalendar from '../components/PlantationCalendar';
import MonthlyRequestSection from '../components/MonthlyRequestSection';
import PlantationPageLayout from '../components/PlantationPageLayout';
import { usePlantationSession } from '../../hooks/usePlantationSession';
import {
  getPlantationCalendarHierarchyLevel,
  getPlantationCalendarScopeDescription,
} from '../../../../utils/authUtils';
import { getUserData } from '../../../../utils/authUtils';
import '../../../../styles/plantationDashboard.css';

export default function PlantationCalendarTab() {
  const [segment, setSegment] = useState('adhoc');
  const [selectedAction, setSelectedAction] = useState('All');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { canRequestPlans } = usePlantationSession();

  const missionType =
    selectedAction === 'Spray' ? 'spy' : selectedAction === 'Spread' ? 'spd' : 'all';

  const userData = getUserData();
  const hierarchyLevel = getPlantationCalendarHierarchyLevel(userData);
  const calendarScopeDescription = getPlantationCalendarScopeDescription(hierarchyLevel, userData);
  const enablePlanRequestUi = canRequestPlans;

  const subtitle = useMemo(
    () => calendarScopeDescription || 'View plans and submit mission requests',
    [calendarScopeDescription]
  );

  return (
    <PlantationPageLayout title="Calendar" subtitle={subtitle} className="plantation-calendar-tab">
      <div className="pd-calendar-segments">
        <button
          type="button"
          className={`plantation-action-btn ${segment === 'monthly' ? 'active' : ''}`}
          onClick={() => setSegment('monthly')}
        >
          Monthly request
        </button>
        <button
          type="button"
          className={`plantation-action-btn ${segment === 'adhoc' ? 'active' : ''}`}
          onClick={() => setSegment('adhoc')}
        >
          Adhoc request
        </button>
      </div>

      {segment === 'monthly' ? (
        <MonthlyRequestSection />
      ) : (
        <>
          <div className="plantation-charts-control-group pd-calendar-filters">
            {['All', 'Spray', 'Spread'].map((action) => (
              <button
                key={action}
                type="button"
                className={`plantation-action-btn ${selectedAction === action ? 'active' : ''}`}
                onClick={() => setSelectedAction(action)}
              >
                {action}
              </button>
            ))}
          </div>
          <PlantationCalendar
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            missionType={missionType}
            enablePlanRequestUi={enablePlanRequestUi}
          />
        </>
      )}
    </PlantationPageLayout>
  );
}
