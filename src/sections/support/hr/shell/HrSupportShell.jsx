import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FaHome,
  FaClock,
  FaCalendarAlt,
  FaBullseye,
  FaCheckCircle,
  FaUsers,
  FaUser,
} from 'react-icons/fa';
import { useHrSupportAuth } from '../auth/HrSupportAuthProvider';
import '../../../../styles/hrSupportShell.css';

const BASE = '/support/hr';

const TAB_META = {
  home: { label: 'Home', subtitle: 'Dashboard & overview', icon: FaHome },
  attendance: { label: 'Attendance', subtitle: 'Mark in / out & log', icon: FaClock },
  leave: { label: 'Request', subtitle: 'Apply leave, late stay & RO approvals', icon: FaCalendarAlt },
  goals: { label: 'Goals', subtitle: 'SMART KPI targets', icon: FaBullseye },
  task: { label: 'Task', subtitle: 'HOD leave & late departure', icon: FaCheckCircle },
  'hr-admin': { label: 'HR Admin', subtitle: 'Organization & staff', icon: FaUsers },
  profile: { label: 'Profile', subtitle: 'Account & settings', icon: FaUser },
};

function resolveTabKey(pathname) {
  const segment = pathname.replace(`${BASE}/`, '').split('/')[0] || 'home';
  return TAB_META[segment] ? segment : 'home';
}

export default function HrSupportShell({
  canAccessHodTab,
  canAccessHrManagement,
  canApproveLeaves,
  profile,
  hodApprovals,
  reportingApprovals,
}) {
  const location = useLocation();
  const { logout } = useHrSupportAuth();
  const displayName = profile?.employeeName || profile?.name || 'Employee';
  const initial = displayName.charAt(0).toUpperCase();
  const role = profile?.jobRole || profile?.designation || 'Employee';

  const activeKey = resolveTabKey(location.pathname);
  const activeMeta = TAB_META[activeKey] || TAB_META.home;
  const ActiveIcon = activeMeta.icon;

  const navItems = useMemo(() => [
    { key: 'home', to: `${BASE}/home`, end: true, ...TAB_META.home },
    { key: 'attendance', to: `${BASE}/attendance`, ...TAB_META.attendance },
    {
      key: 'leave',
      to: `${BASE}/leave`,
      badge: canApproveLeaves && (reportingApprovals?.length || 0) > 0 ? reportingApprovals.length : 0,
      ...TAB_META.leave,
    },
    { key: 'goals', to: `${BASE}/goals`, ...TAB_META.goals },
    ...(canAccessHodTab ? [{ key: 'task', to: `${BASE}/task`, badge: hodApprovals?.length || 0, ...TAB_META.task }] : []),
    ...(canAccessHrManagement ? [{ key: 'hr-admin', to: `${BASE}/hr-admin`, ...TAB_META['hr-admin'] }] : []),
    { key: 'profile', to: `${BASE}/profile`, ...TAB_META.profile },
  ], [canAccessHodTab, canAccessHrManagement, canApproveLeaves, hodApprovals?.length, reportingApprovals?.length]);

  return (
    <div className="hrsup-shell">
      <aside className="hrsup-sidebar" aria-label="HR navigation">
        <div className="hrsup-brand">
          <div className="hrsup-brand-icon">HR</div>
          <div>
            <span className="hrsup-brand-title">DSMS HR</span>
            <span className="hrsup-brand-sub">Employee self-service</span>
          </div>
        </div>

        <nav className="hrsup-nav">
          {navItems.map(({ key, to, end, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `hrsup-nav-link${isActive ? ' hrsup-nav-link--active' : ''}`}
            >
              <span className="hrsup-nav-icon" aria-hidden="true"><Icon /></span>
              <span className="hrsup-nav-label">{label}</span>
              {badge > 0 && <span className="hrsup-nav-badge">{badge > 9 ? '9+' : badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="hrsup-sidebar-footer">
          <div className="hrsup-sidebar-user">
            <div className="hrsup-sidebar-avatar">{initial}</div>
            <div className="hrsup-sidebar-user-meta">
              <span className="hrsup-sidebar-user-name">{displayName}</span>
              <span className="hrsup-sidebar-user-role">{role}</span>
            </div>
          </div>
          <button type="button" className="hrsup-sidebar-signout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="hrsup-body">
        <header className="hrsup-topbar">
          <div className="hrsup-topbar-left">
            <div className="hrsup-topbar-brand-icon">HR</div>
            <div>
              <span className="hrsup-topbar-title">DSMS HR</span>
              <span className="hrsup-topbar-sub">{activeMeta.label}</span>
            </div>
          </div>
          <div className="hrsup-topbar-user">
            <div className="hrsup-topbar-avatar">{initial}</div>
            <span className="hrsup-topbar-name">{displayName}</span>
          </div>
        </header>

        <header className="hrsup-desktop-header">
          <div className="hrsup-desktop-header-icon" aria-hidden="true">
            <ActiveIcon />
          </div>
          <div>
            <h1 className="hrsup-desktop-header-title">{activeMeta.label}</h1>
            <p className="hrsup-desktop-header-sub">{activeMeta.subtitle}</p>
          </div>
        </header>

        <main className="hrsup-main">
          <div className="hrsup-outlet">
            <div className="hrsup-page">
              <Outlet />
            </div>
          </div>
        </main>

        <nav className="hrsup-tabs-wrap" aria-label="HR navigation">
          <div className="hrsup-tabs">
            {navItems.map(({ to, end, icon: Icon, label, badge }) => (
              <NavLink
                key={`tab-${to}`}
                to={to}
                end={end}
                className={({ isActive }) => `hrsup-tab${isActive ? ' hrsup-tab--active' : ''}`}
              >
                <span className="hrsup-tab-inner">
                  <span className="hrsup-tab-icon-wrap">
                    <span className="hrsup-tab-icon" aria-hidden="true"><Icon /></span>
                    {badge > 0 && (
                      <span className="hrsup-tab-badge">{badge > 9 ? '9+' : badge}</span>
                    )}
                  </span>
                  <span className="hrsup-tab-label">{label}</span>
                </span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
