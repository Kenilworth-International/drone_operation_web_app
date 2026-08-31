import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaLeaf, FaChevronRight } from 'react-icons/fa';
import { Bars } from 'react-loader-spinner';
import { useGetFieldMissionAvailabilityQuery } from '../../../../api/services NodeJs/plantationDashboardApi';

function pct(ready, total) {
  if (!total) return 0;
  return Math.round((ready / total) * 100);
}

export default function FieldAvailabilitySection({ basePath = '/home/plantation-dashboard' }) {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, error } = useGetFieldMissionAvailabilityQuery({});

  const total = data?.totalFields ?? 0;
  const canSpray = data?.canSprayCount ?? 0;
  const canSpread = data?.canSpreadCount ?? 0;
  const blockedSpray = data?.cannotSprayCount ?? 0;
  const blockedSpread = data?.cannotSpreadCount ?? 0;

  const sprayPct = useMemo(() => pct(canSpray, total), [canSpray, total]);
  const spreadPct = useMemo(() => pct(canSpread, total), [canSpread, total]);

  return (
    <div className="pd-field-avail-card">
      <div className="pd-field-avail-header">
        <div>
          <h3 className="pd-field-avail-title">
            <FaLeaf /> Field availability
          </h3>
          <p className="pd-field-avail-sub">Spray and spread readiness across your scope</p>
        </div>
        <button
          type="button"
          className="pd-field-avail-link"
          onClick={() => navigate(`${basePath}/field-availability`)}
        >
          Details <FaChevronRight />
        </button>
      </div>
      {isLoading || isFetching ? (
        <div className="pd-field-avail-loading">
          <Bars height={24} width={40} color="#1b5e40" />
        </div>
      ) : error ? (
        <p className="pd-field-avail-error">Could not load field availability.</p>
      ) : (
        <>
          <div className="pd-field-avail-stats">
            <div className="pd-field-avail-stat">
              <span className="pd-field-avail-stat-val">{total}</span>
              <span className="pd-field-avail-stat-lbl">Total fields</span>
            </div>
            <div className="pd-field-avail-stat pd-field-avail-stat--ok">
              <span className="pd-field-avail-stat-val">{canSpray}</span>
              <span className="pd-field-avail-stat-lbl">Can spray</span>
            </div>
            <div className="pd-field-avail-stat pd-field-avail-stat--ok">
              <span className="pd-field-avail-stat-val">{canSpread}</span>
              <span className="pd-field-avail-stat-lbl">Can spread</span>
            </div>
            <div className="pd-field-avail-stat pd-field-avail-stat--warn">
              <span className="pd-field-avail-stat-val">{blockedSpray}</span>
              <span className="pd-field-avail-stat-lbl">Blocked spray</span>
            </div>
            <div className="pd-field-avail-stat pd-field-avail-stat--warn">
              <span className="pd-field-avail-stat-val">{blockedSpread}</span>
              <span className="pd-field-avail-stat-lbl">Blocked spread</span>
            </div>
          </div>
          {total > 0 ? (
            <div className="pd-field-avail-progress">
              <div className="pd-field-avail-progress-row">
                <div className="pd-field-avail-progress-label">
                  <span>Spray ready</span>
                  <strong>{sprayPct}%</strong>
                </div>
                <div className="pd-field-avail-progress-track">
                  <div
                    className="pd-field-avail-progress-fill pd-field-avail-progress-fill--spray"
                    style={{ width: `${sprayPct}%` }}
                  />
                </div>
              </div>
              <div className="pd-field-avail-progress-row">
                <div className="pd-field-avail-progress-label">
                  <span>Spread ready</span>
                  <strong>{spreadPct}%</strong>
                </div>
                <div className="pd-field-avail-progress-track">
                  <div
                    className="pd-field-avail-progress-fill pd-field-avail-progress-fill--spread"
                    style={{ width: `${spreadPct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
