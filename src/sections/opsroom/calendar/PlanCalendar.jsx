import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNavbarPermissions } from '../../../hooks/useNavbarPermissions';
import {
  CALENDAR_PATH,
  isCalendarAllowedWing,
  normalizeWingTitle,
} from '../../../config/wingHubDisplay';
import { OD_WING_OPERATION_DIGITALIZATION_TITLE } from '../../../config/odWingShell';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import { Bars } from 'react-loader-spinner';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  useLazyGetPlanActivateStatusByPlansQuery,
  useSubmitPlanActivateRequestMutation,
} from '../../../api/services NodeJs/planActivateRequestsApi';
import {
  useLazyGetOpsroomPlansByDateRangeQuery,
  useLazyGetOpsroomEstateProfileQuery,
  useLazyGetOpsroomPlanTeamDroneQuery,
  useLazyGetOpsroomEstateDivisionsFieldsQuery,
} from '../../../api/services NodeJs/opsroomPlanCalendarApi';
import '../../../styles/planCalendar.css';

const PLAN_TYPE_META = [
  { key: 'np', label: 'Revolving' },
  { key: 'ap', label: 'AddHoc' },
  { key: 'rp', label: 'Rescheduled' },
];

/** Request activation is only for Operation Digitalization (opsroom) wing calendar. */
function canRequestPlanActivationForWing(wingParam) {
  if (!wingParam) return false;
  const w = decodeURIComponent(wingParam).trim();
  return (
    w === OD_WING_OPERATION_DIGITALIZATION_TITLE ||
    w === 'Central Operation Management'
  );
}

const PLAN_STATUS_META = [
  { key: 'activated_filter', label: 'Activated', color: '#BEBEBE', isActivatedToggle: true },
  { key: 'active', label: 'Ongoing', color: '#60a5fa' },
  { key: 'manager_approved', label: 'Manager Approved', color: '#f97316' },
  { key: 'team_assigned', label: 'Team Assigned', color: '#eab308' },
  { key: 'completed', label: 'Completed', color: '#22c55e' },
];

const WORKFLOW_STATUS_KEYS = PLAN_STATUS_META.filter((s) => !s.isActivatedToggle).map((s) => s.key);

function formatEstateLabel(estateName) {
  const name = String(estateName || '').trim();
  if (!name) return 'Estate';
  return /estate\s*$/i.test(name) ? name : `${name} Estate`;
}

function buildPlanCopyText(plan) {
  if (!plan) return '';
  const estateLabel = formatEstateLabel(plan.estate);
  const lines = [`${estateLabel.padEnd(28)}Plan #${plan.id}`];
  const divisions = plan.diviions || plan.divisions || [];

  divisions.forEach((div, divIndex) => {
    const fields = div.fields || [];
    const totalArea = fields.reduce((sum, f) => sum + (Number(f.area) || 0), 0);
    if (divIndex > 0) lines.push('');
    lines.push(`${div.division} - ${totalArea.toFixed(2)} Ha`);
    const maxNameLen = Math.max(
      8,
      ...fields.map((f) => String(f.field_short_name || f.field || '').length)
    );
    fields.forEach((f) => {
      const fieldName = String(f.field_short_name || f.field || '-');
      const areaLabel = `${f.area} Ha`;
      lines.push(`${fieldName.padEnd(maxNameLen + 4)}${areaLabel}`);
    });
  });

  return lines.join('\n');
}

const PlanCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plansByDate, setPlansByDate] = useState({});
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [estateInfo, setEstateInfo] = useState(null);
  const [estateLoading, setEstateLoading] = useState(false);
  const [estateError, setEstateError] = useState('');
  const [showOtherContacts, setShowOtherContacts] = useState(false);
  const [showOtherContactsModal, setShowOtherContactsModal] = useState(false);
  const [showPilotModal, setShowPilotModal] = useState(false);
  const [pilotInfo, setPilotInfo] = useState(null);
  const [pilotLoading, setPilotLoading] = useState(false);
  const [pilotError, setPilotError] = useState('');
  const [showEstateFieldsModal, setShowEstateFieldsModal] = useState(false);
  const [estateFieldsData, setEstateFieldsData] = useState(null);
  const [estateFieldsLoading, setEstateFieldsLoading] = useState(false);
  const [estateFieldsError, setEstateFieldsError] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(new Set(PLAN_TYPE_META.map((item) => item.key)));
  const [selectedStatuses, setSelectedStatuses] = useState(new Set(WORKFLOW_STATUS_KEYS));
  /** true (default): only activated=1; false: include deactivated */
  const [activatedOnly, setActivatedOnly] = useState(true);
  const [showHierarchyFilter, setShowHierarchyFilter] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedPlantation, setSelectedPlantation] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedEstate, setSelectedEstate] = useState('');
  const [activateStatus, setActivateStatus] = useState(null);
  const [activateStatusLoading, setActivateStatusLoading] = useState(false);
  const [showActivateRequestModal, setShowActivateRequestModal] = useState(false);
  const [activateRequestNote, setActivateRequestNote] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { allowedPaths, loadingPermissions } = useNavbarPermissions();
  const wingParam = new URLSearchParams(location.search).get('wing');
  const canRequestPlanActivation = canRequestPlanActivationForWing(wingParam);

  useEffect(() => {
    if (loadingPermissions) return;
    if (!allowedPaths.includes(CALENDAR_PATH)) {
      navigate('/home', { replace: true });
      return;
    }
    const normalized = normalizeWingTitle(wingParam ? decodeURIComponent(wingParam) : null);
    if (normalized && !isCalendarAllowedWing(normalized)) {
      navigate('/home', { replace: true });
    }
  }, [wingParam, allowedPaths, loadingPermissions, navigate]);

  const [fetchActivateStatus] = useLazyGetPlanActivateStatusByPlansQuery();
  const [submitActivateRequest, { isLoading: submittingActivateRequest }] =
    useSubmitPlanActivateRequestMutation();
  const [fetchPlansByDateRange] = useLazyGetOpsroomPlansByDateRangeQuery();
  const [fetchEstateProfile] = useLazyGetOpsroomEstateProfileQuery();
  const [fetchPlanTeamDrone] = useLazyGetOpsroomPlanTeamDroneQuery();
  const [fetchEstateDivisionsFields] = useLazyGetOpsroomEstateDivisionsFieldsQuery();

  const isPlanDeactivated = (plan) => plan != null && Number(plan.activated) !== 1;

  const monthRange = useMemo(() => {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    return { start, end };
  }, [currentMonth]);

  useEffect(() => {
    let isCancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await fetchPlansByDateRange({
          startDate: monthRange.start,
          endDate: monthRange.end,
        });
        const data = result.data;
        if (isCancelled) return;
        const grouped = {};
        if (data && (data.status === 'true' || data.status === true)) {
          Object.keys(data)
            .filter((k) => !isNaN(k))
            .forEach((k) => {
              const item = data[k];
              const dateKey = item.date;
              if (!grouped[dateKey]) grouped[dateKey] = [];
              grouped[dateKey].push(item);
            });
        }
        setPlansByDate(grouped);
      } catch (e) {
        if (!isCancelled) setError('Failed to load calendar data');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isCancelled = true;
    };
  }, [monthRange, fetchPlansByDateRange]);

  useEffect(() => {
    let cancelled = false;
    const loadEstate = async () => {
      if (!selectedPlan?.estate_id) {
        setEstateInfo(null);
        return;
      }
      setEstateLoading(true);
      setEstateError('');
      try {
        const result = await fetchEstateProfile(selectedPlan.estate_id);
        const details = result.data;
        if (!cancelled) setEstateInfo(details || null);
      } catch (e) {
        if (!cancelled) setEstateError('Failed to load estate contacts');
      } finally {
        if (!cancelled) setEstateLoading(false);
      }
    };
    loadEstate();
    return () => { cancelled = true; };
  }, [selectedPlan, fetchEstateProfile]);

  useEffect(() => {
    let cancelled = false;
    const loadActivateStatus = async () => {
      if (!canRequestPlanActivation || !selectedPlan?.id || !isPlanDeactivated(selectedPlan)) {
        setActivateStatus(null);
        return;
      }
      setActivateStatusLoading(true);
      try {
        const result = await fetchActivateStatus({ planIds: [selectedPlan.id] });
        if (cancelled) return;
        const map = result.data || {};
        setActivateStatus(map[selectedPlan.id] || map[String(selectedPlan.id)] || null);
      } catch {
        if (!cancelled) setActivateStatus(null);
      } finally {
        if (!cancelled) setActivateStatusLoading(false);
      }
    };
    loadActivateStatus();
    return () => {
      cancelled = true;
    };
  }, [canRequestPlanActivation, selectedPlan?.id, selectedPlan?.activated, fetchActivateStatus]);

  const handleSubmitActivateRequest = async () => {
    if (!selectedPlan?.id) return;
    try {
      await submitActivateRequest({
        planId: selectedPlan.id,
        requestMessage: activateRequestNote,
      }).unwrap();
      toast.success('Activation request sent to Field Operations');
      setShowActivateRequestModal(false);
      setActivateRequestNote('');
      setActivateStatus({ pending: true });
    } catch (e) {
      toast.error(e?.data?.message || e?.message || 'Failed to submit request');
    }
  };

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  const allPlansForMonth = useMemo(() => Object.values(plansByDate).flat(), [plansByDate]);

  const getPlanStatusKey = (plan) => {
    const activated = Number(plan.activated) === 1;
    const managerApproved = Number(plan.manager_approval) === 1;
    const teamAssigned = Number(plan.team_assigned) === 1;
    const completed = Number(plan.completed) === 1;

    if (!activated) return 'not_activated';
    if (activated && managerApproved && teamAssigned && completed) return 'completed';
    if (activated && managerApproved && teamAssigned) return 'team_assigned';
    if (activated && managerApproved) return 'manager_approved';
    return 'active'; // Ongoing
  };

  const getPlanStatusColor = (plan) => {
    const key = getPlanStatusKey(plan);
    if (key === 'not_activated') {
      return PLAN_STATUS_META.find((s) => s.isActivatedToggle)?.color || '#BEBEBE';
    }
    return PLAN_STATUS_META.find((s) => s.key === key)?.color || '#60a5fa';
  };

  const hierarchyData = useMemo(() => {
    const groupsMap = new Map();
    const plantationsMap = new Map();
    const regionsMap = new Map();
    const estatesMap = new Map();

    allPlansForMonth.forEach((plan) => {
      const groupId = String(plan.group_id ?? plan.groupId ?? plan.group ?? '');
      const groupName = String(plan.group ?? plan.group_name ?? groupId);
      const plantationId = String(plan.plantation_id ?? plan.plantationId ?? plan.plantation ?? '');
      const plantationName = String(plan.plantation ?? plan.plantation_name ?? plantationId);
      const regionId = String(plan.region_id ?? plan.regionId ?? plan.region ?? '');
      const regionName = String(plan.region ?? plan.region_name ?? regionId);
      const estateId = String(plan.estate_id ?? plan.estateId ?? plan.estate ?? '');
      const estateName = String(plan.estate ?? plan.estate_name ?? estateId);

      if (!groupId || !plantationId || !regionId || !estateId) return;

      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, { id: groupId, name: groupName });
      }
      if (!plantationsMap.has(plantationId)) {
        plantationsMap.set(plantationId, { id: plantationId, name: plantationName, groupId });
      }
      if (!regionsMap.has(regionId)) {
        regionsMap.set(regionId, { id: regionId, name: regionName, plantationId, groupId });
      }
      if (!estatesMap.has(estateId)) {
        estatesMap.set(estateId, { id: estateId, name: estateName, regionId, plantationId, groupId });
      }
    });

    const sortByName = (a, b) => a.name.localeCompare(b.name);

    return {
      groups: Array.from(groupsMap.values()).sort(sortByName),
      plantations: Array.from(plantationsMap.values()).sort(sortByName),
      regions: Array.from(regionsMap.values()).sort(sortByName),
      estates: Array.from(estatesMap.values()).sort(sortByName),
    };
  }, [allPlansForMonth]);

  const plantationOptions = useMemo(() => {
    if (!selectedGroup) return hierarchyData.plantations;
    return hierarchyData.plantations.filter((item) => item.groupId === selectedGroup);
  }, [hierarchyData.plantations, selectedGroup]);

  const regionOptions = useMemo(() => {
    if (selectedPlantation) {
      return hierarchyData.regions.filter((item) => item.plantationId === selectedPlantation);
    }
    if (selectedGroup) {
      return hierarchyData.regions.filter((item) => item.groupId === selectedGroup);
    }
    return hierarchyData.regions;
  }, [hierarchyData.regions, selectedGroup, selectedPlantation]);

  const estateOptions = useMemo(() => {
    if (selectedRegion) {
      return hierarchyData.estates.filter((item) => item.regionId === selectedRegion);
    }
    if (selectedPlantation) {
      return hierarchyData.estates.filter((item) => item.plantationId === selectedPlantation);
    }
    if (selectedGroup) {
      return hierarchyData.estates.filter((item) => item.groupId === selectedGroup);
    }
    return hierarchyData.estates;
  }, [hierarchyData.estates, selectedGroup, selectedPlantation, selectedRegion]);

  const filteredPlansByDate = useMemo(() => {
    const grouped = {};
    Object.entries(plansByDate).forEach(([date, plans]) => {
      const matched = plans.filter((plan) => {
        const typeMatch = selectedTypes.has(plan.flag);
        const isActivated = Number(plan.activated) === 1;
        if (activatedOnly && !isActivated) return false;

        const statusKey = getPlanStatusKey(plan);
        // Deactivated plans are only visible when Activated toggle is off
        const statusMatch = !isActivated
          ? true
          : selectedStatuses.has(statusKey);
        const groupId = String(plan.group_id ?? plan.groupId ?? plan.group ?? '');
        const plantationId = String(plan.plantation_id ?? plan.plantationId ?? plan.plantation ?? '');
        const regionId = String(plan.region_id ?? plan.regionId ?? plan.region ?? '');
        const estateId = String(plan.estate_id ?? plan.estateId ?? plan.estate ?? '');

        const hierarchyMatch =
          (!selectedGroup || groupId === selectedGroup) &&
          (!selectedPlantation || plantationId === selectedPlantation) &&
          (!selectedRegion || regionId === selectedRegion) &&
          (!selectedEstate || estateId === selectedEstate);

        return typeMatch && statusMatch && hierarchyMatch;
      });
      if (matched.length > 0) {
        grouped[date] = matched;
      }
    });
    return grouped;
  }, [plansByDate, selectedTypes, selectedStatuses, activatedOnly, selectedGroup, selectedPlantation, selectedRegion, selectedEstate]);

  const toggleType = (key) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleStatus = (key) => {
    if (key === 'activated_filter') {
      setActivatedOnly((prev) => !prev);
      return;
    }
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleGroupChange = (value) => {
    setSelectedGroup(value);
    setSelectedPlantation('');
    setSelectedRegion('');
    setSelectedEstate('');
  };

  const handlePlantationChange = (value) => {
    setSelectedPlantation(value);
    setSelectedRegion('');
    setSelectedEstate('');
    if (!value) return;
    const selected = hierarchyData.plantations.find((item) => item.id === value);
    if (selected) {
      setSelectedGroup(selected.groupId);
    }
  };

  const handleRegionChange = (value) => {
    setSelectedRegion(value);
    setSelectedEstate('');
    if (!value) return;
    const selected = hierarchyData.regions.find((item) => item.id === value);
    if (selected) {
      setSelectedPlantation(selected.plantationId);
      setSelectedGroup(selected.groupId);
    }
  };

  const handleEstateChange = (value) => {
    setSelectedEstate(value);
    if (!value) return;
    const selected = hierarchyData.estates.find((item) => item.id === value);
    if (selected) {
      setSelectedRegion(selected.regionId);
      setSelectedPlantation(selected.plantationId);
      setSelectedGroup(selected.groupId);
    }
  };

  const clearHierarchyFilters = () => {
    setSelectedGroup('');
    setSelectedPlantation('');
    setSelectedRegion('');
    setSelectedEstate('');
  };

  const earliestAllowedMonth = useMemo(() => startOfMonth(new Date()), []);
  const canGoPrevMonth = startOfMonth(currentMonth).getTime() > earliestAllowedMonth.getTime();
  const goPrevMonth = () =>
    setCurrentMonth((d) => {
      const prev = addMonths(d, -1);
      return startOfMonth(prev).getTime() < earliestAllowedMonth.getTime() ? d : prev;
    });
  const goNextMonth = () => setCurrentMonth((d) => addMonths(d, 1));

  const handleCopyPlanDetails = async () => {
    if (!selectedPlan) return;
    const text = buildPlanCopyText(selectedPlan);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Plan details copied — paste anywhere you need.');
    } catch {
      toast.error('Could not copy plan details.');
    }
  };

  const openEstateFieldsView = async () => {
    if (!selectedPlan?.estate_id) return;
    setShowEstateFieldsModal(true);
    setEstateFieldsLoading(true);
    setEstateFieldsError('');
    setEstateFieldsData(null);
    try {
      const result = await fetchEstateDivisionsFields(selectedPlan.estate_id);
      if (result.error) {
        setEstateFieldsError('Failed to load estate fields');
        return;
      }
      setEstateFieldsData(result.data || null);
    } catch {
      setEstateFieldsError('Failed to load estate fields');
    } finally {
      setEstateFieldsLoading(false);
    }
  };

  const openPilotModal = async () => {
    if (!selectedPlan) return;
    setShowPilotModal(true);
    setPilotLoading(true);
    setPilotError('');
    setPilotInfo(null);
    try {
      const result = await fetchPlanTeamDrone(selectedPlan.id);
      const res = result.data;
      // Normalize API response: pick first numeric key item if status true
      let normalized = null;
      if (res && (res.status === 'true' || res.status === true)) {
        const firstKey = Object.keys(res).find((k) => !isNaN(k));
        if (firstKey !== undefined) {
          normalized = res[firstKey];
        }
      }
      setPilotInfo(normalized || res || null);
    } catch (e) {
      setPilotError('Failed to load pilot and equipment details');
    } finally {
      setPilotLoading(false);
    }
  };

  return (
    <div className="wrapper-booking-calendar">
      <ToastContainer position="top-right" autoClose={4000} />
      <div className="header-booking-calendar">
        <button className="back-btn-booking-calendar" onClick={() => navigate(-1)} aria-label="Back">
          <svg className="back-icon-booking-calendar" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        <div className="center-header-booking-calendar">
          
          <div className="controls-booking-calendar">
          <div className="heading-booking-calendar">Plan Calendar</div>
            <button
              className="nav-btn-booking-calendar"
              onClick={goPrevMonth}
              aria-label="Previous month"
              disabled={!canGoPrevMonth}
              title={canGoPrevMonth ? 'Previous month' : 'Previous months are hidden'}
            >
              ◀
            </button>
            <div className="month-title-booking-calendar">{format(currentMonth, 'MMMM yyyy')}</div>
            <button className="nav-btn-booking-calendar" onClick={goNextMonth} aria-label="Next month">▶</button>
          </div>
        </div>
      </div>

      {(loading) && (
        <div className="loading-overlay-booking-calendar">
          <div className="loading-content-booking-calendar">
            <Bars height="40" width="40" color="#003057" ariaLabel="bars-loading" visible={true} />
            <span>Loading...</span>
          </div>
        </div>
      )}

      {error && <div className="error-booking-calendar">{error}</div>}

      <div className="top-filters-booking-calendar">
        <div className="top-filter-group-booking-calendar">
          <span className="legend-label-booking-calendar">Type:</span>
          {PLAN_TYPE_META.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`legend-chip-booking-calendar ${item.key === 'np' ? 'legend-chip-revolving' : item.key === 'ap' ? 'legend-chip-adhoc' : 'legend-chip-rescheduled'} ${selectedTypes.has(item.key) ? 'legend-chip-selected-booking-calendar' : 'legend-chip-unselected-booking-calendar'}`}
              onClick={() => toggleType(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="top-filter-group-booking-calendar">
          <span className="legend-label-booking-calendar">Status:</span>
          {PLAN_STATUS_META.map((item) => {
            const isSelected = item.isActivatedToggle
              ? true
              : selectedStatuses.has(item.key);
            const label = item.isActivatedToggle
              ? activatedOnly
                ? 'Activated'
                : 'All'
              : item.label;
            return (
              <button
                key={item.key}
                type="button"
                className={`legend-dot-item top-filter-status-booking-calendar ${isSelected ? 'legend-dot-selected-booking-calendar' : 'legend-dot-unselected-booking-calendar'}`}
                onClick={() => toggleStatus(item.key)}
                title={
                  item.isActivatedToggle
                    ? activatedOnly
                      ? 'Showing activated plans — click to show all (including deactivated)'
                      : 'Showing all plans — click to show activated only'
                    : undefined
                }
              >
                <span className="legend-dot" style={{ background: item.color }} />
                {label}
              </button>
            );
          })}
        </div>
        <div className="hierarchy-filter-wrap-booking-calendar">
        <button
          type="button"
          className={`hierarchy-filter-btn-booking-calendar ${showHierarchyFilter ? 'hierarchy-filter-btn-open-booking-calendar' : ''}`}
          onClick={() => setShowHierarchyFilter((v) => !v)}
          aria-expanded={showHierarchyFilter}
          aria-label="Open hierarchy filters"
        >
          <span className="hierarchy-filter-icon-booking-calendar">⚲</span>
          <span>Filter Options</span>
        </button>
        {(selectedGroup || selectedPlantation || selectedRegion || selectedEstate) && (
          <button type="button" className="hierarchy-clear-btn-booking-calendar" onClick={clearHierarchyFilters}>
            Clear
          </button>
        )}
      </div>
      </div>

      

      {showHierarchyFilter && (
        <div className="hierarchy-filter-popup-booking-calendar">
          <div className="hierarchy-filter-grid-booking-calendar">
            <label className="hierarchy-filter-field-booking-calendar">
              <span>Group</span>
              <select value={selectedGroup} onChange={(e) => handleGroupChange(e.target.value)}>
                <option value="">All Groups</option>
                {hierarchyData.groups.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="hierarchy-filter-field-booking-calendar">
              <span>Plantation</span>
              <select value={selectedPlantation} onChange={(e) => handlePlantationChange(e.target.value)}>
                <option value="">All Plantations</option>
                {plantationOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="hierarchy-filter-field-booking-calendar">
              <span>Region</span>
              <select value={selectedRegion} onChange={(e) => handleRegionChange(e.target.value)}>
                <option value="">All Regions</option>
                {regionOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="hierarchy-filter-field-booking-calendar">
              <span>Estate</span>
              <select value={selectedEstate} onChange={(e) => handleEstateChange(e.target.value)}>
                <option value="">All Estates</option>
                {estateOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="grid-scroll-booking-calendar">
        <div className="grid-booking-calendar">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="weekday-booking-calendar">{d}</div>
          ))}
          {/* leading blanks */}
          {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
            <div key={`blank-${i}`} className="cell-blank-booking-calendar" />
          ))}

          {daysInMonth.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const flagOrder = { np: 0, ap: 1, rp: 2 };
            const items = (filteredPlansByDate[key] || []).slice().sort((a, b) => {
              const aActive = Number(a.activated) === 1 ? 0 : 1;
              const bActive = Number(b.activated) === 1 ? 0 : 1;
              if (aActive !== bActive) return aActive - bActive;
              return (flagOrder[a.flag] ?? 3) - (flagOrder[b.flag] ?? 3);
            });
            const count = items.length;
            return (
              <div key={key} className="cell-booking-calendar">
                <div className="cell-header-booking-calendar">
                  <span className="daynum-booking-calendar">{format(day, 'd')}</span>
                  {count > 0 && <span className="count-booking-calendar">{count}</span>}
                </div>
                <div className="items-booking-calendar">
                  {items.map((p) => {
                    const planTypeClass =
                      p.flag === 'ap' ? 'item-type-adhoc' :
                      p.flag === 'rp' ? 'item-type-rescheduled' :
                      'item-type-revolving';

                    const statusColor = getPlanStatusColor(p);

                    return (
                      <div
                        key={p.id}
                        className={`item-booking-calendar ${planTypeClass}`}
                        title={`${p.estate} · ${p.area || 0} Ha · #${p.id}`}
                        onClick={() => setSelectedPlan(p)}
                      >
                        <span className="item-status-dot" style={{ background: statusColor }} />
                        <span className="item-text-booking-calendar">
                          {p.estate} · {p.area || 0} Ha
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedPlan && (
        <div className="modal-overlay-booking-calendar" onClick={() => setSelectedPlan(null)}>
          <div className="modal-booking-calendar" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-booking-calendar">
              <div className="modal-title-group-booking-calendar">
                <div className="modal-title-booking-calendar">Plan #{selectedPlan.id}</div>
                <div className="modal-subtitle-booking-calendar">
                  {selectedPlan.date} · {selectedPlan.group} · {selectedPlan.plantation} · {selectedPlan.estate}
                </div>
                {(selectedPlan.flag === 'rp' ||
                  (Array.isArray(selectedPlan.reschedule_history) &&
                    selectedPlan.reschedule_history.length > 0) ||
                  selectedPlan.reschedule_from_date) && (
                  <div className="reschedule-history-booking-calendar">
                    <div className="reschedule-history-title-booking-calendar">
                      Reschedule history
                      {Array.isArray(selectedPlan.reschedule_history) &&
                      selectedPlan.reschedule_history.length > 1
                        ? ` (${selectedPlan.reschedule_history.length})`
                        : ''}
                    </div>
                    {Array.isArray(selectedPlan.reschedule_history) &&
                    selectedPlan.reschedule_history.length > 0 ? (
                      <ul className="reschedule-history-list-booking-calendar">
                        {selectedPlan.reschedule_history.map((item, index) => (
                          <li key={item.id || `${item.from_date}-${item.to_date}-${index}`}>
                            <span className="reschedule-meta-label-booking-calendar">
                              #{index + 1}
                            </span>
                            <span>
                              {item.from_date ? (
                                <>
                                  from <strong>{item.from_date}</strong>
                                  {item.to_date ? (
                                    <>
                                      {' '}
                                      to <strong>{item.to_date}</strong>
                                    </>
                                  ) : null}
                                </>
                              ) : item.to_date ? (
                                <>
                                  to <strong>{item.to_date}</strong>
                                </>
                              ) : (
                                'Date not recorded'
                              )}
                            </span>
                            {item.by_name && (
                              <span>
                                · by <strong>{item.by_name}</strong>
                              </span>
                            )}
                            {item.source === 'manager' &&
                              item.requested_by_name &&
                              item.requested_by_name !== item.by_name && (
                                <span>
                                  · requested by <strong>{item.requested_by_name}</strong>
                                </span>
                              )}
                            {item.source === 'kwil' ? (
                              <span className="reschedule-source-badge-booking-calendar">KWIL</span>
                            ) : item.source === 'manager' ? (
                              <span className="reschedule-source-badge-booking-calendar">
                                Manager request
                              </span>
                            ) : null}
                            {item.at && (
                              <span className="reschedule-history-at-booking-calendar">
                                · {item.at}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="reschedule-meta-booking-calendar">
                        <span className="reschedule-meta-label-booking-calendar">Rescheduled</span>
                        {selectedPlan.reschedule_from_date ? (
                          <span>
                            from <strong>{selectedPlan.reschedule_from_date}</strong>
                            {selectedPlan.reschedule_to_date || selectedPlan.date ? (
                              <>
                                {' '}
                                to{' '}
                                <strong>
                                  {selectedPlan.reschedule_to_date || selectedPlan.date}
                                </strong>
                              </>
                            ) : null}
                          </span>
                        ) : (
                          <span>
                            to <strong>{selectedPlan.date}</strong>
                          </span>
                        )}
                        {selectedPlan.reschedule_by_name && (
                          <span>
                            · by <strong>{selectedPlan.reschedule_by_name}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                className="modal-close-booking-calendar"
                onClick={() => {
                  setSelectedPlan(null);
                  setShowActivateRequestModal(false);
                  setActivateRequestNote('');
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body-booking-calendar">
              <div className="contacts-card-booking-calendar">
                <div className="contacts-header-booking-calendar">
                  <span className="contacts-title-booking-calendar">Contacts</span>
                  <div className="contacts-actions-booking-calendar">
                    <button
                      className="contacts-btn-booking-calendar"
                      onClick={() => setShowOtherContactsModal(true)}
                      disabled={estateLoading || !estateInfo}
                    >
                      Other contacts
                    </button>
                  </div>
                </div>
                <div className="contacts-body-booking-calendar">
                  {estateLoading && <div className="contacts-loading-booking-calendar">Loading contacts...</div>}
                  {estateError && <div className="contacts-error-booking-calendar">{estateError}</div>}
                  {!estateLoading && !estateError && (
                    <>
                      {(() => {
                        const mgrs = Array.isArray(estateInfo?.manager) ? estateInfo.manager : [];
                        const primary = mgrs.length > 0 ? mgrs[0] : null;
                        if (primary) {
                          return (
                            <div className="contact-primary-booking-calendar">
                              <div className="contact-role-booking-calendar">{primary.appointment || 'Manager'}</div>
                              <div className="contact-name-booking-calendar">{primary.name || 'N/A'}</div>
                              <a className="contact-phone-booking-calendar" href={`tel:${primary.mobile || ''}`}>{primary.mobile || 'N/A'}</a>
                            </div>
                          );
                        }
                        if (estateInfo?.telephone) {
                          return (
                            <div className="contact-primary-booking-calendar">
                              <div className="contact-role-booking-calendar">Estate</div>
                              <div className="contact-name-booking-calendar">{estateInfo?.estate_name || selectedPlan.estate}</div>
                              <a className="contact-phone-booking-calendar" href={`tel:${estateInfo.telephone}`}>{estateInfo.telephone}</a>
                            </div>
                          );
                        }
                        return <div className="contacts-empty-booking-calendar">No contact details available.</div>;
                      })()}

                      {/* Other contacts moved to a dedicated modal for better UX */}
                    </>
                  )}
                </div>
              </div>
              {isPlanDeactivated(selectedPlan) && (
                <div className="plan-activate-panel-booking-calendar">
                  <span className="badge-deactivated-booking-calendar">Deactivated plan</span>
                  {canRequestPlanActivation && (
                    <>
                      {activateStatusLoading ? (
                        <span className="plan-activate-hint-booking-calendar">Checking request status…</span>
                      ) : activateStatus?.pending ? (
                        <span className="plan-activate-pending-booking-calendar">
                          Activation request pending Field Operations approval
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="plan-activate-request-btn-booking-calendar"
                          onClick={() => setShowActivateRequestModal(true)}
                        >
                          Request activation
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="summary-row-booking-calendar">
                <span className="badge-booking-calendar">{selectedPlan.mission_type_name}</span>
                <span className="badge-booking-calendar">Area: {selectedPlan.area} Ha</span>
                {selectedPlan.manager_approval ? <span className="badge-success-booking-calendar">Manager Approved</span> : <span className="badge-warn-booking-calendar">Pending Approval</span>}
                {selectedPlan.team_assigned === 1 ? (
                  <span className="badge-success-booking-calendar">Team Assigned</span>
                ) : (
                  <span className="badge-warn-booking-calendar">Team Not Assigned</span>
                )}
                {selectedPlan.team_assigned === 1 && (
                  <button className="pilot-btn-booking-calendar" onClick={openPilotModal}>View Pilot and Equipment Details</button>
                )}
              </div>

              <div className="divisions-list-booking-calendar">
                {(selectedPlan.diviions || []).map((div) => {
                  const totalArea = (div.fields || []).reduce((sum, f) => sum + (Number(f.area) || 0), 0);
                  return (
                    <div key={div.id} className="division-card-booking-calendar">
                      <div className="division-header-booking-calendar">
                        <span className="division-title-booking-calendar">{div.division} - {totalArea.toFixed(2)} Ha</span>
                        <span className="division-count-booking-calendar">{(div.fields || []).length} fields</span>
                      </div>
                      <div className="fields-grid-booking-calendar">
                        {(div.fields || []).map((f) => (
                          <div
                            key={f.id}
                            className={`field-tile-booking-calendar ${f.activated === 1 ? 'field-tile-active-booking-calendar' : 'field-tile-inactive-booking-calendar'}`}
                            title={f.field}
                          >
                            <div className="field-tile-name-booking-calendar">{f.field_short_name || f.field}</div>
                            <div className="field-tile-area-booking-calendar">{f.area} Ha</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer-booking-calendar">
              <button
                type="button"
                className="modal-view-btn-booking-calendar"
                onClick={openEstateFieldsView}
                disabled={!selectedPlan?.estate_id}
              >
                View
              </button>
              <button
                type="button"
                className="modal-copy-btn-booking-calendar"
                onClick={handleCopyPlanDetails}
              >
                Copy
              </button>
              <button className="modal-close-btn-booking-calendar" onClick={() => setSelectedPlan(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showEstateFieldsModal && selectedPlan && (
        <div className="modal-overlay-booking-calendar" onClick={() => setShowEstateFieldsModal(false)}>
          <div className="modal-booking-calendar modal-booking-calendar--estate-fields" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-booking-calendar">
              <div className="modal-title-group-booking-calendar">
                <div className="modal-title-booking-calendar">Estate Fields</div>
                <div className="modal-subtitle-booking-calendar">
                  {estateFieldsData?.estate_name || selectedPlan.estate} · All divisions
                </div>
              </div>
              <button
                className="modal-close-booking-calendar"
                onClick={() => setShowEstateFieldsModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body-booking-calendar">
              {estateFieldsLoading && (
                <div className="contacts-loading-booking-calendar">Loading estate fields...</div>
              )}
              {estateFieldsError && (
                <div className="contacts-error-booking-calendar">{estateFieldsError}</div>
              )}
              {!estateFieldsLoading && !estateFieldsError && (
                <div className="divisions-list-booking-calendar">
                  {Array.isArray(estateFieldsData?.divisions) && estateFieldsData.divisions.length > 0 ? (
                    estateFieldsData.divisions.map((div) => (
                      <div key={div.id} className="division-card-booking-calendar">
                        <div className="division-header-booking-calendar">
                          <span className="division-title-booking-calendar">
                            {div.division} - {(div.total_area ?? 0).toFixed(2)} Ha
                          </span>
                          <span className="division-count-booking-calendar">
                            {(div.fields || []).length} fields
                          </span>
                        </div>
                        <div className="fields-grid-booking-calendar">
                          {(div.fields || []).map((f) => (
                            <div
                              key={f.id}
                              className="field-tile-booking-calendar field-tile-active-booking-calendar"
                              title={f.field}
                            >
                              <div className="field-tile-name-booking-calendar">
                                {f.field_short_name || f.field}
                              </div>
                              <div className="field-tile-area-booking-calendar">{f.area} Ha</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="contacts-empty-booking-calendar">No fields found for this estate.</div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer-booking-calendar">
              <button
                type="button"
                className="modal-close-btn-booking-calendar"
                onClick={() => setShowEstateFieldsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {canRequestPlanActivation && showActivateRequestModal && selectedPlan && (
        <div className="modal-overlay-booking-calendar" onClick={() => !submittingActivateRequest && setShowActivateRequestModal(false)}>
          <div className="modal-booking-calendar modal-booking-calendar--compact" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-booking-calendar">
              <div className="modal-title-group-booking-calendar">
                <div className="modal-title-booking-calendar">Request plan activation</div>
                <div className="modal-subtitle-booking-calendar">
                  Plan #{selectedPlan.id} · {selectedPlan.estate}
                </div>
              </div>
              <button
                className="modal-close-booking-calendar"
                onClick={() => setShowActivateRequestModal(false)}
                aria-label="Close"
                disabled={submittingActivateRequest}
              >
                ✕
              </button>
            </div>
            <div className="modal-body-booking-calendar">
              <p className="plan-activate-modal-text-booking-calendar">
                This sends a request to Field Operations. The plan is not activated until approved.
              </p>
              <label className="plan-activate-modal-label-booking-calendar">
                Note (optional)
                <textarea
                  className="plan-activate-modal-textarea-booking-calendar"
                  rows={3}
                  value={activateRequestNote}
                  onChange={(e) => setActivateRequestNote(e.target.value)}
                  disabled={submittingActivateRequest}
                />
              </label>
            </div>
            <div className="modal-footer-booking-calendar">
              <button
                type="button"
                className="modal-close-btn-booking-calendar"
                onClick={() => setShowActivateRequestModal(false)}
                disabled={submittingActivateRequest}
              >
                Cancel
              </button>
              <button
                type="button"
                className="plan-activate-request-btn-booking-calendar"
                onClick={handleSubmitActivateRequest}
                disabled={submittingActivateRequest}
              >
                {submittingActivateRequest ? 'Sending…' : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPilotModal && (
        <div className="modal-overlay-booking-calendar" onClick={() => setShowPilotModal(false)}>
          <div className="modal-booking-calendar" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-booking-calendar">
              <div className="modal-title-group-booking-calendar">
                <div className="modal-title-booking-calendar">Pilot and Equipment Details</div>
                <div className="modal-subtitle-booking-calendar">Plan #{selectedPlan?.id} · {selectedPlan?.estate}</div>
              </div>
              <button className="modal-close-booking-calendar" onClick={() => setShowPilotModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="modal-body-booking-calendar">
              {pilotLoading && <div className="contacts-loading-booking-calendar">Loading...</div>}
              {pilotError && <div className="contacts-error-booking-calendar">{pilotError}</div>}
              {!pilotLoading && !pilotError && pilotInfo && (
                <div className="pilot-wrap-booking-calendar">
                  {pilotInfo.team_lead && (
                    <div className="pilot-section-booking-calendar">
                      <div className="contacts-section-title-booking-calendar">Team Lead</div>
                      <div className="contact-row-booking-calendar">
                        <div className="contact-row-left-booking-calendar">
                          <div className="contact-row-name-booking-calendar">{pilotInfo.team_lead}</div>
                          <div className="contact-row-role-booking-calendar">Team Lead</div>
                        </div>
                        {pilotInfo.team_lead_mobile && (
                          <a className="contact-row-phone-booking-calendar" href={`tel:${pilotInfo.team_lead_mobile}`}>{pilotInfo.team_lead_mobile}</a>
                        )}
                      </div>
                    </div>
                  )}

                  {Array.isArray(pilotInfo.pilots) && pilotInfo.pilots.length > 0 && (
                    <div className="pilot-section-booking-calendar">
                      <div className="contacts-section-title-booking-calendar">Pilots</div>
                      <div className="contacts-list-booking-calendar">
                        {pilotInfo.pilots.map((p) => (
                          <div key={p.pilot_id} className="contact-row-booking-calendar">
                            <div className="contact-row-left-booking-calendar">
                              <div className="contact-row-name-booking-calendar">{p.pilot}</div>
                              <div className="contact-row-role-booking-calendar">{p.is_leader === 1 ? 'Leader' : 'Pilot'}</div>
                            </div>
                            {p.mobile && (
                              <a className="contact-row-phone-booking-calendar" href={`tel:${p.mobile}`}>{p.mobile}</a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(pilotInfo.drones) && pilotInfo.drones.length > 0 && (
                    <div className="pilot-section-booking-calendar">
                      <div className="contacts-section-title-booking-calendar">Drones</div>
                      <div className="drone-tags-booking-calendar">
                        {pilotInfo.drones.map((d) => (
                          <span key={d.id} className="drone-tag-booking-calendar">{d.tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer-booking-calendar">
              <button className="modal-close-btn-booking-calendar" onClick={() => setShowPilotModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showOtherContactsModal && (
        <div className="modal-overlay-booking-calendar" onClick={() => setShowOtherContactsModal(false)}>
          <div className="modal-booking-calendar" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-booking-calendar">
              <div className="modal-title-group-booking-calendar">
                <div className="modal-title-booking-calendar">Other Contacts</div>
                <div className="modal-subtitle-booking-calendar">{selectedPlan?.estate}</div>
              </div>
              <button className="modal-close-booking-calendar" onClick={() => setShowOtherContactsModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="modal-body-booking-calendar">
              {estateLoading && <div className="contacts-loading-booking-calendar">Loading contacts...</div>}
              {estateError && <div className="contacts-error-booking-calendar">{estateError}</div>}
              {!estateLoading && !estateError && (
                <div className="contacts-others-booking-calendar">
                  {Array.isArray(estateInfo?.manager) && estateInfo.manager.slice(1).length > 0 && (
                    <div className="contacts-section-booking-calendar">
                      <div className="contacts-section-title-booking-calendar">Other Managers</div>
                      <div className="contacts-list-booking-calendar">
                        {estateInfo.manager.slice(1).map((m, idx) => (
                          <div key={`mgr-${idx}`} className="contact-row-booking-calendar">
                            <div className="contact-row-left-booking-calendar">
                              <div className="contact-row-name-booking-calendar">{m.name}</div>
                              <div className="contact-row-role-booking-calendar">{m.appointment}</div>
                            </div>
                            <a className="contact-row-phone-booking-calendar" href={`tel:${m.mobile}`}>{m.mobile}</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(estateInfo?.other_personals) && estateInfo.other_personals.length > 0 && (
                    <div className="contacts-section-booking-calendar">
                      <div className="contacts-section-title-booking-calendar">Other Personals</div>
                      <div className="contacts-list-booking-calendar">
                        {estateInfo.other_personals.map((p, idx) => (
                          <div key={`pers-${idx}`} className="contact-row-booking-calendar">
                            <div className="contact-row-left-booking-calendar">
                              <div className="contact-row-name-booking-calendar">{p.name}</div>
                              <div className="contact-row-role-booking-calendar">{p.appointment}</div>
                              {Array.isArray(p.divisions) && p.divisions.length > 0 && (
                                <div className="contact-row-divisions-booking-calendar">
                                  {p.divisions.map((d) => d.division).join(', ')}
                                </div>
                              )}
                            </div>
                            <a className="contact-row-phone-booking-calendar" href={`tel:${p.mobile}`}>{p.mobile}</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer-booking-calendar">
              <button className="modal-close-btn-booking-calendar" onClick={() => setShowOtherContactsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanCalendar;


