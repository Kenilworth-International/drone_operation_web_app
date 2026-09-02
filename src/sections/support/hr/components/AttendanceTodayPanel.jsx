import React from 'react';
import {
  getAttendanceLocationValid,
  getAttendanceRecordDistance,
  resolveAttendanceDistanceLabel,
} from '../utils/attendanceDisplay';

function DistanceCell({
  label,
  recordedDistance,
  locationValid,
  liveDistanceMeters,
  locationReady,
  locationError,
  showLivePreview,
  pendingAction,
}) {
  const display = resolveAttendanceDistanceLabel({
    recordedDistance,
    liveDistance: liveDistanceMeters,
    showLivePreview,
    locationReady,
    locationError,
    pendingAction,
  });

  const validityLabel = recordedDistance != null
    ? (locationValid === true ? 'In range' : locationValid === false ? 'Outside range' : null)
    : null;

  return (
    <div className="hrsup-att-today-panel__cell">
      <span className="hrsup-att-today-panel__cell-label">{label}</span>
      <span className={`hrsup-att-today-panel__cell-value hrsup-att-today-panel__cell-value--${display.tone}`}>
        {display.primary}
      </span>
      <span className="hrsup-att-today-panel__distance-meta">{validityLabel || display.secondary}</span>
    </div>
  );
}

export default function AttendanceTodayPanel({
  todayRecord,
  formatTime,
  workedMinutes,
  requiredMinutes,
  progressPercent,
  weeklyGraceRemaining,
  weeklyGraceAllowance,
  weekRangeLabel,
  shortLeaveMonthlyCap,
  requestedShortLeaveMonthlyUsed,
  markOutWindow,
  liveDistanceMeters = null,
  liveLocationValid = null,
  locationReady = false,
  locationError = '',
  hasMarkedIn = false,
  hasMarkedOut = false,
  canMarkIn = false,
  canMarkOut = false,
  radiusMeters,
}) {
  const shortLeaveRemaining = Math.max(0, shortLeaveMonthlyCap - requestedShortLeaveMonthlyUsed);
  const markInDistance = getAttendanceRecordDistance(todayRecord, 'in');
  const markOutDistance = getAttendanceRecordDistance(todayRecord, 'out');
  const markInValid = getAttendanceLocationValid(todayRecord, 'in');
  const markOutValid = getAttendanceLocationValid(todayRecord, 'out');

  return (
    <div className="hrsup-att-today-panel">
      <h3 className="hrsup-att-today-panel__title">Today&apos;s details</h3>

      <div className="hrsup-att-today-panel__progress-head">
        <span className="hrsup-att-today-panel__progress-label">Work progress</span>
        <span className="hrsup-att-today-panel__progress-value">
          {workedMinutes} / {requiredMinutes} min · {progressPercent}%
        </span>
      </div>
      <div className="hrsup-att-today-panel__progress-track" aria-hidden="true">
        <div className="hrsup-att-today-panel__progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="hrsup-att-today-panel__grid">
        <div className="hrsup-att-today-panel__cell">
          <span className="hrsup-att-today-panel__cell-label">Mark in</span>
          <span className="hrsup-att-today-panel__cell-value">{formatTime(todayRecord?.mark_in)}</span>
        </div>
        <div className="hrsup-att-today-panel__cell">
          <span className="hrsup-att-today-panel__cell-label">Mark out</span>
          <span className="hrsup-att-today-panel__cell-value">{formatTime(todayRecord?.mark_out)}</span>
        </div>
        <DistanceCell
          label="In distance"
          recordedDistance={markInDistance}
          locationValid={markInValid}
          liveDistanceMeters={liveDistanceMeters}
          locationReady={locationReady}
          locationError={locationError}
          showLivePreview={canMarkIn && !hasMarkedIn}
          pendingAction={canMarkIn ? 'mark_in' : null}
        />
        <DistanceCell
          label="Out distance"
          recordedDistance={markOutDistance}
          locationValid={markOutValid}
          liveDistanceMeters={liveDistanceMeters}
          locationReady={locationReady}
          locationError={locationError}
          showLivePreview={canMarkOut && hasMarkedIn && !hasMarkedOut}
          pendingAction={canMarkOut ? 'mark_out' : null}
        />
      </div>

      <div className="hrsup-att-today-panel__policy-row">
        <div className="hrsup-att-today-panel__policy-chip">
          <span className="hrsup-att-today-panel__policy-label">Grace exits</span>
          <strong className="hrsup-att-today-panel__policy-value">
            {weeklyGraceRemaining} of {weeklyGraceAllowance} left
          </strong>
          <span className="hrsup-att-today-panel__policy-meta">{weekRangeLabel ? 'This week' : 'Weekly'}</span>
        </div>
        <div className="hrsup-att-today-panel__policy-chip">
          <span className="hrsup-att-today-panel__policy-label">Short leave</span>
          <strong className="hrsup-att-today-panel__policy-value">
            {shortLeaveRemaining} of {shortLeaveMonthlyCap} left
          </strong>
          <span className="hrsup-att-today-panel__policy-meta">This month</span>
        </div>
      </div>

      {markOutWindow?.end ? (
        <p className="hrsup-att-today-panel__footnote">
          Mark-out window until {markOutWindow.end}
          {markOutWindow.start ? ` · target from ${markOutWindow.start}` : ''}
        </p>
      ) : null}
    </div>
  );
}
