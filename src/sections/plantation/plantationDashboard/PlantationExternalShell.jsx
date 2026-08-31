import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaUser, FaClipboardCheck, FaLeaf } from 'react-icons/fa';
import { PlantationSessionProvider, usePlantationSession } from '../hooks/usePlantationSession';
import { getUserData } from '../../../utils/authUtils';
import { Bars } from 'react-loader-spinner';
import '../../../styles/plantationExternalShell.css';

const BASE = '/home/plantation-dashboard';

const NAV_ITEMS = [
  { to: BASE, end: true, icon: FaHome, label: 'Home' },
  { to: `${BASE}/calendar`, icon: FaCalendarAlt, label: 'Calendar' },
  { to: `${BASE}/manager`, icon: FaClipboardCheck, label: 'Manager', managerOnly: true },
  { to: `${BASE}/profile`, icon: FaUser, label: 'Profile' },
];

function PlantationExternalShellInner() {
  const location = useLocation();
  const userData = getUserData();
  const { isEstateManager, isLoading, jobRoleCode, hierarchyLevel } = usePlantationSession();

  const isFullBleedRoute =
    location.pathname.includes('/chart-breakdown')
    || location.pathname.includes('/field-availability')
    || location.pathname.includes('/manager/approve/')
    || location.pathname.includes('/manager/edit/');

  const displayName = userData?.name || userData?.username || 'User';
  const userInitial = displayName.charAt(0).toUpperCase();

  const scopeLabel = useMemo(() => {
    const code = jobRoleCode ? String(jobRoleCode).toUpperCase() : '';
    const level = hierarchyLevel && hierarchyLevel !== 'none' ? hierarchyLevel : '';
    if (code && level) return `${code} · ${level}`;
    return code || level || 'Plantation user';
  }, [jobRoleCode, hierarchyLevel]);

  const navItems = NAV_ITEMS.filter((item) => !item.managerOnly || isEstateManager);

  if (isLoading) {
    return (
      <div className="plantation-ext-shell plantation-ext-shell--loading">
        <Bars height={36} width={36} color="#1b5e40" />
        <span>Loading plantation dashboard…</span>
      </div>
    );
  }

  return (
    <div className={`plantation-ext-shell${isFullBleedRoute ? ' plantation-ext-shell--full' : ''}`}>
      {!isFullBleedRoute ? (
        <aside className="plantation-ext-sidebar" aria-label="Plantation navigation">
          <div className="plantation-ext-brand">
            <span className="plantation-ext-brand-icon" aria-hidden="true">
              <FaLeaf />
            </span>
            <div className="plantation-ext-brand-text">
              <span className="plantation-ext-brand-title">Plantation</span>
              <span className="plantation-ext-brand-sub">Operations portal</span>
            </div>
          </div>
          <nav className="plantation-ext-nav">
            {navItems.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `plantation-ext-nav-link${isActive ? ' plantation-ext-nav-link--active' : ''}`
                }
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="plantation-ext-sidebar-user">
            <span className="plantation-ext-sidebar-avatar" aria-hidden="true">{userInitial}</span>
            <div className="plantation-ext-sidebar-user-meta">
              <span className="plantation-ext-sidebar-user-name">{displayName}</span>
              <span className="plantation-ext-sidebar-user-role">{scopeLabel}</span>
            </div>
          </div>
        </aside>
      ) : null}

      <div className="plantation-ext-body">
        {!isFullBleedRoute ? (
          <header className="plantation-ext-topbar">
            <div className="plantation-ext-topbar-brand">
              <FaLeaf aria-hidden="true" />
              <span>Plantation</span>
            </div>
            <div className="plantation-ext-topbar-user">
              <span className="plantation-ext-topbar-avatar" aria-hidden="true">{userInitial}</span>
              <div>
                <span className="plantation-ext-topbar-name">{displayName}</span>
                <span className="plantation-ext-topbar-role">{scopeLabel}</span>
              </div>
            </div>
          </header>
        ) : null}

        <main className="plantation-ext-main">
          <div className="plantation-ext-outlet">
            <Outlet />
          </div>
        </main>

        {!isFullBleedRoute ? (
          <nav className="plantation-ext-tabs" aria-label="Plantation navigation">
            {navItems.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={`mobile-${to}`}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `plantation-ext-tab${isActive ? ' plantation-ext-tab--active' : ''}`
                }
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

export default function PlantationExternalShell() {
  return (
    <PlantationSessionProvider>
      <PlantationExternalShellInner />
    </PlantationSessionProvider>
  );
}

export function PlantationLegacyRedirect({ to }) {
  return <Navigate to={to} replace />;
}
