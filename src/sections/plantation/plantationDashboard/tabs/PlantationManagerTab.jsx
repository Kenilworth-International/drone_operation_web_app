import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parse } from 'date-fns';
import { toast } from 'react-toastify';
import {
  useGetPendingManagerPlansQuery,
  useGetAllManagerPlansQuery,
  useGetManagerPlanDetailQuery,
  useCancelManagerPlanMutation,
  useGetManagerCancelReasonsQuery,
} from '../../../../api/services NodeJs/plantationEstateManagerApi';
import {
  useGetManagerRescheduleReasonsQuery,
  useCreateManagerPlanRescheduleRequestMutation,
} from '../../../../api/services NodeJs/plantationDashboardApi';
import SingleMonthPicker from '../components/SingleMonthPicker';
import { Bars } from 'react-loader-spinner';
import '../../../../styles/plantationDashboard.css';

const BASE = '/home/plantation-dashboard';

function missionLabel(id) {
  const m = String(id || '').toLowerCase();
  if (m === 'spy') return 'Spray';
  if (m === 'spd') return 'Spread';
  return id || '—';
}

export default function PlantationManagerTab() {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState('pending');
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [detailPlanId, setDetailPlanId] = useState(null);
  const [cancelPlanId, setCancelPlanId] = useState(null);
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [reschedulePlan, setReschedulePlan] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReasonId, setRescheduleReasonId] = useState('');

  const { data: pendingRaw, isLoading: pendingLoading, refetch: refetchPending } = useGetPendingManagerPlansQuery();
  const pending = Array.isArray(pendingRaw?.data?.data)
    ? pendingRaw.data.data
    : Array.isArray(pendingRaw?.data)
      ? pendingRaw.data
      : Array.isArray(pendingRaw)
        ? pendingRaw
        : [];

  const { data: allRaw, isLoading: allLoading, refetch: refetchAll } = useGetAllManagerPlansQuery({ yearMonth });
  const allPlans = allRaw?.data?.plans || allRaw?.data?.data?.plans || allRaw?.plans || [];

  const { data: detailRaw, isFetching: detailLoading } = useGetManagerPlanDetailQuery(detailPlanId, {
    skip: !detailPlanId,
  });
  const detail = detailRaw?.data || detailRaw;

  const { data: cancelReasons = [] } = useGetManagerCancelReasonsQuery(undefined, { skip: !cancelPlanId });
  const { data: rescheduleReasons = [] } = useGetManagerRescheduleReasonsQuery(undefined, { skip: !reschedulePlan });
  const [cancelPlan, { isLoading: cancelling }] = useCancelManagerPlanMutation();
  const [rescheduleRequest, { isLoading: rescheduling }] = useCreateManagerPlanRescheduleRequestMutation();

  const monthDate = useMemo(() => parse(`${yearMonth}-01`, 'yyyy-MM-dd', new Date()), [yearMonth]);

  const handleCancel = async () => {
    if (!cancelPlanId || !cancelReasonId) return;
    try {
      await cancelPlan({ planId: cancelPlanId, managerCancelReasonId: Number(cancelReasonId) }).unwrap();
      toast.success('Plan cancelled.');
      setCancelPlanId(null);
      refetchPending();
      refetchAll();
    } catch (err) {
      toast.error(err?.data?.message || 'Cancel failed.');
    }
  };

  const handleReschedule = async () => {
    if (!reschedulePlan?.id || !rescheduleDate || !rescheduleReasonId) return;
    try {
      await rescheduleRequest({
        planId: reschedulePlan.id,
        requestedPickedDate: rescheduleDate,
        rescheduleReasonId: Number(rescheduleReasonId),
      }).unwrap();
      toast.success('Reschedule request submitted.');
      setReschedulePlan(null);
      refetchPending();
    } catch (err) {
      toast.error(err?.data?.message || 'Reschedule failed.');
    }
  };

  return (
    <div className="plantation-manager-tab">
      <h1 className="plantation-home-tab-title">Manager</h1>
      <div className="pd-calendar-segments">
        <button
          type="button"
          className={`plantation-action-btn ${subTab === 'pending' ? 'active' : ''}`}
          onClick={() => setSubTab('pending')}
        >
          Pending ({pending.length})
        </button>
        <button
          type="button"
          className={`plantation-action-btn ${subTab === 'all' ? 'active' : ''}`}
          onClick={() => setSubTab('all')}
        >
          All plans
        </button>
      </div>

      {subTab === 'pending' ? (
        pendingLoading ? (
          <Bars height={32} width={48} color="#2d6a4f" />
        ) : pending.length === 0 ? (
          <p className="pd-popup-empty">No plans waiting for approval.</p>
        ) : (
          <div className="pd-manager-list">
            {pending.map((plan) => (
              <div key={plan.id} className="pd-manager-card">
                <div>
                  <strong>{plan.pickedDate}</strong> · {missionLabel(plan.missionTypeId)} ·{' '}
                  {parseFloat(plan.totalExtent || 0).toFixed(2)} Ha
                </div>
                {plan.approve_blocked_reason ? (
                  <p className="pd-manager-blocked">{plan.approve_blocked_reason.replace(/_/g, ' ')}</p>
                ) : null}
                <div className="pd-manager-card-actions">
                  {Number(plan.can_approve) === 1 ? (
                    <button
                      type="button"
                      className="pd-calendar-btn"
                      onClick={() => navigate(`${BASE}/manager/approve/${plan.id}`)}
                    >
                      Approve
                    </button>
                  ) : null}
                  <button type="button" className="plantation-action-btn" onClick={() => setDetailPlanId(plan.id)}>
                    View
                  </button>
                  <button type="button" className="plantation-action-btn" onClick={() => setCancelPlanId(plan.id)}>
                    Cancel
                  </button>
                  <button type="button" className="plantation-action-btn" onClick={() => setReschedulePlan(plan)}>
                    Reschedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="pd-manager-month-picker">
            <SingleMonthPicker
              selectedMonth={monthDate}
              onChange={(d) => setYearMonth(format(d, 'yyyy-MM'))}
            />
          </div>
          {allLoading ? (
            <Bars height={32} width={48} color="#2d6a4f" />
          ) : allPlans.length === 0 ? (
            <p className="pd-popup-empty">No plans for this month.</p>
          ) : (
            <div className="pd-manager-list">
              {allPlans.map((plan) => (
                <div key={plan.id} className="pd-manager-card">
                  <div>
                    <strong>{plan.pickedDate}</strong> · {missionLabel(plan.missionTypeId)} ·{' '}
                    {parseFloat(plan.totalExtent || 0).toFixed(2)} Ha
                  </div>
                  <div className="pd-manager-card-actions">
                    <button type="button" className="plantation-action-btn" onClick={() => setDetailPlanId(plan.id)}>
                      View
                    </button>
                    {Number(plan.can_edit) === 1 ? (
                      <button
                        type="button"
                        className="pd-calendar-btn"
                        onClick={() => navigate(`${BASE}/manager/edit/${plan.id}`)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {detailPlanId ? (
        <div className="pd-popup-overlay" onClick={() => setDetailPlanId(null)}>
          <div className="pd-popup" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header">
              <span className="pd-popup-title">Plan #{detailPlanId}</span>
            </div>
            <div className="pd-popup-body">
              {detailLoading ? (
                <Bars height={24} width={40} color="#2d6a4f" />
              ) : detail ? (
                <>
                  <p>Date: {detail.plan?.pickedDate}</p>
                  <p>Fields: {(detail.fields || []).length}</p>
                  <p>Time: {detail.timeOfDayLabel || '—'}</p>
                </>
              ) : (
                <p>Could not load plan.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {cancelPlanId ? (
        <div className="pd-popup-overlay" onClick={() => setCancelPlanId(null)}>
          <div className="pd-popup pd-popup--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header"><span className="pd-popup-title">Cancel plan</span></div>
            <div className="pd-popup-body">
              <select value={cancelReasonId} onChange={(e) => setCancelReasonId(e.target.value)}>
                <option value="">Select reason</option>
                {(cancelReasons || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.recen || r.reason || r.id}</option>
                ))}
              </select>
              <div className="pd-form-actions">
                <button type="button" className="plantation-action-btn" onClick={() => setCancelPlanId(null)}>Close</button>
                <button type="button" className="pd-calendar-btn" disabled={cancelling} onClick={handleCancel}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reschedulePlan ? (
        <div className="pd-popup-overlay" onClick={() => setReschedulePlan(null)}>
          <div className="pd-popup pd-popup--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header"><span className="pd-popup-title">Reschedule plan</span></div>
            <div className="pd-popup-body">
              <label className="pd-form-label">New date<input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} /></label>
              <select value={rescheduleReasonId} onChange={(e) => setRescheduleReasonId(e.target.value)}>
                <option value="">Select reason</option>
                {(rescheduleReasons || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.recen || r.reason || r.id}</option>
                ))}
              </select>
              <div className="pd-form-actions">
                <button type="button" className="plantation-action-btn" onClick={() => setReschedulePlan(null)}>Close</button>
                <button type="button" className="pd-calendar-btn" disabled={rescheduling} onClick={handleReschedule}>Submit</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
