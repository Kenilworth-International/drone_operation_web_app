import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const OpsReportWorkspaceContext = createContext(null);

export function OpsReportWorkspaceProvider({ children }) {
  const [sidebar, setSidebarState] = useState(null);

  const setSidebar = useCallback((node) => {
    setSidebarState(node);
  }, []);

  const clearSidebar = useCallback(() => {
    setSidebarState(null);
  }, []);

  const value = useMemo(
    () => ({ sidebar, setSidebar, clearSidebar }),
    [sidebar, setSidebar, clearSidebar]
  );

  return (
    <OpsReportWorkspaceContext.Provider value={value}>
      {children}
    </OpsReportWorkspaceContext.Provider>
  );
}

export function useOpsReportWorkspace() {
  return useContext(OpsReportWorkspaceContext);
}
