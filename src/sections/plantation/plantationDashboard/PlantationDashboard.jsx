import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../../store/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../../../store/slices/authSlice';
import { baseApi } from '../../../api/services/allEndpoints';
import { getUserData } from '../../../utils/authUtils';
import {
  FaSignOutAlt,
  FaCalendarAlt,
  FaClipboardList,
  FaCheckCircle,
  FaTimesCircle,
  FaCogs,
  FaChartBar,
  FaExclamationTriangle,
  FaTimes,
  FaChevronRight,
  FaAdjust,
  FaFileExcel,
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import {
  useGetDisplayGroupsQuery,
  useGetAllPlantationsQuery,
  useGetAllEstatesQuery,
} from '../../../api/services/estatesApi';
import { useGetUserJobRolesQuery } from '../../../api/services NodeJs/jdManagementApi';
import { useGetDashboardSummaryQuery, useGetCompletedMissionReportsQuery } from '../../../api/services NodeJs/plantationDashboardApi';
import PlantationChartsPanel from './components/PlantationChartsPanel';
import { format } from 'date-fns';
import { Bars } from 'react-loader-spinner';
import '../../../styles/plantationDashboard.css';
import { appendShellParams } from '../../../utils/shellSearchParams';

const PlantationDashboard = ({
  basePath = '/home/plantation-dashboard',
  showUserHierarchy = true,
  showTopHeader = undefined,
  embeddedInExternalShell = false,
} = {}) => {
  const shouldShowTopHeader = showTopHeader ?? basePath !== '/home/dashboard';
  const isInternalDashboard =
    basePath === '/home/dashboard' || basePath.startsWith('/home/dashboard/');
  /** Internal `/home/dashboard` omits `completed=1` filters; plantation dashboard keeps them. */
  const completedPlansOnly = !isInternalDashboard;
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const userData = getUserData();

  // Current month for summary (default)
  const getCurrentYearMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getCurrentMonthName = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const [selectedAction, setSelectedAction] = useState('Spray');
  const missionType = selectedAction === 'Spray' ? 'spy' : 'spd';

  // Chart month range (separate from summary month)
  const [chartMonthRange, setChartMonthRange] = useState(() => {
    const today = new Date();
    const startMonth = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return { start: startMonth, end: today };
  });

  const chartMonths = useMemo(() => {
    const start = chartMonthRange.start;
    const end = chartMonthRange.end;
    const months = [];
    const current = new Date(start);
    while (current <= end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    return months.length;
  }, [chartMonthRange]);

  // Popup state
  const [activePopup, setActivePopup] = useState(null); // 'cancelled' | 'executed' | 'partial' | null

  const closePopup = useCallback(() => setActivePopup(null), []);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') closePopup(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [closePopup]);

  // Fetch hierarchy data for displaying names
  const { data: groupsData } = useGetDisplayGroupsQuery();
  const { data: plantationsData } = useGetAllPlantationsQuery();
  const { data: estatesData } = useGetAllEstatesQuery();
  const { data: jobRolesData } = useGetUserJobRolesQuery();

  const groups = Array.isArray(groupsData?.data) ? groupsData.data : (Array.isArray(groupsData) ? groupsData : []);
  const plantations = Array.isArray(plantationsData?.data) ? plantationsData.data : (Array.isArray(plantationsData) ? plantationsData : []);
  const estates = Array.isArray(estatesData?.data) ? estatesData.data : (Array.isArray(estatesData) ? estatesData : []);
  const jobRoles = Array.isArray(jobRolesData?.data) ? jobRolesData.data : (Array.isArray(jobRolesData) ? jobRolesData : []);

  const regions = useMemo(() => {
    const regionMap = new Map();
    estates.forEach(estate => {
      if (estate.region && !regionMap.has(estate.region)) {
        regionMap.set(estate.region, { id: estate.region, name: estate.region_name || `Region ${estate.region}` });
      }
    });
    return Array.from(regionMap.values());
  }, [estates]);

  const userInfo = useMemo(() => {
    const group = userData?.group ? groups.find(g => g.id === parseInt(userData.group)) : null;
    const plantation = userData?.plantation ? plantations.find(p => p.id === parseInt(userData.plantation)) : null;
    const region = userData?.region ? regions.find(r => r.id === parseInt(userData.region)) : null;
    const estate = userData?.estate ? estates.find(e => e.id === parseInt(userData.estate)) : null;
    let jobRole = null;
    if (userData?.job_role) {
      const jobRoleId = parseInt(userData.job_role);
      if (!isNaN(jobRoleId)) jobRole = jobRoles.find(jr => jr.id === jobRoleId);
      if (!jobRole) jobRole = jobRoles.find(jr => jr.jdCode === userData.job_role);
    }
    return {
      designation: jobRole?.designation || 'N/A',
      group: group?.name || group?.group || null,
      plantation: plantation?.name || plantation?.plantation || null,
      region: region?.name || null,
      estate: estate?.name || estate?.estate || null,
    };
  }, [userData, groups, plantations, regions, estates, jobRoles]);

  const todayYmd = format(new Date(), 'yyyy-MM-dd');
  const currentYearMonth = getCurrentYearMonth();
  const planCountFromMonthStart = `${currentYearMonth}-01`;

  // Fetch summary for current month; internal dashboard: plan count / total planned = picked date from 1st of month through today
  const { data: summaryResponse, isLoading: summaryLoading } = useGetDashboardSummaryQuery(
    {
      yearMonth: currentYearMonth,
      missionType,
      completedPlansOnly,
      ...(isInternalDashboard
        ? { planCountPickedFrom: planCountFromMonthStart, planCountPickedTo: todayYmd }
        : {}),
    },
    { refetchOnMountOrArgChange: true }
  );
  const summary = summaryResponse?.data || {};

  // Fetch completed reports for executed popup (current month)
  const monthStart = planCountFromMonthStart;
  const monthEndDate = new Date(
    parseInt(currentYearMonth.split('-')[0]),
    parseInt(currentYearMonth.split('-')[1]),
    0
  );
  const monthEnd = `${currentYearMonth}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

  const { data: reportsData, isLoading: reportsLoading } = useGetCompletedMissionReportsQuery(
    { startDate: monthStart, endDate: monthEnd, missionType, completedPlansOnly },
    { skip: activePopup !== 'executed' }
  );
  const reports = useMemo(() => {
    const all = reportsData?.data || [];
    if (!completedPlansOnly) return all;
    return all.filter(r => parseFloat(r.completed_area || 0) > 0);
  }, [reportsData, completedPlansOnly]);

  const handleLogout = () => {
    dispatch(baseApi.util.resetApiState());
    queryClient.clear();
    dispatch(logout());
    localStorage.removeItem('activeLink');
    localStorage.removeItem('leftnav_expanded');
    navigate('/login');
  };

  const exportCancelledToExcel = useCallback(() => {
    const fields = summary.cancelledFields || [];
    if (fields.length === 0) return;
    const rows = fields.map((f) => ({
      'Plan ID': f.planId,
      'Date': f.pickedDate,
      'Estate': f.estateName,
      'Field': f.fieldName,
      'Area (Ha)': parseFloat(f.fieldArea.toFixed(2)),
      'Pilot': f.pilotName,
      'Reason': f.cancelReason,
    }));
    rows.push({
      'Plan ID': '',
      'Date': '',
      'Estate': '',
      'Field': 'TOTAL',
      'Area (Ha)': parseFloat((summary.cancelledExtent || 0).toFixed(2)),
      'Pilot': '',
      'Reason': '',
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cancelled Fields');
    XLSX.writeFile(wb, `Cancelled_Fields_${getCurrentYearMonth()}.xlsx`);
  }, [summary]);

  const exportPartialToExcel = useCallback(() => {
    const fields = summary.partiallyCompletedFields || [];
    if (fields.length === 0) return;
    const rows = fields.map((f) => {
      const pct = f.fieldArea > 0 ? ((f.completedArea / f.fieldArea) * 100).toFixed(1) : '0.0';
      return {
        'Plan ID': f.planId,
        'Date': f.pickedDate,
        'Estate': f.estateName,
        'Field': f.fieldName,
        'Field Size (Ha)': parseFloat(f.fieldArea.toFixed(2)),
        'Completed (Ha)': parseFloat(f.completedArea.toFixed(2)),
        'Completion %': parseFloat(pct),
        'Pilot': f.pilotName,
        'Reason': f.partialReason,
      };
    });
    const totalArea = fields.reduce((s, f) => s + f.fieldArea, 0);
    const totalCompleted = fields.reduce((s, f) => s + f.completedArea, 0);
    rows.push({
      'Plan ID': '',
      'Date': '',
      'Estate': '',
      'Field': 'TOTAL',
      'Field Size (Ha)': parseFloat(totalArea.toFixed(2)),
      'Completed (Ha)': parseFloat(totalCompleted.toFixed(2)),
      'Completion %': totalArea > 0 ? parseFloat(((totalCompleted / totalArea) * 100).toFixed(1)) : 0,
      'Pilot': '',
      'Reason': '',
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Partially Completed');
    XLSX.writeFile(wb, `Partially_Completed_${getCurrentYearMonth()}.xlsx`);
  }, [summary]);

  const summaryCards = [
    {
      key: 'totalPlanned',
      label: 'Total Planned Extent',
      value: summary.totalPlannedExtent || 0,
      unit: 'Ha',
      icon: <FaClipboardList />,
      color: '#1d4ed8',
      bg: '#eff6ff',
      border: '#1d4ed8',
      clickable: false,
      subtitle:
        summary.planCount != null
          ? `${summary.planCount} ${summary.planCount === 1 ? 'plan' : 'plans'}`
          : null,
    },
    {
      key: 'estateApproved',
      label: 'Estate Approved Extent',
      value: summary.estateApprovedExtent || 0,
      unit: 'Ha',
      icon: <FaCheckCircle />,
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#15803d',
      clickable: false,
    },
    {
      key: 'cancelled',
      label: 'Cancelled Before Execution',
      value: summary.cancelledExtent || 0,
      unit: 'Ha',
      icon: <FaTimesCircle />,
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#dc2626',
      clickable: true,
      onClick: () => setActivePopup('cancelled'),
    },
    ...(isInternalDashboard
      ? [
          {
            key: 'partial',
            label: 'Partially Completed',
            value: summary.partiallyCompletedExtent || 0,
            unit: 'Ha',
            icon: <FaAdjust />,
            color: '#ea580c',
            bg: '#fff7ed',
            border: '#ea580c',
            clickable: true,
            onClick: () => setActivePopup('partial'),
          },
        ]
      : []),
    {
      key: 'executed',
      label: 'Executed Extent',
      value: summary.executedExtent || 0,
      unit: 'Ha',
      icon: <FaCogs />,
      color: '#7c3aed',
      bg: '#f5f3ff',
      border: '#7c3aed',
      clickable: true,
      onClick: () => {
        const currentMonth = getCurrentYearMonth();
        const sp = new URLSearchParams();
        sp.set('month', currentMonth);
        sp.set('chart', 'planned-vs-sprayed');
        appendShellParams(sp, location.search);
        navigate(`${basePath}/chart-breakdown?${sp.toString()}`);
      },
    },
    {
      key: 'covered',
      label: 'Covered Extent',
      value: summary.coveredExtent || 0,
      unit: 'Ha',
      icon: <FaChartBar />,
      color: '#0891b2',
      bg: '#ecfeff',
      border: '#0891b2',
      clickable: false,
    },
    {
      key: 'incomplete',
      label: 'Incomplete Extent',
      value: summary.incompleteExtent || 0,
      unit: 'Ha',
      icon: <FaExclamationTriangle />,
      color: '#d97706',
      bg: '#fffbeb',
      border: '#d97706',
      clickable: false,
    },
  ];

  return (
    <div
      className={`plantation-dashboard-container${isInternalDashboard ? ' plantation-dashboard-container--internal' : ''}${embeddedInExternalShell ? ' plantation-dashboard-container--embedded' : ''}`}
    >
      {/* Header */}
      {shouldShowTopHeader && (
        <div className="plantation-dashboard-header">
          <div className="plantation-header-content">
            <div>
              <h1 className="plantation-dashboard-title">Plantation Dashboard</h1>
              <div className="plantation-dashboard-subtitle">
                Welcome, {userData?.name || userData?.username || 'User'}
              </div>
            </div>
            <div className="plantation-user-info">
              {userInfo.designation && (
                <div className="plantation-user-info-item">
                  <span className="plantation-user-info-label">Designation:</span>
                  <span className="plantation-user-info-value">{userInfo.designation}</span>
                </div>
              )}
              {showUserHierarchy && userInfo.group && (
                <div className="plantation-user-info-item">
                  <span className="plantation-user-info-label">Group:</span>
                  <span className="plantation-user-info-value">{userInfo.group}</span>
                </div>
              )}
              {showUserHierarchy && userInfo.plantation && (
                <div className="plantation-user-info-item">
                  <span className="plantation-user-info-label">Plantation:</span>
                  <span className="plantation-user-info-value">{userInfo.plantation}</span>
                </div>
              )}
              {showUserHierarchy && userInfo.region && (
                <div className="plantation-user-info-item">
                  <span className="plantation-user-info-label">Region:</span>
                  <span className="plantation-user-info-value">{userInfo.region}</span>
                </div>
              )}
              {showUserHierarchy && userInfo.estate && (
                <div className="plantation-user-info-item">
                  <span className="plantation-user-info-label">Estate:</span>
                  <span className="plantation-user-info-value">{userInfo.estate}</span>
                </div>
              )}
            </div>
            <button className="plantation-logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
      )}

      <div className="plantation-dashboard-content">
        {/* Summary Bar with Mission Type toggle */}
        <div className="pd-summary-bar">
          <h2 className="pd-summary-title">
            Summary for {getCurrentMonthName()}{' '}
            {summary.completionPercent != null && (
              <span className="pd-summary-percent">- {summary.completionPercent}% Completed</span>
            )}
          </h2>
          <div className="pd-summary-bar-actions">
            <div className="plantation-charts-control-group pd-mission-segment">
              <button
                className={`plantation-action-btn ${selectedAction === 'Spray' ? 'active' : ''}`}
                onClick={() => setSelectedAction('Spray')}
              >
                Spray
              </button>
              <button
                className={`plantation-action-btn ${selectedAction === 'Spread' ? 'active' : ''}`}
                onClick={() => setSelectedAction('Spread')}
              >
                Spread
              </button>
            </div>
            {basePath !== '/home/dashboard' && !embeddedInExternalShell && (
              <button
                className="pd-calendar-btn"
                onClick={() => navigate(`${basePath}/calendar`)}
              >
                <FaCalendarAlt /> Plan Requests
              </button>
            )}
          </div>
        </div>

        {/* 6 Summary Cards */}
        <div className="pd-metrics-grid">
          {summaryCards.map((card) => (
            <div
              key={card.key}
              className={`pd-metric-card ${card.clickable ? 'pd-metric-card--clickable' : ''}`}
              style={{ borderLeftColor: card.border, backgroundColor: card.bg }}
              onClick={card.clickable ? card.onClick : undefined}
            >
              <div className="pd-metric-label">{card.label}</div>
              <div className="pd-metric-value" style={{ color: card.color }}>
                {summaryLoading ? (
                  <Bars height={24} width={40} color={card.color} />
                ) : (
                  <>
                    {parseFloat(card.value).toFixed(2)} {card.unit}
                  </>
                )}
              </div>
              {card.subtitle != null && !summaryLoading && (
                <div className="pd-metric-subtitle">{card.subtitle}</div>
              )}
              {card.clickable && (
                <span className="pd-metric-link">
                  View Details <FaChevronRight />
                </span>
              )}
            </div>
          ))}
        </div>

        <PlantationChartsPanel
          missionType={missionType}
          chartMonths={chartMonths}
          chartMonthRange={chartMonthRange}
          setChartMonthRange={setChartMonthRange}
          basePath={basePath}
          completedPlansOnly={completedPlansOnly}
        />
      </div>

      {/* Cancelled Fields Popup */}
      {activePopup === 'cancelled' && (
        <div className="pd-popup-overlay" onClick={closePopup}>
          <div className="pd-popup" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header pd-popup-header--red">
              <span className="pd-popup-title">
                <FaTimesCircle /> Cancelled Before Execution
              </span>
              <div className="pd-popup-header-actions">
                {(summary.cancelledFields || []).length > 0 && (
                  <button className="pd-popup-excel-btn" onClick={exportCancelledToExcel}>
                    <FaFileExcel /> Excel
                  </button>
                )}
                <button className="pd-popup-close" onClick={closePopup}><FaTimes /></button>
              </div>
            </div>
            <div className="pd-popup-body">
              {(summary.cancelledFields || []).length === 0 ? (
                <div className="pd-popup-empty">No cancelled fields for this month</div>
              ) : (
                <table className="pd-popup-table">
                  <thead>
                    <tr>
                      <th>Plan ID</th>
                      <th>Date</th>
                      <th>Estate</th>
                      <th>Field</th>
                      <th>Area (Ha)</th>
                      <th>Pilot</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.cancelledFields.map((f, idx) => (
                      <tr key={f.taskId || idx}>
                        <td>{f.planId}</td>
                        <td>{f.pickedDate}</td>
                        <td>{f.estateName}</td>
                        <td>{f.fieldName}</td>
                        <td style={{ textAlign: 'center' }}>{f.fieldArea.toFixed(2)}</td>
                        <td>{f.pilotName}</td>
                        <td><span className="pd-cancel-reason">{f.cancelReason}</span></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700 }}>Total Cancelled</td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {(summary.cancelledExtent || 0).toFixed(2)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Executed Extent Popup (Completed Reports) */}
      {activePopup === 'executed' && (
        <div className="pd-popup-overlay" onClick={closePopup}>
          <div className="pd-popup pd-popup--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header pd-popup-header--purple">
              <span className="pd-popup-title">
                <FaCogs /> Executed Extent - Completed Reports ({getCurrentMonthName()})
              </span>
              <button className="pd-popup-close" onClick={closePopup}><FaTimes /></button>
            </div>
            <div className="pd-popup-body">
              {reportsLoading ? (
                <div className="pd-popup-loading">
                  <Bars height={40} width={40} color="#7c3aed" />
                  <span>Loading reports...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className="pd-popup-empty">No completed mission reports for this month</div>
              ) : (
                <table className="pd-popup-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Estate</th>
                      <th>Mission Type</th>
                      <th style={{ textAlign: 'center' }}>Planned (Ha)</th>
                      <th style={{ textAlign: 'center' }}>Executed Extent (Ha)</th>
                      <th style={{ textAlign: 'center' }}>Covered Area (Ha)</th>
                      <th style={{ textAlign: 'center' }}>Completion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r, idx) => {
                      const pct = (r.actual_sprayed_fields_extent || 0) > 0
                        ? ((r.completed_area || 0) / (r.actual_sprayed_fields_extent || 0) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={idx}>
                          <td>{format(new Date(r.date), 'yyyy-MM-dd')}</td>
                          <td>{r.estate_name || `Estate ${r.estate_id}`}</td>
                          <td>{r.mission_type_name === 'spy' ? 'Spray' : r.mission_type_name === 'spd' ? 'Spread' : r.mission_type_name}</td>
                          <td style={{ textAlign: 'center' }}>{parseFloat(r.planned_extent || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'center', color: '#10b981' }}>{parseFloat(r.actual_sprayed_fields_extent || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'center' }}>{parseFloat(r.completed_area || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`plantation-completion-badge ${parseFloat(pct) >= 100 ? 'complete' : parseFloat(pct) >= 80 ? 'good' : 'low'}`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Partially Completed Fields Popup (internal dashboard only) */}
      {activePopup === 'partial' && isInternalDashboard && (
        <div className="pd-popup-overlay" onClick={closePopup}>
          <div className="pd-popup pd-popup--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header pd-popup-header--orange">
              <span className="pd-popup-title">
                <FaAdjust /> Partially Completed Fields ({getCurrentMonthName()})
              </span>
              <div className="pd-popup-header-actions">
                {(summary.partiallyCompletedFields || []).length > 0 && (
                  <button className="pd-popup-excel-btn" onClick={exportPartialToExcel}>
                    <FaFileExcel /> Excel
                  </button>
                )}
                <button className="pd-popup-close" onClick={closePopup}><FaTimes /></button>
              </div>
            </div>
            <div className="pd-popup-body">
              {(summary.partiallyCompletedFields || []).length === 0 ? (
                <div className="pd-popup-empty">No partially completed fields for this month</div>
              ) : (
                <table className="pd-popup-table">
                  <thead>
                    <tr>
                      <th>Plan ID</th>
                      <th>Date</th>
                      <th>Estate</th>
                      <th>Field</th>
                      <th style={{ textAlign: 'center' }}>Field Size (Ha)</th>
                      <th style={{ textAlign: 'center' }}>Completed (Ha)</th>
                      <th style={{ textAlign: 'center' }}>%</th>
                      <th>Pilot</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.partiallyCompletedFields.map((f, idx) => {
                      const pct = f.fieldArea > 0
                        ? ((f.completedArea / f.fieldArea) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={f.taskId || idx}>
                          <td>{f.planId}</td>
                          <td>{f.pickedDate}</td>
                          <td>{f.estateName}</td>
                          <td>{f.fieldName}</td>
                          <td style={{ textAlign: 'center' }}>{f.fieldArea.toFixed(2)}</td>
                          <td style={{ textAlign: 'center', color: '#ea580c' }}>{f.completedArea.toFixed(2)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`plantation-completion-badge ${parseFloat(pct) >= 100 ? 'complete' : parseFloat(pct) >= 50 ? 'good' : 'low'}`}>
                              {pct}%
                            </span>
                          </td>
                          <td>{f.pilotName}</td>
                          <td><span className="pd-partial-reason">{f.partialReason}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700 }}>Total Partially Completed</td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {(summary.partiallyCompletedExtent || 0).toFixed(2)}
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {(summary.partiallyCompletedFields || []).reduce((s, f) => s + f.completedArea, 0).toFixed(2)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantationDashboard;
