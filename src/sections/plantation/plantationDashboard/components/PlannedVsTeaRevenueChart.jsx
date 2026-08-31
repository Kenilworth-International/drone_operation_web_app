import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  useGetPlannedVsTeaRevenueChartQuery
} from '../../../../api/services NodeJs/plantationDashboardApi';
import { getUserData } from '../../../../utils/authUtils';
import { Bars } from 'react-loader-spinner';
import { FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { plantationDashboardApi } from '../../../../api/services NodeJs/plantationDashboardApi';
import { useAppDispatch } from '../../../../store/hooks';
import { appendShellParams } from '../../../../utils/shellSearchParams';

const PlannedVsTeaRevenueChart = ({
  missionType,
  months = 6,
  startMonth,
  endMonth,
  basePath = '/home/plantation-dashboard',
  completedPlansOnly = true,
}) => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { data, isLoading, isFetching, error } = useGetPlannedVsTeaRevenueChartQuery({
    missionType,
    months,
    startMonth,
    endMonth
  });

  const chartData = data?.data || [];
  const userData = getUserData();
  const dispatch = useAppDispatch();
  const [isExporting, setIsExporting] = useState(false);


  // Determine available breakdown levels based on user hierarchy
  const getAvailableBreakdownLevels = () => {
    if (userData?.estate) {
      return []; // Estate-level users can't breakdown further
    } else if (userData?.region) {
      return []; // Region-level users can only see estates (default)
    } else if (userData?.plantation) {
      return ['regions', 'estates'];
    } else if (userData?.group) {
      return ['plantations', 'regions', 'estates'];
    }
    return ['plantations', 'regions', 'estates'];
  };

  // Get default breakdown level based on user hierarchy
  const getDefaultBreakdownLevel = () => {
    if (userData?.estate || userData?.region) {
      return 'estates';
    } else if (userData?.plantation) {
      return 'regions';
    } else if (userData?.group) {
      return 'plantations';
    }
    return 'plantations';
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
      
      // Sheet 1: Summary (Monthly Aggregated Data - matches chart bars)
      const summaryData = chartData.map(item => {
        const teaRev = parseFloat(item.teaRevenueExtent || 0);
        const sprayExt = parseFloat(item.plannedSprayingExtent || 0);
        const spreadExt = parseFloat(item.plannedSpreadingExtent || 0);
        return {
          'Month': item.monthName,
          'Tea Revenue Extent (Ha)': teaRev.toFixed(2),
          'Spray Plan Count': item.sprayPlanCount || 0,
          'Planned Spraying Extent (Ha)': sprayExt.toFixed(2),
          'Spraying vs Tea Revenue (%)': teaRev > 0
            ? ((sprayExt / teaRev) * 100).toFixed(2)
            : '0.00',
          'Spread Plan Count': item.spreadPlanCount || 0,
          'Planned Spreading Extent (Ha)': spreadExt.toFixed(2),
          'Spreading vs Tea Revenue (%)': teaRev > 0
            ? ((spreadExt / teaRev) * 100).toFixed(2)
            : '0.00',
          'Total Planned (Spray+Spread) (Ha)': (sprayExt + spreadExt).toFixed(2),
          'Total vs Tea Revenue (%)': teaRev > 0
            ? (((sprayExt + spreadExt) / teaRev) * 100).toFixed(2)
            : '0.00',
        };
      });

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      // Helper function to fetch and create breakdown sheet
      const createBreakdownSheet = async (level, levelName, nameField) => {
        const allBreakdownData = [];
        
        console.log(`Creating ${levelName} sheet with breakdown level: ${level}`);
        
        for (const monthData of chartData) {
          try {
            console.log(`Fetching ${levelName} breakdown for ${monthData.monthName} (${monthData.month})`);
            console.log(`Request params:`, { chartType: 'planned-vs-tea-revenue', missionType, yearMonth: monthData.month, breakdownLevel: level });
            
            const breakdownResult = await dispatch(
              plantationDashboardApi.endpoints.getChartBreakdown.initiate({
                chartType: 'planned-vs-tea-revenue',
                missionType,
                yearMonth: monthData.month,
                breakdownLevel: level,
                completedPlansOnly,
              })
            ).unwrap();
            
            console.log(`Full API Response for ${monthData.monthName}:`, breakdownResult);
            const breakdown = breakdownResult?.data || [];
            console.log(`Fetched ${breakdown.length} ${levelName} records for ${monthData.monthName}`, breakdown);
            
            if (breakdown.length === 0) {
              console.warn(`No breakdown data returned for ${levelName} in ${monthData.monthName}. Response:`, breakdownResult);
            }
            
            breakdown.forEach(item => {
              const planningPercent = item.tea_revenue_extent > 0
                ? ((item.total_planned / item.tea_revenue_extent) * 100).toFixed(2)
                : '0.00';
              
              allBreakdownData.push({
                'Month': monthData.monthName,
                [levelName]: item[nameField] || 'N/A',
                'Tea Revenue Extent (Ha)': parseFloat(item.tea_revenue_extent || 0).toFixed(2),
                'Planned Extent (Ha)': parseFloat(item.total_planned || 0).toFixed(2),
                'Planning Percentage (%)': planningPercent
              });
            });
          } catch (error) {
            console.error(`Error fetching ${levelName} breakdown for ${monthData.monthName}:`, error);
          }
        }

        if (allBreakdownData.length > 0) {
          const breakdownWorksheet = XLSX.utils.json_to_sheet(allBreakdownData);
          XLSX.utils.book_append_sheet(workbook, breakdownWorksheet, levelName);
          console.log(`Created ${levelName} sheet with ${allBreakdownData.length} rows`);
        } else {
          console.warn(`No data found for ${levelName} sheet`);
        }
      };

      // Create sheets for each breakdown level based on user hierarchy
      // Order: Plantations -> Regions -> Estates
      console.log('User hierarchy:', { group: userData?.group, plantation: userData?.plantation, region: userData?.region, estate: userData?.estate });
      console.log('Available levels:', availableLevels);
      
      // Determine user level based on the highest level they have access to
      // Group level: has group but no plantation/region/estate
      // Plantation level: has plantation but no region/estate  
      // Region level: has region but no estate
      // Estate level: has estate
      
      const userLevel = userData?.estate ? 'estate' :
                       userData?.region ? 'region' :
                       userData?.plantation ? 'plantation' :
                       userData?.group ? 'group' : 'unknown';
      
      console.log('User level determined:', userLevel);
      
      // Create sheets based on user level
      if (userLevel === 'group') {
        console.log('Creating all breakdown sheets for group user');
        await createBreakdownSheet('plantations', 'Plantations', 'plantation_name');
        await createBreakdownSheet('regions', 'Regions', 'region_name');
        await createBreakdownSheet('estates', 'Estates', 'estate_name');
      } else if (userLevel === 'plantation') {
        console.log('Creating regions and estates sheets for plantation user');
        await createBreakdownSheet('regions', 'Regions', 'region_name');
        await createBreakdownSheet('estates', 'Estates', 'estate_name');
      } else if (userLevel === 'region' || userLevel === 'estate') {
        console.log('Creating estates sheet for region/estate user');
        await createBreakdownSheet('estates', 'Estates', 'estate_name');
      } else {
        // Fallback: use availableLevels
        console.log('Using availableLevels fallback');
        if (availableLevels.includes('plantations')) {
          await createBreakdownSheet('plantations', 'Plantations', 'plantation_name');
        }
        if (availableLevels.includes('regions')) {
          await createBreakdownSheet('regions', 'Regions', 'region_name');
        }
        if (availableLevels.includes('estates')) {
          await createBreakdownSheet('estates', 'Estates', 'estate_name');
        }
      }

      // Generate filename
      const missionTypeText = missionType === 'spy' ? 'Spray' : 'Spread';
      const filename = `Planned_vs_Tea_Revenue_${missionTypeText}_${startMonth}_to_${endMonth}.xlsx`;

      // Write file
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
        <h3 className="plantation-chart-title">Planned vs Tea Revenue Extent (Ha)</h3>
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
        <h3 className="plantation-chart-title">Planned vs Tea Revenue Extent (Ha)</h3>
        <div className="plantation-chart-error">
          Error loading chart data. Please try again.
        </div>
      </div>
    );
  }

  // Custom tooltip showing plan counts for spray/spread bars
  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, padding: '10px 14px', fontSize: 13 }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{data.monthName}</p>
          {payload.map((entry, i) => {
            let extra = '';
            if (entry.dataKey === 'plannedSprayingExtent' && data.sprayPlanCount != null) {
              extra = ` (${data.sprayPlanCount} plans × 15 Ha)`;
            } else if (entry.dataKey === 'plannedSpreadingExtent' && data.spreadPlanCount != null) {
              extra = ` (${data.spreadPlanCount} plans × 15 Ha)`;
            }
            return (
              <p key={i} style={{ margin: '3px 0', color: entry.color }}>
                {entry.name}: {parseFloat(entry.value).toFixed(2)} Ha{extra}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const chartMargin = basePath.includes('plantation-dashboard')
    ? { top: 20, right: 56, left: 24, bottom: 24 }
    : { top: 20, right: 30, left: 20, bottom: 20 };

  return (
    <div className="plantation-chart-card">
      <div className="plantation-chart-title-wrapper">
        <h3 className="plantation-chart-title">Tea Revenue Extent vs Planned (Ha)</h3>
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
          <BarChart 
            data={chartData} 
            margin={chartMargin}
            onClick={(data) => {
              if (data && data.activePayload && data.activePayload.length > 0) {
                const clickedBar = data.activePayload[0];
                const clickedData = clickedBar.payload;
                const clickedMetric = clickedBar.dataKey;
                
                // Navigate to breakdown page with chart data
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
                      chartType: 'planned-vs-tea-revenue',
                      missionType,
                      month: clickedData.month,
                      monthName: clickedData.monthName,
                      chartData: clickedData,
                      expandedMetric:
                        clickedMetric === 'teaRevenueExtent'
                          ? 'teaRevenue'
                          : clickedMetric === 'plannedExtent'
                            ? 'planned'
                            : null,
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
            <Legend />
            <Bar 
              dataKey="teaRevenueExtent" 
              name="Tea Revenue Extent" 
              fill="#3b82f6"
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-tea-${index}`} fill="#3b82f6" />
              ))}
            </Bar>
            <Bar 
              dataKey="plannedSprayingExtent" 
              name="Planned Spraying Extent" 
              fill="#8b5cf6"
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-spray-${index}`} fill="#8b5cf6" />
              ))}
            </Bar>
            <Bar 
              dataKey="plannedSpreadingExtent" 
              name="Planned Spreading Extent" 
              fill="#06b6d4"
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-spread-${index}`} fill="#06b6d4" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="plantation-chart-footer">
        <p className="plantation-chart-description">
          Tea Revenue Extent (total available area) vs Planned Spraying and Spreading Extent (plan count × 15 Ha estimated).
          <br />
          <span style={{ fontSize: '12px', color: '#666' }}>Click on any bar to view detailed breakdown.</span>
        </p>
      </div>
    </div>
  );
};

export default PlannedVsTeaRevenueChart;
