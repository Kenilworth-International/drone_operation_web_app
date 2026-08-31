import React, { useState } from 'react';
import '../../../styles/acceptMonthlyPlansBoard.css';
import '../../../styles/attendanceDayView.css';
import AttendanceDayView from './AttendanceDayView';
import RoasterPlanning from './RoasterPlanning';

export default function AttendanceRoasterHub() {
  const [activeTab, setActiveTab] = useState('attendance');

  return (
    <div className="attendance-roaster-hub">
      <div className="create-bookings-tabs attendance-roaster-tabs">
        <button
          type="button"
          className={`create-bookings-tab ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance
        </button>
        <button
          type="button"
          className={`create-bookings-tab ${activeTab === 'roaster' ? 'active' : ''}`}
          onClick={() => setActiveTab('roaster')}
        >
          Roaster Planning
        </button>
      </div>

      {activeTab === 'attendance' ? <AttendanceDayView /> : <RoasterPlanning embedded />}
    </div>
  );
}
