import React, { useMemo, useState } from 'react';
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
import PlantationPageLayout from '../components/PlantationPageLayout';
import ManagerPlanCard from '../components/manager/ManagerPlanCard';
import ManagerPlanDetailModal from '../components/manager/ManagerPlanDetailModal';
import ManagerPlanApproveModal from '../components/manager/ManagerPlanApproveModal';
import ManagerPlanEditModal from '../components/manager/ManagerPlanEditModal';
import ManagerCancelModal from '../components/manager/ManagerCancelModal';
import ManagerRescheduleModal from '../components/manager/ManagerRescheduleModal';
import { Bars } from 'react-loader-spinner';
import '../../../../styles/plantationDashboard.css';

function normalizeList(raw) {
  if (Array.isArray(raw?.data?.data)) return raw.data.data;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw)) return raw;
  return [];
}

export default function PlantationManagerTab() {
  const [subTab, setSubTab] = useState('pending');
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [viewPlan, setViewPlan] = useState(null);
  const [approvePlanId, setApprovePlanId] = useState(null);
  const [editPlanId, setEditPlanId] = useState(null);
  const [cancelPlanId, setCancelPlanId] = useState(null);
  const [reschedulePlan, setReschedulePlan] = useState(null);

  const { data: pendingRaw, isLoading: pendingLoading, refetch: refetchPending } = useGetPendingManagerPlansQuery();
  const pending = useMemo(() => normalizeList(pendingRaw), [pendingRaw]);

  const { data: allRaw, isLoading: allLoading, refetch: refetchAll } = useGetAllManagerPlansQuery({ yearMonth });
  const allPlans = allRaw?.data?.plans || allRaw?.data?.data?.plans || allRaw?.plans || [];

  const { data: detailRaw, isFetching: detailLoading } = useGetManagerPlanDetailQuery(viewPlan?.id, {
    skip: !viewPlan?.id,
  });
  const detail = detailRaw?.data || detailRaw;

  const { data: cancelReasonsRaw, isLoading: cancelReasonsLoading } = useGetManagerCancelReasonsQuery(undefined, {
    skip: !cancelPlanId,
  });
  const cancelReasons = cancelReasonsRaw?.data || cancelReasonsRaw || [];

  const { data: rescheduleReasonsRaw, isLoading: rescheduleReasonsLoading } = useGetManagerRescheduleReasonsQuery(
    undefined,
    { skip: !reschedulePlan }
  );
  const rescheduleReasons = rescheduleReasonsRaw?.data || rescheduleReasonsRaw || [];

  const [cancelPlan, { isLoading: cancelling }] = useCancelManagerPlanMutation();
  const [rescheduleRequest, { isLoading: rescheduling }] = useCreateManagerPlanRescheduleRequestMutation();

  const monthDate = useMemo(() => parse(`${yearMonth}-01`, 'yyyy-MM-dd', new Date()), [yearMonth]);

  const handleCancel = async (reasonId) => {
    if (!cancelPlanId || !reasonId) return;
    try {
      await cancelPlan({ planId: cancelPlanId, managerCancelReasonId: reasonId }).unwrap();
      toast.success('Plan cancelled.');
      setCancelPlanId(null);
      refetchPending();
      refetchAll();
    } catch (err) {
      toast.error(err?.data?.message || 'Cancel failed.');
    }
  };

  const handleReschedule = async ({ newDate, reasonId }) => {
    if (!reschedulePlan?.id || !newDate || !reasonId) return;
    try {
      await rescheduleRequest({
        planId: reschedulePlan.id,
        requestedPickedDate: newDate,
        rescheduleReasonId: reasonId,
      }).unwrap();
      toast.success('Reschedule request submitted.');
      setReschedulePlan(null);
      refetchPending();
    } catch (err) {
      toast.error(err?.data?.message || 'Reschedule failed.');
    }
  };

  const handleApproveSuccess = () => {
    refetchPending();
    refetchAll();
  };

  const handleEditSuccess = () => {
    refetchAll();
  };

  return (
    <PlantationPageLayout
      title="Manager"
      subtitle="Review, approve, and manage estate mission plans"
      className="plantation-manager-tab"
      flush
    >
      <div className="pd-mgr-segments" role="tablist" aria-label="Manager views">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'pending'}
          className={`pd-mgr-segment${subTab === 'pending' ? ' pd-mgr-segment--active' : ''}`}
          onClick={() => setSubTab('pending')}
        >
          Pending
          <span className="pd-mgr-segment-count">{pending.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'all'}
          className={`pd-mgr-segment${subTab === 'all' ? ' pd-mgr-segment--active' : ''}`}
          onClick={() => setSubTab('all')}
        >
          All plans
        </button>
      </div>

      {subTab === 'pending' ? (
        pendingLoading ? (
          <div className="pd-mgr-loading">
            <Bars height={32} width={48} color="#1b5e40" />
          </div>
        ) : pending.length === 0 ? (
          <div className="pd-mgr-empty">
            <p>No plans waiting for approval.</p>
          </div>
        ) : (
          <div className="pd-mgr-list">
            {pending.map((plan) => (
              <ManagerPlanCard
                key={plan.id}
                plan={plan}
                mode="pending"
                onApprove={(p) => setApprovePlanId(p.id)}
                onView={setViewPlan}
                onCancel={(p) => setCancelPlanId(p.id)}
                onReschedule={setReschedulePlan}
              />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="pd-mgr-month-toolbar">
            <SingleMonthPicker
              selectedMonth={monthDate}
              onChange={(d) => setYearMonth(format(d, 'yyyy-MM'))}
              monthsAhead={1}
            />
          </div>
          {allLoading ? (
            <div className="pd-mgr-loading">
              <Bars height={32} width={48} color="#1b5e40" />
            </div>
          ) : allPlans.length === 0 ? (
            <div className="pd-mgr-empty">
              <p>No plans for this month.</p>
            </div>
          ) : (
            <div className="pd-mgr-list">
              {allPlans.map((plan) => (
                <ManagerPlanCard
                  key={plan.id}
                  plan={plan}
                  mode="all"
                  onView={setViewPlan}
                  onEdit={(p) => setEditPlanId(p.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ManagerPlanApproveModal
        open={Boolean(approvePlanId)}
        planId={approvePlanId}
        onClose={() => setApprovePlanId(null)}
        onSuccess={handleApproveSuccess}
      />

      <ManagerPlanEditModal
        open={Boolean(editPlanId)}
        planId={editPlanId}
        onClose={() => setEditPlanId(null)}
        onSuccess={handleEditSuccess}
      />

      <ManagerPlanDetailModal
        open={Boolean(viewPlan)}
        planSummary={viewPlan}
        detail={detail}
        loading={detailLoading}
        onClose={() => setViewPlan(null)}
        onEdit={(planId) => {
          setViewPlan(null);
          setEditPlanId(planId);
        }}
      />

      <ManagerCancelModal
        open={Boolean(cancelPlanId)}
        planId={cancelPlanId}
        reasons={Array.isArray(cancelReasons) ? cancelReasons : []}
        reasonsLoading={cancelReasonsLoading}
        submitting={cancelling}
        onClose={() => setCancelPlanId(null)}
        onConfirm={handleCancel}
      />

      <ManagerRescheduleModal
        open={Boolean(reschedulePlan)}
        plan={reschedulePlan}
        reasons={Array.isArray(rescheduleReasons) ? rescheduleReasons : []}
        reasonsLoading={rescheduleReasonsLoading}
        submitting={rescheduling}
        onClose={() => setReschedulePlan(null)}
        onConfirm={handleReschedule}
      />
    </PlantationPageLayout>
  );
}
