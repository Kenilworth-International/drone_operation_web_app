import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ManagerPlanApproveModal from '../components/manager/ManagerPlanApproveModal';

const BASE = '/home/plantation-dashboard';

/** Deep-link route: opens approve wizard as a modal over the manager tab shell. */
export default function ManagerPlanApprovePage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const numericId = Number(planId);

  return (
    <ManagerPlanApproveModal
      open={Number.isFinite(numericId) && numericId > 0}
      planId={numericId}
      onClose={() => navigate(`${BASE}/manager`)}
      onSuccess={() => navigate(`${BASE}/manager`)}
    />
  );
}
