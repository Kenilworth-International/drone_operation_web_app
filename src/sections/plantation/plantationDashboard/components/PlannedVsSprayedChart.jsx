import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Customized,
} from 'recharts';
import createPilotReferenceLinesRenderer from './PilotReferenceLinesLayer';
import { 
  useGetTeaRevenueVsSprayedChartQuery
} from '../../../../api/services NodeJs/plantationDashboardApi';
import { getUserData } from '../../../../utils/authUtils';
import { Bars } from 'react-loader-spinner';
import { FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { plantationDashboardApi } from '../../../../api/services NodeJs/plantationDashboardApi';
import { useAppDispatch } from '../../../../store/hooks';
import { appendShellParams } from '../../../../utils/shellSearchParams';

const PlannedVsSprayedChart = ({
  missionType,
  months = 6,
  startMonth,
  endMonth,
  basePath = '/home/plantation-dashboard',
  completedPlansOnly = true,
}) => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { data, isLoading, isFetching, error } = useGetTeaRevenueVsSprayedChartQuery({
    missionType,
    months,
    startMonth,
    endMonth,
    completedPlansOnly,
  });

  // Pilot reference lines only on internal `#/home/dashboard` (and sub-routes), never on `#/home/plantation-dashboard`.
  const bp = String(basePath || '');
  const locPath = String(routerLocation.pathname || '');
  const shouldShowMinimumLine =
    bp === '/home/dashboard' ||
    bp.startsWith('/home/dashboard/') ||
    locPath === '/home/dashboard' ||
    locPath.startsWith('/home/dashboard/');

  // Reference lines: min = count×7 Ha, avg = count×15 Ha. Use API only when it sends pilotExtentMin / pilotExtentAvg
  // (do not use legacy pilotExtent as avg — production often sends pilotExtent = count×7, which would collapse both lines).
  const PILOT_MIN_HA = 7;
  const PILOT_AVG_HA = 15;
  const chartData = (data?.data || []).map((row) => {
    if (!shouldShowMinimumLine) return row;
    const executedPlanCount = parseInt(row?.executedPlanCount, 10) || 0;
    let pilotExtentMin = executedPlanCount * PILOT_MIN_HA;
    let pilotExtentAvg = executedPlanCount * PILOT_AVG_HA;
    const rawMin = parseFloat(row?.pilotExtentMin);
    const rawAvg = parseFloat(row?.pilotExtentAvg);
    if (Number.isFinite(rawMin)) pilotExtentMin = rawMin;
    if (Number.isFinite(rawAvg)) pilotExtentAvg = rawAvg;
    return { ...row, pilotExtentMin, pilotExtentAvg };
  });
  const userData = getUserData();
  const dispatch = useAppDispatch();
  const [isExporting, setIsExporting] = useState(false);

  // Determine available breakdown levels based on user hierarchy (for Excel export)
  const getAvailableBreakdownLevels = () => {
    if (userData?.estate) {
      return [];
    } else if (userData?.region) {
      return [];
    } else if (userData?.plantation) {
      return ['regions', 'estates'];
    } else if (userData?.group) {
      return ['plantations', 'regions', 'estates'];
    }
    return ['plantations', 'regions', 'estates'];
  };

  // Custom tooltip for stacked bars
  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, padding: '10px 14px', fontSize: 13, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700 }}>{d.monthName}</p>
          <p style={{ margin: '4px 0', color: '#15803d', fontWeight: 600 }}>
            Estate Approved Extent: {parseFloat(d.estateApprovedExtent || 0).toFixed(2)} Ha
          </p>
          <p style={{ margin: '4px 0', color: '#15803d' }}>
            &nbsp;&nbsp;↳ Executed Extent: {parseFloat(d.executedExtent || 0).toFixed(2)} Ha
          </p>
          <p style={{ margin: '4px 0', color: '#94a3b8', fontSize: 12 }}>
            &nbsp;&nbsp;&nbsp;&nbsp;Remaining: {parseFloat(d.approvedRemaining || 0).toFixed(2)} Ha
          </p>
          <hr style={{ margin: '6px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
          <p style={{ margin: '4px 0', fontWeight: 600 }}>
            Total Covered: {parseFloat((d.coveredSprayingExtent || 0) + (d.coveredSpreadingExtent || 0)).toFixed(2)} Ha
          </p>
          <p style={{ margin: '4px 0', color: '#c2410c' }}>
            &nbsp;&nbsp;Covered Spraying: {parseFloat(d.coveredSprayingExtent || 0).toFixed(2)} Ha
          </p>
          <p style={{ margin: '4px 0', color: '#e8923b' }}>
            &nbsp;&nbsp;Covered Spreading: {parseFloat(d.coveredSpreadingExtent || 0).toFixed(2)} Ha
          </p>
          {shouldShowMinimumLine && (
            <>
              <p style={{ margin: '6px 0 0', color: '#dc2626', fontWeight: 600 }}>
                Minimum (deployed pilot×7Ha): {parseFloat(d.pilotExtentMin || 0).toFixed(2)} Ha ({d.executedPlanCount || 0} plans)
              </p>
              <p style={{ margin: '4px 0 0', color: '#2563eb', fontWeight: 600 }}>
                Average (deployed pilot×15Ha): {parseFloat(d.pilotExtentAvg || 0).toFixed(2)} Ha
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  // Excel export function
  const handleExportToExcel = async () => {
    if (!chartData || chartData.length === 0) {
      alert('No data available to export');
      return;
    }

    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();
      const availableLevels = getAvailableBreakdownLevels();
      
      // Sheet 1: Summary (skip months where both executed and covered are 0)
      const summaryData = chartData
        .filter(item => {
          const executed = parseFloat(item.executedExtent || 0);
          const totalCovered = parseFloat((item.coveredSprayingExtent || 0) + (item.coveredSpreadingExtent || 0));
          return executed > 0 || totalCovered > 0;
        })
        .map(item => {
          const executed = parseFloat(item.executedExtent || 0);
          const totalCovered = parseFloat((item.coveredSprayingExtent || 0) + (item.coveredSpreadingExtent || 0));
          return {
            'Month': item.monthName,
            'Estate Approved Extent (Ha)': parseFloat(item.estateApprovedExtent || 0).toFixed(2),
            'Executed Extent (Ha)': executed.toFixed(2),
            'Approved Remaining (Ha)': parseFloat(item.approvedRemaining || 0).toFixed(2),
            'Covered Spraying Extent (Ha)': parseFloat(item.coveredSprayingExtent || 0).toFixed(2),
            'Covered Spreading Extent (Ha)': parseFloat(item.coveredSpreadingExtent || 0).toFixed(2),
            'Total Covered (Ha)': totalCovered.toFixed(2),
            'Completion Rate (%)': executed > 0
              ? ((totalCovered / executed) * 100).toFixed(2)
              : '0.00',
          };
        });

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      // Helper function to fetch and create breakdown sheet
      const createBreakdownSheet = async (level, levelName, nameField) => {
        const allBreakdownData = [];
        
        for (const monthData of chartData) {
          try {
            const breakdownResult = await dispatch(
              plantationDashboardApi.endpoints.getChartBreakdown.initiate({
                chartType: 'tea-revenue-vs-sprayed',
                missionType,
                yearMonth: monthData.month,
                breakdownLevel: level,
                completedPlansOnly,
              })
            ).unwrap();
            
            const breakdown = breakdownResult?.data || [];
            
            breakdown.forEach(item => {
              const actualSprayed = parseFloat(item.actual_sprayed_fields_extent || 0);
              const coveredDJI = parseFloat(item.total_sprayed || 0);
              // Skip rows where both executed and covered are 0
              if (actualSprayed <= 0 && coveredDJI <= 0) return;
              const completionPct = actualSprayed > 0
                ? ((coveredDJI / actualSprayed) * 100).toFixed(2)
                : '0.00';
              allBreakdownData.push({
                'Month': monthData.monthName,
                [levelName]: item[nameField] || 'N/A',
                'Executed Extent (Ha)': actualSprayed.toFixed(2),
                'Covered Area (Ha)': coveredDJI.toFixed(2),
                'Completion Rate (%)': completionPct,
              });
            });
          } catch (err) {
            console.error(`Error fetching ${levelName} breakdown for ${monthData.monthName}:`, err);
          }
        }

        if (allBreakdownData.length > 0) {
          const breakdownWorksheet = XLSX.utils.json_to_sheet(allBreakdownData);
          XLSX.utils.book_append_sheet(workbook, breakdownWorksheet, levelName);
        }
      };

      const userLevel = userData?.estate ? 'estate' :
                       userData?.region ? 'region' :
                       userData?.plantation ? 'plantation' :
                       userData?.group ? 'group' : 'unknown';
      
      if (userLevel === 'group') {
        await createBreakdownSheet('plantations', 'Plantations', 'plantation_name');
        await createBreakdownSheet('regions', 'Regions', 'region_name');
        await createBreakdownSheet('estates', 'Estates', 'estate_name');
      } else if (userLevel === 'plantation') {
        await createBreakdownSheet('regions', 'Regions', 'region_name');
        await createBreakdownSheet('estates', 'Estates', 'estate_name');
      } else if (userLevel === 'region' || userLevel === 'estate') {
        await createBreakdownSheet('estates', 'Estates', 'estate_name');
      } else {
        if (availableLevels.includes('plantations')) await createBreakdownSheet('plantations', 'Plantations', 'plantation_name');
        if (availableLevels.includes('regions')) await createBreakdownSheet('regions', 'Regions', 'region_name');
        if (availableLevels.includes('estates')) await createBreakdownSheet('estates', 'Estates', 'estate_name');
      }

      const missionTypeText = missionType === 'spy' ? 'Spray' : 'Spread';
      const filename = `Planned_vs_Executed_${missionTypeText}_${startMonth}_to_${endMonth}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="plantation-chart-card">
        <h3 className="plantation-chart-title">Planned vs Executed (Ha)</h3>
        <div className="plantation-chart-loading plantation-chart-loading--initial" aria-busy="true">
          <div className="plantation-chart-loading-shimmer" aria-hidden />
          <div className="plantation-chart-loading-inner">
            <Bars height="40" width="40" color="#3b82f6" />
            <span>Loading chart data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plantation-chart-card">
        <h3 className="plantation-chart-title">Planned vs Executed (Ha)</h3>
        <div className="plantation-chart-error">
          Error loading chart data. Please try again.
        </div>
      </div>
    );
  }

  const chartMargin = basePath.includes('plantation-dashboard')
    ? { top: 20, right: 56, left: 24, bottom: 24 }
    : { top: 20, right: 30, left: 20, bottom: 20 };

  return (
    <div className="plantation-chart-card">
      <div className="plantation-chart-title-wrapper">
        <h3 className="plantation-chart-title">Planned vs Executed (Ha)</h3>
        <button
          className="plantation-chart-excel-btn"
          onClick={handleExportToExcel}
          disabled={isExporting || !chartData || chartData.length === 0}
          title="Export to Excel"
        >
          <FaFileExcel />
          {isExporting ? 'Exporting...' : ''}
        </button>
      </div>
      <div className="plantation-chart-container plantation-chart-container--loadable">
        {isFetching && (
          <div className="plantation-chart-loading-overlay" aria-busy="true" aria-live="polite">
            <Bars height="36" width="36" color="#3b82f6" />
            <span>Updating chart...</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
            data={chartData}
            margin={chartMargin}
            onClick={(data) => {
              if (data && data.activePayload && data.activePayload.length > 0) {
                const clickedBar = data.activePayload[0];
                const clickedData = clickedBar.payload;

                const shell = new URLSearchParams();
                appendShellParams(shell, routerLocation.search);
                const shellQs = shell.toString();
                navigate(
                  {
                    pathname: `${basePath}/chart-breakdown`,
                    ...(shellQs ? { search: `?${shellQs}` } : {}),
                  },
                  {
                    state: {
                      chartType: 'tea-revenue-vs-sprayed',
                      missionType,
                      month: clickedData.month,
                      monthName: clickedData.monthName,
                      chartData: clickedData,
                      expandedMetric: 'planned',
                    },
                  }
                );
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="monthName" 
              stroke="#64748b"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#64748b"
              style={{ fontSize: '12px' }}
              label={{ value: 'Hectares (Ha)', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
            />
            <Tooltip content={<CustomChartTooltip />} />
            <Legend
              content={({ payload }) => (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', justifyContent: 'center', padding: '8px 0', fontSize: 13 }}>
                  {payload && payload.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: entry.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: '#555' }}>{entry.value}</span>
                    </div>
                  ))}
                  {shouldShowMinimumLine && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, height: 3, borderRadius: 1, backgroundColor: '#dc2626', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: '#555' }}>Minimum (deployed pilot×7Ha)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, height: 3, borderRadius: 1, backgroundColor: '#2563eb', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: '#555' }}>Average (deployed pilot×15Ha)</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            />
            {/* Stacked Bar 1: Executed (bottom, dark green) + Remaining Approved (top, light green) */}
            <Bar 
              dataKey="executedExtent" 
              name="Executed Extent" 
              fill="#15803d"
              stackId="approved"
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-exec-${index}`} fill="#15803d" />
              ))}
            </Bar>
            <Bar 
              dataKey="approvedRemaining" 
              name="Estate Approved Extent" 
              fill="#bbf7d0"
              stackId="approved"
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-approved-${index}`} fill="#bbf7d0" />
              ))}
            </Bar>
            {/* Stacked Bar 2: Covered Spraying (bottom, dark orange) + Covered Spreading (top, light orange) */}
            <Bar 
              dataKey="coveredSprayingExtent" 
              name="Covered Spraying Extent" 
              fill="#c2410c"
              stackId="covered"
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-cov-spray-${index}`} fill="#c2410c" />
              ))}
            </Bar>
            <Bar 
              dataKey="coveredSpreadingExtent" 
              name="Covered Spreading Extent" 
              fill="#fdba74"
              stackId="covered"
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-cov-spread-${index}`} fill="#fdba74" />
              ))}
            </Bar>
            {shouldShowMinimumLine && (
              <Customized
                component={createPilotReferenceLinesRenderer({
                  chartData,
                  minKey: 'pilotExtentMin',
                  maxKey: 'pilotExtentAvg',
                })}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="plantation-chart-footer">
        <p className="plantation-chart-description">
          Estate Approved Extent vs Executed, with Covered Spraying and Spreading extents shown separately.
          <br />
          <span style={{ fontSize: '12px', color: '#666' }}>Click on any bar to view detailed breakdown.</span>
        </p>
      </div>
    </div>
  );
};

export default PlannedVsSprayedChart;
