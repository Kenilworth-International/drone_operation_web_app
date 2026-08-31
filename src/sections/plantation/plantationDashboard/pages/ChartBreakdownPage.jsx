import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  FaAdjust,
  FaMoon,
  FaSearchPlus,
  FaSearchMinus,
  FaExpand,
  FaExternalLinkAlt,
  FaCheckCircle,
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import {
  useGetEstatePlanBreakdownQuery,
} from '../../../../api/services NodeJs/plantationDashboardApi';
import BreakdownDailyPlannedVsExecutedChart from '../components/BreakdownDailyPlannedVsExecutedChart';
import { useGetAllEstatesQuery } from '../../../../api/services/estatesApi';
import { Bars } from 'react-loader-spinner';
import '../../../../styles/plantationDashboard.css';
import { appendShellParams } from '../../../../utils/shellSearchParams';

/**
 * Field workflow status from estate-plan breakdown rows only (same API as chart-breakdown).
 * Uses planned_area, total_sprayed (DJI covered), is_cancelled, reason_flag — no main dashboard API.
 */
function getFieldWorkflowStatus(field) {
  const planned = parseFloat(field?.planned_area || 0);
  const covered = parseFloat(field?.total_sprayed || 0);
  const isCancelled = Boolean(field?.is_cancelled);
  const reasonFlag = String(field?.reason_flag || '').toLowerCase();

  if (isCancelled && reasonFlag === 'h') {
    return { label: 'Partially Completed', variant: 'partial' };
  }
  if (isCancelled) {
    return { label: 'Cancelled', variant: 'cancelled' };
  }
  if (covered > 0) {
    return { label: 'Completed', variant: 'completed' };
  }
  // Not yet executed — awaiting spray/spread
  return { label: 'Pending', variant: 'planned' };
}

const ChartBreakdownPage = ({ basePath = '/home/plantation-dashboard' } = {}) => {
  const isInternalDashboard =
    basePath === '/home/dashboard' || basePath.startsWith('/home/dashboard/');
  const completedPlansOnly = !isInternalDashboard;
  const containerClassName = `container-class-breakdown${isInternalDashboard ? ' container-class-breakdown--internal' : ''}`;
  const navigate = useNavigate();
  const location = useLocation();

  /** Return to dashboard: drop month/chart; keep ?comb=1 and ?wing= so COMB shell / wing filter stay. */
  const backToDashboard = useCallback(() => {
    const next = new URLSearchParams();
    appendShellParams(next, location.search);
    const qs = next.toString();
    if (qs) {
      navigate({ pathname: basePath, search: `?${qs}` });
    } else {
      navigate(basePath);
    }
  }, [basePath, location.search, navigate]);

  // Parse URL parameters
  const queryParams = new URLSearchParams(location.search);
  const urlMonth = queryParams.get('month');
  const urlChart = queryParams.get('chart');

  // Get data from location state (passed from chart bar click) or use URL params
  const {
    chartType: stateChartType,
    missionType: stateMissionType,
    month: stateMonth,
    monthName: stateMonthName,
    chartData: selectedChartData,
  } = location.state || {};

  // Use URL params if available, otherwise use state params
  const chartType = urlChart || stateChartType || 'planned-vs-sprayed';
  const missionType = stateMissionType || 'spy';
  const month = urlMonth || stateMonth;
  const monthName = stateMonthName || (month ? new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '');

  // Helper: get last day of month (YYYY-MM)
  const getMonthEnd = (ym) => {
    const parts = ym.split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const last = new Date(y, m, 0);
    return `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  };

  // Initialize date filters from selected month so we show "just that month"
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedEstate, setSelectedEstate] = useState('');
  const [dateFrom, setDateFrom] = useState(() => (month ? `${month}-01` : ''));
  const [dateTo, setDateTo] = useState(() => (month ? getMonthEnd(month) : ''));

  // Tea Revenue chart shows simplified view (no spray/completion/cancel data)
  const isTeaRevenueChart = chartType === 'planned-vs-tea-revenue';

  // Accordion state: which plans and fields are expanded
  const [expandedPlans, setExpandedPlans] = useState({});
  const [expandedFields, setExpandedFields] = useState({});

  // Map popup state
  const [mapPopup, setMapPopup] = useState(null); // { url, fieldName }
  const [detailPopup, setDetailPopup] = useState(null); // 'cancelled' | 'executed' | 'partial' | 'dayEnd' | null

  const openMapPopup = (url, fieldName) => {
    setMapPopup({ url, fieldName });
  };

  const closeMapPopup = useCallback(() => {
    setMapPopup(null);
  }, []);

  const closeDetailPopup = useCallback(() => {
    setDetailPopup(null);
  }, []);

  // Close map / detail popups on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      closeMapPopup();
      closeDetailPopup();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [closeMapPopup, closeDetailPopup]);

  const [isExporting, setIsExporting] = useState(false);

  const isFullyCancelledField = useCallback(
    (field) => Boolean(field?.is_cancelled) && String(field?.reason_flag || '') !== 'h',
    []
  );

  const getPlanCancelledExtent = useCallback((plan) => {
    const fields = Array.isArray(plan?.fields) ? plan.fields : [];
    return fields.reduce((fieldSum, field) => {
      if (!isFullyCancelledField(field)) return fieldSum;
      return fieldSum + parseFloat(field.planned_area || 0);
    }, 0);
  }, [isFullyCancelledField]);

  const estatePlansSectionRef = useRef(null);
  const scrollToEstatePlans = useCallback(() => {
    estatePlansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Effective month for API: from date filter when set, otherwise from URL/state
  const effectiveMonth = dateFrom ? dateFrom.substring(0, 7) : month;
  const effectiveMonthName = effectiveMonth ? new Date(effectiveMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : (monthName || month);
  const monthStart = effectiveMonth ? `${effectiveMonth}-01` : '';
  const monthEnd = effectiveMonth ? getMonthEnd(effectiveMonth) : '';

  // Sync date filters when month from URL/state changes (e.g. user navigates to different month)
  useEffect(() => {
    if (month) {
      setDateFrom(`${month}-01`);
      setDateTo(getMonthEnd(month));
    }
  }, [month]);

  // Fetch estate-plan breakdown data — use effective month (from filter or URL)
  const {
    data: estatePlanData,
    isLoading: estatePlanLoading,
    isFetching: estatePlanFetching,
  } = useGetEstatePlanBreakdownQuery(
    {
      yearMonth: effectiveMonth,
      missionType: missionType || 'spy',
      chartType: chartType || 'planned-vs-tea-revenue',
      completedPlansOnly,
    },
    { skip: !effectiveMonth }
  );
  const { data: estatesMasterData } = useGetAllEstatesQuery();

  const estatesMaster = useMemo(() => {
    const data = Array.isArray(estatesMasterData?.data)
      ? estatesMasterData.data
      : (Array.isArray(estatesMasterData) ? estatesMasterData : []);
    return data;
  }, [estatesMasterData]);

  const estateById = useMemo(() => {
    const map = new Map();
    estatesMaster.forEach((estate) => {
      map.set(String(estate.id), estate);
    });
    return map;
  }, [estatesMaster]);

  const allPlans = useMemo(() => {
    const data = estatePlanData?.data || [];
    // Sort plans: date ascending (1-31), but 0% completion plans go last (only for sprayed chart)
    // Within each group, sort by date then estate then plan_id
    return [...data].sort((a, b) => {
      if (!isTeaRevenueChart) {
        const aHasSprayed = parseFloat(a.total_sprayed || 0) > 0;
        const bHasSprayed = parseFloat(b.total_sprayed || 0) > 0;

        // Non-zero completion first, zero completion last
        if (aHasSprayed && !bHasSprayed) return -1;
        if (!aHasSprayed && bHasSprayed) return 1;
      }

      // Within same group: sort by date ascending
      const dateCompare = (a.picked_date || '').localeCompare(b.picked_date || '');
      if (dateCompare !== 0) return dateCompare;

      // Then by estate name
      const estateCompare = (a.estate_name || '').localeCompare(b.estate_name || '');
      if (estateCompare !== 0) return estateCompare;

      return (a.plan_id || 0) - (b.plan_id || 0);
    });
  }, [estatePlanData, isTeaRevenueChart]);

  const availableRegions = useMemo(() => {
    const map = new Map();
    allPlans.forEach((plan) => {
      const estateMeta = estateById.get(String(plan.estate_id));
      const regionId = estateMeta?.region;
      if (!regionId || map.has(String(regionId))) return;
      map.set(String(regionId), {
        id: String(regionId),
        name: estateMeta?.region_name || `Region ${regionId}`,
      });
    });
    return Array.from(map.values());
  }, [allPlans, estateById]);

  const availableEstates = useMemo(() => {
    const map = new Map();
    allPlans.forEach((plan) => {
      const estateId = String(plan.estate_id || '');
      if (!estateId) return;
      const estateMeta = estateById.get(estateId);
      const estateRegion = estateMeta?.region ? String(estateMeta.region) : '';
      if (selectedRegion && estateRegion !== selectedRegion) return;
      if (!map.has(estateId)) {
        map.set(estateId, {
          id: estateId,
          name: plan.estate_name || estateMeta?.estate || `Estate ${estateId}`,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPlans, estateById, selectedRegion]);

  const plans = useMemo(() => {
    return allPlans.filter((plan) => {
      const estateId = String(plan.estate_id || '');
      const estateMeta = estateById.get(estateId);
      const estateRegion = estateMeta?.region ? String(estateMeta.region) : '';
      const planDate = String(plan.picked_date || '');

      if (selectedEstate && estateId !== selectedEstate) return false;
      if (!selectedEstate && selectedRegion && estateRegion !== selectedRegion) return false;
      if (dateFrom && planDate < dateFrom) return false;
      if (dateTo && planDate > dateTo) return false;
      return true;
    });
  }, [allPlans, estateById, selectedRegion, selectedEstate, dateFrom, dateTo]);

  /** Field-level rows for detail popups (same filters as `plans`) */
  const breakdownDetailRows = useMemo(() => {
    const cancelled = [];
    const partial = [];
    const dayEnd = [];
    const executed = [];
    plans.forEach((plan) => {
      const estate = plan.estate_name || '';
      const pilot = plan.pilot_name || plan.pilotName || '—';
      const date = plan.picked_date || '';
      const pid = plan.plan_id;
      (plan.fields || []).forEach((field) => {
        const planned = parseFloat(field.planned_area || 0);
        const covered = parseFloat(field.total_sprayed || 0);
        const isCancelled = Boolean(field.is_cancelled);
        const reasonFlag = String(field.reason_flag || '').toLowerCase();
        if (isFullyCancelledField(field)) {
          cancelled.push({
            key: `${pid}-${field.field_id}`,
            planId: pid,
            pickedDate: date,
            estateName: estate,
            fieldName: field.field_name || '',
            fieldArea: planned,
            pilotName: pilot,
            cancelReason: field.cancel_reason || '—',
          });
        }
        if (reasonFlag === 'h' && isCancelled) {
          partial.push({
            key: `${pid}-${field.field_id}`,
            planId: pid,
            pickedDate: date,
            estateName: estate,
            fieldName: field.field_name || '',
            fieldArea: planned,
            completedArea: covered,
            pilotName: pilot,
            partialReason: field.cancel_reason || '—',
          });
        }
        const execHa = parseFloat(field.actual_sprayed_fields_extent || 0);
        if (execHa > 0) {
          const opsName = plan.operator_name
            ? String(plan.operator_name).trim()
            : '';
          executed.push({
            key: `exec-${pid}-${field.field_id}`,
            planId: pid,
            pickedDate: date,
            estateName: estate,
            fieldName: field.field_name || '',
            executedHa: execHa,
            coveredHa: covered,
            pilotName: pilot,
            opsRoomOperatorName: opsName || '—',
          });
        }
        const de = parseFloat(field.day_end_incomplete_extent || 0);
        if (de > 0) {
          const opsName = plan.operator_name
            ? String(plan.operator_name).trim()
            : '';
          dayEnd.push({
            key: `${pid}-${field.field_id}`,
            planId: pid,
            pickedDate: date,
            estateName: estate,
            fieldName: field.field_name || '',
            plannedHa: planned,
            coveredHa: covered,
            dayEndHa: de,
            pilotName: pilot,
            opsRoomOperatorName: opsName || '—',
          });
        }
      });
    });
    return { cancelled, partial, dayEnd, executed };
  }, [plans, isFullyCancelledField]);

  const summaryData = useMemo(() => {
    if (isTeaRevenueChart) {
      if (selectedChartData) {
        const tr = parseFloat(selectedChartData.teaRevenueExtent || 0);
        const plannedTotal =
          selectedChartData.plannedExtent != null && selectedChartData.plannedExtent !== ''
            ? parseFloat(selectedChartData.plannedExtent)
            : parseFloat(selectedChartData.plannedSprayingExtent || 0) +
              parseFloat(selectedChartData.plannedSpreadingExtent || 0);
        return {
          teaRevenueExtent: tr,
          plannedExtentTotal: plannedTotal,
          planningRatePct: tr > 0 ? (plannedTotal / tr) * 100 : 0,
        };
      }
      const plannedExtentTotal = plans.reduce(
        (s, p) => s + parseFloat(p.plan_total_extent || 0),
        0
      );
      return {
        teaRevenueExtent: 0,
        plannedExtentTotal,
        planningRatePct: 0,
      };
    }

    const planCount = plans.length;
    const totalPlannedExtent = planCount * 15;
    const estateApprovedExtent = plans.reduce((s, p) => {
      const ma = p.manager_approval === 1 || p.manager_approval === '1';
      return s + (ma ? parseFloat(p.total_planned || 0) : 0);
    }, 0);
    const executedExtent = plans.reduce(
      (s, p) => s + parseFloat(p.actual_sprayed_fields_extent || 0),
      0
    );
    const coveredExtent = plans.reduce(
      (s, p) => s + parseFloat(p.total_sprayed || 0),
      0
    );
    const cancelledExtent = plans.reduce((sum, plan) => {
      const fields = Array.isArray(plan.fields) ? plan.fields : [];
      return (
        sum +
        fields.reduce((fieldSum, field) => {
          if (!isFullyCancelledField(field)) return fieldSum;
          return fieldSum + parseFloat(field.planned_area || 0);
        }, 0)
      );
    }, 0);
    const partiallyCompletedExtent = plans.reduce((sum, plan) => {
      const fields = Array.isArray(plan.fields) ? plan.fields : [];
      return (
        sum +
        fields.reduce((fs, field) => {
          if (String(field?.reason_flag || '').toLowerCase() !== 'h') return fs;
          if (!Boolean(field?.is_cancelled)) return fs;
          return fs + parseFloat(field.planned_area || 0);
        }, 0)
      );
    }, 0);
    const pilotNotSprayedExtent = Math.max(0, executedExtent - coveredExtent);
    const dayEndIncompleteExtent = plans.reduce((s, plan) => {
      const fields = Array.isArray(plan.fields) ? plan.fields : [];
      return (
        s +
        fields.reduce(
          (fs, field) => fs + parseFloat(field.day_end_incomplete_extent || 0),
          0
        )
      );
    }, 0);

    return {
      planCount,
      totalPlannedExtent,
      estateApprovedExtent,
      cancelledExtent,
      partiallyCompletedExtent,
      executedExtent,
      coveredExtent,
      pilotNotSprayedExtent,
      dayEndIncompleteExtent,
      sprayPlanCount: missionType === 'spy' ? planCount : 0,
      spreadPlanCount: missionType === 'spd' ? planCount : 0,
    };
  }, [
    isTeaRevenueChart,
    selectedChartData,
    plans,
    missionType,
    isFullyCancelledField,
  ]);

  // Sort fields within a plan: completed (sprayed > 0) first, then 0-value last
  const getSortedFields = useCallback((fields) => {
    if (!fields || fields.length === 0) return [];
    return [...fields].sort((a, b) => {
      const aHasSprayed = parseFloat(a.total_sprayed || 0) > 0;
      const bHasSprayed = parseFloat(b.total_sprayed || 0) > 0;

      if (aHasSprayed && !bHasSprayed) return -1;
      if (!aHasSprayed && bHasSprayed) return 1;

      // Within same group, keep original order (by field name)
      return (a.field_name || '').localeCompare(b.field_name || '');
    });
  }, []);

  // Toggle plan accordion
  const togglePlan = (planId) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  // Toggle field accordion
  const toggleField = (planId, fieldId) => {
    const key = `${planId}-${fieldId}`;
    setExpandedFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Excel export — summary matches filtered `plans` (same as Estate Plans accordion + summary cards)
  const handleExportToExcel = () => {
    if (!effectiveMonth) {
      alert('No month selected');
      return;
    }
    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();
      const reportDate = effectiveMonth ? `${effectiveMonth}-01` : '';

      const summaryRows = isTeaRevenueChart
        ? [
            {
              Date: reportDate,
              'Tea Revenue Extent (Ha)': parseFloat(summaryData?.teaRevenueExtent || 0).toFixed(2),
              'Planned Extent (Ha)': parseFloat(summaryData?.plannedExtentTotal || 0).toFixed(2),
              'Planning Rate (%)': (summaryData?.planningRatePct ?? 0).toFixed(1),
            },
          ]
        : [
            {
              Date: reportDate,
              'Plan count': summaryData?.planCount ?? 0,
              'Total Planned Extent (Ha)': parseFloat(summaryData?.totalPlannedExtent || 0).toFixed(2),
              'Estate Approved Extent (Ha)': parseFloat(summaryData?.estateApprovedExtent || 0).toFixed(2),
              'Executed Extent (Ha)': parseFloat(summaryData?.executedExtent || 0).toFixed(2),
              'Covered Extent (Ha)': parseFloat(summaryData?.coveredExtent || 0).toFixed(2),
              ...(isInternalDashboard
                ? {
                    'Partially Completed (Ha)': parseFloat(summaryData?.partiallyCompletedExtent || 0).toFixed(2),
                  }
                : {}),
              'Cancelled Before Execution (Ha)': parseFloat(summaryData?.cancelledExtent || 0).toFixed(2),
              'Pilot Not Sprayed Extent (Ha)': parseFloat(summaryData?.pilotNotSprayedExtent || 0).toFixed(2),
              ...(isInternalDashboard
                ? {
                    'DayEnd Incomplete Extent (Ha)': parseFloat(summaryData?.dayEndIncompleteExtent || 0).toFixed(2),
                  }
                : {}),
            },
          ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Detail rows: exactly what's shown in the accordion on screen
      const detailRows = [];
      if (isTeaRevenueChart) {
        // Tea Revenue chart: plan list (Date, Estate, Plan ID) — matches UI
        if (plans && plans.length > 0) {
          plans.forEach((plan) => {
            detailRows.push({
              Date: plan.picked_date || reportDate,
              Estate: plan.estate_name || '',
              'Plan ID': plan.plan_id,
            });
          });
        }
      } else {
        // Planned vs Executed chart: plan → field rows — matches UI accordion
        if (plans && plans.length > 0) {
          plans.forEach((plan) => {
            (plan.fields || []).forEach((f) => {
              const planned = parseFloat(f.planned_area || 0);
              const sprayed = parseFloat(f.total_sprayed || 0);
              const completionPct = planned > 0
                ? ((sprayed / planned) * 100).toFixed(2)
                : '0.00';
              detailRows.push({
                Date: plan.picked_date || reportDate,
                'Plan ID': plan.plan_id,
                Estate: plan.estate_name || '',
                Field: f.field_name || '',
                'Planned (Ha)': planned.toFixed(2),
                'Covered Area (Ha)': sprayed.toFixed(2),
                ...(isInternalDashboard
                  ? {
                      'DayEnd Incomplete (Ha)': parseFloat(f.day_end_incomplete_extent || 0).toFixed(2),
                    }
                  : {}),
                'Completion (%)': completionPct,
                Status: getFieldWorkflowStatus(f).label,
                'Cancel Reason': f.is_cancelled && f.cancel_reason ? f.cancel_reason : '',
              });
            });
          });
        }
      }
      if (detailRows.length > 0) {
        const detailSheet = XLSX.utils.json_to_sheet(detailRows);
        XLSX.utils.book_append_sheet(workbook, detailSheet, isTeaRevenueChart ? 'Plans' : 'Fields');
      }

      const missionLabel =
        (missionType || 'spy') === 'spy' ? 'Spray' : 'Spread';
      const filename = `Chart_Details_${missionLabel}_${effectiveMonthName || effectiveMonth}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportCancelledDetailExcel = useCallback(() => {
    const fields = breakdownDetailRows.cancelled;
    if (fields.length === 0) return;
    const data = fields.map((f) => ({
      'Plan ID': f.planId,
      Date: f.pickedDate,
      Estate: f.estateName,
      Field: f.fieldName,
      'Area (Ha)': parseFloat(f.fieldArea.toFixed(2)),
      Pilot: f.pilotName,
      Reason: f.cancelReason,
    }));
    data.push({
      'Plan ID': '',
      Date: '',
      Estate: '',
      Field: 'TOTAL',
      'Area (Ha)': parseFloat((summaryData?.cancelledExtent || 0).toFixed(2)),
      Pilot: '',
      Reason: '',
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cancelled');
    XLSX.writeFile(wb, `ChartBreakdown_Cancelled_${effectiveMonth || 'export'}.xlsx`);
  }, [breakdownDetailRows, summaryData?.cancelledExtent, effectiveMonth]);

  const exportExecutedDetailExcel = useCallback(() => {
    const fields = breakdownDetailRows.executed;
    if (fields.length === 0) return;
    const data = fields.map((f) => ({
      'Plan ID': f.planId,
      Date: f.pickedDate,
      Estate: f.estateName,
      Field: f.fieldName,
      'Executed (Ha)': parseFloat(f.executedHa.toFixed(2)),
      'DJI Covered (Ha)': parseFloat(f.coveredHa.toFixed(2)),
      Pilot: f.pilotName,
      'Ops room operator': f.opsRoomOperatorName || '—',
    }));
    const totalCovered = fields.reduce((s, f) => s + f.coveredHa, 0);
    data.push({
      'Plan ID': '',
      Date: '',
      Estate: '',
      Field: 'TOTAL',
      'Executed (Ha)': parseFloat((summaryData?.executedExtent || 0).toFixed(2)),
      'DJI Covered (Ha)': parseFloat(totalCovered.toFixed(2)),
      Pilot: '',
      'Ops room operator': '',
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Executed');
    XLSX.writeFile(wb, `ChartBreakdown_ExecutedExtent_${effectiveMonth || 'export'}.xlsx`);
  }, [breakdownDetailRows, summaryData?.executedExtent, effectiveMonth]);

  const exportPartialDetailExcel = useCallback(() => {
    const fields = breakdownDetailRows.partial;
    if (fields.length === 0) return;
    const data = fields.map((f) => {
      const pct = f.fieldArea > 0 ? ((f.completedArea / f.fieldArea) * 100).toFixed(1) : '0.0';
      return {
        'Plan ID': f.planId,
        Date: f.pickedDate,
        Estate: f.estateName,
        Field: f.fieldName,
        'Field Size (Ha)': parseFloat(f.fieldArea.toFixed(2)),
        'Completed (Ha)': parseFloat(f.completedArea.toFixed(2)),
        'Completion %': parseFloat(pct),
        Pilot: f.pilotName,
        Reason: f.partialReason,
      };
    });
    const totalArea = fields.reduce((s, f) => s + f.fieldArea, 0);
    const totalCompleted = fields.reduce((s, f) => s + f.completedArea, 0);
    data.push({
      'Plan ID': '',
      Date: '',
      Estate: '',
      Field: 'TOTAL',
      'Field Size (Ha)': parseFloat(totalArea.toFixed(2)),
      'Completed (Ha)': parseFloat(totalCompleted.toFixed(2)),
      'Completion %': totalArea > 0 ? parseFloat(((totalCompleted / totalArea) * 100).toFixed(1)) : 0,
      Pilot: '',
      Reason: '',
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Partial');
    XLSX.writeFile(wb, `ChartBreakdown_Partial_${effectiveMonth || 'export'}.xlsx`);
  }, [breakdownDetailRows, effectiveMonth]);

  const exportDayEndDetailExcel = useCallback(() => {
    const fields = breakdownDetailRows.dayEnd;
    if (fields.length === 0) return;
    const data = fields.map((f) => ({
      'Plan ID': f.planId,
      Date: f.pickedDate,
      Estate: f.estateName,
      Field: f.fieldName,
      'Planned (Ha)': parseFloat(f.plannedHa.toFixed(2)),
      'DJI Covered (Ha)': parseFloat(f.coveredHa.toFixed(2)),
      Pilot: f.pilotName,
      'Ops room operator': f.opsRoomOperatorName || '—',
    }));
    const totalPlanned = fields.reduce((s, f) => s + f.plannedHa, 0);
    data.push({
      'Plan ID': '',
      Date: '',
      Estate: '',
      Field: 'TOTAL',
      'Planned (Ha)': parseFloat(totalPlanned.toFixed(2)),
      'DJI Covered (Ha)': '',
      Pilot: '',
      'Ops room operator': '',
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DayEnd');
    XLSX.writeFile(wb, `ChartBreakdown_DayEndIncomplete_${effectiveMonth || 'export'}.xlsx`);
  }, [breakdownDetailRows, effectiveMonth]);

  // No chart data passed via navigation or URL params
  if (!selectedChartData && !effectiveMonth) {
    return (
      <div className={containerClassName}>
        <div className="header-class-breakdown">
          <button
            type="button"
            className="back-btn-class-breakdown"
            aria-label="Back"
            onClick={backToDashboard}
          >
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
    <div className={containerClassName}>
      {/* Header */}
      <div className="header-class-breakdown">
        <button
          type="button"
          className="back-btn-class-breakdown"
          aria-label="Back"
          onClick={backToDashboard}
        >
          <FaArrowLeft aria-hidden="true" />
          <span className="back-btn-label-class-breakdown">Back</span>
        </button>
        <h1 className="title-class-breakdown">
          Chart Details - {effectiveMonthName || month}
        </h1>
      </div>

      <div className="content-class-breakdown">
        <div className="card-class-breakdown">
          <div className="card-header-class-breakdown">
            <h3 className="card-title-class-breakdown">
              Filters
            </h3>
          </div>
          <div className="card-body-class-breakdown">
            <div className="global-charts-filters-dataviewer cbd-filters-grid">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                min={monthStart}
                max={monthEnd}
                className="global-filter-select-dataviewer"
                title="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={monthStart}
                max={monthEnd}
                className="global-filter-select-dataviewer"
                title="To date"
              />
              <select
                value={selectedRegion}
                onChange={(e) => {
                  setSelectedRegion(e.target.value);
                  setSelectedEstate('');
                }}
                className="global-filter-select-dataviewer"
              >
                <option value="">All Regions</option>
                {availableRegions.map((region) => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </select>
              <select
                value={selectedEstate}
                onChange={(e) => setSelectedEstate(e.target.value)}
                className="global-filter-select-dataviewer"
              >
                <option value="">All Estates</option>
                {availableEstates.map((estate) => (
                  <option key={estate.id} value={estate.id}>{estate.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isInternalDashboard && !isTeaRevenueChart && (
          <BreakdownDailyPlannedVsExecutedChart
            plans={plans}
            missionType={missionType || 'spy'}
            dateFrom={dateFrom}
            dateTo={dateTo}
            isLoading={estatePlanLoading}
            isFetching={estatePlanFetching}
          />
        )}

        {/* Summary Metrics */}
        <div className="card-class-breakdown">
          <div className="card-header-class-breakdown">
            <h3 className="card-title-class-breakdown">
              Summary for {effectiveMonthName || month}
            </h3>
            <button
              type="button"
              className="plantation-chart-excel-btn cbd-summary-excel-btn"
              onClick={handleExportToExcel}
              disabled={isExporting}
              title="Export this month to Excel (Summary + Field-wise)"
              aria-label={isExporting ? 'Exporting…' : 'Export to Excel'}
            >
              {isExporting ? (
                <Bars height={18} width={18} color="#fff" />
              ) : (
                <FaFileExcel />
              )}
              <span className="cbd-excel-btn-label">{isExporting ? 'Exporting...' : 'Excel'}</span>
            </button>
          </div>
          <div className="card-body-class-breakdown">
            <div className="metrics-grid-class-breakdown">
              {isTeaRevenueChart ? (
                <>
                  <div className="metric-card-class-breakdown">
                    <div className="metric-label-class-breakdown">Tea Revenue Extent</div>
                    <div className="metric-value-class-breakdown metric-info-class-breakdown">
                      {parseFloat(summaryData?.teaRevenueExtent || 0).toFixed(2)} Ha
                    </div>
                    <div className="metric-hint-class-breakdown">Total tea revenue area</div>
                  </div>
                  <div className="metric-card-class-breakdown">
                    <div className="metric-label-class-breakdown">Planned Extent</div>
                    <div className="metric-value-class-breakdown metric-primary-class-breakdown">
                      {parseFloat(summaryData?.plannedExtentTotal || 0).toFixed(2)} Ha
                    </div>
                    <div className="metric-hint-class-breakdown">Planned extent for the month</div>
                  </div>
                  <div className="metric-card-class-breakdown">
                    <div className="metric-label-class-breakdown">Planning Rate</div>
                    <div className="metric-value-class-breakdown metric-secondary-class-breakdown">
                      {(summaryData?.planningRatePct ?? 0).toFixed(1)}%
                    </div>
                    <div className="metric-hint-class-breakdown">Planned / Tea Revenue</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="metric-card-class-breakdown">
                    <div className="metric-label-class-breakdown">Total Planned Extent</div>
                    <div className="metric-value-class-breakdown metric-primary-class-breakdown">
                      {parseFloat(summaryData?.totalPlannedExtent || 0).toFixed(2)} Ha
                    </div>
                    <div className="metric-subvalue-class-breakdown">
                      {summaryData?.planCount ?? 0}{' '}
                      {(summaryData?.planCount ?? 0) === 1 ? 'plan' : 'plans'}
                    </div>
                    <div className="metric-hint-class-breakdown">× 15 Ha per plan</div>
                  </div>
                  <div className="metric-card-class-breakdown">
                    <div className="metric-label-class-breakdown">Estate Approved Extent</div>
                    <div className="metric-value-class-breakdown metric-success-class-breakdown">
                      {parseFloat(summaryData?.estateApprovedExtent || 0).toFixed(2)} Ha
                    </div>
                    <div className="metric-hint-class-breakdown">
                      Planned field areas where the estate manager approved the plan
                    </div>
                  </div>
                  <div
                    className="metric-card-class-breakdown"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailPopup('executed')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailPopup('executed');
                      }
                    }}
                  >
                    <div className="metric-label-class-breakdown">Executed Extent</div>
                    <div className="metric-value-class-breakdown metric-secondary-class-breakdown">
                      {parseFloat(summaryData?.executedExtent || 0).toFixed(2)} Ha
                    </div>
                    <button
                      type="button"
                      className="cbd-metric-view-details"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToEstatePlans();
                      }}
                    >
                      View Details <FaChevronRight />
                    </button>
                    <div className="metric-hint-class-breakdown">
                      Field area where DJI flight data exists (actually executed)
                    </div>
                  </div>
                  <div className="metric-card-class-breakdown">
                    <div className="metric-label-class-breakdown">Covered Extent</div>
                    <div className="metric-value-class-breakdown metric-info-class-breakdown">
                      {parseFloat(summaryData?.coveredExtent || 0).toFixed(2)} Ha
                    </div>
                    <div className="metric-hint-class-breakdown">
                      DJI reported sprayed area (completed part; includes partial jobs)
                    </div>
                  </div>
                  {isInternalDashboard && (
                    <div
                      className="metric-card-class-breakdown"
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailPopup('partial')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDetailPopup('partial');
                        }
                      }}
                    >
                      <div className="metric-label-class-breakdown">Partially Completed</div>
                      <div
                        className="metric-value-class-breakdown"
                        style={{ color: '#ea580c', fontWeight: 800 }}
                      >
                        {parseFloat(summaryData?.partiallyCompletedExtent || 0).toFixed(2)} Ha
                      </div>
                      <button
                        type="button"
                        className="cbd-metric-view-details"
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollToEstatePlans();
                        }}
                      >
                        View Details <FaChevronRight />
                      </button>
                      <div className="metric-hint-class-breakdown">
                        Sprayed but not to full planned extent (covered above includes this)
                      </div>
                    </div>
                  )}
                  <div
                    className="metric-card-class-breakdown"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailPopup('cancelled')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailPopup('cancelled');
                      }
                    }}
                  >
                    <div className="metric-label-class-breakdown">Cancelled Before Execution</div>
                    <div className="metric-value-class-breakdown metric-danger-class-breakdown">
                      {parseFloat(summaryData?.cancelledExtent || 0).toFixed(2)} Ha
                    </div>
                    <button
                      type="button"
                      className="cbd-metric-view-details"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToEstatePlans();
                      }}
                    >
                      View Details <FaChevronRight />
                    </button>
                    <div className="metric-hint-class-breakdown">
                      No spray / narration only — full cancel (not partial)
                    </div>
                  </div>
                  <div className="metric-card-class-breakdown">
                    <div className="metric-label-class-breakdown">Pilot Not Sprayed Extent</div>
                    <div
                      className="metric-value-class-breakdown"
                      style={{ color: '#d97706', fontWeight: 800 }}
                    >
                      {parseFloat(summaryData?.pilotNotSprayedExtent || 0).toFixed(2)} Ha
                    </div>
                    <div className="metric-hint-class-breakdown">
                      Field extent flown vs DJI-reported area (Executed − Covered)
                    </div>
                  </div>
                  {isInternalDashboard && (
                  <div
                    className="metric-card-class-breakdown"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailPopup('dayEnd')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailPopup('dayEnd');
                      }
                    }}
                  >
                    <div className="metric-label-class-breakdown">DayEnd Incomplete Extent</div>
                    <div
                      className="metric-value-class-breakdown"
                      style={{ color: '#b45309', fontWeight: 800 }}
                    >
                      {parseFloat(summaryData?.dayEndIncompleteExtent || 0).toFixed(2)} Ha
                    </div>
                    <div className="metric-hint-class-breakdown">
                      DJI area null/0 (no spray), not cancelled before execution — planned Ha
                    </div>
                    <button
                      type="button"
                      className="cbd-metric-view-details"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToEstatePlans();
                      }}
                    >
                      View Details <FaChevronRight />
                    </button>
                  </div>
                  )}
                  {!isInternalDashboard && summaryData?.sprayPlanCount !== undefined && (
                    <div className="metric-card-class-breakdown">
                      <div className="metric-label-class-breakdown">Spray Plans</div>
                      <div className="metric-value-class-breakdown metric-primary-class-breakdown">
                        {summaryData.sprayPlanCount} ({(summaryData.sprayPlanCount * 15).toFixed(0)} Ha)
                      </div>
                      <div className="metric-hint-class-breakdown">Planned spray plans (count × 15 Ha)</div>
                    </div>
                  )}
                  {!isInternalDashboard && summaryData?.spreadPlanCount !== undefined && (
                    <div className="metric-card-class-breakdown">
                      <div className="metric-label-class-breakdown">Spread Plans</div>
                      <div className="metric-value-class-breakdown metric-secondary-class-breakdown">
                        {summaryData.spreadPlanCount} ({(summaryData.spreadPlanCount * 15).toFixed(0)} Ha)
                      </div>
                      <div className="metric-hint-class-breakdown">Planned spread plans (count × 15 Ha)</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Estate Plans Accordion */}
        <div className="card-class-breakdown" ref={estatePlansSectionRef}>
          <div className="card-header-class-breakdown">
            <h3 className="card-title-class-breakdown">
              Estate Plans - {effectiveMonthName || month}
            </h3>
            <span className="cbd-plan-count-badge">
              {plans.length} {plans.length === 1 ? 'Plan' : 'Plans'}
            </span>
          </div>
          <div className="card-body-class-breakdown" style={{ padding: 0 }}>
            {estatePlanLoading ? (
              <div className="cbd-accordion-loading">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="cbd-skeleton-row">
                    <div className="cbd-skeleton-bar" />
                  </div>
                ))}
              </div>
            ) : plans.length > 0 ? (
              <div className="cbd-accordion">
                {plans.map((plan) => {
                  const cancelledExtent = getPlanCancelledExtent(plan);
                  const nonCancelledTotal = Math.max(
                    parseFloat(plan.total_planned || 0) - cancelledExtent,
                    0
                  );
                  const pilotName =
                    plan.pilot_name ||
                    plan.pilotName ||
                    plan.assigned_pilot_name ||
                    plan.assignedPilotName ||
                    plan.pilot ||
                    'N/A';
                  const droneId =
                    plan.drone_id ||
                    plan.drone_tag ||
                    plan.droneTag ||
                    plan.droneId ||
                    plan.assigned_drone_id ||
                    plan.assignedDroneId ||
                    plan.drone_no ||
                    plan.droneNo ||
                    'N/A';
                  const isPlanExpanded = !!expandedPlans[plan.plan_id];
                  const completionRate =
                    nonCancelledTotal > 0
                      ? (
                          (parseFloat(plan.total_sprayed || 0) /
                            nonCancelledTotal) *
                          100
                        ).toFixed(1)
                      : '0.0';

                  return (
                    <div
                      key={plan.plan_id}
                      className={`cbd-plan-item ${isPlanExpanded ? 'cbd-plan-item--expanded' : ''}`}
                    >
                      {/* Plan Row (Level 1) */}
                      <div
                        className="cbd-plan-header"
                        onClick={() => !isTeaRevenueChart && togglePlan(plan.plan_id)}
                        style={isTeaRevenueChart ? { cursor: 'default' } : {}}
                      >
                        {!isTeaRevenueChart && (
                          <div className="cbd-plan-chevron">
                            {isPlanExpanded ? (
                              <FaChevronDown />
                            ) : (
                              <FaChevronRight />
                            )}
                          </div>
                        )}
                        <div className="cbd-plan-info">
                          <span className="cbd-plan-estate">
                            <FaLeaf className="cbd-plan-icon" />
                            {plan.estate_name}
                          </span>
                          <span className="cbd-plan-meta">
                            <span className="cbd-plan-date">
                              <FaCalendarAlt className="cbd-plan-meta-icon" />
                              {formatDate(plan.picked_date)}
                            </span>
                            <span className="cbd-plan-id">
                              <FaHashtag className="cbd-plan-meta-icon" />
                              Plan {plan.plan_id}
                            </span>
                            {isInternalDashboard && (
                              <>
                                <span className="cbd-plan-id">
                                  Pilot: {pilotName}
                                </span>
                                <span className="cbd-plan-id">
                                  Drone ID: {droneId}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                        {!isTeaRevenueChart && (
                          <div className="cbd-plan-summary">
                            <span
                              className="cbd-plan-summary-item cbd-planned"
                              title="Total Planned Extent"
                            >
                              {plan.total_planned.toFixed(2)} Ha
                            </span>
                            <span
                              className="cbd-plan-summary-item cbd-info"
                              title="Executed Extent (Total Planned - Canceled)"
                            >{nonCancelledTotal.toFixed(2)} Ha
                            </span>
                            <span
                              className="cbd-plan-summary-item cbd-sprayed"
                              title="Completed Extent (Covered Area)"
                            >
                              {plan.total_sprayed.toFixed(2)} Ha
                            </span>
                            <span
                              className={`cbd-plan-summary-item cbd-rate ${
                                parseFloat(completionRate) >= 90
                                  ? 'cbd-rate--good'
                                  : parseFloat(completionRate) >= 50
                                  ? 'cbd-rate--mid'
                                  : 'cbd-rate--low'
                              }`}
                              title="Covered ÷ (planned − cancelled) × 100"
                            >
                              {completionRate}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Fields (Level 2) - shown when plan is expanded (only for Planned vs Executed chart) */}
                      {!isTeaRevenueChart && isPlanExpanded && (
                        <div className="cbd-fields-container">
                          {plan.fields && plan.fields.length > 0 ? (
                            getSortedFields(plan.fields).map((field) => {
                              const fieldKey = `${plan.plan_id}-${field.field_id}`;
                              const isFieldExpanded =
                                !!expandedFields[fieldKey];
                              const fieldCompletion =
                                field.planned_area > 0
                                  ? (
                                      (field.total_sprayed /
                                        field.planned_area) *
                                      100
                                    ).toFixed(1)
                                  : '0.0';
                              const workflow = getFieldWorkflowStatus(field);

                              return (
                                <div
                                  key={fieldKey}
                                  className={`cbd-field-item ${isFieldExpanded ? 'cbd-field-item--expanded' : ''} cbd-field-item--${workflow.variant}`}
                                >
                                  {/* Field Row */}
                                  <div
                                    className={`cbd-field-header cbd-field-header--${workflow.variant}`}
                                    onClick={() =>
                                      toggleField(
                                        plan.plan_id,
                                        field.field_id
                                      )
                                    }
                                  >
                                    <div className="cbd-field-chevron">
                                      {isFieldExpanded ? (
                                        <FaChevronDown />
                                      ) : (
                                        <FaChevronRight />
                                      )}
                                    </div>
                                    <span className={`cbd-field-name cbd-field-name--${workflow.variant}`}>
                                      {field.field_name}
                                      <span className={`cbd-field-status-badge cbd-field-status-badge--${workflow.variant}`}>
                                        {workflow.label}
                                      </span>
                                    </span>
                                    <span className="cbd-field-area">
                                      {parseFloat(
                                        field.field_area || 0
                                      ).toFixed(2)}{' '}
                                      Ha
                                    </span>
                                  </div>

                                  {/* Field Details (Level 3) */}
                                  {isFieldExpanded && (
                                    <div className="cbd-field-details">
                                      <div className="cbd-field-metrics">
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">
                                            Status
                                          </span>
                                          <span className="cbd-field-metric-value cbd-metric-primary">
                                            {workflow.label}
                                          </span>
                                        </div>
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">
                                            Field Area
                                          </span>
                                          <span className="cbd-field-metric-value cbd-metric-primary">
                                            {parseFloat(
                                              field.field_area || 0
                                            ).toFixed(2)}{' '}
                                            Ha
                                          </span>
                                        </div>
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">
                                            Planned
                                          </span>
                                          <span className="cbd-field-metric-value cbd-metric-info">
                                            {parseFloat(
                                              field.planned_area || 0
                                            ).toFixed(2)}{' '}
                                            Ha
                                          </span>
                                        </div>
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">
                                            Executed
                                          </span>
                                          <span className="cbd-field-metric-value cbd-metric-info">
                                            {parseFloat(
                                              field.actual_sprayed_fields_extent || 0
                                            ).toFixed(2)}{' '}
                                            Ha
                                          </span>
                                        </div>
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">
                                            Covered (DJI)
                                          </span>
                                          <span className="cbd-field-metric-value cbd-metric-success">
                                            {parseFloat(
                                              field.total_sprayed || 0
                                            ).toFixed(2)}{' '}
                                            Ha
                                          </span>
                                        </div>
                                        <div className="cbd-field-metric">
                                          <span className="cbd-field-metric-label">
                                            Completion
                                          </span>
                                          <span
                                            className={`cbd-field-metric-value ${
                                              parseFloat(fieldCompletion) >= 90
                                                ? 'cbd-metric-good'
                                                : parseFloat(fieldCompletion) >=
                                                  50
                                                ? 'cbd-metric-mid'
                                                : 'cbd-metric-low'
                                            }`}
                                          >
                                            {fieldCompletion}%
                                          </span>
                                        </div>
                                      </div>
                                      {/* Cancel reason */}
                                      {field.is_cancelled && (
                                        <div className={`cbd-field-cancel-info ${field.reason_flag === 'h' ? 'cbd-field-cancel-info--partial' : ''}`}>
                                          <FaTimesCircle className="cbd-cancel-icon" />
                                          <span>{workflow.label}{field.cancel_reason ? `: ${field.cancel_reason}` : ''}</span>
                                        </div>
                                      )}
                                      {/* Progress bar */}
                                      <div className={`cbd-field-progress ${workflow.variant === 'partial' ? 'cbd-field-progress--partial' : workflow.variant === 'cancelled' ? 'cbd-field-progress--cancelled' : ''}`}>
                                        <div
                                          className={`cbd-field-progress-fill ${workflow.variant === 'partial' ? 'cbd-field-progress-fill--partial' : workflow.variant === 'cancelled' ? 'cbd-field-progress-fill--cancelled' : ''}`}
                                          style={{
                                            width: `${Math.min(
                                              parseFloat(fieldCompletion),
                                              100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                      {/* View Map button */}
                                      {field.view_map_url && (
                                        <button
                                          type="button"
                                          className="cbd-view-map-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openMapPopup(field.view_map_url, field.field_name);
                                          }}
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
                            <div className="cbd-no-fields">
                              No fields data for this plan
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-class-breakdown">
                No estate plans data for {effectiveMonthName || month}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail list popups (same layout as main dashboard) */}
      {!isTeaRevenueChart && detailPopup === 'cancelled' && (
        <div className="pd-popup-overlay" onClick={closeDetailPopup}>
          <div className="pd-popup" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header pd-popup-header--red">
              <span className="pd-popup-title">
                <FaTimesCircle /> Cancelled Before Execution
              </span>
              <div className="pd-popup-header-actions">
                {breakdownDetailRows.cancelled.length > 0 && (
                  <button type="button" className="pd-popup-excel-btn" onClick={exportCancelledDetailExcel}>
                    <FaFileExcel /> Excel
                  </button>
                )}
                <button type="button" className="pd-popup-close" onClick={closeDetailPopup}>
                  <FaTimes />
                </button>
              </div>
            </div>
            <div className="pd-popup-body">
              {breakdownDetailRows.cancelled.length === 0 ? (
                <div className="pd-popup-empty">No cancelled fields for this view</div>
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
                    {breakdownDetailRows.cancelled.map((f) => (
                      <tr key={f.key}>
                        <td data-label="Plan ID">{f.planId}</td>
                        <td data-label="Date">{f.pickedDate}</td>
                        <td data-label="Estate">{f.estateName}</td>
                        <td data-label="Field">{f.fieldName}</td>
                        <td data-label="Area (Ha)" style={{ textAlign: 'center' }}>{f.fieldArea.toFixed(2)}</td>
                        <td data-label="Pilot">{f.pilotName}</td>
                        <td data-label="Reason">
                          <span className="pd-cancel-reason">{f.cancelReason}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700 }}>
                        Total Cancelled
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {(summaryData?.cancelledExtent || 0).toFixed(2)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {!isTeaRevenueChart && detailPopup === 'executed' && (
        <div className="pd-popup-overlay" onClick={closeDetailPopup}>
          <div className="pd-popup pd-popup--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header pd-popup-header--purple">
              <span className="pd-popup-title">
                <FaCheckCircle /> Executed Extent ({effectiveMonthName || effectiveMonth})
              </span>
              <div className="pd-popup-header-actions">
                {breakdownDetailRows.executed.length > 0 && (
                  <button type="button" className="pd-popup-excel-btn" onClick={exportExecutedDetailExcel}>
                    <FaFileExcel /> Excel
                  </button>
                )}
                <button type="button" className="pd-popup-close" onClick={closeDetailPopup}>
                  <FaTimes />
                </button>
              </div>
            </div>
            <div className="pd-popup-body">
              <p className="pd-popup-intro" style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>
                Field area where DJI flight data exists (actually executed), per field.
              </p>
              {breakdownDetailRows.executed.length === 0 ? (
                <div className="pd-popup-empty">No executed fields for this view</div>
              ) : (
                <table className="pd-popup-table">
                  <thead>
                    <tr>
                      <th>Plan ID</th>
                      <th>Date</th>
                      <th>Estate</th>
                      <th>Field</th>
                      <th style={{ textAlign: 'center' }}>Executed (Ha)</th>
                      <th style={{ textAlign: 'center' }}>DJI Covered (Ha)</th>
                      <th>Pilot</th>
                      <th>Ops room operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownDetailRows.executed.map((f) => (
                      <tr key={f.key}>
                        <td data-label="Plan ID">{f.planId}</td>
                        <td data-label="Date">{f.pickedDate}</td>
                        <td data-label="Estate">{f.estateName}</td>
                        <td data-label="Field">{f.fieldName}</td>
                        <td data-label="Executed (Ha)" style={{ textAlign: 'center', fontWeight: 700 }}>
                          {f.executedHa.toFixed(2)}
                        </td>
                        <td data-label="Covered (Ha)" style={{ textAlign: 'center' }}>{f.coveredHa.toFixed(2)}</td>
                        <td data-label="Pilot">{f.pilotName}</td>
                        <td data-label="Ops operator">{f.opsRoomOperatorName}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700 }}>
                        Total executed extent
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {(summaryData?.executedExtent || 0).toFixed(2)}
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {breakdownDetailRows.executed
                          .reduce((s, f) => s + f.coveredHa, 0)
                          .toFixed(2)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {!isTeaRevenueChart && isInternalDashboard && detailPopup === 'partial' && (
        <div className="pd-popup-overlay" onClick={closeDetailPopup}>
          <div className="pd-popup pd-popup--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header pd-popup-header--orange">
              <span className="pd-popup-title">
                <FaAdjust /> Partially Completed Fields ({effectiveMonthName || effectiveMonth})
              </span>
              <div className="pd-popup-header-actions">
                {breakdownDetailRows.partial.length > 0 && (
                  <button type="button" className="pd-popup-excel-btn" onClick={exportPartialDetailExcel}>
                    <FaFileExcel /> Excel
                  </button>
                )}
                <button type="button" className="pd-popup-close" onClick={closeDetailPopup}>
                  <FaTimes />
                </button>
              </div>
            </div>
            <div className="pd-popup-body">
              {breakdownDetailRows.partial.length === 0 ? (
                <div className="pd-popup-empty">No partially completed fields for this view</div>
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
                    {breakdownDetailRows.partial.map((f) => {
                      const pct = f.fieldArea > 0 ? ((f.completedArea / f.fieldArea) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={f.key}>
                          <td data-label="Plan ID">{f.planId}</td>
                          <td data-label="Date">{f.pickedDate}</td>
                          <td data-label="Estate">{f.estateName}</td>
                          <td data-label="Field">{f.fieldName}</td>
                          <td data-label="Size (Ha)" style={{ textAlign: 'center' }}>{f.fieldArea.toFixed(2)}</td>
                          <td data-label="Completed" style={{ textAlign: 'center', color: '#ea580c' }}>
                            {f.completedArea.toFixed(2)}
                          </td>
                          <td data-label="%">
                            <span
                              className={`plantation-completion-badge ${
                                parseFloat(pct) >= 100 ? 'complete' : parseFloat(pct) >= 50 ? 'good' : 'low'
                              }`}
                            >
                              {pct}%
                            </span>
                          </td>
                          <td data-label="Pilot">{f.pilotName}</td>
                          <td data-label="Reason">
                            <span className="pd-partial-reason">{f.partialReason}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700 }}>
                        Total Partially Completed
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {(summaryData?.partiallyCompletedExtent || 0).toFixed(2)}
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {breakdownDetailRows.partial.reduce((s, f) => s + f.completedArea, 0).toFixed(2)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {!isTeaRevenueChart && isInternalDashboard && detailPopup === 'dayEnd' && (
        <div className="pd-popup-overlay" onClick={closeDetailPopup}>
          <div className="pd-popup pd-popup--wide" onClick={(e) => e.stopPropagation()}>
            <div className="pd-popup-header pd-popup-header--amber">
              <span className="pd-popup-title">
                <FaMoon /> DayEnd Incomplete ({effectiveMonthName || effectiveMonth})
              </span>
              <div className="pd-popup-header-actions">
                {breakdownDetailRows.dayEnd.length > 0 && (
                  <button type="button" className="pd-popup-excel-btn" onClick={exportDayEndDetailExcel}>
                    <FaFileExcel /> Excel
                  </button>
                )}
                <button type="button" className="pd-popup-close" onClick={closeDetailPopup}>
                  <FaTimes />
                </button>
              </div>
            </div>
            <div className="pd-popup-body">
              {breakdownDetailRows.dayEnd.length === 0 ? (
                <div className="pd-popup-empty">No day-end incomplete fields for this view</div>
              ) : (
                <table className="pd-popup-table">
                  <thead>
                    <tr>
                      <th>Plan ID</th>
                      <th>Date</th>
                      <th>Estate</th>
                      <th>Field</th>
                      <th style={{ textAlign: 'center' }}>Planned (Ha)</th>
                      <th style={{ textAlign: 'center' }}>DJI Covered (Ha)</th>
                      <th>Pilot</th>
                      <th>Ops room operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownDetailRows.dayEnd.map((f) => (
                      <tr key={f.key}>
                        <td data-label="Plan ID">{f.planId}</td>
                        <td data-label="Date">{f.pickedDate}</td>
                        <td data-label="Estate">{f.estateName}</td>
                        <td data-label="Field">{f.fieldName}</td>
                        <td data-label="Planned (Ha)" style={{ textAlign: 'center' }}>{f.plannedHa.toFixed(2)}</td>
                        <td data-label="Covered (Ha)" style={{ textAlign: 'center' }}>{f.coveredHa.toFixed(2)}</td>
                        <td data-label="Pilot">{f.pilotName}</td>
                        <td data-label="Ops operator">{f.opsRoomOperatorName}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700 }}>
                        Total DayEnd Incomplete
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>
                        {breakdownDetailRows.dayEnd
                          .reduce((s, f) => s + f.plannedHa, 0)
                          .toFixed(2)}
                      </td>
                      <td />
                      <td />
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Image Popup */}
      {mapPopup && (
        <MapImagePopup
          url={mapPopup.url}
          fieldName={mapPopup.fieldName}
          onClose={closeMapPopup}
        />
      )}
    </div>
  );
};

/* =====================================================
   MAP IMAGE POPUP COMPONENT
   ===================================================== */
const MapImagePopup = ({ url, fieldName, onClose }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="cbd-map-overlay" onClick={onClose}>
      <div className="cbd-map-popup" onClick={(e) => e.stopPropagation()}>
        {/* Popup Header */}
        <div className="cbd-map-popup-header">
          <div className="cbd-map-popup-title">
            <FaMapMarkedAlt />
            <span>{fieldName || 'Field Map'}</span>
          </div>
          <div className="cbd-map-popup-actions">
            <button
              className="cbd-map-zoom-btn"
              onClick={handleZoomOut}
              title="Zoom out"
              disabled={zoom <= 0.5}
            >
              <FaSearchMinus />
            </button>
            <span className="cbd-map-zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              className="cbd-map-zoom-btn"
              onClick={handleZoomIn}
              title="Zoom in"
              disabled={zoom >= 3}
            >
              <FaSearchPlus />
            </button>
            <button
              className="cbd-map-zoom-btn"
              onClick={handleResetZoom}
              title="Reset zoom"
            >
              <FaExpand />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="cbd-map-zoom-btn"
              title="Open in new tab"
            >
              <FaExternalLinkAlt />
            </a>
            <button className="cbd-map-close-btn" onClick={onClose} title="Close">
              <FaTimes />
            </button>
          </div>
        </div>
        {/* Popup Body */}
        <div className="cbd-map-popup-body">
          {!imgLoaded && !imgError && (
            <div className="cbd-map-loading">
              <div className="cbd-map-spinner" />
              <span>Loading map...</span>
            </div>
          )}
          {imgError && (
            <div className="cbd-map-error">
              <span>Failed to load map image</span>
              <a href={url} target="_blank" rel="noopener noreferrer" className="cbd-map-error-link">
                Open image URL directly
              </a>
            </div>
          )}
          <img
            src={url}
            alt={`Map - ${fieldName}`}
            className="cbd-map-image"
            style={{
              transform: `scale(${zoom})`,
              display: imgError ? 'none' : 'block',
              opacity: imgLoaded ? 1 : 0,
            }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartBreakdownPage;
