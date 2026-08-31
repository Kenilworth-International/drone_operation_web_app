import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaTrashAlt } from 'react-icons/fa';
import { useAppDispatch } from '../../../../store/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../../../../store/slices/authSlice';
import { baseApi } from '../../../../api/services/allEndpoints';
import {
  useGetDisplayGroupsQuery,
  useGetAllPlantationsQuery,
  useGetAllEstatesQuery,
} from '../../../../api/services/estatesApi';
import { useGetUserJobRolesQuery } from '../../../../api/services NodeJs/jdManagementApi';
import { useDeactivateAccountMutation } from '../../../../api/services NodeJs/accountApi';
import { usePlantationSession } from '../../hooks/usePlantationSession';
import { getUserData } from '../../../../utils/authUtils';
import '../../../../styles/plantationDashboard.css';

export default function PlantationProfileTab() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const userData = getUserData();
  const { session, refresh, isFetching } = usePlantationSession();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deactivate, { isLoading: deactivating }] = useDeactivateAccountMutation();

  const { data: groupsData } = useGetDisplayGroupsQuery();
  const { data: plantationsData } = useGetAllPlantationsQuery();
  const { data: estatesData } = useGetAllEstatesQuery();
  const { data: jobRolesData } = useGetUserJobRolesQuery();

  const groups = Array.isArray(groupsData?.data) ? groupsData.data : (Array.isArray(groupsData) ? groupsData : []);
  const plantations = Array.isArray(plantationsData?.data) ? plantationsData.data : (Array.isArray(plantationsData) ? plantationsData : []);
  const estates = Array.isArray(estatesData?.data) ? estatesData.data : (Array.isArray(estatesData) ? estatesData : []);
  const jobRoles = Array.isArray(jobRolesData?.data) ? jobRolesData.data : (Array.isArray(jobRolesData) ? jobRolesData : []);

  const regions = useMemo(() => {
    const regionMap = new Map();
    estates.forEach((estate) => {
      if (estate.region && !regionMap.has(estate.region)) {
        regionMap.set(estate.region, { id: estate.region, name: estate.region_name || `Region ${estate.region}` });
      }
    });
    return Array.from(regionMap.values());
  }, [estates]);

  const hierarchyLabels = useMemo(() => {
    const h = session?.hierarchy || {};
    const group = h.group ? groups.find((g) => g.id === parseInt(h.group, 10)) : null;
    const plantation = h.plantation ? plantations.find((p) => p.id === parseInt(h.plantation, 10)) : null;
    const region = h.region ? regions.find((r) => r.id === parseInt(h.region, 10)) : null;
    const estate = h.estate ? estates.find((e) => e.id === parseInt(h.estate, 10)) : null;
    let jobRole = null;
    if (userData?.job_role) {
      const jobRoleId = parseInt(userData.job_role, 10);
      if (!Number.isNaN(jobRoleId)) jobRole = jobRoles.find((jr) => jr.id === jobRoleId);
      if (!jobRole) jobRole = jobRoles.find((jr) => jr.jdCode === userData.job_role);
    }
    return {
      designation: jobRole?.designation || '—',
      group: group?.name || group?.group || '—',
      plantation: plantation?.name || plantation?.plantation || '—',
      region: region?.name || '—',
      estate: estate?.name || estate?.estate || '—',
    };
  }, [session, groups, plantations, regions, estates, jobRoles, userData]);

  const handleLogout = () => {
    dispatch(baseApi.util.resetApiState());
    queryClient.clear();
    dispatch(logout());
    localStorage.removeItem('activeLink');
    localStorage.removeItem('leftnav_expanded');
    navigate('/login');
  };

  const handleDeactivate = async () => {
    try {
      await deactivate().unwrap();
      handleLogout();
    } catch (err) {
      window.alert(err?.data?.message || 'Could not deactivate account.');
    }
  };

  return (
    <div className="plantation-profile-tab">
      <div className="plantation-profile-header">
        <div className="plantation-profile-avatar">
          {(userData?.name || userData?.username || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1>{userData?.name || userData?.username || 'User'}</h1>
          <p>{hierarchyLabels.designation}</p>
        </div>
      </div>

      <div className="plantation-profile-card">
        <h3>Hierarchy</h3>
        <dl className="plantation-profile-dl">
          <div><dt>Group</dt><dd>{hierarchyLabels.group}</dd></div>
          <div><dt>Plantation</dt><dd>{hierarchyLabels.plantation}</dd></div>
          <div><dt>Region</dt><dd>{hierarchyLabels.region}</dd></div>
          <div><dt>Estate</dt><dd>{hierarchyLabels.estate}</dd></div>
          <div><dt>Role</dt><dd>{session?.jobRoleCode || '—'}</dd></div>
          <div><dt>Estate manager</dt><dd>{session?.isEstateManager ? 'Yes' : 'No'}</dd></div>
        </dl>
        <button type="button" className="pd-refresh-btn" onClick={refresh} disabled={isFetching}>
          Refresh hierarchy
        </button>
      </div>

      <div className="plantation-profile-actions">
        <button type="button" className="plantation-logout-btn plantation-profile-btn" onClick={handleLogout}>
          <FaSignOutAlt /> Sign out
        </button>
        {!confirmDelete ? (
          <button type="button" className="plantation-profile-btn plantation-profile-btn--danger" onClick={() => setConfirmDelete(true)}>
            <FaTrashAlt /> Delete account
          </button>
        ) : (
          <div className="plantation-profile-delete-confirm">
            <p>This will deactivate your account. Continue?</p>
            <button type="button" className="plantation-action-btn" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="plantation-profile-btn plantation-profile-btn--danger"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? 'Deleting…' : 'Confirm delete'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
