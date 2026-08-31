import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import { Bars } from 'react-loader-spinner';
import {
  useGetFieldMissionAvailabilityQuery,
  useLazyGetFieldMissionAvailabilityQuery,
} from '../../../../api/services NodeJs/plantationDashboardApi';
import { usePlantationSession } from '../../hooks/usePlantationSession';
import FieldUnblockRequestModal from '../components/FieldUnblockRequestModal';
import '../../../../styles/plantationDashboard.css';

export default function FieldAvailabilityPage({ basePath = '/home/plantation-dashboard' }) {
  const navigate = useNavigate();
  const { isEstateManager } = usePlantationSession();
  const [missionTab, setMissionTab] = useState('spy');
  const [unblockField, setUnblockField] = useState(null);

  const [fetchAvailability, { data, isFetching }] = useLazyGetFieldMissionAvailabilityQuery();
  const { data: rootData, isLoading } = useGetFieldMissionAvailabilityQuery({});

  const payload = data || rootData;
  const blockedFields =
    missionTab === 'spy' ? payload?.blockedSprayFields || [] : payload?.blockedSpreadFields || [];

  const openNode = (node) => {
    fetchAvailability({
      drillLevel: payload?.scopeLevel === 'group' ? 'plantation' : payload?.scopeLevel === 'plantation' ? 'region' : 'estate',
      drillId: node.id,
    });
  };

  const goBack = () => {
    const crumbs = payload?.breadcrumbs || [];
    if (crumbs.length <= 1) {
      fetchAvailability({});
      return;
    }
    const parent = crumbs[crumbs.length - 2];
    fetchAvailability({ drillLevel: parent.level, drillId: parent.id });
  };

  return (
    <div className="plantation-dashboard-container">
      <div className="pd-page-topbar">
        <button type="button" className="pd-back-btn" onClick={() => navigate(basePath)}>
          <FaArrowLeft /> Back
        </button>
        <h1>Field availability</h1>
      </div>

      <div className="pd-field-avail-tabs">
        <button
          type="button"
          className={`plantation-action-btn ${missionTab === 'spy' ? 'active' : ''}`}
          onClick={() => setMissionTab('spy')}
        >
          Spray
        </button>
        <button
          type="button"
          className={`plantation-action-btn ${missionTab === 'spd' ? 'active' : ''}`}
          onClick={() => setMissionTab('spd')}
        >
          Spread
        </button>
      </div>

      {(isLoading || isFetching) && !payload ? (
        <div className="pd-field-avail-loading">
          <Bars height={32} width={48} color="#2d6a4f" />
        </div>
      ) : (
        <>
          {(payload?.breadcrumbs?.length || 0) > 1 ? (
            <button type="button" className="pd-field-avail-back-level" onClick={goBack}>
              ← Up one level
            </button>
          ) : null}

          {payload?.view === 'nodes' && (payload?.nodes || []).length > 0 ? (
            <div className="pd-field-avail-nodes">
              {payload.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="pd-field-avail-node"
                  onClick={() => openNode(node)}
                >
                  <strong>{node.name}</strong>
                  <span>
                    {node.canSprayCount}/{node.totalFields} spray · {node.canSpreadCount}/{node.totalFields} spread
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="pd-field-avail-blocked-list">
            <h3>Blocked fields ({blockedFields.length})</h3>
            {blockedFields.length === 0 ? (
              <p className="pd-popup-empty">No blocked fields in this view.</p>
            ) : (
              blockedFields.map((f) => (
                <div key={`${f.id}-${missionTab}`} className="pd-field-avail-blocked-row">
                  <div>
                    <strong>{f.fieldName || f.shortName}</strong>
                    <div className="pd-field-avail-blocked-meta">
                      {f.estateName} · {parseFloat(f.area || 0).toFixed(2)} Ha
                    </div>
                    {f.reason ? <div className="pd-cancel-reason">{f.reason}</div> : null}
                  </div>
                  {isEstateManager && payload?.canRequestUnblock && !f.pendingUnblockRequestId ? (
                    <button
                      type="button"
                      className="pd-calendar-btn"
                      onClick={() => setUnblockField({ ...f, missionType: missionTab })}
                    >
                      Request unblock
                    </button>
                  ) : null}
                  {f.pendingUnblockRequestId ? (
                    <span className="pd-field-avail-pending">Unblock pending</span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {unblockField ? (
        <FieldUnblockRequestModal
          field={unblockField}
          onClose={() => setUnblockField(null)}
          onSuccess={() => {
            setUnblockField(null);
            fetchAvailability({});
          }}
        />
      ) : null}
    </div>
  );
}
