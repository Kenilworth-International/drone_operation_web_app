import { createSlice } from '@reduxjs/toolkit';

export const PERMISSIONS_STORAGE_KEY = 'nav_permissions';

const ALL_ROLES = ['ceo', 'md', 'mgr', 'ops', 'dops', 'fd', 'io', 'wt'];

const createDefaultState = () => ({
  categories: {
    'Strategic Planning and Monitoring wing': ['ceo', 'md', 'mgr', 'dops'],
    'Field Operations Wing': ['md', 'mgr', 'dops'],
    OpsRoom: ['md', 'mgr', 'ops', 'dops'],
    'Operation Digitalization & Digital Monitoring & Evaluation Wing': ['md', 'mgr', 'ops', 'dops'],
    Finance: ['md', 'mgr', 'fd', 'dops'],
    Inventory: ['md', 'io', 'mgr', 'dops'],
    Workshop: ['md', 'wt', 'mgr', 'dops'],
    'Human Resource Management': ['md', 'mgr', 'dops'],
    'Administration Wing': ['md', 'mgr', 'dops'],
    'ICT Wing': ['md', 'dops'],
    'Fleet Management Wing': ['md', 'mgr', 'dops'],
    'Sales and Marketing Wing': ['md', 'mgr', 'dops'],
  },
  roles: ALL_ROLES,
});

const normalizeState = (state) => {
  const fallback = createDefaultState();
  const rawRoles = Array.from(
    new Set([...(state.roles || []), ...fallback.roles].map((role) => role.toLowerCase()))
  );
  const roles = rawRoles.filter((role) => ALL_ROLES.includes(role));

  let mergedCategories = { ...fallback.categories, ...(state.categories || {}) };
  if (mergedCategories['ICT - System Admin']) {
    const legacy = mergedCategories['ICT - System Admin'];
    const merged = [...(mergedCategories['ICT Wing'] || []), ...legacy];
    mergedCategories['ICT Wing'] = Array.from(new Set(merged));
    delete mergedCategories['ICT - System Admin'];
  }

  if (mergedCategories['System Administration']) {
    const legacy = mergedCategories['System Administration'];
    const cur = mergedCategories['ICT Wing'] || [];
    mergedCategories['ICT Wing'] = Array.from(new Set([...cur, ...legacy]));
    delete mergedCategories['System Administration'];
  }
  if (mergedCategories['ICT - Development']) {
    const legacy = mergedCategories['ICT - Development'];
    const cur = mergedCategories['ICT Wing'] || [];
    mergedCategories['ICT Wing'] = Array.from(new Set([...cur, ...legacy]));
    delete mergedCategories['ICT - Development'];
  }

  // Legacy ACL: Corporate + Planning and Monitoring merged into one strategic wing
  if (mergedCategories['Corporate'] || mergedCategories['Planning and Monitoring']) {
    const legacyCorporate = mergedCategories['Corporate'] || [];
    const legacyPlanning = mergedCategories['Planning and Monitoring'] || [];
    const mergedLegacy = [...legacyCorporate, ...legacyPlanning];
    const cur = mergedCategories['Strategic Planning and Monitoring wing'] || [];
    mergedCategories['Strategic Planning and Monitoring wing'] = Array.from(
      new Set([...cur, ...mergedLegacy])
    );
    delete mergedCategories['Corporate'];
    delete mergedCategories['Planning and Monitoring'];
  }

  // Legacy ACL: Management renamed to Field Operations Wing
  if (mergedCategories.Management) {
    const legacy = mergedCategories.Management || [];
    const cur = mergedCategories['Field Operations Wing'] || [];
    mergedCategories['Field Operations Wing'] = Array.from(new Set([...cur, ...legacy]));
    delete mergedCategories.Management;
  }

  // Legacy ACL: Central Operation Management renamed to Operation Digitalization & Digital Monitoring & Evaluation Wing
  if (mergedCategories['Central Operation Management']) {
    const legacy = mergedCategories['Central Operation Management'] || [];
    const cur = mergedCategories['Operation Digitalization & Digital Monitoring & Evaluation Wing'] || [];
    mergedCategories['Operation Digitalization & Digital Monitoring & Evaluation Wing'] = Array.from(
      new Set([...cur, ...legacy])
    );
    delete mergedCategories['Central Operation Management'];
  }

  if (mergedCategories['HR and Admin']) {
    const legacy = mergedCategories['HR and Admin'];
    const hr = mergedCategories['Human Resource Management'] || [];
    const adm = mergedCategories['Administration Wing'] || [];
    mergedCategories['Human Resource Management'] = Array.from(new Set([...hr, ...legacy]));
    mergedCategories['Administration Wing'] = Array.from(new Set([...adm, ...legacy]));
    delete mergedCategories['HR and Admin'];
  }

  const categories = Object.fromEntries(
    Object.entries(mergedCategories).map(([category, values]) => {
      const normalized = Array.from(
        new Set(
          (values || [])
            .map((role) => role.toLowerCase())
            .filter((role) => roles.includes(role))
        )
      );
      return [category, normalized];
    })
  );

  return {
    categories,
    roles,
  };
};

const loadState = () => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return createDefaultState();
  }

  try {
    const serialized = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (!serialized) {
      return createDefaultState();
    }
    const parsed = JSON.parse(serialized);
    return normalizeState(parsed);
  } catch (error) {
    console.warn('Failed to load navigation permissions:', error);
    return createDefaultState();
  }
};

const permissionsSlice = createSlice({
  name: 'permissions',
  initialState: loadState(),
  reducers: {
    togglePermission: (state, action) => {
      const { category, role } = action.payload;
      const normalizedRole = String(role || '').toLowerCase();

      if (!normalizedRole) {
        return;
      }

      if (!state.categories[category]) {
        state.categories[category] = [];
      }

      const current = state.categories[category];
      const exists = current.includes(normalizedRole);

      state.categories[category] = exists
        ? current.filter((item) => item !== normalizedRole)
        : [...current, normalizedRole];
    },
    setCategoryRoles: (state, action) => {
      const { category, roles } = action.payload;
      state.categories[category] = Array.from(
        new Set((roles || []).map((role) => String(role).toLowerCase()))
      );
    },
    resetPermissions: () => createDefaultState(),
  },
});

export const { togglePermission, setCategoryRoles, resetPermissions } = permissionsSlice.actions;
export default permissionsSlice.reducer;

