import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useGetGroupedPermissionsQuery,
  useGetFeatureDefinitionsQuery,
  useGetJobRolesQuery,
  useBulkUpdateCategoryPermissionsMutation,
  useUpsertFeaturePermissionMutation,
  useSyncNavbarPathsMutation,
  useGetFeaturePermissionsQuery,
} from '../../../api/services NodeJs/featurePermissionsApi';
import { baseApi } from '../../../api/baseApi';
import { useAppDispatch } from '../../../store/hooks';
import navbarCategoriesRaw from '../../../config/navbarCategories';
import FeatureUserAccessPanel, { FeatureParentPathSelect } from './FeatureUserAccessPanel';
import SystemRolesPanel from './SystemRolesPanel';
import '../../../styles/authControls.css';

const navbarCategories = navbarCategoriesRaw.map((cat) => {
  const uniqueByPath = new Map();
  (cat.children || []).forEach((child) => {
    if (child?.path && child?.label && !uniqueByPath.has(child.path)) {
      uniqueByPath.set(child.path, { path: child.path, label: child.label });
    }
    (child.subItems || []).forEach((sub) => {
      if (sub?.path && sub?.label && !uniqueByPath.has(sub.path)) {
        uniqueByPath.set(sub.path, { path: sub.path, label: sub.label });
      }
    });
  });
  return {
    title: cat.title,
    children: Array.from(uniqueByPath.values()),
  };
});

const AuthControls = () => {
  const dispatch = useAppDispatch();
  const [permissions, setPermissions] = useState({});
  const [pathPermissions, setPathPermissions] = useState({});
  const [activeTab, setActiveTab] = useState('navbar'); // 'navbar' | 'features' | 'system-roles'
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedFeatures, setExpandedFeatures] = useState({});
  const [syncPopup, setSyncPopup] = useState(null); // { type: 'success'|'error', title, message, stats? }

  // Fetch data from backend
  const {
    data: groupedPermissions = {},
    isLoading: loadingPermissions,
    refetch: refetchGroupedPermissions,
  } = useGetGroupedPermissionsQuery();
  const {
    data: navbarDefinitions = [],
    isLoading: loadingNavbar,
    refetch: refetchNavbarDefinitions,
  } = useGetFeatureDefinitionsQuery({ feature_type: 'navbar' });
  const {
    data: pathDefinitions = [],
    isLoading: loadingPaths,
    refetch: refetchPathDefinitions,
  } = useGetFeatureDefinitionsQuery({ feature_type: 'path' });
  const {
    data: featureDefinitions = [],
    isLoading: loadingFeatures,
    refetch: refetchFeatureDefinitions,
  } = useGetFeatureDefinitionsQuery({ feature_type: 'feature' });
  // Backend API already filters to only return internal job roles (userMemberTypeId = internal member type)
  // See: dsms_backend/src/services/featurePermissionService.js getJobRoles()
  const {
    data: jobRoles = [],
    isLoading: loadingRoles,
    refetch: refetchJobRoles,
  } = useGetJobRolesQuery();
  const [bulkUpdatePermissions, { isLoading: updating }] = useBulkUpdateCategoryPermissionsMutation();
  const [upsertPermission] = useUpsertFeaturePermissionMutation();
  const [syncNavbarPaths, { isLoading: syncing }] = useSyncNavbarPathsMutation();

  // Fetch individual path permissions (navbar tab)
  const {
    data: allPathPermissions = [],
    isLoading: loadingPathPerms,
    refetch: refetchPathPermissions,
  } = useGetFeaturePermissionsQuery({ feature_type: 'path' });

  const refreshNavbarTab = useCallback(() => {
    dispatch(
      baseApi.util.invalidateTags([
        'GroupedPermissions',
        'FeaturePermissions',
        'FeatureDefinitions',
        'JobRoles',
      ])
    );
    refetchGroupedPermissions();
    refetchNavbarDefinitions();
    refetchPathDefinitions();
    refetchPathPermissions();
    refetchJobRoles();
  }, [
    dispatch,
    refetchGroupedPermissions,
    refetchNavbarDefinitions,
    refetchPathDefinitions,
    refetchPathPermissions,
    refetchJobRoles,
  ]);

  const refreshFeaturesTab = useCallback(() => {
    dispatch(
      baseApi.util.invalidateTags([
        'FeatureDefinitions',
        'JobRoles',
        'FeatureEligibleUsers',
        'UserFeaturePermissions',
        'MyPermissions',
      ])
    );
    refetchFeatureDefinitions();
    refetchJobRoles();
  }, [dispatch, refetchFeatureDefinitions, refetchJobRoles]);

  const refreshSystemRolesTab = useCallback(() => {
    dispatch(
      baseApi.util.invalidateTags(['UserJobRoles', 'UserLevels', 'UserMemberTypes', 'JobRoles'])
    );
  }, [dispatch]);

  const handleTabChange = useCallback(
    (tab) => {
      if (tab === activeTab) {
        if (tab === 'navbar') refreshNavbarTab();
        else if (tab === 'features') refreshFeaturesTab();
        else refreshSystemRolesTab();
        return;
      }
      setActiveTab(tab);
      if (tab === 'navbar') refreshNavbarTab();
      else if (tab === 'features') refreshFeaturesTab();
      else refreshSystemRolesTab();
    },
    [activeTab, refreshNavbarTab, refreshFeaturesTab, refreshSystemRolesTab]
  );

  // Combine loading states
  useEffect(() => {
    setLoading(loadingPermissions || loadingNavbar || loadingPaths || loadingFeatures || loadingRoles || loadingPathPerms);
  }, [loadingPermissions, loadingNavbar, loadingPaths, loadingFeatures, loadingRoles, loadingPathPerms]);

  // Initialize expanded categories
  useEffect(() => {
    if (!loading && navbarCategories.length > 0) {
      const expanded = {};
      navbarCategories.forEach(cat => {
        expanded[cat.title] = true;
      });
      setExpandedCategories(expanded);
    }
  }, [loading]);

  // Process navbar category permissions
  useEffect(() => {
    if (!loading && navbarDefinitions.length > 0 && jobRoles.length > 0) {
      const processed = {};
      
      // Initialize all categories with all job roles set to false
      navbarDefinitions.forEach(feature => {
        const category = feature.category || 'Other';
        if (!processed[category]) {
          processed[category] = {};
          jobRoles.forEach(role => {
            processed[category][role.id] = false;
          });
        }
      });

      // Set permissions from backend data
      Object.keys(groupedPermissions).forEach(category => {
        if (!processed[category]) {
          processed[category] = {};
          jobRoles.forEach(role => {
            processed[category][role.id] = false;
          });
        }
        
        Object.keys(groupedPermissions[category]).forEach(jobRoleCode => {
          const jobRole = jobRoles.find(r => r.jdCode === jobRoleCode);
          if (jobRole) {
            processed[category][jobRole.id] = true;
          }
        });
      });

      setPermissions(processed);
    }
  }, [groupedPermissions, navbarDefinitions, jobRoles, loading]);

  // Process path permissions
  useEffect(() => {
    if (!loading && pathDefinitions.length > 0 && jobRoles.length > 0) {
      // Merge with existing state to preserve optimistic updates
      setPathPermissions(prev => {
        const processed = { ...prev };
        
        // Initialize all paths with all job roles set to false (only if not already in state)
        pathDefinitions.forEach(feature => {
          const path = feature.path;
          if (path && !processed[path]) {
            processed[path] = {};
            jobRoles.forEach(role => {
              processed[path][role.id] = false;
            });
          }
        });

        // Update permissions from backend data (this will overwrite with fresh data from server)
        allPathPermissions.forEach(perm => {
          if (perm.path) {
            if (!processed[perm.path]) {
              processed[perm.path] = {};
            }
            processed[perm.path][perm.job_role_id] = perm.is_active === 1;
          }
        });

        return processed;
      });
    }
  }, [allPathPermissions, pathDefinitions, jobRoles, loading]);

  // Get unique categories from navbar definitions
  const categories = useMemo(() => {
    const cats = new Set();
    navbarDefinitions.forEach(f => {
      if (f.category) {
        cats.add(f.category);
      }
    });
    return Array.from(cats).sort();
  }, [navbarDefinitions]);

  // Get features grouped by category
  const featuresByCategory = useMemo(() => {
    const grouped = {};
    // Only process features with feature_type === 'feature'
    const actualFeatures = featureDefinitions.filter(f => f.feature_type === 'feature');
    
    actualFeatures.forEach(f => {
      const category = f.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(f);
    });
    
    // Sort features within each category by name
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => a.feature_name.localeCompare(b.feature_name));
    });
    
    // Debug: log features found
    if (actualFeatures.length > 0) {
      console.log('[AuthControls] Features found:', actualFeatures.length, 'Grouped by category:', Object.keys(grouped));
    } else {
      console.log('[AuthControls] No features found. Total featureDefinitions:', featureDefinitions.length);
    }
    
    return grouped;
  }, [featureDefinitions]);

  const featureParentPathOptions = useMemo(() => {
    const fromDefs = (pathDefinitions || [])
      .filter((p) => p.path && Number(p.is_active) !== 0)
      .map((p) => ({
        path: p.path,
        label: p.feature_name || p.path,
      }));
    const fromNav = navbarCategories.flatMap((cat) =>
      (cat.children || []).map((c) => ({ path: c.path, label: c.label }))
    );
    const map = new Map();
    [...fromNav, ...fromDefs].forEach((row) => {
      if (row.path && !map.has(row.path)) map.set(row.path, row);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [pathDefinitions]);

  // Create job role map for display
  // Exclude 'dev' role from being managed in auth-controls
  const jobRoleMap = useMemo(() => {
    const map = {};
    jobRoles.forEach(role => {
      // Skip dev role - developers unlock all features automatically and shouldn't be managed here
      if (role.jdCode && role.jdCode.toLowerCase() === 'dev') {
        return;
      }
      map[role.id] = {
        id: role.id,
        code: role.jdCode,
        name: role.designation,
      };
    });
    return map;
  }, [jobRoles]);

  // Filter categories based on search (for navbar tab)
  const filteredCategories = useMemo(() => {
    if (!searchTerm || activeTab !== 'navbar') return navbarCategories;
    const term = searchTerm.toLowerCase();
    return navbarCategories.filter(cat => {
      const matchesCategory = cat.title.toLowerCase().includes(term);
      const matchesChildren = cat.children.some(child => 
        child.label.toLowerCase().includes(term) || child.path.toLowerCase().includes(term)
      );
      return matchesCategory || matchesChildren;
    });
  }, [searchTerm, activeTab]);

  // Filter feature categories based on search (for features tab)
  const filteredFeatureCategories = useMemo(() => {
    if (!searchTerm || activeTab !== 'features') return Object.keys(featuresByCategory);
    const term = searchTerm.toLowerCase();
    return Object.keys(featuresByCategory).filter(category => {
      const matchesCategory = category.toLowerCase().includes(term);
      const matchesFeatures = featuresByCategory[category].some(feature => 
        feature.feature_name.toLowerCase().includes(term) || 
        feature.feature_code.toLowerCase().includes(term) ||
        (feature.description && feature.description.toLowerCase().includes(term))
      );
      return matchesCategory || matchesFeatures;
    });
  }, [searchTerm, activeTab, featuresByCategory]);

  const handleCategoryToggle = async (category, jobRoleId) => {
    // Find all paths in this category from navbarCategories (not filteredCategories to avoid search filter issues)
    const categoryData = navbarCategories.find(cat => cat.title === category);
    const categoryPaths = categoryData?.children || [];

    // Calculate current state: check if ALL paths are currently checked
    const allPathsCurrentlyChecked = categoryPaths.length > 0 && 
      categoryPaths.every(child => {
        const pathPerm = pathPermissions[child.path] || {};
        return pathPerm[jobRoleId] === true;
      });
    
    // New value: if all are checked, uncheck all; otherwise, check all
    const newValue = !allPathsCurrentlyChecked;

    // Optimistically update all individual path permissions in the UI
    setPathPermissions(prev => {
      const updated = { ...prev };
      categoryPaths.forEach(child => {
        if (!updated[child.path]) {
          updated[child.path] = {};
        }
        updated[child.path] = {
          ...updated[child.path],
          [jobRoleId]: newValue,
        };
      });
      return updated;
    });

    try {
      // Update all individual path permissions (no category-level permission update needed)
      const pathUpdatePromises = categoryPaths.map(child => {
        const pathDef = pathDefinitions.find(p => p.path === child.path);
        let featureCode = pathDef?.feature_code;
        
        if (!featureCode) {
          // Generate feature code from path - remove leading slashes and replace non-alphanumeric with single underscore
          const cleanPath = child.path.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toUpperCase();
          featureCode = `PATH_${cleanPath}`;
        }

        return upsertPermission({
          feature_code: featureCode,
          job_role_id: jobRoleId,
          permission_type: 'read',
          is_active: newValue ? 1 : 0,
          path: child.path, // Send path so backend can create definition if needed
          category: category, // Send category so backend can set it
          feature_name: child.label, // Send label as feature name
        }).unwrap();
      });

      const navbarDeactivationPromises = !newValue
        ? navbarDefinitions
            .filter((feature) => (feature.category || 'Other') === category)
            .map((feature) =>
              upsertPermission({
                feature_code: feature.feature_code,
                job_role_id: jobRoleId,
                permission_type: 'read',
                is_active: 0,
                category,
                feature_name: feature.feature_name,
              }).unwrap()
            )
        : [];

      await Promise.all([...pathUpdatePromises, ...navbarDeactivationPromises]);
      // Mutation already invalidates tags, so RTK Query will automatically refetch
    } catch (error) {
      console.error('Error updating permissions:', error);
      // Revert path permissions on error
      setPathPermissions(prev => {
        const updated = { ...prev };
        categoryPaths.forEach(child => {
          if (updated[child.path]) {
            updated[child.path] = {
              ...updated[child.path],
              [jobRoleId]: allPathsCurrentlyChecked, // Revert to previous state
            };
          }
        });
        return updated;
      });
      alert('Failed to update permissions. Please try again.');
    }
  };

  const handlePathToggle = async (path, jobRoleId) => {
    const currentValue = pathPermissions[path]?.[jobRoleId] || false;
    const newValue = !currentValue;

    // Find the category and label for this path
    let category = null;
    let label = path.split('/').pop() || 'Path';
    
    // Find which category this path belongs to
    for (const cat of navbarCategories) {
      const child = cat.children.find(c => c.path === path);
      if (child) {
        category = cat.title;
        label = child.label;
        break;
      }
    }

    // Optimistically update UI
    setPathPermissions(prev => ({
      ...prev,
      [path]: {
        ...prev[path],
        [jobRoleId]: newValue,
      },
    }));

    try {
      // Find or create feature code for this path
      const pathDef = pathDefinitions.find(p => p.path === path);
      let featureCode = pathDef?.feature_code;
      
      if (!featureCode) {
        // Generate feature code from path - remove leading slashes and replace non-alphanumeric with single underscore
        const cleanPath = path.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toUpperCase();
        featureCode = `PATH_${cleanPath}`;
      }

      await upsertPermission({
        feature_code: featureCode,
        job_role_id: jobRoleId,
        permission_type: 'read',
        is_active: newValue ? 1 : 0,
        path: path, // Send path so backend can create definition if needed
        category: category, // Send category so backend can set it
        feature_name: label, // Send label as feature name
      }).unwrap();
      // Mutation already invalidates tags, so RTK Query will automatically refetch
    } catch (error) {
      console.error('Error updating path permission:', error);
      // Revert on error
      setPathPermissions(prev => ({
        ...prev,
        [path]: {
          ...prev[path],
          [jobRoleId]: currentValue,
        },
      }));
      alert('Failed to update path permission. Please try again.');
    }
  };

  const toggleFeatureExpansion = (featureCode) => {
    setExpandedFeatures((prev) => ({
      ...prev,
      [featureCode]: !prev[featureCode],
    }));
  };

  const toggleCategoryExpansion = (categoryTitle) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryTitle]: !prev[categoryTitle],
    }));
  };

  const validNavbarItems = useMemo(() => {
    return navbarCategories.flatMap((cat) => (cat.children || []).map((child) => ({
      path: child.path,
      label: child.label,
      category: cat.title,
    }))).filter((row) => row.path);
  }, []);

  const handleSyncNavbarPaths = async () => {
    try {
      const result = await syncNavbarPaths(validNavbarItems).unwrap();
      const added = Number(result?.added_definitions || 0);
      const updated = Number(result?.updated_definitions || 0);
      const removed = Number(result?.deactivated_definitions || 0);
      const permsRemoved = Number(result?.deactivated_permissions || 0);
      setSyncPopup({
        type: 'success',
        title: 'Sync complete',
        message: 'Navbar path definitions were synced with Access Control.',
        stats: {
          added,
          updated,
          removed,
          permsRemoved,
        },
      });
    } catch (err) {
      setSyncPopup({
        type: 'error',
        title: 'Sync failed',
        message: err?.data?.error || err?.message || 'Sync failed. Please try again.',
      });
    }
  };

  if (loading) {
    return (
      <div className="auth-controls-page">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p>Loading permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-controls-page">
      <header className="auth-controls-header">
        <div>
          <h1>Access Control Management</h1>
          <p>Manage which job roles can access navigation sections and specific features.</p>
        </div>
        {activeTab === 'navbar' ? (
          <button
            type="button"
            className="auth-controls-sync-btn"
            onClick={handleSyncNavbarPaths}
            disabled={syncing || updating}
            title="Sync new, updated, and removed navbar items with auth controls"
          >
            {syncing ? 'Syncing...' : 'Sync Navbar Items'}
          </button>
        ) : null}
      </header>

      {/* Tab Navigation */}
      <div className="auth-controls-tabs">
        <button
          type="button"
          onClick={() => handleTabChange('navbar')}
          className={`auth-controls-tab ${activeTab === 'navbar' ? 'active' : ''}`}
        >
          Navigation Bar
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('features')}
          className={`auth-controls-tab ${activeTab === 'features' ? 'active' : ''}`}
        >
          Features
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('system-roles')}
          className={`auth-controls-tab ${activeTab === 'system-roles' ? 'active' : ''}`}
        >
          System roles
        </button>
      </div>

      {/* Search Bar */}
      <div className="auth-controls-search">
        <input
          type="text"
          placeholder={
            activeTab === 'navbar'
              ? 'Search categories or paths...'
              : activeTab === 'features'
                ? 'Search categories or features...'
                : 'Search roles, levels, or member types...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="auth-controls-search-input"
        />
      </div>

      {activeTab === 'navbar' ? (
        <div className="auth-controls-legend">
          <h2>Job Roles</h2>
          <ul>
            {Object.values(jobRoleMap).map((role) => (
              <li key={role.id}>
                <span className="legend-code">{role.code?.toUpperCase() || 'N/A'}</span>
                <span className="legend-description">{role.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : activeTab === 'features' ? (
        <div className="auth-controls-legend">
          <h2>Features (user grants)</h2>
          <p className="auth-controls-legend-note">
            Grant button-level access to individual users. Only users whose roles can open the feature parent
            navbar path are listed. Role alone no longer unlocks FEAT_* codes.
          </p>
        </div>
      ) : (
        <div className="auth-controls-legend">
          <h2>System roles</h2>
          <p className="auth-controls-legend-note">
            Add or update job roles, user levels, and member types. Delete is not available from this screen.
          </p>
        </div>
      )}

      {activeTab === 'navbar' ? (
        <div className="auth-controls-navbar">
          {filteredCategories.map((category) => {
            const isExpanded = expandedCategories[category.title] ?? true;
            const categoryPermission = permissions[category.title] || {};
            
            return (
              <div key={category.title} className="auth-controls-category-group">
                <div 
                  className="auth-controls-category-header"
                  onClick={() => toggleCategoryExpansion(category.title)}
                >
                  <span className="auth-controls-category-title">{category.title}</span>
                  <span className="auth-controls-expand-icon">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>
                
                {isExpanded && (
                  <div className="auth-controls-category-content">
                    {/* Column headers for job roles */}
                    <div className="auth-controls-row-header">
                      <div className="auth-controls-row-label-header"></div>
                      <div className="auth-controls-row-checkboxes-header ictacx-row-checkboxes-header">
                        {Object.values(jobRoleMap).map((role) => (
                          <div key={role.id} className="auth-controls-checkbox-header ictacx-checkbox-header" title={role.name}>
                            <span className="auth-controls-checkbox-code">{role.code?.toUpperCase() || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Category-level checkbox row */}
                    <div className="auth-controls-category-row">
                      <div className="auth-controls-row-label">
                        <strong>Entire Category</strong>
                        <span className="auth-controls-row-hint">(Toggle all items in this category)</span>
                      </div>
                      <div className="auth-controls-row-checkboxes">
                        {Object.values(jobRoleMap).map((role) => {
                          // Calculate if "Entire Category" should be checked based on ALL paths being checked
                          const allPathsChecked = category.children.length > 0 && 
                            category.children.every(child => {
                              const pathPerm = pathPermissions[child.path] || {};
                              return pathPerm[role.id] === true;
                            });
                          return (
                            <label key={role.id} className="auth-controls-checkbox" title={`${role.name} (${role.code?.toUpperCase()}) - ${category.title}`}>
                              <input
                                type="checkbox"
                                checked={allPathsChecked}
                                onChange={() => handleCategoryToggle(category.title, role.id)}
                                disabled={updating}
                                aria-label={`${role.name} access to ${category.title}`}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Individual path rows */}
                    {category.children.map((child) => {
                      const pathPerm = pathPermissions[child.path] || {};
                      return (
                        <div key={child.path} className="auth-controls-path-row">
                          <div className="auth-controls-row-label">
                            <span className="auth-controls-path-icon">→</span>
                            <span>{child.label}</span>
                            <span className="auth-controls-path-path">{child.path}</span>
                          </div>
                          <div className="auth-controls-row-checkboxes">
                            {Object.values(jobRoleMap).map((role) => {
                              const isChecked = pathPerm[role.id] || false;
                              return (
                                <label key={role.id} className="auth-controls-checkbox" title={`${role.name} (${role.code?.toUpperCase()}) - ${child.label}`}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handlePathToggle(child.path, role.id)}
                                    disabled={updating}
                                    aria-label={`${role.name} access to ${child.label}`}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : activeTab === 'features' ? (
        <div className="auth-controls-features">
          {filteredFeatureCategories.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p>No features found. {searchTerm && 'Try adjusting your search.'}</p>
            </div>
          ) : (
            filteredFeatureCategories.map((category) => {
              const isExpanded = expandedCategories[category] ?? true;
              const categoryFeatures = featuresByCategory[category] || [];
              if (categoryFeatures.length === 0) return null;

              return (
                <div key={category} className="auth-controls-category-group">
                  <div
                    className="auth-controls-category-header"
                    onClick={() => toggleCategoryExpansion(category)}
                  >
                    <span className="auth-controls-category-title">{category}</span>
                    <span className="auth-controls-expand-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="auth-controls-category-content auth-controls-features-content">
                      {categoryFeatures.map((feature) => {
                        const featExpanded = expandedFeatures[feature.feature_code] ?? false;
                        return (
                          <div
                            key={feature.feature_code}
                            className={`auth-controls-feature-card${featExpanded ? ' is-expanded' : ''}`}
                          >
                            <div className="auth-controls-feature-card-header">
                              <div
                                className="auth-controls-feature-card-header-toggle"
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleFeatureExpansion(feature.feature_code)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleFeatureExpansion(feature.feature_code);
                                  }
                                }}
                              >
                                <div className="auth-controls-feature-card-main">
                                  <div className="auth-controls-feature-card-title">
                                    <strong>{feature.feature_name}</strong>
                                    <code className="auth-controls-feature-code">{feature.feature_code}</code>
                                  </div>
                                  {feature.description ? (
                                    <p className="auth-controls-feature-desc">{feature.description}</p>
                                  ) : null}
                                </div>
                              </div>
                              <div className="auth-controls-feature-card-actions">
                                <FeatureParentPathSelect
                                  feature={feature}
                                  pathOptions={featureParentPathOptions}
                                  updating={updating}
                                />
                                <button
                                  type="button"
                                  className="auth-controls-feature-card-header-chevron"
                                  onClick={() => toggleFeatureExpansion(feature.feature_code)}
                                  aria-expanded={featExpanded}
                                  aria-label={featExpanded ? 'Collapse feature' : 'Expand feature'}
                                >
                                  <span className="auth-controls-expand-icon">
                                    {featExpanded ? '▼' : '▶'}
                                  </span>
                                </button>
                              </div>
                            </div>
                            {featExpanded && (
                              <FeatureUserAccessPanel
                                feature={feature}
                                updating={updating}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <SystemRolesPanel searchTerm={searchTerm} />
      )}

      {updating && (
        <div className="auth-controls-updating">
          <p>Updating permissions...</p>
        </div>
      )}

      {syncPopup && (
        <div
          className="auth-controls-sync-overlay"
          onClick={() => setSyncPopup(null)}
          role="presentation"
        >
          <div
            className={`auth-controls-sync-modal auth-controls-sync-modal--${syncPopup.type}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-controls-sync-title"
          >
            <div className="auth-controls-sync-modal-header">
              <h2 id="auth-controls-sync-title">{syncPopup.title}</h2>
              <button
                type="button"
                className="auth-controls-sync-modal-close"
                onClick={() => setSyncPopup(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="auth-controls-sync-modal-body">
              <p>{syncPopup.message}</p>
              {syncPopup.stats && (
                <ul className="auth-controls-sync-stats">
                  <li>
                    <span>Added</span>
                    <strong>{syncPopup.stats.added}</strong>
                  </li>
                  <li>
                    <span>Updated</span>
                    <strong>{syncPopup.stats.updated}</strong>
                  </li>
                  <li>
                    <span>Removed paths</span>
                    <strong>{syncPopup.stats.removed}</strong>
                  </li>
                  <li>
                    <span>Permissions deactivated</span>
                    <strong>{syncPopup.stats.permsRemoved}</strong>
                  </li>
                </ul>
              )}
            </div>
            <div className="auth-controls-sync-modal-footer">
              <button
                type="button"
                className="auth-controls-sync-modal-ok"
                onClick={() => setSyncPopup(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthControls;
