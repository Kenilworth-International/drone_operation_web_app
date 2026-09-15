import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HrmSubTabs } from '../shell/HrmShell';
import AttendanceDayView from './AttendanceDayView';
import LeaveOperationsPanel from '../leave/LeaveOperationsPanel';

const TABS = [
  { key: 'attendance', label: 'Daily Attendance' },
  { key: 'leave', label: 'Leave' },
];

export default function AttendanceLeaveHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(() => {
    const raw = String(searchParams.get('tab') || 'attendance').trim().toLowerCase();
    return raw === 'leave' ? 'leave' : 'attendance';
  }, [searchParams]);

  const onTabChange = useCallback(
    (key) => {
      const next = new URLSearchParams(searchParams);
      if (key === 'attendance') next.delete('tab');
      else next.set('tab', key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <div className="attendance-leave-hub">
      <HrmSubTabs tabs={TABS} active={activeTab} onChange={onTabChange} />
      {activeTab === 'leave' ? <LeaveOperationsPanel /> : <AttendanceDayView />}
    </div>
  );
}
