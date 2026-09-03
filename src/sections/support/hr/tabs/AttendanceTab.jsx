import React, { useEffect, useMemo, useState } from 'react';
import { FaFingerprint } from 'react-icons/fa';
import { getBrowserLocation, watchBrowserLocation } from '../utils/geolocation';
import { evaluateAttendanceGeofence } from '../utils/geofence';
import {
  buildMarkOutWaitHint,
  DEFAULT_SHORT_LEAVE_MINUTES,
  leaveStatusLabel,
} from '../utils/hrStatusLabels';
import AttendanceTodayPanel from '../components/AttendanceTodayPanel';
import { getEmployeeGreetingName } from '../utils/employeeDisplay';
import { formatApiDateDisplay, formatApiDateYmd } from '../utils/formatApiDate';

const LATE_TIME_OPTIONS = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'];
const REQUIRED_DAILY_MINUTES_DEFAULT = 570;

function formatTime(value) {
  if (!value) return '—';
  const raw = String(value).replace(' ', 'T');
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    const m = String(value).match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : '—';
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function workingMins(minutes) {
  const n = Math.max(0, Number(minutes) || 0);
  return `${Math.floor(n / 60)}h ${n % 60}m`;
}

function getWorkingMinutes(row) {
  return Math.max(0, Number(row?.working_minutes ?? row?.workingMinutes ?? 0));
}

function getMarkIn(row) {
  return row?.mark_in || row?.markIn || null;
}

function getMarkOut(row) {
  return row?.mark_out || row?.markOut || null;
}

function formatHistoryDate(value) {
  const ymd = formatApiDateYmd(value);
  if (!ymd) return '—';
  return formatApiDateDisplay(ymd, '—');
}

function getHistoryDayMeta(row) {
  const isNoPay = row?.nopay || String(row?.pay_status || row?.payStatus || '').toLowerCase() === 'nopay';
  if (isNoPay) {
    return {
      badge: { label: 'No pay', tone: 'danger' },
      note: row?.nopay_message || 'No pay day',
    };
  }
  const auto = row?.autoShortLeave || row?.auto_short_leave;
  if (auto?.autoReason || auto?.auto_reason || row?.auto_short_leave_request_id) {
    return { badge: { label: 'Automatic', tone: 'info' }, note: null };
  }
  if (getMarkIn(row) && getMarkOut(row)) {
    return { badge: { label: 'Complete', tone: 'success' }, note: null };
  }
  if (getMarkIn(row)) {
    return { badge: { label: 'Open', tone: 'muted' }, note: null };
  }
  return { badge: null, note: null };
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeToday(value, base = new Date()) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const parsed = new Date(base);
  parsed.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return parsed;
}

function parseDateTime(value) {
  if (!value) return null;
  const raw = String(value).replace(' ', 'T');
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getProgressPalette(workedMinutes, requiredMinutes) {
  if (workedMinutes >= requiredMinutes) {
    return { fill: '#16a34a', waveFront: '#16a34a', waveBack: '#16a34a' };
  }
  if (workedMinutes >= requiredMinutes * 0.75) {
    return { fill: '#86efac', waveFront: '#bbf7d0', waveBack: '#4ade80' };
  }
  if (workedMinutes >= requiredMinutes * 0.5) {
    return { fill: '#facc15', waveFront: '#fde047', waveBack: '#eab308' };
  }
  if (workedMinutes >= requiredMinutes * 0.25) {
    return { fill: '#f97316', waveFront: '#fb923c', waveBack: '#ea580c' };
  }
  return { fill: '#ef4444', waveFront: '#f87171', waveBack: '#dc2626' };
}

export default function AttendanceTab({
  attendanceLog,
  markAttendance,
  submitLateDepartureRequest,
  attendancePolicy,
  todayLeaveContext,
  todayLateDeparture,
  profile,
  workLocation,
  refreshing,
  refresh,
}) {
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState('mark');
  const [logMode, setLogMode] = useState('week');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [marking, setMarking] = useState(false);
  const [showLateForm, setShowLateForm] = useState(false);
  const [lateUntil, setLateUntil] = useState('');
  const [lateReason, setLateReason] = useState('');
  const [lateSubmitting, setLateSubmitting] = useState(false);
  const [lateError, setLateError] = useState('');
  const [noticeMsg, setNoticeMsg] = useState(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [deviceCoords, setDeviceCoords] = useState(null);
  const [locationWatchError, setLocationWatchError] = useState('');

  const geofenceRadius = Number(attendancePolicy?.geofenceRadiusMeters ?? workLocation?.radiusMeters ?? 20);
  const locationStatus = useMemo(() => evaluateAttendanceGeofence({
    workLocation,
    userLat: deviceCoords?.lat,
    userLng: deviceCoords?.lng,
    radiusMeters: geofenceRadius,
  }), [workLocation, deviceCoords, geofenceRadius]);

  useEffect(() => {
    if (view !== 'mark') {
      setDeviceCoords(null);
      setLocationWatchError('');
      return undefined;
    }
    const stopWatch = watchBrowserLocation(
      (coords) => {
        setDeviceCoords(coords);
        setLocationWatchError('');
      },
      (err) => {
        setLocationWatchError(err?.message || 'Unable to read your location.');
      },
    );
    return stopWatch;
  }, [view]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const employeeName = getEmployeeGreetingName(profile || attendanceLog[0]);
  const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const todayKey = toDateKey(now);
  const todayRecord = useMemo(() => {
    const todayMatches = attendanceLog.filter((row) => {
      const dk = formatApiDateYmd(row?.attendance_date || row?.date);
      const markInKey = row?.mark_in ? formatApiDateYmd(row.mark_in) : '';
      return dk === todayKey || markInKey === todayKey;
    });
    if (todayMatches.length === 0) return null;
    return todayMatches.sort((a, b) => {
      const score = (row) => (row?.mark_in ? 2 : 0) + (row?.mark_out ? 1 : 0);
      return score(b) - score(a);
    })[0];
  }, [attendanceLog, todayKey]);

  const hasMarkedIn = Boolean(todayRecord?.mark_in);
  const hasMarkedOut = Boolean(todayRecord?.mark_out);
  const todayMarkInDate = parseDateTime(todayRecord?.mark_in);
  const ongoingMinutes = todayMarkInDate && !hasMarkedOut
    ? Math.max(0, Math.floor((Date.now() - todayMarkInDate.getTime()) / 60000))
    : 0;
  const workedMinutes = Math.max(0, Number(todayRecord?.working_minutes || 0) + ongoingMinutes);

  const REQUIRED_DAILY_MINUTES = Number(attendancePolicy?.requiredDailyMinutes ?? REQUIRED_DAILY_MINUTES_DEFAULT);
  const progressRatio = Math.min(1, workedMinutes / REQUIRED_DAILY_MINUTES);
  const progressPercent = Math.min(100, Math.round(progressRatio * 100));
  const minutesShortfall = Math.max(0, REQUIRED_DAILY_MINUTES - workedMinutes);
  const progressPalette = getProgressPalette(workedMinutes, REQUIRED_DAILY_MINUTES);

  const markInEarliest = attendancePolicy?.markInEarliest || '08:00';
  const markInDeadline = attendancePolicy?.markInDeadline || '08:15';
  const earliestMarkOut = attendancePolicy?.earliestMarkOutTime || attendancePolicy?.normalMarkOutWindow?.start || '17:30';
  const markOutWindow = attendancePolicy?.normalMarkOutWindow || { start: '17:30', end: '17:45' };
  const shortLeaveCap = Number(attendancePolicy?.shortLeaveMonthlyCap ?? 4);
  const requestedShortLeaveUsed = Number(
    attendancePolicy?.requestedShortLeaveMonthlyUsed ?? attendancePolicy?.shortLeaveMonthlyUsed ?? 0
  );
  const shortLeaveExceeded = Boolean(attendancePolicy?.shortLeaveMonthlyExceeded ?? requestedShortLeaveUsed >= shortLeaveCap);
  const autoShortLeaveMonthlyUsed = Number(attendancePolicy?.autoShortLeaveMonthlyUsed ?? 0);
  const autoShortLeaveNextWouldBeNoPay = Boolean(attendancePolicy?.autoShortLeaveNextWouldBeNoPay);
  const autoShortLeaveNextNoPayAt = Number(attendancePolicy?.autoShortLeaveNextNoPayAt ?? 5);
  const weeklyGraceAllowance = Number(attendancePolicy?.weeklyGraceAllowance ?? 2);
  const weeklyGraceUsed = Number(attendancePolicy?.weeklyGraceUsed ?? 0);
  const weeklyGraceRemaining = Math.max(0, weeklyGraceAllowance - weeklyGraceUsed);
  const weekRangeLabel = useMemo(() => {
    const startRaw = attendancePolicy?.weeklyGraceWeekStart;
    const endRaw = attendancePolicy?.weeklyGraceWeekEnd;
    const start = startRaw ? parseDateTime(startRaw) : null;
    const end = endRaw ? parseDateTime(endRaw) : null;
    if (!start || !end) return '';
    return `${start.toLocaleDateString([], { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString([], { day: '2-digit', month: 'short' })}`;
  }, [attendancePolicy?.weeklyGraceWeekStart, attendancePolicy?.weeklyGraceWeekEnd]);

  const hasApprovedLeaveToday = Boolean(todayLeaveContext?.hasApprovedLeave);
  const canMarkIn = !hasMarkedIn;
  const canMarkOut = hasMarkedIn && !hasMarkedOut;
  const canMarkInByTime = canMarkIn && (!parseTimeToday(markInEarliest, now) || now >= parseTimeToday(markInEarliest, now));
  const canMarkOutByTime = canMarkOut && (
    REQUIRED_DAILY_MINUTES <= 0
    || todayLeaveContext?.requestMode === 'full_day'
    || !parseTimeToday(earliestMarkOut, now)
    || now >= parseTimeToday(earliestMarkOut, now)
  );
  const mainActionMode = canMarkIn ? 'mark_in' : canMarkOut ? 'mark_out' : null;
  const isEarlyMarkOut = mainActionMode === 'mark_out' && canMarkOutByTime && minutesShortfall > 0;
  const isGraceMarkOut = isEarlyMarkOut && weeklyGraceRemaining > 0;
  const showProgressFill = hasMarkedIn && progressRatio > 0 && !isEarlyMarkOut;

  const mainActionText = canMarkIn
    ? (canMarkInByTime ? 'Mark In' : `From ${markInEarliest}`)
    : canMarkOut
      ? (canMarkOutByTime ? 'Mark Out' : `From ${earliestMarkOut}`)
      : 'Completed';

  const locationReady = Boolean(deviceCoords && !locationWatchError);

  const isActionDisabled = !mainActionMode
    || marking
    || !locationReady
    || (mainActionMode === 'mark_in' && !canMarkInByTime)
    || (mainActionMode === 'mark_out' && !canMarkOutByTime);

  const lateDepartureStatus = String(todayLateDeparture?.current_status || '').toLowerCase();
  const canRequestLateDeparture = hasMarkedIn
    && !hasMarkedOut
    && submitLateDepartureRequest
    && !['pending_l1', 'pending_l2', 'approved'].includes(lateDepartureStatus);

  const markOutWaitHint = buildMarkOutWaitHint({
    earliestMarkOutTime: earliestMarkOut,
    hasApprovedLeaveToday,
    approvedLeaveContext: todayLeaveContext,
  });

  const handleMark = async () => {
    if (!mainActionMode || isActionDisabled) return;
    if (!deviceCoords) {
      setNoticeMsg({ tone: 'warn', msg: 'Turn on location to mark attendance.' });
      return;
    }
    setMarking(true);
    try {
      const freshLocation = await getBrowserLocation();
      setDeviceCoords(freshLocation);
      const result = await markAttendance(mainActionMode, freshLocation.lat, freshLocation.lng);
      const geofenceMsg = result?.geofence?.message;
      setNoticeMsg({
        tone: result?.geofence?.valid === false ? 'warn' : 'success',
        msg: geofenceMsg
          ? `${mainActionMode === 'mark_in' ? 'Marked in' : 'Marked out'} successfully. ${geofenceMsg}`
          : (mainActionMode === 'mark_in' ? 'Marked in successfully.' : 'Marked out successfully.'),
      });
    } catch (err) {
      setNoticeMsg({ tone: 'error', msg: err?.message || 'Failed to mark attendance.' });
    } finally {
      setMarking(false);
    }
  };

  const handleLateDeparture = async () => {
    if (!lateUntil) { setLateError('Select a requested until time.'); return; }
    if (!lateReason.trim()) { setLateError('Enter a reason.'); return; }
    setLateSubmitting(true);
    setLateError('');
    try {
      await submitLateDepartureRequest(lateUntil, lateReason);
      setShowLateForm(false);
      setLateUntil('');
      setLateReason('');
      setNoticeMsg({ tone: 'success', msg: 'Late stay request submitted.' });
    } catch (err) {
      setLateError(err?.message || 'Failed to submit.');
    } finally {
      setLateSubmitting(false);
    }
  };

  const getWeekRange = (offset) => {
    const base = new Date(now);
    const day = base.getDay();
    const mondayOff = day === 0 ? -6 : 1 - day;
    base.setDate(base.getDate() + mondayOff + offset * 7);
    const start = new Date(base); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
    return { start, end };
  };
  const getMonthRange = (offset) => {
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };
  const range = logMode === 'week' ? getWeekRange(periodOffset) : getMonthRange(periodOffset);
  const filteredLog = useMemo(() => attendanceLog.filter((row) => {
    const dk = formatApiDateYmd(row?.attendance_date || row?.date);
    if (!dk) return false;
    const d = new Date(`${dk}T12:00:00`);
    return d >= range.start && d <= range.end;
  }), [attendanceLog, range]);

  const sortedLog = useMemo(
    () => [...filteredLog].sort((a, b) => {
      const aKey = formatApiDateYmd(a?.attendance_date || a?.date);
      const bKey = formatApiDateYmd(b?.attendance_date || b?.date);
      return bKey.localeCompare(aKey);
    }),
    [filteredLog],
  );

  const historySummary = useMemo(() => {
    const totalMinutes = sortedLog.reduce((sum, row) => sum + getWorkingMinutes(row), 0);
    return {
      days: sortedLog.length,
      totalLabel: workingMins(totalMinutes),
    };
  }, [sortedLog]);

  const periodLabel = logMode === 'week'
    ? `${range.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${range.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : range.start.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const circleModifiers = [
    isActionDisabled ? 'hrsup-att-circle-inner--disabled' : '',
    isGraceMarkOut ? 'hrsup-att-circle-inner--grace' : '',
    isEarlyMarkOut && !isGraceMarkOut ? 'hrsup-att-circle-inner--short' : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div className="hrsup-att-hero">
        <button type="button" className="hrsup-att-rules-btn" onClick={() => setShowRulesModal(true)}>Rules</button>
        <p className="hrsup-att-greeting">Hi, {employeeName}</p>
        <p className="hrsup-att-time">{timeLabel}</p>
        <p className="hrsup-att-date">{dateLabel}</p>
      </div>

      {autoShortLeaveNextWouldBeNoPay && (
        <div className="hrsup-notice-box hrsup-notice-box--warn">
          Automatic short leaves this month: {autoShortLeaveMonthlyUsed}. Your next automatic short leave ({autoShortLeaveNextNoPayAt}) will be marked no pay (5th, 9th, 13th… pattern).
        </div>
      )}

      {shortLeaveExceeded && (
        <div className="hrsup-notice-box hrsup-notice-box--warn">
          Requested short leave limit reached ({requestedShortLeaveUsed} of {shortLeaveCap}). You cannot submit another short leave request this month.
        </div>
      )}

      {noticeMsg && (
        <div className={`hrsup-notice-box hrsup-notice-box--${noticeMsg.tone}`} style={{ position: 'relative' }}>
          {noticeMsg.msg}
          <button type="button" className="hrsup-error-dismiss" style={{ color: 'inherit' }} onClick={() => setNoticeMsg(null)}>✕</button>
        </div>
      )}

      <div className="hrsup-segments">
        <button type="button" className={`hrsup-segment-btn${view === 'mark' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => setView('mark')}>Today</button>
        <button type="button" className={`hrsup-segment-btn${view === 'log' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => setView('log')}>History</button>
      </div>
      <p className="hrsup-att-view-hint" style={{ display: 'none' }} aria-hidden="true" />

      {view === 'mark' && (
        <>
          <button
            type="button"
            className={`hrsup-att-circle-outer${marking ? ' hrsup-att-circle-outer--busy' : ''}`}
            disabled={isActionDisabled}
            onClick={handleMark}
          >
            <div
              className={`hrsup-att-circle-inner ${circleModifiers}`}
              style={{
                '--att-progress': showProgressFill ? `${progressPercent}%` : '0%',
                '--att-fill': progressPalette.fill,
              }}
            >
              {showProgressFill && <div className="hrsup-att-circle-fill" aria-hidden="true" />}
              <div className="hrsup-att-circle-content">
                {!isEarlyMarkOut && <FaFingerprint className="hrsup-att-fingerprint" aria-hidden="true" />}
                {marking ? (
                  <span className="hrsup-att-circle-label">Refreshing location…</span>
                ) : (
                  <>
                    <span className={`hrsup-att-circle-label${isEarlyMarkOut ? ' hrsup-att-circle-label--compact' : ''}`}>{mainActionText}</span>
                    {isGraceMarkOut && <span className="hrsup-att-badge hrsup-att-badge--grace">Grace exit</span>}
                    {isEarlyMarkOut && !isGraceMarkOut && <span className="hrsup-att-badge hrsup-att-badge--short">Short leave</span>}
                  </>
                )}
              </div>
            </div>
          </button>

          {mainActionMode === 'mark_out' && canMarkOutByTime && minutesShortfall > 0 && (
            <p className={`hrsup-att-inline-hint${weeklyGraceRemaining > 0 ? ' hrsup-att-inline-hint--info' : ' hrsup-att-inline-hint--warn'}`}>
              {weeklyGraceRemaining > 0
                ? `${minutesShortfall}m short · grace exit`
                : autoShortLeaveNextWouldBeNoPay
                  ? `${minutesShortfall}m short · no-pay slot`
                  : `${minutesShortfall}m short · auto short leave`}
            </p>
          )}
          {mainActionMode === 'mark_in' && !canMarkInByTime && (
            <p className="hrsup-att-inline-hint hrsup-att-inline-hint--warn">Opens at {markInEarliest}</p>
          )}
          {mainActionMode === 'mark_out' && !canMarkOutByTime && (
            <p className="hrsup-att-inline-hint hrsup-att-inline-hint--warn">{markOutWaitHint}</p>
          )}
          {!locationReady && mainActionMode && (
            <p className="hrsup-att-inline-hint hrsup-att-inline-hint--warn">
              Turn on location to {mainActionMode === 'mark_in' ? 'mark in' : 'mark out'}
            </p>
          )}

          <AttendanceTodayPanel
            todayRecord={todayRecord}
            formatTime={formatTime}
            workedMinutes={workedMinutes}
            requiredMinutes={REQUIRED_DAILY_MINUTES}
            progressPercent={progressPercent}
            weeklyGraceRemaining={weeklyGraceRemaining}
            weeklyGraceAllowance={weeklyGraceAllowance}
            weekRangeLabel={weekRangeLabel}
            shortLeaveMonthlyCap={shortLeaveCap}
            requestedShortLeaveMonthlyUsed={requestedShortLeaveUsed}
            markOutWindow={markOutWindow}
            liveDistanceMeters={locationStatus.distanceMeters}
            liveLocationValid={locationStatus.valid}
            locationReady={locationReady}
            locationError={locationWatchError}
            hasMarkedIn={hasMarkedIn}
            hasMarkedOut={hasMarkedOut}
            canMarkIn={canMarkIn}
            canMarkOut={canMarkOut}
            radiusMeters={locationStatus.radiusMeters}
          />

          {todayLateDeparture && (
            <div className="hrsup-card hrsup-att-late-status">
              <h3 className="hrsup-card-title">Late stay</h3>
              <p className="hrsup-att-late-desc">
                Until {formatTime(todayLateDeparture.requested_until_time)} · <strong>{leaveStatusLabel(todayLateDeparture.current_status || 'pending')}</strong>
              </p>
              {lateDepartureStatus !== 'approved' && (
                <p className="hrsup-att-late-desc hrsup-att-late-desc--warn">
                  Wait for approval before late mark-out
                </p>
              )}
            </div>
          )}

          {canRequestLateDeparture && !showLateForm && (
            <div className="hrsup-card hrsup-att-late-card">
              <h3 className="hrsup-card-title">Request late stay</h3>
              <button type="button" className="hrsup-btn hrsup-btn--primary hrsup-btn--full" onClick={() => setShowLateForm(true)}>
                Add request
              </button>
            </div>
          )}

          {showLateForm && canRequestLateDeparture && (
            <div className="hrsup-card hrsup-att-late-card">
              <div className="hrsup-card-head">
                <h3 className="hrsup-card-title" style={{ margin: 0 }}>Late stay</h3>
                <button type="button" className="hrsup-btn hrsup-btn--secondary hrsup-btn--sm" onClick={() => { setShowLateForm(false); setLateError(''); }}>Cancel</button>
              </div>
              <p className="hrsup-att-late-desc">Leave time</p>
              <div className="hrsup-time-grid">
                {LATE_TIME_OPTIONS.map((t) => (
                  <button key={t} type="button" className={`hrsup-time-chip${lateUntil === t ? ' hrsup-time-chip--active' : ''}`} onClick={() => setLateUntil(t)}>{t}</button>
                ))}
              </div>
              <div className="hrsup-field">
                <label className="hrsup-label">Reason</label>
                <textarea className="hrsup-input" rows={2} value={lateReason} onChange={(e) => setLateReason(e.target.value)} placeholder="Reason" style={{ resize: 'vertical' }} />
              </div>
              {lateError && <div className="hrsup-notice-box hrsup-notice-box--error">{lateError}</div>}
              <button type="button" className="hrsup-btn hrsup-btn--primary hrsup-btn--full" disabled={lateSubmitting} onClick={handleLateDeparture}>
                {lateSubmitting ? 'Sending…' : 'Submit'}
              </button>
            </div>
          )}
        </>
      )}

      {view === 'log' && (
        <>
          <div className="hrsup-card hrsup-att-history-toolbar">
            <button type="button" className="hrsup-att-history-refresh" onClick={refresh} disabled={refreshing} aria-label="Refresh">
              <span className={refreshing ? 'hrsup-spin' : ''}>↻</span>
            </button>
            <div className="hrsup-segments hrsup-att-history-segments">
              <button type="button" className={`hrsup-segment-btn${logMode === 'week' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => { setLogMode('week'); setPeriodOffset(0); }}>Week</button>
              <button type="button" className={`hrsup-segment-btn${logMode === 'month' ? ' hrsup-segment-btn--active' : ''}`} onClick={() => { setLogMode('month'); setPeriodOffset(0); }}>Month</button>
            </div>
            <div className="hrsup-att-history-nav">
              <button type="button" className="hrsup-att-history-nav-btn" onClick={() => setPeriodOffset((p) => p - 1)} aria-label="Previous period">‹</button>
              <span className="hrsup-att-history-period">{periodLabel}</span>
              <button type="button" className="hrsup-att-history-nav-btn" disabled={periodOffset >= 0} onClick={() => setPeriodOffset((p) => p + 1)} aria-label="Next period">›</button>
            </div>
            {sortedLog.length > 0 && (
              <div className="hrsup-att-history-summary">
                <span>{historySummary.days} {historySummary.days === 1 ? 'day' : 'days'}</span>
                <span className="hrsup-att-history-summary-dot">·</span>
                <span>{historySummary.totalLabel} worked</span>
              </div>
            )}
          </div>

          {sortedLog.length === 0 ? (
            <div className="hrsup-card hrsup-att-history-empty">
              <p className="hrsup-att-history-empty-title">No records</p>
              <p className="hrsup-att-history-empty-text">No attendance logged for this period.</p>
              <button type="button" className="hrsup-btn hrsup-btn--secondary hrsup-btn--sm" onClick={refresh} disabled={refreshing} style={{ marginTop: 12 }}>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          ) : (
            <div className="hrsup-att-history-list">
              {sortedLog.map((row, idx) => {
                const dateKey = formatApiDateYmd(row?.attendance_date || row?.date);
                const dayMeta = getHistoryDayMeta(row);
                return (
                  <div key={String(row?.id || `${dateKey}-${idx}`)} className="hrsup-card hrsup-att-history-card">
                    <div className="hrsup-att-history-card-top">
                      <span className="hrsup-att-history-date">{formatHistoryDate(dateKey)}</span>
                      {dayMeta.badge && (
                        <span className={`hrsup-att-history-badge hrsup-att-history-badge--${dayMeta.badge.tone}`}>
                          {dayMeta.badge.label}
                        </span>
                      )}
                    </div>
                    <div className="hrsup-att-history-metrics">
                      <div className="hrsup-att-history-metric">
                        <span className="hrsup-att-history-metric-label">Mark in</span>
                        <span className="hrsup-att-history-metric-value">{formatTime(getMarkIn(row))}</span>
                      </div>
                      <div className="hrsup-att-history-metric-divider" aria-hidden="true" />
                      <div className="hrsup-att-history-metric">
                        <span className="hrsup-att-history-metric-label">Mark out</span>
                        <span className="hrsup-att-history-metric-value">{formatTime(getMarkOut(row))}</span>
                      </div>
                      <div className="hrsup-att-history-metric-divider" aria-hidden="true" />
                      <div className="hrsup-att-history-metric">
                        <span className="hrsup-att-history-metric-label">Worked</span>
                        <span className="hrsup-att-history-metric-value">{workingMins(getWorkingMinutes(row))}</span>
                      </div>
                    </div>
                    {dayMeta.note && (
                      <p className={`hrsup-att-history-note${dayMeta.badge?.tone === 'danger' ? ' hrsup-att-history-note--danger' : ''}`}>
                        {dayMeta.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showRulesModal && (
        <div className="hrsup-modal-overlay" onClick={() => setShowRulesModal(false)} role="presentation">
          <div className="hrsup-modal hrsup-att-rules-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="att-rules-title">
            <div className="hrsup-modal-head">
              <h2 id="att-rules-title" className="hrsup-modal-title">Attendance rules</h2>
              <button type="button" className="hrsup-modal-close" onClick={() => setShowRulesModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="hrsup-modal-body hrsup-att-rules-body">
              <section className="hrsup-att-rules-section">
                <h3>Today&apos;s progress</h3>
                <div className="hrsup-att-rules-progress">
                  <div className="hrsup-att-rules-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <p>Worked: {workedMinutes} / {REQUIRED_DAILY_MINUTES} min ({progressPercent}%)</p>
                <p>Mark in: {formatTime(todayRecord?.mark_in)} · Mark out: {formatTime(todayRecord?.mark_out)}</p>
                {minutesShortfall > 0 && !hasMarkedOut && (
                  <p className="hrsup-att-rules-warn">Still need {minutesShortfall} min to complete today&apos;s target.</p>
                )}
              </section>
              <section className="hrsup-att-rules-section">
                <h3>Mark in</h3>
                <p>Available from {markInEarliest}. On time until {markInDeadline}.</p>
                <p>After {markInDeadline}, automatic short leave may apply (up to {DEFAULT_SHORT_LEAVE_MINUTES} min).</p>
              </section>
              <section className="hrsup-att-rules-section">
                <h3>Mark out</h3>
                <p>Normal exit from {earliestMarkOut} (after {REQUIRED_DAILY_MINUTES} min work).</p>
                <p>Staying after {markOutWindow.end} needs late-departure approval.</p>
              </section>
              <section className="hrsup-att-rules-section">
                <h3>Weekly grace</h3>
                <p>{weeklyGraceUsed} of {weeklyGraceAllowance} used · {weeklyGraceRemaining} remaining</p>
              </section>
              {hasApprovedLeaveToday && (
                <section className="hrsup-att-rules-section">
                  <h3>Today&apos;s leave</h3>
                  <p>{todayLeaveContext?.warningMessage || 'Approved leave applies today.'}</p>
                </section>
              )}
            </div>
            <div className="hrsup-modal-foot">
              <button type="button" className="hrsup-btn hrsup-btn--primary" onClick={() => setShowRulesModal(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
