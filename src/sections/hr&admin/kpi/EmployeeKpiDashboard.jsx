import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import SmartKpiTab from './SmartKpiTab';
import EmployeeKpiSystemMetrics from './EmployeeKpiSystemMetrics';
import { HrmPageHeader } from '../shell/HrmShell';
import '../../../styles/employeeKpi.css';

function buildSmartKpiTemplatesUrl(wing) {
  const base = '/home/attendance/smart-kpi-templates';
  return wing ? `${base}?wing=${encodeURIComponent(wing)}` : base;
}

function getWingFromUrl(searchParams, location) {
  const fromParams = searchParams.get('wing');
  if (fromParams) return fromParams;
  const fromLocation = new URLSearchParams(location.search || '').get('wing');
  if (fromLocation) return fromLocation;
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx >= 0) {
    return new URLSearchParams(hash.slice(qIdx + 1)).get('wing') || '';
  }
  return '';
}

export default function EmployeeKpiDashboard() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const wingLabel = getWingFromUrl(searchParams, location);
  const [activeTab, setActiveTab] = useState('smart');

  return (
    <div className="employee-kpi-container">
      <HrmPageHeader
        title="Performance"
        hint="SMART goal management per employee and auto-computed system metrics from HR data."
        wingLabel={wingLabel || undefined}
      />

      <div className="employee-kpi-tabs">
        <button
          type="button"
          className={`employee-kpi-tab${activeTab === 'smart' ? ' active' : ''}`}
          onClick={() => setActiveTab('smart')}
        >
          SMART KPI
        </button>
        <button
          type="button"
          className={`employee-kpi-tab${activeTab === 'system' ? ' active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          System Metrics
        </button>
      </div>

      {activeTab === 'smart' ? (
        <>
          <div className="smart-kpi-tab-toolbar">
            <p className="smart-kpi-tab-intro">
              Assign department templates by role, set goals across Specific · Measurable · Achievable · Relevant · Time-bound, then capture results at period end.
            </p>
            <Link
              to={buildSmartKpiTemplatesUrl(wingLabel)}
              className="employee-kpi-btn employee-kpi-btn-primary smart-kpi-templates-link"
            >
              SMART KPIs
            </Link>
          </div>
          <SmartKpiTab />
        </>
      ) : (
        <EmployeeKpiSystemMetrics />
      )}
    </div>
  );
}
