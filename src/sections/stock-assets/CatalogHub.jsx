import React, { useCallback, useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { withCurrentWingSearch } from '../../config/wingRouteGuard';
import { AdminStockPage, AdminSubTabs } from './shell/AdminStockShell';
import SupplierRegistration from './SupplierRegistration';
import InventoryItemsRegistration from './InventoryItemsRegistration';

const TABS = [
  { key: 'suppliers', label: 'Suppliers', path: '/home/stock-assets/catalog/suppliers' },
  { key: 'inventory', label: 'Inventory Items', path: '/home/stock-assets/catalog/inventory' },
];

function detectTab(pathname) {
  if (pathname.includes('/inventory') || pathname.includes('inventory-items-registration')) {
    return 'inventory';
  }
  return 'suppliers';
}

export default function CatalogHub() {
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
    location.pathname === '/home/stock-assets/catalog'
    || location.pathname === '/home/stock-assets/catalog/'
  ) {
    return (
      <Navigate
        to={withCurrentWingSearch('/home/stock-assets/catalog/suppliers', location.search, location.pathname)}
        replace
      />
    );
  }

  return (
    <AdminStockPage>
      <AdminSubTabs tabs={TABS} active={active} onChange={onTabChange} />
      {active === 'inventory' ? (
        <InventoryItemsRegistration embedded />
      ) : (
        <SupplierRegistration embedded />
      )}
    </AdminStockPage>
  );
}
