import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useGetPlantationSessionContextQuery } from '../../../api/services NodeJs/plantationDashboardApi';

const PlantationSessionContext = createContext(null);

export function PlantationSessionProvider({ children }) {
  const { data, isLoading, isFetching, error, refetch } = useGetPlantationSessionContextQuery();

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const value = useMemo(
    () => ({
      session: data || null,
      hierarchy: data?.hierarchy || null,
      hierarchyLevel: data?.hierarchyLevel || 'none',
      jobRoleCode: data?.jobRoleCode || '',
      isEstateManager: Boolean(data?.isEstateManager),
      canRequestPlans: Boolean(data?.canRequestPlans),
      isLoading,
      isFetching,
      error,
      refresh,
    }),
    [data, isLoading, isFetching, error, refresh]
  );

  return (
    <PlantationSessionContext.Provider value={value}>
      {children}
    </PlantationSessionContext.Provider>
  );
}

export function usePlantationSession() {
  const ctx = useContext(PlantationSessionContext);
  if (!ctx) {
    throw new Error('usePlantationSession must be used within PlantationSessionProvider');
  }
  return ctx;
}

export default PlantationSessionContext;
