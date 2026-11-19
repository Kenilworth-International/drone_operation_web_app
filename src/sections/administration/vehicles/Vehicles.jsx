import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaBoxes,
  FaSearch,
  FaEdit,
  FaEye,
  FaPlane,
  FaCar,
  FaBolt,
  FaBatteryFull,
  FaGamepad,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
} from 'react-icons/fa';
import '../../../styles/assets.css';
import '../../../styles/vehicleProfile.css';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { useGetWingsQuery, useGetBatteryTypesQuery, useGetVehicleDriversQuery, useGetVehicleCategoriesQuery, useGetVehicleMakesQuery, useGetVehicleModelsQuery, useGetFuelCategoriesQuery } from '../../../api/services/assetsApi';
import VehicleMasterSelectFields, {
  resolveVehicleMasterIds,
  vehicleMasterLabelsFromIds,
} from '../../../components/VehicleMasterSelectFields';
import {
  formatVehiclePoolCategory,
  normalizeVehiclePoolCategory,
  VEHICLE_POOL_CATEGORY_OPTIONS,
} from '../../../utils/vehiclePoolCategory';
import {
  fetchInsuranceTypes,
  fetchAssets as fetchAssetsThunk,
  updateAsset as updateAssetThunk,
  setActiveTab as setActiveTabAction,
  setSearchTerm as setSearchTermAction,
  setStatusFilter as setStatusFilterAction,
  setVehicleOwnershipFilter as setVehicleOwnershipFilterAction,
  setSelectedAsset as setSelectedAssetAction,
  clearSelectedAsset,
  selectActiveTab,
  selectCurrentAssets,
  selectAssets,
  selectInsuranceTypes,
  selectSearchTerm,
  selectStatusFilter,
  selectVehicleOwnershipFilter,
  selectSelectedAsset,
  selectSelectedAssetType,
  selectLoading,
  selectError,
} from '../../../store/slices/assetsSlice';
import VehicleProfile from '../vehicle-profile/VehicleProfile';

const TAB_ORDER = ['drones', 'vehicles', 'generators', 'batteries', 'remoteControls'];

const TAB_CONFIG = {
  drones: {
    label: 'Drones',
    icon: FaPlane,
    responseKeys: ['drones']
  },
  vehicles: {
    label: 'Vehicles',
    icon: FaCar,
    responseKeys: ['vehicles']
  },
  generators: {
    label: 'Generators',
    icon: FaBolt,
    responseKeys: ['generators']
  },
  batteries: {
    label: 'Batteries',
    icon: FaBatteryFull,
    responseKeys: ['battery', 'batteries']
  },
  remoteControls: {
    label: 'Remote Controls',
    icon: FaGamepad,
    responseKeys: ['remote_controls', 'remote_control', 'remotes']
  }
};

const DEFAULT_WING_NAME = 'Not Available';

const parsePurchasePrice = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const cleaned = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
  if (cleaned === '') {
    return null;
  }
  const parsed = Number.parseFloat(cleaned);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Number(parsed.toFixed(2));
};

const sanitizeDecimalInput = (value) => {
  const input = String(value ?? '');
  const withoutCommas = input.replace(/,/g, '');
  const numeric = withoutCommas.replace(/[^\d.]/g, '');
  const firstDotIndex = numeric.indexOf('.');
  if (firstDotIndex === -1) {
    return numeric;
  }
  const integerPart = numeric.slice(0, firstDotIndex);
  const decimalPart = numeric.slice(firstDotIndex + 1).replace(/\./g, '');
  return `${integerPart}.${decimalPart}`;
};

const formatCurrencyInput = (value) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const sanitized = sanitizeDecimalInput(value);
  if (!sanitized) {
    return '';
  }
  const [integerPartRaw, decimalPart] = sanitized.split('.');
  const integerPart = integerPartRaw || '0';
  const formattedInteger = Number.parseInt(integerPart, 10).toLocaleString('en-US');
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
};

const formatCurrency = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'Not Available';
  }
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return 'Not Available';
  }
  return `LKR ${parsed.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const resolveWingValue = (asset) =>
  asset?.wing ??
  asset?.wing_name ??
  asset?.wingName ??
  asset?.wing_title ??
  asset?.sector ??
  asset?.sector_name ??
  asset?.sectorName ??
  asset?.sector_title ??
  '';

const extractWingId = (asset) => {
  // vehicles table stores wing FK in `wing`; other assets may use wing_id / sector_id
  const candidates = [
    asset?.wing_id,
    asset?.wingId,
    asset?.wingID,
    asset?.wing,
    asset?.sector_id,
    asset?.sectorId,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === '') {
      continue;
    }
    const parsed = Number.parseInt(candidate, 10);
    if (!Number.isNaN(parsed)) {
      return String(parsed);
    }
  }
  return '';
};

const parseWingId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : String(parsed);
};

const INITIAL_FORM_STATE = {
  id: '',
  tag: '',
  serial: '',
  type: '',
  make: '',
  model: '',
  purchase_price: '',
  manufacture_year: '',
  depreciation_period: '',
  have_insurance: '0',
  insurance_type: '',
  warranty_period: '',
  operational_status: 'y',
  activated: '1',
  wing_id: ''
};

const formatDateForInput = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};

/** YYYY-MM-DD for insurance / revenue license expiry checks */
const toDateKey = (value) => {
  const formatted = formatDateForInput(value);
  return formatted || null;
};

const todayDateKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Add calendar months to a YYYY-MM-DD key (approximate month = same day + n months) */
const addMonthsToDateKey = (dateKey, months) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, d);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
};

/** expired = past date; soon = within next 30 days (inclusive) */
const getDocExpiryUrgency = (dateValue) => {
  const key = toDateKey(dateValue);
  if (!key) return 'unknown';
  const today = todayDateKey();
  if (key < today) return 'expired';
  const withinMonth = addMonthsToDateKey(today, 1);
  if (key <= withinMonth) return 'soon';
  return 'ok';
};

const DOC_URGENCY_RANK = { expired: 3, soon: 2, ok: 0, unknown: 0 };

const getVehicleExpirySortMeta = (asset) => {
  const ins = getDocExpiryUrgency(asset?.insurance_expire_date);
  const rev = getDocExpiryUrgency(asset?.revenue_license_expire_date);
  const priority = Math.max(DOC_URGENCY_RANK[ins] || 0, DOC_URGENCY_RANK[rev] || 0);
  const keys = [toDateKey(asset?.insurance_expire_date), toDateKey(asset?.revenue_license_expire_date)]
    .filter(Boolean)
    .sort();
  return { priority, earliest: keys[0] || '9999-12-31' };
};

const compareVehicleExpiryUrgency = (a, b) => {
  const ma = getVehicleExpirySortMeta(a);
  const mb = getVehicleExpirySortMeta(b);
  if (mb.priority !== ma.priority) return mb.priority - ma.priority;
  return ma.earliest.localeCompare(mb.earliest);
};

const renderExpiryDateCell = (dateValue) => {
  const urgency = getDocExpiryUrgency(dateValue);
  const display = formatDateForInput(dateValue) || '-';
  const cellClass =
    urgency === 'expired'
      ? 'assets-expiry-cell--expired'
      : urgency === 'soon'
        ? 'assets-expiry-cell--soon'
        : '';
  return (
    <td className={cellClass}>
      <span className="assets-expiry-date-text">{display}</span>
      {urgency === 'expired' ? <span className="assets-expiry-badge assets-expiry-badge--expired">Expired</span> : null}
      {urgency === 'soon' ? <span className="assets-expiry-badge assets-expiry-badge--soon">Due soon</span> : null}
    </td>
  );
};

const formatDateForApi = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (/^\d{4}$/.test(value)) {
    return `${value}-01-01`;
  }
  if (value.includes('-')) {
    const parts = value.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};

const formatActivated = (value) => {
  const normalized = typeof value === 'number' ? value : parseInt(value ?? 0, 10);
  return normalized === 1 ? 'Active' : 'Inactive';
};

const formatOperationalStatus = (value) => (value === 'y' ? 'Operational' : 'Not Operational');

const resolveInsuranceName = (insuranceOptions, id) => {
  if (!id) return '-';
  const option = insuranceOptions.find((item) => String(item.id) === String(id));
  return option ? option.type : String(id);
};

const resolveBatteryTypeName = (batteryTypes, id) => {
  if (!id) return '-';
  const type = batteryTypes.find((item) => String(item.id) === String(id));
  return type ? type.type : String(id);
};

const singularLabel = (label) => (label.endsWith('s') ? label.slice(0, -1) : label);

const formatOwnership = (value) => {
  if (value === 'o') return 'KWIL vehicle';
  if (value === 'r') return 'Rented';
  return value || '-';
};

const formatMakeModel = (make, model) => {
  const parts = [make, model].map((s) => String(s || '').trim()).filter(Boolean);
  return parts.length ? parts.join(' ') : '-';
};

const isVehicleRecord = (asset) =>
  asset != null && (asset.vehicle_no != null || asset.ownership != null);

const isMasterRowId = (value) => /^\d+$/.test(String(value ?? '').trim());

const formatVehicleDriverDisplay = (asset) => {
  const name = String(asset?.driver_name || '').trim();
  if (!name) return '-';
  const isPartTime = Number(asset?.driver_part_time ?? 0) === 1;
  const role = String(asset?.driver_job_role || '').trim().toLowerCase();
  const roleLabel =
    role === 'driex' ? 'External driver' : role === 'dri' ? 'Driver' : '';
  if (isPartTime && roleLabel) return `${name} · Part-time · ${roleLabel}`;
  if (isPartTime) return `${name} · Part-time driver`;
  if (roleLabel) return `${name} · ${roleLabel}`;
  return name;
};

const renderVehiclePersonCell = (primary, secondary) => {
  const primaryStr = String(primary ?? '').trim();
  const secondaryStr = String(secondary ?? '').trim();
  if (!primaryStr && !secondaryStr) return '-';
  if (primaryStr === '-' && !secondaryStr) return '-';
  return (
    <div className="vehicle-person-cell">
      {primaryStr && primaryStr !== '-' ? (
        <div className="vehicle-person-cell__primary">{primaryStr}</div>
      ) : null}
      {secondaryStr ? <div className="vehicle-person-cell__secondary">{secondaryStr}</div> : null}
    </div>
  );
};

const formatVehicleNoWithOwnership = (vehicleNo, ownership) => {
  const no = String(vehicleNo || '').trim();
  const own = formatOwnership(ownership);
  if (!no) return own !== '-' ? `(${own})` : '-';
  if (own === '-') return no;
  return `${no} (${own})`;
};

const Vehicles = ({ embeddedInVehicleManagement = false }) => {
  const dispatch = useAppDispatch();
  const singleMode = true;
  const selectedType = 'vehicles';
  const activeTab = 'vehicles';

  const assets = useAppSelector((state) => selectAssets(state, 'vehicles'));
  const insuranceOptions = useAppSelector(selectInsuranceTypes);
  const searchTerm = useAppSelector(selectSearchTerm);
  const statusFilter = useAppSelector(selectStatusFilter);
  const vehicleOwnershipFilter = useAppSelector(selectVehicleOwnershipFilter);
  const selectedAsset = useAppSelector(selectSelectedAsset);
  const selectedAssetType = useAppSelector(selectSelectedAssetType);
  const loading = useAppSelector(selectLoading);
  const error = useAppSelector(selectError);
  
  // Local state for UI
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileVehicleId, setProfileVehicleId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  const {
    data: wingsResponse,
    isLoading: wingsLoading,
    isError: wingsError,
    error: wingsErrorDetails,
  } = useGetWingsQuery();

  const {
    data: batteryTypesResponse,
    isLoading: batteryTypesLoading,
    isError: batteryTypesError,
  } = useGetBatteryTypesQuery();

  const {
    data: vehicleDriversResponse,
    isLoading: vehicleDriversLoading,
    isError: vehicleDriversError,
  } = useGetVehicleDriversQuery();

  const {
    data: fuelCategoriesResponse,
    isLoading: fuelCategoriesLoading,
  } = useGetFuelCategoriesQuery();

  const editCategoryId = formData.vehicle_category ? String(formData.vehicle_category) : '';
  const editMakeIdForQuery = isMasterRowId(formData.make) ? String(formData.make) : '';

  const isEditingVehicleAsset = selectedAssetType === 'vehicles';

  const { data: editCategoriesResponse, isLoading: editCategoriesLoading } = useGetVehicleCategoriesQuery(
    undefined,
    { skip: !showEditModal || !isEditingVehicleAsset }
  );

  const { data: editMakesResponse, isLoading: editMakesLoading } = useGetVehicleMakesQuery(
    { vehicle_category_id: editCategoryId || null },
    { skip: !showEditModal || !isEditingVehicleAsset || !editCategoryId }
  );
  const { data: editModelsResponse, isLoading: editModelsLoading } = useGetVehicleModelsQuery(
    { vehicle_make_id: editMakeIdForQuery || null },
    { skip: !showEditModal || !isEditingVehicleAsset || !editMakeIdForQuery }
  );

  const editVehicleCategories = useMemo(() => {
    if (!editCategoriesResponse) return [];
    if (Array.isArray(editCategoriesResponse)) return editCategoriesResponse;
    if (Array.isArray(editCategoriesResponse?.data)) return editCategoriesResponse.data;
    return [];
  }, [editCategoriesResponse]);

  const editVehicleMakes = useMemo(() => {
    if (!editMakesResponse) return [];
    if (Array.isArray(editMakesResponse)) return editMakesResponse;
    if (Array.isArray(editMakesResponse?.data)) return editMakesResponse.data;
    return [];
  }, [editMakesResponse]);

  const editVehicleModels = useMemo(() => {
    if (!editModelsResponse) return [];
    if (Array.isArray(editModelsResponse)) return editModelsResponse;
    if (Array.isArray(editModelsResponse?.data)) return editModelsResponse.data;
    return [];
  }, [editModelsResponse]);

  const editMasterResolvedRef = useRef(false);

  const wings = useMemo(() => {
    if (!wingsResponse) return [];
    if (Array.isArray(wingsResponse)) return wingsResponse;
    if (Array.isArray(wingsResponse?.data)) return wingsResponse.data;
    if (Array.isArray(wingsResponse?.wings)) return wingsResponse.wings;
    return [];
  }, [wingsResponse]);

  const batteryTypes = useMemo(() => {
    if (!batteryTypesResponse) return [];
    if (batteryTypesResponse?.status === 'true' || batteryTypesResponse?.status === true) {
      return batteryTypesResponse?.types || [];
    }
    if (Array.isArray(batteryTypesResponse)) return batteryTypesResponse;
    if (Array.isArray(batteryTypesResponse?.data)) return batteryTypesResponse.data;
    return [];
  }, [batteryTypesResponse]);

  // Filter vehicle drivers based on ownership type
  const internalDrivers = useMemo(() => {
    if (!vehicleDriversResponse) return [];
    let drivers = [];
    if (Array.isArray(vehicleDriversResponse)) {
      drivers = vehicleDriversResponse;
    } else if (Array.isArray(vehicleDriversResponse?.drivers)) {
      drivers = vehicleDriversResponse.drivers;
    } else if (Array.isArray(vehicleDriversResponse?.data)) {
      drivers = vehicleDriversResponse.data;
    }
    // For own vehicles: member_type = 'i' (internal)
    return drivers.filter(driver => driver.member_type === 'i' && driver.activated === 1);
  }, [vehicleDriversResponse]);

  const externalDrivers = useMemo(() => {
    if (!vehicleDriversResponse) return [];
    let drivers = [];
    if (Array.isArray(vehicleDriversResponse)) {
      drivers = vehicleDriversResponse;
    } else if (Array.isArray(vehicleDriversResponse?.drivers)) {
      drivers = vehicleDriversResponse.drivers;
    } else if (Array.isArray(vehicleDriversResponse?.data)) {
      drivers = vehicleDriversResponse.data;
    }
    // For rented vehicles: external member with dedicated external driver role, or legacy external + dri
    return drivers.filter((driver) => {
      const jr = String(driver.job_role || '').trim().toLowerCase();
      return (
        driver.member_type === 'e' &&
        (jr === 'driex' || jr === 'dri') &&
        driver.activated === 1
      );
    });
  }, [vehicleDriversResponse]);

  useEffect(() => {
    if (!showEditModal) {
      editMasterResolvedRef.current = false;
    }
  }, [showEditModal]);

  useEffect(() => {
    if (!showEditModal || !selectedAsset || !isEditingVehicleAsset || editMasterResolvedRef.current) return;
    if (editCategoriesLoading) return;

    const categoryId = String(
      selectedAsset.vehicle_category_id ??
        (isMasterRowId(selectedAsset.vehicle_category) ? selectedAsset.vehicle_category : '') ??
        editCategoryId ??
        ''
    ).trim();

    if (!categoryId) return;
    if (editMakesLoading) return;

    const makeResolved = resolveVehicleMasterIds(
      selectedAsset,
      editVehicleCategories,
      editVehicleMakes,
      []
    );

    if (!makeResolved.make && String(selectedAsset.make || '').trim() && editVehicleMakes.length === 0) {
      return;
    }

    const resolvedMakeId = makeResolved.make || '';

    if (resolvedMakeId && resolvedMakeId !== editMakeIdForQuery) {
      setFormData((prev) => ({
        ...prev,
        vehicle_category: makeResolved.vehicle_category || categoryId,
        make: resolvedMakeId,
        model: '',
      }));
      return;
    }

    if (resolvedMakeId && String(selectedAsset.model || '').trim()) {
      if (editModelsLoading) return;
      const full = resolveVehicleMasterIds(
        selectedAsset,
        editVehicleCategories,
        editVehicleMakes,
        editVehicleModels
      );
      if (!full.model && editVehicleModels.length === 0) return;

      editMasterResolvedRef.current = true;
      setFormData((prev) => ({
        ...prev,
        vehicle_category: full.vehicle_category || categoryId,
        make: full.make || resolvedMakeId,
        model: full.model || '',
      }));
      return;
    }

    editMasterResolvedRef.current = true;
    setFormData((prev) => ({
      ...prev,
      vehicle_category: makeResolved.vehicle_category || categoryId,
      make: resolvedMakeId,
      model: '',
    }));
  }, [
    showEditModal,
    selectedAsset,
    isEditingVehicleAsset,
    editCategoryId,
    editMakeIdForQuery,
    editCategoriesLoading,
    editMakesLoading,
    editModelsLoading,
    editVehicleCategories,
    editVehicleMakes,
    editVehicleModels,
  ]);

  const fuelCategories = useMemo(() => {
    if (!fuelCategoriesResponse) return [];
    // RTK Query returns the data directly from queryFn
    if (Array.isArray(fuelCategoriesResponse)) return fuelCategoriesResponse;
    // Fallback for nested structures
    if (Array.isArray(fuelCategoriesResponse?.data)) return fuelCategoriesResponse.data;
    return [];
  }, [fuelCategoriesResponse]);

  const wingIdToName = useMemo(() => {
    const map = new Map();
    wings.forEach((wing) => {
      if (wing?.id != null) {
        map.set(String(wing.id), wing.wing || '');
      }
    });
    return map;
  }, [wings]);

  const wingNameToId = useMemo(() => {
    const map = new Map();
    wings.forEach((wing) => {
      if (wing?.wing) {
        map.set(wing.wing.toLowerCase(), String(wing.id));
      }
    });
    return map;
  }, [wings]);

  const resolveWingNameById = useCallback(
    (id) => {
      if (id === undefined || id === null || id === '') {
        return '';
      }
      return wingIdToName.get(String(id)) || '';
    },
    [wingIdToName]
  );

  const formatWingDisplay = useCallback(
    (asset) => {
      const wingText = resolveWingValue(asset);
      // Convert to string if it's a number, then trim
      const trimmedWingText = wingText ? String(wingText).trim() : '';
      const isNumericWingText = trimmedWingText ? /^\d+$/.test(trimmedWingText) : false;
      if (trimmedWingText && !isNumericWingText) {
        return trimmedWingText;
      }
      const candidateId = extractWingId(asset) || (isNumericWingText ? trimmedWingText : '');
      if (candidateId) {
        const resolved = resolveWingNameById(candidateId);
        if (resolved) {
          return resolved;
        }
      }
      return trimmedWingText || DEFAULT_WING_NAME;
    },
    [resolveWingNameById]
  );

  const wingsErrorMessage = useMemo(() => {
    if (!wingsError) return '';
    if (typeof wingsErrorDetails === 'string') return wingsErrorDetails;
    if (wingsErrorDetails?.data?.message) return wingsErrorDetails.data.message;
    if (wingsErrorDetails?.error) return wingsErrorDetails.error;
    if (wingsErrorDetails?.message) return wingsErrorDetails.message;
    return 'Unable to load wings.';
  }, [wingsError, wingsErrorDetails]);

  useEffect(() => {
    if (!notification.message) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setNotification({ type: '', message: '' });
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [notification.message]);

  const maxVisibleTabs = 4;
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);

  const tabs = useMemo(
    () =>
      TAB_ORDER.map((key) => ({
        key,
        ...TAB_CONFIG[key]
      })),
    []
  );

  const visibleTabs = useMemo(
    () => tabs.slice(visibleStartIndex, visibleStartIndex + maxVisibleTabs),
    [tabs, visibleStartIndex]
  );

  const maxStartIndex = Math.max(0, tabs.length - maxVisibleTabs);
  const showPrevTabs = visibleStartIndex > 0;
  const showNextTabs = visibleStartIndex < maxStartIndex;

  const currentTabConfig = TAB_CONFIG[activeTab];
  const isBatteryTab = activeTab === 'batteries';
  const isVehicleTab = activeTab === 'vehicles';
  const isSelectedBattery = selectedAssetType === 'batteries';
  const isSelectedVehicle = selectedAssetType === 'vehicles';

  const mapAssetToForm = useCallback((asset) => {
    const extractedWingId = extractWingId(asset);
    let wingId = extractedWingId;
    if (!wingId) {
      const wingText = asset?.wing_name || resolveWingValue(asset);
      const matchedId = wingText ? wingNameToId.get(String(wingText).trim().toLowerCase()) : null;
      if (matchedId) {
        wingId = matchedId;
      }
    }

    return {
      id: asset?.id ?? '',
      tag: asset?.tag ?? '',
      serial: asset?.serial ?? '',
      type: asset?.type ?? '',
      ownership: asset?.ownership ?? '',
      vehicle_pool_category: normalizeVehiclePoolCategory(asset?.vehicle_pool_category),
      chassis_no: asset?.chassis_no ?? '',
      engine_no: asset?.engine_no ?? '',
      vehicle_no: asset?.vehicle_no ?? '',
      make: isVehicleRecord(asset) ? '' : (asset?.make ?? ''),
      model: isVehicleRecord(asset) ? '' : (asset?.model ?? ''),
      purchase_price: asset?.purchase_price != null ? String(asset.purchase_price) : '',
      manufacture_year: formatDateForInput(asset?.manufacture_year),
      depreciation_period: asset?.depreciation_period != null ? String(asset.depreciation_period) : '',
      have_insurance: asset?.have_insurance != null ? String(asset.have_insurance) : '0',
      insurance_type: asset?.insurance_type_id != null
        ? String(asset.insurance_type_id)
        : asset?.insurance_type != null
          ? String(asset.insurance_type)
          : '',
      warranty_period: asset?.warranty_period != null ? String(asset.warranty_period) : '',
      operational_status: asset?.operational_status ?? 'y',
      activated: asset?.activated != null ? String(asset.activated) : '1',
      insurance_expire_date: formatDateForInput(asset?.insurance_expire_date),
      revenue_license_expire_date: formatDateForInput(asset?.revenue_license_expire_date),
      initial_mileage: asset?.initial_mileage != null ? String(asset.initial_mileage) : '',
      wing_id: wingId || '',
      // Driver information (vehicle_drivers table ID)
      driver: asset?.driver != null ? String(asset.driver) : '',
      secondary_driver: asset?.secondary_driver != null ? String(asset.secondary_driver) : '',
      copy_of_registration_document: asset?.copy_of_registration_document ?? '',
      // Vehicle details
      vehicle_category: isVehicleRecord(asset)
        ? String(asset?.vehicle_category_id ?? asset?.vehicle_category ?? '')
        : (asset?.vehicle_category ?? asset?.vehicle_category_id ?? ''),
      fuel_category: asset?.fuel_category ?? asset?.fuel_category_id ?? '',
      avg_fuel_consumption: asset?.avg_fuel_consumption != null ? String(asset.avg_fuel_consumption) : '',
      tank_capacity_ltr: asset?.tank_capacity_ltr != null ? String(asset.tank_capacity_ltr) : '',
      vehicle_image: asset?.vehicle_image ?? '',
      vehicle_revenue_license_image: asset?.vehicle_revenue_license_image ?? '',
      smoke_test_image: asset?.smoke_test_image ?? '',
      insurance_image: asset?.insurance_image ?? '',
      // Service fields (already exist in table)
      last_serviced_meter: asset?.last_serviced_meter != null ? String(asset.last_serviced_meter) : '',
      next_serviced: asset?.next_serviced != null ? String(asset.next_serviced) : '',
      wheel_alignment_meter: asset?.wheel_alignment_meter != null ? String(asset.wheel_alignment_meter) : '',
      next_wheel_alignment_meter: asset?.next_wheel_alignment_meter != null ? String(asset.next_wheel_alignment_meter) : '',
      // Rented vehicle fields
      no_of_km_for_month: asset?.no_of_km_for_month != null ? String(asset.no_of_km_for_month) : '',
      working_days: asset?.working_days != null ? String(asset.working_days) : '',
      monthly_rate: asset?.monthly_rate != null ? String(asset.monthly_rate) : '',
      rate_per_km: asset?.rate_per_km != null ? String(asset.rate_per_km) : '',
      starting_date: formatDateForInput(asset?.starting_date),
      end_date: formatDateForInput(asset?.end_date),
      owner_name: asset?.owner_name ?? '',
      owner_nic: asset?.owner_nic ?? '',
      owner_contact_no: asset?.owner_contact_no ?? '',
      owner_address: asset?.owner_address ?? '',
    };
  }, [wingNameToId]);

  // Fetch insurance types on mount
  useEffect(() => {
    if (insuranceOptions.length === 0 && !loading.insurance) {
      dispatch(fetchInsuranceTypes());
    }
  }, [dispatch, insuranceOptions.length, loading.insurance]);

  // Fetch assets when tab changes (only if not in single mode or when selectedType changes)
  useEffect(() => {
    if (singleMode && selectedType) {
      dispatch(fetchAssetsThunk(selectedType));
    } else if (!singleMode) {
      dispatch(fetchAssetsThunk(activeTab));
    }
  }, [activeTab, selectedType, singleMode, dispatch]);

  const filteredAssets = useMemo(() => {
    let filtered = [...assets];

    if (statusFilter === 'active') {
      filtered = filtered.filter((asset) => (asset?.activated ?? 0) === 1 || String(asset?.activated) === '1');
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((asset) => (asset?.activated ?? 0) === 0 || String(asset?.activated) === '0');
    }

    if (activeTab === 'vehicles' && vehicleOwnershipFilter !== 'all') {
      filtered = filtered.filter((asset) => asset?.ownership === vehicleOwnershipFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((asset) => {
        const fields = [
          asset?.tag,
          asset?.serial,
          asset?.type,
          asset?.make,
          asset?.model,
          asset?.vehicle_no,
          asset?.ownership,
          asset?.chassis_no,
          asset?.engine_no,
          asset?.driver_name,
          asset?.secondary_driver_name,
          asset?.driver_mobile_no,
          formatVehicleDriverDisplay(asset),
          asset?.owner_contact_no,
          formatWingDisplay(asset),
        ];
        if (activeTab === 'vehicles') {
          fields.push(formatOwnership(asset?.ownership));
        }
        return fields.some((field) => (field ?? '').toString().toLowerCase().includes(term));
      });
    }

    if (activeTab === 'vehicles') {
      filtered = [...filtered].sort(compareVehicleExpiryUrgency);
    }

    return filtered;
  }, [assets, statusFilter, vehicleOwnershipFilter, searchTerm, activeTab]);

  const handleTabChange = (tabKey) => {
    if (tabKey === activeTab) return;
    dispatch(setActiveTabAction(tabKey));
    const targetIndex = TAB_ORDER.indexOf(tabKey);
    if (targetIndex !== -1) {
      if (targetIndex < visibleStartIndex) {
        setVisibleStartIndex(targetIndex);
      } else if (targetIndex >= visibleStartIndex + maxVisibleTabs) {
        const newStart = targetIndex - maxVisibleTabs + 1;
        setVisibleStartIndex(newStart < 0 ? 0 : newStart);
      }
    }
  };

  const handleViewAsset = (asset, tabKey) => {
    dispatch(setSelectedAssetAction({ asset, assetType: tabKey }));
    setShowViewModal(true);
  };

  const handleEditAsset = (asset, tabKey) => {
    dispatch(setSelectedAssetAction({ asset, assetType: tabKey }));
    editMasterResolvedRef.current = false;
    setFormData(mapAssetToForm(asset));
    setShowEditModal(true);
  };

  const resetFormState = () => {
    setFormData(INITIAL_FORM_STATE);
    dispatch(clearSelectedAsset());
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    resetFormState();
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    dispatch(clearSelectedAsset());
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
  const currencyFields = new Set(['purchase_price', 'monthly_rate', 'rate_per_km']);
    setFormData((prev) => {
    const normalizedValue = currencyFields.has(name) ? sanitizeDecimalInput(value) : value;
      const updated = {
        ...prev,
      [name]: normalizedValue
      };

      if (name === 'have_insurance' && value !== '1') {
        updated.insurance_type = '';
      }

      if (name === 'vehicle_category') {
        updated.make = '';
        updated.model = '';
        editMasterResolvedRef.current = false;
      }
      if (name === 'make') {
        updated.model = '';
      }
      if (name === 'ownership' && value !== 'o') {
        updated.secondary_driver = '';
      }
      if (
        name === 'driver' &&
        updated.secondary_driver &&
        String(updated.secondary_driver) === String(normalizedValue || '')
      ) {
        updated.secondary_driver = '';
      }

      return updated;
    });
  };

  const renderWingSelectField = () => (
    <div className="form-group-assets">
      <label htmlFor="wing_id">
        Wing <span className="required-indicator-assets">*</span>
      </label>
      <select
        id="wing_id"
        name="wing_id"
        value={formData.wing_id || ''}
        onChange={handleFormChange}
        required
        disabled={wingsLoading || wings.length === 0}
      >
        <option value="">
          {wingsLoading ? 'Loading wings...' : wings.length === 0 ? 'No wings available' : 'Select a wing'}
        </option>
        {wings.map((wing) => (
          <option key={wing.id} value={String(wing.id)}>
            {wing.wing}
          </option>
        ))}
      </select>
      {wingsError && <small className="form-helper-text-assets error">{wingsErrorMessage}</small>}
    </div>
  );

  const validateForm = () => {
    let requiredFields = ['tag', 'serial', 'purchase_price', 'wing_id'];

    if (selectedAssetType === 'vehicles') {
      requiredFields = [
        'ownership',
        'vehicle_no',
        'make',
        'model',
        'chassis_no',
        'engine_no',
        'purchase_price',
        'insurance_expire_date',
        'revenue_license_expire_date',
        'initial_mileage',
        'operational_status',
        'activated',
        'wing_id'
      ];
      if (formData.ownership === 'r') {
        requiredFields.push('owner_name', 'owner_contact_no');
      }
    } else {
      if (formData.have_insurance === '1') {
        requiredFields.push('insurance_type');
      }
      if (selectedAssetType === 'batteries') {
        requiredFields.push('type');
      }
    }

    const missing = requiredFields.filter((field) => !formData[field] || !formData[field].toString().trim());
    if (missing.length > 0) {
      const readable = missing.map((field) => (field === 'wing_id' ? 'wing' : field));
      return `Please fill in all required fields: ${readable.join(', ')}`;
    }

    const normalizedPrice = parsePurchasePrice(formData.purchase_price);
    if (normalizedPrice === null) {
      return 'Purchase price must be a valid number.';
    }

    return '';
  };

  const handleUpdateSubmit = async (event) => {
    event.preventDefault();
    if (!selectedAsset) {
      return;
    }

    const validationMessage = validateForm();
    if (validationMessage) {
      setNotification({ type: 'error', message: validationMessage });
      return;
    }

    const normalizedPrice = parsePurchasePrice(formData.purchase_price);
    if (normalizedPrice === null) {
      setNotification({ type: 'error', message: 'Purchase price must be a valid number.' });
      return;
    }

    const wingId = parseWingId(formData.wing_id);
    if (wingId === null) {
      setNotification({ type: 'error', message: 'Please select a wing.' });
      return;
    }

    try {
      let payload;

      switch (selectedAssetType) {
        case 'generators':
        case 'remoteControls':
        case 'drones': {
          payload = {
            id: formData.id,
            tag: formData.tag.trim(),
            serial: formData.serial.trim(),
            make: formData.make.trim(),
            model: formData.model.trim(),
            manufacture_year: formatDateForApi(formData.manufacture_year),
            depreciation_period: formData.depreciation_period ? String(formData.depreciation_period).trim() : '',
            have_insurance: formData.have_insurance,
            insurance_type: formData.have_insurance === '1' ? formData.insurance_type : '',
            warranty_period: formData.warranty_period ? String(formData.warranty_period).trim() : '',
            operational_status: formData.operational_status,
            activated: formData.activated,
            purchase_price: normalizedPrice,
            wing: wingId
          };
          break;
        }
        case 'batteries': {
          payload = {
            id: formData.id,
            tag: formData.tag.trim(),
            serial: formData.serial.trim(),
            type: formData.type.trim(),
            make: formData.make.trim(),
            model: formData.model.trim(),
            manufacture_year: formatDateForApi(formData.manufacture_year),
            depreciation_period: formData.depreciation_period ? String(formData.depreciation_period).trim() : '',
            have_insurance: formData.have_insurance,
            insurance_type: formData.have_insurance === '1' ? formData.insurance_type : '',
            warranty_period: formData.warranty_period ? String(formData.warranty_period).trim() : '',
            operational_status: formData.operational_status,
            activated: formData.activated,
            purchase_price: normalizedPrice,
            wing: wingId
          };
          break;
        }
        case 'vehicles': {
          const { make: makeLabel, model: modelLabel } = vehicleMasterLabelsFromIds(
            formData.make,
            formData.model,
            editVehicleMakes,
            editVehicleModels
          );
          if (!makeLabel || !modelLabel) {
            setNotification({ type: 'error', message: 'Please select a valid make and model.' });
            return;
          }
          const vehiclePayload = {
            id: formData.id,
            ownership: formData.ownership.trim(),
            vehicle_pool_category: formData.vehicle_pool_category || 'p',
            chassis_no: formData.chassis_no.trim(),
            engine_no: formData.engine_no.trim(),
            vehicle_no: formData.vehicle_no.trim(),
            make: makeLabel,
            model: modelLabel,
            insurance_expire_date: formatDateForApi(formData.insurance_expire_date),
            revenue_license_expire_date: formatDateForApi(formData.revenue_license_expire_date),
            initial_mileage: formData.initial_mileage ? parseFloat(formData.initial_mileage) : 0,
            operational_status: formData.operational_status,
            activated: formData.activated,
            purchase_price: normalizedPrice,
            wing: wingId,
            // Driver information (vehicle_drivers table ID); secondary = KWIL own only
            driver: formData.driver || null,
            secondary_driver:
              formData.ownership === 'o' ? formData.secondary_driver || null : null,
            copy_of_registration_document: formData.copy_of_registration_document || null,
            // Vehicle details
            vehicle_category: formData.vehicle_category ? parseInt(formData.vehicle_category, 10) : null,
            fuel_category: formData.fuel_category ? parseInt(formData.fuel_category, 10) : null,
            avg_fuel_consumption: formData.avg_fuel_consumption ? parseFloat(formData.avg_fuel_consumption) : null,
            tank_capacity_ltr: formData.tank_capacity_ltr ? parseFloat(formData.tank_capacity_ltr) : null,
            // Service fields
            last_serviced_meter: formData.last_serviced_meter ? parseFloat(formData.last_serviced_meter) : null,
            next_serviced: formData.next_serviced ? parseFloat(formData.next_serviced) : null,
            wheel_alignment_meter: formData.wheel_alignment_meter ? parseFloat(formData.wheel_alignment_meter) : null,
            next_wheel_alignment_meter: formData.next_wheel_alignment_meter ? parseFloat(formData.next_wheel_alignment_meter) : null,
            // Rented vehicle fields (only if rented)
            ...(formData.ownership === 'r' ? {
              no_of_km_for_month: formData.no_of_km_for_month ? parseInt(formData.no_of_km_for_month, 10) : null,
              working_days: formData.working_days ? parseInt(formData.working_days, 10) : null,
              monthly_rate: formData.monthly_rate ? parseFloat(formData.monthly_rate) : null,
              rate_per_km: formData.rate_per_km ? parseFloat(formData.rate_per_km) : null,
              starting_date: formatDateForApi(formData.starting_date) || null,
              end_date: formatDateForApi(formData.end_date) || null,
              owner_name: formData.owner_name ? formData.owner_name.trim() : null,
              owner_nic: formData.owner_nic ? formData.owner_nic.trim() : null,
              owner_contact_no: formData.owner_contact_no ? formData.owner_contact_no.trim() : null,
              owner_address: formData.owner_address ? formData.owner_address.trim() : null,
            } : {})
          };
          const vehicleFileFields = [
            'vehicle_image',
            'copy_of_registration_document',
            'vehicle_revenue_license_image',
            'smoke_test_image',
            'insurance_image',
          ];
          const hasNewVehicleFiles = vehicleFileFields.some((f) => formData[f] instanceof File);
          if (hasNewVehicleFiles) {
            const fd = new FormData();
            Object.entries(vehiclePayload).forEach(([key, value]) => {
              if (value === undefined) return;
              if (value === null) {
                fd.append(key, '');
                return;
              }
              fd.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            });
            vehicleFileFields.forEach((field) => {
              if (formData[field] instanceof File) {
                fd.append(field, formData[field]);
              }
            });
            payload = fd;
          } else {
            payload = vehiclePayload;
          }
          break;
        }
        default:
          setNotification({ type: 'error', message: 'Unsupported asset type' });
          return;
      }

      // Dispatch Redux update action
      const result = await dispatch(updateAssetThunk({ assetType: selectedAssetType, data: payload }));

      if (updateAssetThunk.fulfilled.match(result)) {
        setNotification({
          type: 'success',
          message: `${singularLabel(TAB_CONFIG[selectedAssetType].label)} updated successfully.`
        });
        setShowEditModal(false);
        resetFormState();
        // Refresh assets
        dispatch(fetchAssetsThunk(activeTab));
      } else {
        throw new Error(result.payload || `Failed to update ${singularLabel(TAB_CONFIG[selectedAssetType].label).toLowerCase()}.`);
      }
    } catch (apiError) {
      setNotification({
        type: 'error',
        message: apiError?.message || 'Update failed. Please try again.'
      });
    }
  };

  const renderTableHeader = () => {
    if (activeTab === 'batteries') {
      return (
        <tr>
          <th>Tag</th>
          <th>Serial</th>
          <th>Type</th>
          <th>Make</th>
          <th>Model</th>
          <th>Purchase Price</th>
          <th>Wing</th>
          <th>Insurance</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      );
    }

    if (activeTab === 'vehicles') {
      return (
        <tr>
          <th>Vehicle No</th>
          <th>Vehicle Category</th>
          <th>Make / Model</th>
          <th>Driver</th>
          <th>Owner(rented)</th>
          <th>Insurance Expiry</th>
          <th>Revenue License Expiry</th>
          <th>Status</th>
        </tr>
      );
    }

    if (activeTab === 'generators') {
      return (
        <tr>
          <th>Tag</th>
          <th>Serial</th>
          <th>Make</th>
          <th>Model</th>
          <th>Purchase Price</th>
          <th>Wing</th>
          <th>Insurance</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      );
    }

    return (
      <tr>
        <th>Tag</th>
        <th>Serial</th>
        <th>Make</th>
        <th>Model</th>
        <th>Purchase Price</th>
        <th>Wing</th>
        <th>Insurance</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    );
  };

  const renderTableRow = (asset) => {
    if (activeTab === 'vehicles') {
      const openVehicleProfile = () => {
        if (asset?.id) setProfileVehicleId(Number(asset.id));
      };
      const vehicleRowInteractive = Boolean(asset?.id);
      return (
        <tr
          key={asset?.id ?? asset?.vehicle_no}
          className={vehicleRowInteractive ? 'vehicle-table-row-clickable' : undefined}
          onClick={vehicleRowInteractive ? openVehicleProfile : undefined}
          onKeyDown={
            vehicleRowInteractive
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openVehicleProfile();
                  }
                }
              : undefined
          }
          role={vehicleRowInteractive ? 'button' : undefined}
          tabIndex={vehicleRowInteractive ? 0 : undefined}
          title={vehicleRowInteractive ? 'Open vehicle profile (view & edit)' : undefined}
        >
          <td>
            <span className="vehicle-profile-link">{asset?.vehicle_no || '-'}</span>
            {asset?.ownership ? (
              <span style={{ color: '#64748b', marginLeft: 6, fontSize: '0.9em' }}>
                ({formatOwnership(asset.ownership)})
              </span>
            ) : null}
          </td>
          <td>{formatVehiclePoolCategory(asset?.vehicle_pool_category)}</td>
          <td>{formatMakeModel(asset?.make, asset?.model)}</td>
          <td className="vehicle-person-cell-td">
            {renderVehiclePersonCell(
              formatVehicleDriverDisplay(asset),
              [
                asset?.driver_mobile_no,
                asset?.secondary_driver_name
                  ? `2nd: ${asset.secondary_driver_name}`
                  : null,
              ]
                .map((s) => String(s || '').trim())
                .filter(Boolean)
                .join(' · ')
            )}
          </td>
          <td className="vehicle-person-cell-td">
            {asset?.ownership === 'r'
              ? renderVehiclePersonCell(asset?.owner_name, asset?.owner_contact_no)
              : '-'}
          </td>
          {renderExpiryDateCell(asset?.insurance_expire_date)}
          {renderExpiryDateCell(asset?.revenue_license_expire_date)}
          <td>
            <span className={`status-badge-assets ${asset?.operational_status === 'y' ? 'status-badge-active-assets' : 'status-badge-inactive-assets'}`}>
              {formatOperationalStatus(asset?.operational_status)}
            </span>
          </td>
        </tr>
      );
    }

    const insuranceDisplay = asset?.have_insurance === 1 || String(asset?.have_insurance) === '1'
      ? resolveInsuranceName(insuranceOptions, asset?.insurance_type_id || asset?.insurance_type)
      : 'No';
    const purchasePriceDisplay = formatCurrency(asset?.purchase_price);
    const wingDisplay = formatWingDisplay(asset);
    const batteryTypeDisplay = isBatteryTab 
      ? resolveBatteryTypeName(batteryTypes, asset?.type || asset?.type_id) 
      : null;

    return (
      <tr key={asset?.id ?? asset?.tag}>
        <td>{asset?.tag || '-'}</td>
        <td>{asset?.serial || '-'}</td>
        {isBatteryTab && <td>{batteryTypeDisplay || '-'}</td>}
        <td>{asset?.make || '-'}</td>
        <td>{asset?.model || '-'}</td>
        <td>{purchasePriceDisplay}</td>
        <td>{wingDisplay}</td>
        <td>{insuranceDisplay}</td>
        <td>
          <span className={`status-badge-assets ${asset?.operational_status === 'y' ? 'status-badge-active-assets' : 'status-badge-inactive-assets'}`}>
            {formatOperationalStatus(asset?.operational_status)}
          </span>
        </td>
        <td>
          <div className="action-buttons-assets">
            <button
              className="view-btn-assets"
              onClick={() => handleViewAsset(asset, activeTab)}
              title="View Details"
            >
              <FaEye />
            </button>
            <button
              className="edit-btn-assets"
              onClick={() => handleEditAsset(asset, activeTab)}
              title="Edit Asset"
            >
              <FaEdit />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderDetailRows = () => {
    if (!selectedAsset) return null;

    const rows =
      selectedAssetType === 'vehicles'
        ? [
            {
              label: 'Vehicle No',
              value: formatVehicleNoWithOwnership(selectedAsset.vehicle_no, selectedAsset.ownership),
            },
            {
              label: 'Vehicle Category',
              value: formatVehiclePoolCategory(selectedAsset.vehicle_pool_category),
            },
            { label: 'Make / Model', value: formatMakeModel(selectedAsset.make, selectedAsset.model) },
            {
              label: 'Driver',
              value: (() => {
                const line = formatVehicleDriverDisplay(selectedAsset);
                const mobile = String(selectedAsset?.driver_mobile_no || '').trim();
                if (line === '-' && !mobile) return '-';
                return mobile ? `${line}\n${mobile}` : line;
              })(),
            },
            {
              label: 'Secondary driver',
              value: String(selectedAsset?.secondary_driver_name || '').trim() || '-',
            },
            { label: 'Insurance Expiry', value: formatDateForInput(selectedAsset.insurance_expire_date) },
            { label: 'Revenue License Expiry', value: formatDateForInput(selectedAsset.revenue_license_expire_date) },
            { label: 'Operational Status', value: formatOperationalStatus(selectedAsset.operational_status) }
            ,
            ...(selectedAsset.ownership === 'r' ? [
              {
                label: 'Owner',
                value: (() => {
                  const name = String(selectedAsset.owner_name || '').trim();
                  const mobile = String(selectedAsset.owner_contact_no || '').trim();
                  if (!name && !mobile) return '-';
                  return [name || null, mobile || null].filter(Boolean).join('\n');
                })(),
              },
              { label: 'Owner NIC', value: selectedAsset.owner_nic || '-' },
              { label: 'Owner Address', value: selectedAsset.owner_address || '-' },
            ] : [])
          ]
        : [
            { label: 'Tag', value: selectedAsset.tag },
            { label: 'Serial', value: selectedAsset.serial },
            ...(selectedAssetType === 'batteries'
              ? [{ label: 'Type', value: resolveBatteryTypeName(batteryTypes, selectedAsset.type || selectedAsset.type_id) }]
              : []),
            { label: 'Make', value: selectedAsset.make },
            { label: 'Model', value: selectedAsset.model },
            { label: 'Purchase Price', value: formatCurrency(selectedAsset.purchase_price) },
            { label: 'Wing', value: formatWingDisplay(selectedAsset) },
            { label: 'Depreciation Period', value: selectedAsset.depreciation_period },
            {
              label: 'Insurance',
              value:
                selectedAsset?.have_insurance === 1 || String(selectedAsset?.have_insurance) === '1'
                  ? resolveInsuranceName(insuranceOptions, selectedAsset?.insurance_type_id || selectedAsset?.insurance_type)
                  : 'No'
            },
            { label: 'Warranty Period', value: selectedAsset.warranty_period },
            { label: 'Operational Status', value: formatOperationalStatus(selectedAsset.operational_status) }
          ];

    return rows.map((row) => (
      <div key={row.label} className="detail-row-assets">
        <span className="detail-label-assets">{row.label}:</span>
        <span className="detail-value-assets">{row.value ?? '-'}</span>
      </div>
    ));
  };

  const showVehicleProfile =
    profileVehicleId &&
    (activeTab === 'vehicles' || (singleMode && selectedAssetType === 'vehicles'));

  if (showVehicleProfile) {
    const profileContainerClass = [
      'assets-container-assets',
      embeddedInVehicleManagement ? 'assets-container-assets--vehicle-profile-scroll' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={profileContainerClass}>
        <VehicleProfile
          vehicleId={profileVehicleId}
          onBack={() => setProfileVehicleId(null)}
          onEditVehicle={(v) => {
            setProfileVehicleId(null);
            handleEditAsset(v, 'vehicles');
          }}
        />
      </div>
    );
  }

  const containerClassName = [
    'assets-container-assets',
    embeddedInVehicleManagement ? 'assets-container-assets--vehicle-mgmt-scroll' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName}>
      {/* Header (hidden in single mode) */}
      {!singleMode && (
        <div className="assets-header-assets">
          <FaBoxes className="header-icon-assets" />
          <h2>Assets</h2>
        </div>
      )}

      {/* Tab Navigation (hidden in single mode) */}
      {!singleMode && (
        <div className="assets-tabs-assets">
          <button
            type="button"
            className="tab-scroll-button-assets"
            onClick={() => setVisibleStartIndex((prev) => (prev - 1 < 0 ? 0 : prev - 1))}
            disabled={!showPrevTabs}
            aria-label="Previous tabs"
          >
            <FaChevronLeft />
          </button>
          <div className="tabs-wrapper-assets">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`asset-tab-assets ${isActive ? 'active-assets' : ''}`}
                  onClick={() => handleTabChange(tab.key)}
                >
                  <Icon className="tab-icon-assets" />
                  <span className="tab-text-assets">{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="tab-scroll-button-assets"
            onClick={() => setVisibleStartIndex((prev) => (prev + 1 > maxStartIndex ? maxStartIndex : prev + 1))}
            disabled={!showNextTabs}
            aria-label="Next tabs"
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      {notification.message && (
        <div className={`assets-notification-assets ${notification.type === 'error' ? 'error' : 'success'}`}>
          {notification.message}
        </div>
      )}

      <div className="assets-toolbar-assets">
        <div className="search-container-assets">
          <FaSearch className="search-icon-assets" />
          <input
            type="text"
            placeholder={
              isVehicleTab
                ? 'Search by vehicle no, make, model, driver, owner...'
                : 'Search by tag, serial, make, model, wing, or price...'
            }
            value={searchTerm}
            onChange={(e) => dispatch(setSearchTermAction(e.target.value))}
            className="search-input-assets"
          />
        </div>
        <div
          className={`filter-container-assets${isVehicleTab ? ' filter-container-assets--vehicles' : ''}`}
        >
          {isVehicleTab ? (
            <select
              value={vehicleOwnershipFilter}
              onChange={(e) => dispatch(setVehicleOwnershipFilterAction(e.target.value))}
              className="filter-select-assets"
              aria-label="Filter by ownership"
            >
              <option value="all">All ownership</option>
              <option value="o">KWIL vehicle</option>
              <option value="r">Rented</option>
            </select>
          ) : null}
          <select
            value={statusFilter}
            onChange={(e) => dispatch(setStatusFilterAction(e.target.value))}
            className="filter-select-assets"
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="assets-table-container-assets">
        {loading.assets ? (
          <div className="loading-assets">Loading {currentTabConfig?.label.toLowerCase()}...</div>
        ) : error ? (
          <div className="no-data-assets">
            <p>{error}</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="no-data-assets">
            <FaBoxes className="no-data-icon-assets" />
            <p>No {currentTabConfig?.label.toLowerCase()} found</p>
          </div>
        ) : (
          <table className="assets-table-assets">
            <thead>{renderTableHeader()}</thead>
            <tbody>{filteredAssets.map((asset) => renderTableRow(asset))}</tbody>
          </table>
        )}
      </div>

      {showViewModal && selectedAsset && (
        <div className="modal-overlay-assets" onClick={closeViewModal}>
          <div className="modal-content-assets" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-assets">
              <h3>{singularLabel(TAB_CONFIG[selectedAssetType].label)} Details</h3>
              <button className="close-btn-assets" onClick={closeViewModal}>
                ×
              </button>
            </div>
            <div className="modal-body-assets">{renderDetailRows()}</div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay-assets" onClick={closeEditModal}>
          <div className="modal-content-assets" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-assets">
              <h3>Edit {singularLabel(TAB_CONFIG[selectedAssetType].label)}</h3>
              <button className="close-btn-assets" onClick={closeEditModal}>
                ×
              </button>
            </div>
            <div className="modal-body-assets">
              <form onSubmit={handleUpdateSubmit} className="assets-form-assets">
                {isSelectedVehicle ? (
                  <>
                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="ownership">Ownership <span className="required-indicator-assets">*</span></label>
                        <select
                          id="ownership"
                          name="ownership"
                          value={formData.ownership}
                          onChange={handleFormChange}
                          required
                        >
                          <option value="">Select ownership</option>
                          <option value="o">Own Vehicle</option>
                          <option value="r">Rented Vehicle</option>
                        </select>
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="vehicle_pool_category">Vehicle Category <span className="required-indicator-assets">*</span></label>
                        <select
                          id="vehicle_pool_category"
                          name="vehicle_pool_category"
                          value={formData.vehicle_pool_category || 'p'}
                          onChange={handleFormChange}
                          required
                        >
                          {VEHICLE_POOL_CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="vehicle_no">Vehicle Number <span className="required-indicator-assets">*</span></label>
                        <input
                          type="text"
                          id="vehicle_no"
                          name="vehicle_no"
                          value={formData.vehicle_no}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                    </div>

                    <VehicleMasterSelectFields
                      variant="assets"
                      required
                      values={{
                        vehicle_category: formData.vehicle_category,
                        make: formData.make,
                        model: formData.model,
                      }}
                      onValuesChange={(patch) => {
                        setFormData((prev) => {
                          const next = { ...prev, ...patch };
                          if (patch.vehicle_category != null && patch.vehicle_category !== prev.vehicle_category) {
                            next.make = patch.make ?? '';
                            next.model = patch.model ?? '';
                            editMasterResolvedRef.current = false;
                          }
                          if (patch.make != null && patch.make !== prev.make) {
                            next.model = patch.model ?? '';
                          }
                          return next;
                        });
                      }}
                      onNotify={({ type, message }) => setNotification({ type, message })}
                    />

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="chassis_no">Chassis Number <span className="required-indicator-assets">*</span></label>
                        <input
                          type="text"
                          id="chassis_no"
                          name="chassis_no"
                          value={formData.chassis_no}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="engine_no">Engine Number <span className="required-indicator-assets">*</span></label>
                        <input
                          type="text"
                          id="engine_no"
                          name="engine_no"
                          value={formData.engine_no}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="insurance_expire_date">Insurance Expiry Date <span className="required-indicator-assets">*</span></label>
                        <input
                          type="date"
                          id="insurance_expire_date"
                          name="insurance_expire_date"
                          value={formData.insurance_expire_date}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="revenue_license_expire_date">Revenue License Expiry Date <span className="required-indicator-assets">*</span></label>
                        <input
                          type="date"
                          id="revenue_license_expire_date"
                          name="revenue_license_expire_date"
                          value={formData.revenue_license_expire_date}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="initial_mileage">Initial Mileage (km) <span className="required-indicator-assets">*</span></label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="initial_mileage"
                          name="initial_mileage"
                          value={formData.initial_mileage}
                          onChange={handleFormChange}
                          min="0"
                          required
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="operational_status">Operational Status <span className="required-indicator-assets">*</span></label>
                        <select
                          id="operational_status"
                          name="operational_status"
                          value={formData.operational_status}
                          onChange={handleFormChange}
                          required
                        >
                          <option value="y">Operational</option>
                          <option value="n">Not Operational</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="activated">Activation Status <span className="required-indicator-assets">*</span></label>
                        <select
                          id="activated"
                          name="activated"
                          value={formData.activated}
                          onChange={handleFormChange}
                          required
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </div>
                    </div>

                    {/* Driver Information Section */}
                    <div className="form-section-divider-assets">
                      <h4>Driver Information</h4>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="driver">Driver</label>
                        <div className="driver-field-row-assets">
                          <select
                            id="driver"
                            name="driver"
                            value={formData.driver}
                            onChange={handleFormChange}
                            disabled={vehicleDriversLoading}
                          >
                            <option value="">
                              {vehicleDriversLoading 
                                ? 'Loading drivers...' 
                                : (formData.ownership === 'o' && internalDrivers.length === 0) || (formData.ownership === 'r' && externalDrivers.length === 0)
                                  ? 'No drivers available'
                                  : 'Select driver'}
                            </option>
                            {formData.ownership === 'o' ? (
                              internalDrivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.user_name} {driver.user_nic ? `(${driver.user_nic})` : ''}
                                  {Number(driver.assigned_vehicle_count) > 0 ? ` — ${driver.assigned_vehicle_count} vehicle(s)` : ''}
                                </option>
                              ))
                            ) : (
                              externalDrivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.user_name} {driver.user_nic ? `(${driver.user_nic})` : ''}
                                  {Number(driver.assigned_vehicle_count) > 0 ? ` — ${driver.assigned_vehicle_count} vehicle(s)` : ''}
                                </option>
                              ))
                            )}
                          </select>
                          <button
                            type="button"
                            className="driver-clear-btn-assets"
                            title="Remove driver"
                            aria-label="Remove driver"
                            disabled={!formData.driver || vehicleDriversLoading}
                            onClick={() =>
                              handleFormChange({ target: { name: 'driver', value: '' } })
                            }
                          >
                            <FaTimes />
                          </button>
                        </div>
                        <small className="form-field-helper-assets">
                          Driver license images are reused from User Registration.
                        </small>
                      </div>
                      {formData.ownership === 'o' ? (
                        <div className="form-group-assets">
                          <label htmlFor="secondary_driver">Secondary driver (KWIL)</label>
                          <div className="driver-field-row-assets">
                            <select
                              id="secondary_driver"
                              name="secondary_driver"
                              value={formData.secondary_driver || ''}
                              onChange={handleFormChange}
                              disabled={vehicleDriversLoading}
                            >
                              <option value="">
                                {vehicleDriversLoading
                                  ? 'Loading drivers...'
                                  : internalDrivers.length === 0
                                    ? 'No drivers available'
                                    : 'Select secondary driver (optional)'}
                              </option>
                              {internalDrivers
                                .filter((d) => String(d.id) !== String(formData.driver || ''))
                                .map((driver) => (
                                  <option key={driver.id} value={driver.id}>
                                    {driver.user_name} {driver.user_nic ? `(${driver.user_nic})` : ''}
                                    {Number(driver.assigned_vehicle_count) > 0
                                      ? ` — ${driver.assigned_vehicle_count} vehicle(s)`
                                      : ''}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              className="driver-clear-btn-assets"
                              title="Remove secondary driver"
                              aria-label="Remove secondary driver"
                              disabled={!formData.secondary_driver || vehicleDriversLoading}
                              onClick={() =>
                                handleFormChange({ target: { name: 'secondary_driver', value: '' } })
                              }
                            >
                              <FaTimes />
                            </button>
                          </div>
                          <small className="form-field-helper-assets">
                            Optional second driver for this vehicle. The first driver must end their day trip before the other can start meter reading.
                          </small>
                        </div>
                      ) : null}
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="fuel_category">Fuel Category</label>
                        <select
                          id="fuel_category"
                          name="fuel_category"
                          value={formData.fuel_category}
                          onChange={handleFormChange}
                          disabled={fuelCategoriesLoading}
                        >
                          <option value="">{fuelCategoriesLoading ? 'Loading...' : 'Select fuel category'}</option>
                          {fuelCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.category}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="avg_fuel_consumption">Avg Fuel Consumption (km/L)</label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="avg_fuel_consumption"
                          name="avg_fuel_consumption"
                          value={formData.avg_fuel_consumption}
                          onChange={handleFormChange}
                          placeholder="Enter average fuel consumption"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="tank_capacity_ltr">Tank Capacity (L)</label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="tank_capacity_ltr"
                          name="tank_capacity_ltr"
                          value={formData.tank_capacity_ltr}
                          onChange={handleFormChange}
                          placeholder="Enter fuel tank capacity in litres"
                          min="0"
                          step="0.1"
                        />
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="last_serviced_meter">Last Serviced Meter (km)</label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="last_serviced_meter"
                          name="last_serviced_meter"
                          value={formData.last_serviced_meter}
                          onChange={handleFormChange}
                          placeholder="Enter last serviced meter reading"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="next_serviced">Next Service (km)</label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="next_serviced"
                          name="next_serviced"
                          value={formData.next_serviced}
                          onChange={handleFormChange}
                          placeholder="Enter next service mileage"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="wheel_alignment_meter">Wheel Alignment Meter (km)</label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="wheel_alignment_meter"
                          name="wheel_alignment_meter"
                          value={formData.wheel_alignment_meter}
                          onChange={handleFormChange}
                          placeholder="Enter wheel alignment meter reading"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="next_wheel_alignment_meter">Next Wheel Alignment (km)</label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="next_wheel_alignment_meter"
                          name="next_wheel_alignment_meter"
                          value={formData.next_wheel_alignment_meter}
                          onChange={handleFormChange}
                          placeholder="Enter next wheel alignment mileage"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>

                    {/* Documents & Images Section */}
                    <div className="form-section-divider-assets">
                      <h4>Documents & Images</h4>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="vehicle_image">Vehicle photo</label>
                        <input
                          type="file"
                          id="vehicle_image"
                          name="vehicle_image"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFormChange({ target: { name: 'vehicle_image', value: file } });
                            }
                          }}
                        />
                        {formData.vehicle_image instanceof File ? (
                          <small className="form-field-helper-assets">New: {formData.vehicle_image.name}</small>
                        ) : formData.vehicle_image ? (
                          <small className="form-field-helper-assets">Current photo on file</small>
                        ) : null}
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="copy_of_registration_document">Copy of Registration Document</label>
                        <input
                          type="file"
                          id="copy_of_registration_document"
                          name="copy_of_registration_document"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFormChange({ target: { name: 'copy_of_registration_document', value: file } });
                            }
                          }}
                        />
                        {formData.copy_of_registration_document instanceof File ? (
                          <small className="form-field-helper-assets">New: {formData.copy_of_registration_document.name}</small>
                        ) : formData.copy_of_registration_document ? (
                          <small className="form-field-helper-assets">Document on file</small>
                        ) : null}
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="vehicle_revenue_license_image">Vehicle Revenue License Image</label>
                        <input
                          type="file"
                          id="vehicle_revenue_license_image"
                          name="vehicle_revenue_license_image"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFormChange({ target: { name: 'vehicle_revenue_license_image', value: file } });
                            }
                          }}
                        />
                        {formData.vehicle_revenue_license_image instanceof File ? (
                          <small className="form-field-helper-assets">New: {formData.vehicle_revenue_license_image.name}</small>
                        ) : formData.vehicle_revenue_license_image ? (
                          <small className="form-field-helper-assets">Document on file</small>
                        ) : null}
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="smoke_test_image">Smoke Test Image</label>
                        <input
                          type="file"
                          id="smoke_test_image"
                          name="smoke_test_image"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFormChange({ target: { name: 'smoke_test_image', value: file } });
                            }
                          }}
                        />
                        {formData.smoke_test_image instanceof File ? (
                          <small className="form-field-helper-assets">New: {formData.smoke_test_image.name}</small>
                        ) : formData.smoke_test_image ? (
                          <small className="form-field-helper-assets">Document on file</small>
                        ) : null}
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="insurance_image">Insurance Image</label>
                        <input
                          type="file"
                          id="insurance_image"
                          name="insurance_image"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFormChange({ target: { name: 'insurance_image', value: file } });
                            }
                          }}
                        />
                        {formData.insurance_image instanceof File ? (
                          <small className="form-field-helper-assets">New: {formData.insurance_image.name}</small>
                        ) : formData.insurance_image ? (
                          <small className="form-field-helper-assets">Document on file</small>
                        ) : null}
                      </div>
                    </div>

                    {/* Rented Vehicle Fields */}
                    {formData.ownership === 'r' && (
                      <>
                        <div className="form-section-divider-assets">
                          <h4>Rental Information</h4>
                        </div>

                        <div className="form-row-assets">
                          <div className="form-group-assets">
                            <label htmlFor="no_of_km_for_month">No of KM for Month</label>
                            <input
                              type="number"
                          onWheel={(e) => e.target.blur()}
                              id="no_of_km_for_month"
                              name="no_of_km_for_month"
                              value={formData.no_of_km_for_month}
                              onChange={handleFormChange}
                              placeholder="Enter number of KM for month"
                              min="0"
                            />
                          </div>
                          <div className="form-group-assets">
                            <label htmlFor="working_days">Working Days</label>
                            <input
                              type="number"
                          onWheel={(e) => e.target.blur()}
                              id="working_days"
                              name="working_days"
                              value={formData.working_days}
                              onChange={handleFormChange}
                              placeholder="Enter working days"
                              min="0"
                            />
                          </div>
                        </div>

                        <div className="form-row-assets">
                          <div className="form-group-assets">
                            <label htmlFor="monthly_rate">Monthly Rate (LKR)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                          onWheel={(e) => e.target.blur()}
                              id="monthly_rate"
                              name="monthly_rate"
                              value={formatCurrencyInput(formData.monthly_rate)}
                              onChange={handleFormChange}
                              placeholder="Enter monthly rate"
                            />
                          </div>
                          <div className="form-group-assets">
                            <label htmlFor="rate_per_km">Rate (Per KM) (LKR)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                          onWheel={(e) => e.target.blur()}
                              id="rate_per_km"
                              name="rate_per_km"
                              value={formatCurrencyInput(formData.rate_per_km)}
                              onChange={handleFormChange}
                              placeholder="Enter rate per KM"
                            />
                          </div>
                        </div>

                        <div className="form-row-assets">
                          <div className="form-group-assets">
                            <label htmlFor="starting_date">Starting Date</label>
                            <input
                              type="date"
                              id="starting_date"
                              name="starting_date"
                              value={formData.starting_date}
                              onChange={handleFormChange}
                            />
                          </div>
                          <div className="form-group-assets">
                            <label htmlFor="end_date">End Date</label>
                            <input
                              type="date"
                              id="end_date"
                              name="end_date"
                              value={formData.end_date}
                              onChange={handleFormChange}
                            />
                          </div>
                        </div>

                        <div className="form-section-divider-assets">
                          <h4>Owner Information</h4>
                        </div>

                        <div className="form-row-assets">
                          <div className="form-group-assets">
                            <label htmlFor="owner_name">Owner Name</label>
                            <input
                              type="text"
                              id="owner_name"
                              name="owner_name"
                              value={formData.owner_name}
                              onChange={handleFormChange}
                              placeholder="Enter owner name"
                            />
                          </div>
                          <div className="form-group-assets">
                            <label htmlFor="owner_nic">Owner NIC</label>
                            <input
                              type="text"
                              id="owner_nic"
                              name="owner_nic"
                              value={formData.owner_nic}
                              onChange={handleFormChange}
                              placeholder="Enter owner NIC"
                            />
                          </div>
                        </div>

                        <div className="form-row-assets">
                          <div className="form-group-assets">
                            <label htmlFor="owner_contact_no">Owner Contact No</label>
                            <input
                              type="text"
                              id="owner_contact_no"
                              name="owner_contact_no"
                              value={formData.owner_contact_no}
                              onChange={handleFormChange}
                              placeholder="Enter owner contact"
                            />
                          </div>
                          <div className="form-group-assets">
                            <label htmlFor="owner_address">Owner Address</label>
                            <input
                              type="text"
                              id="owner_address"
                              name="owner_address"
                              value={formData.owner_address}
                              onChange={handleFormChange}
                              placeholder="Enter owner address"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="purchase_price">Purchase Price (LKR) <span className="required-indicator-assets">*</span></label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onWheel={(e) => e.target.blur()}
                          id="purchase_price"
                          name="purchase_price"
                          value={formatCurrencyInput(formData.purchase_price)}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                      {renderWingSelectField()}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="tag">Tag <span className="required-indicator-assets">*</span></label>
                        <input
                          type="text"
                          id="tag"
                          name="tag"
                          value={formData.tag}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="serial">Serial <span className="required-indicator-assets">*</span></label>
                        <input
                          type="text"
                          id="serial"
                          name="serial"
                          value={formData.serial}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                    </div>

                    {selectedAssetType === 'batteries' && (
                      <div className="form-row-assets">
                        <div className="form-group-assets">
                          <label htmlFor="type">Type <span className="required-indicator-assets">*</span></label>
                          <select
                            id="type"
                            name="type"
                            value={formData.type}
                            onChange={handleFormChange}
                            required
                            disabled={batteryTypesLoading}
                          >
                            <option value="">Select Battery Type</option>
                            {batteryTypes
                              .filter((bt) => bt.activated === 1 || bt.activated === '1')
                              .map((bt) => (
                                <option key={bt.id} value={bt.id}>
                                  {bt.type}
                                </option>
                              ))}
                          </select>
                          {batteryTypesError && (
                            <span className="error-text-assets" style={{ fontSize: '12px', color: '#d32f2f' }}>
                              Failed to load battery types
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="make">Make</label>
                        <input
                          type="text"
                          id="make"
                          name="make"
                          value={formData.make}
                          onChange={handleFormChange}
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="model">Model</label>
                        <input
                          type="text"
                          id="model"
                          name="model"
                          value={formData.model}
                          onChange={handleFormChange}
                        />
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="purchase_price">Purchase Price (LKR) <span className="required-indicator-assets">*</span></label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onWheel={(e) => e.target.blur()}
                          id="purchase_price"
                          name="purchase_price"
                          value={formatCurrencyInput(formData.purchase_price)}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                      {renderWingSelectField()}
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="manufacture_year">Manufacture Date</label>
                        <input
                          type="date"
                          id="manufacture_year"
                          name="manufacture_year"
                          value={formData.manufacture_year}
                          onChange={handleFormChange}
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="depreciation_period">Depreciation Period (years)</label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="depreciation_period"
                          name="depreciation_period"
                          value={formData.depreciation_period}
                          onChange={handleFormChange}
                          min="0"
                          step="1"
                        />
                      </div>
                    </div>

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="warranty_period">Warranty Period (years)</label>
                        <input
                          type="number"
                          onWheel={(e) => e.target.blur()}
                          id="warranty_period"
                          name="warranty_period"
                          value={formData.warranty_period}
                          onChange={handleFormChange}
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="have_insurance">Have Insurance?</label>
                        <select
                          id="have_insurance"
                          name="have_insurance"
                          value={formData.have_insurance}
                          onChange={handleFormChange}
                        >
                          <option value="0">No</option>
                          <option value="1">Yes</option>
                        </select>
                      </div>
                    </div>

                    {formData.have_insurance === '1' && (
                      <div className="form-row-assets">
                        <div className="form-group-assets full-width-assets">
                          <label htmlFor="insurance_type">Insurance Type <span className="required-indicator-assets">*</span></label>
                          <select
                            id="insurance_type"
                            name="insurance_type"
                            value={formData.insurance_type}
                            onChange={handleFormChange}
                            disabled={loading.insurance || insuranceOptions.length === 0}
                            required
                          >
                            <option value="">{loading.insurance ? 'Loading insurance types...' : 'Select insurance type'}</option>
                            {!loading.insurance && insuranceOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.type}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="form-row-assets">
                      <div className="form-group-assets">
                        <label htmlFor="operational_status">Operational Status</label>
                        <select
                          id="operational_status"
                          name="operational_status"
                          value={formData.operational_status}
                          onChange={handleFormChange}
                        >
                          <option value="y">Operational</option>
                          <option value="n">Not Operational</option>
                        </select>
                      </div>
                      <div className="form-group-assets">
                        <label htmlFor="activated">Activation Status</label>
                        <select
                          id="activated"
                          name="activated"
                          value={formData.activated}
                          onChange={handleFormChange}
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="form-actions-assets">
                  <button type="submit" className="submit-btn-assets" disabled={loading.updating}>
                    {loading.updating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" className="reset-btn-assets" onClick={closeEditModal} disabled={loading.updating}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;

