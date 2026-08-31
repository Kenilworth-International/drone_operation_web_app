import React from 'react';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { FaHome, FaCalendarAlt, FaUser, FaClipboardCheck } from 'react-icons/fa';
import { PlantationSessionProvider, usePlantationSession } from '../hooks/usePlantationSession';
import { Bars } from 'react-loader-spinner';
import '../../../styles/plantationExternalShell.css';

const BASE = '/home/plantation-dashboard';

function PlantationExternalShellInner() {
  const location = useLocation();
  const { isEstateManager, isLoading } = usePlantationSession();

  const isFullBleedRoute =
    location.pathname.includes('/chart-breakdown')
    || location.pathname.includes('/field-availability')
    || location.pathname.includes('/manager/approve/')
    || location.pathname.includes('/manager/edit/');

  if (isLoading) {
    return (
      <div className="plantation-ext-shell plantation-ext-shell--loading">
        <Bars height={36} width={36} color="#2d6a4f" />
        <span>Loading plantation dashboard…</span>
      </div>
    );
  }

  return (
    <div className={`plantation-ext-shell${isFullBleedRoute ? ' plantation-ext-shell--full' : ''}`}>
      <main className="plantation-ext-main">
        <Outlet />
      </main>
      {!isFullBleedRoute ? (
        <nav className="plantation-ext-tabs" aria-label="Plantation navigation">
          <NavLink to={BASE} end className={({ isActive }) => `plantation-ext-tab${isActive ? ' active' : ''}`}>
            <FaHome />
            <span>Home</span>
          </NavLink>
          <NavLink
            to={`${BASE}/calendar`}
            className={({ isActive }) => `plantation-ext-tab${isActive ? ' active' : ''}`}
          >
            <FaCalendarAlt />
            <span>Calendar</span>
          </NavLink>
          {isEstateManager ? (
            <NavLink
              to={`${BASE}/manager`}
              className={({ isActive }) => `plantation-ext-tab${isActive ? ' active' : ''}`}
            >
              <FaClipboardCheck />
              <span>Manager</span>
            </NavLink>
          ) : null}
          <NavLink
            to={`${BASE}/profile`}
            className={({ isActive }) => `plantation-ext-tab${isActive ? ' active' : ''}`}
          >
            <FaUser />
            <span>Profile</span>
          </NavLink>
        </nav>
      ) : null}
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
