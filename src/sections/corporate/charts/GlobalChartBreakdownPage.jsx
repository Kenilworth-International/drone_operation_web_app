import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaArrowLeft,
  FaFileExcel,
  FaChevronDown,
  FaChevronRight,
  FaMapMarkedAlt,
  FaLeaf,
  FaCalendarAlt,
  FaHashtag,
  FaTimes,
  FaTimesCircle,
  FaSearchPlus,
  FaSearchMinus,
  FaExpand,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import {
  useGetGlobalEstatePlanBreakdownQuery,
  useGetPlantationsListQuery,
  useGetEstatesListQuery,
} from '../../../api/services NodeJs/plantationDashboardApi';
import { Bars } from 'react-loader-spinner';
import '../../../styles/plantationDashboard.css';

const GlobalChartBreakdownPage = ({ basePath = '/home/dataViewer' } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    chartType: stateChartType,
    missionType: stateMissionType,
    month: stateMonth,
    monthName: stateMonthName,
    chartData: selectedChartData,
    startMonth: stateStartMonth,
    endMonth: stateEndMonth,
    plantationId: statePlantationId,
    regionId: stateRegionId,
    estateId: stateEstateId,
  } = location.state || {};

  const chartType = stateChartType || 'planned-vs-tea-revenue';
  const missionType = stateMissionType || 'spy';
  const month = stateMonth;
  const monthName = stateMonthName || (month ? new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '');

  const isTeaRevenueChart = chartType === 'planned-vs-tea-revenue';

  const [expandedPlans, setExpandedPlans] = useState({});
  const [expandedFields, setExpandedFields] = useState({});
  const [mapPopup, setMapPopup] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPlantation, setSelectedPlantation] = useState(statePlantationId ? String(statePlantationId) : '');
  const [selectedRegion, setSelectedRegion] = useState(stateRegionId ? String(stateRegionId) : '');
  const [selectedEstate, setSelectedEstate] = useState(stateEstateId ? String(stateEstateId) : '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const openMapPopup = (url, fieldName) => setMapPopup({ url, fieldName });
  const closeMapPopup = useCallback(() => setMapPopup(null), []);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') closeMapPopup(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [closeMapPopup]);

  const { data: plantationsData } = useGetPlantationsListQuery();
  const { data: estatesData } = useGetEstatesListQuery(selectedPlantation || undefined);
  const plantations = useMemo(() => plantationsData?.data || [], [plantationsData]);
  const estates = useMemo(() => estatesData?.data || [], [estatesData]);
  const regions = useMemo(() => {
    const regionMap = new Map();
    estates.forEach((estate) => {
      const regionId = estate.region;
      if (!regionId) return;
      if (!regionMap.has(String(regionId))) {
        regionMap.set(String(regionId), {
          id: String(regionId),
          name: estate.region_name || `Region ${regionId}`,
        });
      }
    });
    return Array.from(regionMap.values());
  }, [estates]);
  const filteredEstates = useMemo(() => {
    if (!selectedRegion) return estates;
    return estates.filter((estate) => String(estate.region) === String(selectedRegion));
  }, [estates, selectedRegion]);

  const {
    data: estatePlanData,
    isLoading: estatePlanLoading,
  } = useGetGlobalEstatePlanBreakdownQuery(
    {
      yearMonth: month,
      missionType: missionType || 'spy',
      chartType: chartType || 'planned-vs-tea-revenue',
      plantationId: selectedPlantation || undefined,
      regionId: selectedRegion || undefined,
      estateId: selectedEstate || undefined,
    },
    { skip: !month }
  );

  const allPlans = useMemo(() => {
    const data = estatePlanData?.data || [];
    return [...data].sort((a, b) => {
      if (!isTeaRevenueChart) {
        const aHasSprayed = parseFloat(a.total_sprayed || 0) > 0;
        const bHasSprayed = parseFloat(b.total_sprayed || 0) > 0;
        if (aHasSprayed && !bHasSprayed) return -1;
        if (!aHasSprayed && bHasSprayed) return 1;
      }
      const dateCompare = (a.picked_date || '').localeCompare(b.picked_date || '');
      if (dateCompare !== 0) return dateCompare;
      const estateCompare = (a.estate_name || '').localeCompare(b.estate_name || '');
      if (estateCompare !== 0) return estateCompare;
      return (a.plan_id || 0) - (b.plan_id || 0);
    });
  }, [estatePlanData, isTeaRevenueChart]);

  const plans = useMemo(() => {
    return allPlans.filter((plan) => {
      const planDate = String(plan.picked_date || '');
      if (dateFrom && planDate < dateFrom) return false;
      if (dateTo && planDate > dateTo) return false;
      return true;
    });
  }, [allPlans, dateFrom, dateTo]);

  const summaryData = useMemo(() => {
    if (selectedChartData) {
      return {
        teaRevenueExtent: selectedChartData.teaRevenueExtent ?? 0,
        estateApprovedExtent: selectedChartData.estateApprovedExtent ?? selectedChartData.plannedExtent ?? 0,
        executedExtent: selectedChartData.executedExtent ?? selectedChartData.actualSprayedFieldsExtent ?? 0,
        coveredSprayingExtent: selectedChartData.coveredSprayingExtent ?? selectedChartData.sprayedExtent ?? 0,
        coveredSpreadingExtent: selectedChartData.coveredSpreadingExtent ?? 0,
        sprayPlanCount: selectedChartData.sprayPlanCount,
        spreadPlanCount: selectedChartData.spreadPlanCount,
      };
    }

    const estateApprovedExtent = plans.reduce((sum, plan) => sum + parseFloat(plan.total_planned || 0), 0);
    const executedExtent = plans.reduce(
      (sum, plan) => sum + parseFloat(plan.actual_sprayed_fields_extent || 0),
      0
    );
    const covered = plans.reduce((sum, plan) => sum + parseFloat(plan.total_sprayed || 0), 0);
    return {
      teaRevenueExtent: 0,
      estateApprovedExtent,
      executedExtent,
      coveredSprayingExtent: covered,
      coveredSpreadingExtent: 0,
      sprayPlanCount: missionType === 'spy' ? plans.length : 0,
      spreadPlanCount: missionType === 'spd' ? plans.length : 0,
    };
  }, [selectedChartData, plans, missionType]);

  const getSortedFields = useCallback((fields) => {
    if (!fields || fields.length === 0) return [];
    return [...fields].sort((a, b) => {
      const aHas = parseFloat(a.total_sprayed || 0) > 0;
      const bHas = parseFloat(b.total_sprayed || 0) > 0;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return (a.field_name || '').localeCompare(b.field_name || '');
    });
  }, []);

  const togglePlan = (planId) => setExpandedPlans((prev) => ({ ...prev, [planId]: !prev[planId] }));
  const toggleField = (planId, fieldId) => {
    const key = `${planId}-${fieldId}`;
    setExpandedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatMonthLabel = (ym) => {
    if (!ym) return '';
    const d = new Date(`${ym}-01T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  const dateRangeLabel = stateStartMonth && stateEndMonth
    ? `${formatMonthLabel(stateStartMonth)} to ${formatMonthLabel(stateEndMonth)}`
    : (monthName || month || 'N/A');

  const handleExportToExcel = () => {
    if (!month) { alert('No month selected'); return; }
    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();
      const reportDate = month ? `${month}-01` : '';

      if (isTeaRevenueChart) {
        const detailRows = plans.map((plan) => ({
          Date: plan.picked_date || reportDate,
          Estate: plan.estate_name || '',
          'Plan ID': plan.plan_id,
        }));
        if (detailRows.length > 0) {
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), 'Plans');
        }
      } else {
        const detailRows = [];
        plans.forEach((plan) => {
          (plan.fields || []).forEach((f) => {
            const planned = parseFloat(f.planned_area || 0);
            const sprayed = parseFloat(f.total_sprayed || 0);
            detailRows.push({
              Date: plan.picked_date || reportDate,
              'Plan ID': plan.plan_id,
              Estate: plan.estate_name || '',
              Field: f.field_name || '',
              'Planned (Ha)': planned.toFixed(2),
              'Covered Area (Ha)': sprayed.toFixed(2),
              'Completion (%)': planned > 0 ? ((sprayed / planned) * 100).toFixed(2) : '0.00',
              Status: f.is_cancelled ? 'Cancelled' : 'Active',
            });
          });
        });
        if (detailRows.length > 0) {
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), 'Fields');
        }
      }

      const missionLabel = (missionType || 'spy') === 'spy' ? 'Spray' : 'Spread';
      XLSX.writeFile(workbook, `Global_Chart_Details_${missionLabel}_${monthName || month}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!selectedChartData && !month) {
    return (
      <div className="container-class-breakdown">
        <div className="header-class-breakdown header-class-breakdown--dataviewer">
          <button type="button" className="back-btn-class-breakdown" aria-label="Back" onClick={() => navigate(basePath)}>
            <FaArrowLeft aria-hidden="true" />
            <span className="back-btn-label-class-breakdown">Back</span>
          </button>
          <h1 className="title-class-breakdown">Chart Breakdown</h1>
        </div>
        <div className="content-class-breakdown">
          <p>No data available. Please select a chart bar to view details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-class-breakdown">
      <div className="header-class-breakdown header-class-breakdown--dataviewer">
        <button type="button" className="back-btn-class-breakdown" aria-label="Back" onClick={() => navigate(basePath)}>
          <FaArrowLeft aria-hidden="true" />
          <span className="back-btn-label-class-breakdown">Back to Infographics</span>
        </button>
        <h1 className="title-class-breakdown">
          Chart Details — All Data — {monthName || month}
        </h1>
      </div>

      <div className="content-class-breakdown">
        <div className="card-class-breakdown">
          <div className="card-header-class-breakdown">
            <h3 className="card-title-class-breakdown">Active Filters</h3>
          </div>
          <div className="card-body-class-breakdown">
            <div style={{ marginBottom: 12, fontWeight: 600 }}>
              Date Range: {dateRangeLabel}
            </div>
            <div className="global-charts-filters-dataviewer">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="global-filter-select-dataviewer"
                title="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="global-filter-select-dataviewer"
                title="To date"
              />
              <select
                value={selectedPlantation}
                onChange={(e) => {
                  setSelectedPlantation(e.target.value);
                  setSelectedRegion('');
                  setSelectedEstate('');
                }}
                className="global-filter-select-dataviewer"
              >
                <option value="">All Plantations</option>
                {plantations.map((p) => (
                  <option key={p.id} value={p.id}>{p.plantation}</option>
                ))}
              </select>
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedEstate('');
                }}
                className="global-filter-select-dataviewer"
              >
                <option value="">All Regions</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <select
                value={selectedEstate}
                onChange={(e) => setSelectedEstate(e.target.value)}
                className="global-filter-select-dataviewer"
              >
                <option value="">All Estates</option>
                {filteredEstates.map((e) => (
                  <option key={e.id} value={e.id}>{e.estate}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="card-class-breakdown">
          <div className="card-header-class-breakdown">
            <h3 className="card-title-class-breakdown" data-testid="breakdown-summary-title">Summary for {monthName || month}</h3>
            <button
              type="button"
              className="plantation-chart-excel-btn"
              onClick={handleExportToExcel}
              disabled={isExporting}
              title="Export to Excel"
            >
              {isExporting ? <Bars height={18} width={18} color="#fff" /> : <FaFileExcel />}
              <span>{isExporting ? 'Exporting...' : 'Excel'}</span>
            </button>
          </div>
          <div className="card-body-class-breakdown">
            <div className="metrics-grid-class-breakdown">
              {summaryData?.teaRevenueExtent !== undefined && (
                <div className="metric-card-class-breakdown">
                  <div className="metric-label-class-breakdown">Tea Revenue Extent</div>
                  <div className="metric-value-class-breakdown metric-info-class-breakdown">
                    {parseFloat(summaryData.teaRevenueExtent || 0).toFixed(2)} Ha
                  </div>
                </div>
              )}
              {summaryData?.estateApprovedExtent !== undefined && (
                <div className="metric-card-class-breakdown">
                  <div className="metric-label-class-breakdown">Estate Approved Extent</div>
                  <div className="metric-value-class-breakdown metric-primary-class-breakdown">
                    {parseFloat(summaryData.estateApprovedExtent || 0).toFixed(2)} Ha
                  </div>
                </div>
              )}
              {summaryData?.executedExtent !== undefined && (
                <div className="metric-card-class-breakdown">
                  <div className="metric-label-class-breakdown">Executed Extent</div>
                  <div className="metric-value-class-breakdown metric-success-class-breakdown">
                    {parseFloat(summaryData.executedExtent || 0).toFixed(2)} Ha
                  </div>
                </div>
              )}
              {summaryData?.coveredSprayingExtent !== undefined && (
                <div className="metric-card-class-breakdown">
                  <div className="metric-label-class-breakdown">Covered Spraying</div>
                  <div className="metric-value-class-breakdown metric-info-class-breakdown">
                    {parseFloat(summaryData.coveredSprayingExtent || 0).toFixed(2)} Ha
                  </div>
                </div>
              )}
              {summaryData?.coveredSpreadingExtent !== undefined && parseFloat(summaryData.coveredSpreadingExtent || 0) >= 0 && (
                <div className="metric-card-class-breakdown">
                  <div className="metric-label-class-breakdown">Covered Spreading</div>
                  <div className="metric-value-class-breakdown metric-secondary-class-breakdown">
                    {parseFloat(summaryData.coveredSpreadingExtent || 0).toFixed(2)} Ha
                  </div>
                </div>
              )}
              {summaryData?.sprayPlanCount !== undefined && (
                <div className="metric-card-class-breakdown">
                  <div className="metric-label-class-breakdown">Spray Plans</div>
                  <div className="metric-value-class-breakdown metric-primary-class-breakdown">
                    {summaryData.sprayPlanCount} ({(summaryData.sprayPlanCount * 15).toFixed(0)} Ha)
                  </div>
                </div>
              )}
              {summaryData?.spreadPlanCount !== undefined && (
                <div className="metric-card-class-breakdown">
                  <div className="metric-label-class-breakdown">Spread Plans</div>
                  <div className="metric-value-class-breakdown metric-secondary-class-breakdown">
                    {summaryData.spreadPlanCount} ({(summaryData.spreadPlanCount * 15).toFixed(0)} Ha)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Estate Plans Accordion */}
        <div className="card-class-breakdown">
          <div className="card-header-class-breakdown">
            <h3 className="card-title-class-breakdown" data-testid="breakdown-plans-title">All Estate Plans — {monthName || month}</h3>
            <span className="cbd-plan-count-badge">
              {plans.length} {plans.length === 1 ? 'Plan' : 'Plans'}
            </span>
          </div>
          <div className="card-body-class-breakdown" style={{ padding: 0 }}>
            {estatePlanLoading ? (
              <div className="cbd-accordion-loading">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="cbd-skeleton-row"><div className="cbd-skeleton-bar" /></div>
                ))}
              </div>
            ) : plans.length > 0 ? (
              <div className="cbd-accordion">
                {plans.map((plan) => {
                  const isPlanExpanded = !!expandedPlans[plan.plan_id];
                  const completionRate = plan.actual_sprayed_fields_extent > 0
                    ? ((plan.total_sprayed / plan.actual_sprayed_fields_extent) * 100).toFixed(1)
                    : '0.0';

                  return (
                    <div key={plan.plan_id} className={`cbd-plan-item ${isPlanExpanded ? 'cbd-plan-item--expanded' : ''}`}>
                      <div
                        className="cbd-plan-header"
                        onClick={() => !isTeaRevenueChart && togglePlan(plan.plan_id)}
                        style={isTeaRevenueChart ? { cursor: 'default' } : {}}
                      >
                        {!isTeaRevenueChart && (
                          <div className="cbd-plan-chevron">
                            {isPlanExpanded ? <FaChevronDown /> : <FaChevronRight />}
                          </div>
                        )}
                        <div className="cbd-plan-info">
                          <span className="cbd-plan-estate">
                            <FaLeaf className="cbd-plan-icon" /> {plan.estate_name}
                          </span>
                          <span className="cbd-plan-meta">
                            <span className="cbd-plan-date"><FaCalendarAlt className="cbd-plan-meta-icon" /> {formatDate(plan.picked_date)}</span>
                            <span className="cbd-plan-id"><FaHashtag className="cbd-plan-meta-icon" /> Plan {plan.plan_id}</span>
                          </span>
                        </div>
                        {!isTeaRevenueChart && (
                          <div className="cbd-plan-summary">
                            <span className="cbd-plan-summary-item cbd-planned">{plan.total_planned.toFixed(2)} Ha</span>
                            <span className="cbd-plan-summary-item cbd-sprayed">{plan.total_sprayed.toFixed(2)} Ha</span>
                            <span className={`cbd-plan-summary-item cbd-rate ${parseFloat(completionRate) >= 90 ? 'cbd-rate--good' : parseFloat(completionRate) >= 50 ? 'cbd-rate--mid' : 'cbd-rate--low'}`}>
                              {completionRate}%
                            </span>
                          </div>
                        )}
                      </div>

                      {!isTeaRevenueChart && isPlanExpanded && (
                        <div className="cbd-fields-container">
                          {plan.fields && plan.fields.length > 0 ? (
                            getSortedFields(plan.fields).map((field) => {
                              const fieldKey = `${plan.plan_id}-${field.field_id}`;
                              const isFieldExpanded = !!expandedFields[fieldKey];
                              const fieldCompletion = field.planned_area > 0
                                ? ((field.total_sprayed / field.planned_area) * 100).toFixed(1)
                                : '0.0';

                              return (
                                <div key={fieldKey} className={`cbd-field-item ${isFieldExpanded ? 'cbd-field-item--expanded' : ''} ${field.is_cancelled ? 'cbd-field-item--cancelled' : ''}`}>
                                  <div
                                    className={`cbd-field-header ${field.is_cancelled ? 'cbd-field-header--cancelled' : ''}`}
                                    onClick={() => toggleField(plan.plan_id, field.field_id)}
                                  >
                                    <div className="cbd-field-chevron">
                                      {isFieldExpanded ? <FaChevronDown /> : <FaChevronRight />}
                                    </div>
                                    <span className={`cbd-field-name ${field.is_cancelled ? 'cbd-field-name--cancelled' : ''}`}>
                                      {field.field_name}
                                      {field.is_cancelled && <span className="cbd-cancelled-badge">Cancelled</span>}
                                    </span>
                                    <span className="cbd-field-area">{parseFloat(field.field_area || 0).toFixed(2)} Ha</span>
                                  </div>

                                  {isFieldExpanded && (
                                    <div className="cbd-field-details">
                                      <div className="cbd-field-metrics">
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">Field Area</span>
                                          <span className="cbd-field-metric-value cbd-metric-primary">{parseFloat(field.field_area || 0).toFixed(2)} Ha</span>
                                        </div>
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">Planned</span>
                                          <span className="cbd-field-metric-value cbd-metric-info">{parseFloat(field.planned_area || 0).toFixed(2)} Ha</span>
                                        </div>
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">Covered Area</span>
                                          <span className="cbd-field-metric-value cbd-metric-success">{parseFloat(field.total_sprayed || 0).toFixed(2)} Ha</span>
                                        </div>
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">Completion</span>
                                          <span className={`cbd-field-metric-value ${parseFloat(fieldCompletion) >= 90 ? 'cbd-metric-good' : parseFloat(fieldCompletion) >= 50 ? 'cbd-metric-mid' : 'cbd-metric-low'}`}>
                                            {fieldCompletion}%
                                          </span>
                                        </div>
                                      </div>
                                      {field.is_cancelled && (
                                        <div className="cbd-field-cancel-info">
                                          <FaTimesCircle className="cbd-cancel-icon" />
                                          <span>Cancelled{field.cancel_reason ? `: ${field.cancel_reason}` : ''}</span>
                                        </div>
                                      )}
                                      <div className={`cbd-field-progress ${field.is_cancelled ? 'cbd-field-progress--cancelled' : ''}`}>
                                        <div
                                          className={`cbd-field-progress-fill ${field.is_cancelled ? 'cbd-field-progress-fill--cancelled' : ''}`}
                                          style={{ width: `${Math.min(parseFloat(fieldCompletion), 100)}%` }}
                                        />
                                      </div>
                                      {field.view_map_url && (
                                        <button
                                          type="button"
                                          className="cbd-view-map-btn"
                                          onClick={(e) => { e.stopPropagation(); openMapPopup(field.view_map_url, field.field_name); }}
                                        >
                                          <FaMapMarkedAlt /> View Map
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="cbd-no-fields">No fields data for this plan</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-class-breakdown">No estate plans data for {monthName || month}</div>
            )}
          </div>
        </div>
      </div>

      {mapPopup && <MapImagePopup url={mapPopup.url} fieldName={mapPopup.fieldName} onClose={closeMapPopup} />}
    </div>
  );
};

const MapImagePopup = ({ url, fieldName, onClose }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [zoom, setZoom] = useState(1);

  return (
    <div className="cbd-map-overlay" onClick={onClose}>
      <div className="cbd-map-popup" onClick={(e) => e.stopPropagation()}>
        <div className="cbd-map-popup-header">
          <div className="cbd-map-popup-title"><FaMapMarkedAlt /><span>{fieldName || 'Field Map'}</span></div>
          <div className="cbd-map-popup-actions">
            <button className="cbd-map-zoom-btn" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} title="Zoom out" disabled={zoom <= 0.5}><FaSearchMinus /></button>
            <span className="cbd-map-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="cbd-map-zoom-btn" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))} title="Zoom in" disabled={zoom >= 3}><FaSearchPlus /></button>
            <button className="cbd-map-zoom-btn" onClick={() => setZoom(1)} title="Reset zoom"><FaExpand /></button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="cbd-map-zoom-btn" title="Open in new tab"><FaExternalLinkAlt /></a>
            <button className="cbd-map-close-btn" onClick={onClose} title="Close"><FaTimes /></button>
          </div>
        </div>
        <div className="cbd-map-popup-body">
          {!imgLoaded && !imgError && (<div className="cbd-map-loading"><div className="cbd-map-spinner" /><span>Loading map...</span></div>)}
          {imgError && (<div className="cbd-map-error"><span>Failed to load map image</span><a href={url} target="_blank" rel="noopener noreferrer" className="cbd-map-error-link">Open image URL directly</a></div>)}
          <img
            src={url} alt={`Map - ${fieldName}`} className="cbd-map-image"
            style={{ transform: `scale(${zoom})`, display: imgError ? 'none' : 'block', opacity: imgLoaded ? 1 : 0 }}
            onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default GlobalChartBreakdownPage;
