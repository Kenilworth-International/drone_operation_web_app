import React, { useState, useMemo, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import LeftNavBar from '../components/LeftNavBar';
import CombChrome from '../components/CombChrome';
import OdWingChrome from '../components/OdWingChrome';
import {
  OD_WING_OPERATION_DIGITALIZATION_TITLE,
  isOdWingWorkflowShellPath,
} from '../config/odWingShell';
import { normalizeWingTitle, resolveWingNavTheme } from '../config/wingHubDisplay';
import { sanitizeSearchForPath } from '../config/wingRouteGuard';
import { getUserData } from '../utils/authUtils';
import RequireWingQueryParam from '../components/RequireWingQueryParam';
import '../styles/home.css';
import '../styles/ict-liquid-glass.css';

const COMB_TAB_BASES = ['/home/monitoringDashboard', '/home/dataViewer', '/home/dashboard'];

const HomePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(false);
  const userData = getUserData();
  const wingTheme = resolveWingNavTheme(new URLSearchParams(location.search).get('wing'));
  const isIctWingFromQuery = normalizeWingTitle(new URLSearchParams(location.search).get('wing')) === 'ICT Wing';
  const isExternalUser = userData?.member_type === 'e';
  const isWingHubLanding = location.pathname === '/home';

  /** Internal dashboard chart drill-down: full width, no left nav (same route family as /home/dashboard). */
  const isDashboardChartBreakdownRoute =
    location.pathname === '/home/dashboard/chart-breakdown' ||
    location.pathname.startsWith('/home/dashboard/chart-breakdown/');

  const isCombShell = useMemo(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('comb') !== '1') return false;
    const { pathname } = location;
    return COMB_TAB_BASES.some((base) => pathname === base || pathname.startsWith(`${base}/`));
  }, [location]);

  const showCombChrome = isCombShell;

  const isOdWingShell = useMemo(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('wing') !== OD_WING_OPERATION_DIGITALIZATION_TITLE) return false;
    return isOdWingWorkflowShellPath(location.pathname);
  }, [location]);

  const showOdWingChrome = isOdWingShell;

  const fullWidthNoLeftNav =
    isWingHubLanding || showCombChrome || isDashboardChartBreakdownRoute || isOdWingShell;

  /** Master Data Update: fixed main column; left/right scroll vertically only (no page scroll). */
  const isMasterDataUpdateRoute = location.pathname.includes('/ict/system-admin/master-data-update');

  /** Corporate Customer: header fixed; table body scrolls with sticky column headers. */
  const isCorporateCustomersRoute =
    location.pathname === '/home/corporate-customers' ||
    location.pathname.endsWith('/corporate-customers');

  /** HRM dashboard: scrollable overview page. */
  const isHrmDashboardRoute = location.pathname.includes('/hrm/dashboard');

  /** HRM employee profile / directory: fill viewport; scroll sidebar + tab body only. */
  const isEmployeeProfileRoute = useMemo(() => {
    const { pathname } = location;
    return pathname.includes('/employeeRegistration')
      || pathname.includes('/employeeProfileDetails')
      || pathname.includes('/employees');
  }, [location]);

  /** Geo Spatial weather: fixed location panel; scroll forecast panel only. */
  const isWeatherPredictionRoute = location.pathname.includes('/geo-spatial/weather-prediction');

  /** Mapping Update: fixed chrome; scroll hierarchy/field card grid only. */
  const isMappingUpdateRoute = location.pathname.includes('/geo-spatial/mapping-update');

  /** External plantation portal: full viewport, no build footer. */
  const isPlantationExternalRoute = useMemo(() => {
    const { pathname } = location;
    return pathname === '/home/plantation-dashboard'
      || pathname.startsWith('/home/plantation-dashboard/');
  }, [location]);

  // Helper to detect mobile view
  const isMobile = () => window.innerWidth <= 768;

  useEffect(() => {
    const sanitizedSearch = sanitizeSearchForPath(location.pathname, location.search);
    if (sanitizedSearch === (location.search || '')) return;
    navigate({ pathname: location.pathname, search: sanitizedSearch }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // Listen for window resize to auto-close sidebar on desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (!isMobile()) setShowSidebar(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const buildEnv = process.env.REACT_APP_ENV || 'unknown';
  const buildTime = process.env.REACT_APP_BUILD_TIME || 'unknown';
  const buildSha = process.env.REACT_APP_GIT_SHA || 'unknown';
  const buildLabel = `${buildEnv} | ${buildTime} | ${buildSha}`;

  return (
    <div
      className={`${wingTheme ? 'home-layout-root home-layout-root--wing-theme' : 'home-layout-root'}${isIctWingFromQuery ? ' home-layout-root--ict-wing' : ''}`}
      style={wingTheme ? {
        '--wing-nav-primary': wingTheme.color,
        '--ict-wing-bg-url': `url("${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg")`,
      } : {
        '--ict-wing-bg-url': `url("${process.env.PUBLIC_URL || ''}/assets/images/bg.jpg")`,
      }}
    >
      {!isExternalUser && <TopNavBar onMenuClick={() => setShowSidebar(true)} />}
      {!isExternalUser && !fullWidthNoLeftNav && (
        <LeftNavBar 
          showSidebar={showSidebar} 
          onClose={() => setShowSidebar(false)}
          onCollapseChange={() => {}}
        />
      )}
      <div 
        className={`content-dashboard${isWingHubLanding ? ' content-dashboard--wing-hub' : ''}${showCombChrome || isDashboardChartBreakdownRoute || isOdWingShell ? ' content-dashboard--comb' : ''}${isMasterDataUpdateRoute ? ' content-dashboard--master-data-split' : ''}${isCorporateCustomersRoute ? ' content-dashboard--corporate-customers' : ''}${isEmployeeProfileRoute ? ' content-dashboard--employee-profile' : ''}${isHrmDashboardRoute ? ' content-dashboard--hrm-dashboard' : ''}${isWeatherPredictionRoute ? ' content-dashboard--weather-prediction' : ''}${isMappingUpdateRoute ? ' content-dashboard--mapping-update' : ''}${isPlantationExternalRoute ? ' content-dashboard--plantation-external' : ''}`}
        style={{
          marginLeft: isExternalUser || fullWidthNoLeftNav ? '0' : '280px',
          width: isExternalUser || fullWidthNoLeftNav ? '100vw' : 'calc(100vw - 280px)',
          transition: 'margin-left 200ms ease, width 200ms ease'
        }}
      >
        {showCombChrome && <CombChrome />}
        {showOdWingChrome && <OdWingChrome />}
        <RequireWingQueryParam>
          <Outlet />
        </RequireWingQueryParam>
      </div>
      {!isPlantationExternalRoute ? (
        <div className="build-info-footer" title={buildLabel}>
          Build: {buildLabel}
          {' · '}
          <Link to="/docs" className="build-info-footer__docs-link">
            API Docs
          </Link>
        </div>
      ) : null}
    </div>
  );
};

export default HomePage;
