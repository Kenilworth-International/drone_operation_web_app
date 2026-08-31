import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parse } from 'date-fns';
import { toast } from 'react-toastify';
import {
  useGetMonthlyEligibleMonthsQuery,
  useGetMyMonthlyPlanHistoryQuery,
  useGetMyMonthlyPlanHistoryDetailQuery,
  useCreateMonthlyPlanRequestMutation,
} from '../../../../api/services NodeJs/plantationDashboardApi';
import { useGetMissionTypesQuery, useGetCropTypesQuery } from '../../../../api/services/allEndpoints';
import { usePlantationSession } from '../../hooks/usePlantationSession';
import { Bars } from 'react-loader-spinner';

function normalizeDropdownList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw?.data && Array.isArray(raw.data)) return raw.data;
  if (typeof raw === 'object') {
    return Object.keys(raw)
      .filter((k) => !isNaN(Number(k)))
      .map((k) => raw[k]);
  }
  return [];
}

function missionValue(m) {
  const id = m?.id ?? m?.mission_type_id;
  if (id != null) return String(id);
  return String(m?.mission_type_code || m?.mission_type || '').trim();
}

function cropValue(c) {
  return String(c?.id ?? c?.crop_type_id ?? c?.crop_id ?? '');
}

export default function MonthlyRequestSection() {
  const { canRequestPlans } = usePlantationSession();
  const { data: eligibleRaw, isLoading: eligibleLoading } = useGetMonthlyEligibleMonthsQuery(undefined, {
    skip: !canRequestPlans,
  });
  const eligibleMonths = Array.isArray(eligibleRaw) ? eligibleRaw : [];
  const { data: historyRaw, isLoading: historyLoading } = useGetMyMonthlyPlanHistoryQuery(undefined, {
    skip: !canRequestPlans,
  });
  const history = Array.isArray(historyRaw) ? historyRaw : [];
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const { data: historyDetail } = useGetMyMonthlyPlanHistoryDetailQuery(selectedHistoryId, {
    skip: !selectedHistoryId,
  });

  const { data: missionRaw } = useGetMissionTypesQuery();
  const { data: cropRaw } = useGetCropTypesQuery();
  const missions = useMemo(() => normalizeDropdownList(missionRaw).filter((m) => {
    const code = String(m?.mission_type_code || m?.mission_type || '').toLowerCase();
    return code === 'spy' || code === 'spd';
  }), [missionRaw]);
  const crops = useMemo(() => normalizeDropdownList(cropRaw), [cropRaw]);

  const openMonth = eligibleMonths.find((m) => m.eligible && m.windowOpen);
  const targetYearMonth = openMonth?.yearMonth || '';

  const [draftMonth, setDraftMonth] = useState(() => {
    if (!targetYearMonth) return new Date();
    return parse(`${targetYearMonth}-01`, 'yyyy-MM-dd', new Date());
  });
  const [draftLines, setDraftLines] = useState({});
  const [createRequest, { isLoading: submitting }] = useCreateMonthlyPlanRequestMutation();

  const monthDays = useMemo(() => {
    const start = startOfMonth(draftMonth);
    const end = endOfMonth(draftMonth);
    return eachDayOfInterval({ start, end });
  }, [draftMonth]);

  const toggleDay = (ymd) => {
    setDraftLines((prev) => {
      const next = { ...prev };
      if (next[ymd]) delete next[ymd];
      else {
        next[ymd] = {
          missionTypeId: missionValue(missions[0] || { mission_type_code: 'spy' }),
          cropTypeId: parseInt(cropValue(crops[0] || {}), 10) || 0,
          planCount: 1,
        };
      }
      return next;
    });
  };

  const updateLine = (ymd, patch) => {
    setDraftLines((prev) => ({ ...prev, [ymd]: { ...prev[ymd], ...patch } }));
  };

  const handleSubmit = async () => {
    if (!targetYearMonth) {
      toast.error('No eligible month window is open.');
      return;
    }
    const lines = Object.entries(draftLines).map(([pickedDate, line]) => ({
      pickedDate,
      missionTypeId: line.missionTypeId,
      cropTypeId: Number(line.cropTypeId),
      planCount: Number(line.planCount) || 1,
    }));
    if (lines.length === 0) {
      toast.error('Select at least one date.');
      return;
    }
    try {
      await createRequest({ targetYearMonth, lines }).unwrap();
      toast.success('Monthly plan request submitted.');
      setDraftLines({});
    } catch (err) {
      toast.error(err?.data?.message || 'Submit failed.');
    }
  };

  if (!canRequestPlans) {
    return (
      <div className="pd-monthly-section pd-monthly-section--muted">
        Monthly plan requests are available to estate managers with full hierarchy assignment.
      </div>
    );
  }

  return (
    <div className="pd-monthly-section">
      <h3>Monthly plan request</h3>
      {eligibleLoading ? (
        <Bars height={24} width={40} color="#2d6a4f" />
      ) : openMonth ? (
        <p className="pd-monthly-hint">
          Submit plans for <strong>{targetYearMonth}</strong> (next month window).
        </p>
      ) : (
        <p className="pd-monthly-hint">No submission window is open right now.</p>
      )}

      {openMonth ? (
        <>
          <div className="pd-monthly-draft-grid">
            {monthDays.map((day) => {
              const ymd = format(day, 'yyyy-MM-dd');
              const selected = Boolean(draftLines[ymd]);
              const pad = getDay(startOfMonth(draftMonth));
              return (
                <React.Fragment key={ymd}>
                  {day.getDate() === 1 ? Array.from({ length: pad }).map((_, i) => (
                    <div key={`pad-${i}`} className="pd-monthly-day pd-monthly-day--empty" />
                  )) : null}
                  <button
                    type="button"
                    className={`pd-monthly-day${selected ? ' pd-monthly-day--selected' : ''}`}
                    onClick={() => toggleDay(ymd)}
                  >
                    {format(day, 'd')}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {Object.keys(draftLines).length > 0 ? (
            <div className="pd-monthly-lines">
              <h4>Selected dates</h4>
              {Object.entries(draftLines).map(([ymd, line]) => (
                <div key={ymd} className="pd-monthly-line">
                  <strong>{ymd}</strong>
                  <select
                    value={line.missionTypeId}
                    onChange={(e) => updateLine(ymd, { missionTypeId: e.target.value })}
                  >
                    {missions.map((m) => (
                      <option key={missionValue(m)} value={missionValue(m)}>
                        {m.mission_type || m.name || missionValue(m)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={line.cropTypeId}
                    onChange={(e) => updateLine(ymd, { cropTypeId: e.target.value })}
                  >
                    {crops.map((c) => (
                      <option key={cropValue(c)} value={cropValue(c)}>
                        {c.crop_type || c.name || cropValue(c)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={line.planCount}
                    onChange={(e) => updateLine(ymd, { planCount: e.target.value })}
                  />
                </div>
              ))}
              <button type="button" className="pd-calendar-btn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit monthly request'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="pd-monthly-history">
        <h4>Recent requests</h4>
        {historyLoading ? (
          <Bars height={20} width={32} color="#64748b" />
        ) : history.length === 0 ? (
          <p className="pd-popup-empty">No monthly requests yet.</p>
        ) : (
          <ul className="pd-monthly-history-list">
            {history.slice(0, 6).map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => setSelectedHistoryId(row.id)}>
                  {row.target_year_month} · {row.status} · {row.total_requested_plans ?? 0} plans
                </button>
              </li>
            ))}
          </ul>
        )}
        {historyDetail ? (
          <div className="pd-monthly-history-detail">
            <strong>Lines</strong>
            <ul>
              {(historyDetail.lines || []).map((line) => (
                <li key={line.id}>
                  {line.picked_date} · {line.mission_type_id} · {line.requested_plan_count} plan(s) · {line.line_status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
