import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  isSameMonth,
} from 'date-fns';
import { Bars } from 'react-loader-spinner';
import { toast } from 'react-toastify';
import CustomDropdown from '../../../components/CustomDropdown';
import {
  useGetPlantationMonthlyPlanAcceptBoardQuery,
  useBulkApprovePlantationMonthlyPlanRequestsMutation,
  useBulkRejectPlantationMonthlyPlanRequestsMutation,
  useChangePlantationMonthlyPlanLineDateMutation,
} from '../../../api/services NodeJs/plantationDashboardApi';
import {
  buildBulkApprovePayload,
  buildBulkRejectPayload,
} from '../../opsroom/plantation-plan-requests/plantationMonthlyPlanApproval';
import { useGetHrHolidayCalendarQuery } from '../../../api/services NodeJs/hrLeaveApi';
import {
  buildHolidayMetaByDate,
  extractHolidayRows,
  holidayCellClass,
  holidayHoverText,
  holidayTypeShortLabel,
} from './bookingHolidayDisplay';
import '../../../styles/acceptMonthlyPlansBoard.css';
import '../../../styles/bookingsCalender.css';
import '../../../styles/updateservices.css';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_ESTATES = { id: '', group: 'All estates' };
const ALL_MISSIONS = { id: '', group: 'All missions' };
const ALL_CROPS = { id: '', group: 'All crops' };

function slotMatchesFilters(slot, { estateId, missionTypeId, cropTypeId }) {
  if (estateId && Number(slot.estateId) !== Number(estateId)) return false;
  if (missionTypeId) {
    const m = String(missionTypeId).toLowerCase();
    if (String(slot.missionTypeId || '').toLowerCase() !== m) return false;
  }
  if (cropTypeId && Number(slot.cropTypeId) !== Number(cropTypeId)) return false;
  return true;
}

function hasActiveFilters(filters) {
  return Boolean(filters.estateId || filters.missionTypeId || filters.cropTypeId);
}

const SLOT_CELL_ORDER = { pending: 0, rejected: 1 };

function sortSlotsForCellDisplay(slots) {
  return [...slots].sort((a, b) => {
    const ao = SLOT_CELL_ORDER[a.slotStatus] ?? 9;
    const bo = SLOT_CELL_ORDER[b.slotStatus] ?? 9;
    if (ao !== bo) return ao - bo;
    return String(a.slotKey).localeCompare(String(b.slotKey));
  });
}

function monthDateBounds(yearMonth) {
  const ym = String(yearMonth || '');
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return { min: '', max: '' };
  }
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    min: `${ym}-01`,
    max: `${ym}-${String(lastDay).padStart(2, '0')}`,
  };
}

export default function AcceptMonthlyPlansBoard({
  estates = [],
  missionTypes = [],
  cropTypes = [],
  currentMonth,
  onMonthChange,
  onApproved,
}) {
  const yearMonth = format(currentMonth, 'yyyy-MM');
  const dateBounds = useMemo(() => monthDateBounds(yearMonth), [yearMonth]);

  const [filterEstate, setFilterEstate] = useState(null);
  const [filterMission, setFilterMission] = useState(null);
  const [filterCrop, setFilterCrop] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [changeDateModal, setChangeDateModal] = useState(null);
  const [changeDateValue, setChangeDateValue] = useState('');

  const filters = useMemo(
    () => ({
      estateId: filterEstate?.id ?? null,
      missionTypeId: filterMission?.id ?? null,
      cropTypeId: filterCrop?.id ?? null,
    }),
    [filterEstate, filterMission, filterCrop]
  );

  const filtersActive = hasActiveFilters(filters);

  const { data: board, isLoading, isError, refetch, isFetching } =
    useGetPlantationMonthlyPlanAcceptBoardQuery({ yearMonth, status: 'open' });
  const { data: holidayResponse } = useGetHrHolidayCalendarQuery({ yearMonth });
  const holidayMetaByDate = useMemo(
    () => buildHolidayMetaByDate(extractHolidayRows(holidayResponse)),
    [holidayResponse]
  );

  const [bulkApprove] = useBulkApprovePlantationMonthlyPlanRequestsMutation();
  const [bulkReject] = useBulkRejectPlantationMonthlyPlanRequestsMutation();
  const [changeLineDate, { isLoading: changingDate }] =
    useChangePlantationMonthlyPlanLineDateMutation();

  const existingPlans = board?.existingPlans || [];
  const requestedSlots = board?.requestedSlots || [];
  const openRequestSlots = useMemo(
    () => requestedSlots.filter((slot) => slot.slotStatus !== 'approved'),
    [requestedSlots]
  );
  const pendingSlots = useMemo(
    () => openRequestSlots.filter((slot) => slot.slotStatus === 'pending'),
    [openRequestSlots]
  );

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const firstDayOfWeek = monthStart.getDay();

  const existingByDate = useMemo(() => {
    const map = new Map();
    for (const plan of existingPlans) {
      const d = plan.pickedDate;
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(plan);
    }
    return map;
  }, [existingPlans]);

  const slotsByDate = useMemo(() => {
    const map = new Map();
    for (const slot of openRequestSlots) {
      const d = slot.pickedDate;
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(slot);
    }
    return map;
  }, [openRequestSlots]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  const toggleSlot = useCallback((slot) => {
    if (slot.slotStatus !== 'pending') return;
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot.slotKey)) next.delete(slot.slotKey);
      else next.add(slot.slotKey);
      return next;
    });
  }, []);

  const openChangeDateForSlot = useCallback((slot) => {
    if (!slot || slot.slotStatus !== 'pending') return;
    setContextMenu(null);
    setChangeDateModal(slot);
    setChangeDateValue(slot.pickedDate || '');
  }, []);

  const handlePendingContextMenu = useCallback((e, slot) => {
    e.preventDefault();
    e.stopPropagation();
    if (slot.slotStatus !== 'pending') return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      slot,
    });
  }, []);

  const closeChangeDateModal = () => {
    if (changingDate) return;
    setChangeDateModal(null);
    setChangeDateValue('');
  };

  const submitChangeDate = async () => {
    if (!changeDateModal) return;
    const nextDate = String(changeDateValue || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      toast.error('Select a valid date.', { position: 'top-center' });
      return;
    }
    if (nextDate === changeDateModal.pickedDate) {
      toast.info('Date is unchanged.', { position: 'top-center' });
      closeChangeDateModal();
      return;
    }
    try {
      const result = await changeLineDate({
        requestId: changeDateModal.requestId,
        lineId: changeDateModal.lineId,
        pickedDate: nextDate,
      }).unwrap();
      const data = result?.data ?? result;
      toast.success(
        `Moved request #${changeDateModal.requestId} from ${
          data?.previousPickedDate || changeDateModal.pickedDate
        } to ${nextDate}.`,
        { position: 'top-center' }
      );
      setChangeDateModal(null);
      setChangeDateValue('');
      setSelectedSlots((prev) => {
        const next = new Set(prev);
        next.delete(changeDateModal.slotKey);
        return next;
      });
      await refetch();
      if (onApproved) await onApproved();
    } catch (e) {
      toast.error(e?.data?.message || e?.message || 'Failed to change date.', {
        position: 'top-center',
      });
    }
  };

  const selectAllFiltered = useCallback(() => {
    const next = new Set();
    for (const slot of pendingSlots) {
      if (!filtersActive || slotMatchesFilters(slot, filters)) {
        next.add(slot.slotKey);
      }
    }
    setSelectedSlots(next);
  }, [pendingSlots, filters, filtersActive]);

  const clearSelection = useCallback(() => setSelectedSlots(new Set()), []);

  const selectedCount = selectedSlots.size;

  const runApprove = async () => {
    const payload = buildBulkApprovePayload(requestedSlots, selectedSlots);
    if (!payload.requestApprovals?.length) {
      toast.error('Nothing selected to approve.', { position: 'top-center' });
      return;
    }
    setBusy(true);
    try {
      const result = await bulkApprove(payload).unwrap();
      const data = result?.data ?? result;
      const created = data?.totalPlansCreated ?? 0;
      const approved = data?.approvedRequestCount ?? 0;
      toast.success(`Approved ${approved} request(s), created ${created} plan(s).`, {
        position: 'top-center',
      });
      setSelectedSlots(new Set());
      setConfirmAction(null);
      await refetch();
      if (onApproved) await onApproved();
    } catch (e) {
      toast.error(e?.data?.message || e?.message || 'Bulk approval failed.', {
        position: 'top-center',
      });
    } finally {
      setBusy(false);
    }
  };

  const runReject = async () => {
    const payload = buildBulkRejectPayload(requestedSlots, selectedSlots);
    if (!payload.requestRejections?.length) {
      toast.error('Nothing selected to reject.', { position: 'top-center' });
      return;
    }
    setBusy(true);
    try {
      const result = await bulkReject(payload).unwrap();
      const data = result?.data ?? result;
      const rejected = data?.totalSlotsRejected ?? 0;
      toast.success(`Rejected ${rejected} requested plan(s).`, {
        position: 'top-center',
      });
      setSelectedSlots(new Set());
      setConfirmAction(null);
      await refetch();
      if (onApproved) await onApproved();
    } catch (e) {
      toast.error(e?.data?.message || e?.message || 'Bulk rejection failed.', {
        position: 'top-center',
      });
    } finally {
      setBusy(false);
    }
  };

  const requestApproveConfirm = () => {
    if (selectedCount < 1 || busy) return;
    const payload = buildBulkApprovePayload(requestedSlots, selectedSlots);
    if (!payload.requestApprovals?.length) {
      toast.error('Nothing selected to approve.', { position: 'top-center' });
      return;
    }
    setConfirmAction('approve');
  };

  const requestRejectConfirm = () => {
    if (selectedCount < 1 || busy) return;
    const payload = buildBulkRejectPayload(requestedSlots, selectedSlots);
    if (!payload.requestRejections?.length) {
      toast.error('Nothing selected to reject.', { position: 'top-center' });
      return;
    }
    setConfirmAction('reject');
  };

  const closeConfirm = () => {
    if (!busy) setConfirmAction(null);
  };

  const estateOptions = useMemo(
    () => estates.map((e) => ({ id: e.id, group: e.estate })),
    [estates]
  );

  const missionOptions = useMemo(
    () =>
      missionTypes.map(({ mission_type_code, mission_type_name }) => ({
        id: mission_type_code,
        group: mission_type_name || mission_type_code,
      })),
    [missionTypes]
  );

  const cropOptions = useMemo(
    () => cropTypes.map((c) => ({ id: c.id, group: c.crop || c.crop_type || c.name || c.id })),
    [cropTypes]
  );

  if (isLoading && !board) {
    return (
      <div className="accept-monthly-board accept-monthly-loading">
        <Bars height="48" width="48" color="#003057" visible />
        <span>Loading accept board…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="accept-monthly-board">
        <div className="accept-monthly-alert" role="alert">
          Failed to load accept board.{' '}
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const emptyBoard =
    (board.pendingSlotCount ?? 0) === 0 &&
    openRequestSlots.length === 0 &&
    existingPlans.length === 0;

  return (
    <div className="accept-monthly-board">
      <div className="accept-monthly-actions-row">
        <div className="mission-type-controls accept-monthly-inline-filter">
          <label htmlFor="accept-filter-estate">Estate</label>
          <CustomDropdown
            options={[ALL_ESTATES, ...estateOptions]}
            onSelect={(val) => setFilterEstate(val?.id ? val : null)}
            selectedValue={filterEstate || ALL_ESTATES}
          />
        </div>
        <div className="mission-type-controls accept-monthly-inline-filter">
          <label htmlFor="accept-filter-mission">Mission</label>
          <CustomDropdown
            options={[ALL_MISSIONS, ...missionOptions]}
            onSelect={(val) => setFilterMission(val?.id ? val : null)}
            selectedValue={filterMission || ALL_MISSIONS}
          />
        </div>
        <div className="mission-type-controls accept-monthly-inline-filter">
          <label htmlFor="accept-filter-crop">Crop</label>
          <CustomDropdown
            options={[ALL_CROPS, ...cropOptions]}
            onSelect={(val) => setFilterCrop(val?.id ? val : null)}
            selectedValue={filterCrop || ALL_CROPS}
          />
        </div>
        <button type="button" className="accept-monthly-mark-btn" onClick={selectAllFiltered}>
          Select filtered
        </button>
        <button type="button" className="accept-monthly-mark-btn secondary" onClick={clearSelection}>
          Clear
        </button>
        <button
          type="button"
          className="accept-monthly-mark-btn approve"
          disabled={selectedCount < 1 || busy}
          onClick={requestApproveConfirm}
        >
          {busy && confirmAction === 'approve' ? 'Approving…' : `Approve selected (${selectedCount})`}
        </button>
        <button
          type="button"
          className="accept-monthly-mark-btn reject"
          disabled={selectedCount < 1 || busy}
          onClick={requestRejectConfirm}
        >
          {busy && confirmAction === 'reject' ? 'Rejecting…' : `Reject selected (${selectedCount})`}
        </button>
        {isFetching ? (
          <div className="accept-monthly-loading-bar">
            <Bars height="22" width="22" color="#003057" visible />
          </div>
        ) : null}
      </div>

      <div className="accept-monthly-meta-bar">
        <div className="accept-monthly-legend">
          <span className="legend existing">Existing plan</span>
          <span className="legend pending">Pending request</span>
          <span className="legend rejected">Rejected</span>
          <span className="legend holiday-mercantile">Statutory holiday</span>
          <span className="legend holiday-poya">Poya holiday</span>
          <span className="legend holiday-special">Special holiday</span>
          <span className="legend hint">Right-click pending → Change date</span>
        </div>
      </div>

      {emptyBoard ? (
        <div className="accept-monthly-empty-hint">
          No open monthly plan requests for {yearMonth}.
        </div>
      ) : null}

      <div className="calendar-section-bottom accept-monthly-calendar-section">
        <div className="booking-calender-header">
          <button
            type="button"
            className="booking-calender-nav-btn"
            onClick={() => onMonthChange(addMonths(currentMonth, -1))}
          >
            ‹
          </button>
          <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
          <button
            type="button"
            className="booking-calender-nav-btn"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          >
            ›
          </button>
        </div>
        <div className="booking-calender-grid">
          <div className="booking-calender-weekdays">
            {weekDays.map((d) => (
              <div key={d} className="booking-calender-weekday">
                {d}
              </div>
            ))}
          </div>
          <div className="booking-calender-days">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} className="booking-calender-day empty" />
            ))}
            {calendarDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const existing = existingByDate.get(dateKey) || [];
              const slots = sortSlotsForCellDisplay(slotsByDate.get(dateKey) || []);
              const holidayMeta = holidayMetaByDate[dateKey];
              const holidayTitle = holidayHoverText(holidayMeta);
              const dayClasses = [
                'booking-calender-day',
                !isSameMonth(day, currentMonth) ? 'outside-month' : '',
                holidayCellClass(holidayMeta?.type),
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div key={dateKey} className={dayClasses} title={holidayTitle || undefined}>
                  <div className="booking-calender-day-header">
                    <div className="booking-calender-day-number">{format(day, 'd')}</div>
                    {(existing.length > 0 || slots.length > 0) && (
                      <div className="booking-calender-day-count">
                        ({existing.length + slots.length})
                      </div>
                    )}
                  </div>
                  {holidayMeta ? (
                    <div
                      className={`booking-calender-holiday-badge booking-calender-holiday-badge-${holidayMeta.type}`}
                      title={holidayTitle}
                    >
                      {holidayMeta.description || holidayTypeShortLabel(holidayMeta.type)}
                    </div>
                  ) : null}
                  <div className="booking-calender-tasks accept-monthly-tasks">
                    {existing.map((plan) => (
                      <div
                        key={`ex-${plan.id}`}
                        className="booking-calender-task accept-monthly-task-existing"
                        title="Existing plan"
                      >
                        <span className="booking-calender-task-estate">
                          {plan.estateName} - ID:{plan.id}
                        </span>
                      </div>
                    ))}
                    {slots.map((slot) => {
                      const isSelected = selectedSlots.has(slot.slotKey);
                      const isPending = slot.slotStatus === 'pending';
                      const matches = slotMatchesFilters(slot, filters);
                      const cls = [
                        'booking-calender-task',
                        'accept-monthly-task-requested',
                        `accept-monthly-task-${slot.slotStatus || 'pending'}`,
                        filtersActive && matches && isPending ? 'accept-monthly-task-filtered' : '',
                        filtersActive && !matches && isPending ? 'accept-monthly-task-dimmed' : '',
                        isSelected ? 'accept-monthly-task-selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      const slotLabel = `${slot.estateName} - ${slot.missionLabel}`;
                      const slotTitle = isPending
                        ? `Request #${slot.requestId} · ${slot.pickedDate} · Right-click to change date`
                        : `Request #${slot.requestId} · ${slot.pickedDate}`;

                      if (!isPending) {
                        return (
                          <div key={slot.slotKey} className={cls} title={slotTitle}>
                            <span className="booking-calender-task-estate">{slotLabel}</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={slot.slotKey}
                          type="button"
                          className={cls}
                          onClick={() => toggleSlot(slot)}
                          onContextMenu={(e) => handlePendingContextMenu(e, slot)}
                          title={slotTitle}
                        >
                          <span className="booking-calender-task-estate">{slotLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {contextMenu ? (
        <div
          className="accept-monthly-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="accept-monthly-context-item"
            role="menuitem"
            onClick={() => openChangeDateForSlot(contextMenu.slot)}
          >
            Change date
          </button>
        </div>
      ) : null}

      {changeDateModal ? (
        <div className="plan-popup-overlay" onClick={closeChangeDateModal}>
          <div className="plan-popup-container" onClick={(e) => e.stopPropagation()}>
            <div className="plan-popup-header">
              <h3>Change requested date</h3>
              <button
                type="button"
                className="plan-popup-close"
                onClick={closeChangeDateModal}
                aria-label="Close"
                disabled={changingDate}
              >
                ×
              </button>
            </div>
            <div className="plan-popup-content">
              <p className="plan-popup-message">
                Move pending request <strong>#{changeDateModal.requestId}</strong> (
                {changeDateModal.estateName} · {changeDateModal.missionLabel}) within{' '}
                <strong>{yearMonth}</strong>.
              </p>
              <div className="accept-monthly-change-date-field">
                <label htmlFor="accept-change-date-input">New date</label>
                <input
                  id="accept-change-date-input"
                  type="date"
                  value={changeDateValue}
                  min={dateBounds.min}
                  max={dateBounds.max}
                  onChange={(e) => setChangeDateValue(e.target.value)}
                  disabled={changingDate}
                />
                <span className="accept-monthly-change-date-hint">
                  Current: {changeDateModal.pickedDate}
                </span>
              </div>
            </div>
            <div className="plan-popup-footer">
              <div className="plan-popup-actions">
                <button
                  type="button"
                  className="plan-popup-cancel-btn"
                  onClick={closeChangeDateModal}
                  disabled={changingDate}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="plan-popup-create-btn"
                  onClick={submitChangeDate}
                  disabled={changingDate || !changeDateValue}
                >
                  {changingDate ? 'Saving…' : 'Save date'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="plan-popup-overlay" onClick={closeConfirm}>
          <div className="plan-popup-container" onClick={(e) => e.stopPropagation()}>
            <div className="plan-popup-header">
              <h3>{confirmAction === 'approve' ? 'Approve selected plans' : 'Reject selected plans'}</h3>
              <button
                type="button"
                className="plan-popup-close"
                onClick={closeConfirm}
                aria-label="Close"
                disabled={busy}
              >
                ×
              </button>
            </div>
            <div className="plan-popup-content">
              <p className="plan-popup-message">
                {confirmAction === 'approve' ? (
                  <>
                    Approve <strong>{selectedCount}</strong> selected requested plan
                    {selectedCount === 1 ? '' : 's'}? This will create booking plan
                    {selectedCount === 1 ? '' : 's'} for operations.
                  </>
                ) : (
                  <>
                    Reject <strong>{selectedCount}</strong> selected requested plan
                    {selectedCount === 1 ? '' : 's'}? Rejected items will not be created as bookings.
                  </>
                )}
              </p>
            </div>
            <div className="plan-popup-footer">
              <div className="plan-popup-actions">
                <button
                  type="button"
                  className="plan-popup-cancel-btn"
                  onClick={closeConfirm}
                  disabled={busy}
                >
                  Cancel
                </button>
                {confirmAction === 'approve' ? (
                  <button
                    type="button"
                    className="plan-popup-create-btn"
                    onClick={runApprove}
                    disabled={busy}
                  >
                    {busy ? 'Approving…' : 'Approve'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="plan-popup-danger-btn"
                    onClick={runReject}
                    disabled={busy}
                  >
                    {busy ? 'Rejecting…' : 'Reject'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
