import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Bars } from 'react-loader-spinner';
import { FaCalendarAlt, FaCarSide, FaCheckCircle, FaDownload, FaGasPump, FaMoneyBillWave, FaTools, FaChartLine } from 'react-icons/fa';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import {
  useGetVehicleAppDriversQuery,
  useGetVehicleAppMaintenanceRequestsQuery,
  useGetVehicleAppVehiclesQuery,
  useHrDecideVehicleMaintenanceRequestMutation,
  useSaveVehicleAppVehicleMutation,
} from '../../api/services NodeJs/vehicleAppApi';
import { useGetDriverFuelCardsQuery } from '../../api/services NodeJs/jdManagementApi';
import { getNodeBackendUrl } from '../../api/services NodeJs/nodeBackendConfig';
import { getFilenameResourceUrlCandidates } from '../../utils/resourceUrls';
import {
  useGetAdvanceRequestsForHrQuery,
  useGetLeaveDaysForHrQuery,
  useGetPendingApprovalsQuery,
  useLazyGetLeaveDaysForHrByMonthQuery,
  useGetDailyKmSummaryForHrQuery,
} from '../../api/services NodeJs/vehicleRentApi';
import DriverAdvanceApprovals from '../hr&admin/driverAdvanceApprovals/DriverAdvanceApprovals';
import FuelApprovals from '../hr&admin/fuelApprovals/FuelApprovals';
import { useGetPendingFuelApprovalsQuery } from '../../api/services NodeJs/fuelApprovalsApi';
import DriverLeaveDatesHr from '../hr&admin/driverLeaveDates/DriverLeaveDatesHr';
import VehicleRentApprovals from '../hr&admin/vehicleRentApprovals/VehicleRentApprovals';
import VehicleManagement from '../administration/VehicleManagement';
import { useGetHrTransportEstimatesQuery } from '../../api/services NodeJs/allEndpoints';
import {
  useGetTransportArrangementListQuery,
  useGetPilotTransportOptionsQuery,
  useAssignPilotTransportDetailsMutation,
} from '../../api/services NodeJs/pilotAssignmentApi';
import TransportAssignmentFields from '../opsroom/pilot-assigment/TransportAssignmentFields';
import PoolVehicleTasksPanel from './PoolVehicleTasksPanel';
import FuelPricesModal from './FuelPricesModal';
import { formatDriverArrivalTimeForInput, formatApiDateYmd, formatTransportTimeDisplay, getColomboYmd } from '../../utils/transportAssignment';
import '../../styles/transportHrDashboard.css';

function getTodayInfo() {
  const today = getColomboYmd();
  return {
    today,
    monthKey: today.slice(0, 7),
  };
}

function toDateOnly(value) {
  return formatApiDateYmd(value);
}

/** Last N calendar months (current month first), for filter dropdown */
function getRollingMonthOptions(monthsBack = 24) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < monthsBack; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    out.push({ value, label });
  }
  return out;
}

function monthLabelFromYearMonth(ym) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return String(ym || '');
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function resolveMaintenanceImageCandidates(row, type) {
  const direct =
    type === 'damage'
      ? (row?.image_url || row?.image)
      : type === 'bill'
        ? (row?.image_2_url || row?.image_2)
        : (row?.payment_image_url || row?.payment_image);
  const text = String(direct || '').trim();
  if (!text) return [];
  if (text.startsWith('data:')) return [text];

  const apiBase = String(getNodeBackendUrl() || '').replace(/\/+$/, '');
  const candidates = [];
  if (/^https?:\/\//i.test(text)) {
    candidates.push(text);
    try {
      const parsed = new URL(text);
      const fileName = (parsed.pathname.split('/').pop() || '').trim();
      if (fileName && /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(fileName)) {
        candidates.push(...getFilenameResourceUrlCandidates(fileName));
      }
    } catch (_) {}
    return [...new Set(candidates)];
  }

  const normalizedPath = text.startsWith('/') ? text : `/${text}`;
  if (normalizedPath.startsWith('/uploads/') || normalizedPath.startsWith('/documents/')) {
    candidates.push(`${apiBase}${normalizedPath}`);
    candidates.push(normalizedPath);
    return [...new Set(candidates)];
  }

  const fileName = text.split('/').pop();
  if (fileName && /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(fileName)) {
    candidates.push(...getFilenameResourceUrlCandidates(fileName));
  }
  return [...new Set(candidates)];
}

const MODULE_META = [
  { key: 'availableToday', title: 'Available Today', icon: FaCheckCircle },
  { key: 'rentApprovals', title: 'Vehicle Rent Approvals', icon: FaCarSide },
  { key: 'advanceApprovals', title: 'Driver Advance Approvals', icon: FaMoneyBillWave },
  { key: 'maintenanceApprovals', title: 'Maintenance Approvals', icon: FaTools },
  { key: 'fuelApprovals', title: 'Fuel Approvals', icon: FaGasPump },
  { key: 'leaveDates', title: 'Driver Leave Dates', icon: FaCalendarAlt },
  { key: 'vehicleAdminVehicles', title: 'Vehicle Admin - Vehicles', icon: FaTools },
  { key: 'vehicleAdminMaintenance', title: 'Vehicle Admin - Maintenance', icon: FaTools },
];
const SUMMARY_DETAIL_KEYS = new Set(['availableToday', 'rentApprovals', 'advanceApprovals', 'maintenanceApprovals', 'fuelApprovals', 'leaveDates']);

const VEHICLE_MODULE_PARAM = 'vehicleManagement';

function TransportHrDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailModule, setDetailModule] = useState(null);
  const [leaveHistoryOpen, setLeaveHistoryOpen] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [leaveMonthFilter, setLeaveMonthFilter] = useState('');
  const [chartMonth, setChartMonth] = useState('');
  const [chartVehicleNo, setChartVehicleNo] = useState('');
  const [chartOwnershipFilter, setChartOwnershipFilter] = useState('all');
  const [chartViewMode, setChartViewMode] = useState('combined');
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState('all');
  const [maintenanceVehicleFilter, setMaintenanceVehicleFilter] = useState('all');
  const [maintenanceMonthFilter, setMaintenanceMonthFilter] = useState('');
  const [maintenanceSearch, setMaintenanceSearch] = useState('');
  const [availableTodayTab, setAvailableTodayTab] = useState('assignVehicle');
  const [showTransportDetailModal, setShowTransportDetailModal] = useState(false);
  const [fuelPricesModalOpen, setFuelPricesModalOpen] = useState(false);
  const [transportAssignmentDate, setTransportAssignmentDate] = useState(() => getTodayInfo().today);
  const [transportDetailAssignmentId, setTransportDetailAssignmentId] = useState('');
  const [transportDetailYearMonth, setTransportDetailYearMonth] = useState('');
  const [transportEditable, setTransportEditable] = useState(true);
  const [transportForm, setTransportForm] = useState({
    driver_id: '',
    vehicle_id: '',
    driver_arrival_time: '06:00',
  });
  const transportRecommendedAppliedRef = useRef(false);
  useEffect(() => {
    const moduleParam = searchParams.get('module');
    if (moduleParam === VEHICLE_MODULE_PARAM || moduleParam === 'vehicles') {
      setDetailModule('vehicleManagement');
    }
  }, [searchParams]);

  const openVehicleManagement = () => {
    setDetailModule('vehicleManagement');
    const next = new URLSearchParams(searchParams);
    next.set('module', VEHICLE_MODULE_PARAM);
    setSearchParams(next, { replace: true });
  };

  const closeVehicleManagement = () => {
    setDetailModule(null);
    const next = new URLSearchParams(searchParams);
    next.delete('module');
    setSearchParams(next, { replace: true });
  };

  const [hrDecisionModal, setHrDecisionModal] = useState({
    open: false,
    row: null,
    approval: 'a',
    declineReason: '',
    error: '',
  });
  const [hrDecisionNotice, setHrDecisionNotice] = useState({
    open: false,
    title: '',
    message: '',
    tone: 'success',
  });
  const [imagePreview, setImagePreview] = useState({
    open: false,
    title: '',
    urls: [],
    index: 0,
    failed: false,
  });
  const [vehicleCardModal, setVehicleCardModal] = useState({ open: false, row: null, cardId: '' });
  const [vehicleDriverModal, setVehicleDriverModal] = useState({ open: false, row: null, driverId: '' });
  const [fetchLeaveByMonth, leaveByMonthResult] = useLazyGetLeaveDaysForHrByMonthQuery();
  const rollingMonthOptions = useMemo(() => getRollingMonthOptions(24), []);
  const { today, monthKey } = useMemo(() => getTodayInfo(), []);

  const closeVehicleCardModal = () => setVehicleCardModal({ open: false, row: null, cardId: '' });
  const closeVehicleDriverModal = () => setVehicleDriverModal({ open: false, row: null, driverId: '' });

  const submitVehicleDriver = async () => {
    const row = vehicleDriverModal.row;
    if (!row?.id) return;
    try {
      await saveVehicleAppVehicle({
        id: row.id,
        vehicle_no: row.vehicle_no,
        make: row.make ?? null,
        model: row.model ?? null,
        driver: vehicleDriverModal.driverId ? Number(vehicleDriverModal.driverId) : null,
        activated: row.activated,
        vehicle_category_id: row.vehicle_category_id ?? row.normalized_vehicle_category_id ?? null,
        fuel_category_id: row.fuel_category_id ?? row.normalized_fuel_category_id ?? null,
        card_id: row.card_id ?? (row.linked_card_id ? Number(row.linked_card_id) : null),
        ownership: row.ownership === 'r' ? 'r' : 'o',
        operational_status: row.operational_status || 'o',
      }).unwrap();
      refetchVehicles();
      closeVehicleDriverModal();
      setHrDecisionNotice({ open: true, title: 'Saved', message: 'Vehicle driver updated.', tone: 'success' });
    } catch (e) {
      setHrDecisionNotice({
        open: true,
        title: 'Action needed',
        message: e?.data?.message || e?.message || "We couldn't save your changes. Please try again.",
        tone: 'error',
      });
    }
  };

  const submitVehicleCard = async () => {
    const row = vehicleCardModal.row;
    if (!row?.id) return;
    try {
      await saveVehicleAppVehicle({
        id: row.id,
        vehicle_no: row.vehicle_no,
        make: row.make ?? null,
        model: row.model ?? null,
        driver: row.driver ?? null,
        activated: row.activated,
        vehicle_category_id: row.vehicle_category_id ?? row.normalized_vehicle_category_id ?? null,
        fuel_category_id: row.fuel_category_id ?? row.normalized_fuel_category_id ?? null,
        card_id: vehicleCardModal.cardId ? Number(vehicleCardModal.cardId) : null,
        ownership: row.ownership === 'r' ? 'r' : 'o',
        operational_status: row.operational_status || 'o',
      }).unwrap();
      refetchVehicles();
      closeVehicleCardModal();
      setHrDecisionNotice({
        open: true,
        title: 'Saved',
        message: 'Vehicle fuel card updated.',
        tone: 'success',
      });
    } catch (e) {
      setHrDecisionNotice({
        open: true,
        title: 'Action needed',
        message: e?.data?.message || e?.message || "We couldn't save the vehicle fuel card. Please try again.",
        tone: 'error',
      });
    }
  };
  const { data: vehicles = [], isLoading: loadingVehicles, refetch: refetchVehicles } = useGetVehicleAppVehiclesQuery();
  const { data: vehicleDrivers = [], refetch: refetchDrivers } = useGetVehicleAppDriversQuery();
  const { data: fuelCards = [] } = useGetDriverFuelCardsQuery({});
  const [saveVehicleAppVehicle, { isLoading: savingVehicleCard }] = useSaveVehicleAppVehicleMutation();
  const maintenanceMonthOptions = useMemo(() => getRollingMonthOptions(36), []);
  const { data: maintenanceRequests = [], isLoading: loadingMaintenance } = useGetVehicleAppMaintenanceRequestsQuery(
    maintenanceMonthFilter || ''
  );
  const [hrDecideMaintenance, { isLoading: savingHrDecision }] = useHrDecideVehicleMaintenanceRequestMutation();
  const { data: leaveRows = [], isLoading: loadingLeaves } = useGetLeaveDaysForHrQuery({ yearMonth: monthKey });
  const { data: rentRows = [], isLoading: loadingRent } = useGetPendingApprovalsQuery({ yearMonth: monthKey, status: 'all' });
  const { data: advanceRows = [], isLoading: loadingAdvance } = useGetAdvanceRequestsForHrQuery({ yearMonth: monthKey, status: 'all' });
  const { data: fuelPendingRows = [], isLoading: loadingFuel } = useGetPendingFuelApprovalsQuery();
  const fuelPendingTotal = useMemo(
    () => (fuelPendingRows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [fuelPendingRows]
  );
  const effectiveChartMonth = chartMonth || monthKey;
  const chartOwnershipApi =
    chartOwnershipFilter === 'own' ? 'o' : chartOwnershipFilter === 'rented' ? 'r' : undefined;
  const {
    data: kmChartRows = [],
    isLoading: loadingKmChart,
  } = useGetDailyKmSummaryForHrQuery({
    yearMonth: effectiveChartMonth,
    vehicle_no: chartVehicleNo || undefined,
    ownership: chartOwnershipApi,
  });
  const {
    data: kmVehicleChartRows = [],
    isLoading: loadingKmVehicleChart,
  } = useGetDailyKmSummaryForHrQuery({
    yearMonth: effectiveChartMonth,
    vehicle_no: chartVehicleNo || undefined,
    split_by_vehicle: 1,
    ownership: chartOwnershipApi,
  });
  const { data: hrTransportEstimatePayload } = useGetHrTransportEstimatesQuery(
    { assignment_date: today },
    { skip: !today }
  );
  const { data: transportArrangementListData, isLoading: loadingTransportArrangementList } =
    useGetTransportArrangementListQuery({ date: transportAssignmentDate || null });
  const { data: transportOptionsData, isLoading: loadingTransportOptions } = useGetPilotTransportOptionsQuery(
    {
      assignment_id: transportDetailAssignmentId || null,
      yearMonth: transportDetailYearMonth || undefined,
      plan_ids: [],
      pool_vehicles_only: true,
    },
    { skip: !showTransportDetailModal || !transportDetailAssignmentId }
  );
  const [assignTransportDetails, { isLoading: savingTransport }] = useAssignPilotTransportDetailsMutation();
  const isPrimaryLoading = loadingVehicles || loadingMaintenance || loadingLeaves || loadingRent || loadingAdvance;
  const hrTransportEstimates = hrTransportEstimatePayload?.data || [];
  const transportOptions = transportOptionsData?.data || null;
  const transportDrivers = transportOptions?.drivers || [];
  const transportEstates = transportOptions?.estates || [];
  const hasTransportEstates = transportEstates.length > 0;
  const transportArrangementRows = transportArrangementListData?.data || [];
  const transportSelectedDateRows = transportArrangementRows.filter(
    (r) => !transportAssignmentDate || String(r.assignment_day) === String(transportAssignmentDate)
  );
  const pendingVehicleAssignmentCount = useMemo(
    () => transportSelectedDateRows.filter((row) => !row.driver_id || !row.vehicle_id).length,
    [transportSelectedDateRows]
  );

  useEffect(() => {
    if (!showTransportDetailModal) {
      transportRecommendedAppliedRef.current = false;
      return;
    }
    if (loadingTransportOptions || !transportOptions || transportRecommendedAppliedRef.current) return;
    const saved = transportOptions.saved_transport;
    if (saved?.driver_id) {
      const driver = transportDrivers.find((d) => String(d.id) === String(saved.driver_id));
      setTransportForm({
        driver_id: String(saved.driver_id),
        vehicle_id:
          saved.vehicle_id != null
            ? String(saved.vehicle_id)
            : driver?.vehicle_id != null
              ? String(driver.vehicle_id)
              : '',
        driver_arrival_time: formatDriverArrivalTimeForInput(saved.driver_arrival_time),
      });
      transportRecommendedAppliedRef.current = true;
      return;
    }
    const rid = transportOptions.recommended_driver_id;
    if (!rid) return;
    const driver = transportDrivers.find((d) => String(d.id) === String(rid));
    if (!driver?.vehicle_id) return;
    setTransportForm((prev) => {
      if (prev.driver_id) return prev;
      return {
        ...prev,
        driver_id: String(rid),
        vehicle_id: String(driver.vehicle_id),
      };
    });
    transportRecommendedAppliedRef.current = true;
  }, [showTransportDetailModal, loadingTransportOptions, transportOptions, transportDrivers]);

  const availableVehicles = useMemo(() => {
    const todaysLeaves = (leaveRows || []).filter((row) => toDateOnly(row.leave_date) === today);
    const leaveVehicleSet = new Set(
      todaysLeaves
        .map((row) => String(row.vehicle_no || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const leaveDriverSet = new Set(
      todaysLeaves
        .map((row) => String(row.requested_by_name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    return (vehicles || []).filter((vehicle) => {
      const isActive = Number(vehicle.activated) === 1;
      const isPoolVehicle = String(vehicle.vehicle_pool_category ?? 'p').trim().toLowerCase() === 'p';
      const vehicleNo = String(vehicle.vehicle_no || '').trim();
      const driverName = String(vehicle.assigned_driver_name || '').trim();
      if (!isActive || !isPoolVehicle || !vehicleNo || !driverName) return false;
      if (leaveVehicleSet.has(vehicleNo.toLowerCase())) return false;
      if (leaveDriverSet.has(driverName.toLowerCase())) return false;
      return true;
    });
  }, [vehicles, leaveRows, today]);

  const openTransportDetail = (row) => {
    transportRecommendedAppliedRef.current = false;
    setTransportDetailAssignmentId(row.assignment_id);
    setTransportDetailYearMonth(row.assignment_day ? row.assignment_day.slice(0, 7) : '');
    setTransportEditable(!!row.editable_transport);
    setTransportForm({
      driver_id: row.driver_id != null ? String(row.driver_id) : '',
      vehicle_id: row.vehicle_id != null ? String(row.vehicle_id) : '',
      driver_arrival_time: formatDriverArrivalTimeForInput(row.driver_arrival_time),
    });
    setShowTransportDetailModal(true);
  };

  const closeTransportDetailModal = () => {
    setShowTransportDetailModal(false);
    setTransportDetailAssignmentId('');
    setTransportDetailYearMonth('');
    transportRecommendedAppliedRef.current = false;
  };

  const updateTransportField = (field, value) => {
    setTransportForm((prev) => {
      if (field === 'driver_id') {
        const driver = transportDrivers.find((d) => String(d.id) === String(value));
        return {
          ...prev,
          driver_id: value,
          vehicle_id: driver?.vehicle_id != null ? String(driver.vehicle_id) : '',
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const onSaveTransport = async () => {
    if (!transportDetailAssignmentId) {
      setHrDecisionNotice({ open: true, title: 'Action needed', message: 'Assignment ID is required.', tone: 'error' });
      return;
    }
    if (!transportEditable) {
      setHrDecisionNotice({
        open: true,
        title: 'Action needed',
        message: 'This assignment cannot be changed right now.',
        tone: 'error',
      });
      return;
    }
    if (!transportForm.driver_id || !transportForm.vehicle_id || !transportForm.driver_arrival_time) {
      setHrDecisionNotice({
        open: true,
        title: 'Action needed',
        message: 'Driver, linked vehicle, and arrival time are required.',
        tone: 'error',
      });
      return;
    }
    if (!hasTransportEstates) {
      setHrDecisionNotice({
        open: true,
        title: 'Action needed',
        message: 'Assignment estates are missing, so we cannot save driver and vehicle details yet.',
        tone: 'error',
      });
      return;
    }
    try {
      await assignTransportDetails({
        assignment_id: transportDetailAssignmentId,
        driver_id: Number(transportForm.driver_id),
        vehicle_id: Number(transportForm.vehicle_id),
        driver_arrival_time: transportForm.driver_arrival_time,
        pool_vehicles_only: true,
      }).unwrap();
      setHrDecisionNotice({ open: true, title: 'Saved', message: 'Transport details saved successfully.', tone: 'success' });
      closeTransportDetailModal();
    } catch (error) {
      const message =
        error?.data?.message ||
        error?.message ||
        "We couldn't save transport details. Please try again.";
      setHrDecisionNotice({ open: true, title: 'Action needed', message, tone: 'error' });
    }
  };

  const rentStats = useMemo(() => {
    const approved = (rentRows || []).filter((r) => String(r?.approval) === 'a').length;
    const declined = (rentRows || []).filter((r) => String(r?.approval) === 'd').length;
    const pending = (rentRows || []).filter((r) => String(r?.approval) !== 'a' && String(r?.approval) !== 'd').length;
    return { pending, approved, declined };
  }, [rentRows]);

  const advanceStats = useMemo(() => {
    const approved = (advanceRows || []).filter((r) => String(r?.approval) === 'a').length;
    const declined = (advanceRows || []).filter((r) => String(r?.approval) === 'd').length;
    const pending = (advanceRows || []).filter((r) => String(r?.approval) !== 'a' && String(r?.approval) !== 'd').length;
    return { pending, approved, declined };
  }, [advanceRows]);
  const maintenanceStats = useMemo(() => {
    const approved = (maintenanceRequests || []).filter((r) => String(r?.hr_approval || r?.approval || 'p') === 'a').length;
    const declined = (maintenanceRequests || []).filter((r) => String(r?.hr_approval || r?.approval || 'p') === 'd').length;
    const pending = (maintenanceRequests || []).filter((r) => String(r?.hr_approval || r?.approval || 'p') === 'p').length;
    return { pending, approved, declined };
  }, [maintenanceRequests]);

  const leaveTodayCount = useMemo(
    () => (leaveRows || []).filter((row) => toDateOnly(row?.leave_date) === today).length,
    [leaveRows, today]
  );
  const recentLeaves = useMemo(
    () =>
      [...(leaveRows || [])]
        .sort((a, b) => String(b?.leave_date || '').localeCompare(String(a?.leave_date || '')))
        .slice(0, 4),
    [leaveRows]
  );

  const leaveHistoryPayload = leaveByMonthResult.data || { months: [] };
  const leaveHistoryMonths = leaveHistoryPayload.months || [];
  const loadingLeaveByMonth = leaveByMonthResult.isFetching;
  const leaveHistoryError = leaveByMonthResult.isError;

  const displayedLeaveMonths = useMemo(() => {
    if (!leaveMonthFilter) {
      return leaveHistoryMonths;
    }
    const found = leaveHistoryMonths.find((m) => m.yearMonth === leaveMonthFilter);
    if (found) {
      return [found];
    }
    return [
      {
        yearMonth: leaveMonthFilter,
        label: monthLabelFromYearMonth(leaveMonthFilter),
        count: 0,
        rows: [],
      },
    ];
  }, [leaveHistoryMonths, leaveMonthFilter]);

  useEffect(() => {
    if (leaveHistoryOpen) {
      setLeaveMonthFilter('');
    }
  }, [leaveHistoryOpen]);

  useEffect(() => {
    if (!initialLoadComplete && !isPrimaryLoading) {
      setInitialLoadComplete(true);
    }
  }, [initialLoadComplete, isPrimaryLoading]);

  const openLeaveHistoryModal = () => {
    setLeaveHistoryOpen(true);
    fetchLeaveByMonth({ monthsBack: 24 });
  };

  const downloadLeaveHistoryExcel = () => {
    const flat = [];
    displayedLeaveMonths.forEach((m) => {
      (m.rows || []).forEach((row) => {
        flat.push({
          'Year-Month': m.yearMonth,
          'Month': m.label,
          'Leave date': toDateOnly(row.leave_date),
          Driver: row.requested_by_name || '',
          'Vehicle no': row.vehicle_no || '',
          Reason: row.reason || '',
          'Record ID': row.id,
        });
      });
    });
    if (!flat.length) {
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(flat);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave requests');
    const stamp = getColomboYmd();
    XLSX.writeFile(workbook, `Driver_leave_requests_${stamp}.xlsx`);
  };
  const pendingMaintenanceCount = useMemo(
    () => (maintenanceRequests || []).filter((row) => String(row?.hr_approval || row?.approval || 'p') === 'p').length,
    [maintenanceRequests]
  );
  const activeVehiclesCount = useMemo(
    () => (vehicles || []).filter((row) => Number(row?.activated) === 1).length,
    [vehicles]
  );
  const inactiveVehiclesCount = useMemo(
    () => (vehicles || []).filter((row) => Number(row?.activated) !== 1).length,
    [vehicles]
  );
  const assignedVehicleCount = useMemo(
    () => (vehicles || []).filter((row) => String(row?.assigned_driver_name || '').trim().length > 0).length,
    [vehicles]
  );
  const currentMonthMaintenanceCount = useMemo(
    () => (maintenanceRequests || []).length,
    [maintenanceRequests]
  );
  const latestPendingMaintenance = useMemo(
    () =>
      [...(maintenanceRequests || [])]
        .filter((row) => String(row?.hr_approval || row?.approval || 'p') === 'p')
        .sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')))[0] || null,
    [maintenanceRequests]
  );
  const maintenancePreviewRows = useMemo(
    () =>
      [...(maintenanceRequests || [])]
        .filter((row) => String(row?.hr_approval || row?.approval || 'p') === 'p')
        .slice(0, 5),
    [maintenanceRequests]
  );
  const maintenanceVehicleOptions = useMemo(
    () => [...new Set((maintenanceRequests || []).map((r) => String(r?.vehicle_no || r?.vehicle || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [maintenanceRequests]
  );
  const filteredMaintenanceRequests = useMemo(() => {
    const q = String(maintenanceSearch || '').trim().toLowerCase();
    return (maintenanceRequests || []).filter((row) => {
      const status = String(row?.hr_approval || row?.approval || 'p');
      if (maintenanceStatusFilter !== 'all' && status !== maintenanceStatusFilter) return false;
      const vehicleText = String(row?.vehicle_no || row?.vehicle || '').trim();
      if (maintenanceVehicleFilter !== 'all' && vehicleText !== maintenanceVehicleFilter) return false;
      if (!q) return true;
      const driverText = String(row?.driver_name || row?.driver || '').toLowerCase();
      const categoryText = String(row?.category_name || row?.category || '').toLowerCase();
      const requestIdText = String(row?.id || '').toLowerCase();
      return (
        vehicleText.toLowerCase().includes(q)
        || driverText.includes(q)
        || categoryText.includes(q)
        || requestIdText.includes(q)
      );
    });
  }, [maintenanceRequests, maintenanceSearch, maintenanceStatusFilter, maintenanceVehicleFilter]);
  const openHrDecisionModal = (row, approval) => {
    setHrDecisionModal({
      open: true,
      row,
      approval,
      declineReason: '',
      error: '',
    });
  };
  const closeHrDecisionModal = () => {
    setHrDecisionModal({
      open: false,
      row: null,
      approval: 'a',
      declineReason: '',
      error: '',
    });
  };
  const submitHrDecision = async () => {
    const row = hrDecisionModal.row;
    if (!row?.id) return;
    const approval = hrDecisionModal.approval;
    const declineReason = String(hrDecisionModal.declineReason || '').trim();
    if (approval === 'd' && !declineReason) {
      setHrDecisionModal((prev) => ({ ...prev, error: 'Decline reason is required.' }));
      return;
    }
    try {
      await hrDecideMaintenance({
        id: row.id,
        approval,
        decline_reason: approval === 'd' ? declineReason : null,
      }).unwrap();
      closeHrDecisionModal();
      setHrDecisionNotice({
        open: true,
        title: 'Success',
        message: `Maintenance request #${row.id} ${approval === 'a' ? 'approved' : 'declined'} successfully.`,
        tone: 'success',
      });
    } catch (error) {
      setHrDecisionModal((prev) => ({
        ...prev,
        error: error?.data?.message || error?.message || 'Failed to update HR decision.',
      }));
    }
  };
  const openImagePreview = (urlOrUrls, title) => {
    const baseUrls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    const primary = String(baseUrls[0] || '').trim();
    if (!primary) return;
    const urls = baseUrls.filter(Boolean).map((item) => String(item).trim());
    try {
      const parsed = new URL(primary, window.location.origin);
      // Try same path on current host too (helps when API base URL points elsewhere).
      urls.push(`${window.location.origin}${parsed.pathname}`);
      if (parsed.pathname.includes('/uploads/maintenance_requests/')) {
        urls.push(`${window.location.origin}${parsed.pathname.replace('/uploads/maintenance_requests/', '/uploads/vehicle_day/')}`);
      }
    } catch (_) {}
    if (primary.includes('/uploads/maintenance_requests/')) {
      urls.push(primary.replace('/uploads/maintenance_requests/', '/uploads/vehicle_day/'));
    }
    setImagePreview({
      open: true,
      title: title || 'Image Preview',
      urls: [...new Set(urls)],
      index: 0,
      failed: false,
    });
  };
  const closeImagePreview = () => {
    setImagePreview({ open: false, title: '', urls: [], index: 0, failed: false });
  };
  const renderImagePreviewModal = () => (
    imagePreview.open ? (
      <div
        role="presentation"
        className="quick-add-overlay-transport-hr"
        onClick={closeImagePreview}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="quick-add-modal-transport-hr"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="quick-add-modal-toolbar-transport-hr">
            <h3 className="quick-add-modal-title-transport-hr">{imagePreview.title || 'Preview'}</h3>
            <button type="button" className="action-btn-secondary-transport-hr" onClick={closeImagePreview}>Close</button>
          </div>
          <div className="quick-add-modal-body-transport-hr" style={{ textAlign: 'center' }}>
            {(() => {
              const currentUrl = imagePreview.urls[imagePreview.index] || '';
              if (!currentUrl) {
                return <p style={{ color: '#6b7280' }}>Image URL not available.</p>;
              }
              const isPdf = /\.pdf($|\?)/i.test(currentUrl);
              if (isPdf) {
                return (
                  <iframe
                    src={currentUrl}
                    title="preview-pdf"
                    style={{ width: '100%', height: 420, border: '1px solid #e5e7eb', borderRadius: 8 }}
                  />
                );
              }
              return (
                <img
                  src={currentUrl}
                  alt="preview"
                  style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 8 }}
                  onError={() => {
                    if (imagePreview.index + 1 < imagePreview.urls.length) {
                      setImagePreview((prev) => ({ ...prev, index: prev.index + 1, failed: false }));
                    } else {
                      setImagePreview((prev) => ({ ...prev, failed: true }));
                    }
                  }}
                />
              );
            })()}
            {imagePreview.failed ? (
              <p style={{ marginTop: 10, color: '#b91c1c', fontWeight: 600 }}>
                Image not found.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    ) : null
  );
  const renderHrDecisionModal = () => (
    hrDecisionModal.open ? (
      <div
        role="presentation"
        className="quick-add-overlay-transport-hr"
        onClick={savingHrDecision ? undefined : closeHrDecisionModal}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transport-hr-maintenance-decision-title"
          className="quick-add-modal-transport-hr maintenance-decision-modal-maintenance-approv"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="quick-add-modal-toolbar-transport-hr">
            <h3 id="transport-hr-maintenance-decision-title" className="quick-add-modal-title-transport-hr">
              Confirm {hrDecisionModal.approval === 'a' ? 'Approval' : 'Decline'}
            </h3>
            <button
              type="button"
              className="action-btn-secondary-transport-hr"
              onClick={closeHrDecisionModal}
              disabled={savingHrDecision}
            >
              Close
            </button>
          </div>
          <div className="quick-add-modal-body-transport-hr maintenance-decision-body-maintenance-approv">
            <p className="maintenance-decision-intent-maintenance-approv">
              {hrDecisionModal.approval === 'a'
                ? 'This action will approve the request for processing.'
                : 'Please provide a clear reason. Driver will see this message.'}
            </p>
            <div className="maintenance-decision-meta-maintenance-approv">
              <span><strong>Request:</strong> #{hrDecisionModal.row?.id || '-'}</span>
              <span><strong>Vehicle:</strong> {hrDecisionModal.row?.vehicle_no || '-'}</span>
              <span><strong>Driver:</strong> {hrDecisionModal.row?.driver_name || '-'}</span>
            </div>
            {hrDecisionModal.approval === 'd' ? (
              <div className="maintenance-decision-reason-wrap-maintenance-approv">
                <label htmlFor="transport-hr-decline-reason" className="maintenance-decision-reason-label-maintenance-approv">
                  Decline Reason
                </label>
                <textarea
                  id="transport-hr-decline-reason"
                  rows={4}
                  className="maintenance-decision-reason-input-maintenance-approv"
                  value={hrDecisionModal.declineReason}
                  onChange={(e) => setHrDecisionModal((prev) => ({ ...prev, declineReason: e.target.value, error: '' }))}
                  placeholder="Enter reason for declining this request"
                />
              </div>
            ) : (
              <p className="maintenance-decision-confirm-text-maintenance-approv">
                Are you sure you want to approve this maintenance request?
              </p>
            )}
            {hrDecisionModal.error ? (
              <p className="maintenance-decision-error-maintenance-approv">
                {hrDecisionModal.error}
              </p>
            ) : null}
            <div className="maintenance-decision-actions-maintenance-approv">
              <button
                type="button"
                className="maintenance-decision-btn-maintenance-approv maintenance-decision-btn-cancel-maintenance-approv"
                onClick={closeHrDecisionModal}
                disabled={savingHrDecision}
              >
                Cancel
              </button>
              <button
                type="button"
                className="maintenance-decision-btn-maintenance-approv maintenance-decision-btn-confirm-maintenance-approv"
                onClick={submitHrDecision}
                disabled={savingHrDecision}
              >
                {savingHrDecision ? 'Saving...' : hrDecisionModal.approval === 'a' ? 'Approve Request' : 'Decline Request'}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null
  );
  const renderHrDecisionNoticeModal = () => (
    hrDecisionNotice.open ? (
      <div
        role="presentation"
        className="quick-add-overlay-transport-hr"
        onClick={() => setHrDecisionNotice({ open: false, title: '', message: '', tone: 'success' })}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="quick-add-modal-transport-hr"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="quick-add-modal-toolbar-transport-hr">
            <h3 className="quick-add-modal-title-transport-hr">{hrDecisionNotice.title}</h3>
          </div>
          <div className="quick-add-modal-body-transport-hr">
            <p
              style={{
                marginTop: 0,
                color: hrDecisionNotice.tone === 'error' ? '#b91c1c' : '#14532d',
                fontWeight: 600,
              }}
            >
              {hrDecisionNotice.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="action-btn-outline-transport-hr"
                onClick={() => setHrDecisionNotice({ open: false, title: '', message: '', tone: 'success' })}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null
  );
  const chartVehicleOptions = useMemo(() => {
    let rows = vehicles || [];
    if (chartOwnershipFilter === 'own') {
      rows = rows.filter((row) => String(row?.ownership || 'o').toLowerCase() !== 'r');
    } else if (chartOwnershipFilter === 'rented') {
      rows = rows.filter((row) => String(row?.ownership || '').toLowerCase() === 'r');
    }
    return [...new Set(rows.map((row) => String(row?.vehicle_no || '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [vehicles, chartOwnershipFilter]);
  const chartOwnershipLabel =
    chartOwnershipFilter === 'own' ? 'Own' : chartOwnershipFilter === 'rented' ? 'Rented' : 'All';
  const chartData = useMemo(
    () =>
      (kmChartRows || []).map((row) => ({
        ...row,
        dayLabel: String(row.day || '').replace(/^0/, '') || formatApiDateYmd(row.date).slice(8, 10),
      })),
    [kmChartRows]
  );
  const chartVehicleSeriesRows = useMemo(
    () =>
      (kmVehicleChartRows || []).map((row) => ({
        ...row,
        vehicle_no: String(row.vehicle_no || 'Unknown'),
        dayLabel: String(row.day || '').replace(/^0/, '') || formatApiDateYmd(row.date).slice(8, 10),
      })),
    [kmVehicleChartRows]
  );
  const chartVehicleSeriesKeys = useMemo(
    () => [...new Set(chartVehicleSeriesRows.map((row) => String(row.vehicle_no || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [chartVehicleSeriesRows]
  );
  const chartDataSeparate = useMemo(() => {
    const byDate = new Map();
    chartVehicleSeriesRows.forEach((row) => {
      const dateKey = toDateOnly(row.date);
      if (!dateKey) return;
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          date: dateKey,
          dayLabel: String(row.dayLabel || '').replace(/^0/, '') || dateKey.slice(8, 10),
        });
      }
      byDate.get(dateKey)[row.vehicle_no] = Number(row.total_km || 0);
    });
    return [...byDate.values()].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }, [chartVehicleSeriesRows]);
  const isAllVehiclesView = !chartVehicleNo;
  const shouldShowSeparateChart = isAllVehiclesView && chartViewMode === 'separate';
  const isChartLoading = shouldShowSeparateChart ? loadingKmVehicleChart : loadingKmChart;
  const chartTotals = useMemo(() => {
    const totalKm = chartData.reduce((sum, row) => sum + Number(row.total_km || 0), 0);
    const activeDays = chartData.filter((row) => Number(row.total_km || 0) > 0).length;
    const peak = chartData.reduce(
      (acc, row) => (Number(row.total_km || 0) > Number(acc.total_km || 0) ? row : acc),
      { total_km: 0, date: '' }
    );
    return {
      totalKm: Number(totalKm.toFixed(1)),
      activeDays,
      peakKm: Number(Number(peak.total_km || 0).toFixed(1)),
      peakDate: toDateOnly(peak.date) || '',
    };
  }, [chartData]);
  useEffect(() => {
    if (!isAllVehiclesView && chartViewMode === 'separate') {
      setChartViewMode('combined');
    }
  }, [chartViewMode, isAllVehiclesView]);

  useEffect(() => {
    if (!chartVehicleNo) return;
    if (!chartVehicleOptions.includes(chartVehicleNo)) {
      setChartVehicleNo('');
    }
  }, [chartVehicleNo, chartVehicleOptions]);

  const showStandaloneDetail = Boolean(detailModule && SUMMARY_DETAIL_KEYS.has(detailModule));

  useEffect(() => {
    if (!showStandaloneDetail) return undefined;
    const root = document.querySelector('.content-dashboard');
    root?.classList.add('content-dashboard--transport-hr-standalone');
    return () => root?.classList.remove('content-dashboard--transport-hr-standalone');
  }, [showStandaloneDetail]);

  const getSeriesColor = (index) => {
    const palette = [
      '#004B71', '#0A9396', '#3A86FF', '#8338EC', '#2A9D8F',
      '#FF006E', '#E76F51', '#4361EE', '#5E60CE', '#2B9348',
    ];
    return palette[index % palette.length];
  };
  const downloadKmChartExcel = () => {
    if (!chartVehicleSeriesRows.length) return;
    const rows = chartVehicleSeriesRows.map((row) => ({
      Date: toDateOnly(row.date),
      Day: row.dayLabel || String(toDateOnly(row.date) || '').slice(8, 10),
      Vehicle: row.vehicle_no || chartVehicleNo || 'Unknown',
      'Vehicle KM': Number(row.total_km || 0).toFixed(1),
      'Active Vehicles (Date)': Number(row.vehicle_count || 0),
      Month: monthLabelFromYearMonth(effectiveChartMonth),
      Filter: chartVehicleNo || 'All Vehicles',
      Ownership: chartOwnershipLabel,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily KM by Vehicle');
    const suffix = chartVehicleNo ? `_${chartVehicleNo}` : '_all-vehicles';
    XLSX.writeFile(workbook, `Transport_Daily_KM_${effectiveChartMonth}${suffix}.xlsx`);
  };

  const renderDetailsContent = () => {
    if (detailModule === 'availableToday') {
      return (
        <div className="details-table-wrap-transport-hr details-table-wrap-transport-hr--scroll">
          <div className="details-table-toolbar-transport-hr">
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={availableTodayTab === 'assignVehicle' ? 'action-btn-outline-transport-hr' : 'action-btn-secondary-transport-hr'}
                onClick={() => setAvailableTodayTab('assignVehicle')}
              >
                Operational
              </button>
              <button
                type="button"
                className={availableTodayTab === 'additional' ? 'action-btn-outline-transport-hr' : 'action-btn-secondary-transport-hr'}
                onClick={() => setAvailableTodayTab('additional')}
              >
                Additional
              </button>
              <button
                type="button"
                className={availableTodayTab === 'availableVehicles' ? 'action-btn-outline-transport-hr' : 'action-btn-secondary-transport-hr'}
                onClick={() => setAvailableTodayTab('availableVehicles')}
              >
                Available Vehicles
              </button>
            </div>
          </div>

          {availableTodayTab === 'additional' ? (
            <PoolVehicleTasksPanel />
          ) : null}

          {availableTodayTab === 'assignVehicle' ? (
            <div className="details-table-panel-body-transport-hr">
              <p className="quick-add-modal-hint-transport-hr" style={{ marginBottom: 10 }}>
                Operational assignments use pool vehicles only (vehicle category = Pool).
              </p>
              <div className="assign-vehicle-toolbar-transport-hr">
                <label className="assign-vehicle-date-label-transport-hr" htmlFor="assign-vehicle-date-input">
                  Assignment Date
                </label>
                <input
                  id="assign-vehicle-date-input"
                  type="date"
                  value={transportAssignmentDate}
                  onChange={(e) => setTransportAssignmentDate(e.target.value)}
                  className="assign-vehicle-date-input-transport-hr"
                />
              </div>
              {loadingTransportArrangementList ? (
                <div className="pilot-assignment-teams-loading-pilotsassign">
                  <Bars height="32" width="32" color="#003057" ariaLabel="bars-loading" visible />
                  <span>Loading assignment list...</span>
                </div>
              ) : (
                <div className="details-table-scroll-transport-hr">
                  <table className="details-table-transport-hr">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Assignment</th>
                        <th>Pilot Team</th>
                        <th>Current Transport</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transportSelectedDateRows.map((row) => (
                        <tr key={`${row.assignment_id}-${row.day_label}`}>
                          <td>{formatApiDateYmd(row.assignment_day) || '-'}</td>
                          <td>
                            <div>{row.assignment_id}</div>
                            <small style={{ color: '#64748b' }}>{row.estate_summary || '-'}</small>
                          </td>
                          <td>{row.team_name} {row.pilot_names ? `· ${row.pilot_names}` : ''}</td>
                          <td>
                            {row.driver_id
                              ? `${row.transport_driver_name || row.driver_id} · ${row.transport_vehicle_no || '—'} · ${formatTransportTimeDisplay(row.driver_arrival_time)}`
                              : 'No driver/vehicle assigned'}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="action-btn-outline-transport-hr"
                              onClick={() => openTransportDetail(row)}
                            >
                              {row.editable_transport ? 'Arrange' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!transportSelectedDateRows.length ? (
                        <tr>
                          <td colSpan={5}>No transport assignments for selected date.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : availableTodayTab === 'availableVehicles' ? (
            <div className="details-table-panel-body-transport-hr">
            <p className="quick-add-modal-hint-transport-hr" style={{ marginBottom: 10 }}>
              Available pool vehicle–driver pairs for today (assign-category vehicles are excluded).
            </p>
            <div className="details-table-scroll-transport-hr">
            <table className="details-table-transport-hr">
              <thead>
                <tr>
                  <th>Vehicle No</th>
                  <th>Driver</th>
                  <th>Category</th>
                  <th>Make / Model</th>
                </tr>
              </thead>
              <tbody>
                {availableVehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.vehicle_no}</td>
                    <td>{vehicle.assigned_driver_name}</td>
                    <td>{vehicle.vehicle_category_name || '-'}</td>
                    <td>{vehicle.make || '-'} / {vehicle.model || '-'}</td>
                  </tr>
                ))}
                {!availableVehicles.length ? (
                  <tr>
                    <td colSpan={4}>No available pool vehicle-driver pairs for today.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
            </div>
          ) : null}

          {showTransportDetailModal ? (
            <div className="pilot-assignment-teams-modal-overlay-pilotsassign" onClick={closeTransportDetailModal}>
              <div className="pilot-assignment-transport-modal-pilotsassign" onClick={(e) => e.stopPropagation()}>
                <div className="pilot-assignment-teams-modal-header-pilotsassign">
                  <span className="pilot-assignment-transport-back-spacer-pilotsassign" />
                  <h2 className="pilot-assignment-teams-modal-title-pilotsassign">Driver &amp; vehicle</h2>
                  <button type="button" className="pilot-assignment-teams-modal-close-pilotsassign" onClick={closeTransportDetailModal}>
                    ×
                  </button>
                </div>
                <div className="pilot-assignment-transport-body-pilotsassign">
                  <TransportAssignmentFields
                    assignmentIdLabel={transportDetailAssignmentId}
                    editable={transportEditable}
                    loading={loadingTransportOptions}
                    transportOptions={transportOptions}
                    form={transportForm}
                    onFieldChange={updateTransportField}
                    showSaveButton
                    savingTransport={savingTransport}
                    onSave={onSaveTransport}
                    poolVehiclesOnly
                    viewOnlyHint={
                      !transportEditable
                        ? 'View only: assignment is locked (driver started day or date outside edit window).'
                        : null
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      );
    }
    if (detailModule === 'rentApprovals') return <VehicleRentApprovals embedded />;
    if (detailModule === 'advanceApprovals') return <DriverAdvanceApprovals embedded />;
    if (detailModule === 'fuelApprovals') return <FuelApprovals embedded />;
    if (detailModule === 'leaveDates') return <DriverLeaveDatesHr embedded />;
    if (detailModule === 'vehicleAdminVehicles') {
      return (
        <div className="details-table-wrap-transport-hr details-table-wrap-transport-hr--scroll">
          <p className="quick-add-modal-hint-transport-hr" style={{ marginBottom: 10, flexShrink: 0 }}>
            Fuel cards are assigned per vehicle (not per driver). Use Assign card to link the vehicle&apos;s fuel card.
          </p>
          <div className="details-table-scroll-transport-hr">
          <table className="details-table-transport-hr">
            <thead>
              <tr>
                <th>Vehicle No</th>
                <th>Driver</th>
                <th>Fuel card</th>
                <th>Ownership</th>
                <th>Category</th>
                <th>Make / Model</th>
                <th>Owner Details</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((row) => (
                <tr key={row.id}>
                  <td>{row.vehicle_no || '-'}</td>
                  <td>{row.assigned_driver_name || '-'}</td>
                  <td>{row.linked_card_no_masked || (row.linked_card_id ? `Card #${row.linked_card_id}` : '—')}</td>
                  <td>{row.ownership === 'r' ? 'Rented' : row.ownership === 'o' ? 'Own' : '-'}</td>
                  <td>{row.vehicle_category_name || '-'}</td>
                  <td>{row.make || '-'} / {row.model || '-'}</td>
                  <td>
                    {row.ownership === 'r'
                      ? `${row.owner_name || '-'}${row.owner_contact_no ? ` (${row.owner_contact_no})` : ''}`
                      : '-'}
                  </td>
                  <td>{Number(row.activated) === 1 ? 'Active' : 'Inactive'}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="action-btn-secondary-transport-hr"
                      onClick={() =>
                        setVehicleCardModal({
                          open: true,
                          row,
                          cardId: row.card_id != null ? String(row.card_id) : row.linked_card_id != null ? String(row.linked_card_id) : '',
                        })
                      }
                    >
                      Fuel card
                    </button>
                    {row.ownership !== 'r' ? (
                      <button
                        type="button"
                        className="action-btn-secondary-transport-hr"
                        onClick={() =>
                          setVehicleDriverModal({
                            open: true,
                            row,
                            driverId: row.driver != null ? String(row.driver) : '',
                          })
                        }
                      >
                        Set driver
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!vehicles.length ? (
                <tr>
                  <td colSpan={10}>No vehicle records found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      );
    }
    if (detailModule === 'vehicleAdminMaintenance' || detailModule === 'maintenanceApprovals') {
      return (
        <div className="details-table-wrap-transport-hr details-table-wrap-transport-hr--scroll">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10, flexShrink: 0 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>Month</span>
              <select value={maintenanceMonthFilter} onChange={(e) => setMaintenanceMonthFilter(e.target.value)}>
                <option value="">All months</option>
                {maintenanceMonthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}{opt.value === monthKey ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>Status</span>
              <select value={maintenanceStatusFilter} onChange={(e) => setMaintenanceStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="p">Pending</option>
                <option value="a">Approved</option>
                <option value="d">Declined</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>Vehicle</span>
              <select value={maintenanceVehicleFilter} onChange={(e) => setMaintenanceVehicleFilter(e.target.value)}>
                <option value="all">All</option>
                {maintenanceVehicleOptions.map((vehicleNo) => (
                  <option key={vehicleNo} value={vehicleNo}>{vehicleNo}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, minWidth: 220 }}>
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>Search</span>
              <input
                type="text"
                value={maintenanceSearch}
                onChange={(e) => setMaintenanceSearch(e.target.value)}
                placeholder="Request ID / Vehicle / Driver / Category"
              />
            </label>
          </div>
          <div className="details-table-scroll-transport-hr">
          <table className="details-table-transport-hr">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Category</th>
                <th>Description</th>
                <th>Incident Image</th>
                <th>Bill Image</th>
                <th>Finance Status</th>
                <th>Paid</th>
                <th>Paid Receipt</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaintenanceRequests.map((row) => (
                <tr key={row.id}>
                  {(() => {
                    const damageUrls = resolveMaintenanceImageCandidates(row, 'damage');
                    const billUrls = resolveMaintenanceImageCandidates(row, 'bill');
                    const receiptUrls = resolveMaintenanceImageCandidates(row, 'receipt');
                    return (
                      <>
                  <td>{row.id}</td>
                  <td>{toDateOnly(row.date)}</td>
                  <td>{row.vehicle_no || row.vehicle || '-'}</td>
                  <td>{row.driver_name || row.driver || '-'}</td>
                  <td>{row.category_name || row.category || '-'}</td>
                  <td>{String(row?.description || '').trim() || '-'}</td>
                  <td>
                    {damageUrls.length ? (
                      <button
                        type="button"
                        className="image-view-btn-maintenance-approv"
                        onClick={() => openImagePreview(damageUrls, `Incident Image - Request #${row.id}`)}
                      >
                        View
                      </button>
                    ) : (
                      <span className="image-empty-maintenance-approv">-</span>
                    )}
                  </td>
                  <td>
                    {billUrls.length ? (
                      <button
                        type="button"
                        className="image-view-btn-maintenance-approv"
                        onClick={() => openImagePreview(billUrls, `Bill Image - Request #${row.id}`)}
                      >
                        View
                      </button>
                    ) : (
                      <span className="image-empty-maintenance-approv">-</span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const fin = String(row?.finance_approval || 'p').toLowerCase();
                      if (fin === 'a') return <span className="finance-status-maintenance-approv finance-status-maintenance-approv--approved">Approved</span>;
                      if (fin === 'd') return <span className="finance-status-maintenance-approv finance-status-maintenance-approv--declined">Declined</span>;
                      return <span className="finance-status-maintenance-approv finance-status-maintenance-approv--pending">Pending</span>;
                    })()}
                  </td>
                  <td>{Number(row?.finance_paid || 0) === 1 ? 'Yes' : 'No'}</td>
                  <td>
                    {Number(row?.finance_paid || 0) === 1 ? (
                      receiptUrls.length ? (
                        <button
                          type="button"
                          className="image-view-btn-maintenance-approv"
                          onClick={() => openImagePreview(receiptUrls, `Paid Receipt - Request #${row.id}`)}
                        >
                          View
                        </button>
                      ) : (
                        <span className="image-empty-maintenance-approv">-</span>
                      )
                    ) : (
                      <span className="image-empty-maintenance-approv">-</span>
                    )}
                  </td>
                  <td>
                    {String(row?.hr_approval || row?.approval || 'p') === 'p' ? (
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          type="button"
                          className="action-btn-outline-transport-hr"
                          disabled={savingHrDecision}
                          onClick={() => openHrDecisionModal(row, 'a')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="action-btn-secondary-transport-hr"
                          disabled={savingHrDecision}
                          onClick={() => openHrDecisionModal(row, 'd')}
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          color: String(row?.hr_approval || row?.approval || 'p') === 'a' ? '#166534' : '#991b1b',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {String(row?.hr_approval || row?.approval || 'p') === 'a' ? 'Approved' : 'Declined'}
                      </span>
                    )}
                  </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
              {!filteredMaintenanceRequests.length ? (
                <tr>
                  <td colSpan={12}>No maintenance requests for selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      );
    }
    return null;
  };

  const showInitialLoading = !initialLoadComplete && isPrimaryLoading;
  const activeDetailMeta = MODULE_META.find((item) => item.key === detailModule) || null;

  if (showInitialLoading) {
    return (
      <div className="dashboard-shell-transport-hr">
        <div className="dashboard-loading-overlay-transport-hr" role="status" aria-live="polite">
          <div className="dashboard-loading-content-transport-hr">
            <Bars color="#004B71" height={60} width={80} />
            <p>Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (detailModule === 'vehicleManagement') {
    return (
      <div className="dashboard-shell-transport-hr dashboard-shell-transport-hr--vehicle-mgmt">
        <VehicleManagement
          onBack={closeVehicleManagement}
          onVehiclesChanged={() => {
            refetchVehicles();
            refetchDrivers();
          }}
        />
      </div>
    );
  }

  if (showStandaloneDetail) {
    const ActiveIcon = activeDetailMeta?.icon || FaTools;
    return (
      <div className="dashboard-shell-transport-hr dashboard-shell-transport-hr--standalone">
        <div className="standalone-details-card-transport-hr">
          <div className="standalone-details-header-transport-hr">
            <div className="standalone-details-title-transport-hr">
              <button className="action-btn-secondary-transport-hr standalone-back-btn-transport-hr" type="button" onClick={() => setDetailModule(null)}>
                Back
              </button>
              <ActiveIcon />
              <strong>{activeDetailMeta?.title || 'Details'}</strong>
            </div>
          </div>
          <div className="standalone-details-body-transport-hr">{renderDetailsContent()}</div>
        </div>
        {renderHrDecisionModal()}
        {renderHrDecisionNoticeModal()}
        {renderImagePreviewModal()}
      <FuelPricesModal open={fuelPricesModalOpen} onClose={() => setFuelPricesModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="dashboard-shell-transport-hr">
      <div className="dashboard-header-card-transport-hr">
        <div className="dashboard-header-row-transport-hr">
          <div className="dashboard-header-text-transport-hr">
            <h3 className="dashboard-title-transport-hr">Transport Operations Dashboard</h3>
            <p className="dashboard-subtitle-transport-hr">
              Professional command center for approvals, leave planning, and daily distance intelligence.
            </p>
          </div>
          <div className="dashboard-header-actions-transport-hr">
            <button
              type="button"
              className="action-btn-outline-transport-hr"
              onClick={() => setFuelPricesModalOpen(true)}
            >
              <FaGasPump size={13} style={{ marginRight: 6, verticalAlign: '-0.1em' }} />
              Fuel Prices
            </button>
            <button
              type="button"
              className="action-btn-outline-transport-hr"
              onClick={openVehicleManagement}
            >
              Vehicle Management
            </button>
          </div>
        </div>
      </div>

      <div className="km-chart-card-transport-hr">
        <div className="km-chart-head-transport-hr">
          <div className="km-chart-title-wrap-transport-hr">
            <FaChartLine />
            <div>
              <h4>Daily KM Overview</h4>
              <p>
                {monthLabelFromYearMonth(effectiveChartMonth)}
                {chartVehicleNo ? ` • ${chartVehicleNo}` : ' • All vehicles'}
                {` • ${chartOwnershipLabel}`}
                {!chartVehicleNo ? ` • ${chartViewMode === 'separate' ? 'All separate' : 'All in one'}` : ''}
              </p>
            </div>
          </div>
          <div className="km-chart-filters-transport-hr">
            <label>
              Month
              <select value={chartMonth} onChange={(e) => setChartMonth(e.target.value)}>
                <option value="">Current ({monthLabelFromYearMonth(monthKey)})</option>
                {rollingMonthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label>
              Vehicle
              <select value={chartVehicleNo} onChange={(e) => setChartVehicleNo(e.target.value)}>
                <option value="">All Vehicles</option>
                {chartVehicleOptions.map((vehicleNo) => (
                  <option key={vehicleNo} value={vehicleNo}>{vehicleNo}</option>
                ))}
              </select>
            </label>
            <label>
              Ownership
              <select
                value={chartOwnershipFilter}
                onChange={(e) => setChartOwnershipFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="own">Own</option>
                <option value="rented">Rented</option>
              </select>
            </label>
            <label>
              Display
              <select
                value={chartViewMode}
                onChange={(e) => setChartViewMode(e.target.value)}
                disabled={!isAllVehiclesView}
                title={isAllVehiclesView ? 'Choose how all-vehicle data should display' : 'Display mode is for All Vehicles only'}
              >
                <option value="combined">All</option>
                <option value="separate">Separate</option>
              </select>
            </label>
            <button
              type="button"
              className="action-btn-outline-transport-hr km-chart-download-btn-transport-hr"
              onClick={downloadKmChartExcel}
              disabled={loadingKmVehicleChart || !chartVehicleSeriesRows.length}
              title="Download vehicle-wise daily KM data to Excel"
            >
              <FaDownload size={13} style={{ marginRight: 6 }} />
              Download Excel
            </button>
          </div>
        </div>
        <div className="km-chart-stats-transport-hr">
          <div>
            <strong>{loadingKmChart ? '-' : chartTotals.totalKm}</strong>
            <span>Total KM</span>
          </div>
          <div>
            <strong>{loadingKmChart ? '-' : chartTotals.activeDays}</strong>
            <span>Active Days</span>
          </div>
          <div>
            <strong>{loadingKmChart ? '-' : chartTotals.peakKm}</strong>
            <span>Peak Day KM</span>
          </div>
          <div>
            <strong>{loadingKmChart ? '-' : (toDateOnly(chartTotals.peakDate) || '-')}</strong>
            <span>Peak Date</span>
          </div>
        </div>
        <div className="km-chart-canvas-transport-hr">
          {isChartLoading ? (
            <div className="km-chart-loading-transport-hr">
              <Bars color="#004B71" height={42} width={62} />
              <p>Loading daily KM data...</p>
            </div>
          ) : shouldShowSeparateChart ? (
            chartDataSeparate.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartDataSeparate} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d7e3ec" />
                  <XAxis dataKey="dayLabel" tick={{ fontSize: 12, fill: '#4b5d6b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#4b5d6b' }} />
                  <Tooltip
                    formatter={(value, name) => [`${Number(value || 0).toFixed(1)} km`, String(name || 'Vehicle')]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload;
                      return row?.date ? `Date: ${toDateOnly(row.date)}` : '';
                    }}
                  />
                  <Legend />
                  {chartVehicleSeriesKeys.map((vehicleNo, idx) => (
                    <Line
                      key={vehicleNo}
                      type="monotone"
                      dataKey={vehicleNo}
                      name={vehicleNo}
                      stroke={getSeriesColor(idx)}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="km-chart-empty-transport-hr">No KM records found for the selected period.</div>
            )
          ) : chartData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="kmAreaColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004B71" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#004B71" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7e3ec" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 12, fill: '#4b5d6b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#4b5d6b' }} />
                <Tooltip
                  formatter={(value) => [`${Number(value || 0).toFixed(1)} km`, 'Total KM']}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload;
                    return row?.date ? `Date: ${toDateOnly(row.date)}` : '';
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="total_km" name="KM per Day" stroke="#004B71" fill="url(#kmAreaColor)" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="km-chart-empty-transport-hr">No KM records found for the selected period.</div>
          )}
        </div>
      </div>

      <div className="summary-grid-transport-hr">
        <div
          className="summary-card-transport-hr summary-card-clickable-transport-hr summary-card-transport-hr--compact"
          role="button"
          tabIndex={0}
          onClick={() => setDetailModule('availableToday')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailModule('availableToday');
            }
          }}
        >
          <div className="summary-head-transport-hr">
            <FaCheckCircle color="#0f766e" />
            <strong>Available Today</strong>
          </div>
          <div className="metric-chip-row-transport-hr">
            <span className="metric-chip-transport-hr">
              Pending assign: {loadingTransportArrangementList ? '-' : pendingVehicleAssignmentCount}
            </span>
            
            <span className="metric-chip-transport-hr">
              Available pairs: {loadingVehicles || loadingLeaves ? '-' : availableVehicles.length}
            </span>
          </div>
        </div>

        <div
          className="summary-card-transport-hr summary-card-clickable-transport-hr"
          role="button"
          tabIndex={0}
          onClick={() => setDetailModule('maintenanceApprovals')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailModule('maintenanceApprovals');
            }
          }}
        >
          <div className="summary-head-transport-hr">
            <FaTools color="#0f766e" />
            <strong>Maintenance Approvals</strong>
          </div>
          <div className="metric-chip-row-transport-hr">
            <span className="metric-chip-transport-hr">Pending: {loadingMaintenance ? '-' : maintenanceStats.pending}</span>
            <span className="metric-chip-transport-hr">Approved: {loadingMaintenance ? '-' : maintenanceStats.approved}</span>
            <span className="metric-chip-transport-hr">Declined: {loadingMaintenance ? '-' : maintenanceStats.declined}</span>
          </div>
        </div>

        <div
          className="summary-card-transport-hr summary-card-clickable-transport-hr"
          role="button"
          tabIndex={0}
          onClick={() => setDetailModule('fuelApprovals')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailModule('fuelApprovals');
            }
          }}
        >
          <div className="summary-head-transport-hr">
            <FaGasPump color="#b45309" />
            <strong>Fuel Approvals</strong>
          </div>
          <div className="metric-chip-row-transport-hr">
            <span className="metric-chip-transport-hr">
              Pending: {loadingFuel ? '-' : fuelPendingRows.length}
            </span>
            <span className="metric-chip-transport-hr">
              Pending total: LKR {loadingFuel ? '-' : fuelPendingTotal.toFixed(2)}
            </span>
          </div>
        </div>

        <div
          className="summary-card-transport-hr summary-card-clickable-transport-hr"
          role="button"
          tabIndex={0}
          onClick={() => setDetailModule('rentApprovals')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailModule('rentApprovals');
            }
          }}
        >
          <div className="summary-head-transport-hr">
            <FaCarSide color="#1d4ed8" />
            <strong>Rent Approvals</strong>
          </div>
          <div className="metric-chip-row-transport-hr">
            <span className="metric-chip-transport-hr">Pending: {loadingRent ? '-' : rentStats.pending}</span>
            <span className="metric-chip-transport-hr">Approved: {loadingRent ? '-' : rentStats.approved}</span>
            <span className="metric-chip-transport-hr">Declined: {loadingRent ? '-' : rentStats.declined}</span>
          </div>
        </div>

        <div
          className="summary-card-transport-hr summary-card-clickable-transport-hr"
          role="button"
          tabIndex={0}
          onClick={() => setDetailModule('advanceApprovals')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailModule('advanceApprovals');
            }
          }}
        >
          <div className="summary-head-transport-hr">
            <FaMoneyBillWave color="#0f766e" />
            <strong>Advance Approvals</strong>
          </div>
          <div className="metric-chip-row-transport-hr">
            <span className="metric-chip-transport-hr">Pending: {loadingAdvance ? '-' : advanceStats.pending}</span>
            <span className="metric-chip-transport-hr">Approved: {loadingAdvance ? '-' : advanceStats.approved}</span>
            <span className="metric-chip-transport-hr">Declined: {loadingAdvance ? '-' : advanceStats.declined}</span>
          </div>
        </div>

        <div
          className="summary-card-transport-hr summary-card-clickable-transport-hr"
          role="button"
          tabIndex={0}
          onClick={() => setDetailModule('leaveDates')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDetailModule('leaveDates');
            }
          }}
        >
          <div className="summary-head-transport-hr">
            <FaCalendarAlt color="#7c3aed" />
            <strong>Driver Leave Dates</strong>
          </div>
          <div className="metric-chip-row-transport-hr">
            <span className="metric-chip-transport-hr">Today on leave: {loadingLeaves ? '-' : leaveTodayCount}</span>
            <span className="metric-chip-transport-hr">This month: {loadingLeaves ? '-' : leaveRows.length}</span>
          </div>
        </div>

      </div>

      <div className="vehicle-admin-panel-transport-hr">
        <div className="vehicle-admin-head-transport-hr">
          <div className="vehicle-admin-title-wrap-transport-hr">
            <FaTools color="#334155" />
            <h3 className="vehicle-admin-title-transport-hr">Vehicle Admin Overview</h3>
          </div>
        </div>

        <div className="vehicle-admin-stats-grid-transport-hr">
          <button
            type="button"
            className="vehicle-admin-stat-card-transport-hr vehicle-admin-stat-card-clickable-transport-hr"
            onClick={openVehicleManagement}
          >
            <div className="vehicle-admin-stat-label-row-transport-hr">
              <FaCarSide size={12} />
              <div className="vehicle-admin-stat-label-transport-hr">Total Vehicles</div>
            </div>
            <div className="vehicle-admin-stat-value-transport-hr">{loadingVehicles ? '-' : vehicles.length}</div>
            <div className="vehicle-admin-stat-sub-transport-hr">
              <div className="vehicle-admin-stat-sub-row-transport-hr">
                <span>Active</span>
                <strong>{loadingVehicles ? '-' : activeVehiclesCount}</strong>
              </div>
              <div className="vehicle-admin-stat-sub-row-transport-hr">
                <span>Inactive</span>
                <strong>{loadingVehicles ? '-' : inactiveVehiclesCount}</strong>
              </div>
              <div className="vehicle-admin-stat-sub-row-transport-hr">
                <span>Assigned</span>
                <strong>{loadingVehicles ? '-' : assignedVehicleCount}</strong>
              </div>
            </div>
          </button>
          <button
            type="button"
            className="vehicle-admin-stat-card-transport-hr vehicle-admin-stat-card-clickable-transport-hr"
            onClick={() => setDetailModule('vehicleAdminMaintenance')}
          >
            <div className="vehicle-admin-stat-label-row-transport-hr">
              <FaTools size={12} />
              <div className="vehicle-admin-stat-label-transport-hr">Pending Maintenance</div>
            </div>
            <div className="vehicle-admin-stat-value-transport-hr">{loadingMaintenance ? '-' : pendingMaintenanceCount}</div>
            <div className="vehicle-admin-stat-sub-transport-hr">
              <div className="vehicle-admin-stat-sub-row-transport-hr">
                <span>This month</span>
                <strong>{loadingMaintenance ? '-' : currentMonthMaintenanceCount}</strong>
              </div>
              <div className="vehicle-admin-stat-sub-row-transport-hr">
                <span>Latest pending</span>
                <strong>{loadingMaintenance ? '-' : latestPendingMaintenance?.date ? formatApiDateYmd(latestPendingMaintenance.date) : 'None'}</strong>
              </div>
            </div>
          </button>
          <button
            type="button"
            className="vehicle-admin-stat-card-transport-hr vehicle-admin-stat-card-clickable-transport-hr"
            onClick={() => setDetailModule('availableToday')}
          >
            <div className="vehicle-admin-stat-label-row-transport-hr">
              <FaCheckCircle size={12} />
              <div className="vehicle-admin-stat-label-transport-hr">Available Pairs Today</div>
            </div>
            <ul className="vehicle-admin-stat-list-transport-hr">
              {(availableVehicles || []).slice(0, 4).map((row) => (
                <li key={row.id}>{row.vehicle_no} - {row.assigned_driver_name}</li>
              ))}
              {!availableVehicles.length ? <li>No active pair available.</li> : null}
            </ul>
          </button>
          <div
            className="vehicle-admin-stat-card-transport-hr vehicle-admin-stat-card-clickable-transport-hr"
            role="button"
            tabIndex={0}
            onClick={() => setDetailModule('leaveDates')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDetailModule('leaveDates');
              }
            }}
          >
            <div className="vehicle-admin-stat-card-head-row-transport-hr">
              <div className="vehicle-admin-stat-label-row-transport-hr">
                <FaCalendarAlt size={12} />
                <div className="vehicle-admin-stat-label-transport-hr">Recent Leave Requests</div>
              </div>
              <button
                type="button"
                className="highlight-view-more-transport-hr"
                onClick={(e) => {
                  e.stopPropagation();
                  openLeaveHistoryModal();
                }}
              >
                View more
              </button>
            </div>
            <ul className="vehicle-admin-stat-list-transport-hr">
              {recentLeaves.slice(0, 4).map((row) => (
                <li key={row.id || `${row.requested_by_name}-${row.leave_date}`}>
                  {toDateOnly(row.leave_date)} - {row.requested_by_name || '-'}
                </li>
              ))}
              {!recentLeaves.length ? <li>No leave requests this month.</li> : null}
            </ul>
          </div>
        </div>

      </div>

      {renderHrDecisionModal()}
      {renderHrDecisionNoticeModal()}

      {vehicleCardModal.open && vehicleCardModal.row ? (
        <div
          role="presentation"
          className="quick-add-overlay-transport-hr"
          onClick={closeVehicleCardModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="quick-add-modal-transport-hr"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="quick-add-modal-toolbar-transport-hr">
              <h3 className="quick-add-modal-title-transport-hr">
                Fuel card — {vehicleCardModal.row.vehicle_no || vehicleCardModal.row.id}
              </h3>
              <button type="button" className="action-btn-secondary-transport-hr" onClick={closeVehicleCardModal}>
                Close
              </button>
            </div>
            <div className="quick-add-modal-body-transport-hr">
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Fuel card</span>
                <select
                  value={vehicleCardModal.cardId}
                  onChange={(e) => setVehicleCardModal((prev) => ({ ...prev, cardId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {(fuelCards || []).map((card) => (
                    <option key={card.id} value={String(card.id)}>
                      {card.label || card.card_no_masked || `Card #${card.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="action-btn-primary-transport-hr"
                  disabled={savingVehicleCard}
                  onClick={submitVehicleCard}
                >
                  {savingVehicleCard ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {vehicleDriverModal.open && vehicleDriverModal.row ? (
        <div
          role="presentation"
          className="quick-add-overlay-transport-hr"
          onClick={closeVehicleDriverModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="quick-add-modal-transport-hr"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="quick-add-modal-toolbar-transport-hr">
              <h3 className="quick-add-modal-title-transport-hr">
                Set driver — {vehicleDriverModal.row.vehicle_no || vehicleDriverModal.row.id}
              </h3>
              <button type="button" className="action-btn-secondary-transport-hr" onClick={closeVehicleDriverModal}>
                Close
              </button>
            </div>
            <div className="quick-add-modal-body-transport-hr">
              <p className="quick-add-modal-hint-transport-hr" style={{ marginBottom: 10 }}>
                Assigning the same driver (vehicle_drivers record) to multiple vehicles lets them swap between vehicles in the app.
              </p>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>Driver</span>
                <select
                  value={vehicleDriverModal.driverId}
                  onChange={(e) => setVehicleDriverModal((prev) => ({ ...prev, driverId: e.target.value }))}
                >
                  <option value="">— None / Unassigned —</option>
                  {(vehicleDrivers || []).map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.user_name || d.name || `Driver #${d.id}`}
                      {d.mobile_no ? ` (${d.mobile_no})` : ''}
                      {Number(d.assigned_vehicle_count) > 0 ? ` — ${d.assigned_vehicle_count} vehicle(s)` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="action-btn-primary-transport-hr"
                  disabled={savingVehicleCard}
                  onClick={submitVehicleDriver}
                >
                  {savingVehicleCard ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {renderImagePreviewModal()}
      <FuelPricesModal open={fuelPricesModalOpen} onClose={() => setFuelPricesModalOpen(false)} />

      {leaveHistoryOpen && (
        <div
          role="presentation"
          className="quick-add-overlay-transport-hr"
          onClick={() => setLeaveHistoryOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transport-hr-leave-history-title"
            className="quick-add-modal-transport-hr leave-history-modal-transport-hr"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="quick-add-modal-toolbar-transport-hr leave-history-toolbar-transport-hr">
              <h3 id="transport-hr-leave-history-title" className="quick-add-modal-title-transport-hr">
                Driver leave requests — by month
              </h3>
              <div className="leave-history-toolbar-actions-transport-hr">
                <button
                  type="button"
                  className="action-btn-outline-transport-hr leave-history-excel-transport-hr"
                  onClick={downloadLeaveHistoryExcel}
                  disabled={
                    loadingLeaveByMonth ||
                    !displayedLeaveMonths.some((m) => (m.rows || []).length > 0)
                  }
                  title="Download rows currently shown (respects month filter) as Excel"
                >
                  <FaDownload size={14} style={{ marginRight: 6 }} />
                  Download Excel
                </button>
                <button
                  type="button"
                  className="action-btn-secondary-transport-hr"
                  onClick={() => setLeaveHistoryOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <p className="quick-add-modal-hint-transport-hr">
              Last 24 months of active leave records, grouped by calendar month (newest first).
              {leaveHistoryPayload.totalRows != null && !loadingLeaveByMonth
                ? ` ${leaveHistoryPayload.totalRows} total record(s) loaded.`
                : ''}
            </p>
            <div className="leave-history-filter-row-transport-hr">
              <label htmlFor="transport-hr-leave-month-filter" className="leave-history-filter-label-transport-hr">
                Month
              </label>
              <select
                id="transport-hr-leave-month-filter"
                className="leave-history-month-select-transport-hr"
                value={leaveMonthFilter}
                onChange={(e) => setLeaveMonthFilter(e.target.value)}
                disabled={loadingLeaveByMonth || leaveHistoryError}
              >
                <option value="">All months</option>
                {rollingMonthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="quick-add-modal-body-transport-hr leave-history-body-transport-hr">
              {leaveHistoryError ? (
                <p className="leave-history-empty-transport-hr">
                  Could not load leave history. Please try again.
                </p>
              ) : loadingLeaveByMonth ? (
                <p className="leave-history-loading-transport-hr">Loading leave history…</p>
              ) : !leaveHistoryMonths.length && !leaveMonthFilter ? (
                <p className="leave-history-empty-transport-hr">No leave records in this period.</p>
              ) : (
                displayedLeaveMonths.map((monthGroup) => (
                  <section key={monthGroup.yearMonth} className="leave-history-month-block-transport-hr">
                    <div className="leave-history-month-title-transport-hr">
                      {monthGroup.label}
                      <span className="leave-history-month-count-transport-hr">{monthGroup.count} day(s)</span>
                    </div>
                    <div className="leave-history-table-wrap-transport-hr">
                      <table className="leave-history-table-transport-hr">
                        <thead>
                          <tr>
                            <th>Leave date</th>
                            <th>Driver</th>
                            <th>Vehicle</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(monthGroup.rows || []).length ? (
                            (monthGroup.rows || []).map((row) => (
                              <tr key={row.id}>
                                <td>{toDateOnly(row.leave_date)}</td>
                                <td>{row.requested_by_name || '—'}</td>
                                <td>{row.vehicle_no || '—'}</td>
                                <td>{row.reason || '—'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="leave-history-table-empty-cell-transport-hr">
                                No leave records for this month.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-card-transport-hr">
        <div className="card-header-transport-hr">
          <strong>Transport Estimated KM (Today)</strong>
        </div>
        <div className="details-table-wrap-transport-hr">
          <table className="details-table-transport-hr">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Estimated KM</th>
                <th>Route Summary</th>
              </tr>
            </thead>
            <tbody>
              {hrTransportEstimates.map((row) => {
                const estimate = row.estimate || null;
                const routeSummary = Array.isArray(estimate?.route_points)
                  ? estimate.route_points.map((point) => point.label).join(' -> ')
                  : '-';
                return (
                  <tr key={row.assignment_id}>
                    <td>{row.assignment_id || '-'}</td>
                    <td>{row.driver_name || estimate?.driver_name || row.driver_id || '-'}</td>
                    <td>{row.vehicle_no || row.vehicle_id || '-'}</td>
                    <td>{estimate ? Number(estimate.total_estimated_km || 0).toFixed(3) : '-'}</td>
                    <td title={routeSummary}>{routeSummary}</td>
                  </tr>
                );
              })}
              {!hrTransportEstimates.length ? (
                <tr>
                  <td colSpan={5}>No assigned transport estimates for today.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {detailModule && !SUMMARY_DETAIL_KEYS.has(detailModule) && (
        <div
          role="presentation"
          onClick={() => setDetailModule(null)}
          className="details-overlay-transport-hr"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="details-modal-transport-hr"
          >
            <div className="details-header-transport-hr">
              <div className="details-header-title-transport-hr">
                {MODULE_META.map((item) => {
                  if (item.key !== detailModule) return null;
                  const Icon = item.icon;
                  return (
                    <React.Fragment key={item.key}>
                      <Icon />
                      <strong>{item.title}</strong>
                    </React.Fragment>
                  );
                })}
              </div>
              <button className="action-btn-secondary-transport-hr" type="button" onClick={() => setDetailModule(null)}>Close</button>
            </div>
            {renderDetailsContent()}
          </div>
        </div>
      )}
    </div>
  );
}

export default TransportHrDashboard;
