import { useMemo } from 'react';
import { useGetMyPermissionsQuery } from '../api/services NodeJs/featurePermissionsApi';
import { getToken } from '../api/services NodeJs/nodeBackendUrl';
import navbarCategories from '../config/navbarCategories';
import { isSessionExpiredError } from '../utils/sessionUtils';
import {
  getAllowedPaths,
  getCategoryFullAccessFromPaths,
  getCategoryVisibility,
  getUserData,
} from '../utils/authUtils';

const categories = navbarCategories;

/**
 * Shared navbar permission resolution (same rules as LeftNavBar).
 */
export function useNavbarPermissions() {
  const userData = getUserData();
  const hasToken = Boolean(getToken());
  const {
    data: backendPermissions = {},
    isLoading: loadingPermissions,
    isError: permissionsError,
    error: permissionsFetchError,
  } = useGetMyPermissionsQuery(undefined, { skip: !hasToken });

  const sessionExpired = useMemo(
    () => permissionsError && isSessionExpiredError(permissionsFetchError),
    [permissionsError, permissionsFetchError]
  );

  const backendPathPermissions = useMemo(() => {
    if (!backendPermissions || Object.keys(backendPermissions).length === 0) {
      return {};
    }
    if (backendPermissions.paths) {
      return backendPermissions.paths;
    }
    return {};
  }, [backendPermissions]);

  const categoryVisibility = getCategoryVisibility(
    userData,
    {},
    categories,
    backendPathPermissions
  );
  const categoryFullAccess = getCategoryFullAccessFromPaths(backendPathPermissions, categories);
  const allowedPaths = getAllowedPaths(categoryVisibility, backendPathPermissions, userData);

  const tokenCreatedAt = backendPermissions?.token_created_at || userData?.token_created_at || null;

  return {
    categories,
    categoryVisibility,
    categoryFullAccess,
    allowedPaths,
    userData,
    tokenCreatedAt,
    loadingPermissions,
    sessionExpired,
    permissionsError,
    permissionsFetchError,
  };
}
