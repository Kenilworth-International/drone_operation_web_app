import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FaSignOutAlt,
  FaChevronDown,
  FaChevronRight,
  FaCloudSunRain,
  FaCalendarAlt,
  FaArrowLeft,
  FaTachometerAlt,
} from 'react-icons/fa';
import navbarCategories from '../config/navbarCategories';
import '../styles/css-navbar.css';
import { useAppDispatch } from '../store/hooks';
import { baseApi } from '../api/services/allEndpoints';
import { logout } from '../store/slices/authSlice';
import { useQueryClient } from '@tanstack/react-query';
import {
  getUserData,
  getNavbarColor,
} from '../utils/authUtils';
import { getGroupLogoBaseUrl } from '../utils/resourceUrls';
import {
  GEO_SPATIAL_DASHBOARD_PATH,
  isCalendarAllowedWing,
  isForecastAllowedWing,
  isGeoSpatialWing,
  normalizeWingTitle,
} from '../config/wingHubDisplay';
import { useNavbarPermissions } from '../hooks/useNavbarPermissions';
import { withCurrentWingSearch } from '../config/wingRouteGuard';
import { useGetFieldUnblockPendingCountQuery } from '../api/services NodeJs/fieldUnblockRequestsApi';
import { useGetPlanActivatePendingCountQuery } from '../api/services NodeJs/planActivateRequestsApi';
import { useGetStrategicFuelVoucherPendingCountQuery } from '../api/services NodeJs/strategicFinanceApprovalsApi';

const categories = navbarCategories;

const LeftNavBar = ({ showSidebar = false, onClose = () => { }, onCollapseChange = () => { } }) => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  // Removed Redux permissions - now using only backend permissions from Access Control Management
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wingTitle = searchParams.get('wing') ? decodeURIComponent(searchParams.get('wing')) : null;
  const normalizedWingTitle = normalizeWingTitle(wingTitle);
  const isIctWing = normalizedWingTitle === 'ICT Wing';
  const showForecastNav = isForecastAllowedWing(normalizedWingTitle);
  const showCalendarNav = isCalendarAllowedWing(normalizedWingTitle);
  const isGeoSpatial = isGeoSpatialWing(normalizedWingTitle);
  const showGeoDashboardFirst = isGeoSpatial;
  /** Keep ?wing= (and employee only between employee pages) on in-app nav links. */
  const withWingSearch = (pathname) => withCurrentWingSearch(pathname, location.search, location.pathname);
  const categoriesToShow = useMemo(() => {
    if (!wingTitle) return categories;
    const normalizedWing =
      wingTitle === 'Management' ? 'Field Operations Wing' : wingTitle;
    return categories.filter((c) => c.title === normalizedWing);
  }, [wingTitle]);
  const [activeLink, setActiveLink] = useState(localStorage.getItem('activeLink') || '/home/create');
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [logoErrorCount, setLogoErrorCount] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState(() => {
    return JSON.parse(localStorage.getItem('leftnav_expanded') || 'null') || {
      'Strategic Planning and Monitoring wing': true,
      'Field Operations Wing': true,
      OpsRoom: true,
      'Operation Digitalization & Digital Monitoring & Evaluation Wing': true,
      Finance: true,
      Inventory: true,
      Workshop: true,
      'Human Resource Management': true,
      'Administration Wing': true,
      'ICT Wing': true,
      'Fleet Management Wing': true,
      'Sales and Marketing Wing': true,
    };
  });
  const [expandedSubItems, setExpandedSubItems] = useState(() => {
    return JSON.parse(localStorage.getItem('leftnav_expanded_subitems') || 'null') || {
      'Finance Approvals': true,
    };
  });

  const userData = getUserData();
  const userType = userData.member_type_name || '';

  const { categoryVisibility, categoryFullAccess, allowedPaths } = useNavbarPermissions();

  const userId = userData?.id ?? userData?.user_id;
  const { data: fieldUnblockPendingPayload } = useGetFieldUnblockPendingCountQuery(undefined, {
    pollingInterval: 120000,
    skip: !userId,
  });
  const fieldUnblockPendingCount = Number(fieldUnblockPendingPayload?.count ?? 0);

  const { data: planActivatePendingPayload } = useGetPlanActivatePendingCountQuery(undefined, {
    pollingInterval: 60000,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    skip: !userId,
  });
  const planActivatePendingCount = Number(planActivatePendingPayload?.count ?? 0);

  const { data: strategicFinancePendingPayload } = useGetStrategicFuelVoucherPendingCountQuery(undefined, {
    pollingInterval: 60000,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    skip: !userId,
  });
  const strategicFinancePendingCount = Number(strategicFinancePendingPayload?.count ?? 0);

  const getNavPendingCount = (item) => {
    if (item?.pendingCountKey === 'fieldUnblock') return fieldUnblockPendingCount;
    if (item?.pendingCountKey === 'planActivate') return planActivatePendingCount;
    if (item?.pendingCountKey === 'strategicFinanceApprovals') return strategicFinancePendingCount;
    return 0;
  };

  let companyLogo = '';
  let navbarColor = '';
  const url = getGroupLogoBaseUrl();
  const rawGroupId = userData?.group ?? userData?.group_id ?? userData?.user_group_id ?? null;
  const normalizedGroupId = Number(rawGroupId);
  const hasValidGroupId = Number.isFinite(normalizedGroupId) && normalizedGroupId > 0;
  const paddedGroupId = hasValidGroupId ? String(normalizedGroupId).padStart(3, '0') : '000';
  companyLogo = `${url}${paddedGroupId}.png`;

  // Fallback flow:
  // 1st failure -> use 000.png
  // 2nd failure -> use a tiny embedded transparent image (avoid broken icon)
  if (logoErrorCount >= 2) {
    companyLogo = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  } else if (logoErrorCount === 1) {
    companyLogo = `${url}000.png`;
  }

  navbarColor = getNavbarColor(userData);

  useEffect(() => {
    setActiveLink(location.pathname);
    localStorage.setItem('activeLink', location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('leftnav_expanded', JSON.stringify(expandedCategories));
  }, [expandedCategories]);

  useEffect(() => {
    localStorage.setItem('leftnav_expanded_subitems', JSON.stringify(expandedSubItems));
  }, [expandedSubItems]);

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleConfirmLogout = () => {
    // Clear RTK Query cache before logout
    dispatch(baseApi.util.resetApiState());
    // Clear React Query cache
    queryClient.clear();
    // Dispatch logout action to clear Redux state
    dispatch(logout());
    // Clear additional localStorage items
    localStorage.removeItem('activeLink');
    localStorage.removeItem('leftnav_expanded');
    // Navigate to login page
    navigate('/login');
    setShowLogoutDialog(false);
  };

  const handleCancelLogout = () => {
    setShowLogoutDialog(false);
  };

  useEffect(() => {
    if (!wingTitle) return;
    const normalizedWing =
      wingTitle === 'Management' ? 'Field Operations Wing' : wingTitle;
    setExpandedCategories((prev) => {
      const next = { ...prev };
      categories.forEach((c) => {
        next[c.title] = c.title === normalizedWing;
      });
      return next;
    });
  }, [wingTitle]);

  useEffect(() => {
    const className = 'wing-theme-ict';
    if (isIctWing) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }
    return () => {
      document.body.classList.remove(className);
    };
  }, [isIctWing]);
  const devCenterPath = '/home/ict/development/dev-center';
  const devCenterAliasPaths = [
    '/home/ict/development/sprints',
    '/home/ict/development/board',
    '/home/ict/development/extra-work',
    '/home/ict/development/metrics',
    '/home/ict/system-admin/app-versions',
  ];

  return (
    <div
      className={`left-nav ${navbarColor} ${showSidebar ? 'show' : 'hide'}`}
    >
      <div className="nav-hub-back">
        <Link
          to="/home"
          className="nav-link nav-hub-back-link"
          title="Back to hub"
        >
          <FaArrowLeft className="nav-icon" />
          <span className="nav-text">Back to hub</span>
        </Link>
      </div>
      <div className="logo">
        <img
          src={companyLogo}
          alt="Logo"
          onError={() => setLogoErrorCount((prev) => prev + 1)}
        />
        {showSidebar && (
          <button className="close-btn" onClick={onClose} aria-label="Close menu">×</button>
        )}
      </div>
      <ul className="nav-list">
        {showGeoDashboardFirst && (
          <li className="nav-item">
            <Link
              to={withWingSearch(GEO_SPATIAL_DASHBOARD_PATH)}
              className={`nav-link ${activeLink === GEO_SPATIAL_DASHBOARD_PATH ? 'active' : ''}`}
              title="Dashboard"
            >
              <FaTachometerAlt className="nav-icon" />
              <span className="nav-text">Dashboard</span>
            </Link>
          </li>
        )}
        {showForecastNav && (
          <li className="nav-item">
            <Link
              to={withWingSearch('/home/create')}
              className={`nav-link ${activeLink === '/home/create' ? 'active' : ''}`}
              title="Forecast"
            >
              <FaCloudSunRain className="nav-icon" />
              <span className="nav-text">Forecast</span>
            </Link>
          </li>
        )}
        {showCalendarNav && (
          <li className="nav-item">
            <Link
              to={withWingSearch('/home/opsroomPlanCalendar')}
              className={`nav-link ${activeLink === '/home/opsroomPlanCalendar' ? 'active' : ''}`}
              title="Calendar"
            >
              <FaCalendarAlt className="nav-icon" />
              <span className="nav-text">Calendar</span>
            </Link>
          </li>
        )}
        {categoriesToShow.map((category) => {
          const showAllCategoryChildren = categoryFullAccess[category.title] === true;
          const visibleChildren = category.children.filter((child) => {
            // When Dashboard is pinned at top for Geo Spatial, hide the duplicate under the wing.
            if (showGeoDashboardFirst && child.path === GEO_SPATIAL_DASHBOARD_PATH) {
              return false;
            }
            if (showAllCategoryChildren) {
              return true;
            }
            if (child.subItems && child.subItems.length > 0) {
              return child.subItems.some((sub) => allowedPaths.includes(sub.path));
            }
            return allowedPaths.includes(child.path);
          });

          // Default to expanded only if category has visible children, otherwise collapsed
          const defaultExpanded = visibleChildren.length > 0;
          const isExpanded = expandedCategories[category.title] ?? defaultExpanded;
          const toggleCategory = () =>
            setExpandedCategories((prev) => ({ ...prev, [category.title]: !isExpanded }));

          // Show category if:
          // 1. Category is developer-only and user is a developer, OR
          // 2. Category has visibility (navbar permission), OR
          // 3. Any child path has permission (path-level permission)
          // This allows categories to show even without category-level permissions
          const isDeveloper = userData?.member_type === 'i' && userData?.user_level === 'i' && userData?.job_role === 'dev';
          const isDeveloperOnlyCategory = category.developerOnly === true;

          // If category is developer-only, only show to developers
          if (isDeveloperOnlyCategory && !isDeveloper) {
            return null;
          }

          const hasCategoryVisibility = categoryVisibility[category.title] === true;
          const hasAnyPathPermission = visibleChildren.length > 0;

          // Don't render category if no visible children and no category visibility
          if (!hasCategoryVisibility && !hasAnyPathPermission) {
            return null;
          }

          return (
            <li key={category.title} className="nav-category">
              {category.path && category.children.length === 0 ? (
                // If category has a direct path and no children, make it a link
                <Link
                  to={withWingSearch(category.path)}
                  className={`nav-category-btn ${activeLink === category.path || activeLink.startsWith(category.path + '/') ? 'active' : ''}`}
                  title={category.title}
                >
                  {category.icon && <category.icon className="nav-category-icon" />}
                  <span className="nav-category-text">{category.title}</span>
                </Link>
              ) : (
                // Otherwise, make it a collapsible button
                <button
                  className={`nav-category-btn ${isExpanded ? 'expanded' : 'collapsed'}`}
                  onClick={toggleCategory}
                  title={category.title}
                  aria-expanded={isExpanded}
                >
                  {category.icon && <category.icon className="nav-category-icon" />}
                  <span className="nav-category-text">{category.title}</span>
                  {/* Always show chevron for categories without direct path, even if no children */}
                  <span className={`nav-category-chevron ${isExpanded ? 'open' : ''}`} aria-hidden="true">
                    {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                </button>
              )}

              {isExpanded && visibleChildren.length > 0 && (
                <ul className="nav-sublist">
                  {visibleChildren.map((item) => {
                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    if (hasSubItems) {
                      const visibleSubItems = showAllCategoryChildren
                        ? item.subItems
                        : item.subItems.filter((sub) => allowedPaths.includes(sub.path));
                      if (visibleSubItems.length === 0) {
                        return null;
                      }
                      const isSubExpanded = expandedSubItems[item.label] ?? true;
                      const toggleSubItem = (e) => {
                        e.stopPropagation();
                        setExpandedSubItems((prev) => ({ ...prev, [item.label]: !isSubExpanded }));
                      };
                      const subPathMatches = (sub) => {
                        if (activeLink === sub.path || activeLink.startsWith(`${sub.path}/`)) return true;
                        if (
                          sub.path === devCenterPath &&
                          (devCenterAliasPaths.includes(activeLink) ||
                            devCenterAliasPaths.some((a) => activeLink.startsWith(`${a}/`)))
                        ) {
                          return true;
                        }
                        return false;
                      };
                      const isSubActive =
                        visibleSubItems.some(subPathMatches) ||
                        (item.path &&
                          (activeLink === item.path || activeLink.startsWith(`${item.path}/`)));
                      return (
                        <li key={`${item.label}`} className={`nav-item nav-subgroup ${isSubActive ? 'active' : ''}`}>
                          <div className="nav-subgroup-header">
                            {item.path ? (
                              <Link
                                to={withWingSearch(item.path)}
                                className="nav-subgroup-link"
                                title={item.label}
                                onClick={() => {
                                  // Auto-expand when navigating to parent item
                                  if (!isSubExpanded) {
                                    setExpandedSubItems((prev) => ({ ...prev, [item.label]: true }));
                                  }
                                }}
                              >
                                <item.icon className="nav-icon" />
                                <span className="nav-text">{item.label}</span>
                              </Link>
                            ) : (
                              <>
                                <item.icon className="nav-icon" />
                                <span className="nav-text">{item.label}</span>
                              </>
                            )}
                            <button
                              className="nav-subgroup-toggle"
                              onClick={toggleSubItem}
                              title={`${isSubExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
                              aria-expanded={isSubExpanded}
                              aria-label={`${isSubExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
                            >
                              <span className={`nav-subgroup-chevron ${isSubExpanded ? 'open' : ''}`} aria-hidden="true">
                                {isSubExpanded ? <FaChevronDown /> : <FaChevronRight />}
                              </span>
                            </button>
                          </div>
                          {isSubExpanded && (
                            <ul className="nav-subgroup-list">
                              {visibleSubItems.map((subItem) => {
                                const isSubPathActive =
                                  activeLink === subItem.path ||
                                  activeLink.startsWith(`${subItem.path}/`) ||
                                  (subItem.path === devCenterPath &&
                                    (devCenterAliasPaths.includes(activeLink) ||
                                      devCenterAliasPaths.some((a) => activeLink.startsWith(`${a}/`))));
                                const isActive = isSubPathActive;
                                return (
                                  <li key={subItem.path} className="nav-item">
                                    <Link
                                      to={withWingSearch(subItem.path)}
                                      className={`nav-link ${isActive ? 'active' : ''}`}
                                      title={subItem.label}
                                    >
                                      <subItem.icon className="nav-icon" />
                                      <span className="nav-text">{subItem.label}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    }
                    const activeAliases = {
                      '/home/workflowDashboard': ['/home/opsroomPlanCalendar', '/home/requestsQueue', '/home/requestProceed', '/home/dayEndProcess', '/home/todayPlans', '/home/emergencyMoving', '/home/fieldHistory', '/home/reports/ops', '/home/fieldSizeAdjustments', '/home/opsAsign'],
                      '/home/monitoringDashboard': [],
                      '/home/dataViewer': ['/home/dataViewer/chart-breakdown'],
                      '/home/ict/development/dev-center': devCenterAliasPaths,
                    };
                    const aliases = activeAliases[item.path] || [];
                    const isActive =
                      activeLink === item.path ||
                      activeLink.startsWith(item.path + '/') ||
                      aliases.includes(activeLink) ||
                      aliases.some((a) => activeLink.startsWith(a + '/'));
                    const navPending = getNavPendingCount(item);
                    return (
                      <li key={item.path} className="nav-item">
                        <Link
                          to={withWingSearch(item.path)}
                          className={`nav-link ${isActive ? 'active' : ''}`}
                          title={item.label}
                        >
                          <item.icon className="nav-icon" />
                          <span className="nav-text">{item.label}</span>
                          {navPending > 0 ? (
                            <span
                              className={`pending-count pending-count--mini${item.pendingCountKey === 'planActivate' ? ' pending-count--activate' : ''}`}
                              title={`${navPending} pending`}
                              aria-label={`${navPending} pending`}
                            >
                              {navPending > 99 ? '99+' : navPending}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
        <li className="nav-item">
          <button
            onClick={handleLogoutClick}
            className={`logout-btn ${activeLink === '/logout' ? 'active' : ''}`}
            title="Logout"
          >
            <FaSignOutAlt className="nav-icon" />
            <span className="nav-text">Logout</span>
          </button>
        </li>
      </ul>

      {showLogoutDialog &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="logout-dialog-overlay" role="presentation">
            <div className="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="left-nav-logout-title">
              <h3 id="left-nav-logout-title">Confirm Logout</h3>
              <p>Are you sure you want to logout?</p>
              <div className="dialog-buttons">
                <button type="button" onClick={handleCancelLogout} className="cancel-btn">
                  Cancel
                </button>
                <button type="button" onClick={handleConfirmLogout} className="confirm-btn">
                  Confirm
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default LeftNavBar;