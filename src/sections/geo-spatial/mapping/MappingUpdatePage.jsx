import React, { useState, useEffect, useMemo } from 'react';
import {
  FaPlus, FaEdit, FaSave, FaTimes, FaMap, FaImage, FaExpand,
  FaLayerGroup, FaSeedling, FaGlobeAmericas, FaBuilding, FaProjectDiagram,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { downloadMappingFieldsExcel } from './mappingFieldsExcelExport';
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../../../styles/mappingUpdatePage.css';
import {
  useGetMappingGroupsQuery,
  useGetMappingPlantationsByGroupQuery,
  useGetMappingRegionsByPlantationQuery,
  useGetMappingEstatesByRegionQuery,
  useGetMappingDivisionsByEstateQuery,
  useGetMappingFieldsByDivisionQuery,
  useGetMappingMissionPartialReasonsQuery,
  useCreateMappingGroupMutation,
  useCreateMappingPlantationMutation,
  useCreateMappingRegionMutation,
  useCreateMappingEstateMutation,
  useCreateMappingDivisionMutation,
  useCreateMappingFieldMutation,
  useUpdateMappingEstateMutation,
  useUpdateMappingDivisionMutation,
  useUpdateMappingFieldMutation,
  useToggleMappingGroupActivationMutation,
  useToggleMappingPlantationActivationMutation,
  useToggleMappingRegionActivationMutation,
  useToggleMappingEstateActivationMutation,
  useSetMappingEstateFinalizedMutation,
  useSetMappingEstatePlanSizesMutation,
  useSetMappingHierarchyMapImageMutation,
  useToggleMappingDivisionActivationMutation,
  useToggleMappingFieldActivationMutation,
  useLazyGetMappingAllFieldsReportQuery,
} from '../../../api/services NodeJs/mappingHierarchyApi';
import {
  useGetMissionPartialReasonsQuery,
  useSaveMissionPartialReasonMutation,
} from '../../../api/services NodeJs/reasonsApi';
import { FEATURE_CODES } from '../../../utils/featurePermissions';
import { isInternalDeveloper } from '../../../utils/authUtils';
import { useGetMyPermissionsQuery } from '../../../api/services NodeJs/featurePermissionsApi';
import { getResourceUrl } from '../../../utils/resourceUrls';
import MappingHierarchyNav from './MappingHierarchyNav';
import MappingHierarchyCardGrid from './MappingHierarchyCardGrid';
import MappingFieldsPanel from './MappingFieldsPanel';

const HIERARCHY_LEVELS = [
  { key: 'group', label: 'Group', icon: FaLayerGroup, nameField: 'group' },
  { key: 'plantation', label: 'Plantation', icon: FaSeedling, nameField: 'plantation' },
  { key: 'region', label: 'Region', icon: FaGlobeAmericas, nameField: 'region' },
  { key: 'estate', label: 'Estate', icon: FaBuilding, nameField: 'estate' },
  { key: 'division', label: 'Division', icon: FaProjectDiagram, nameField: 'division' },
];

const EMPTY_LIST = [];

function formatPlanSizeDisplay(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n : '—';
}

function parseOptionalPlanSizeInput(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

function validateEstatePlanSizes(minRaw, maxRaw) {
  const minVal = parseOptionalPlanSizeInput(minRaw);
  if (Number.isNaN(minVal)) return 'Enter a valid min plan size (Ha)';
  const maxVal = parseOptionalPlanSizeInput(maxRaw);
  if (Number.isNaN(maxVal)) return 'Enter a valid max plan size (Ha)';
  if (minVal != null && maxVal != null && minVal > maxVal) {
    return 'Min plan size cannot exceed max plan size';
  }
  return null;
}

function estatePlanSizeSummary(estate) {
  const min = formatPlanSizeDisplay(estate?.min_plan_size);
  const max = formatPlanSizeDisplay(estate?.max_plan_size);
  if (min === '—' && max === '—') return null;
  return `Min ${min} Ha · Max ${max} Ha`;
}

function parseOptionalCoordinateInput(raw, min, max) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return NaN;
  return n;
}

function validateEstateCoordinates(latitudeRaw, longitudeRaw) {
  const lat = parseOptionalCoordinateInput(latitudeRaw, -90, 90);
  if (Number.isNaN(lat)) return 'Enter a valid latitude between -90 and 90';
  const lon = parseOptionalCoordinateInput(longitudeRaw, -180, 180);
  if (Number.isNaN(lon)) return 'Enter a valid longitude between -180 and 180';
  return null;
}

function estateCoordinateSummary(estate) {
  const lat = estate?.latitude;
  const lon = estate?.longitude;
  if (lat === null || lat === undefined || lat === '' || lon === null || lon === undefined || lon === '') {
    return null;
  }
  return `Lat ${Number(lat).toFixed(5)} · Lon ${Number(lon).toFixed(5)}`;
}

function estateCoordinatesMissing(estate) {
  const lat = estate?.latitude;
  const lon = estate?.longitude;
  return lat === null || lat === undefined || lat === '' || lon === null || lon === undefined || lon === '';
}


const DEFAULT_MAP_CENTER = [7.6140783, 80.6616211];
const SRI_LANKA_BOUNDS = [
  [5.7, 79.4],
  [10.1, 82.1],
];
const MAP_STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const MAP_SATELLITE_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const EstateCoordinateMapPicker = ({ latitude, longitude, onPick }) => {
  const parsedLat = Number(latitude);
  const parsedLon = Number(longitude);
  const hasValidCoordinate = Number.isFinite(parsedLat) && Number.isFinite(parsedLon);
  const center = DEFAULT_MAP_CENTER;
  const [satelliteEnabled, setSatelliteEnabled] = useState(false);

  const ClickHandler = () => {
    useMapEvents({
      click: (event) => {
        const { lat, lng } = event.latlng;
        onPick(lat, lng);
      },
    });
    return null;
  };

  return (
    <div className="estate-coordinate-map-wrap-map-update">
      <div className="estate-coordinate-map-toolbar-map-update">
        <button
          type="button"
          className={`btn-satellite-toggle-map-update${satelliteEnabled ? ' is-active' : ''}`}
          onClick={() => setSatelliteEnabled((prev) => !prev)}
          title={satelliteEnabled ? 'Switch to street map' : 'Switch to satellite'}
        >
          <FaGlobeAmericas />
          {satelliteEnabled ? 'Satellite: On' : 'Satellite: Off'}
        </button>
      </div>
      <MapContainer
        center={center}
        zoom={7}
        minZoom={6}
        maxZoom={18}
        maxBounds={SRI_LANKA_BOUNDS}
        maxBoundsViscosity={1.0}
        scrollWheelZoom
        className="estate-coordinate-map-map-update"
      >
        {satelliteEnabled ? (
          <>
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url={MAP_SATELLITE_URL}
              maxZoom={18}
            />
            <TileLayer
              attribution=""
              url={MAP_SATELLITE_LABELS_URL}
              maxZoom={18}
              opacity={0.9}
            />
          </>
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={MAP_STREET_URL}
          />
        )}
        <ClickHandler />
        {hasValidCoordinate ? (
          <CircleMarker
            center={[parsedLat, parsedLon]}
            radius={8}
            pathOptions={{ color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.9, weight: 2 }}
          />
        ) : null}
      </MapContainer>
      <p className="form-hint-map-update">
        Click anywhere on the map to pick location coordinates.
      </p>
    </div>
  );
};

const HIERARCHY_NAME_FIELDS = {
  group: 'group',
  plantation: 'plantation',
  region: 'region',
  estate: 'estate',
  division: 'division',
};

const HIERARCHY_LEVEL_LABELS = {
  group: 'Group',
  plantation: 'Plantation',
  region: 'Region',
  estate: 'Estate',
  division: 'Division',
};

const MappingUpdatePage = () => {

  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const userId = userData?.id || null;
  const isDeveloper = isInternalDeveloper(userData);
  const { data: featurePermissionsData = {} } = useGetMyPermissionsQuery(undefined, {
    skip: !userId,
  });

  const checkFeatureAccess = (featureCode) => {
    if (isDeveloper) return true;
    if (!featurePermissionsData || typeof featurePermissionsData !== 'object') return false;
    if (featurePermissionsData.features && featurePermissionsData.features[featureCode] === true) {
      return true;
    }
    const categories = featurePermissionsData.categories || featurePermissionsData;
    for (const category in categories) {
      if (category === 'paths' || category === 'features') continue;
      const categoryData = categories[category];
      if (Array.isArray(categoryData) && categoryData.includes(featureCode)) {
        return true;
      }
    }
    return false;
  };

  const hasAddFeature = checkFeatureAccess(FEATURE_CODES.MAPPING_UPDATE_ADD);
  const hasEditFeature = checkFeatureAccess(FEATURE_CODES.MAPPING_UPDATE_EDIT);
  const hasActivateFeature = checkFeatureAccess(FEATURE_CODES.MAPPING_UPDATE_ACTIVATE);
  const showFieldActionsColumn = hasEditFeature || hasActivateFeature;

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedPlantation, setSelectedPlantation] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedEstate, setSelectedEstate] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);

  const [fields, setFields] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [availabilityModal, setAvailabilityModal] = useState(null);
  const [availabilityDraft, setAvailabilityDraft] = useState({ can: 1, reasonId: '' });
  const [reasonManageOpen, setReasonManageOpen] = useState(false);
  const [newReasonText, setNewReasonText] = useState('');
  const [newReasonFlag, setNewReasonFlag] = useState('h');
  const [editingReasonRow, setEditingReasonRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [newItem, setNewItem] = useState({});
  const [activeCreateLevel, setActiveCreateLevel] = useState(null);
  const [estatePlanSizeModal, setEstatePlanSizeModal] = useState(null);
  const [estateCoordinateModal, setEstateCoordinateModal] = useState(null);
  const [estatePlanSizeSaving, setEstatePlanSizeSaving] = useState(false);
  const [estateCoordinateSaving, setEstateCoordinateSaving] = useState(false);
  const [divisionCoordinateModal, setDivisionCoordinateModal] = useState(null);
  const [divisionCoordinateSaving, setDivisionCoordinateSaving] = useState(false);
  const [hierarchyMapImageModal, setHierarchyMapImageModal] = useState(null);
  const [hierarchyMapImageSaving, setHierarchyMapImageSaving] = useState(false);
  const [mapImageFullscreen, setMapImageFullscreen] = useState(false);

  const { data: groupsResponse = [], isLoading: groupsLoading } = useGetMappingGroupsQuery();
  const { data: plantationsResponse = [], isLoading: plantationsLoading } = useGetMappingPlantationsByGroupQuery(selectedGroup, { skip: !selectedGroup });
  const { data: regionsResponse = [], isLoading: regionsLoading } = useGetMappingRegionsByPlantationQuery(selectedPlantation, { skip: !selectedPlantation });
  const { data: estatesResponse = [], isLoading: estatesLoading } = useGetMappingEstatesByRegionQuery(selectedRegion, { skip: !selectedRegion });
  const { data: divisionsResponse = [], isLoading: divisionsLoading } = useGetMappingDivisionsByEstateQuery(selectedEstate, { skip: !selectedEstate });
  const { data: fieldsResponse = [], isLoading: fieldsLoading, refetch: refetchFields } = useGetMappingFieldsByDivisionQuery(selectedDivision, { skip: !selectedDivision });
  const { data: missionReasonsResponse = [], refetch: refetchMappingReasons } = useGetMappingMissionPartialReasonsQuery();
  const { data: allReasonsList = [], refetch: refetchAllReasons } = useGetMissionPartialReasonsQuery({
    include_inactive: true,
  });
  const [saveMissionPartialReason, { isLoading: savingReason }] = useSaveMissionPartialReasonMutation();

  const groups = groupsResponse?.data ?? EMPTY_LIST;
  const plantations = plantationsResponse?.data ?? EMPTY_LIST;
  const regions = regionsResponse?.data ?? EMPTY_LIST;
  const estates = estatesResponse?.data ?? EMPTY_LIST;
  const divisions = divisionsResponse?.data ?? EMPTY_LIST;
  const fieldsData = fieldsResponse?.data;
  const missionReasons = missionReasonsResponse?.data ?? EMPTY_LIST;

  const [createGroup] = useCreateMappingGroupMutation();
  const [createPlantation] = useCreateMappingPlantationMutation();
  const [createRegion] = useCreateMappingRegionMutation();
  const [createEstate] = useCreateMappingEstateMutation();
  const [createDivision] = useCreateMappingDivisionMutation();
  const [createField] = useCreateMappingFieldMutation();
  const [updateEstate] = useUpdateMappingEstateMutation();
  const [updateDivision] = useUpdateMappingDivisionMutation();
  const [updateField] = useUpdateMappingFieldMutation();
  const [toggleFieldActivation] = useToggleMappingFieldActivationMutation();
  const [setEstateFinalized] = useSetMappingEstateFinalizedMutation();
  const [setEstatePlanSizes] = useSetMappingEstatePlanSizesMutation();
  const [setHierarchyMapImage] = useSetMappingHierarchyMapImageMutation();
  const [toggleGroupActivation] = useToggleMappingGroupActivationMutation();
  const [togglePlantationActivation] = useToggleMappingPlantationActivationMutation();
  const [toggleRegionActivation] = useToggleMappingRegionActivationMutation();
  const [toggleEstateActivation] = useToggleMappingEstateActivationMutation();
  const [toggleDivisionActivation] = useToggleMappingDivisionActivationMutation();
  const [triggerAllFieldsReport, { isFetching: allFieldsLoading }] = useLazyGetMappingAllFieldsReportQuery();

  useEffect(() => {
    if (!selectedDivision) {
      setFields(EMPTY_LIST);
      return;
    }
    setFields(Array.isArray(fieldsData) ? fieldsData : EMPTY_LIST);
  }, [selectedDivision, fieldsData]);

  const selectedNames = useMemo(() => {
    const names = {};
    if (selectedGroup) names.group = groups.find(g => g.id === selectedGroup)?.group;
    if (selectedPlantation) names.plantation = plantations.find(p => p.id === selectedPlantation)?.plantation;
    if (selectedRegion) names.region = regions.find(r => r.id === selectedRegion)?.region;
    if (selectedEstate) names.estate = estates.find(e => e.id === selectedEstate)?.estate;
    if (selectedDivision) names.division = divisions.find(d => d.id === selectedDivision)?.division;
    return names;
  }, [selectedGroup, selectedPlantation, selectedRegion, selectedEstate, selectedDivision, groups, plantations, regions, estates, divisions]);

  const breadcrumbs = useMemo(() => {
    const crumbs = [];
    HIERARCHY_LEVELS.forEach(level => {
      if (selectedNames[level.key]) {
        crumbs.push({ key: level.key, label: level.label, value: selectedNames[level.key], icon: level.icon });
      }
    });
    return crumbs;
  }, [selectedNames]);

  // Derives what level of cards to show based on selection depth.
  // 'fields' means a division is selected → show fields table instead of cards.
  const currentViewLevel = useMemo(() => {
    if (selectedDivision) return 'fields';
    if (selectedEstate) return 'division';
    if (selectedRegion) return 'estate';
    if (selectedPlantation) return 'region';
    if (selectedGroup) return 'plantation';
    return 'group';
  }, [selectedGroup, selectedPlantation, selectedRegion, selectedEstate, selectedDivision]);

  const currentLevelConfig = useMemo(
    () => HIERARCHY_LEVELS.find(l => l.key === currentViewLevel) || null,
    [currentViewLevel]
  );

  const handleGroupSelect = (groupId) => {
    setSelectedGroup(groupId);
    setSelectedPlantation(null);
    setSelectedRegion(null);
    setSelectedEstate(null);
    setSelectedDivision(null);
  };

  const handlePlantationSelect = (plantationId) => {
    setSelectedPlantation(plantationId);
    setSelectedRegion(null);
    setSelectedEstate(null);
    setSelectedDivision(null);
  };

  const handleRegionSelect = (regionId) => {
    setSelectedRegion(regionId);
    setSelectedEstate(null);
    setSelectedDivision(null);
  };

  const handleEstateSelect = (estateId) => {
    setSelectedEstate(estateId);
    setSelectedDivision(null);
  };

  const handleDivisionSelect = (divisionId) => {
    setSelectedDivision(divisionId);
  };

  const selectHandlers = {
    group: handleGroupSelect,
    plantation: handlePlantationSelect,
    region: handleRegionSelect,
    estate: handleEstateSelect,
    division: handleDivisionSelect,
  };

  // Navigate back to a specific breadcrumb level by clearing everything below it.
  // Clicking "Group" breadcrumb clears plantation/region/estate/division → shows Plantations.
  // Clicking "Plantation" clears region/estate/division → shows Regions. And so on.
  const handleBreadcrumbClick = (key) => {
    const levelOrder = ['group', 'plantation', 'region', 'estate', 'division'];
    const idx = levelOrder.indexOf(key);
    if (idx < 0) return;
    if (idx < 4) setSelectedDivision(null);
    if (idx < 3) setSelectedEstate(null);
    if (idx < 2) setSelectedRegion(null);
    if (idx < 1) setSelectedPlantation(null);
  };

  const handleRootClick = () => {
    setSelectedGroup(null);
    setSelectedPlantation(null);
    setSelectedRegion(null);
    setSelectedEstate(null);
    setSelectedDivision(null);
  };

  const getLevelData = (key) => {
    const map = { group: groups, plantation: plantations, region: regions, estate: estates, division: divisions };
    return map[key] || [];
  };

  const getLevelLoading = (key) => {
    const map = { group: groupsLoading, plantation: plantationsLoading, region: regionsLoading, estate: estatesLoading, division: divisionsLoading };
    return map[key] || false;
  };

  const getSelectedId = (key) => {
    const map = { group: selectedGroup, plantation: selectedPlantation, region: selectedRegion, estate: selectedEstate, division: selectedDivision };
    return map[key];
  };

  const handleCreate = async (level) => {
    try {
      let result;
      const createData = { ...newItem };

      if (level === 'plantation') createData.group = selectedGroup;
      if (level === 'region') {
        createData.group = selectedGroup;
        createData.plantation = selectedPlantation;
      }
      if (level === 'estate') {
        createData.group = selectedGroup;
        createData.plantation = selectedPlantation;
        createData.region = selectedRegion;
        const sizeErr = validateEstatePlanSizes(createData.min_plan_size, createData.max_plan_size);
        if (sizeErr) {
          toast.error(sizeErr);
          return;
        }
        createData.min_plan_size = parseOptionalPlanSizeInput(createData.min_plan_size);
        createData.max_plan_size = parseOptionalPlanSizeInput(createData.max_plan_size);
      }
      if (level === 'division') {
        createData.group = selectedGroup;
        createData.plantation = selectedPlantation;
        createData.region = selectedRegion;
        createData.estate = selectedEstate;
      }
      if (level === 'field') {
        createData.group = selectedGroup;
        createData.plantation = selectedPlantation;
        createData.region = selectedRegion;
        createData.estate = selectedEstate;
        createData.division = selectedDivision;
      }

      switch (level) {
        case 'group': result = await createGroup(createData).unwrap(); break;
        case 'plantation': result = await createPlantation(createData).unwrap(); break;
        case 'region': result = await createRegion(createData).unwrap(); break;
        case 'estate': result = await createEstate(createData).unwrap(); break;
        case 'division': result = await createDivision(createData).unwrap(); break;
        case 'field':
          result = await createField(createData).unwrap();
          refetchFields();
          break;
      }

      if (result.status) {
        toast.success(`${level.charAt(0).toUpperCase() + level.slice(1)} created successfully`);
        setNewItem({});
        setActiveCreateLevel(null);
      } else {
        toast.error(result.message || `Failed to create ${level}`);
      }
    } catch (error) {
      toast.error(`Failed to create ${level}: ${error.message}`);
    }
  };

  const handleFieldEdit = (field) => {
    setEditingField({ ...field });
  };

  const handleFieldSave = async () => {
    try {
      const dataToSave = { ...editingField };
      if (Number(dataToSave.can_spread) === 1) dataToSave.can_spread_text = null;
      else if (!dataToSave.can_spread_text) {
        toast.error('Select a spread block reason when Can Spread is No');
        return;
      }
      if (Number(dataToSave.can_spray) === 1) dataToSave.can_spray_text = null;
      else if (!dataToSave.can_spray_text) {
        toast.error('Select a spray block reason when Can Spray is No');
        return;
      }
      const result = await updateField(dataToSave).unwrap();
      if (result.status) {
        toast.success('Field updated successfully');
        setEditingField(null);
        refetchFields();
      } else {
        toast.error(result.message || 'Failed to update field');
      }
    } catch (error) {
      toast.error(`Failed to update field: ${error.message}`);
    }
  };

  const handleToggleFieldActivation = async (fieldId) => {
    try {
      const result = await toggleFieldActivation(fieldId).unwrap();
      if (result.status) {
        toast.success(result.message || 'Field status updated successfully');
        refetchFields();
      } else {
        toast.error(result.message || 'Failed to update field status');
      }
    } catch (error) {
      toast.error(`Failed to update field status: ${error.message}`);
    }
  };

  const handleToggleGroupActivation = async (groupId) => {
    try {
      const result = await toggleGroupActivation(groupId).unwrap();
      if (result.status) {
        toast.success(result.message || 'Group status updated successfully');
      } else {
        toast.error(result.message || 'Failed to update group status');
      }
    } catch (error) {
      toast.error(`Failed to update group status: ${error.message}`);
    }
  };

  const handleTogglePlantationActivation = async (plantationId) => {
    try {
      const result = await togglePlantationActivation(plantationId).unwrap();
      if (result.status) {
        toast.success(result.message || 'Plantation status updated successfully');
      } else {
        toast.error(result.message || 'Failed to update plantation status');
      }
    } catch (error) {
      toast.error(`Failed to update plantation status: ${error.message}`);
    }
  };

  const handleToggleRegionActivation = async (regionId) => {
    try {
      const result = await toggleRegionActivation(regionId).unwrap();
      if (result.status) {
        toast.success(result.message || 'Region status updated successfully');
      } else {
        toast.error(result.message || 'Failed to update region status');
      }
    } catch (error) {
      toast.error(`Failed to update region status: ${error.message}`);
    }
  };

  const handleToggleEstateActivation = async (estateId) => {
    try {
      const result = await toggleEstateActivation(estateId).unwrap();
      if (result.status) {
        toast.success(result.message || 'Estate status updated successfully');
      } else {
        toast.error(result.message || 'Failed to update estate status');
      }
    } catch (error) {
      toast.error(`Failed to update estate status: ${error.message}`);
    }
  };

  const handleToggleDivisionActivation = async (divisionId) => {
    try {
      const result = await toggleDivisionActivation(divisionId).unwrap();
      if (result.status) {
        toast.success(result.message || 'Division status updated successfully');
      } else {
        toast.error(result.message || 'Failed to update division status');
      }
    } catch (error) {
      toast.error(`Failed to update division status: ${error.message}`);
    }
  };

  const toggleHandlers = {
    group: handleToggleGroupActivation,
    plantation: handleTogglePlantationActivation,
    region: handleToggleRegionActivation,
    estate: handleToggleEstateActivation,
    division: handleToggleDivisionActivation,
  };

  const filteredFields = fields.filter(field =>
    field.field?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.short_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAvailabilityModal = (field, type) => {
    const can = type === 'spread' ? Number(field.can_spread) : Number(field.can_spray);
    const textCol = type === 'spread' ? field.can_spread_text : field.can_spray_text;
    setAvailabilityDraft({
      can: can === 1 ? 1 : 0,
      reasonId: can === 1 ? '' : String(textCol || ''),
    });
    setAvailabilityModal({ field, type });
  };

  const handleAvailabilitySave = async () => {
    if (!availabilityModal) return;
    const { field, type } = availabilityModal;
    if (availabilityDraft.can === 0 && !availabilityDraft.reasonId) {
      toast.error('Select a block reason when availability is No');
      return;
    }
    const payload = {
      id: field.id,
      can_spread: field.can_spread,
      can_spread_text: field.can_spread_text,
      can_spray: field.can_spray,
      can_spray_text: field.can_spray_text,
    };
    if (type === 'spread') {
      payload.can_spread = availabilityDraft.can;
      payload.can_spread_text = availabilityDraft.can === 1 ? null : availabilityDraft.reasonId;
    } else {
      payload.can_spray = availabilityDraft.can;
      payload.can_spray_text = availabilityDraft.can === 1 ? null : availabilityDraft.reasonId;
    }
    try {
      const result = await updateField(payload).unwrap();
      if (result.status) {
        toast.success(`${type === 'spread' ? 'Spread' : 'Spray'} availability updated`);
        setAvailabilityModal(null);
        refetchFields();
      } else {
        toast.error(result.message || 'Update failed');
      }
    } catch (error) {
      toast.error(`Update failed: ${error.message}`);
    }
  };

  const handleAddReason = async () => {
    const text = newReasonText.trim();
    if (!text) {
      toast.error('Enter reason text');
      return;
    }
    try {
      const result = await saveMissionPartialReason({
        reason: text,
        flag: newReasonFlag,
        activated: 1,
      }).unwrap();
      if (result?.status === false) {
        toast.error(result.message || 'Failed to add reason');
        return;
      }
      toast.success('Block reason added');
      setNewReasonText('');
      refetchMappingReasons();
      refetchAllReasons();
      const createdId = result?.data?.id;
      if (createdId && availabilityModal) {
        setAvailabilityDraft((d) => ({ ...d, reasonId: String(createdId) }));
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to add reason');
    }
  };

  const handleSaveReasonRow = async () => {
    if (!editingReasonRow) return;
    const text = editingReasonRow.reason?.trim();
    if (!text) {
      toast.error('Reason text is required');
      return;
    }
    try {
      const result = await saveMissionPartialReason({
        id: editingReasonRow.id,
        reason: text,
        flag: editingReasonRow.flag || 'h',
        activated: editingReasonRow.activated ?? 1,
      }).unwrap();
      if (result?.status === false) {
        toast.error(result.message || 'Failed to update reason');
        return;
      }
      toast.success('Reason updated');
      setEditingReasonRow(null);
      refetchMappingReasons();
      refetchAllReasons();
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update reason');
    }
  };

  const closeModal = () => {
    setActiveCreateLevel(null);
    setNewItem({});
    setEditingField(null);
    setEstatePlanSizeModal(null);
    setEstateCoordinateModal(null);
    setDivisionCoordinateModal(null);
    setHierarchyMapImageModal(null);
    setMapImageFullscreen(false);
    setAvailabilityModal(null);
    setReasonManageOpen(false);
    setEditingReasonRow(null);
  };

  const openEstatePlanSizeModal = (estateId) => {
    const est = estates.find((e) => e.id === estateId);
    setEstatePlanSizeModal({
      estateId,
      estateName: est?.estate || `Estate #${estateId}`,
      min_plan_size: est?.min_plan_size != null && est?.min_plan_size !== '' ? String(est.min_plan_size) : '',
      max_plan_size: est?.max_plan_size != null && est?.max_plan_size !== '' ? String(est.max_plan_size) : '',
    });
  };

  const openEstateCoordinateModal = (estateId) => {
    const est = estates.find((e) => e.id === estateId);
    setEstateCoordinateModal({
      estateId,
      estateName: est?.estate || `Estate #${estateId}`,
      latitude: est?.latitude != null && est?.latitude !== '' ? String(est.latitude) : '',
      longitude: est?.longitude != null && est?.longitude !== '' ? String(est.longitude) : '',
      showMap: false,
    });
  };

  const openDivisionCoordinateModal = (divisionId) => {
    const div = divisions.find((d) => d.id === divisionId);
    setDivisionCoordinateModal({
      divisionId,
      divisionName: div?.division || `Division #${divisionId}`,
      latitude: div?.latitude != null && div?.latitude !== '' ? String(div.latitude) : '',
      longitude: div?.longitude != null && div?.longitude !== '' ? String(div.longitude) : '',
      showMap: false,
    });
  };

  const openHierarchyMapImageModal = (level, entityId) => {
    const data = getLevelData(level);
    const item = data.find((entry) => entry.id === entityId);
    const nameField = HIERARCHY_NAME_FIELDS[level] || level;
    setHierarchyMapImageModal({
      level,
      entityId,
      entityName: item?.[nameField] || `${HIERARCHY_LEVEL_LABELS[level] || level} #${entityId}`,
      map_image: item?.map_image || '',
      previewDataUri: '',
      selectedFileName: '',
    });
  };

  const handleHierarchyMapImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, or WebP)');
      event.target.value = '';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Map image must be 15 MB or smaller');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHierarchyMapImageModal((prev) => ({
        ...prev,
        previewDataUri: reader.result,
        selectedFileName: file.name,
      }));
    };
    reader.onerror = () => toast.error('Failed to read the selected image');
    reader.readAsDataURL(file);
  };

  const handleSaveHierarchyMapImage = async () => {
    if (!hierarchyMapImageModal) return;
    const uploadPayload = hierarchyMapImageModal.previewDataUri;
    if (!uploadPayload || !String(uploadPayload).startsWith('data:')) {
      toast.error('Select a new map image to upload or update');
      return;
    }
    setHierarchyMapImageSaving(true);
    try {
      const result = await setHierarchyMapImage({
        level: hierarchyMapImageModal.level,
        id: hierarchyMapImageModal.entityId,
        map_image: uploadPayload,
      }).unwrap();
      if (result?.status) {
        toast.success(result.message || 'Map image updated');
        setHierarchyMapImageModal(null);
      } else {
        toast.error(result?.message || 'Failed to update map image');
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update map image');
    } finally {
      setHierarchyMapImageSaving(false);
    }
  };

  const hierarchyMapImagePreviewUrl = useMemo(() => {
    if (!hierarchyMapImageModal) return null;
    if (hierarchyMapImageModal.previewDataUri) return hierarchyMapImageModal.previewDataUri;
    if (hierarchyMapImageModal.map_image) {
      return getResourceUrl('HIERARCHY_MAP_IMAGE', hierarchyMapImageModal.map_image);
    }
    return null;
  }, [hierarchyMapImageModal]);

  const handleSaveDivisionCoordinates = async () => {
    if (!divisionCoordinateModal) return;
    const latRaw = divisionCoordinateModal.latitude.trim();
    const lonRaw = divisionCoordinateModal.longitude.trim();
    const coordErr = validateEstateCoordinates(latRaw, lonRaw);
    if (coordErr) {
      toast.error(coordErr);
      return;
    }
    const latitude = parseOptionalCoordinateInput(latRaw, -90, 90);
    const longitude = parseOptionalCoordinateInput(lonRaw, -180, 180);
    setDivisionCoordinateSaving(true);
    try {
      const result = await updateDivision({ id: divisionCoordinateModal.divisionId, latitude, longitude }).unwrap();
      if (result?.status) {
        toast.success(result.message || 'Division coordinates updated');
        setDivisionCoordinateModal(null);
      } else {
        toast.error(result?.message || 'Failed to update division coordinates');
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update division coordinates');
    } finally {
      setDivisionCoordinateSaving(false);
    }
  };

  const handleSaveEstatePlanSizes = async () => {
    if (!estatePlanSizeModal) return;
    const minRaw = estatePlanSizeModal.min_plan_size.trim();
    const maxRaw = estatePlanSizeModal.max_plan_size.trim();
    const sizeErr = validateEstatePlanSizes(minRaw, maxRaw);
    if (sizeErr) {
      toast.error(sizeErr);
      return;
    }
    const minVal = parseOptionalPlanSizeInput(minRaw);
    const maxVal = parseOptionalPlanSizeInput(maxRaw);
    setEstatePlanSizeSaving(true);
    try {
      const result = await setEstatePlanSizes({ id: estatePlanSizeModal.estateId, min_plan_size: minVal, max_plan_size: maxVal }).unwrap();
      if (result?.status) {
        toast.success(result.message || 'Plan size limits updated');
        setEstatePlanSizeModal(null);
      } else {
        toast.error(result?.message || 'Failed to update plan size limits');
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update plan size limits');
    } finally {
      setEstatePlanSizeSaving(false);
    }
  };

  const handleSetEstateFinalized = async (estateId, finalized) => {
    try {
      const result = await setEstateFinalized({ id: estateId, finalized }).unwrap();
      if (result?.status) {
        toast.success(result.message || (finalized ? 'Estate set as finalized' : 'Estate set as not finalized'));
      } else {
        toast.error(result?.message || 'Failed to update finalized status');
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update finalized status');
    }
  };

  const handleSaveEstateCoordinates = async () => {
    if (!estateCoordinateModal) return;
    const latRaw = estateCoordinateModal.latitude.trim();
    const lonRaw = estateCoordinateModal.longitude.trim();
    const coordErr = validateEstateCoordinates(latRaw, lonRaw);
    if (coordErr) {
      toast.error(coordErr);
      return;
    }
    const latitude = parseOptionalCoordinateInput(latRaw, -90, 90);
    const longitude = parseOptionalCoordinateInput(lonRaw, -180, 180);
    setEstateCoordinateSaving(true);
    try {
      const result = await updateEstate({ id: estateCoordinateModal.estateId, latitude, longitude }).unwrap();
      if (result?.status) {
        toast.success(result.message || 'Estate coordinates updated');
        setEstateCoordinateModal(null);
      } else {
        toast.error(result?.message || 'Failed to update estate coordinates');
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to update estate coordinates');
    } finally {
      setEstateCoordinateSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!filteredFields.length) return;

    const divisionName = selectedNames.division || 'Fields';
    downloadMappingFieldsExcel({
      fields: filteredFields,
      missionReasons,
      hierarchy: selectedNames,
      searchTerm,
      filename: `${divisionName}_fields.xlsx`,
      detailSheetName: divisionName,
      title: 'Mapping Update — Division Fields Report',
      includeHierarchy: true,
    });
    toast.success('Fields report downloaded successfully');
  };

  const handleDownloadAllFieldsReport = async () => {
    try {
      const result = await triggerAllFieldsReport().unwrap();
      const allFields = result?.data || [];
      if (!allFields.length) {
        toast.warning('No fields data available');
        return;
      }

      downloadMappingFieldsExcel({
        fields: allFields,
        missionReasons: [],
        hierarchy: {
          group: 'All',
          plantation: 'All',
          region: 'All',
          estate: 'All',
          division: 'All divisions',
        },
        searchTerm: '',
        filename: 'All_Fields_Report.xlsx',
        detailSheetName: 'All Fields',
        title: 'Mapping Update — All Fields Report',
        includeHierarchy: true,
      });
      toast.success('All fields report downloaded successfully');
    } catch (error) {
      toast.error('Failed to download all fields report');
    }
  };

  // Add button in nav bar: for fields view open "field" modal, otherwise open the current card level modal.
  const handleNavAddClick = () => {
    const level = currentViewLevel === 'fields' ? 'field' : currentViewLevel;
    setActiveCreateLevel(level);
    setNewItem({});
  };

  return (
    <div className="page-map-update">

      {/* ===== TOP 10% NAVIGATION BAR ===== */}
      <MappingHierarchyNav
        breadcrumbs={breadcrumbs}
        currentViewLevel={currentViewLevel}
        onRootClick={handleRootClick}
        onBreadcrumbClick={handleBreadcrumbClick}
        onAddClick={handleNavAddClick}
        hasAddFeature={hasAddFeature}
        onAllFieldsReport={handleDownloadAllFieldsReport}
        allFieldsLoading={allFieldsLoading}
      />

      {/* ===== BOTTOM 90% CONTENT PANE ===== */}
      <section className="content-pane-map-update">
        {currentViewLevel === 'fields' ? (
          <MappingFieldsPanel
            filteredFields={filteredFields}
            fieldsLoading={fieldsLoading}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedDivision={selectedDivision}
            hasEditFeature={hasEditFeature}
            hasActivateFeature={hasActivateFeature}
            hasAddFeature={hasAddFeature}
            showFieldActionsColumn={showFieldActionsColumn}
            missionReasons={missionReasons}
            onFieldEdit={handleFieldEdit}
            onAvailabilityModal={openAvailabilityModal}
            onToggleFieldActivation={handleToggleFieldActivation}
            onAddField={() => { setActiveCreateLevel('field'); setNewItem({}); }}
            onDownloadExcel={handleDownloadExcel}
            onBlockReasons={() => setReasonManageOpen(true)}
          />
        ) : (
          currentLevelConfig && (
            <MappingHierarchyCardGrid
              level={currentViewLevel}
              levelConfig={currentLevelConfig}
              data={getLevelData(currentViewLevel)}
              loading={getLevelLoading(currentViewLevel)}
              selectedId={getSelectedId(currentViewLevel)}
              onSelect={selectHandlers[currentViewLevel]}
              onToggleActivation={toggleHandlers[currentViewLevel]}
              hasActivateFeature={hasActivateFeature}
              hasEditFeature={hasEditFeature}
              hasAddFeature={hasAddFeature}
              onPlanSizeModal={openEstatePlanSizeModal}
              onCoordinateModal={currentViewLevel === 'estate' ? openEstateCoordinateModal : openDivisionCoordinateModal}
              onMapImageModal={openHierarchyMapImageModal}
              onSetFinalized={handleSetEstateFinalized}
              estatePlanSizeSummary={estatePlanSizeSummary}
              estateCoordinateSummary={estateCoordinateSummary}
              estateCoordinatesMissing={estateCoordinatesMissing}
              animKey={`${currentViewLevel}-${selectedGroup}-${selectedPlantation}-${selectedRegion}-${selectedEstate}`}
            />
          )
        )}
      </section>

      {/* ===== CREATE MODAL ===== */}
      {activeCreateLevel && hasAddFeature && (
        <div className="modal-overlay-map-update" onClick={closeModal}>
          <div className="modal-map-update" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-map-update">
              <h3 className="modal-title-map-update">
                <FaPlus className="modal-title-icon-map-update" />
                Create New {activeCreateLevel.charAt(0).toUpperCase() + activeCreateLevel.slice(1)}
              </h3>
              <button onClick={closeModal} className="modal-close-map-update">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-map-update">
              <div className="form-group-map-update">
                <label className="label-map-update">{activeCreateLevel.charAt(0).toUpperCase() + activeCreateLevel.slice(1)} Name</label>
                <input
                  type="text"
                  className="input-map-update"
                  placeholder={`Enter ${activeCreateLevel} name`}
                  value={newItem[activeCreateLevel] || ''}
                  onChange={(e) => setNewItem({ ...newItem, [activeCreateLevel]: e.target.value })}
                  autoFocus
                />
              </div>
              {activeCreateLevel === 'estate' && (
                <>
                  <div className="form-row-two-map-update">
                    <div className="form-group-map-update">
                      <label className="label-map-update">Min plan size (Ha)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input-map-update"
                        placeholder="Optional"
                        value={newItem.min_plan_size ?? ''}
                        onChange={(e) => setNewItem({ ...newItem, min_plan_size: e.target.value })}
                      />
                    </div>
                    <div className="form-group-map-update">
                      <label className="label-map-update">Max plan size (Ha)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input-map-update"
                        placeholder="Optional"
                        value={newItem.max_plan_size ?? ''}
                        onChange={(e) => setNewItem({ ...newItem, max_plan_size: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="form-hint-map-update">Used for estate manager plan approval area limits.</p>
                </>
              )}
              {activeCreateLevel === 'field' && (
                <>
                  <div className="form-group-map-update">
                    <label className="label-map-update">Short Name</label>
                    <input
                      type="text"
                      className="input-map-update"
                      placeholder="Enter short name"
                      value={newItem.short_name || ''}
                      onChange={(e) => setNewItem({ ...newItem, short_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group-map-update">
                    <label className="label-map-update">Area</label>
                    <input
                      type="number"
                      className="input-map-update"
                      placeholder="Enter area"
                      value={newItem.area || ''}
                      onChange={(e) => setNewItem({ ...newItem, area: parseFloat(e.target.value) })}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer-map-update">
              <button onClick={closeModal} className="btn-ghost-map-update">Cancel</button>
              <button onClick={() => handleCreate(activeCreateLevel)} className="btn-primary-map-update">
                <FaSave /> Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ESTATE PLAN SIZE MODAL ===== */}
      {estatePlanSizeModal && hasEditFeature && (
        <div className="modal-overlay-map-update" onClick={closeModal}>
          <div className="modal-map-update" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-map-update">
              <h3 className="modal-title-map-update">
                <FaEdit className="modal-title-icon-map-update" />
                Plan size limits — {estatePlanSizeModal.estateName}
              </h3>
              <button type="button" onClick={closeModal} className="modal-close-map-update">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-map-update">
              <div className="form-row-two-map-update">
                <div className="form-group-map-update">
                  <label className="label-map-update">Min plan size (Ha)</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="input-map-update"
                    placeholder="Leave empty for no minimum"
                    value={estatePlanSizeModal.min_plan_size}
                    onChange={(e) => setEstatePlanSizeModal({ ...estatePlanSizeModal, min_plan_size: e.target.value })}
                  />
                </div>
                <div className="form-group-map-update">
                  <label className="label-map-update">Max plan size (Ha)</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="input-map-update"
                    placeholder="Leave empty for no maximum"
                    value={estatePlanSizeModal.max_plan_size}
                    onChange={(e) => setEstatePlanSizeModal({ ...estatePlanSizeModal, max_plan_size: e.target.value })}
                  />
                </div>
              </div>
              <p className="form-hint-map-update">
                Limits apply when estate managers approve plantation plans for this estate.
              </p>
            </div>
            <div className="modal-footer-map-update">
              <button type="button" onClick={closeModal} className="btn-ghost-map-update">Cancel</button>
              <button type="button" onClick={handleSaveEstatePlanSizes} className="btn-primary-map-update" disabled={estatePlanSizeSaving}>
                <FaSave /> {estatePlanSizeSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== HIERARCHY MAP IMAGE MODAL ===== */}
      {hierarchyMapImageModal && hasEditFeature && (
        <div className="modal-overlay-map-update" onClick={closeModal}>
          <div className="modal-map-update modal-map-image-full-map-update" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-map-update">
              <h3 className="modal-title-map-update">
                <FaImage className="modal-title-icon-map-update" />
                {HIERARCHY_LEVEL_LABELS[hierarchyMapImageModal.level] || 'Item'} map — {hierarchyMapImageModal.entityName}
              </h3>
              <div className="map-image-header-actions-map-update">
                {hierarchyMapImagePreviewUrl && (
                  <button
                    type="button"
                    className="btn-ghost-sm-map-update"
                    onClick={() => setMapImageFullscreen(true)}
                    title="View full size"
                  >
                    <FaExpand /> Full view
                  </button>
                )}
                <button type="button" onClick={closeModal} className="modal-close-map-update">
                  <FaTimes />
                </button>
              </div>
            </div>
            <div className="modal-body-map-update map-image-body-map-update">
              {hierarchyMapImagePreviewUrl ? (
                <div
                  className="map-image-viewer-map-update"
                  role="button"
                  tabIndex={0}
                  onClick={() => setMapImageFullscreen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMapImageFullscreen(true);
                    }
                  }}
                  title="Click to view full size"
                >
                  <img
                    src={hierarchyMapImagePreviewUrl}
                    alt={`${hierarchyMapImageModal.entityName} map`}
                    className="map-image-viewer-img-map-update"
                  />
                  <span className="map-image-viewer-hint-map-update">Click image for full view</span>
                </div>
              ) : (
                <div className="estate-map-image-empty-map-update map-image-viewer-empty-map-update">
                  <FaImage className="estate-map-image-empty-icon-map-update" />
                  <p>No map image uploaded yet</p>
                </div>
              )}

              <div className="map-image-upload-panel-map-update">
                <div className="form-group-map-update">
                  <label className="label-map-update">
                    {hierarchyMapImageModal.map_image ? 'Replace map image' : 'Upload map image'}
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    className="input-map-update estate-map-image-file-input-map-update"
                    onChange={handleHierarchyMapImageFileChange}
                  />
                  {hierarchyMapImageModal.selectedFileName && (
                    <p className="form-hint-map-update">Selected: {hierarchyMapImageModal.selectedFileName}</p>
                  )}
                  {hierarchyMapImageModal.map_image && !hierarchyMapImageModal.previewDataUri && (
                    <p className="form-hint-map-update">Current file: {hierarchyMapImageModal.map_image}</p>
                  )}
                </div>
                <p className="form-hint-map-update">
                  Stored as filename only ({hierarchyMapImageModal.level}-name-YYYY-MM-DD.jpg). Max size 15 MB. JPG, PNG, or WebP.
                </p>
              </div>
            </div>
            <div className="modal-footer-map-update">
              <button type="button" onClick={closeModal} className="btn-ghost-map-update">Cancel</button>
              <button
                type="button"
                onClick={handleSaveHierarchyMapImage}
                className="btn-primary-map-update"
                disabled={hierarchyMapImageSaving || !hierarchyMapImageModal.previewDataUri}
              >
                <FaSave /> {hierarchyMapImageSaving ? 'Uploading...' : (hierarchyMapImageModal.map_image ? 'Update Map' : 'Upload Map')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MAP IMAGE FULLSCREEN VIEWER ===== */}
      {mapImageFullscreen && hierarchyMapImagePreviewUrl && (
        <div
          className="map-image-fullscreen-map-update"
          onClick={() => setMapImageFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Map image full view"
        >
          <button
            type="button"
            className="map-image-fullscreen-close-map-update"
            onClick={() => setMapImageFullscreen(false)}
            title="Close full view"
          >
            <FaTimes />
          </button>
          <img
            src={hierarchyMapImagePreviewUrl}
            alt={`${hierarchyMapImageModal?.entityName || 'Map'} full view`}
            className="map-image-fullscreen-img-map-update"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ===== ESTATE COORDINATE MODAL ===== */}
      {estateCoordinateModal && hasEditFeature && (
        <div className="modal-overlay-map-update" onClick={closeModal}>
          <div className="modal-map-update modal-map-coordinate-large-map-update" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-map-update">
              <h3 className="modal-title-map-update">
                <FaEdit className="modal-title-icon-map-update" />
                Estate coordinates — {estateCoordinateModal.estateName}
              </h3>
              <button type="button" onClick={closeModal} className="modal-close-map-update">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-map-update">
              <div className="form-row-two-map-update">
                <div className="form-group-map-update">
                  <label className="label-map-update">Latitude</label>
                  <input
                    type="number" min="-90" max="90" step="0.0000001"
                    className="input-map-update" placeholder="e.g. 6.8747931"
                    value={estateCoordinateModal.latitude}
                    onChange={(e) => setEstateCoordinateModal({ ...estateCoordinateModal, latitude: e.target.value })}
                  />
                </div>
                <div className="form-group-map-update">
                  <label className="label-map-update">Longitude</label>
                  <input
                    type="number" min="-180" max="180" step="0.0000001"
                    className="input-map-update" placeholder="e.g. 79.8887541"
                    value={estateCoordinateModal.longitude}
                    onChange={(e) => setEstateCoordinateModal({ ...estateCoordinateModal, longitude: e.target.value })}
                  />
                </div>
              </div>
              <div className="estate-coordinate-actions-map-update">
                <button
                  type="button"
                  className="btn-map-toggle-map-update"
                  onClick={() => setEstateCoordinateModal((prev) => ({ ...prev, showMap: !prev.showMap }))}
                >
                  <FaMap />
                  {estateCoordinateModal.showMap ? 'Hide Map Picker' : 'Open Map Picker'}
                </button>
                <span className="form-hint-map-update">
                  Picked: {estateCoordinateModal.latitude || '—'}, {estateCoordinateModal.longitude || '—'}
                </span>
              </div>
              {estateCoordinateModal.showMap && (
                <EstateCoordinateMapPicker
                  latitude={estateCoordinateModal.latitude}
                  longitude={estateCoordinateModal.longitude}
                  onPick={(lat, lon) =>
                    setEstateCoordinateModal((prev) => ({
                      ...prev,
                      latitude: lat.toFixed(7),
                      longitude: lon.toFixed(7),
                    }))
                  }
                />
              )}
              <p className="form-hint-map-update">
                Leave empty to clear coordinates. Weather forecast uses these values for this estate.
              </p>
            </div>
            <div className="modal-footer-map-update">
              <button type="button" onClick={closeModal} className="btn-ghost-map-update">Cancel</button>
              <button type="button" onClick={handleSaveEstateCoordinates} className="btn-primary-map-update" disabled={estateCoordinateSaving}>
                <FaSave /> {estateCoordinateSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DIVISION COORDINATE MODAL ===== */}
      {divisionCoordinateModal && hasEditFeature && (
        <div className="modal-overlay-map-update" onClick={closeModal}>
          <div className="modal-map-update modal-map-coordinate-large-map-update" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-map-update">
              <h3 className="modal-title-map-update">
                <FaEdit className="modal-title-icon-map-update" />
                Division coordinates — {divisionCoordinateModal.divisionName}
              </h3>
              <button type="button" onClick={closeModal} className="modal-close-map-update">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-map-update">
              <div className="form-row-two-map-update">
                <div className="form-group-map-update">
                  <label className="label-map-update">Latitude</label>
                  <input
                    type="number" min="-90" max="90" step="0.0000001"
                    className="input-map-update" placeholder="e.g. 6.8747931"
                    value={divisionCoordinateModal.latitude}
                    onChange={(e) => setDivisionCoordinateModal({ ...divisionCoordinateModal, latitude: e.target.value })}
                  />
                </div>
                <div className="form-group-map-update">
                  <label className="label-map-update">Longitude</label>
                  <input
                    type="number" min="-180" max="180" step="0.0000001"
                    className="input-map-update" placeholder="e.g. 79.8887541"
                    value={divisionCoordinateModal.longitude}
                    onChange={(e) => setDivisionCoordinateModal({ ...divisionCoordinateModal, longitude: e.target.value })}
                  />
                </div>
              </div>
              <div className="estate-coordinate-actions-map-update">
                <button
                  type="button"
                  className="btn-map-toggle-map-update"
                  onClick={() => setDivisionCoordinateModal((prev) => ({ ...prev, showMap: !prev.showMap }))}
                >
                  <FaMap />
                  {divisionCoordinateModal.showMap ? 'Hide Map Picker' : 'Open Map Picker'}
                </button>
                <span className="form-hint-map-update">
                  Picked: {divisionCoordinateModal.latitude || '—'}, {divisionCoordinateModal.longitude || '—'}
                </span>
              </div>
              {divisionCoordinateModal.showMap && (
                <EstateCoordinateMapPicker
                  latitude={divisionCoordinateModal.latitude}
                  longitude={divisionCoordinateModal.longitude}
                  onPick={(lat, lon) =>
                    setDivisionCoordinateModal((prev) => ({
                      ...prev,
                      latitude: lat.toFixed(7),
                      longitude: lon.toFixed(7),
                    }))
                  }
                />
              )}
              <p className="form-hint-map-update">
                Leave empty to clear coordinates. Weather prediction uses these values for this division.
              </p>
            </div>
            <div className="modal-footer-map-update">
              <button type="button" onClick={closeModal} className="btn-ghost-map-update">Cancel</button>
              <button type="button" onClick={handleSaveDivisionCoordinates} className="btn-primary-map-update" disabled={divisionCoordinateSaving}>
                <FaSave /> {divisionCoordinateSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FIELD AVAILABILITY / REASON MODAL ===== */}
      {availabilityModal && hasEditFeature && (
        <div className="modal-overlay-map-update" onClick={closeModal}>
          <div className="modal-map-update" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-map-update">
              <h3 className="modal-title-map-update">
                {availabilityModal.type === 'spread' ? 'Can spread' : 'Can spray'} —{' '}
                {availabilityModal.field.field || availabilityModal.field.short_name}
              </h3>
              <button type="button" onClick={closeModal} className="modal-close-map-update">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-map-update">
              <div className="form-group-map-update">
                <label className="label-map-update">Available for {availabilityModal.type === 'spread' ? 'spread' : 'spray'}?</label>
                <select
                  className="input-map-update"
                  value={availabilityDraft.can}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setAvailabilityDraft({ can: val, reasonId: val === 1 ? '' : availabilityDraft.reasonId });
                  }}
                >
                  <option value={1}>Yes</option>
                  <option value={0}>No — blocked</option>
                </select>
              </div>
              {availabilityDraft.can === 0 && (
                <>
                  <div className="form-group-map-update">
                    <label className="label-map-update">Block reason</label>
                    <select
                      className="input-map-update"
                      value={availabilityDraft.reasonId}
                      onChange={(e) => setAvailabilityDraft({ ...availabilityDraft, reasonId: e.target.value })}
                    >
                      <option value="">Select reason</option>
                      {missionReasons.map((reason) => (
                        <option key={reason.id} value={reason.id}>{reason.reason}</option>
                      ))}
                    </select>
                  </div>
                  <div className="reason-add-row-map-update">
                    <input
                      type="text"
                      className="input-map-update"
                      placeholder="New reason text"
                      value={newReasonText}
                      onChange={(e) => setNewReasonText(e.target.value)}
                    />
                    <select
                      className="input-map-update reason-flag-select-map-update"
                      value={newReasonFlag}
                      onChange={(e) => setNewReasonFlag(e.target.value)}
                      title="Reason flag"
                    >
                      <option value="h">Partial (h)</option>
                      <option value="c">Cancel (c)</option>
                    </select>
                    <button type="button" className="btn-primary-sm-map-update" onClick={handleAddReason} disabled={savingReason}>
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer-map-update">
              <button type="button" onClick={closeModal} className="btn-ghost-map-update">Cancel</button>
              <button type="button" onClick={handleAvailabilitySave} className="btn-primary-map-update">
                <FaSave /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MANAGE BLOCK REASONS MODAL ===== */}
      {reasonManageOpen && hasEditFeature && (
        <div className="modal-overlay-map-update" onClick={closeModal}>
          <div className="modal-map-update modal-wide-map-update" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-map-update">
              <h3 className="modal-title-map-update">Block reasons catalog</h3>
              <button type="button" onClick={closeModal} className="modal-close-map-update">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-map-update">
              <div className="reason-add-row-map-update">
                <input
                  type="text"
                  className="input-map-update"
                  placeholder="New reason description"
                  value={newReasonText}
                  onChange={(e) => setNewReasonText(e.target.value)}
                />
                <select
                  className="input-map-update reason-flag-select-map-update"
                  value={newReasonFlag}
                  onChange={(e) => setNewReasonFlag(e.target.value)}
                >
                  <option value="h">Partial (h)</option>
                  <option value="c">Cancel (c)</option>
                </select>
                <button type="button" className="btn-primary-sm-map-update" onClick={handleAddReason} disabled={savingReason}>
                  <FaPlus /> Add reason
                </button>
              </div>
              <div className="reason-list-map-update">
                {(allReasonsList || []).map((r) => (
                  <div key={r.id} className="reason-list-row-map-update">
                    {editingReasonRow?.id === r.id ? (
                      <>
                        <input
                          type="text"
                          className="input-map-update"
                          value={editingReasonRow.reason}
                          onChange={(e) => setEditingReasonRow({ ...editingReasonRow, reason: e.target.value })}
                        />
                        <select
                          className="input-map-update reason-flag-select-map-update"
                          value={editingReasonRow.flag || 'h'}
                          onChange={(e) => setEditingReasonRow({ ...editingReasonRow, flag: e.target.value })}
                        >
                          <option value="h">Partial (h)</option>
                          <option value="c">Cancel (c)</option>
                        </select>
                        <button type="button" className="btn-primary-sm-map-update" onClick={handleSaveReasonRow} disabled={savingReason}>Save</button>
                        <button type="button" className="btn-ghost-sm-map-update" onClick={() => setEditingReasonRow(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className={`reason-list-text-map-update ${r.activated === 0 ? 'reason-list-text--inactive-map-update' : ''}`}>
                          {r.reason}
                          <span className="reason-list-flag-map-update"> ({r.flag})</span>
                        </span>
                        <button
                          type="button"
                          className="btn-icon-edit-map-update"
                          title="Edit reason"
                          onClick={() => setEditingReasonRow({ id: r.id, reason: r.reason, flag: r.flag, activated: r.activated })}
                        >
                          <FaEdit />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer-map-update">
              <button type="button" onClick={closeModal} className="btn-ghost-map-update">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT FIELD MODAL ===== */}
      {editingField && hasEditFeature && (
        <div className="modal-overlay-map-update" onClick={closeModal}>
          <div className="modal-map-update modal-wide-map-update" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-map-update">
              <h3 className="modal-title-map-update">
                <FaEdit className="modal-title-icon-map-update" />
                Edit Field - {editingField.field}
              </h3>
              <button onClick={closeModal} className="modal-close-map-update">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-map-update">
              <div className="modal-form-grid-map-update">
                <div className="form-group-map-update">
                  <label className="label-map-update">Field Name</label>
                  <input
                    type="text" className="input-map-update"
                    value={editingField.field || ''}
                    onChange={(e) => setEditingField({ ...editingField, field: e.target.value })}
                  />
                </div>
                <div className="form-group-map-update">
                  <label className="label-map-update">Short Name</label>
                  <input
                    type="text" className="input-map-update"
                    value={editingField.short_name || ''}
                    onChange={(e) => setEditingField({ ...editingField, short_name: e.target.value })}
                  />
                </div>
                <div className="form-group-map-update">
                  <label className="label-map-update">Area</label>
                  <input
                    type="number" className="input-map-update"
                    value={editingField.area || ''}
                    onChange={(e) => setEditingField({ ...editingField, area: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="modal-form-grid-map-update">
                <div className="form-group-map-update">
                  <label className="label-map-update">Can Spread</label>
                  <select
                    className="input-map-update"
                    value={editingField.can_spread || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setEditingField({ ...editingField, can_spread: val, can_spread_text: val === 1 ? null : editingField.can_spread_text });
                    }}
                  >
                    <option value={1}>Yes</option>
                    <option value={0}>No</option>
                  </select>
                </div>
                <div className="form-group-map-update">
                  <label className="label-map-update">Spread Reason</label>
                  <select
                    className="input-map-update"
                    value={editingField.can_spread === 1 ? '' : (editingField.can_spread_text || '')}
                    onChange={(e) => setEditingField({ ...editingField, can_spread_text: e.target.value || null })}
                    disabled={editingField.can_spread === 1}
                  >
                    <option value="">Select Reason</option>
                    {missionReasons.map(reason => (
                      <option key={reason.id} value={reason.id}>{reason.reason}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group-map-update">
                  <label className="label-map-update">Can Spray</label>
                  <select
                    className="input-map-update"
                    value={editingField.can_spray || 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setEditingField({ ...editingField, can_spray: val, can_spray_text: val === 1 ? null : editingField.can_spray_text });
                    }}
                  >
                    <option value={1}>Yes</option>
                    <option value={0}>No</option>
                  </select>
                </div>
                <div className="form-group-map-update">
                  <label className="label-map-update">Spray Reason</label>
                  <select
                    className="input-map-update"
                    value={editingField.can_spray === 1 ? '' : (editingField.can_spray_text || '')}
                    onChange={(e) => setEditingField({ ...editingField, can_spray_text: e.target.value || null })}
                    disabled={editingField.can_spray === 1}
                  >
                    <option value="">Select Reason</option>
                    {missionReasons.map(reason => (
                      <option key={reason.id} value={reason.id}>{reason.reason}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer-map-update">
              <button onClick={closeModal} className="btn-ghost-map-update">Cancel</button>
              <button onClick={handleFieldSave} className="btn-primary-map-update">
                <FaSave /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MappingUpdatePage;
