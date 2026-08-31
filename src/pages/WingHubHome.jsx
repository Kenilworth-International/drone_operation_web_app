import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FaUserCircle } from 'react-icons/fa';
import { useAppDispatch } from '../store/hooks';
import { baseApi } from '../api/services/allEndpoints';
import { logout } from '../store/slices/authSlice';
import { useGetUserJobRolesQuery } from '../api/services NodeJs/jdManagementApi';
import { useNavbarPermissions } from '../hooks/useNavbarPermissions';
import {
  WING_HUB_META,
  isForecastAllowedWing,
} from '../config/wingHubDisplay';
import { OD_WING_OPERATION_DIGITALIZATION_TITLE } from '../config/odWingShell';
import { isInternalDeveloper } from '../utils/authUtils';
import { ensureHttps } from '../utils/urlUtils';
import { getGroupLogoBaseUrl } from '../utils/resourceUrls';
import { redirectToLogin } from '../utils/sessionUtils';
import '../styles/wingHub.css';
import TargetCursor from '../components/TargetCursor';

const LOGO_SRC = `${process.env.PUBLIC_URL}/assets/images/kenilowrth-white.png`;
const BEE_SRC = `${process.env.PUBLIC_URL}/assets/images/bee.png`;
const LOGOUT_ICON_SRC = `${process.env.PUBLIC_URL}/assets/images/logout.png`;
const FALLBACK_AVATAR =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

/** Same rules as LeftNavBar: which navbar rows under this wing resolve to at least one allowed path. */
function getVisibleNavChildren(category, allowedPaths) {
  return category.children.filter((child) => {
    if (child.subItems && child.subItems.length > 0) {
      return child.subItems.some((sub) => allowedPaths.includes(sub.path));
    }
    return allowedPaths.includes(child.path);
  });
}

function resolveJobRoleLabel(userData, jobRoles = []) {
  const code = String(userData?.job_role || '').trim();
  if (!code) return '';
  const match = jobRoles.find(
    (role) =>
      String(role?.jdCode || '').trim().toLowerCase() === code.toLowerCase() ||
      String(role?.id) === code
  );
  return match?.designation || code;
}

function formatLastLoggedIn(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveGroupLogoSrc(userData, logoErrorCount) {
  const groupLogoBase = getGroupLogoBaseUrl();
  const rawGroupId = userData?.group ?? userData?.group_id ?? userData?.user_group_id ?? null;
  const normalizedGroupId = Number(rawGroupId);
  const hasValidGroupId = Number.isFinite(normalizedGroupId) && normalizedGroupId > 0;
  const paddedGroupId = hasValidGroupId ? String(normalizedGroupId).padStart(3, '0') : '000';
  if (logoErrorCount >= 2) return FALLBACK_AVATAR;
  if (logoErrorCount === 1) return `${groupLogoBase}000.png`;
  return `${groupLogoBase}${paddedGroupId}.png`;
}

/**
 * Post-login landing: wing tiles (main nav categories).
 * SPMW / FOW open Forecast; ODDME opens Workflow Dashboard; other wings open first allowed nav item.
 */
const WingHubHome = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [avatarStage, setAvatarStage] = useState('profile');
  const {
    categories,
    categoryVisibility,
    allowedPaths,
    userData,
    tokenCreatedAt,
    loadingPermissions,
    sessionExpired,
  } = useNavbarPermissions();
  const { data: userJobRolesData } = useGetUserJobRolesQuery(undefined, { skip: !userData?.id });
  const userJobRoles = userJobRolesData?.data || [];

  const userDisplayName = String(userData?.name || '').trim() || 'User';
  const userJobRoleLabel = resolveJobRoleLabel(userData, userJobRoles);
  const lastLoggedInLabel = formatLastLoggedIn(tokenCreatedAt || userData?.token_created_at);
  const userProfileImage = userData?.image ? ensureHttps(userData.image) : null;
  const groupLogoSrc = resolveGroupLogoSrc(userData, 0);
  const groupLogoFallbackSrc = resolveGroupLogoSrc(userData, 1);

  useEffect(() => {
    setAvatarStage(userProfileImage ? 'profile' : 'group');
  }, [userProfileImage, userData?.id]);

  useEffect(() => {
    if (!sessionExpired) return undefined;
    redirectToLogin('session_expired', dispatch);
    return undefined;
  }, [sessionExpired, dispatch]);

  const handleConfirmLogout = () => {
    dispatch(baseApi.util.resetApiState());
    queryClient.clear();
    dispatch(logout());
    localStorage.removeItem('activeLink');
    localStorage.removeItem('leftnav_expanded');
    navigate('/login');
    setShowLogoutDialog(false);
  };

  const isDeveloper = isInternalDeveloper(userData);
  const visibleWings = useMemo(() => {
    // Show all wing tiles on /home. Only hide developer-only entries for non-developers.
    return categories.filter((category) => !(category.developerOnly === true && !isDeveloper));
  }, [categories, isDeveloper]);

  const orderedWings = useMemo(() => {
    return [...visibleWings].sort((a, b) => {
      const aVisibleChildren = getVisibleNavChildren(a, allowedPaths);
      const bVisibleChildren = getVisibleNavChildren(b, allowedPaths);
      const aHasCategoryVisibility = categoryVisibility[a.title] === true;
      const bHasCategoryVisibility = categoryVisibility[b.title] === true;
      const aLocked = !isDeveloper && !aHasCategoryVisibility && aVisibleChildren.length === 0;
      const bLocked = !isDeveloper && !bHasCategoryVisibility && bVisibleChildren.length === 0;
      if (aLocked === bLocked) return 0;
      return aLocked ? 1 : -1;
    });
  }, [visibleWings, allowedPaths, categoryVisibility, isDeveloper]);

  const handleWingClick = (title) => {
    const q = encodeURIComponent(title);
    if (title === OD_WING_OPERATION_DIGITALIZATION_TITLE) {
      navigate(`/home/workflowDashboard?wing=${q}`);
      return;
    }
    if (title === 'Geo Spatial Management') {
      navigate(`/home/geo-spatial/dashboard?wing=${q}`);
      return;
    }
    if (title === 'Human Resource Management') {
      navigate(`/home/hrm/dashboard?wing=${q}`);
      return;
    }
    if (isForecastAllowedWing(title)) {
      navigate(`/home/create?wing=${q}`);
      return;
    }
    const category = categories.find((c) => c.title === title);
    const visible = category ? getVisibleNavChildren(category, allowedPaths) : [];
    const firstChild = visible[0];
    const firstPath =
      firstChild?.subItems?.find((sub) => allowedPaths.includes(sub.path))?.path ||
      (firstChild?.path && allowedPaths.includes(firstChild.path) ? firstChild.path : null) ||
      firstChild?.subItems?.[0]?.path ||
      firstChild?.path;
    if (firstPath) {
      navigate({ pathname: firstPath, search: `?wing=${q}` });
      return;
    }
    navigate(`/home?wing=${q}`);
  };

  return (
    <div className="wing-hub">
      <TargetCursor spinDuration={2} hideDefaultCursor parallaxOn hoverDuration={0.2} />
      <header className="wing-hub-header">
        <div className="wing-hub-header-inner">
          <div className="wing-hub-header-left">
            <img className="wing-hub-brand-logo" src={LOGO_SRC} alt="Kenilworth International" />
          </div>

          <div className="wing-hub-header-center">
            <div
              className="wing-hub-user-identity"
              title={`${userDisplayName}${userJobRoleLabel ? ` · ${userJobRoleLabel}` : ''}`}
            >
              <div className="wing-hub-user-avatar" aria-hidden>
                {avatarStage === 'profile' && userProfileImage ? (
                  <img
                    className="wing-hub-user-avatar-img"
                    src={userProfileImage}
                    alt=""
                    onError={() => setAvatarStage('group')}
                  />
                ) : avatarStage === 'fallback' ? (
                  <FaUserCircle className="wing-hub-user-avatar-fallback wing-hub-user-avatar-fallback--header" />
                ) : (
                  <img
                    className="wing-hub-user-avatar-img"
                    src={avatarStage === 'group-fallback' ? groupLogoFallbackSrc : groupLogoSrc}
                    alt=""
                    onError={() => setAvatarStage((prev) => (prev === 'group' ? 'group-fallback' : 'fallback'))}
                  />
                )}
              </div>
              <div className="wing-hub-user-text">
                <span className="wing-hub-user-name wing-hub-user-name--header">{userDisplayName}</span>
                {userJobRoleLabel ? (
                  <span className="wing-hub-user-role wing-hub-user-role--header">{userJobRoleLabel}</span>
                ) : null}
                {lastLoggedInLabel ? (
                  <span className="wing-hub-user-last-login wing-hub-user-last-login--header">
                    Logged in at: {lastLoggedInLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="wing-hub-header-actions">
            <button
              type="button"
              className="wing-hub-comb-card wing-hub-comb-card--action cursor-target"
              onClick={() => navigate('/home/monitoringDashboard?comb=1')}
              title="Central Operations Management Base"
            >
              <img className="wing-hub-bee" src={BEE_SRC} alt="" />
              <div className="wing-hub-comb-text">
                <span className="wing-hub-comb-title">COMB</span>
                <span className="wing-hub-comb-sub">Central Operations Management Base</span>
              </div>
            </button>
            <button
              type="button"
              className="wing-hub-logout-btn cursor-target"
              onClick={() => setShowLogoutDialog(true)}
              title="Logout"
              aria-label="Logout"
            >
              <img src={LOGOUT_ICON_SRC} alt="" width={28} height={28} />
            </button>
          </div>
        </div>
      </header>

      {showLogoutDialog && (
        <div className="wing-hub-logout-overlay" role="presentation">
          <div className="wing-hub-logout-dialog" role="dialog" aria-modal="true" aria-labelledby="wing-hub-logout-title">
            <h3 id="wing-hub-logout-title">Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="wing-hub-logout-dialog-buttons">
              <button type="button" onClick={() => setShowLogoutDialog(false)} className="wing-hub-logout-cancel">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmLogout} className="wing-hub-logout-confirm">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="wing-hub-body">
        {sessionExpired ? (
          <div className="wing-hub-session-expired" role="alert">
            <p className="wing-hub-session-expired-title">Session expired</p>
            <p className="wing-hub-session-expired-message">
              Your session has expired. Redirecting to login…
            </p>
          </div>
        ) : loadingPermissions ? (
          <p className="wing-hub-loading">Loading access…</p>
        ) : visibleWings.length === 0 ? (
          <p className="wing-hub-empty">No wings available for your account.</p>
        ) : (
          <>
            <div className="wing-hub-grid">
              {orderedWings.map((cat) => {
                const WingIcon = cat.icon;
                const meta = WING_HUB_META[cat.title] || {
                  abbr: cat.title.slice(0, 4).toUpperCase(),
                  label: cat.title,
                  color: '#334155',
                };
                const visibleNavChildren = getVisibleNavChildren(cat, allowedPaths);
                const hasCategoryVisibility = categoryVisibility[cat.title] === true;
                const isNavLocked = !isDeveloper && !hasCategoryVisibility && visibleNavChildren.length === 0;
                const cardClassName = [
                  'wing-hub-card',
                  !isNavLocked ? 'cursor-target' : '',
                  isNavLocked ? 'wing-hub-card--no-nav-access' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div key={cat.title} className="wing-hub-card-wrap">
                    {isNavLocked ? (
                      <div
                        className={cardClassName}
                        style={{ background: meta.color }}
                        role="group"
                        aria-label={`${meta.label}: no navigation access`}
                        title="No navigation items assigned for this wing"
                      >
                        <span className="wing-hub-card-icon" aria-hidden>
                          {WingIcon ? <WingIcon /> : null}
                        </span>
                        <span className="wing-hub-card-text">
                          <span className="wing-hub-card-label">{meta.label}</span>
                          <span className="wing-hub-card-abbr">({meta.abbr})</span>
                        </span>
                        <span className="wing-hub-card-no-access-bar">No navigation access</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={cardClassName}
                        style={{ background: meta.color }}
                        onClick={() => handleWingClick(cat.title)}
                      >
                        <span className="wing-hub-card-icon" aria-hidden>
                          {WingIcon ? <WingIcon /> : null}
                        </span>
                        <span className="wing-hub-card-text">
                          <span className="wing-hub-card-label">{meta.label}</span>
                          <span className="wing-hub-card-abbr">({meta.abbr})</span>
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WingHubHome;
