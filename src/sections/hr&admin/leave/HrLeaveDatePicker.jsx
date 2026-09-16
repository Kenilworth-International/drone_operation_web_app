import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useLazyGetHrOpsLeaveCalendarQuery } from '../../../api/services NodeJs/hrLeaveApi';
import { leaveStatusLabel } from '../../../utils/hrStatusLabels';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toMonthKey(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }
  return dateKey.slice(0, 7);
}

function monthLabel(yearMonth) {
  const [y, m] = String(yearMonth || '').split('-').map(Number);
  if (!y || !m) return yearMonth;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function shiftMonth(yearMonth, delta) {
  const [y, m] = String(yearMonth || '').split('-').map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function buildCalendarCells(yearMonth) {
  const [y, m] = String(yearMonth || '').split('-').map(Number);
  if (!y || !m) return [];
  const firstDay = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startPad = firstDay.getDay();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) {
    cells.push({ empty: true, key: `pad-${yearMonth}-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${y}-${pad2(m)}-${pad2(day)}`;
    cells.push({ empty: false, day, dateKey, key: dateKey });
  }
  return cells;
}

function datesInRange(start, end) {
  if (!start || !end) return [];
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const out = [];
  const cursor = new Date(`${from}T00:00:00`);
  const last = new Date(`${to}T00:00:00`);
  while (cursor.getTime() <= last.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatBlockedTooltip(entries) {
  if (!entries?.length) return 'Existing leave';
  return entries
    .map((row) => {
      const typeLabel = row.leaveTypeName || row.leaveTypeCode || 'Leave';
      const statusLabel = leaveStatusLabel(row.status);
      return `${typeLabel} (${statusLabel})`;
    })
    .join(', ');
}

export default function HrLeaveDatePicker({
  employeeId,
  requestMode = 'full_day',
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  disabled = false,
}) {
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthKey(startDate));
  const [blockedCache, setBlockedCache] = useState({});
  const [fetchCalendar, { isFetching }] = useLazyGetHrOpsLeaveCalendarQuery();

  useEffect(() => {
    setCalendarMonth(toMonthKey(startDate));
  }, [employeeId, startDate]);

  useEffect(() => {
    if (!employeeId) {
      setBlockedCache({});
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCalendar({
          employeeId: Number(employeeId),
          yearMonth: calendarMonth,
        }).unwrap();
        if (cancelled) return;
        setBlockedCache((prev) => ({
          ...prev,
          [calendarMonth]: {
            blockedDates: new Set(data?.blockedDates || []),
            detailsByDate: data?.leaveDetailsByDate || {},
          },
        }));
      } catch {
        if (!cancelled) {
          setBlockedCache((prev) => ({
            ...prev,
            [calendarMonth]: { blockedDates: new Set(), detailsByDate: {} },
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, calendarMonth, fetchCalendar]);

  const monthData = blockedCache[calendarMonth] || { blockedDates: new Set(), detailsByDate: {} };
  const calCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);

  const rangeDates = useMemo(() => {
    if (requestMode !== 'full_day' || !startDate) return new Set();
    const end = endDate || startDate;
    return new Set(datesInRange(startDate, end));
  }, [requestMode, startDate, endDate]);

  const isBlocked = (dateKey) => monthData.blockedDates.has(dateKey);

  const loadMonthBlocked = async (monthKey) => {
    if (blockedCache[monthKey]) return blockedCache[monthKey];
    const data = await fetchCalendar({
      employeeId: Number(employeeId),
      yearMonth: monthKey,
    }).unwrap();
    const next = {
      blockedDates: new Set(data?.blockedDates || []),
      detailsByDate: data?.leaveDetailsByDate || {},
    };
    setBlockedCache((prev) => ({ ...prev, [monthKey]: next }));
    return next;
  };

  const blockedInRange = async (from, to) => {
    const keys = datesInRange(from, to);
    const months = [...new Set(keys.map((key) => key.slice(0, 7)))];
    const mergedBlocked = new Set();
    for (const monthKey of months) {
      const cache = await loadMonthBlocked(monthKey);
      cache.blockedDates.forEach((key) => mergedBlocked.add(key));
    }
    return keys.filter((key) => mergedBlocked.has(key));
  };

  const notifyBlocked = (dateKey) => {
    const monthKey = dateKey.slice(0, 7);
    const cache = blockedCache[monthKey] || monthData;
    const entries = cache.detailsByDate?.[dateKey] || monthData.detailsByDate?.[dateKey] || [];
    toast.warning(`Leave already exists on ${dateKey}: ${formatBlockedTooltip(entries)}`);
  };

  const handleDayClick = async (dateKey) => {
    if (disabled || !employeeId) return;
    if (isBlocked(dateKey)) {
      notifyBlocked(dateKey);
      return;
    }

    if (requestMode !== 'full_day') {
      onStartChange?.(dateKey);
      onEndChange?.(dateKey);
      return;
    }

    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      onStartChange?.(dateKey);
      onEndChange?.(dateKey);
      return;
    }

    if (startDate && (!endDate || startDate === endDate)) {
      if (dateKey === startDate) return;
      const from = dateKey < startDate ? dateKey : startDate;
      const to = dateKey < startDate ? startDate : dateKey;
      try {
        const conflicts = await blockedInRange(from, to);
        if (conflicts.length) {
          notifyBlocked(conflicts[0]);
          toast.warning('Selected range includes dates with existing leave.');
          return;
        }
      } catch {
        toast.error('Could not verify existing leave for this range.');
        return;
      }
      if (dateKey < startDate) {
        onStartChange?.(dateKey);
        onEndChange?.(startDate);
      } else {
        onEndChange?.(dateKey);
      }
    }
  };

  const selectedLabel = useMemo(() => {
    if (!startDate) return 'Pick a date on the calendar';
    if (requestMode !== 'full_day' || !endDate || endDate === startDate) return startDate;
    return `${startDate} → ${endDate}`;
  }, [startDate, endDate, requestMode]);

  if (!employeeId) {
    return (
      <div className="leave-ops-add-leave-cal leave-ops-add-leave-cal--disabled">
        Select an employee to pick leave dates.
      </div>
    );
  }

  return (
    <div className="leave-ops-add-leave-cal">
      <div className="leave-ops-add-leave-cal-head">
        <span className="leave-ops-add-leave-cal-label">
          {requestMode === 'full_day' ? 'Leave dates' : 'Leave date'}
        </span>
        <span className="leave-ops-add-leave-cal-selected">{selectedLabel}</span>
      </div>

      <div className="leave-ops-add-leave-cal-nav">
        <button
          type="button"
          className="leave-ops-btn leave-ops-btn--tiny"
          onClick={() => setCalendarMonth((m) => shiftMonth(m, -1))}
          disabled={disabled}
          aria-label="Previous month"
        >
          ‹
        </button>
        <strong>{monthLabel(calendarMonth)}</strong>
        <button
          type="button"
          className="leave-ops-btn leave-ops-btn--tiny"
          onClick={() => setCalendarMonth((m) => shiftMonth(m, 1))}
          disabled={disabled}
          aria-label="Next month"
        >
          ›
        </button>
        {isFetching ? <span className="leave-ops-add-leave-cal-loading">Loading…</span> : null}
      </div>

      <div className="leave-ops-cal leave-ops-cal--picker">
        {WEEKDAYS.map((d) => (
          <div key={d} className="leave-ops-cal-head">
            {d}
          </div>
        ))}
        {calCells.map((cell) => {
          if (cell.empty) {
            return <div key={cell.key} className="leave-ops-cal-day leave-ops-cal-day--empty" />;
          }

          const blocked = isBlocked(cell.dateKey);
          const selected = cell.dateKey === startDate || cell.dateKey === endDate;
          const inRange = rangeDates.has(cell.dateKey) && !selected;
          const entries = monthData.detailsByDate[cell.dateKey] || [];

          if (blocked) {
            return (
              <div
                key={cell.key}
                className="leave-ops-cal-day leave-ops-cal-day--blocked"
                title={formatBlockedTooltip(entries)}
                role="img"
                aria-label={`${cell.day}: existing leave`}
              >
                <span className="leave-ops-cal-day-num">{cell.day}</span>
                <span className="leave-ops-cal-day-dot leave-ops-cal-day-dot--blocked" aria-hidden />
              </div>
            );
          }

          return (
            <button
              key={cell.key}
              type="button"
              className={`leave-ops-cal-day leave-ops-cal-day--btn${
                selected ? ' is-selected' : ''
              }${inRange ? ' leave-ops-cal-day--in-range' : ''}`}
              onClick={() => handleDayClick(cell.dateKey)}
              disabled={disabled}
              title={`Select ${cell.dateKey}`}
            >
              <span className="leave-ops-cal-day-num">{cell.day}</span>
            </button>
          );
        })}
      </div>

      <p className="leave-ops-add-leave-cal-legend">
        <span className="leave-ops-cal-legend-dot leave-ops-cal-legend-dot--blocked" aria-hidden />
        Existing leave (cannot select)
        {requestMode === 'full_day' ? ' · click start date, then end date' : null}
      </p>
    </div>
  );
}
