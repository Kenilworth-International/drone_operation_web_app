import React, { useCallback, useMemo } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { withCurrentWingSearch } from '../../config/wingRouteGuard';
import {
  ASSET_REQUEST_PATH,
  ASSET_TRANSFER_PATH,
  isAssetTransferAllowedWing,
  normalizeWingTitle,
} from '../../config/wingHubDisplay';
import { AdminStockPage, AdminSubTabs } from './shell/AdminStockShell';
import AssetTransfer from './AssetTransfer';
import AssetRequest from './AssetRequest';

const ALL_TABS = [
  { key: 'transfer', label: 'Asset Transfer', path: ASSET_TRANSFER_PATH },
  { key: 'request', label: 'Asset Request', path: ASSET_REQUEST_PATH },
];

function detectTab(pathname) {
  if (pathname.includes('/request') || pathname.includes('asset-request')) return 'request';
  return 'transfer';
}

export default function MovementHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wingTitle = searchParams.get('wing') ? decodeURIComponent(searchParams.get('wing')) : null;
  const allowTransfer = isAssetTransferAllowedWing(normalizeWingTitle(wingTitle));

  const tabs = useMemo(
    () => (allowTransfer ? ALL_TABS : ALL_TABS.filter((t) => t.key === 'request')),
    [allowTransfer],
  );

  const active = useMemo(() => {
    const tab = detectTab(location.pathname);
    if (!allowTransfer && tab === 'transfer') return 'request';
    return tab;
  }, [location.pathname, allowTransfer]);

  const onTabChange = useCallback(
    (key) => {
      const tab = tabs.find((t) => t.key === key) || tabs[0];
      navigate(withCurrentWingSearch(tab.path, location.search, location.pathname));
    },
    [navigate, location.search, location.pathname, tabs],
  );

  const defaultPath = allowTransfer ? ASSET_TRANSFER_PATH : ASSET_REQUEST_PATH;

  if (
    location.pathname === '/home/stock-assets/transfers'
    || location.pathname === '/home/stock-assets/transfers/'
  ) {
    return (
      <Navigate
        to={withCurrentWingSearch(defaultPath, location.search, location.pathname)}
        replace
      />
    );
  }

  if (!allowTransfer && detectTab(location.pathname) === 'transfer') {
    return (
      <Navigate
        to={withCurrentWingSearch(ASSET_REQUEST_PATH, location.search, location.pathname)}
        replace
      />
    );
  }

  return (
    <AdminStockPage>
      {tabs.length > 1 ? (
        <AdminSubTabs tabs={tabs} active={active} onChange={onTabChange} />
      ) : null}
      {active === 'request' ? <AssetRequest embedded /> : <AssetTransfer embedded />}
    </AdminStockPage>
  );
}
