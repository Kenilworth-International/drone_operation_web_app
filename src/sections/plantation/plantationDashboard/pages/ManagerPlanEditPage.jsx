import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ManagerPlanEditModal from '../components/manager/ManagerPlanEditModal';

const BASE = '/home/plantation-dashboard';

/** Deep-link route: opens edit wizard as a modal over the manager tab shell. */
export default function ManagerPlanEditPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const numericId = Number(planId);

  return (
    <ManagerPlanEditModal
      open={Number.isFinite(numericId) && numericId > 0}
      planId={numericId}
      onClose={() => navigate(`${BASE}/manager`)}
      onSuccess={() => navigate(`${BASE}/manager`)}
    />
  );
}
