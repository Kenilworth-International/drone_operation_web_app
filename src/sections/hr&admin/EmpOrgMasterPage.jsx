import React, { useEffect } from 'react';
import EmpOrgMasterPanel from './empOrg/EmpOrgMasterPanel';
import '../../styles/organizationStructure.css';

export default function EmpOrgMasterPage() {
  useEffect(() => {
    const root = document.querySelector('.content-dashboard');
    root?.classList.add('content-dashboard--organization-structure');
    return () => root?.classList.remove('content-dashboard--organization-structure');
  }, []);

  return (
    <div className="org-shell org-shell--master">
      <EmpOrgMasterPanel />
    </div>
  );
}
