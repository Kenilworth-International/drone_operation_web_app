import React, { useCallback, useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { withCurrentWingSearch } from '../../config/wingRouteGuard';
import { AdminStockPage, AdminSubTabs } from './shell/AdminStockShell';
import AssetTransfer from './AssetTransfer';
import AssetRequest from './AssetRequest';

const TABS = [
  { key: 'transfer', label: 'Asset Transfer', path: '/home/stock-assets/transfers/transfer' },
  { key: 'request', label: 'Asset Request', path: '/home/stock-assets/transfers/request' },
];

function detectTab(pathname) {
  if (pathname.includes('/request') || pathname.includes('asset-request')) return 'request';
  return 'transfer';
}

export default function MovementHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = useMemo(() => detectTab(location.pathname), [location.pathname]);

  const onTabChange = useCallback(
    (key) => {
      const tab = TABS.find((t) => t.key === key) || TABS[0];
      navigate(withCurrentWingSearch(tab.path, location.search, location.pathname));
    },
    [navigate, location.search, location.pathname],
  );

  if (
    location.pathname === '/home/stock-assets/transfers'
    || location.pathname === '/home/stock-assets/transfers/'
  ) {
    return (
      <Navigate
        to={withCurrentWingSearch('/home/stock-assets/transfers/transfer', location.search, location.pathname)}
        replace
      />
    );
  }

  return (
    <AdminStockPage>
      <AdminSubTabs tabs={TABS} active={active} onChange={onTabChange} />
      {active === 'request' ? <AssetRequest embedded /> : <AssetTransfer embedded />}
    </AdminStockPage>
  );
}
