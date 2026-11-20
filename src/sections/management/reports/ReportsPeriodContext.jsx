import React, { createContext, useContext } from 'react';

/** Shared period from ReportsDecisionShell for child report components. */
export const ReportsPeriodContext = createContext(null);

export function useReportsPeriod() {
  return useContext(ReportsPeriodContext);
}

/**
 * Sync local date state from shell period when present.
 * Call inside report components that still keep their own pickers.
 */
export function useSyncShellPeriod(setStartDate, setEndDate) {
  const period = useReportsPeriod();
  React.useEffect(() => {
    if (!period?.startDate || !period?.endDate) return;
    setStartDate?.(period.startDate);
    setEndDate?.(period.endDate);
  }, [period?.startYmd, period?.endYmd, setStartDate, setEndDate]);
  return period;
}

/**
 * Sync a [start, end] dateRange tuple from shell period.
 */
export function useSyncShellDateRange(setDateRange) {
  const period = useReportsPeriod();
  React.useEffect(() => {
    if (!period?.startDate || !period?.endDate) return;
    setDateRange?.([period.startDate, period.endDate]);
  }, [period?.startYmd, period?.endYmd, setDateRange]);
  return period;
}
