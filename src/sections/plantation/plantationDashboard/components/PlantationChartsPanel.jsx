import React from 'react';
import PlannedVsTeaRevenueChart from './PlannedVsTeaRevenueChart';
import PlannedVsSprayedChart from './PlannedVsSprayedChart';
import MonthRangePicker from './MonthRangePicker';

export default function PlantationChartsPanel({
  missionType,
  chartMonths,
  chartMonthRange,
  setChartMonthRange,
  basePath,
  completedPlansOnly = true,
}) {
  const startMonth = `${chartMonthRange.start.getFullYear()}-${String(chartMonthRange.start.getMonth() + 1).padStart(2, '0')}`;
  const endMonth = `${chartMonthRange.end.getFullYear()}-${String(chartMonthRange.end.getMonth() + 1).padStart(2, '0')}`;

  return (
    <>
      <div className="plantation-charts-controls-section">
        <div className="plantation-charts-controls-row">
          <div className="plantation-charts-control-group">
            <span className="plantation-charts-control-label">Month Range:</span>
            <MonthRangePicker
              startMonth={chartMonthRange.start}
              endMonth={chartMonthRange.end}
              onChange={setChartMonthRange}
              maxMonths={6}
            />
          </div>
        </div>
      </div>
      <div className="plantation-charts-section">
        <PlannedVsTeaRevenueChart
          missionType={missionType}
          months={chartMonths}
          startMonth={startMonth}
          endMonth={endMonth}
          basePath={basePath}
          completedPlansOnly={completedPlansOnly}
        />
        <PlannedVsSprayedChart
          missionType={missionType}
          months={chartMonths}
          startMonth={startMonth}
          endMonth={endMonth}
          basePath={basePath}
          completedPlansOnly={completedPlansOnly}
        />
      </div>
    </>
  );
}
