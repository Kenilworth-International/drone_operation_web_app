import { useMemo } from 'react';
import { useGetMyPermissionsQuery } from '../api/services NodeJs/featurePermissionsApi';
import navbarCategories from '../config/navbarCategories';
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
  const { data: backendPermissions = {}, isLoading: loadingPermissions } = useGetMyPermissionsQuery(
    undefined,
    { skip: !userData?.id }
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

  return {
    categories,
    categoryVisibility,
    categoryFullAccess,
    allowedPaths,
    userData,
    loadingPermissions,
  };
}
