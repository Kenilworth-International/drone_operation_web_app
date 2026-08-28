import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  FaCalendarAlt,
  FaPlus,
  FaEye,
  FaMapMarkerAlt,
  FaRulerCombined,
  FaCheckCircle,
  FaClock,
  FaClipboardList,
  FaHashtag,
} from 'react-icons/fa';
import { useGetPlansWithFieldsQuery } from '../../../api/services NodeJs/emergencyMovingApi';
import {
  useGetPlanEditContextQuery,
  useSubmitPlanEditMutation,
  useGetWebPlanCustomizationLogQuery,
} from '../../../api/services NodeJs/plantationEstateManagerApi';
import '../../../styles/dayendprocess.css';

const CustomDateInput = React.forwardRef(({ value, onClick }, ref) => (
  <div className="custom-date-input-pl-cuz" ref={ref} onClick={onClick}>
    <input type="text" value={value} readOnly className="date-picker-input-pl-cuz" />
    <FaCalendarAlt className="calendar-icon-pl-cuz" />
  </div>
));

const LoadingBlock = ({ label = 'Loading…' }) => (
  <div className="plan-customization-loading-block-pl-cuz" role="status" aria-live="polite">
    <div className="plan-customization-spinner-pl-cuz" aria-hidden />
    <span>{label}</span>
  </div>
);

const resolveFieldAreaHa = (row) => {
  const pdfArea = Number(row?.field_area);
  if (Number.isFinite(pdfArea) && pdfArea > 0) return pdfArea;
  const fieldArea = Number(row?.area);
  if (Number.isFinite(fieldArea) && fieldArea > 0) return fieldArea;
  return 0;
};

const PlanCustomization = () => {
  const navigate = useNavigate();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const dateString = selectedDate.toISOString().split('T')[0];
  const { data: plansData = [], isLoading: plansLoading, isFetching: plansFetching } =
    useGetPlansWithFieldsQuery(dateString);

  const selectedPlanId = selectedPlan?.id || 0;
  const {
    data: editContext,
    isLoading: editContextLoading,
    isFetching: editContextFetching,
    error: editContextError,
    refetch: refetchEditContext,
  } = useGetPlanEditContextQuery(selectedPlanId, {
    skip: !selectedPlanId,
    refetchOnMountOrArgChange: true,
  });

  const [submitPlanEdit] = useSubmitPlanEditMutation();
  const { data: logData, isLoading: logLoading } = useGetWebPlanCustomizationLogQuery(selectedPlanId, {
    skip: !selectedPlanId,
  });

  const plans = plansData || [];
  const editContextPayload = editContext?.data || editContext || {};
  const editContextBusy = editContextLoading || editContextFetching;

  const divisionNameMap = useMemo(() => {
    const map = {};
    (editContextPayload?.divisions || []).forEach((d) => {
      if (d?.id != null && d?.division) {
        map[String(d.id)] = String(d.division);
      }
    });
    return map;
  }, [editContextPayload]);

  const resolveDivisionName = useCallback(
    (divisionId) => {
      if (divisionId == null || divisionId === '' || divisionId === 0 || divisionId === '0') {
        return 'Unassigned';
      }
      const name = divisionNameMap[String(divisionId)];
      return name || `Division ${divisionId}`;
    },
    [divisionNameMap]
  );

  /** Authoritative current fields from plan_division_fields (correct fieldId + area). */
  const currentPlanFields = useMemo(() => {
    const rows = editContextPayload?.activePlanFields;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((row) => ({
        fieldId: Number(row.fieldId),
        field_name: row.field || '-',
        short_name: row.short_name || '-',
        areaHa: resolveFieldAreaHa(row),
        division_id: row.division,
        pilot_name: row.pilot_name || '-',
        drone_serial: row.drone_serial || row.drone_tag || '-',
        pdf_id: row.pdf_id,
      }));
    }
    // Fallback while edit context loads — use field_id not task id
    return (selectedPlan?.fields || []).map((row) => ({
      fieldId: Number(row.field_id) || parseInt(String(row.field || ''), 10) || null,
      field_name: row.field_name || row.field || '-',
      short_name: row.field_short_name || row.short_name || '-',
      areaHa: resolveFieldAreaHa(row),
      division_id: row.division_id || row.division,
      pilot_name: row.pilot_name || '-',
      drone_serial: row.drone_serial || row.drone_tag || '-',
      pdf_id: row.task_id || row.id,
    }));
  }, [editContextPayload, selectedPlan]);

  const availableFields = useMemo(() => {
    if (!editContextPayload?.fields || !editContextPayload?.activePlanFieldIds) return [];
    const currentFieldIds = new Set(editContextPayload.activePlanFieldIds.map((id) => Number(id)));
    return editContextPayload.fields.filter((f) => !currentFieldIds.has(Number(f.id)));
  }, [editContextPayload]);

  const calculatedTotalArea = useMemo(
    () => currentPlanFields.reduce((sum, f) => sum + (Number(f.areaHa) || 0), 0).toFixed(2),
    [currentPlanFields]
  );

  const changeLog = useMemo(() => {
    if (!logData) return [];
    if (Array.isArray(logData)) return logData;
    if (Array.isArray(logData?.data)) return logData.data;
    return [];
  }, [logData]);

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setSelectedFieldIds([]);
    setShowAddFieldModal(false);
  };

  const handleAddField = async () => {
    if (!selectedPlan || selectedFieldIds.length === 0 || !editContextPayload?.timeOfDayId) return;
    setSubmitting(true);
    try {
      const currentFieldIds = (editContextPayload?.activePlanFieldIds || []).map((id) => Number(id));
      const mergedFieldIds = Array.from(
        new Set([...currentFieldIds, ...selectedFieldIds.map((id) => Number(id))])
      ).filter((id) => Number.isFinite(id) && id > 0);

      await submitPlanEdit({
        planId: selectedPlan.id,
        fieldIds: mergedFieldIds,
        timeOfDayId: editContextPayload.timeOfDayId,
        chemicals: editContextPayload.chemicalLines || [],
      }).unwrap();

      setShowAddFieldModal(false);
      setSelectedFieldIds([]);
      await refetchEditContext();
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
    if (plan.activated === 0 || plan.activated === '0') {
      return <span className="status-badge-pl-cuz status-cancelled-pl-cuz">Cancelled</span>;
    }
    return <span className="status-badge-pl-cuz status-pending-pl-cuz">Pending</span>;
  };

  const groupedCurrentFields = useMemo(() => {
    return currentPlanFields.reduce((acc, field) => {
      const divisionName = resolveDivisionName(field.division_id);
      if (!acc[divisionName]) acc[divisionName] = [];
      acc[divisionName].push(field);
      return acc;
    }, {});
  }, [currentPlanFields, resolveDivisionName]);

  const groupedAvailableFields = useMemo(() => {
    return availableFields.reduce((acc, field) => {
      const divisionName = resolveDivisionName(field.division || field.division_id);
      if (!acc[divisionName]) acc[divisionName] = [];
      acc[divisionName].push(field);
      return acc;
    }, {});
  }, [availableFields, resolveDivisionName]);

  return (
    <div className="plan-customization-pl-cuz">
      <div className="plan-customization-header-pl-cuz">
        <button className="plan-customization-back-btn-pl-cuz" onClick={() => navigate(-1)} title="Go back">
          <span className="back-btn-icon-pl-cuz">←</span>
        </button>
        <h1 className="plan-customization-title-pl-cuz">Plan Customization</h1>
      </div>

      <div className="plan-customization-date-picker-pl-cuz">
        <label htmlFor="plan-customization-date-pl-cuz" className="date-label-pl-cuz">
          Plan Date:
        </label>
        <DatePicker
          id="plan-customization-date-pl-cuz"
          selected={selectedDate}
          onChange={(date) => {
            setSelectedDate(date);
            setSelectedPlan(null);
            setShowAddFieldModal(false);
          }}
          dateFormat="yyyy/MM/dd"
          customInput={<CustomDateInput />}
        />
      </div>

      {plansLoading || plansFetching ? (
        <LoadingBlock label="Loading plans for selected date…" />
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
              <button className="plan-customization-modal-close-pl-cuz" onClick={() => setSelectedPlan(null)}>
                ×
              </button>
            </div>
            <div className="plan-customization-modal-body-pl-cuz">
              <div className="plan-customization-meta-pl-cuz">
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaMapMarkerAlt /> <strong>Estate:</strong> {selectedPlan.estate_name || '-'}
                </div>
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaRulerCombined /> <strong>Plan area:</strong> {Number(selectedPlan.totalExtent || 0).toFixed(2)} Ha
                </div>
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaRulerCombined /> <strong>Fields total:</strong>{' '}
                  {editContextBusy ? '…' : `${calculatedTotalArea} Ha`}
                </div>
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaCheckCircle /> <strong>Manager Approval:</strong>{' '}
                  {Number(selectedPlan.manager_approval) === 1 ? 'Yes' : 'No'}
                </div>
                <div className="plan-customization-meta-item-pl-cuz">
                  <FaClock /> <strong>Status:</strong>{' '}
                  {selectedPlan.activated === 0 || selectedPlan.activated === '0'
                    ? 'Cancelled'
                    : Number(selectedPlan.manager_approval) === 1
                      ? 'Approved'
                      : 'Pending'}
                </div>
              </div>

              <h3 className="plan-customization-subtitle-pl-cuz">Current Fields</h3>

              {editContextBusy ? (
                <LoadingBlock label="Loading field details…" />
              ) : editContextError ? (
                <div className="plan-customization-error-box-pl-cuz">
                  <p className="plan-customization-status-text-pl-cuz">Failed to load field details.</p>
                  <button className="plan-customization-retry-btn-pl-cuz" onClick={() => refetchEditContext()}>
                    Retry
                  </button>
                </div>
              ) : currentPlanFields.length === 0 ? (
                <p className="plan-customization-empty-pl-cuz">No fields assigned to this plan.</p>
              ) : (
                <div className="plan-customization-table-wrap-pl-cuz">
                  <table className="plan-customization-table-pl-cuz plan-customization-fields-table-pl-cuz">
                    <thead>
                      <tr>
                        <th>Field ID</th>
                        <th>Field Name</th>
                        <th>Short Name</th>
                        <th>Area (Ha)</th>
                        <th>Pilot</th>
                        <th>Drone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedCurrentFields).map(([divisionName, group]) => (
                        <React.Fragment key={divisionName}>
                          <tr className="division-group-header-pl-cuz">
                            <td colSpan={6}>{divisionName}</td>
                          </tr>
                          {group.map((field) => (
                            <tr key={field.pdf_id || field.fieldId}>
                              <td>
                                <span className="plan-customization-field-id-pl-cuz">
                                  <FaHashtag aria-hidden /> {field.fieldId ?? '—'}
                                </span>
                              </td>
                              <td>{field.field_name}</td>
                              <td>{field.short_name}</td>
                              <td>{Number(field.areaHa || 0).toFixed(2)}</td>
                              <td>{field.pilot_name}</td>
                              <td>{field.drone_serial}</td>
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
                  {editContextBusy ? (
                    <LoadingBlock label="Loading available fields to add…" />
                  ) : editContextError ? (
                    <div className="plan-customization-error-box-pl-cuz">
                      <p className="plan-customization-status-text-pl-cuz">Failed to load available fields.</p>
                      <button className="plan-customization-retry-btn-pl-cuz" onClick={() => refetchEditContext()}>
                        Retry
                      </button>
                    </div>
                  ) : availableFields.length === 0 ? (
                    <p className="plan-customization-status-text-pl-cuz">
                      No more fields available to add for this estate.
                    </p>
                  ) : (
                    <button className="plan-customization-add-btn-pl-cuz" onClick={() => setShowAddFieldModal(true)}>
                      <FaPlus /> Add Field ({availableFields.length} available)
                    </button>
                  )}
                </div>
              )}

              {logLoading ? (
                <LoadingBlock label="Loading change log…" />
              ) : changeLog.length > 0 ? (
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
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showAddFieldModal && (
        <div className="plan-customization-modal-overlay-pl-cuz plan-customization-modal-overlay-top-pl-cuz">
          <div className="plan-customization-modal-pl-cuz plan-customization-modal-wide-pl-cuz">
            <div className="plan-customization-modal-title-pl-cuz">
              <span>Add Fields to Plan #{selectedPlan?.id}</span>
              <button
                className="plan-customization-modal-close-pl-cuz"
                onClick={() => {
                  setShowAddFieldModal(false);
                  setSelectedFieldIds([]);
                }}
              >
                ×
              </button>
            </div>
            <div className="plan-customization-modal-body-pl-cuz">
              {editContextBusy ? (
                <LoadingBlock label="Loading available fields…" />
              ) : (
                <>
                  <p className="plan-customization-add-hint-pl-cuz">
                    Select fields to add. Each row shows the <strong>Field ID</strong> from the master fields table.
                  </p>
                  <div className="plan-customization-available-fields-pl-cuz">
                    {Object.entries(groupedAvailableFields).map(([divisionName, group]) => (
                      <div key={divisionName} className="plan-customization-division-group-pl-cuz">
                        <div className="plan-customization-division-title-pl-cuz">{divisionName}</div>
                        <div className="plan-customization-fields-grid-pl-cuz">
                          {group.map((field) => {
                            const fieldId = Number(field.id);
                            const areaHa = resolveFieldAreaHa(field);
                            const isChecked = selectedFieldIds.includes(fieldId);
                            return (
                              <label
                                key={fieldId}
                                className={`plan-customization-field-option-pl-cuz${isChecked ? ' is-selected-pl-cuz' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    setSelectedFieldIds((prev) =>
                                      e.target.checked
                                        ? [...prev, fieldId]
                                        : prev.filter((id) => id !== fieldId)
                                    );
                                  }}
                                />
                                <span className="plan-customization-field-option-body-pl-cuz">
                                  <span className="plan-customization-field-id-pl-cuz">
                                    <FaHashtag aria-hidden /> {fieldId}
                                  </span>
                                  <span className="plan-customization-field-name-pl-cuz">
                                    {field.short_name || field.field || `Field ${fieldId}`}
                                  </span>
                                  <span className="plan-customization-field-area-pl-cuz">
                                    {areaHa.toFixed(2)} Ha
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="plan-customization-modal-actions-pl-cuz">
              <span className="plan-customization-selection-count-pl-cuz">
                {selectedFieldIds.length} field{selectedFieldIds.length === 1 ? '' : 's'} selected
              </span>
              <div className="plan-customization-modal-actions-buttons-pl-cuz">
                <button
                  className="plan-customization-cancel-btn-pl-cuz"
                  onClick={() => {
                    setShowAddFieldModal(false);
                    setSelectedFieldIds([]);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="plan-customization-save-btn-pl-cuz"
                  onClick={handleAddField}
                  disabled={submitting || selectedFieldIds.length === 0 || editContextBusy}
                >
                  {submitting ? 'Saving…' : 'Add Selected'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanCustomization;
