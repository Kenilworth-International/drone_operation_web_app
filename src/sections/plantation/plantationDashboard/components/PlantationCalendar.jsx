import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppDispatch } from '../../../../store/hooks';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay } from 'date-fns';
import {
  useGetCalendarPlansQuery,
  useCreatePlantationPlanRequestMutation,
  useGetPlantationPlanRequestMonthStatsQuery,
  useLazyGetPlantationPlanByIdQuery,
} from '../../../../api/services NodeJs/plantationDashboardApi';
import { baseApi, useGetMissionTypesQuery, useGetCropTypesQuery } from '../../../../api/services/allEndpoints';
import { getUserData, hasHierarchyForPlantationPlanRequest } from '../../../../utils/authUtils';
import { Bars } from 'react-loader-spinner';
import { toast } from 'react-toastify';

function objectListByNumericKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.keys(obj)
    .filter((k) => !isNaN(Number(k)))
    .map((k) => obj[k]);
}

/**
 * PHP dropdowns vary: top-level numeric keys, `data` array, or named keys like `mission_type` / `crop_type`.
 */
function normalizeDropdownList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;

  const namedKeys = [
    'mission_type',
    'mission_types',
    'missionTypes',
    'crop_type',
    'crop_types',
    'crops',
    'crop',
    'rows',
    'result',
  ];
  for (const key of namedKeys) {
    if (raw[key] == null) continue;
    if (Array.isArray(raw[key])) return raw[key];
    if (typeof raw[key] === 'object') {
      const fromNum = objectListByNumericKeys(raw[key]);
      if (fromNum.length) return fromNum;
    }
  }

  if (typeof raw === 'object' && (raw.status === 'true' || raw.status === true)) {
    return Object.keys(raw)
      .filter((k) => !isNaN(Number(k)) && k !== 'status' && k !== 'count')
      .map((k) => raw[k]);
  }
  if (typeof raw === 'object') {
    return Object.keys(raw)
      .filter((k) => !isNaN(Number(k)))
      .map((k) => raw[k]);
  }
  return [];
}

function firstPositiveIntString(obj, preferredKeys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of preferredKeys) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (v == null || v === '') continue;
    const n = parseInt(String(v), 10);
    if (Number.isFinite(n) && n >= 0) return String(n);
  }
  return '';
}

/** Prefer explicit id fields; missing `id` makes <option> use visible text as value and breaks parseInt. */
function cropTypeOptionValue(c) {
  return firstPositiveIntString(c, ['id', 'crop_type_id', 'crop_id', 'cropTypeId']);
}

/**
 * Prefer numeric DB id. PHP `/mission_type` rows often only have `mission_type_code` (spy/spd) — use that as value;
 * backend resolves code → `mission_type.id`.
 */
function missionTypeOptionValue(m) {
  const n = firstPositiveIntString(m, [
    'id',
    'mission_type_id',
    'mission_id',
    'missionTypeId',
    'type_id',
    'mission_type',
  ]);
  if (n !== '') return n;
  const code = m?.mission_type_code;
  if (code != null && String(code).trim() !== '') return String(code).trim();
  return '';
}

function contactPhone(contact) {
  if (!contact) return '';
  return contact.mobile || contact.mobile_no || contact.phone || contact.telephone || '';
}

function planAreaFromDetails(planDetails) {
  if (!planDetails) return 0;
  const fromApi = parseFloat(planDetails.area ?? planDetails.totalExtent ?? 0);
  if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;

  const divisions = planDetails.divisions || planDetails.diviions || [];
  let sum = 0;
  for (const div of divisions) {
    const fields = div.checkedFields || div.fields || [];
    for (const f of fields) {
      if (f.activated === 0) continue;
      const fa = parseFloat(f.field_area ?? f.area ?? 0);
      if (Number.isFinite(fa)) sum += fa;
    }
  }
  return Math.round(sum * 100) / 100;
}

const PlantationCalendar = ({ currentMonth, setCurrentMonth, missionType, enablePlanRequestUi = false }) => {
  const dispatch = useAppDispatch();
  const [fetchPlanById] = useLazyGetPlantationPlanByIdQuery();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planDetails, setPlanDetails] = useState(null);
  const [estateInfo, setEstateInfo] = useState(null);
  const [pilotInfo, setPilotInfo] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [estateLoading, setEstateLoading] = useState(false);
  const [pilotLoading, setPilotLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [estateError, setEstateError] = useState('');
  const [pilotError, setPilotError] = useState('');
  const [showPilotModal, setShowPilotModal] = useState(false);

  const [requestModalDate, setRequestModalDate] = useState(null);
  const [requestPlanCount, setRequestPlanCount] = useState(1);
  const [requestMissionTypeId, setRequestMissionTypeId] = useState('');
  const [requestCropTypeId, setRequestCropTypeId] = useState('');

  const userData = getUserData();
  const { data: missionTypesRaw } = useGetMissionTypesQuery(undefined, { skip: !enablePlanRequestUi });
  const { data: cropTypesRaw } = useGetCropTypesQuery(undefined, { skip: !enablePlanRequestUi });
  const missionTypeOptions = useMemo(() => {
    const list = normalizeDropdownList(missionTypesRaw);
    return list.filter((m) => missionTypeOptionValue(m) !== '');
  }, [missionTypesRaw]);
  const cropTypeOptions = useMemo(() => {
    const list = normalizeDropdownList(cropTypesRaw);
    return list.filter((c) => cropTypeOptionValue(c) !== '');
  }, [cropTypesRaw]);

  const [createPlanRequest, { isLoading: isSubmittingRequest }] = useCreatePlantationPlanRequestMutation();

  const openRequestModal = useCallback(
    (day) => {
      if (!enablePlanRequestUi) return;
      if (!hasHierarchyForPlantationPlanRequest(userData)) {
        toast.error(
          'Plan requests need Group, Plantation, Region, and Estate on your profile. Estate is required.'
        );
        return;
      }
      setRequestModalDate(day);
      setRequestPlanCount(1);
      setRequestMissionTypeId('');
      setRequestCropTypeId('');
    },
    [enablePlanRequestUi, userData]
  );

  const closeRequestModal = useCallback(() => {
    setRequestModalDate(null);
  }, []);

  const submitPlanRequest = async () => {
    if (!requestModalDate) return;
    const pickedDate = format(requestModalDate, 'yyyy-MM-dd');
    const mtRaw = String(requestMissionTypeId || '').trim();
    const ct = parseInt(requestCropTypeId, 10);
    if (!mtRaw || !Number.isFinite(ct)) {
      toast.error('Please select mission type and crop type.');
      return;
    }
    const pc = parseInt(requestPlanCount, 10);
    if (!Number.isFinite(pc) || pc < 1 || pc > 100) {
      toast.error('Plan count must be between 1 and 100.');
      return;
    }
    const missionTypePayload = /^\d+$/.test(mtRaw) ? parseInt(mtRaw, 10) : mtRaw;
    try {
      await createPlanRequest({
        pickedDate,
        planCount: pc,
        missionTypeId: missionTypePayload,
        cropTypeId: ct,
      }).unwrap();
      toast.success('Request submitted. Ops will review it in Workflow Dashboard.');
      closeRequestModal();
    } catch (e) {
      const msg = e?.data?.message || e?.message || 'Request failed.';
      toast.error(msg);
    }
  };
  
  const yearMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  
  const { data, isLoading, error, refetch } = useGetCalendarPlansQuery({
    yearMonth,
    missionType
  });

  const { data: monthStatsRes, isFetching: monthStatsLoading } = useGetPlantationPlanRequestMonthStatsQuery(
    { yearMonth },
    { skip: !enablePlanRequestUi }
  );
  const monthStats = monthStatsRes?.data;

  const plans = data?.data || [];

  // Group plans by date
  const plansByDate = useMemo(() => {
    const grouped = {};
    plans.forEach(plan => {
      const dateKey = format(new Date(plan.pickedDate), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(plan);
    });
    return grouped;
  }, [plans]);

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ 
      start: startOfMonth(currentMonth), 
      end: endOfMonth(currentMonth) 
    });
  }, [currentMonth]);

  const goPrevMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const goNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Refetch when month changes
  useEffect(() => {
    refetch();
  }, [yearMonth, missionType, refetch]);

      // Fetch plan details when a plan is selected
      useEffect(() => {
        let cancelled = false;
        const loadPlanDetails = async () => {
          if (!selectedPlan?.id) {
            setPlanDetails(null);
            return;
          }
          setPlanLoading(true);
          setPlanError('');
          try {
            const result = await fetchPlanById(selectedPlan.id);
            const normalized = result.data?.data ?? result.data;
            if (!cancelled) {
              setPlanDetails(normalized || null);
            }
          } catch (e) {
            if (!cancelled) setPlanError('Failed to load plan details');
          } finally {
            if (!cancelled) setPlanLoading(false);
          }
        };
        loadPlanDetails();
        return () => { cancelled = true; };
      }, [selectedPlan, fetchPlanById]);

  // Fetch estate details when plan is selected
  useEffect(() => {
    let cancelled = false;
    const loadEstate = async () => {
      if (!selectedPlan?.estateId && !planDetails?.estateId) {
        setEstateInfo(null);
        return;
      }
      setEstateLoading(true);
      setEstateError('');
      try {
        const estateId = selectedPlan.estateId ?? planDetails?.estateId;
        const result = await dispatch(baseApi.endpoints.getEstateDetails.initiate(estateId));
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
  }, [selectedPlan, planDetails?.estateId, dispatch]);

  const openPilotModal = async () => {
    if (!selectedPlan) return;
    setShowPilotModal(true);
    setPilotLoading(true);
    setPilotError('');
    setPilotInfo(null);
    try {
      const result = await dispatch(baseApi.endpoints.getPilotDetailsForPlan.initiate(selectedPlan.id));
      const res = result.data;
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

  // Map mission type codes to display names
  const getMissionTypeDisplayName = (missionTypeCode) => {
    if (missionTypeCode === 'spy') return 'Spray';
    if (missionTypeCode === 'spd') return 'Spread';
    return missionTypeCode || 'N/A';
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="plantation-calendar-section">
      <div className="plantation-calendar-header">
        <button className="plantation-calendar-nav-btn" onClick={goPrevMonth}>
          ◀ Previous
        </button>
        <h2 className="plantation-calendar-month-title">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button className="plantation-calendar-nav-btn" onClick={goNextMonth}>
          Next ▶
        </button>
      </div>

      {enablePlanRequestUi && (
        <div className="plantation-calendar-month-stats" aria-live="polite">
          {monthStatsLoading ? (
            <span className="plantation-calendar-month-stats-muted">Loading plan request stats…</span>
          ) : (
            <>
              <span className="plantation-calendar-month-stat">
                Requested: <strong>{monthStats?.totalRequests ?? 0}</strong>{' '}
                request{monthStats?.totalRequests === 1 ? '' : 's'}
              </span>
              <span className="plantation-calendar-month-stat-sep" aria-hidden="true">
                ·
              </span>
              <span className="plantation-calendar-month-stat">
                Approved: <strong>{monthStats?.acceptedCount ?? 0}</strong>
              </span>
              <span className="plantation-calendar-month-stat-sep" aria-hidden="true">
                ·
              </span>
              <span className="plantation-calendar-month-stat">
                Requested plans: <strong>{monthStats?.totalPlanUnits ?? 0}</strong>
              </span>
              <span className="plantation-calendar-month-stat-sep" aria-hidden="true">
                ·
              </span>
              <span className="plantation-calendar-month-stat">
                Approved plans: <strong>{monthStats?.acceptedPlanUnits ?? 0}</strong>
              </span>
            </>
          )}
        </div>
      )}

      {isLoading && (
        <div className="plantation-calendar-loading">
          <Bars height="40" width="40" color="#2d8659" />
          <span>Loading calendar data...</span>
        </div>
      )}

      {error && (
        <div className="plantation-calendar-error">
          Error loading calendar data. Please try again.
        </div>
      )}

      {!isLoading && !error && (
        <div className="plantation-calendar-grid">
          {/* Weekday headers */}
          {weekDays.map(day => (
            <div key={day} className="plantation-calendar-weekday">
              {day}
            </div>
          ))}

          {/* Leading blanks */}
          {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
            <div key={`blank-${i}`} className="plantation-calendar-day-blank" />
          ))}

          {/* Days */}
          {daysInMonth.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayPlans = plansByDate[dateKey] || [];
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div 
                key={dateKey} 
                className={`plantation-calendar-day ${isToday ? 'today' : ''}`}
              >
                <div
                  className={`plantation-calendar-day-header${enablePlanRequestUi ? ' plantation-calendar-day-header--with-add' : ''}`}
                >
                  <div className="plantation-calendar-day-header-main">
                    <span className="plantation-calendar-day-number">
                      {format(day, 'd')}
                    </span>
                    {dayPlans.length > 0 && (
                      <span className="plantation-calendar-plan-count">
                        ({dayPlans.length} {dayPlans.length === 1 ? 'plan' : 'plans'})
                      </span>
                    )}
                  </div>
                  {enablePlanRequestUi && (
                    <button
                      type="button"
                      className="plantation-calendar-add-btn"
                      title="Request new plans (pending Ops approval)"
                      aria-label="Request new plans"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRequestModal(day);
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
                {dayPlans.length > 0 && (
                  <div className="plantation-calendar-day-plans">
                    {dayPlans.map(plan => (
                      <div 
                        key={plan.id} 
                        className="plantation-calendar-plan-item"
                        title={`${plan.estate_name || 'Estate'} - Plan ${plan.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan);
                        }}
                      >
                        {plan.estate_name || `Plan ${plan.id}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {requestModalDate && (
        <div
          className="plantation-calendar-request-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plantation-req-modal-title"
          onClick={closeRequestModal}
        >
          <div className="plantation-calendar-request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="plantation-calendar-request-modal-header">
              <span id="plantation-req-modal-title">Request plans</span>
              <button type="button" className="plantation-plan-modal-close" onClick={closeRequestModal} aria-label="Close">
                ×
              </button>
            </div>
            <div className="plantation-calendar-request-modal-body">
              <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>
                Date: <strong>{format(requestModalDate, 'yyyy-MM-dd')}</strong>
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Plans already on this day:{' '}
                <strong>
                  {(plansByDate[format(requestModalDate, 'yyyy-MM-dd')] || []).length}
                </strong>{' '}
                (existing bookings only — requests are not shown until approved)
              </p>
              <div>
                <label htmlFor="pd-req-count">How many plans</label>
                <input
                  id="pd-req-count"
                  type="number"
                  min={1}
                  max={100}
                  value={requestPlanCount}
                  onChange={(e) => setRequestPlanCount(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="pd-req-crop">Crop type</label>
                <select
                  id="pd-req-crop"
                  value={requestCropTypeId}
                  onChange={(e) => setRequestCropTypeId(e.target.value)}
                >
                  <option value="">Select crop</option>
                  {cropTypeOptions.map((c, idx) => (
                    <option
                      key={cropTypeOptionValue(c) || `crop-${idx}`}
                      value={cropTypeOptionValue(c)}
                    >
                      {c.crop || c.name || `Crop ${cropTypeOptionValue(c) || idx}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pd-req-mission">Mission type</label>
                <select
                  id="pd-req-mission"
                  value={requestMissionTypeId}
                  onChange={(e) => setRequestMissionTypeId(e.target.value)}
                >
                  <option value="">Select mission</option>
                  {missionTypeOptions.map((m, idx) => (
                    <option
                      key={missionTypeOptionValue(m) || `mission-${idx}`}
                      value={missionTypeOptionValue(m)}
                    >
                      {m.mission_type_name || m.mission_type || `Mission ${missionTypeOptionValue(m) || idx}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="plantation-calendar-request-modal-actions">
                <button type="button" className="plantation-calendar-request-cancel" onClick={closeRequestModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="plantation-calendar-request-submit"
                  disabled={isSubmittingRequest}
                  onClick={submitPlanRequest}
                >
                  {isSubmittingRequest ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Details Modal */}
      {selectedPlan && (
        <div className="plantation-plan-modal-overlay" onClick={() => setSelectedPlan(null)}>
          <div className="plantation-plan-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="plantation-plan-modal-header">
              <div className="plantation-plan-modal-title-group">
                <div className="plantation-plan-modal-title">Plan #{selectedPlan.id}</div>
                <div className="plantation-plan-modal-subtitle">
                  {format(new Date(selectedPlan.pickedDate), 'yyyy-MM-dd')} · {selectedPlan.estate_name || 'Estate'}
                </div>
              </div>
              <button className="plantation-plan-modal-close" onClick={() => setSelectedPlan(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="plantation-plan-modal-body">
              {planLoading && (
                <div className="plantation-plan-modal-loading">
                  <Bars height="30" width="30" color="#2d8659" />
                  <span>Loading plan details...</span>
                </div>
              )}

              {planError && (
                <div className="plantation-plan-modal-error">{planError}</div>
              )}

              {!planLoading && !planError && planDetails && (
                <>
                  {/* Contacts Card */}
                  <div className="plantation-plan-contacts-card">
                    <div className="plantation-plan-contacts-header">
                      <span className="plantation-plan-contacts-title">Contacts</span>
                    </div>
                    <div className="plantation-plan-contacts-body">
                      {estateLoading && <div className="plantation-plan-contacts-loading">Loading contacts...</div>}
                      {estateError && <div className="plantation-plan-contacts-error">{estateError}</div>}
                      {!estateLoading && !estateError && (
                        <>
                          {(() => {
                            const mgrs = Array.isArray(estateInfo?.manager) ? estateInfo.manager : [];
                            const primary = mgrs.length > 0 ? mgrs[0] : null;
                            if (primary) {
                              return (
                                <div className="plantation-plan-contact-primary">
                                  <div className="plantation-plan-contact-role">{primary.appointment || 'Manager'}</div>
                                  <div className="plantation-plan-contact-name">{primary.name || 'N/A'}</div>
                                  <a className="plantation-plan-contact-phone" href={`tel:${contactPhone(primary)}`}>
                                    {contactPhone(primary) || 'N/A'}
                                  </a>
                                </div>
                              );
                            }
                            if (estateInfo?.telephone) {
                              return (
                                <div className="plantation-plan-contact-primary">
                                  <div className="plantation-plan-contact-role">Estate</div>
                                  <div className="plantation-plan-contact-name">{estateInfo?.estate_name || selectedPlan.estate_name}</div>
                                  <a className="plantation-plan-contact-phone" href={`tel:${estateInfo.telephone}`}>
                                    {estateInfo.telephone}
                                  </a>
                                </div>
                              );
                            }
                            return <div className="plantation-plan-contacts-empty">No contact details available.</div>;
                          })()}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Summary Row */}
                  <div className="plantation-plan-summary-row">
                    <span className="plantation-plan-badge">
                      {getMissionTypeDisplayName(planDetails.mission_type_name || planDetails.missionTypeId)}
                    </span>
                    <span className="plantation-plan-badge">
                      Area: {planAreaFromDetails(planDetails).toFixed(2)} Ha
                    </span>
                    {planDetails.manager_approval ? (
                      <span className="plantation-plan-badge-success">Manager Approved</span>
                    ) : (
                      <span className="plantation-plan-badge-warn">Pending Approval</span>
                    )}
                    {planDetails.team_assigned === 1 ? (
                      <span className="plantation-plan-badge-success">Team Assigned</span>
                    ) : (
                      <span className="plantation-plan-badge-warn">Team Not Assigned</span>
                    )}
                    {planDetails.team_assigned === 1 && (
                      <button className="plantation-plan-pilot-btn" onClick={openPilotModal}>
                        View Pilot and Equipment Details
                      </button>
                    )}
                  </div>

                  {/* Divisions and Fields List */}
                  {(() => {
                    // Handle different response structures: diviions, divisions, or checkedFields
                    let divisions = planDetails.diviions || planDetails.divisions || [];
                    
                    // If divisions structure has checkedFields (from CalenderWidget pattern)
                    if (divisions.length > 0 && divisions[0]?.checkedFields) {
                      divisions = divisions.map(div => ({
                        id: div.divisionId || div.id,
                        division: div.divisionName || div.division,
                        fields: (div.checkedFields || []).map(f => ({
                          id: f.field_id || f.id,
                          field: f.field_name || f.field,
                          field_short_name: f.field_short_name || f.field_name || f.field,
                          area: f.field_area || f.area,
                          activated: f.activated
                        }))
                      }));
                    }
                    
                    // If no divisions but we have fields directly
                    if (divisions.length === 0 && planDetails.fields) {
                      divisions = [{
                        id: 'all',
                        division: 'All Fields',
                        fields: planDetails.fields
                      }];
                    }

                    if (divisions.length > 0) {
                      return (
                        <div className="plantation-plan-divisions-list">
                          {divisions.map((div, divIndex) => {
                            const totalArea = (div.fields || []).reduce((sum, f) => {
                              const area = Number(f.area || f.field_area || 0);
                              return sum + (f.activated !== 0 ? area : 0);
                            }, 0);
                            const activeFields = (div.fields || []).filter(f => f.activated !== 0);
                            
                            return (
                              <div key={div.id || divIndex} className="plantation-plan-division-card">
                                <div className="plantation-plan-division-header">
                                  <span className="plantation-plan-division-title">
                                    {div.division || div.divisionName || 'Division'} - {totalArea.toFixed(2)} Ha
                                  </span>
                                  <span className="plantation-plan-division-count">
                                    {activeFields.length} {activeFields.length === 1 ? 'field' : 'fields'}
                                  </span>
                                </div>
                                {activeFields.length > 0 ? (
                                  <div className="plantation-plan-fields-grid">
                                    {activeFields.map((f, fieldIndex) => {
                                      const fieldArea = parseFloat(f.area || f.field_area || 0).toFixed(2);
                                      const fieldName = f.field_short_name || f.field_name || f.field || `Field ${f.id || fieldIndex}`;
                                      
                                      return (
                                        <div
                                          key={f.id || f.field_id || fieldIndex}
                                          className={`plantation-plan-field-tile plantation-plan-field-active`}
                                          title={f.field_name || f.field || fieldName}
                                        >
                                          <div className="plantation-plan-field-tile-name">
                                            {fieldName}
                                          </div>
                                          <div className="plantation-plan-field-tile-area">{fieldArea} Ha</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="plantation-plan-no-fields">No active fields in this division.</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    
                    // Fallback: Show message if no divisions/fields found
                    return (
                      <div className="plantation-plan-no-divisions">
                        <p>No field details available for this plan.</p>
                        <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                          Plan ID: {selectedPlan.id}
                        </p>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="plantation-plan-modal-footer">
              <button className="plantation-plan-modal-close-btn" onClick={() => setSelectedPlan(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pilot Details Modal */}
      {showPilotModal && selectedPlan && (
        <div className="plantation-plan-modal-overlay" onClick={() => setShowPilotModal(false)}>
          <div className="plantation-plan-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="plantation-plan-modal-header">
              <div className="plantation-plan-modal-title-group">
                <div className="plantation-plan-modal-title">Pilot and Equipment Details</div>
                <div className="plantation-plan-modal-subtitle">
                  Plan #{selectedPlan.id} · {selectedPlan.estate_name}
                </div>
              </div>
              <button className="plantation-plan-modal-close" onClick={() => setShowPilotModal(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="plantation-plan-modal-body">
              {pilotLoading && <div className="plantation-plan-contacts-loading">Loading...</div>}
              {pilotError && <div className="plantation-plan-contacts-error">{pilotError}</div>}
              {!pilotLoading && !pilotError && pilotInfo && (
                <div className="plantation-plan-pilot-wrap">
                  {pilotInfo.team_lead && (
                    <div className="plantation-plan-pilot-section">
                      <div className="plantation-plan-contacts-section-title">Team Lead</div>
                      <div className="plantation-plan-contact-row">
                        <div className="plantation-plan-contact-row-left">
                          <div className="plantation-plan-contact-row-name">{pilotInfo.team_lead}</div>
                          <div className="plantation-plan-contact-row-role">Team Lead</div>
                        </div>
                        {pilotInfo.team_lead_mobile && (
                          <a className="plantation-plan-contact-row-phone" href={`tel:${pilotInfo.team_lead_mobile}`}>
                            {pilotInfo.team_lead_mobile}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {Array.isArray(pilotInfo.pilots) && pilotInfo.pilots.length > 0 && (
                    <div className="plantation-plan-pilot-section">
                      <div className="plantation-plan-contacts-section-title">Pilots</div>
                      <div className="plantation-plan-contacts-list">
                        {pilotInfo.pilots.map((p) => (
                          <div key={p.pilot_id} className="plantation-plan-contact-row">
                            <div className="plantation-plan-contact-row-left">
                              <div className="plantation-plan-contact-row-name">{p.pilot}</div>
                              <div className="plantation-plan-contact-row-role">
                                {p.is_leader === 1 ? 'Leader' : 'Pilot'}
                              </div>
                            </div>
                            {p.mobile && (
                              <a className="plantation-plan-contact-row-phone" href={`tel:${p.mobile}`}>
                                {p.mobile}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(pilotInfo.equipment) && pilotInfo.equipment.length > 0 && (
                    <div className="plantation-plan-pilot-section">
                      <div className="plantation-plan-contacts-section-title">Equipment</div>
                      <div className="plantation-plan-contacts-list">
                        {pilotInfo.equipment.map((eq) => (
                          <div key={eq.equipment_id} className="plantation-plan-contact-row">
                            <div className="plantation-plan-contact-row-left">
                              <div className="plantation-plan-contact-row-name">{eq.equipment_name || eq.equipment}</div>
                              <div className="plantation-plan-contact-row-role">
                                {eq.equipment_type || 'Equipment'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!pilotInfo.team_lead && (!Array.isArray(pilotInfo.pilots) || pilotInfo.pilots.length === 0)) && (
                    <div className="plantation-plan-contacts-empty">No pilot or equipment details available.</div>
                  )}
                </div>
              )}
            </div>
            <div className="plantation-plan-modal-footer">
              <button className="plantation-plan-modal-close-btn" onClick={() => setShowPilotModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantationCalendar;
