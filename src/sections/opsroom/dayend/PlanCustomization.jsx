import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaCalendarAlt, FaArrowLeft, FaPlus, FaEye, FaMapMarkerAlt, FaRulerCombined, FaCheckCircle, FaTimesCircle, FaClock, FaClipboardList } from 'react-icons/fa';
import { useGetPlansWithFieldsQuery } from '../../../api/services NodeJs/emergencyMovingApi';
import { useGetPlanEditContextQuery, useSubmitPlanEditMutation, useGetWebPlanCustomizationLogQuery } from '../../../api/services NodeJs/plantationEstateManagerApi';
import '../../../styles/dayendprocess.css';

const CustomDateInput = React.forwardRef(({ value, onClick }, ref) => (
  <div className="custom-date-input-pl-cuz" ref={ref} onClick={onClick}>
    <input type="text" value={value} readOnly className="date-picker-input-pl-cuz" />
    <FaCalendarAlt className="calendar-icon-pl-cuz" />
  </div>
));

const PlanCustomization = () => {
  const navigate = useNavigate();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const dateString = selectedDate.toISOString().split('T')[0];
  const { data: plansData = [], isLoading: plansLoading } = useGetPlansWithFieldsQuery(dateString);
  const { data: editContext, isLoading: editContextLoading, error: editContextError, refetch: refetchEditContext } = useGetPlanEditContextQuery(selectedPlan?.id || 0, { skip: !selectedPlan?.id });
  const [submitPlanEdit] = useSubmitPlanEditMutation();
  const { data: logData } = useGetWebPlanCustomizationLogQuery(selectedPlan?.id || 0, { skip: !selectedPlan?.id });

  const plans = plansData || [];
  const currentFields = selectedPlan?.fields || [];
  const editContextPayload = editContext?.data || editContext || {};
  const availableFields = useMemo(() => {
    if (!editContextPayload?.fields || !editContextPayload?.activePlanFieldIds) return [];
    const currentFieldIds = new Set(editContextPayload.activePlanFieldIds.map((id) => Number(id)));
    const available = editContextPayload.fields.filter((f) => !currentFieldIds.has(Number(f.id)));
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PlanCustomization] estateId:', editContextPayload.estate?.id, 'estateName:', editContextPayload.estate?.estate, 'fields:', editContextPayload.fields.length, 'activePlanFieldIds:', editContextPayload.activePlanFieldIds.length, 'available:', available.length, 'editContextKeys:', Object.keys(editContext || {}));
    }
    return available;
  }, [editContext]);

  const enrichedCurrentFields = useMemo(() => {
    const fieldMap = new Map();
    (editContextPayload?.fields || []).forEach((f) => {
      if (f?.id != null) {
        fieldMap.set(Number(f.id), f);
      }
    });
    return currentFields.map((field) => {
      const source = fieldMap.get(Number(field.id));
      if (source) {
        return {
          ...field,
          division_name: source.division_name || field.division_name,
          division_id: source.division_id || field.division_id,
          division: source.division || field.division,
        };
      }
      return field;
    });
  }, [currentFields, editContextPayload]);

  const divisionNameMap = useMemo(() => {
    const map = {};
    (editContextPayload?.divisions || []).forEach((d) => {
      if (d?.id != null && d?.division) {
        map[String(d.id)] = String(d.division);
      }
    });
    return map;
  }, [editContextPayload]);

  const resolveDivisionName = (divisionId) => {
    if (divisionId == null || divisionId === '' || divisionId === 0 || divisionId === '0') return 'Unassigned';
    const name = divisionNameMap[String(divisionId)];
    return name || `Division ${divisionId}`;
  };

  const calculatedTotalArea = useMemo(() => {
    return (currentFields || [])
      .reduce((sum, f) => sum + (Number(f.field_area || f.area || 0)), 0)
      .toFixed(2);
  }, [currentFields]);

  const changeLog = useMemo(() => {
    if (!logData) return [];
    if (Array.isArray(logData)) return logData;
    if (Array.isArray(logData?.data)) return logData.data;
    return [];
  }, [logData]);

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setSelectedFieldIds([]);
  };

  const handleAddField = async () => {
    if (!selectedPlan || selectedFieldIds.length === 0 || !editContextPayload?.timeOfDayId) return;
    setSubmitting(true);
    try {
      const currentFieldIds = (editContextPayload?.activePlanFieldIds || []).map((id) => Number(id));
      const mergedFieldIds = Array.from(new Set([...currentFieldIds, ...selectedFieldIds.map((id) => Number(id))])).filter((id) => Number.isFinite(id) && id > 0);
      await submitPlanEdit({
        planId: selectedPlan.id,
        fieldIds: mergedFieldIds,
        timeOfDayId: editContextPayload.timeOfDayId,
        chemicals: editContextPayload.chemicalLines || [],
      }).unwrap();
      setShowAddFieldModal(false);
      setSelectedFieldIds([]);
      alert('Fields added successfully');
    } catch (error) {
      alert(error?.data?.message || 'Failed to add fields');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (plan) => {
    const approval = Number(plan.manager_approval);
    if (approval === 1) return <span className="status-badge-pl-cuz status-approved-pl-cuz">Manager Approved</span>;
    if (plan.activated === 0 || plan.activated === '0') return <span className="status-badge-pl-cuz status-cancelled-pl-cuz">Cancelled</span>;
    return <span className="status-badge-pl-cuz status-pending-pl-cuz">Pending</span>;
  };

  return (
    <div className="plan-customization-pl-cuz">
      <div className="plan-customization-header-pl-cuz">
        <button className="plan-customization-back-btn-pl-cuz" onClick={() => navigate(-1)} title="Go back">
          <span className="back-btn-icon-pl-cuz">←</span>
        </button>
        <h1 className="plan-customization-title-pl-cuz">Plan Customization</h1>
      </div>

      <div className="plan-customization-date-picker-pl-cuz">
        <label htmlFor="plan-customization-date-pl-cuz" className="date-label-pl-cuz">Plan Date:</label>
        <DatePicker
          id="plan-customization-date-pl-cuz"
          selected={selectedDate}
          onChange={(date) => { setSelectedDate(date); setSelectedPlan(null); }}
          dateFormat="yyyy/MM/dd"
          customInput={<CustomDateInput />}
          // no date restriction — future dates allowed in web plan customization
        />
      </div>

      {plansLoading ? (
        <div className="plan-customization-loading-pl-cuz">Loading plans...</div>
      ) : (
        <div className="plan-customization-content-pl-cuz">
          <div className="plan-customization-section-pl-cuz">
            <h2 className="plan-customization-section-title-pl-cuz">
              <FaClipboardList /> Plans for {dateString}
            </h2>
            {plans.length === 0 ? (
              <p className="plan-customization-empty-pl-cuz">No plans found for this date.</p>
            ) : (
              <div className="plan-customization-table-wrap-pl-cuz">
                <table className="plan-customization-table-pl-cuz">
                  <thead>
                    <tr>
                      <th>Plan ID</th>
                      <th>Estate</th>
                      <th>Area (Ha)</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id} className={selectedPlan?.id === plan.id ? 'row-selected-pl-cuz' : ''}>
                        <td>#{plan.id}</td>
                        <td>{plan.estate_name || '-'}</td>
                        <td>{Number(plan.totalExtent || 0).toFixed(2)}</td>
                        <td>{getStatusBadge(plan)}</td>
                        <td>
                          <button className="plan-customization-view-btn-pl-cuz" onClick={() => handlePlanSelect(plan)}>
                            <FaEye /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
             )}
           </div>
         </div>
       )}

       {selectedPlan && (
        <div className="plan-customization-modal-overlay-pl-cuz">
          <div className="plan-customization-modal-pl-cuz plan-customization-modal-wide-pl-cuz">
            <div className="plan-customization-modal-title-pl-cuz">
              <span>Plan #{selectedPlan.id} Details</span>
              <button className="plan-customization-modal-close-pl-cuz" onClick={() => setSelectedPlan(null)}>×</button>
            </div>
            <div className="plan-customization-modal-body-pl-cuz">
              <div className="plan-customization-meta-pl-cuz">
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaMapMarkerAlt /> <strong>Estate:</strong> {selectedPlan.estate_name || '-'}
                </div>
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaRulerCombined /> <strong>Area:</strong> {Number(selectedPlan.totalExtent || 0).toFixed(2)} Ha
                </div>
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaCheckCircle /> <strong>Manager Approval:</strong> {Number(selectedPlan.manager_approval) === 1 ? 'Yes' : 'No'}
                </div>
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaClock /> <strong>Status:</strong> {selectedPlan.activated === 0 || selectedPlan.activated === '0' ? 'Cancelled' : Number(selectedPlan.manager_approval) === 1 ? 'Approved' : 'Pending'}
                </div>
              </div>

               <h3 className="plan-customization-subtitle-pl-cuz">Current Fields</h3>
               {enrichedCurrentFields.length === 0 ? (
                 <p className="plan-customization-empty-pl-cuz">No fields assigned to this plan.</p>
               ) : (
                 <div className="plan-customization-table-wrap-pl-cuz">
                   <table className="plan-customization-table-pl-cuz">
                      <tbody>
                        {Object.values(
                          enrichedCurrentFields.reduce((acc, field) => {
                            const divisionName = resolveDivisionName(field.division || field.division_id);
                            if (!acc[divisionName]) acc[divisionName] = [];
                            acc[divisionName].push(field);
                            return acc;
                          }, {})
                        ).map((group, groupIdx) => (
                          <React.Fragment key={groupIdx}>
                            <tr className="division-group-header-pl-cuz">
                              <td colSpan={7}>{group[0] ? resolveDivisionName(group[0].division || group[0].division_id) : 'Unknown Division'}</td>
                            </tr>
                            {group.map((field, idx) => (
                              <tr key={field.id || idx}>
                                <td></td>
                                <td>{field.field || `#${field.id}`}</td>
                                <td>{field.short_name || field.field_short_name || '-'}</td>
                                <td>{Number(field.field_area || field.area || 0).toFixed(2)}</td>
                                <td>{field.pilot_name || '-'}</td>
                                <td>{field.drone_serial || field.drone_tag || '-'}</td>
                                <td>{field.activated === 0 || field.activated === '0' ? 'Inactive' : 'Active'}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                   </table>
                 </div>
               )}

              {Number(selectedPlan.manager_approval) === 1 && (
                <div className="plan-customization-add-availability-pl-cuz">
                  {editContextLoading ? (
                    <p className="plan-customization-status-text-pl-cuz">Loading available fields...</p>
                  ) : editContextError ? (
                    <div className="plan-customization-error-box-pl-cuz">
                      <p className="plan-customization-status-text-pl-cuz">Failed to load available fields.</p>
                      <button className="plan-customization-retry-btn-pl-cuz" onClick={() => refetchEditContext()}>
                        Retry
                      </button>
                    </div>
                  ) : availableFields.length === 0 ? (
                    <div>
                      <p className="plan-customization-status-text-pl-cuz">No more fields available to add for this estate.</p>
                      {process.env.NODE_ENV !== 'production' && (
                        <p className="plan-customization-status-text-pl-cuz" style={{ fontSize: 12, opacity: 0.8 }}>
                          Diagnostics — estate: {editContextPayload?.estate?.id ?? 'unknown'}, total fields: {editContextPayload?.fields?.length ?? 0}, active fields: {editContextPayload?.activePlanFieldIds?.length ?? 0}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button className="plan-customization-add-btn-pl-cuz" onClick={() => setShowAddFieldModal(true)}>
                      <FaPlus /> Add Field
                    </button>
                  )}
                </div>
              )}

              {changeLog.length > 0 && (
                <div className="plan-customization-section-pl-cuz">
                  <h3 className="plan-customization-subtitle-pl-cuz">Change Log</h3>
                  <div className="plan-customization-table-wrap-pl-cuz">
                    <table className="plan-customization-table-pl-cuz">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Plan ID</th>
                          <th>Action</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changeLog.map((log, idx) => (
                          <tr key={log.id || idx}>
                            <td>{log.created_at || log.date || '-'}</td>
                            <td>#{log.plan_id || log.planId || '-'}</td>
                            <td>{log.action || '-'}</td>
                            <td>{log.details || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddFieldModal && (
        <div className="plan-customization-modal-overlay-pl-cuz">
          <div className="plan-customization-modal-pl-cuz plan-customization-modal-wide-pl-cuz">
            <div className="plan-customization-modal-title-pl-cuz">
              <span>Add Fields to Plan #{selectedPlan?.id}</span>
              <button className="plan-customization-modal-close-pl-cuz" onClick={() => { setShowAddFieldModal(false); setSelectedFieldIds([]); }}>×</button>
            </div>
            <div className="plan-customization-modal-body-pl-cuz">
              {editContextLoading ? (
                <p>Loading fields...</p>
              ) : (
                <div className="plan-customization-available-fields-pl-cuz">
                  {Object.values(
                    availableFields.reduce((acc, field) => {
                      const divisionName = resolveDivisionName(field.division || field.division_id);
                      if (!acc[divisionName]) acc[divisionName] = [];
                      acc[divisionName].push(field);
                      return acc;
                    }, {})
                  ).map((group, groupIdx) => (
                    <div key={groupIdx} className="plan-customization-division-group-pl-cuz">
                      <div className="plan-customization-division-title-pl-cuz">{group[0] ? resolveDivisionName(group[0].division || group[0].division_id) : 'Unknown Division'}</div>
                      <div className="plan-customization-fields-grid-pl-cuz">
                        {group.map((field) => (
                          <label key={field.id} className="plan-customization-field-option-pl-cuz">
                            <input
                              type="checkbox"
                              checked={selectedFieldIds.includes(field.id)}
                              onChange={(e) => {
                                setSelectedFieldIds((prev) =>
                                  e.target.checked ? [...prev, field.id] : prev.filter((id) => id !== field.id)
                                );
                              }}
                            />
                            <span>{field.short_name || field.field || `#${field.id}`} ({Number(field.area || 0).toFixed(2)} Ha)</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="plan-customization-modal-actions-pl-cuz">
              <button className="plan-customization-cancel-btn-pl-cuz" onClick={() => { setShowAddFieldModal(false); setSelectedFieldIds([]); }} disabled={submitting}>
                Cancel
              </button>
              <button className="plan-customization-save-btn-pl-cuz" onClick={handleAddField} disabled={submitting || selectedFieldIds.length === 0}>
                {submitting ? 'Saving...' : 'Add Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanCustomization;
