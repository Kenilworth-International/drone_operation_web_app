import React, { useEffect, useMemo, useState } from 'react';
import {
  useGetVehicleAppSummaryQuery,
  useGetVehicleAppVehiclesQuery,
  useGetVehicleAppDriversQuery,
  useGetVehicleAppVehicleCategoriesQuery,
  useSaveVehicleAppVehicleCategoryMutation,
  useGetVehicleAppMaintenanceCategoriesQuery,
  useSaveVehicleAppMaintenanceCategoryMutation,
  useGetVehicleAppMaintenanceRequestsQuery,
  useDecideVehicleAppMaintenanceRequestMutation,
} from '../../../api/services NodeJs/vehicleAppApi';
import {
  useGetPoolRequestCategoriesQuery,
  useSavePoolRequestCategoryMutation,
} from '../../../api/services NodeJs/poolVehicleTaskApi';
import {
  useGetWingsQuery as useGetLegacyWingsQuery,
} from '../../../api/services/assetsApi';
import {
  useGetWingsQuery,
  useSaveWingMutation,
  useGetAllEmployeeRegistrationsQuery,
  useGetWorkLocationsQuery,
  useSaveWorkLocationMutation,
  useGetVehicleCategoriesQuery as useGetMasterVehicleCategoriesQuery,
  useSaveVehicleCategoryMutation as useSaveMasterVehicleCategoryMutation,
  useGetVehicleMakesQuery as useGetMasterVehicleMakesQuery,
  useSaveVehicleMakeMutation as useSaveMasterVehicleMakeMutation,
  useGetVehicleModelsQuery as useGetMasterVehicleModelsQuery,
  useSaveVehicleModelMutation as useSaveMasterVehicleModelMutation,
  useGetFinanceCategoriesMasterQuery,
  useSaveFinanceCategoryMasterMutation,
  useGetFinanceSubCategoriesMasterQuery,
  useSaveFinanceSubCategoryMasterMutation,
} from '../../../api/services NodeJs/jdManagementApi';
import {
  useGetSecurityCodeListQuery,
  useResetSecurityCodeMutation,
} from '../../../api/services NodeJs/financialCardsApi';
import {
  useGetMissionPartialReasonsQuery,
  useSaveMissionPartialReasonMutation,
  useGetNotSprayingRecensQuery,
  useSaveNotSprayingRecenMutation,
  useGetDeactivateReasonsQuery,
  useSaveDeactivateReasonMutation,
} from '../../../api/services NodeJs/reasonsApi';
import {
  useGetChemicalsQuery,
  useCreateChemicalMutation,
  useUpdateChemicalMutation,
} from '../../../api/services NodeJs/chemicalsApi';
import {
  useGetTimeOfDaysQuery,
  useCreateTimeOfDayMutation,
  useUpdateTimeOfDayMutation,
} from '../../../api/services NodeJs/timeOfDaysApi';
import HrMasterOptionsPanel from './HrMasterOptionsPanel';
import KpiDefinitionsPanel from './KpiDefinitionsPanel';
import KpiRatingBandsPanel from './KpiRatingBandsPanel';
import SmartKpiTemplatesPanel from './SmartKpiTemplatesPanel';
import SmartKpiFieldTypesPanel from './SmartKpiFieldTypesPanel';
import LocationHierarchyPanel from './LocationHierarchyPanel';
import FuelTypesMasterPanel from './FuelTypesMasterPanel';
import { useSendMessageMutation } from '../../../api/services/authApi';
import {
  useGetInvoiceOrganizationsQuery,
  useSaveInvoiceOrganizationMutation,
  useGetInvoiceTaxTypesQuery,
  useSaveInvoiceTaxTypeMutation,
} from '../../../api/services NodeJs/plantationInvoiceApi';
import '../../../styles/masterdata.css';
import '../../../styles/ictLogsMasterGlass.css';

const TAB_CONFIG = {
  full: ['overview', 'masters', 'vehicles', 'maintenance'],
  operations: ['overview', 'vehicles', 'maintenance'],
  masters: ['masters'],
};

const MasterData = ({ mode = 'full' }) => {
  const tabs = TAB_CONFIG[mode] || TAB_CONFIG.full;
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [yearMonth] = useState('');
  const [selectedMasterModule, setSelectedMasterModule] = useState('vehicleMaster');
  const [selectedFinanceCategoryId, setSelectedFinanceCategoryId] = useState('1');
  const [activeReasonsTab, setActiveReasonsTab] = useState('pilotOps');
  const [reasonSearch, setReasonSearch] = useState('');
  const [reasonFlagFilter, setReasonFlagFilter] = useState('all');

  const { data: summary = {} } = useGetVehicleAppSummaryQuery(yearMonth);
  const { data: vehicles = [] } = useGetVehicleAppVehiclesQuery();
  const { data: drivers = [] } = useGetVehicleAppDriversQuery();
  const { data: vehicleCategories = [] } = useGetVehicleAppVehicleCategoriesQuery();
  const { data: maintenanceCategories = [], refetch: refetchMaintenanceCategories } = useGetVehicleAppMaintenanceCategoriesQuery();
  const { data: poolRequestCategories = [], refetch: refetchPoolRequestCategories } = useGetPoolRequestCategoriesQuery(false);
  const [savePoolRequestCategory] = useSavePoolRequestCategoryMutation();
  const { data: maintenanceRequests = [] } = useGetVehicleAppMaintenanceRequestsQuery(yearMonth);
  const { data: wingsData, refetch: refetchWings } = useGetWingsQuery();
  const { data: legacyWingsData } = useGetLegacyWingsQuery();
  const { data: employeesData } = useGetAllEmployeeRegistrationsQuery();
  const { data: workLocationsData, refetch: refetchWorkLocations } = useGetWorkLocationsQuery();
  const { data: masterVehicleCategoriesData = [], refetch: refetchMasterVehicleCategories } = useGetMasterVehicleCategoriesQuery();
  const { data: masterVehicleMakesData = [], refetch: refetchMasterVehicleMakes } = useGetMasterVehicleMakesQuery();
  const { data: masterVehicleModelsData = [], refetch: refetchMasterVehicleModels } = useGetMasterVehicleModelsQuery();
  const { data: financeCategoriesMaster = [], refetch: refetchFinanceCategoriesMaster } =
    useGetFinanceCategoriesMasterQuery(undefined, { skip: activeTab !== 'masters' });
  const { data: financeSubCategoriesMaster = [], refetch: refetchFinanceSubCategoriesMaster } =
    useGetFinanceSubCategoriesMasterQuery(
      { finance_category: selectedFinanceCategoryId ? Number(selectedFinanceCategoryId) : null },
      { skip: activeTab !== 'masters' || selectedMasterModule !== 'financeSubCategories' }
    );
  const [saveFinanceCategoryMaster] = useSaveFinanceCategoryMasterMutation();
  const [saveFinanceSubCategoryMaster] = useSaveFinanceSubCategoryMasterMutation();
  const { data: missionPartialReasons = [] } = useGetMissionPartialReasonsQuery({ include_inactive: true });
  const { data: notSprayingRecens = [] } = useGetNotSprayingRecensQuery({ include_inactive: true });
  const { data: deactivateReasons = [] } = useGetDeactivateReasonsQuery({ include_inactive: true });
  const { data: chemicalsRaw = [], refetch: refetchChemicals } = useGetChemicalsQuery(
    { include_inactive: true },
    { skip: activeTab !== 'masters' }
  );
  const { data: timeOfDaysRaw = [], refetch: refetchTimeOfDays } = useGetTimeOfDaysQuery(
    { include_inactive: true },
    { skip: activeTab !== 'masters' }
  );
  const { data: invoiceOrgsRaw = [], refetch: refetchInvoiceOrgs } = useGetInvoiceOrganizationsQuery(
    { includeInactive: true },
    { skip: activeTab !== 'masters' }
  );
  const { data: invoiceTaxesRaw = [], refetch: refetchInvoiceTaxes } = useGetInvoiceTaxTypesQuery(
    { includeInactive: true },
    { skip: activeTab !== 'masters' }
  );
  const wings = useMemo(() => {
    const fromJd = Array.isArray(wingsData)
      ? wingsData
      : Array.isArray(wingsData?.data)
        ? wingsData.data
        : Array.isArray(wingsData?.wings)
          ? wingsData.wings
          : [];
    if (fromJd.length > 0) return fromJd;

    const fromLegacy = Array.isArray(legacyWingsData)
      ? legacyWingsData
      : Array.isArray(legacyWingsData?.wings)
        ? legacyWingsData.wings
        : Array.isArray(legacyWingsData?.data)
          ? legacyWingsData.data
          : [];
    if (fromLegacy.length > 0) return fromLegacy;

    return [];
  }, [wingsData, legacyWingsData]);
  const employees = useMemo(() => {
    if (!employeesData) return [];
    if (Array.isArray(employeesData)) return employeesData;
    if (Array.isArray(employeesData?.data)) return employeesData.data;
    return [];
  }, [employeesData]);
  const workLocations = useMemo(() => {
    if (!workLocationsData) return [];
    if (Array.isArray(workLocationsData)) return workLocationsData;
    if (Array.isArray(workLocationsData?.data)) return workLocationsData.data;
    return [];
  }, [workLocationsData]);

  const chemicals = useMemo(() => {
    const raw = Array.isArray(chemicalsRaw) ? chemicalsRaw : [];
    return [...raw].sort((a, b) => {
      const pa = Number(a.priority) || 0;
      const pb = Number(b.priority) || 0;
      if (pa !== pb) return pa - pb;
      return String(a.chemical || '').localeCompare(String(b.chemical || ''), undefined, { sensitivity: 'base' });
    });
  }, [chemicalsRaw]);

  const workingTimes = useMemo(() => {
    const raw = Array.isArray(timeOfDaysRaw) ? timeOfDaysRaw : [];
    return [...raw].sort((a, b) => Number(a.id) - Number(b.id));
  }, [timeOfDaysRaw]);

  const invoiceOrganizations = useMemo(() => {
    const raw = Array.isArray(invoiceOrgsRaw) ? invoiceOrgsRaw : [];
    return [...raw].sort((a, b) => String(a.org_name || '').localeCompare(String(b.org_name || ''), undefined, { sensitivity: 'base' }));
  }, [invoiceOrgsRaw]);

  const invoiceTaxTypes = useMemo(() => {
    const raw = Array.isArray(invoiceTaxesRaw) ? invoiceTaxesRaw : [];
    return [...raw].sort((a, b) => {
      const sa = Number(a.sort_order) || 0;
      const sb = Number(b.sort_order) || 0;
      if (sa !== sb) return sa - sb;
      return Number(a.id) - Number(b.id);
    });
  }, [invoiceTaxesRaw]);

  const [saveVehicleCategory] = useSaveVehicleAppVehicleCategoryMutation();
  const [saveMaintenanceCategory] = useSaveVehicleAppMaintenanceCategoryMutation();
  const [decideMaintenance] = useDecideVehicleAppMaintenanceRequestMutation();
  const [saveWing] = useSaveWingMutation();
  const [saveWorkLocation] = useSaveWorkLocationMutation();
  const [saveMasterVehicleCategory] = useSaveMasterVehicleCategoryMutation();
  const [saveMasterVehicleMake] = useSaveMasterVehicleMakeMutation();
  const [saveMasterVehicleModel] = useSaveMasterVehicleModelMutation();
  const { data: securityCodeItems = [], refetch: refetchSecurityCodeItems } = useGetSecurityCodeListQuery();
  const [resetSecurityCode, { isLoading: resettingFinanceSecurity }] = useResetSecurityCodeMutation();
  const [sendMessage] = useSendMessageMutation();
  const [saveMissionPartialReason] = useSaveMissionPartialReasonMutation();
  const [saveNotSprayingRecen] = useSaveNotSprayingRecenMutation();
  const [saveDeactivateReason] = useSaveDeactivateReasonMutation();
  const [createChemical] = useCreateChemicalMutation();
  const [updateChemical] = useUpdateChemicalMutation();
  const [createTimeOfDay] = useCreateTimeOfDayMutation();
  const [updateTimeOfDay] = useUpdateTimeOfDayMutation();
  const [saveInvoiceOrganization] = useSaveInvoiceOrganizationMutation();
  const [saveInvoiceTaxType] = useSaveInvoiceTaxTypeMutation();

  const [newMaintenanceCategory, setNewMaintenanceCategory] = useState('');
  const [newChemicalName, setNewChemicalName] = useState('');
  const [newChemicalCategory, setNewChemicalCategory] = useState('');
  const [newChemicalPriority, setNewChemicalPriority] = useState('50');
  const [newWorkingTimeText, setNewWorkingTimeText] = useState('');
  const [newWorkingTimeActivated, setNewWorkingTimeActivated] = useState('1');
  const [addChemicalOpen, setAddChemicalOpen] = useState(false);
  const [addWingOpen, setAddWingOpen] = useState(false);
  const [addWorkLocationOpen, setAddWorkLocationOpen] = useState(false);
  const [addMaintenanceCategoryOpen, setAddMaintenanceCategoryOpen] = useState(false);
  const [addWorkingTimeOpen, setAddWorkingTimeOpen] = useState(false);
  const [addInvoiceOrgOpen, setAddInvoiceOrgOpen] = useState(false);
  const [addInvoiceTaxOpen, setAddInvoiceTaxOpen] = useState(false);

  const [newWingName, setNewWingName] = useState('');
  const [newWingCode, setNewWingCode] = useState('');
  const [newWorkLocationName, setNewWorkLocationName] = useState('');
  const [newWorkLocationCode, setNewWorkLocationCode] = useState('');
  const [newWorkLocationMapLink, setNewWorkLocationMapLink] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCode, setNewOrgCode] = useState('');
  const [newOrgBr, setNewOrgBr] = useState('');
  const [newOrgVatNo, setNewOrgVatNo] = useState('');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [newOrgTelephone, setNewOrgTelephone] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');
  const [newOrgLogoPath, setNewOrgLogoPath] = useState('/assets/images/kenilowrthlogoDark.png');
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');
  const [newTaxSortOrder, setNewTaxSortOrder] = useState('0');
  const [newTaxApplyOn, setNewTaxApplyOn] = useState('running');
  const [reasonAddModalType, setReasonAddModalType] = useState(null);
  const [reasonAddDraft, setReasonAddDraft] = useState({});
  const [addModal, setAddModal] = useState(null);
  const [addDraft, setAddDraft] = useState({});
  const [editModal, setEditModal] = useState(null);
  const [modalDraft, setModalDraft] = useState({});
  const [quickMessage, setQuickMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!quickMessage.text) return undefined;
    const timer = setTimeout(() => {
      setQuickMessage({ type: '', text: '' });
    }, 3000);
    return () => clearTimeout(timer);
  }, [quickMessage]);
  useEffect(() => {
    setReasonFlagFilter('all');
    setReasonSearch('');
  }, [activeReasonsTab]);

  const masterVehicleCategories = useMemo(
    () => (Array.isArray(masterVehicleCategoriesData) ? masterVehicleCategoriesData : []),
    [masterVehicleCategoriesData]
  );
  const masterVehicleMakes = useMemo(
    () => (Array.isArray(masterVehicleMakesData) ? masterVehicleMakesData : []),
    [masterVehicleMakesData]
  );
  const masterVehicleModels = useMemo(
    () => (Array.isArray(masterVehicleModelsData) ? masterVehicleModelsData : []),
    [masterVehicleModelsData]
  );
  const addModalModelMakes = useMemo(
    () => masterVehicleMakes.filter((m) => (
      !addDraft?.vehicle_category_id || String(m.vehicle_category_id) === String(addDraft.vehicle_category_id)
    )),
    [masterVehicleMakes, addDraft?.vehicle_category_id]
  );
  const modalVehicleModelMakes = useMemo(
    () => masterVehicleMakes.filter((m) => (
      !modalDraft?.vehicle_category_id || String(m.vehicle_category_id) === String(modalDraft.vehicle_category_id)
    )),
    [masterVehicleMakes, modalDraft?.vehicle_category_id]
  );

  const pendingMaintenance = useMemo(
    () => (maintenanceRequests || []).filter((r) => r.approval === 'p'),
    [maintenanceRequests]
  );
  const filteredPilotOpsReasons = useMemo(() => {
    const q = reasonSearch.trim().toLowerCase();
    return (missionPartialReasons || []).filter((row) => {
      const matchSearch = !q || String(row.reason || '').toLowerCase().includes(q);
      const matchFlag = reasonFlagFilter === 'all' || String(row.flag || '') === reasonFlagFilter;
      return matchSearch && matchFlag;
    });
  }, [missionPartialReasons, reasonSearch, reasonFlagFilter]);
  const filteredManagerReasons = useMemo(() => {
    const q = reasonSearch.trim().toLowerCase();
    return (notSprayingRecens || []).filter((row) => {
      const matchSearch = !q || String(row.recen || '').toLowerCase().includes(q);
      const matchFlag = reasonFlagFilter === 'all' || String(row.flag || '') === reasonFlagFilter;
      return matchSearch && matchFlag;
    });
  }, [notSprayingRecens, reasonSearch, reasonFlagFilter]);
  const filteredDeactivateReasons = useMemo(() => {
    const q = reasonSearch.trim().toLowerCase();
    return (deactivateReasons || []).filter((row) => (
      !q || String(row.reason || '').toLowerCase().includes(q)
    ));
  }, [deactivateReasons, reasonSearch]);

  const handleQuickSave = async (action) => {
    try {
      await action();
      setQuickMessage({ type: 'success', text: 'Saved successfully.' });
    } catch (error) {
      setQuickMessage({
        type: 'error',
        text: error?.data?.message || error?.message || 'Save failed',
      });
    }
  };

  const openAddChemicalModal = () => {
    setNewChemicalName('');
    setNewChemicalCategory('');
    setNewChemicalPriority('50');
    setAddChemicalOpen(true);
  };

  const closeAddChemicalModal = () => {
    setAddChemicalOpen(false);
    setNewChemicalName('');
    setNewChemicalCategory('');
    setNewChemicalPriority('50');
  };

  const saveAddChemicalModal = async () => {
    const name = String(newChemicalName || '').trim();
    if (!name) {
      setQuickMessage({ type: 'error', text: 'Chemical name is required.' });
      return;
    }
    await handleQuickSave(async () => {
      await createChemical({
        chemical: name,
        category: newChemicalCategory || null,
        priority: parseInt(newChemicalPriority, 10) || 50,
        activated: 1,
      }).unwrap();
      await refetchChemicals();
      closeAddChemicalModal();
    });
  };

  const openAddWingModal = () => {
    setNewWingName('');
    setNewWingCode('');
    setAddWingOpen(true);
  };
  const closeAddWingModal = () => {
    setAddWingOpen(false);
    setNewWingName('');
    setNewWingCode('');
  };
  const saveAddWingModal = async () => {
    const wing = String(newWingName || '').trim();
    const code = String(newWingCode || '').trim();
    if (!wing) {
      setQuickMessage({ type: 'error', text: 'Wing name is required.' });
      return;
    }
    if (!code) {
      setQuickMessage({ type: 'error', text: 'Wing code is required.' });
      return;
    }
    await handleQuickSave(async () => {
      await saveWing({ wing, wingsCode: code, activated: 1 }).unwrap();
      await refetchWings();
      closeAddWingModal();
    });
  };

  const openAddWorkLocationModal = () => {
    setNewWorkLocationName('');
    setNewWorkLocationCode('');
    setNewWorkLocationMapLink('');
    setAddWorkLocationOpen(true);
  };
  const closeAddWorkLocationModal = () => {
    setAddWorkLocationOpen(false);
    setNewWorkLocationName('');
    setNewWorkLocationCode('');
    setNewWorkLocationMapLink('');
  };
  const saveAddWorkLocationModal = async () => {
    const name = String(newWorkLocationName || '').trim();
    if (!name) {
      setQuickMessage({ type: 'error', text: 'Location name is required.' });
      return;
    }
    await handleQuickSave(async () => {
      await saveWorkLocation({
        locationName: name,
        locationCode: String(newWorkLocationCode || '').trim(),
        map_link: newWorkLocationMapLink || null,
        activated: 1,
      }).unwrap();
      await refetchWorkLocations();
      closeAddWorkLocationModal();
    });
  };

  const openAddMaintenanceCategoryModal = () => {
    setNewMaintenanceCategory('');
    setAddMaintenanceCategoryOpen(true);
  };
  const closeAddMaintenanceCategoryModal = () => {
    setAddMaintenanceCategoryOpen(false);
    setNewMaintenanceCategory('');
  };
  const saveAddMaintenanceCategoryModal = async () => {
    const cat = String(newMaintenanceCategory || '').trim();
    if (!cat) {
      setQuickMessage({ type: 'error', text: 'Category name is required.' });
      return;
    }
    await handleQuickSave(async () => {
      await saveMaintenanceCategory({ category: cat, activated: 1 }).unwrap();
      await refetchMaintenanceCategories();
      closeAddMaintenanceCategoryModal();
    });
  };

  const openAddWorkingTimeModal = () => {
    setNewWorkingTimeText('');
    setNewWorkingTimeActivated('1');
    setAddWorkingTimeOpen(true);
  };
  const closeAddWorkingTimeModal = () => {
    setAddWorkingTimeOpen(false);
    setNewWorkingTimeText('');
    setNewWorkingTimeActivated('1');
  };
  const saveAddWorkingTimeModal = async () => {
    const text = String(newWorkingTimeText || '').trim();
    if (!text) {
      setQuickMessage({ type: 'error', text: 'Working time description is required.' });
      return;
    }
    await handleQuickSave(async () => {
      await createTimeOfDay({
        time_of_day: text,
        activated: parseInt(newWorkingTimeActivated, 10) === 0 ? 0 : 1,
      }).unwrap();
      await refetchTimeOfDays();
      closeAddWorkingTimeModal();
    });
  };

  const resetNewOrgFields = () => {
    setNewOrgName('');
    setNewOrgCode('');
    setNewOrgBr('');
    setNewOrgVatNo('');
    setNewOrgAddress('');
    setNewOrgTelephone('');
    setNewOrgEmail('');
    setNewOrgLogoPath('/assets/images/kenilowrthlogoDark.png');
  };

  const openAddInvoiceOrgModal = () => {
    resetNewOrgFields();
    setAddInvoiceOrgOpen(true);
  };
  const closeAddInvoiceOrgModal = () => {
    setAddInvoiceOrgOpen(false);
    resetNewOrgFields();
  };
  const saveAddInvoiceOrgModal = async () => {
    const name = String(newOrgName || '').trim();
    if (!name) {
      setQuickMessage({ type: 'error', text: 'Organization name is required.' });
      return;
    }
    await handleQuickSave(async () => {
      await saveInvoiceOrganization({
        org_name: name,
        org_code: newOrgCode || null,
        br: newOrgBr || null,
        vat_no: newOrgVatNo || null,
        address: newOrgAddress || null,
        telephone: newOrgTelephone || null,
        email: newOrgEmail || null,
        logo_path: newOrgLogoPath || '/assets/images/kenilowrthlogoDark.png',
        activated: 1,
      }).unwrap();
      await refetchInvoiceOrgs();
      closeAddInvoiceOrgModal();
    });
  };

  const resetNewTaxFields = () => {
    setNewTaxName('');
    setNewTaxRate('');
    setNewTaxSortOrder('0');
    setNewTaxApplyOn('running');
  };

  const openAddInvoiceTaxModal = () => {
    resetNewTaxFields();
    setAddInvoiceTaxOpen(true);
  };
  const closeAddInvoiceTaxModal = () => {
    setAddInvoiceTaxOpen(false);
    resetNewTaxFields();
  };
  const saveAddInvoiceTaxModal = async () => {
    const name = String(newTaxName || '').trim();
    const rate = Number(newTaxRate);
    if (!name) {
      setQuickMessage({ type: 'error', text: 'Tax name is required.' });
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setQuickMessage({ type: 'error', text: 'Valid tax rate (%) is required.' });
      return;
    }
    await handleQuickSave(async () => {
      await saveInvoiceTaxType({
        tax_name: name,
        rate_percent: rate,
        sort_order: parseInt(newTaxSortOrder, 10) || 0,
        apply_on: newTaxApplyOn === 'subtotal' ? 'subtotal' : 'running',
        activated: 1,
      }).unwrap();
      await refetchInvoiceTaxes();
      closeAddInvoiceTaxModal();
    });
  };

  const refreshVehicleMasters = async () => {
    await Promise.all([
      refetchMasterVehicleCategories(),
      refetchMasterVehicleMakes(),
      refetchMasterVehicleModels(),
    ]);
  };

  const openEditModal = (type, item) => {
    setEditModal({ type, item });
    if (type === 'vehicleCategory') setModalDraft({ category: item.category || '' });
    if (type === 'vehicleMake') setModalDraft({ make: item.make || '', vehicle_category_id: String(item.vehicle_category_id || '') });
    if (type === 'vehicleModel') {
      const selectedMake = masterVehicleMakes.find((m) => String(m.id) === String(item.vehicle_make_id || ''));
      setModalDraft({
        model: item.model || '',
        vehicle_make_id: String(item.vehicle_make_id || ''),
        vehicle_category_id: selectedMake ? String(selectedMake.vehicle_category_id) : '',
      });
    }
    if (type === 'maintenanceCategory') setModalDraft({ category: item.category || '' });
    if (type === 'poolRequestCategory') setModalDraft({ category: item.category || '' });
    if (type === 'financeCategory') {
      setModalDraft({ category_name: item.category_name || '' });
    }
    if (type === 'financeSubCategory') {
      setModalDraft({
        type: item.type || '',
        finance_category: String(item.finance_category || selectedFinanceCategoryId || '1'),
      });
    }
    if (type === 'wing') setModalDraft({ wing: item.wing || '', wingsCode: item.wingsCode || '' });
    if (type === 'workLocation') {
      setModalDraft({
        locationName: item.locationName || '',
        locationCode: item.locationCode || '',
        map_link: item.map_link || '',
      });
    }
    if (type === 'missionPartialReason') setModalDraft({ reason: item.reason || '', flag: item.flag || 'c', chargeble: String(Number(item.chargeble) === 1 ? 1 : 0) });
    if (type === 'notSprayingRecen') setModalDraft({ recen: item.recen || '', flag: item.flag || 'c' });
    if (type === 'deactivateReason') setModalDraft({ reason: item.reason || '' });
    if (type === 'chemical') {
      setModalDraft({
        chemical: item.chemical || '',
        category: item.category != null && String(item.category).trim() !== '' ? String(item.category).trim() : '',
        priority: String(item.priority != null ? item.priority : 50),
        activated: String(Number(item.activated) === 0 ? 0 : 1),
      });
    }
    if (type === 'workingTime') {
      setModalDraft({
        time_of_day: item.time_of_day || '',
        activated: String(Number(item.activated) === 0 ? 0 : 1),
      });
    }
    if (type === 'organization') {
      setModalDraft({
        org_name: item.org_name || '',
        org_code: item.org_code || '',
        br: item.br || '',
        vat_no: item.vat_no || '',
        address: item.address || '',
        telephone: item.telephone || '',
        email: item.email || '',
        logo_path: item.logo_path || '/assets/images/kenilowrthlogoDark.png',
        activated: String(Number(item.activated) === 0 ? 0 : 1),
      });
    }
    if (type === 'invoiceTax') {
      setModalDraft({
        tax_name: item.tax_name || '',
        rate_percent: item.rate_percent != null ? String(item.rate_percent) : '',
        sort_order: item.sort_order != null ? String(item.sort_order) : '0',
        apply_on: item.apply_on === 'subtotal' ? 'subtotal' : 'running',
        activated: String(Number(item.activated) === 0 ? 0 : 1),
      });
    }
  };

  const openAddModal = (type) => {
    setAddModal(type);
    if (type === 'vehicleCategory') setAddDraft({ category: '' });
    if (type === 'vehicleMake') setAddDraft({ vehicle_category_id: '', make: '' });
    if (type === 'vehicleModel') setAddDraft({ vehicle_category_id: '', vehicle_make_id: '', model: '' });
  };

  const closeAddModal = () => {
    setAddModal(null);
    setAddDraft({});
  };

  const closeEditModal = () => {
    setEditModal(null);
    setModalDraft({});
  };

  const openReasonAddModal = (type) => {
    setReasonAddModalType(type);
    if (type === 'missionPartialReason') setReasonAddDraft({ reason: '', flag: 'c', chargeble: '0' });
    if (type === 'notSprayingRecen') setReasonAddDraft({ recen: '', flag: 'c' });
    if (type === 'deactivateReason') setReasonAddDraft({ reason: '' });
  };

  const closeReasonAddModal = () => {
    setReasonAddModalType(null);
    setReasonAddDraft({});
  };

  const saveReasonAddModal = async () => {
    if (!reasonAddModalType) return;
    await handleQuickSave(async () => {
      if (reasonAddModalType === 'missionPartialReason') {
        await saveMissionPartialReason({
          reason: reasonAddDraft.reason,
          flag: reasonAddDraft.flag,
          chargeble: Number(reasonAddDraft.chargeble) === 1 ? 1 : 0,
          activated: 1,
        }).unwrap();
      } else if (reasonAddModalType === 'notSprayingRecen') {
        await saveNotSprayingRecen({
          recen: reasonAddDraft.recen,
          flag: reasonAddDraft.flag,
          activated: 1,
        }).unwrap();
      } else if (reasonAddModalType === 'deactivateReason') {
        await saveDeactivateReason({
          reason: reasonAddDraft.reason,
          activated: 1,
        }).unwrap();
      }
      closeReasonAddModal();
    });
  };

  const saveAddModal = async () => {
    if (!addModal) return;
    await handleQuickSave(async () => {
      if (addModal === 'vehicleCategory') {
        await saveMasterVehicleCategory({ category: addDraft.category, activated: 1 }).unwrap();
        await refreshVehicleMasters();
      } else if (addModal === 'vehicleMake') {
        await saveMasterVehicleMake({
          vehicle_category_id: addDraft.vehicle_category_id,
          make: addDraft.make,
          activated: 1,
        }).unwrap();
        await refreshVehicleMasters();
      } else if (addModal === 'vehicleModel') {
        await saveMasterVehicleModel({
          vehicle_make_id: addDraft.vehicle_make_id,
          model: addDraft.model,
          activated: 1,
        }).unwrap();
        await refreshVehicleMasters();
      }
      closeAddModal();
    });
  };

  const saveEditModal = async () => {
    if (!editModal?.item) return;
    const isCreate = !editModal.item.id;
    if (isCreate && !['financeCategory', 'financeSubCategory'].includes(editModal.type)) return;
    if (!isCreate && !editModal.item.id) return;
    if (editModal.type === 'workingTime') {
      const wt = String(modalDraft.time_of_day || '').trim();
      if (!wt) {
        setQuickMessage({ type: 'error', text: 'Time of day is required.' });
        return;
      }
    }
    if (editModal.type === 'organization' && !String(modalDraft.org_name || '').trim()) {
      setQuickMessage({ type: 'error', text: 'Organization name is required.' });
      return;
    }
    if (editModal.type === 'invoiceTax') {
      const rate = Number(modalDraft.rate_percent);
      if (!String(modalDraft.tax_name || '').trim()) {
        setQuickMessage({ type: 'error', text: 'Tax name is required.' });
        return;
      }
      if (!Number.isFinite(rate) || rate < 0) {
        setQuickMessage({ type: 'error', text: 'Valid tax rate (%) is required.' });
        return;
      }
    }
    await handleQuickSave(async () => {
      if (editModal.type === 'vehicleCategory') {
        await saveMasterVehicleCategory({ id: editModal.item.id, category: modalDraft.category, activated: editModal.item.activated ?? 1 }).unwrap();
        await refreshVehicleMasters();
      } else if (editModal.type === 'vehicleMake') {
        await saveMasterVehicleMake({
          id: editModal.item.id,
          vehicle_category_id: modalDraft.vehicle_category_id,
          make: modalDraft.make,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
        await refreshVehicleMasters();
      } else if (editModal.type === 'vehicleModel') {
        await saveMasterVehicleModel({
          id: editModal.item.id,
          vehicle_make_id: modalDraft.vehicle_make_id,
          model: modalDraft.model,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
        await refreshVehicleMasters();
      } else if (editModal.type === 'maintenanceCategory') {
        await saveMaintenanceCategory({ id: editModal.item.id, category: modalDraft.category, activated: editModal.item.activated ?? 1 }).unwrap();
      } else if (editModal.type === 'poolRequestCategory') {
        await savePoolRequestCategory({
          id: editModal.item.id || undefined,
          category: modalDraft.category,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
        await refetchPoolRequestCategories();
        await saveFinanceCategoryMaster({
          id: editModal.item.id || undefined,
          category_name: modalDraft.category_name,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
        await refetchFinanceCategoriesMaster();
      } else if (editModal.type === 'financeSubCategory') {
        await saveFinanceSubCategoryMaster({
          id: editModal.item.id || undefined,
          finance_category: Number(modalDraft.finance_category || selectedFinanceCategoryId || 1),
          type: modalDraft.type,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
        await refetchFinanceSubCategoriesMaster();
      } else if (editModal.type === 'wing') {
        await saveWing({
          id: editModal.item.id,
          wing: modalDraft.wing,
          wingsCode: modalDraft.wingsCode,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
        refetchWings();
      } else if (editModal.type === 'workLocation') {
        await saveWorkLocation({
          id: editModal.item.id,
          locationName: modalDraft.locationName,
          locationCode: modalDraft.locationCode,
          map_link: modalDraft.map_link || null,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
        refetchWorkLocations();
      } else if (editModal.type === 'missionPartialReason') {
        await saveMissionPartialReason({
          id: editModal.item.id,
          reason: modalDraft.reason,
          flag: modalDraft.flag,
          chargeble: Number(modalDraft.chargeble) === 1 ? 1 : 0,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
      } else if (editModal.type === 'notSprayingRecen') {
        await saveNotSprayingRecen({
          id: editModal.item.id,
          recen: modalDraft.recen,
          flag: modalDraft.flag,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
      } else if (editModal.type === 'deactivateReason') {
        await saveDeactivateReason({
          id: editModal.item.id,
          reason: modalDraft.reason,
          activated: editModal.item.activated ?? 1,
        }).unwrap();
      } else if (editModal.type === 'chemical') {
        await updateChemical({
          id: editModal.item.id,
          chemical: modalDraft.chemical,
          category: modalDraft.category ? modalDraft.category : null,
          priority: parseInt(modalDraft.priority, 10) || 50,
          activated: parseInt(modalDraft.activated, 10) === 0 ? 0 : 1,
        }).unwrap();
        await refetchChemicals();
      } else if (editModal.type === 'workingTime') {
        await updateTimeOfDay({
          id: editModal.item.id,
          time_of_day: String(modalDraft.time_of_day || '').trim(),
          activated: parseInt(modalDraft.activated, 10) === 0 ? 0 : 1,
        }).unwrap();
        await refetchTimeOfDays();
      } else if (editModal.type === 'organization') {
        await saveInvoiceOrganization({
          id: editModal.item.id,
          org_name: String(modalDraft.org_name || '').trim(),
          org_code: modalDraft.org_code || null,
          br: modalDraft.br || null,
          vat_no: modalDraft.vat_no || null,
          address: modalDraft.address || null,
          telephone: modalDraft.telephone || null,
          email: modalDraft.email || null,
          logo_path: modalDraft.logo_path || '/assets/images/kenilowrthlogoDark.png',
          activated: parseInt(modalDraft.activated, 10) === 0 ? 0 : 1,
        }).unwrap();
        await refetchInvoiceOrgs();
      } else if (editModal.type === 'invoiceTax') {
        await saveInvoiceTaxType({
          id: editModal.item.id,
          tax_name: String(modalDraft.tax_name || '').trim(),
          rate_percent: Number(modalDraft.rate_percent),
          sort_order: parseInt(modalDraft.sort_order, 10) || 0,
          apply_on: modalDraft.apply_on === 'subtotal' ? 'subtotal' : 'running',
          activated: parseInt(modalDraft.activated, 10) === 0 ? 0 : 1,
        }).unwrap();
        await refetchInvoiceTaxes();
      }
      closeEditModal();
    });
  };

  return (
    <div
      className={`vehicle-admin-page-master-data ictmdx-shell ${mode === 'masters' ? 'vehicle-admin-page-master-data--split-scroll' : ''}`}
    >
      <div className="vehicle-admin-header-master-data">
        <div>
          <h1>{mode === 'masters' ? 'Master Data Update' : 'Vehicle App Administration'}</h1>
          <p>
            {mode === 'masters'
              ? 'Manage master data. This section starts with vehicle app masters and can be extended.'
              : 'Manage vehicle requests and monthly operations.'}
          </p>
        </div>
      </div>
      {quickMessage.text ? (
        <div
          className={`master-data-flash-banner-master-data master-data-flash-banner--${quickMessage.type === 'success' ? 'success' : 'error'}`}
        >
          <span className="master-data-flash-banner-text-master-data">{quickMessage.text}</span>
          <button
            type="button"
            className="master-data-flash-banner-dismiss-master-data"
            onClick={() => setQuickMessage({ type: '', text: '' })}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {tabs.length > 1 && (
        <div className="vehicle-admin-tabs-master-data">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? 'active-master-data' : ''}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="vehicle-admin-grid-master-data">
          <div className="vehicle-admin-card-master-data stat-card-master-data">
            <h3>Vehicle Day Summary</h3>
            <div className="metric-list-master-data">
              <div className="metric-row-master-data"><span>Total</span><strong>{summary?.daily?.total_records || 0}</strong></div>
              <div className="metric-row-master-data"><span>Approved</span><strong>{summary?.daily?.approved_records || 0}</strong></div>
              <div className="metric-row-master-data"><span>Pending</span><strong>{summary?.daily?.pending_records || 0}</strong></div>
              <div className="metric-row-master-data"><span>Declined</span><strong>{summary?.daily?.declined_records || 0}</strong></div>
            </div>
          </div>
          <div className="vehicle-admin-card-master-data stat-card-master-data">
            <h3>Maintenance Summary</h3>
            <div className="metric-list-master-data">
              <div className="metric-row-master-data"><span>Total</span><strong>{summary?.maintenance?.total_requests || 0}</strong></div>
              <div className="metric-row-master-data"><span>Approved</span><strong>{summary?.maintenance?.approved_requests || 0}</strong></div>
              <div className="metric-row-master-data"><span>Pending</span><strong>{summary?.maintenance?.pending_requests || 0}</strong></div>
              <div className="metric-row-master-data"><span>Declined</span><strong>{summary?.maintenance?.declined_requests || 0}</strong></div>
            </div>
          </div>
          <div className="vehicle-admin-card-master-data stat-card-master-data">
            <h3>Active Records</h3>
            <div className="metric-list-master-data">
              <div className="metric-row-master-data"><span>Vehicles</span><strong>{vehicles.length}</strong></div>
              <div className="metric-row-master-data"><span>Drivers</span><strong>{drivers.length}</strong></div>
              <div className="metric-row-master-data"><span>Vehicle Categories</span><strong>{vehicleCategories.length}</strong></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'masters' && (
        <div className="masters-layout-master-data">
          <div className="masters-picker-master-data">
            {[
              { key: 'vehicleMaster', label: 'Vehicle Master (Category/Make/Model)' },
              { key: 'fuelTypes', label: 'Fuel Types' },
              { key: 'financeCategories', label: 'Finance Categories' },
              { key: 'financeSubCategories', label: 'Finance Sub Categories' },
              { key: 'wings', label: 'Wings' },
              { key: 'workLocations', label: 'Work Locations' },
              { key: 'maintenanceCategories', label: 'Maintenance Categories' },
              { key: 'poolRequestCategories', label: 'Pool Vehicle Request Categories' },
              { key: 'chemicals', label: 'Chemicals' },
              { key: 'workingTimes', label: 'Working Times' },
              { key: 'hrMasterOptions', label: 'HR Master Options' },
              { key: 'kpiDefinitions', label: 'KPI Definitions' },
              { key: 'kpiRatingBands', label: 'KPI Rating Bands' },
              { key: 'smartKpiFieldTypes', label: 'SMART KPI Field Types' },
              { key: 'smartKpiTemplates', label: 'SMART KPI' },
              { key: 'locationHierarchy', label: 'Province/District/DS/ASC Hierarchy' },
              { key: 'reasons', label: 'Reasons' },
              { key: 'invoiceOrganizations', label: 'Invoice Organizations' },
              { key: 'invoiceTaxes', label: 'Invoice Tax Types' },
              { key: 'securityCodes', label: 'Security Codes' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`masters-picker-item-master-data ${selectedMasterModule === item.key ? 'active-master-data' : ''}`}
                onClick={() => setSelectedMasterModule(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="masters-workspace-master-data">
            {selectedMasterModule === 'vehicleMaster' && (
              <div className="vehicle-admin-card-master-data">
                <h3>Vehicle Master Data</h3>
                <p className="vehicle-master-note-master-data">Manage category, make and model in one place with clear hierarchy.</p>
                <div className="vehicle-master-forms-master-data ictmdx-vehicle-master-forms">
                  <div className="vehicle-master-form-card-master-data ictmdx-vehicle-master-card">
                    <h4 className="ictmdx-vehicle-master-card-title">Category</h4>
                    <button className="btn-submit-master-data ictmdx-vehicle-master-card-btn" onClick={() => openAddModal('vehicleCategory')}>Add Category</button>
                  </div>
                  <div className="vehicle-master-form-card-master-data ictmdx-vehicle-master-card">
                    <h4 className="ictmdx-vehicle-master-card-title">Make</h4>
                    <button className="btn-submit-master-data ictmdx-vehicle-master-card-btn" onClick={() => openAddModal('vehicleMake')}>Add Make</button>
                  </div>
                  <div className="vehicle-master-form-card-master-data ictmdx-vehicle-master-card">
                    <h4 className="ictmdx-vehicle-master-card-title">Model</h4>
                    <button className="btn-submit-master-data ictmdx-vehicle-master-card-btn" onClick={() => openAddModal('vehicleModel')}>Add Model</button>
                  </div>
                </div>
                <div className="master-list-master-data vehicle-master-tree-master-data vehicle-master-tree-board-master-data">
                  {masterVehicleCategories.map((c) => (
                    <div key={c.id} className="master-row-master-data vehicle-tree-category-master-data">
                      <div className="vehicle-tree-row-master-data">
                        <span className="master-label-master-data">{c.category}</span>
                        <button className="master-edit-btn-master-data" onClick={() => openEditModal('vehicleCategory', c)}>Edit Category</button>
                      </div>
                      {(masterVehicleMakes.filter((m) => String(m.vehicle_category_id) === String(c.id))).map((m) => (
                        <div key={m.id} className="vehicle-tree-make-wrap-master-data">
                          <div className="vehicle-tree-row-master-data">
                            <span className="master-label-master-data master-label-make-master-data">{m.make}</span>
                            <button className="master-edit-btn-master-data" onClick={() => openEditModal('vehicleMake', m)}>Edit Make</button>
                          </div>
                          {(masterVehicleModels.filter((mo) => String(mo.vehicle_make_id) === String(m.id))).map((mo) => (
                            <div key={mo.id} className="vehicle-tree-row-master-data vehicle-tree-model-row-master-data">
                              <span className="master-label-master-data master-label-model-master-data">{mo.model}</span>
                              <button className="master-edit-btn-master-data" onClick={() => openEditModal('vehicleModel', mo)}>Edit Model</button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMasterModule === 'fuelTypes' && (
              <FuelTypesMasterPanel onMessage={setQuickMessage} />
            )}

            {selectedMasterModule === 'financeCategories' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Finance Categories</h3>
                    <p className="vehicle-master-note-master-data">Expense card categories used in Financial Cards.</p>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={() => openEditModal('financeCategory', { category_name: '', activated: 1 })}
                  >
                    Add category
                  </button>
                </div>
                <div className="master-list-master-data" style={{ marginTop: 12 }}>
                  {financeCategoriesMaster.map((row) => (
                    <div key={row.id} className="master-row-master-data">
                      <span className="master-label-master-data">{row.category_name}</span>
                      <button className="action-btn-master-data neutral-master-data" onClick={() => openEditModal('financeCategory', row)}>Edit</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMasterModule === 'financeSubCategories' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Finance Sub Categories</h3>
                    <p className="vehicle-master-note-master-data">Under Fuel (category 1): Vehicle and Generator.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={selectedFinanceCategoryId}
                      onChange={(e) => setSelectedFinanceCategoryId(e.target.value)}
                    >
                      {financeCategoriesMaster.map((row) => (
                        <option key={row.id} value={row.id}>{row.category_name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                      onClick={() =>
                        openEditModal('financeSubCategory', {
                          finance_category: selectedFinanceCategoryId,
                          type: '',
                          activated: 1,
                        })
                      }
                    >
                      Add sub category
                    </button>
                  </div>
                </div>
                <div className="master-list-master-data" style={{ marginTop: 12 }}>
                  {financeSubCategoriesMaster.map((row) => (
                    <div key={row.id} className="master-row-master-data">
                      <span className="master-label-master-data">{row.type}</span>
                      <button className="action-btn-master-data neutral-master-data" onClick={() => openEditModal('financeSubCategory', row)}>Edit</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMasterModule === 'wings' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Wings</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={openAddWingModal}
                  >
                    Add wing
                  </button>
                </div>
                <div className="master-list-master-data" style={{ marginTop: 12 }}>
                  {wings.map((w) => (
                    <div key={w.id} className="master-row-master-data">
                      <div style={{ flex: 1 }}>
                        <span className="master-label-master-data">{w.wing}</span>
                        <span style={{ marginLeft: 8, fontSize: '0.82em', color: '#555' }}>[{w.wingsCode || '-'}]</span>
                      </div>
                      <div className="master-actions-master-data">
                        <button className="action-btn-master-data neutral-master-data" onClick={() => openEditModal('wing', w)}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMasterModule === 'workLocations' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Work Locations</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={openAddWorkLocationModal}
                  >
                    Add work location
                  </button>
                </div>
                <div className="master-list-master-data" style={{ marginTop: 12 }}>
                  {workLocations.map((w) => (
                    <div key={w.id} className="master-row-master-data">
                      <div style={{ flex: 1 }}>
                        <span className="master-label-master-data">{w.locationName}</span>
                        <span style={{ marginLeft: 8, fontSize: '0.82em', color: '#555' }}>[{w.locationCode || '-'}] {w.latitude && w.longitude ? `${w.latitude}, ${w.longitude}` : 'No geo set'}</span>
                      </div>
                      <div className="master-actions-master-data">
                        <button className="action-btn-master-data neutral-master-data" onClick={() => openEditModal('workLocation', w)}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMasterModule === 'maintenanceCategories' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Maintenance Categories</h3>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={openAddMaintenanceCategoryModal}
                  >
                    Add category
                  </button>
                </div>
                <div className="master-list-master-data" style={{ marginTop: 12 }}>
                  {maintenanceCategories.map((c) => (
                    <div key={c.id} className="master-row-master-data">
                      <span className="master-label-master-data">{c.category}</span>
                      <div className="master-actions-master-data">
                        <button className="action-btn-master-data neutral-master-data" onClick={() => openEditModal('maintenanceCategory', c)}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMasterModule === 'poolRequestCategories' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Pool Vehicle Request Categories</h3>
                    <p className="vehicle-master-note-master-data">
                      Used when office staff request additional pool vehicle tasks (Transport HR → Additional).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={() => openEditModal('poolRequestCategory', { id: null, category: '', activated: 1 })}
                  >
                    Add category
                  </button>
                </div>
                <div className="master-list-master-data" style={{ marginTop: 12 }}>
                  {poolRequestCategories.map((c) => (
                    <div key={c.id} className="master-row-master-data">
                      <span className="master-label-master-data">{c.category}</span>
                      <div className="master-actions-master-data">
                        <button className="action-btn-master-data neutral-master-data" onClick={() => openEditModal('poolRequestCategory', c)}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMasterModule === 'chemicals' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Chemicals</h3>
                    <p className="vehicle-master-note-master-data">
                      Plantation chemical master list (spray/spread category, display order, active flag).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={openAddChemicalModal}
                  >
                    Add chemical
                  </button>
                </div>
                <div className="vehicle-table-wrap-master-data" style={{ marginTop: 12 }}>
                  <table className="vehicle-table-master-data">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {chemicals.map((row) => {
                        const cat = String(row.category || '').toLowerCase();
                        const catLabel = cat === 'spy' ? 'Spray' : cat === 'spd' ? 'Spread' : row.category || '—';
                        return (
                          <tr key={row.id}>
                            <td>{row.chemical}</td>
                            <td>{catLabel}</td>
                            <td>{row.priority ?? 50}</td>
                            <td>
                              <span
                                className={
                                  Number(row.activated) === 1
                                    ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                                    : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                                }
                              >
                                {Number(row.activated) === 1 ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="action-btn-master-data neutral-master-data"
                                onClick={() => openEditModal('chemical', row)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedMasterModule === 'workingTimes' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Working Times</h3>
                    <p className="vehicle-master-note-master-data">
                      Shifts and time-band labels (e.g. morning and evening blocks).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={openAddWorkingTimeModal}
                  >
                    Add working time
                  </button>
                </div>
                <div className="vehicle-table-wrap-master-data" style={{ marginTop: 12 }}>
                  <table className="vehicle-table-master-data">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Time of day</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {workingTimes.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.time_of_day}</td>
                          <td>
                            <span
                              className={
                                Number(row.activated) === 1
                                  ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                                  : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                              }
                            >
                              {Number(row.activated) === 1 ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="action-btn-master-data neutral-master-data"
                              onClick={() => openEditModal('workingTime', row)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedMasterModule === 'hrMasterOptions' && (
              <HrMasterOptionsPanel onMessage={setQuickMessage} />
            )}

            {selectedMasterModule === 'kpiDefinitions' && (
              <KpiDefinitionsPanel onMessage={setQuickMessage} />
            )}

            {selectedMasterModule === 'kpiRatingBands' && (
              <KpiRatingBandsPanel onMessage={setQuickMessage} />
            )}

            {selectedMasterModule === 'smartKpiFieldTypes' && (
              <SmartKpiFieldTypesPanel onMessage={setQuickMessage} />
            )}

            {selectedMasterModule === 'smartKpiTemplates' && (
              <SmartKpiTemplatesPanel onMessage={setQuickMessage} />
            )}

            {selectedMasterModule === 'locationHierarchy' && (
              <LocationHierarchyPanel onMessage={setQuickMessage} />
            )}

            {selectedMasterModule === 'reasons' && (
              <div className="vehicle-admin-card-master-data">
                <h3>Reasons</h3>
                <div className="vehicle-admin-tabs-master-data" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className={activeReasonsTab === 'pilotOps' ? 'active-master-data' : ''}
                    onClick={() => setActiveReasonsTab('pilotOps')}
                  >
                    Pilot/OpsRoom Reasons
                  </button>
                  <button
                    type="button"
                    className={activeReasonsTab === 'manager' ? 'active-master-data' : ''}
                    onClick={() => setActiveReasonsTab('manager')}
                  >
                    Manager Reasons
                  </button>
                  <button
                    type="button"
                    className={activeReasonsTab === 'deactivate' ? 'active-master-data' : ''}
                    onClick={() => setActiveReasonsTab('deactivate')}
                  >
                    Deactivate Reasons
                  </button>
                </div>

                {activeReasonsTab === 'pilotOps' && (
                  <>
                    <div className="inline-form-master-data reasons-toolbar-master-data">
                      <div className="reasons-toolbar-left-master-data">
                        <input
                          className="reasons-search-master-data"
                          value={reasonSearch}
                          onChange={(e) => setReasonSearch(e.target.value)}
                          placeholder="Search reason"
                        />
                        <select
                          className="reasons-filter-master-data"
                          value={reasonFlagFilter}
                          onChange={(e) => setReasonFlagFilter(e.target.value)}
                        >
                          <option value="all">All Flags</option>
                          <option value="h">Partially (h)</option>
                          <option value="c">Cancel (c)</option>
                        </select>
                      </div>
                      <button type="button" className="btn-submit-master-data reasons-add-btn-master-data" onClick={() => openReasonAddModal('missionPartialReason')}>
                        Add Pilot/OpsRoom Reason
                      </button>
                    </div>

                    <div className="master-list-master-data">
                      {filteredPilotOpsReasons.map((row) => (
                        <div key={row.id} className="master-row-master-data">
                          <div style={{ flex: 1 }}>
                            <span className="master-label-master-data">{row.reason}</span>
                            <span style={{ marginLeft: 8, fontSize: '0.82em', color: '#555' }}>
                              Flag: {row.flag === 'h' ? 'Partially (h)' : 'Cancel (c)'}
                            </span>
                            <span style={{ marginLeft: 8, fontSize: '0.82em', color: '#555' }}>
                              Chargeble: {Number(row.chargeble) === 1 ? 'Yes' : 'No'}
                            </span>
                            <div style={{ marginTop: 4, fontSize: '0.82em', color: '#555' }}>
                              Added By: {row.added_by_name || row.added_by || '-'} | Updated By:{' '}
                              {row.updated_by_name || row.updated_by || '-'}
                            </div>
                          </div>
                          <div className="master-actions-master-data" style={{ flexWrap: 'wrap' }}>
                            <span
                              className={
                                Number(row.activated) === 1
                                  ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                                  : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                              }
                            >
                              {Number(row.activated) === 1 ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              type="button"
                              className="action-btn-master-data neutral-master-data"
                              onClick={() => openEditModal('missionPartialReason', row)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="action-btn-master-data"
                              style={{ background: Number(row.activated) === 1 ? '#dc2626' : '#16a34a' }}
                              onClick={() =>
                                handleQuickSave(async () => {
                                  await saveMissionPartialReason({
                                    id: row.id,
                                    reason: row.reason,
                                    flag: row.flag,
                                    chargeble: Number(row.chargeble) === 1 ? 1 : 0,
                                    activated: Number(row.activated) === 1 ? 0 : 1,
                                  }).unwrap();
                                })
                              }
                            >
                              {Number(row.activated) === 1 ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {activeReasonsTab === 'manager' && (
                  <>
                    <div className="inline-form-master-data reasons-toolbar-master-data">
                      <div className="reasons-toolbar-left-master-data">
                        <input
                          className="reasons-search-master-data"
                          value={reasonSearch}
                          onChange={(e) => setReasonSearch(e.target.value)}
                          placeholder="Search reason"
                        />
                        <select
                          className="reasons-filter-master-data"
                          value={reasonFlagFilter}
                          onChange={(e) => setReasonFlagFilter(e.target.value)}
                        >
                          <option value="all">All Flags</option>
                          <option value="c">Cancel (c)</option>
                          <option value="r">Reschedule (r)</option>
                          <option value="rm">Remove (rm)</option>
                        </select>
                      </div>
                      <button type="button" className="btn-submit-master-data reasons-add-btn-master-data" onClick={() => openReasonAddModal('notSprayingRecen')}>
                        Add Manager Reason
                      </button>
                    </div>

                    <div className="master-list-master-data">
                      {filteredManagerReasons.map((row) => (
                        <div key={row.id} className="master-row-master-data">
                          <div style={{ flex: 1 }}>
                            <span className="master-label-master-data">{row.recen}</span>
                            <span style={{ marginLeft: 8, fontSize: '0.82em', color: '#555' }}>
                              Flag:{' '}
                              {row.flag === 'r'
                                ? 'Reschedule (r)'
                                : row.flag === 'rm'
                                  ? 'Remove (rm)'
                                  : 'Cancel (c)'}
                            </span>
                            <div style={{ marginTop: 4, fontSize: '0.82em', color: '#555' }}>
                              Added By: {row.added_by_name || row.added_by || '-'} | Updated By:{' '}
                              {row.updated_by_name || row.updated_by || '-'}
                            </div>
                          </div>
                          <div className="master-actions-master-data" style={{ flexWrap: 'wrap' }}>
                            <span
                              className={
                                Number(row.activated) === 1
                                  ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                                  : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                              }
                            >
                              {Number(row.activated) === 1 ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              type="button"
                              className="action-btn-master-data neutral-master-data"
                              onClick={() => openEditModal('notSprayingRecen', row)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="action-btn-master-data"
                              style={{ background: Number(row.activated) === 1 ? '#dc2626' : '#16a34a' }}
                              onClick={() =>
                                handleQuickSave(async () => {
                                  await saveNotSprayingRecen({
                                    id: row.id,
                                    recen: row.recen,
                                    flag: row.flag,
                                    activated: Number(row.activated) === 1 ? 0 : 1,
                                  }).unwrap();
                                })
                              }
                            >
                              {Number(row.activated) === 1 ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {activeReasonsTab === 'deactivate' && (
                  <>
                    <div className="inline-form-master-data reasons-toolbar-master-data">
                      <div className="reasons-toolbar-left-master-data">
                        <input
                          className="reasons-search-master-data"
                          value={reasonSearch}
                          onChange={(e) => setReasonSearch(e.target.value)}
                          placeholder="Search reason"
                        />
                      </div>
                      <button type="button" className="btn-submit-master-data reasons-add-btn-master-data" onClick={() => openReasonAddModal('deactivateReason')}>
                        Add Deactivate Reason
                      </button>
                    </div>

                    <div className="master-list-master-data">
                      {filteredDeactivateReasons.map((row) => (
                        <div key={row.id} className="master-row-master-data">
                          <div style={{ flex: 1 }}>
                            <span className="master-label-master-data">{row.reason}</span>
                            <div style={{ marginTop: 4, fontSize: '0.82em', color: '#555' }}>
                              Added By: {row.added_by_name || row.added_by || '-'} | Updated By:{' '}
                              {row.updated_by_name || row.updated_by || '-'}
                            </div>
                          </div>
                          <div className="master-actions-master-data" style={{ flexWrap: 'wrap' }}>
                            <span
                              className={
                                Number(row.activated) === 1
                                  ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                                  : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                              }
                            >
                              {Number(row.activated) === 1 ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              type="button"
                              className="action-btn-master-data neutral-master-data"
                              onClick={() => openEditModal('deactivateReason', row)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="action-btn-master-data"
                              style={{ background: Number(row.activated) === 1 ? '#dc2626' : '#16a34a' }}
                              onClick={() =>
                                handleQuickSave(async () => {
                                  await saveDeactivateReason({
                                    id: row.id,
                                    reason: row.reason,
                                    activated: Number(row.activated) === 1 ? 0 : 1,
                                  }).unwrap();
                                })
                              }
                            >
                              {Number(row.activated) === 1 ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {selectedMasterModule === 'invoiceOrganizations' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Invoice Organizations</h3>
                    <p className="vehicle-master-note-master-data">
                      Billing company details for plantation tax invoices (name, BR, VAT no, address, logo).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={openAddInvoiceOrgModal}
                  >
                    Add organization
                  </button>
                </div>
                <div className="master-list-master-data" style={{ marginTop: 12 }}>
                  {invoiceOrganizations.length === 0 ? (
                    <div className="master-row-master-data">
                      <span style={{ color: '#666' }}>No organizations yet. Run plantation invoice SQL migration if tables are missing.</span>
                    </div>
                  ) : invoiceOrganizations.map((row) => (
                    <div key={row.id} className="master-row-master-data">
                      <div style={{ flex: 1 }}>
                        <span className="master-label-master-data">{row.org_name}</span>
                        <span style={{ marginLeft: 8, fontSize: '0.82em', color: '#555' }}>
                          {row.org_code ? `[${row.org_code}] ` : ''}
                          VAT: {row.vat_no || '—'} | BR: {row.br || '—'}
                        </span>
                      </div>
                      <div className="master-actions-master-data">
                        <span
                          className={
                            Number(row.activated) === 1
                              ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                              : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                          }
                        >
                          {Number(row.activated) === 1 ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          type="button"
                          className="action-btn-master-data neutral-master-data"
                          onClick={() => openEditModal('organization', row)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedMasterModule === 'invoiceTaxes' && (
              <div className="vehicle-admin-card-master-data">
                <div className="master-data-chemicals-head-master-data">
                  <div className="master-data-chemicals-head-text-master-data">
                    <h3>Invoice Tax Types</h3>
                    <p className="vehicle-master-note-master-data">
                      SSCL, VAT, and other line taxes applied when creating plantation invoices.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-submit-master-data master-data-chemicals-add-btn-master-data"
                    onClick={openAddInvoiceTaxModal}
                  >
                    Add tax type
                  </button>
                </div>
                <div className="vehicle-table-wrap-master-data" style={{ marginTop: 12 }}>
                  <table className="vehicle-table-master-data">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Tax</th>
                        <th>Rate %</th>
                        <th>Apply on</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceTaxTypes.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ color: '#666' }}>
                            No tax types configured.
                          </td>
                        </tr>
                      ) : invoiceTaxTypes.map((row) => (
                        <tr key={row.id}>
                          <td>{row.sort_order ?? 0}</td>
                          <td>{row.tax_name}</td>
                          <td>{Number(row.rate_percent).toFixed(2)}</td>
                          <td>{row.apply_on === 'subtotal' ? 'Subtotal only' : 'Subtotal + prior taxes'}</td>
                          <td>
                            <span
                              className={
                                Number(row.activated) === 1
                                  ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active'
                                  : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'
                              }
                            >
                              {Number(row.activated) === 1 ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="action-btn-master-data neutral-master-data"
                              onClick={() => openEditModal('invoiceTax', row)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedMasterModule === 'securityCodes' && (
              <div className="vehicle-admin-card-master-data ictmdx-security-shell">
                <h3>Security Codes</h3>
                <p className="vehicle-admin-note-master-data ictmdx-security-note">
                  Current code is hidden for security. Any existing security code item can be reset to a new auto-generated 4-digit value.
                </p>
                <div className="master-list-master-data ictmdx-security-list">
                  {securityCodeItems.length === 0 ? (
                    <div className="master-row-master-data ictmdx-security-row">
                      <span className="ictmdx-security-empty">No security code items found.</span>
                    </div>
                  ) : securityCodeItems.map((item) => (
                    <div key={item.id} className="master-row-master-data ictmdx-security-row">
                      <div className="ictmdx-security-row-main">
                        <span className="master-label-master-data ictmdx-security-label">
                          {item.section || '-'} / {item.sec_tag || '-'}
                        </span>
                        <div className="ictmdx-security-meta">
                          Code: {item.current_code || 'Not set'} | Last Changed By:{' '}
                          {item.last_changed_by_name
                            ? `${item.last_changed_by_name}${item.last_changed_by_mobile_masked ? ` (${item.last_changed_by_mobile_masked})` : ''}`
                            : 'Not available'}
                          {' '}| Last Changed At:{' '}
                          {item.last_changed_at ? new Date(item.last_changed_at).toLocaleString() : 'Not available'}
                        </div>
                      </div>
                      <button
                        className="btn-submit-master-data ictmdx-security-reset-btn"
                        disabled={resettingFinanceSecurity}
                        onClick={async () => {
                          try {
                            const payload = await resetSecurityCode({ id: item.id }).unwrap();
                            const smsMobile = String(payload?.mobile_no || '').trim();
                            const otp = String(payload?.otp_code || '').trim();
                            if (!smsMobile || !otp) {
                              throw new Error('Unable to send OTP. Missing mobile number or generated code.');
                            }
                            const codeLabel = `${item.section || '-'} / ${item.sec_tag || '-'}`;
                            await sendMessage({
                              mobile_no: smsMobile,
                              content: `Your DSMS security code for ${codeLabel} is: ${otp}. Do not share this code with anyone.`,
                            }).unwrap();
                            await refetchSecurityCodeItems();
                            setQuickMessage({
                              type: 'success',
                              text: `Security code reset for ${item.section || '-'} / ${item.sec_tag || '-'} and message sent to ${payload?.changed_by_mobile_masked || 'your mobile'}.`,
                            });
                          } catch (error) {
                            setQuickMessage({
                              type: 'error',
                              text: error?.data?.message || error?.message || 'Security code reset failed',
                            });
                          }
                        }}
                      >
                        {resettingFinanceSecurity ? 'Resetting...' : 'Reset & Send OTP'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="vehicle-admin-card-master-data">
          <h3>Vehicle Registry</h3>
          <p className="vehicle-admin-note-master-data">
            Vehicle registration and fleet edits are in Transport HR → Vehicle Management (Administration Wing → Vehicle Fleet).
          </p>

          <div className="vehicle-table-wrap-master-data">
            <table className="vehicle-table-master-data">
              <thead>
                <tr>
                  <th>ID</th><th>Vehicle No</th><th>Make/Model</th><th>Driver</th><th>Fuel Card</th><th>Category</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td>{v.id}</td>
                    <td>{v.vehicle_no}</td>
                    <td>{v.make || '-'} / {v.model || '-'}</td>
                    <td>{v.assigned_driver_name || '-'}</td>
                    <td>{v.linked_card_no_masked || '-'}</td>
                    <td>{v.vehicle_category_name || '-'}</td>
                    <td>
                      <span className={v.activated === 1 ? 'status-chip-master-data active-master-data ictmdx-status-chip ictmdx-status-chip--active' : 'status-chip-master-data inactive-master-data ictmdx-status-chip ictmdx-status-chip--inactive'}>
                        {v.activated === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="vehicle-admin-card-master-data">
          <h3>Pending Maintenance Approvals ({pendingMaintenance.length})</h3>
          <div className="vehicle-table-wrap-master-data">
            <table className="vehicle-table-master-data">
              <thead>
                <tr>
                  <th>ID</th><th>Date</th><th>Vehicle</th><th>Driver</th><th>Category</th><th>Description</th><th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {(pendingMaintenance.length ? pendingMaintenance : maintenanceRequests).map((m) => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>{m.date}</td>
                    <td>{m.vehicle_no || m.vehicle}</td>
                    <td>{m.driver_name || m.driver}</td>
                    <td>{m.category_name || m.category}</td>
                    <td>{m.description_name || m.description}</td>
                    <td>
                      {m.approval === 'p' ? (
                        <div className="actions-master-data">
                          <button className="action-btn-master-data approve-master-data" onClick={() => handleQuickSave(async () => decideMaintenance({ id: m.id, approval: 'a' }).unwrap())}>Approve</button>
                          <button className="action-btn-master-data danger-master-data" onClick={() => handleQuickSave(async () => decideMaintenance({ id: m.id, approval: 'd' }).unwrap())}>Decline</button>
                        </div>
                      ) : (
                        <span className={m.approval === 'a' ? 'status-chip-master-data approved-master-data ictmdx-status-chip ictmdx-status-chip--approved' : 'status-chip-master-data declined-master-data ictmdx-status-chip ictmdx-status-chip--declined'}>
                          {m.approval === 'a' ? 'Approved' : 'Declined'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editModal && (
        <div className="update-popup-overlay-master-data">
          <div
            className={`update-popup-card-master-data${editModal.type === 'chemical' || editModal.type === 'workingTime' || editModal.type === 'organization' || editModal.type === 'invoiceTax' ? ' update-popup-card-wide-master-data' : ''}`}
          >
            <h3>
              Edit{' '}
              {editModal.type === 'chemical'
                ? 'Chemical'
                : editModal.type === 'workingTime'
                  ? 'Working time'
                  : editModal.type === 'organization'
                    ? 'Invoice organization'
                    : editModal.type === 'invoiceTax'
                      ? 'Invoice tax type'
                      : editModal.type}
            </h3>
            {editModal.type === 'vehicleCategory' && (
              <input
                className="master-edit-input-master-data"
                value={modalDraft.category || ''}
                onChange={(e) => setModalDraft((p) => ({ ...p, category: e.target.value }))}
                placeholder="Category"
              />
            )}
            {editModal.type === 'maintenanceCategory' && (
              <input
                className="master-edit-input-master-data"
                value={modalDraft.category || ''}
                onChange={(e) => setModalDraft((p) => ({ ...p, category: e.target.value }))}
                placeholder="Category"
              />
            )}
            {editModal.type === 'poolRequestCategory' && (
              <input
                className="master-edit-input-master-data"
                value={modalDraft.category || ''}
                onChange={(e) => setModalDraft((p) => ({ ...p, category: e.target.value }))}
                placeholder="Request category"
              />
            )}
            {editModal.type === 'vehicleMake' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  className="master-edit-input-master-data"
                  value={modalDraft.vehicle_category_id || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, vehicle_category_id: e.target.value }))}
                >
                  <option value="">Select category</option>
                  {masterVehicleCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.category}</option>
                  ))}
                </select>
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.make || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, make: e.target.value }))}
                  placeholder="Make"
                />
              </div>
            )}
            {editModal.type === 'vehicleModel' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  className="master-edit-input-master-data"
                  value={modalDraft.vehicle_category_id || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, vehicle_category_id: e.target.value, vehicle_make_id: '' }))}
                >
                  <option value="">Select category</option>
                  {masterVehicleCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.category}</option>
                  ))}
                </select>
                <select
                  className="master-edit-input-master-data"
                  value={modalDraft.vehicle_make_id || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, vehicle_make_id: e.target.value }))}
                >
                  <option value="">Select make</option>
                  {modalVehicleModelMakes.map((m) => (
                    <option key={m.id} value={m.id}>{m.make}</option>
                  ))}
                </select>
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.model || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, model: e.target.value }))}
                  placeholder="Model"
                />
              </div>
            )}
            {editModal.type === 'financeCategory' && (
              <input
                className="master-edit-input-master-data"
                value={modalDraft.category_name || ''}
                onChange={(e) => setModalDraft((p) => ({ ...p, category_name: e.target.value }))}
                placeholder="Finance category name"
              />
            )}
            {editModal.type === 'financeSubCategory' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  className="master-edit-input-master-data"
                  value={modalDraft.finance_category || selectedFinanceCategoryId}
                  onChange={(e) => setModalDraft((p) => ({ ...p, finance_category: e.target.value }))}
                >
                  {financeCategoriesMaster.map((row) => (
                    <option key={row.id} value={row.id}>{row.category_name}</option>
                  ))}
                </select>
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.type || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, type: e.target.value }))}
                  placeholder="Sub category type (Vehicle / Generator for Fuel)"
                />
              </div>
            )}
            {editModal.type === 'wing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.wing || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, wing: e.target.value }))}
                  placeholder="Wing name"
                />
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.wingsCode || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, wingsCode: e.target.value }))}
                  placeholder="Wing code"
                />
              </div>
            )}
            {editModal.type === 'workLocation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.locationName || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, locationName: e.target.value }))}
                  placeholder="Location name"
                />
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.locationCode || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, locationCode: e.target.value }))}
                  placeholder="Location code"
                />
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.map_link || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, map_link: e.target.value }))}
                  placeholder="Google map link"
                />
              </div>
            )}
            {editModal.type === 'missionPartialReason' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.reason || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Reason"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Reason Type</label>
                    <select
                      className="master-edit-input-master-data"
                      value={modalDraft.flag || 'c'}
                      onChange={(e) => setModalDraft((p) => ({ ...p, flag: e.target.value }))}
                    >
                      <option value="c">Cancel (c)</option>
                      <option value="h">Partially Completed (h)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Chargeable?</label>
                    <select
                      className="master-edit-input-master-data"
                      value={modalDraft.chargeble || '0'}
                      onChange={(e) => setModalDraft((p) => ({ ...p, chargeble: e.target.value }))}
                    >
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            {editModal.type === 'notSprayingRecen' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.recen || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, recen: e.target.value }))}
                  placeholder="Reason"
                />
                <select
                  className="master-edit-input-master-data"
                  value={modalDraft.flag || 'c'}
                  onChange={(e) => setModalDraft((p) => ({ ...p, flag: e.target.value }))}
                >
                  <option value="c">Cancel (c)</option>
                  <option value="r">Reschedule (r)</option>
                  <option value="rm">Remove (rm)</option>
                </select>
              </div>
            )}
            {editModal.type === 'chemical' && (
              <div className="master-edit-grid-2col-master-data">
                <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                  <label htmlFor="master-edit-chemical-name">Chemical name</label>
                  <input
                    id="master-edit-chemical-name"
                    className="master-edit-input-master-data"
                    value={modalDraft.chemical || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, chemical: e.target.value }))}
                    placeholder="e.g. Urea, Coragen"
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-chemical-category">Category</label>
                  <select
                    id="master-edit-chemical-category"
                    className="master-edit-input-master-data"
                    value={modalDraft.category || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, category: e.target.value }))}
                  >
                    <option value="">None (optional)</option>
                    <option value="spy">Spray (spy)</option>
                    <option value="spd">Spread (spd)</option>
                  </select>
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-chemical-priority">Priority</label>
                  <input
                    id="master-edit-chemical-priority"
                    type="number"
                    className="master-edit-input-master-data"
                    value={modalDraft.priority || '50'}
                    onChange={(e) => setModalDraft((p) => ({ ...p, priority: e.target.value }))}
                    placeholder="50"
                    min="0"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-chemical-status">Status</label>
                  <select
                    id="master-edit-chemical-status"
                    className="master-edit-input-master-data"
                    value={modalDraft.activated || '1'}
                    onChange={(e) => setModalDraft((p) => ({ ...p, activated: e.target.value }))}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>
            )}
            {editModal.type === 'workingTime' && (
              <div className="master-edit-grid-2col-master-data">
                <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                  <label htmlFor="master-edit-wt-text">Time of day</label>
                  <input
                    id="master-edit-wt-text"
                    className="master-edit-input-master-data"
                    value={modalDraft.time_of_day || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, time_of_day: e.target.value }))}
                    placeholder="e.g. 6.30 to 10.30"
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-wt-status">Status</label>
                  <select
                    id="master-edit-wt-status"
                    className="master-edit-input-master-data"
                    value={modalDraft.activated || '1'}
                    onChange={(e) => setModalDraft((p) => ({ ...p, activated: e.target.value }))}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>
            )}
            {editModal.type === 'deactivateReason' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="master-edit-input-master-data"
                  value={modalDraft.reason || ''}
                  onChange={(e) => setModalDraft((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Deactivate reason"
                />
              </div>
            )}
            {editModal.type === 'organization' && (
              <div className="master-edit-grid-2col-master-data">
                <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                  <label htmlFor="master-edit-org-name">Organization name</label>
                  <input
                    id="master-edit-org-name"
                    className="master-edit-input-master-data"
                    value={modalDraft.org_name || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, org_name: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-org-code">Code</label>
                  <input
                    id="master-edit-org-code"
                    className="master-edit-input-master-data"
                    value={modalDraft.org_code || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, org_code: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-org-br">BR</label>
                  <input
                    id="master-edit-org-br"
                    className="master-edit-input-master-data"
                    value={modalDraft.br || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, br: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-org-vat">VAT registration no</label>
                  <input
                    id="master-edit-org-vat"
                    className="master-edit-input-master-data"
                    value={modalDraft.vat_no || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, vat_no: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                  <label htmlFor="master-edit-org-address">Address</label>
                  <textarea
                    id="master-edit-org-address"
                    className="master-edit-input-master-data"
                    rows={3}
                    value={modalDraft.address || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-org-tel">Telephone</label>
                  <input
                    id="master-edit-org-tel"
                    className="master-edit-input-master-data"
                    value={modalDraft.telephone || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, telephone: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-org-email">Email</label>
                  <input
                    id="master-edit-org-email"
                    className="master-edit-input-master-data"
                    value={modalDraft.email || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, email: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                  <label htmlFor="master-edit-org-logo">Logo path (public URL)</label>
                  <input
                    id="master-edit-org-logo"
                    className="master-edit-input-master-data"
                    value={modalDraft.logo_path || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, logo_path: e.target.value }))}
                    placeholder="/assets/images/kenilowrthlogoDark.png"
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-org-status">Status</label>
                  <select
                    id="master-edit-org-status"
                    className="master-edit-input-master-data"
                    value={modalDraft.activated || '1'}
                    onChange={(e) => setModalDraft((p) => ({ ...p, activated: e.target.value }))}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>
            )}
            {editModal.type === 'invoiceTax' && (
              <div className="master-edit-grid-2col-master-data">
                <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                  <label htmlFor="master-edit-tax-name">Tax name</label>
                  <input
                    id="master-edit-tax-name"
                    className="master-edit-input-master-data"
                    value={modalDraft.tax_name || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, tax_name: e.target.value }))}
                    placeholder="e.g. SSCL, VAT"
                    autoComplete="off"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-tax-rate">Rate (%)</label>
                  <input
                    id="master-edit-tax-rate"
                    type="number"
                    className="master-edit-input-master-data"
                    value={modalDraft.rate_percent || ''}
                    onChange={(e) => setModalDraft((p) => ({ ...p, rate_percent: e.target.value }))}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-tax-order">Sort order</label>
                  <input
                    id="master-edit-tax-order"
                    type="number"
                    className="master-edit-input-master-data"
                    value={modalDraft.sort_order ?? '0'}
                    onChange={(e) => setModalDraft((p) => ({ ...p, sort_order: e.target.value }))}
                    min="0"
                    step="1"
                  />
                </div>
                <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                  <label htmlFor="master-edit-tax-apply">Apply on</label>
                  <select
                    id="master-edit-tax-apply"
                    className="master-edit-input-master-data"
                    value={modalDraft.apply_on || 'running'}
                    onChange={(e) => setModalDraft((p) => ({ ...p, apply_on: e.target.value }))}
                  >
                    <option value="subtotal">Subtotal only</option>
                    <option value="running">Subtotal + prior taxes</option>
                  </select>
                </div>
                <div className="master-edit-field-master-data">
                  <label htmlFor="master-edit-tax-status">Status</label>
                  <select
                    id="master-edit-tax-status"
                    className="master-edit-input-master-data"
                    value={modalDraft.activated || '1'}
                    onChange={(e) => setModalDraft((p) => ({ ...p, activated: e.target.value }))}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>
            )}
            <div className="update-popup-actions-master-data">
              <button className="btn-search-master-data" onClick={closeEditModal}>Cancel</button>
              <button className="btn-submit-master-data" onClick={saveEditModal}>Save</button>
            </div>
          </div>
        </div>
      )}

      {addChemicalOpen && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data update-popup-card-wide-master-data">
            <h3>Add chemical</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-chemical-name">Chemical name</label>
                <input
                  id="master-add-chemical-name"
                  className="master-edit-input-master-data"
                  value={newChemicalName}
                  onChange={(e) => setNewChemicalName(e.target.value)}
                  placeholder="e.g. Urea, Coragen"
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-chemical-category">Category</label>
                <select
                  id="master-add-chemical-category"
                  className="master-edit-input-master-data"
                  value={newChemicalCategory}
                  onChange={(e) => setNewChemicalCategory(e.target.value)}
                >
                  <option value="">None (optional)</option>
                  <option value="spy">Spray (spy)</option>
                  <option value="spd">Spread (spd)</option>
                </select>
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-chemical-priority">Priority</label>
                <input
                  id="master-add-chemical-priority"
                  type="number"
                  className="master-edit-input-master-data"
                  value={newChemicalPriority}
                  onChange={(e) => setNewChemicalPriority(e.target.value)}
                  placeholder="50"
                  min="0"
                />
              </div>
            </div>
            <div className="update-popup-actions-master-data">
              <button type="button" className="btn-search-master-data" onClick={closeAddChemicalModal}>
                Cancel
              </button>
              <button type="button" className="btn-submit-master-data" onClick={() => void saveAddChemicalModal()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {addWingOpen && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data update-popup-card-wide-master-data">
            <h3>Add wing</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-wing-name">Wing name</label>
                <input
                  id="master-add-wing-name"
                  className="master-edit-input-master-data"
                  value={newWingName}
                  onChange={(e) => setNewWingName(e.target.value)}
                  placeholder="Wing name"
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-wing-code">Wing code</label>
                <input
                  id="master-add-wing-code"
                  className="master-edit-input-master-data"
                  value={newWingCode}
                  onChange={(e) => setNewWingCode(e.target.value)}
                  placeholder="Wing code"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="update-popup-actions-master-data">
              <button type="button" className="btn-search-master-data" onClick={closeAddWingModal}>
                Cancel
              </button>
              <button type="button" className="btn-submit-master-data" onClick={() => void saveAddWingModal()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {addWorkLocationOpen && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data update-popup-card-wide-master-data">
            <h3>Add work location</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-wl-name">Location name</label>
                <input
                  id="master-add-wl-name"
                  className="master-edit-input-master-data"
                  value={newWorkLocationName}
                  onChange={(e) => setNewWorkLocationName(e.target.value)}
                  placeholder="Location name"
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-wl-code">Location code</label>
                <input
                  id="master-add-wl-code"
                  className="master-edit-input-master-data"
                  value={newWorkLocationCode}
                  onChange={(e) => setNewWorkLocationCode(e.target.value)}
                  placeholder="Optional"
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-wl-map">Google map link</label>
                <input
                  id="master-add-wl-map"
                  className="master-edit-input-master-data"
                  value={newWorkLocationMapLink}
                  onChange={(e) => setNewWorkLocationMapLink(e.target.value)}
                  placeholder="Optional"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="update-popup-actions-master-data">
              <button type="button" className="btn-search-master-data" onClick={closeAddWorkLocationModal}>
                Cancel
              </button>
              <button type="button" className="btn-submit-master-data" onClick={() => void saveAddWorkLocationModal()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {addMaintenanceCategoryOpen && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data update-popup-card-wide-master-data">
            <h3>Add maintenance category</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-mc-name">Category name</label>
                <input
                  id="master-add-mc-name"
                  className="master-edit-input-master-data"
                  value={newMaintenanceCategory}
                  onChange={(e) => setNewMaintenanceCategory(e.target.value)}
                  placeholder="New maintenance category"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="update-popup-actions-master-data">
              <button type="button" className="btn-search-master-data" onClick={closeAddMaintenanceCategoryModal}>
                Cancel
              </button>
              <button type="button" className="btn-submit-master-data" onClick={() => void saveAddMaintenanceCategoryModal()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {addWorkingTimeOpen && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data update-popup-card-wide-master-data">
            <h3>Add working time</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-wt-text">Time of day</label>
                <input
                  id="master-add-wt-text"
                  className="master-edit-input-master-data"
                  value={newWorkingTimeText}
                  onChange={(e) => setNewWorkingTimeText(e.target.value)}
                  placeholder="e.g. 6.30 to 10.30 or 6.30 to 10.30 - 14.30 to 18.30"
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-wt-status">Status</label>
                <select
                  id="master-add-wt-status"
                  className="master-edit-input-master-data"
                  value={newWorkingTimeActivated}
                  onChange={(e) => setNewWorkingTimeActivated(e.target.value)}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            </div>
            <div className="update-popup-actions-master-data">
              <button type="button" className="btn-search-master-data" onClick={closeAddWorkingTimeModal}>
                Cancel
              </button>
              <button type="button" className="btn-submit-master-data" onClick={() => void saveAddWorkingTimeModal()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {addModal && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data">
            <h3>
              {addModal === 'vehicleCategory' ? 'Add Category' : addModal === 'vehicleMake' ? 'Add Make' : 'Add Model'}
            </h3>
            {addModal === 'vehicleCategory' && (
              <input
                className="master-edit-input-master-data"
                value={addDraft.category || ''}
                onChange={(e) => setAddDraft((p) => ({ ...p, category: e.target.value }))}
                placeholder="Category"
              />
            )}
            {addModal === 'vehicleMake' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  className="master-edit-input-master-data"
                  value={addDraft.vehicle_category_id || ''}
                  onChange={(e) => setAddDraft((p) => ({ ...p, vehicle_category_id: e.target.value }))}
                >
                  <option value="">Select category</option>
                  {masterVehicleCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.category}</option>
                  ))}
                </select>
                <input
                  className="master-edit-input-master-data"
                  value={addDraft.make || ''}
                  onChange={(e) => setAddDraft((p) => ({ ...p, make: e.target.value }))}
                  placeholder="Make"
                />
              </div>
            )}
            {addModal === 'vehicleModel' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  className="master-edit-input-master-data"
                  value={addDraft.vehicle_category_id || ''}
                  onChange={(e) => setAddDraft((p) => ({ ...p, vehicle_category_id: e.target.value, vehicle_make_id: '' }))}
                >
                  <option value="">Select category</option>
                  {masterVehicleCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.category}</option>
                  ))}
                </select>
                <select
                  className="master-edit-input-master-data"
                  value={addDraft.vehicle_make_id || ''}
                  onChange={(e) => setAddDraft((p) => ({ ...p, vehicle_make_id: e.target.value }))}
                >
                  <option value="">Select make</option>
                  {addModalModelMakes.map((m) => (
                    <option key={m.id} value={m.id}>{m.make}</option>
                  ))}
                </select>
                <input
                  className="master-edit-input-master-data"
                  value={addDraft.model || ''}
                  onChange={(e) => setAddDraft((p) => ({ ...p, model: e.target.value }))}
                  placeholder="Model"
                />
              </div>
            )}
            <div className="update-popup-actions-master-data">
              <button className="btn-search-master-data" onClick={closeAddModal}>Cancel</button>
              <button className="btn-submit-master-data" onClick={saveAddModal}>Save</button>
            </div>
          </div>
        </div>
      )}
      {reasonAddModalType && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data">
            <h3>
              {reasonAddModalType === 'missionPartialReason'
                ? 'Add Pilot/OpsRoom Reason'
                : reasonAddModalType === 'notSprayingRecen'
                  ? 'Add Manager Reason'
                  : 'Add Deactivate Reason'}
            </h3>
            {reasonAddModalType === 'missionPartialReason' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="master-edit-input-master-data"
                  value={reasonAddDraft.reason || ''}
                  onChange={(e) => setReasonAddDraft((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Reason text"
                />
                <select
                  className="master-edit-input-master-data"
                  value={reasonAddDraft.flag || 'c'}
                  onChange={(e) => setReasonAddDraft((p) => ({ ...p, flag: e.target.value }))}
                >
                  <option value="c">Cancel (c)</option>
                  <option value="h">Partially Completed (h)</option>
                </select>
                <select
                  className="master-edit-input-master-data"
                  value={reasonAddDraft.chargeble || '0'}
                  onChange={(e) => setReasonAddDraft((p) => ({ ...p, chargeble: e.target.value }))}
                >
                  <option value="0">Chargeable: No</option>
                  <option value="1">Chargeable: Yes</option>
                </select>
              </div>
            )}
            {reasonAddModalType === 'notSprayingRecen' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="master-edit-input-master-data"
                  value={reasonAddDraft.recen || ''}
                  onChange={(e) => setReasonAddDraft((p) => ({ ...p, recen: e.target.value }))}
                  placeholder="Reason text"
                />
                <select
                  className="master-edit-input-master-data"
                  value={reasonAddDraft.flag || 'c'}
                  onChange={(e) => setReasonAddDraft((p) => ({ ...p, flag: e.target.value }))}
                >
                  <option value="c">Cancel (c)</option>
                  <option value="r">Reschedule (r)</option>
                  <option value="rm">Remove (rm)</option>
                </select>
              </div>
            )}
            {reasonAddModalType === 'deactivateReason' && (
              <input
                className="master-edit-input-master-data"
                value={reasonAddDraft.reason || ''}
                onChange={(e) => setReasonAddDraft((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Deactivate reason"
              />
            )}
            <div className="update-popup-actions-master-data">
              <button className="btn-search-master-data" onClick={closeReasonAddModal}>Cancel</button>
              <button className="btn-submit-master-data" onClick={saveReasonAddModal}>Save</button>
            </div>
          </div>
        </div>
      )}
      {addInvoiceOrgOpen && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data update-popup-card-wide-master-data">
            <h3>Add invoice organization</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-org-name">Organization name</label>
                <input
                  id="master-add-org-name"
                  className="master-edit-input-master-data"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-org-code">Code</label>
                <input
                  id="master-add-org-code"
                  className="master-edit-input-master-data"
                  value={newOrgCode}
                  onChange={(e) => setNewOrgCode(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-org-br">BR</label>
                <input
                  id="master-add-org-br"
                  className="master-edit-input-master-data"
                  value={newOrgBr}
                  onChange={(e) => setNewOrgBr(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-org-vat">VAT registration no</label>
                <input
                  id="master-add-org-vat"
                  className="master-edit-input-master-data"
                  value={newOrgVatNo}
                  onChange={(e) => setNewOrgVatNo(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-org-address">Address</label>
                <textarea
                  id="master-add-org-address"
                  className="master-edit-input-master-data"
                  rows={3}
                  value={newOrgAddress}
                  onChange={(e) => setNewOrgAddress(e.target.value)}
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-org-tel">Telephone</label>
                <input
                  id="master-add-org-tel"
                  className="master-edit-input-master-data"
                  value={newOrgTelephone}
                  onChange={(e) => setNewOrgTelephone(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-org-email">Email</label>
                <input
                  id="master-add-org-email"
                  className="master-edit-input-master-data"
                  value={newOrgEmail}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-org-logo">Logo path (public URL)</label>
                <input
                  id="master-add-org-logo"
                  className="master-edit-input-master-data"
                  value={newOrgLogoPath}
                  onChange={(e) => setNewOrgLogoPath(e.target.value)}
                  placeholder="/assets/images/kenilowrthlogoDark.png"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="update-popup-actions-master-data">
              <button type="button" className="btn-search-master-data" onClick={closeAddInvoiceOrgModal}>
                Cancel
              </button>
              <button type="button" className="btn-submit-master-data" onClick={() => void saveAddInvoiceOrgModal()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {addInvoiceTaxOpen && (
        <div className="update-popup-overlay-master-data">
          <div className="update-popup-card-master-data update-popup-card-wide-master-data">
            <h3>Add invoice tax type</h3>
            <div className="master-edit-grid-2col-master-data">
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-tax-name">Tax name</label>
                <input
                  id="master-add-tax-name"
                  className="master-edit-input-master-data"
                  value={newTaxName}
                  onChange={(e) => setNewTaxName(e.target.value)}
                  placeholder="e.g. SSCL, VAT"
                  autoComplete="off"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-tax-rate">Rate (%)</label>
                <input
                  id="master-add-tax-rate"
                  type="number"
                  className="master-edit-input-master-data"
                  value={newTaxRate}
                  onChange={(e) => setNewTaxRate(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="master-edit-field-master-data">
                <label htmlFor="master-add-tax-order">Sort order</label>
                <input
                  id="master-add-tax-order"
                  type="number"
                  className="master-edit-input-master-data"
                  value={newTaxSortOrder}
                  onChange={(e) => setNewTaxSortOrder(e.target.value)}
                  min="0"
                  step="1"
                />
              </div>
              <div className="master-edit-field-master-data master-edit-field-span2-master-data">
                <label htmlFor="master-add-tax-apply">Apply on</label>
                <select
                  id="master-add-tax-apply"
                  className="master-edit-input-master-data"
                  value={newTaxApplyOn}
                  onChange={(e) => setNewTaxApplyOn(e.target.value)}
                >
                  <option value="subtotal">Subtotal only</option>
                  <option value="running">Subtotal + prior taxes</option>
                </select>
              </div>
            </div>
            <div className="update-popup-actions-master-data">
              <button type="button" className="btn-search-master-data" onClick={closeAddInvoiceTaxModal}>
                Cancel
              </button>
              <button type="button" className="btn-submit-master-data" onClick={() => void saveAddInvoiceTaxModal()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterData;
