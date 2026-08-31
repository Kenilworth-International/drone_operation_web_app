import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGetUserMemberTypesQuery, useGetUserJobRolesQuery, useGetUserLevelsQuery, useGetDrivingLicenseTypesQuery, useGetWorkLocationsQuery, useGetDSCSQuery, useGetProvincesQuery, useGetDistrictsQuery, useGetASCSQuery, useCreateEmployeeRegistrationMutation, useUpdateEmployeeRegistrationMutation, useGetEmployeeRegistrationByIdQuery, useGetLastEmpNoQuery, useLazyCheckEmpNoQuery, useGetAllEmployeeRegistrationsQuery } from '../../api/services NodeJs/jdManagementApi';
import { useGetEmpDepartmentsQuery } from '../../api/services NodeJs/empOrgStructureApi';
import { parseNic } from '../../utils/nic';
import '../../styles/employeeRegistration.css';

const EmployeeRegistration = ({ employeeId = null, embedded = false, onSaved = null } = {}) => {
  const isEditMode = Boolean(employeeId);
  const isValidNic = (nic) => {
    const value = String(nic || '').trim().toUpperCase();
    return /^\d{12}$/.test(value) || /^\d{9}V$/.test(value);
  };

  const isValidEmail = (email) => {
    const value = String(email || '').trim();
    if (!value) return true; // optional field
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const sanitizePhone9 = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 9);
    return digits.startsWith('0') ? digits.slice(1) : digits;
  };

  const parseEmpNoSuffix = (empNo) => {
    const match = String(empNo || '').trim().toUpperCase().match(/^EMP(\d+)$/);
    return match ? String(Number(match[1])) : '';
  };

  const formatEmpNoPreview = (suffix) => {
    if (!suffix || !/^\d+$/.test(String(suffix))) return '';
    return `EMP${String(Number(suffix)).padStart(3, '0')}`;
  };

  // Fetch User Member Types for Employee Type dropdown
  const { data: userMemberTypesData, isLoading: loadingMemberTypes } = useGetUserMemberTypesQuery();
  const userMemberTypes = userMemberTypesData?.data || [];

  // Fetch User Job Roles for Employee Job Role dropdown
  const { data: userJobRolesData, isLoading: loadingJobRoles } = useGetUserJobRolesQuery();
  const userJobRoles = userJobRolesData?.data || [];

  // Fetch User Levels for User Level dropdown
  const { data: userLevelsData, isLoading: loadingLevels } = useGetUserLevelsQuery();
  const userLevels = userLevelsData?.data || [];

  // Fetch emp_departments for Department dropdown (HR org — not system wings)
  const { data: departmentsData, isLoading: loadingDepartments, error: departmentsError } = useGetEmpDepartmentsQuery();
  const departments = useMemo(() => {
    const list = Array.isArray(departmentsData) ? departmentsData : departmentsData?.data || [];
    return [...list]
      .filter((d) => Number(d.activated) !== 0)
      .sort((a, b) => String(a.department_name || a.dept_code || '').localeCompare(String(b.department_name || b.dept_code || '')));
  }, [departmentsData]);

  // Fetch Driving License Types for Driving License Type dropdown
  const { data: drivingLicenseTypesData, isLoading: loadingLicenseTypes } = useGetDrivingLicenseTypesQuery();
  const drivingLicenseTypes = drivingLicenseTypesData?.data || [];

  // Fetch Work Locations for Work Location dropdown
  const { data: workLocationsData, isLoading: loadingWorkLocations } = useGetWorkLocationsQuery();
  const workLocations = useMemo(() => {
    if (!workLocationsData) return [];
    if (Array.isArray(workLocationsData)) return workLocationsData;
    if (workLocationsData.data && Array.isArray(workLocationsData.data)) return workLocationsData.data;
    return [];
  }, [workLocationsData]);

  // Fetch existing employees for Reporting Officer dropdown
  const { data: employeesData, isLoading: loadingEmployees } = useGetAllEmployeeRegistrationsQuery();
  const employees = useMemo(() => {
    if (!employeesData) return [];
    if (Array.isArray(employeesData)) return employeesData;
    if (employeesData.data && Array.isArray(employeesData.data)) return employeesData.data;
    return [];
  }, [employeesData]);

  const [activeTab, setActiveTab] = useState('employee');
  const [showLicenseHelpPopup, setShowLicenseHelpPopup] = useState(false);
  const [showLicenseDropdown, setShowLicenseDropdown] = useState(false);
  const licenseDropdownRef = useRef(null);
  const [reportingOfficerSearch, setReportingOfficerSearch] = useState('');
  const [showReportingOfficerDropdown, setShowReportingOfficerDropdown] = useState(false);
  const reportingOfficerDropdownRef = useRef(null);
  const [formData, setFormData] = useState({
    // Employee Details
    employeeName: '',
    title: '',
    nameWithInitials: '',
    preferredName: '',
    nic: '',
    taxIdentificationNo: '',
    drivingLicense: '',
    drivingLicenseType: [], // Changed to array for multiple selection
    race: '',
    nationality: 'Sri Lankan',
    bloodGroup: '',
    passportNo: '',
    religion: '',
    gender: '',
    dob: '',
    age: '',
    permanentAddress: '',
    temporaryAddress: '',
    telephoneHome: '',
    mobileNumber: '',
    companyMobileNo: '',
    emailAddress: '',
    personalEmail: '',
    companyEmailAddress: '',
    educationCertificates: null, // FileList for multiple files
    birthCertificate: null, // File for single file
    healthReport: null, // File for single file
    serviceLetters: null, // FileList for multiple files
    
    // Family Details
    maritalStatus: '',
    spouseName: '',
    marriedCertificate: null, // File for single file
    noOfChildren: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactNumber: '',
    
    // Security Details
    province: '',
    district: '',
    divisionalSecretariats: '',
    asc: '',
    policeStation: '',
    policeReport: null, // File for single file
    gndCertificate: null, // File for single file
    
    // Job Details
    empNo: '',
    companyName: '',
    shiftType: '',
    memberTypeFlag: '',
    employmentCategory: '',
    jobCategory: '',
    designation: '',
    employmentType: '',
    contractType: '',
    contractStartDate: '',
    contractEndDate: '',
    probationPeriod: '',
    probationEndDate: '',
    retirementDate: '',
    employeeStatus: '',
    biometricId: '',
    employeeType: 'i', // Default to Internal (typeCode: 'i')
    employeeJobRole: '',
    joinedDate: '',
    appointmentDate: '',
    department: '',
    reportingOfficer: '',
    jobRoleLayer: '',
    bulkLeaveAvailable: '0',
    flexHoursEnabled: '0',
    flexHoursMinutes: '0',
    leaveTypeAccess: '',
    workStatus: '',
    permanentDate: '',
    workLocation: '',
  });

  // State for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });
  const nicInvalid = Boolean(formData.nic) && !isValidNic(formData.nic);
  const emailInvalid = Boolean(formData.emailAddress) && !isValidEmail(formData.emailAddress);
  const companyEmailInvalid = Boolean(formData.companyEmailAddress) && !isValidEmail(formData.companyEmailAddress);
  const mobileInvalid = Boolean(formData.mobileNumber) && !/^[1-9]\d{8}$/.test(String(formData.mobileNumber || '').trim());
  const telephoneInvalid = Boolean(formData.telephoneHome) && !/^[1-9]\d{8}$/.test(String(formData.telephoneHome || '').trim());
  const emergencyPhoneInvalid = Boolean(formData.emergencyContactNumber) && !/^[1-9]\d{8}$/.test(String(formData.emergencyContactNumber || '').trim());
  
  // Employee Registration Mutation
  const [createEmployeeRegistration, { isLoading: isCreating }] = useCreateEmployeeRegistrationMutation();
  const [updateEmployeeRegistration, { isLoading: isUpdating }] = useUpdateEmployeeRegistrationMutation();

  // Edit mode: load the existing employee record
  const { data: editEmployeeResponse } = useGetEmployeeRegistrationByIdQuery(
    { id: employeeId },
    { skip: !isEditMode },
  );
  const editEmployee = editEmployeeResponse?.data || editEmployeeResponse || null;
  
  // Fetch last EMP NO for estimation
  const { data: lastEmpNoData, isLoading: loadingLastEmpNo } = useGetLastEmpNoQuery();
  const nextEmpNumber = lastEmpNoData?.data?.nextNumber ?? lastEmpNoData?.nextNumber ?? null;
  const [empNoSuffix, setEmpNoSuffix] = useState('');
  const [empNoSuffixInitialized, setEmpNoSuffixInitialized] = useState(false);
  const [empNoConflict, setEmpNoConflict] = useState(null);
  const [checkingEmpNo, setCheckingEmpNo] = useState(false);
  const [checkEmpNo] = useLazyCheckEmpNoQuery();

  // Fetch Provinces for Province dropdown
  const { data: provincesData, isLoading: loadingProvinces } = useGetProvincesQuery();
  const provinces = useMemo(() => {
    if (!provincesData) return [];
    if (Array.isArray(provincesData)) return provincesData;
    if (provincesData.data && Array.isArray(provincesData.data)) return provincesData.data;
    return [];
  }, [provincesData]);

  // Fetch Districts for District dropdown
  const { data: districtsData, isLoading: loadingDistricts } = useGetDistrictsQuery();
  const districts = useMemo(() => {
    if (!districtsData) return [];
    if (Array.isArray(districtsData)) return districtsData;
    if (districtsData.data && Array.isArray(districtsData.data)) return districtsData.data;
    return [];
  }, [districtsData]);

  // Fetch DSCS for Divisional Secretariats dropdown
  const { data: dscsData, isLoading: loadingDSCS } = useGetDSCSQuery();
  const dscs = useMemo(() => {
    if (!dscsData) return [];
    if (Array.isArray(dscsData)) return dscsData;
    if (dscsData.data && Array.isArray(dscsData.data)) return dscsData.data;
    return [];
  }, [dscsData]);

  // Fetch ASCS for ASC dropdown (filtered by district or DSCS)
  const { data: ascsData, isLoading: loadingASCS } = useGetASCSQuery({
    districtId: formData.district || undefined,
    dscsId: formData.divisionalSecretariats || undefined,
  }, { skip: !formData.district && !formData.divisionalSecretariats });
  const ascs = useMemo(() => {
    if (!ascsData) return [];
    if (Array.isArray(ascsData)) return ascsData;
    if (ascsData.data && Array.isArray(ascsData.data)) return ascsData.data;
    return [];
  }, [ascsData]);

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;
    
    // Handle file inputs
    if (type === 'file') {
      if (name === 'educationCertificates' || name === 'serviceLetters') {
        // Multiple files
        setFormData(prev => ({
          ...prev,
          [name]: files && files.length > 0 ? files : null
        }));
      } else {
        // Single file
        setFormData(prev => ({
          ...prev,
          [name]: files && files.length > 0 ? files[0] : null
        }));
      }
    } else {
      let normalizedValue = value;
      if (name === 'nic') {
        normalizedValue = String(value || '').toUpperCase().replace(/[^0-9VX]/g, '');
        if (normalizedValue.length <= 9) {
          normalizedValue = normalizedValue.replace(/[VX]/g, '');
        } else if (/^\d{9}[VX]/.test(normalizedValue)) {
          normalizedValue = normalizedValue.slice(0, 10);
        } else {
          normalizedValue = normalizedValue.replace(/[VX]/g, '').slice(0, 12);
        }
      }
      if (name === 'mobileNumber' || name === 'telephoneHome' || name === 'emergencyContactNumber') {
        normalizedValue = sanitizePhone9(value);
      }

      // Handle cascading dropdowns - reset dependent fields
      setFormData(prev => {
        const updates = { [name]: normalizedValue || '' };

        // Auto-derive DOB / Gender / Age from NIC
        if (name === 'nic') {
          const parsed = parseNic(normalizedValue);
          if (parsed.valid) {
            updates.dob = parsed.dob;
            updates.gender = parsed.gender;
            updates.age = parsed.age != null ? String(parsed.age) : '';
          }
        }
        // Keep age in sync when DOB is manually edited
        if (name === 'dob') {
          const parsedAge = parseNic(prev.nic);
          if (normalizedValue) {
            const d = new Date(normalizedValue);
            if (!Number.isNaN(d.getTime())) {
              const now = new Date();
              let age = now.getFullYear() - d.getFullYear();
              const md = now.getMonth() - d.getMonth();
              if (md < 0 || (md === 0 && now.getDate() < d.getDate())) age -= 1;
              updates.age = age >= 0 ? String(age) : '';
            }
          } else if (parsedAge.valid) {
            updates.age = parsedAge.age != null ? String(parsedAge.age) : '';
          }
        }
        
        // If province changes, reset district and dependent fields
        if (name === 'province') {
          updates.district = '';
          updates.divisionalSecretariats = '';
          updates.asc = '';
        }
        
        // If district changes, reset divisional secretariats and ASC
        if (name === 'district') {
          updates.divisionalSecretariats = '';
          updates.asc = '';
        }
        
        // If divisional secretariats changes, reset ASC
        if (name === 'divisionalSecretariats') {
          updates.asc = '';
        }
        
        // If Driving License is set to "No", clear Driving License Type
        if (name === 'drivingLicense' && value === 'No') {
          updates.drivingLicenseType = [];
        }
        if (name === 'flexHoursEnabled' && value !== '1') {
          updates.flexHoursMinutes = '0';
        }
        
        return {
          ...prev,
          ...updates
        };
      });
    }
  };

  const handleEmpNoSuffixChange = (e) => {
    const digits = String(e.target.value || '').replace(/\D/g, '');
    setEmpNoSuffix(digits);
  };

  // Handle date input click - make entire field clickable to open calendar
  const handleDateInputClick = (e) => {
    const input = e.target;
    if (input.type === 'date') {
      // Focus the input first
      input.focus();
      // Try to show the picker (modern browsers)
      if (input.showPicker) {
        try {
          input.showPicker();
        } catch (err) {
          // Fallback: just focus, native behavior will handle it
        }
      }
    }
  };

  // Handle license type selection
  const handleLicenseTypeToggle = (licenseId) => {
    // Don't allow selection if driving license is "No"
    if (formData.drivingLicense === 'No') {
      return;
    }
    
    setFormData(prev => {
      const currentTypes = prev.drivingLicenseType || [];
      if (currentTypes.includes(licenseId)) {
        return {
          ...prev,
          drivingLicenseType: currentTypes.filter(id => id !== licenseId)
        };
      } else {
        return {
          ...prev,
          drivingLicenseType: [...currentTypes, licenseId]
        };
      }
    });
  };

  // Handle remove license type
  const handleRemoveLicenseType = (licenseId) => {
    // Don't allow removal if driving license is "No"
    if (formData.drivingLicense === 'No') {
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      drivingLicenseType: (prev.drivingLicenseType || []).filter(id => id !== licenseId)
    }));
  };

  // Set Employee Type to Internal (typeCode: 'i') automatically (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    if (userMemberTypes.length > 0 && formData.employeeType !== 'i') {
      setFormData(prev => ({
        ...prev,
        employeeType: 'i'
      }));
    }
  }, [userMemberTypes, formData.employeeType, isEditMode]);

  useEffect(() => {
    if (isEditMode || empNoSuffixInitialized) return;
    if (loadingLastEmpNo) return;
    if (nextEmpNumber != null) {
      setEmpNoSuffix(String(nextEmpNumber));
      setEmpNoSuffixInitialized(true);
    }
  }, [isEditMode, loadingLastEmpNo, nextEmpNumber, empNoSuffixInitialized]);

  useEffect(() => {
    if (!isEditMode || !editEmployee?.empNo) return;
    const suffix = parseEmpNoSuffix(editEmployee.empNo);
    if (suffix) {
      setEmpNoSuffix(suffix);
      setEmpNoSuffixInitialized(true);
    }
  }, [isEditMode, editEmployee?.empNo]);

  useEffect(() => {
    if (!empNoSuffix || !/^\d+$/.test(empNoSuffix)) {
      setEmpNoConflict(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setCheckingEmpNo(true);
      try {
        const res = await checkEmpNo({
          empNoSuffix,
          excludeEmployeeId: isEditMode ? employeeId : null,
        }).unwrap();
        const data = res?.data || res;
        if (data && data.available === false && data.holder) {
          setEmpNoConflict(data.holder);
        } else {
          setEmpNoConflict(null);
        }
      } catch {
        setEmpNoConflict(null);
      } finally {
        setCheckingEmpNo(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [empNoSuffix, isEditMode, employeeId, checkEmpNo]);

  // Edit mode: prefill the form from the loaded employee record.
  // Codes stored in `employees` are mapped back to dropdown IDs.
  useEffect(() => {
    if (!isEditMode || !editEmployee) return;
    const splitDate = (v) => (v ? String(v).split('T')[0] : '');
    const jobRoleId = userJobRoles.find((r) => r.jdCode === editEmployee.employeeJobRole)?.id || '';
    const levelId = userLevels.find((l) => l.levelCode === editEmployee.jobRoleLayer)?.id || '';
    const deptId =
      editEmployee.emp_department_id != null && editEmployee.emp_department_id !== ''
        ? String(editEmployee.emp_department_id)
        : String(
            departments.find(
              (d) =>
                String(d.dept_code || '').toLowerCase() === String(editEmployee.department || '').toLowerCase() ||
                String(d.department_name || '').toLowerCase() === String(editEmployee.departmentName || '').toLowerCase()
            )?.id || ''
          );
    const locId = workLocations.find((wl) => wl.locationCode === editEmployee.workLocation)?.id || '';
    let licenseTypes = [];
    if (editEmployee.drivingLicenseType) {
      licenseTypes = String(editEmployee.drivingLicenseType)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (Number.isNaN(Number(s)) ? s : Number(s)));
    }
    setFormData((prev) => ({
      ...prev,
      employeeName: editEmployee.employeeName || '',
      title: editEmployee.title || '',
      nameWithInitials: editEmployee.nameWithInitials || '',
      preferredName: editEmployee.preferredName || '',
      nic: editEmployee.nic || '',
      taxIdentificationNo: editEmployee.taxIdentificationNo || '',
      drivingLicense: editEmployee.drivingLicense || '',
      drivingLicenseType: licenseTypes,
      race: editEmployee.race || '',
      nationality: editEmployee.nationality || 'Sri Lankan',
      bloodGroup: editEmployee.bloodGroup || '',
      passportNo: editEmployee.passportNo || '',
      religion: editEmployee.religion || '',
      gender: editEmployee.gender || '',
      dob: splitDate(editEmployee.dob),
      age: editEmployee.age != null ? String(editEmployee.age) : '',
      permanentAddress: editEmployee.permanentAddress || '',
      temporaryAddress: editEmployee.temporaryAddress || '',
      telephoneHome: editEmployee.telephoneHome || '',
      mobileNumber: editEmployee.mobileNumber || '',
      companyMobileNo: editEmployee.companyMobileNo || '',
      emailAddress: editEmployee.emailAddress || '',
      personalEmail: editEmployee.personalEmail || '',
      companyEmailAddress: editEmployee.companyEmailAddress || '',
      maritalStatus: editEmployee.maritalStatus || '',
      spouseName: editEmployee.spouseName || '',
      noOfChildren: editEmployee.noOfChildren ?? '',
      emergencyContactName: editEmployee.emergencyContactName || '',
      emergencyContactRelationship: editEmployee.emergencyContactRelationship || '',
      emergencyContactNumber: editEmployee.emergencyContactNumber || '',
      province: editEmployee.province || '',
      district: editEmployee.district || '',
      divisionalSecretariats: editEmployee.divisionalSecretariats || '',
      asc: editEmployee.ascsId || '',
      policeStation: editEmployee.policeStation || '',
      companyName: editEmployee.companyName || '',
      shiftType: editEmployee.shiftType || '',
      memberTypeFlag: editEmployee.memberTypeFlag || '',
      employmentCategory: editEmployee.employmentCategory || '',
      jobCategory: editEmployee.jobCategory || '',
      designation: editEmployee.designation || '',
      employmentType: editEmployee.employmentType || '',
      contractType: editEmployee.contractType || '',
      contractStartDate: splitDate(editEmployee.contractStartDate),
      contractEndDate: splitDate(editEmployee.contractEndDate),
      probationPeriod: editEmployee.probationPeriod || '',
      probationEndDate: splitDate(editEmployee.probationEndDate),
      retirementDate: splitDate(editEmployee.retirementDate),
      employeeStatus: editEmployee.employeeStatus || '',
      biometricId: editEmployee.biometricId || '',
      employeeType: editEmployee.employeeType || 'i',
      employeeJobRole: jobRoleId,
      joinedDate: splitDate(editEmployee.joinedDate),
      appointmentDate: splitDate(editEmployee.appointmentDate),
      department: deptId,
      reportingOfficer: editEmployee.reportofficer ? String(editEmployee.reportofficer) : '',
      jobRoleLayer: levelId,
      bulkLeaveAvailable: editEmployee.bulkLeaveAvailable != null ? String(editEmployee.bulkLeaveAvailable) : '0',
      flexHoursEnabled: editEmployee.flexHoursEnabled != null ? String(editEmployee.flexHoursEnabled) : '0',
      flexHoursMinutes: editEmployee.flexHoursMinutes != null ? String(editEmployee.flexHoursMinutes) : '0',
      workStatus: editEmployee.workStatus || '',
      permanentDate: splitDate(editEmployee.permanentDate),
      workLocation: locId,
    }));
  }, [isEditMode, editEmployee, userJobRoles, userLevels, departments, workLocations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (licenseDropdownRef.current && !licenseDropdownRef.current.contains(event.target)) {
        setShowLicenseDropdown(false);
      }
      if (reportingOfficerDropdownRef.current && !reportingOfficerDropdownRef.current.contains(event.target)) {
        setShowReportingOfficerDropdown(false);
      }
    };

    if (showLicenseDropdown || showReportingOfficerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLicenseDropdown, showReportingOfficerDropdown]);

  // Close dropdown when driving license is set to "No"
  useEffect(() => {
    if (formData.drivingLicense === 'No') {
      setShowLicenseDropdown(false);
    }
  }, [formData.drivingLicense]);

  useEffect(() => {
    if (!formData.reportingOfficer) {
      setReportingOfficerSearch('');
      return;
    }
    const selected = employees.find((emp) => String(emp.id) === String(formData.reportingOfficer));
    if (selected) {
      const displayName = selected.employeeName || selected.preferredName || selected.empNo || `Employee ${selected.id}`;
      setReportingOfficerSearch(displayName);
    }
  }, [formData.reportingOfficer, employees]);

  // Handle file removal
  const handleRemoveFile = (fieldName, fileIndex = null) => {
    if (fieldName === 'educationCertificates' || fieldName === 'serviceLetters') {
      // Remove specific file from multiple files
      const dt = new DataTransfer();
      const files = formData[fieldName];
      for (let i = 0; i < files.length; i++) {
        if (i !== fileIndex) {
          dt.items.add(files[i]);
        }
      }
      setFormData(prev => ({
        ...prev,
        [fieldName]: dt.files.length > 0 ? dt.files : null
      }));
    } else {
      // Remove single file
      setFormData(prev => ({
        ...prev,
        [fieldName]: null
      }));
      // Clear the file input
      const fileInput = document.querySelector(`input[name="${fieldName}"]`);
      if (fileInput) {
        fileInput.value = '';
      }
    }
  };

  const handleNext = () => {
    const tabs = ['employee', 'family', 'security', 'job'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const tabs = ['employee', 'family', 'security', 'job'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    // Client-side validation
    if (!isValidNic(formData.nic)) {
      setSubmitMessage({
        type: 'error',
        text: 'NIC must be either 12 digits or 9 digits ending with V (example: 123456789V).'
      });
      return;
    }
    if (!isValidEmail(formData.emailAddress)) {
      setSubmitMessage({
        type: 'error',
        text: 'Please enter a valid Email Address.'
      });
      return;
    }
    if (!isValidEmail(formData.companyEmailAddress)) {
      setSubmitMessage({
        type: 'error',
        text: 'Please enter a valid Company Email Address.'
      });
      return;
    }
    const phoneFields = [
      { key: 'mobileNumber', label: 'Mobile Number' },
      { key: 'telephoneHome', label: 'Telephone - Home' },
      { key: 'emergencyContactNumber', label: 'Emergency Contact Number' },
    ];
    for (const field of phoneFields) {
      const v = String(formData[field.key] || '').trim();
      if (v && !/^[1-9]\d{8}$/.test(v)) {
        setSubmitMessage({
          type: 'error',
          text: `${field.label} must be exactly 9 digits and cannot start with 0.`
        });
        return;
      }
    }

    if (!empNoSuffix || !/^\d+$/.test(empNoSuffix)) {
      setSubmitMessage({
        type: 'error',
        text: 'Please enter a valid employee number (digits only).',
      });
      return;
    }
    if (empNoConflict) {
      const holderName = empNoConflict.employeeName || empNoConflict.preferredName || 'another employee';
      setSubmitMessage({
        type: 'error',
        text: `Employee number ${formatEmpNoPreview(empNoSuffix)} is already assigned to ${holderName}.`,
      });
      return;
    }

    // Reset message
    setSubmitMessage({ type: '', text: '' });
    setIsSubmitting(true);

    try {
      // Get names for dropdown fields
      const employeeTypeObj = userMemberTypes.find(mt => mt.id === formData.employeeType || mt.typeCode === formData.employeeType);
      const employeeJobRoleObj = userJobRoles.find(jr => jr.id === formData.employeeJobRole);
      const jobRoleLayerObj = userLevels.find(ul => ul.id === formData.jobRoleLayer);
      const workLocationObj = workLocations.find(wl => wl.id === formData.workLocation);

      // Prepare FormData for file uploads
      const formDataToSend = new FormData();

      // Edit mode: include the employee id so backend updates the existing row
      if (isEditMode) {
        formDataToSend.append('id', String(employeeId));
      }

      // HR department from emp_departments (not system wings)
      if (formData.department) {
        formDataToSend.append('emp_department_id', String(formData.department));
      }
      
      // Add all form fields
      Object.keys(formData).forEach(key => {
        const value = formData[key];
        
        // Skip file fields - they'll be added separately
        if (key === 'educationCertificates' || key === 'birthCertificate' || 
            key === 'healthReport' || key === 'serviceLetters' || 
            key === 'marriedCertificate' || key === 'policeReport' || 
            key === 'gndCertificate') {
          return;
        }
        
        // Skip empNo — sent via empNoSuffix
        if (key === 'empNo') {
          return;
        }
        
        // Handle arrays (like drivingLicenseType)
        if (Array.isArray(value)) {
          formDataToSend.append(key, JSON.stringify(value));
        } else if (value !== null && value !== undefined && value !== '') {
          formDataToSend.append(key, value);
        }
      });

      formDataToSend.append('empNoSuffix', empNoSuffix);
      
      // Add files
      if (formData.educationCertificates) {
        Array.from(formData.educationCertificates).forEach(file => {
          formDataToSend.append('educationCertificates', file);
        });
      }
      if (formData.birthCertificate) {
        formDataToSend.append('birthCertificate', formData.birthCertificate);
      }
      if (formData.healthReport) {
        formDataToSend.append('healthReport', formData.healthReport);
      }
      if (formData.serviceLetters) {
        Array.from(formData.serviceLetters).forEach(file => {
          formDataToSend.append('serviceLetters', file);
        });
      }
      if (formData.marriedCertificate) {
        formDataToSend.append('marriedCertificate', formData.marriedCertificate);
      }
      if (formData.policeReport) {
        formDataToSend.append('policeReport', formData.policeReport);
      }
      if (formData.gndCertificate) {
        formDataToSend.append('gndCertificate', formData.gndCertificate);
      }

      // TEMP DEBUG: verify values before API call
      console.log('[EMP-REG][DEBUG][FRONTEND] Submit payload values:', {
        employeeName: formData.employeeName,
        nic: formData.nic,
        telephoneHome: formData.telephoneHome,
        mobileNumber: formData.mobileNumber,
      });
      console.log('[EMP-REG][DEBUG][FRONTEND] FormData mobileNumber entries:', formDataToSend.getAll('mobileNumber'));
      console.log('[EMP-REG][DEBUG][FRONTEND] FormData telephoneHome entries:', formDataToSend.getAll('telephoneHome'));

      const result = isEditMode
        ? await updateEmployeeRegistration(formDataToSend).unwrap()
        : await createEmployeeRegistration(formDataToSend).unwrap();

      if (isEditMode && result.status) {
        setSubmitMessage({ type: 'success', text: 'Employee details updated successfully.' });
        if (onSaved) onSaved(result.data);
        setTimeout(() => setSubmitMessage({ type: '', text: '' }), 4000);
        setIsSubmitting(false);
        return;
      }

      if (result.status) {
        // Success - show success message with created EMP NO
        // The empNo should be in result.data.empNo (not result.data.id)
        const createdEmpNo = result.data?.empNo || result.data?.data?.empNo || formatEmpNoPreview(empNoSuffix) || 'N/A';
        
        // Debug: Log to verify we're getting the right field
        if (!createdEmpNo || createdEmpNo === 'N/A' || createdEmpNo.toString().match(/^\d+$/)) {
          console.warn('Warning: EMP NO might be incorrect. Response:', result);
        }
        
        setSubmitMessage({ 
          type: 'success', 
          text: `Employee registration created successfully! Employee Number: ${createdEmpNo}` 
        });
        if (onSaved) onSaved(result.data);
        
        setEmpNoSuffixInitialized(false);
        setEmpNoConflict(null);
        
        // Clear form data
        setFormData({
          // Employee Details
          employeeName: '',
          title: '',
          nameWithInitials: '',
          preferredName: '',
          nic: '',
          taxIdentificationNo: '',
          drivingLicense: '',
          drivingLicenseType: [],
          race: '',
          nationality: 'Sri Lankan',
          bloodGroup: '',
          passportNo: '',
          religion: '',
          gender: '',
          dob: '',
          age: '',
          permanentAddress: '',
          temporaryAddress: '',
          telephoneHome: '',
          mobileNumber: '',
          companyMobileNo: '',
          emailAddress: '',
          personalEmail: '',
          companyEmailAddress: '',
          educationCertificates: null,
          birthCertificate: null,
          healthReport: null,
          serviceLetters: null,
          
          // Family Details
          maritalStatus: '',
          spouseName: '',
          marriedCertificate: null,
          noOfChildren: '',
          emergencyContactName: '',
          emergencyContactRelationship: '',
          emergencyContactNumber: '',
          
          // Security Details
          province: '',
          district: '',
          divisionalSecretariats: '',
          asc: '',
          policeStation: '',
          policeReport: null,
          gndCertificate: null,
          
          // Job Details
          empNo: '',
          companyName: '',
          shiftType: '',
          memberTypeFlag: '',
          employmentCategory: '',
          jobCategory: '',
          designation: '',
          employmentType: '',
          contractType: '',
          contractStartDate: '',
          contractEndDate: '',
          probationPeriod: '',
          probationEndDate: '',
          retirementDate: '',
          employeeStatus: '',
          biometricId: '',
          employeeType: 'i',
          employeeJobRole: '',
          joinedDate: '',
          appointmentDate: '',
          department: '',
          reportingOfficer: '',
          jobRoleLayer: '',
          bulkLeaveAvailable: '0',
          flexHoursEnabled: '0',
          flexHoursMinutes: '0',
          leaveTypeAccess: '',
          workStatus: '',
          permanentDate: '',
          workLocation: '',
        });

        // Reset to first tab
        setActiveTab('employee');

        // Clear message after 5 seconds
        setTimeout(() => {
          setSubmitMessage({ type: '', text: '' });
        }, 5000);
      }
    } catch (error) {
      // Handle error - improve conflict error messages
      let errorMessage = 'Failed to create employee registration. Please try again.';
      
      // Check for conflict errors (409 status)
      if (error?.status === 409 || error?.data?.status === false || error?.error?.status === 409) {
        // Use the backend error message directly (it's already user-friendly)
        errorMessage = error?.data?.message || error?.error?.data?.message || error?.message || 'A conflict occurred. Please check your input.';
        
        // Check for specific error codes from backend
        const errorCode = error?.data?.code || error?.error?.data?.code;
        if (errorCode === 'DUPLICATE_EMP_NO') {
          errorMessage = error?.data?.message || error?.error?.data?.message || errorMessage;
          const holder = error?.data?.details?.holder || error?.error?.data?.details?.holder;
          if (holder) {
            setEmpNoConflict(holder);
          }
        } else if (errorCode === 'DUPLICATE_MOBILE') {
          errorMessage = 'An employee with this mobile number already exists. Please use a different mobile number.';
        } else if (errorCode === 'DUPLICATE_NIC') {
          errorMessage = 'An employee with this NIC number already exists. Please use a different NIC number.';
        } else if (errorCode === 'DUPLICATE_EMAIL') {
          errorMessage = 'An employee with this email address already exists. Please use a different email address.';
        }
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.error?.data?.message) {
        errorMessage = error.error.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setSubmitMessage({ 
        type: 'error', 
        text: errorMessage 
      });

      // Clear error message after 10 seconds
      setTimeout(() => {
        setSubmitMessage({ type: '', text: '' });
      }, 10000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="employee-registration-container-emp-reg">
      <div className="registration-tabs-emp-reg">
        <button
          type="button"
          className={`registration-tab-emp-reg ${activeTab === 'employee' ? 'active' : ''}`}
          onClick={() => setActiveTab('employee')}
        >
          Employee Details
        </button>
        <button
          type="button"
          className={`registration-tab-emp-reg ${activeTab === 'family' ? 'active' : ''}`}
          onClick={() => setActiveTab('family')}
        >
          Family Details
        </button>
        <button
          type="button"
          className={`registration-tab-emp-reg ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Security Details
        </button>
        <button
          type="button"
          className={`registration-tab-emp-reg ${activeTab === 'job' ? 'active' : ''}`}
          onClick={() => setActiveTab('job')}
        >
          Job Details
        </button>
      </div>

      {/* Form Content */}
      <div className="registration-form-content-emp-reg">
        {/* Employee Details Tab */}
        {activeTab === 'employee' && (
          <div className="form-section-emp-reg">
            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Title:</label>
                <select name="title" value={formData.title} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Ms">Ms</option>
                  <option value="Miss">Miss</option>
                  <option value="Dr">Dr</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Employee Name (as per NIC):</label>
                <input
                  type="text"
                  name="employeeName"
                  value={formData.employeeName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Name with Initials:</label>
                <input
                  type="text"
                  name="nameWithInitials"
                  value={formData.nameWithInitials}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Preferred Name:</label>
                <input
                  type="text"
                  name="preferredName"
                  value={formData.preferredName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>NIC:</label>
                <input
                  type="text"
                  name="nic"
                  value={formData.nic}
                  onChange={handleInputChange}
                  maxLength={12}
                  placeholder="12 digits or 9 digits + V"
                  className={nicInvalid ? 'invalid-field-emp-reg' : ''}
                />
                {nicInvalid && (
                  <span className="field-error-emp-reg">
                    Invalid NIC format. Use 12 digits or 9 digits ending with V.
                  </span>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>Tax Identification Number:</label>
                <input
                  type="text"
                  name="taxIdentificationNo"
                  value={formData.taxIdentificationNo}
                  onChange={handleInputChange}
                  placeholder="If applicable"
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Nationality:</label>
                <select name="nationality" value={formData.nationality} onChange={handleInputChange}>
                  <option value="Sri Lankan">Sri Lankan</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Blood Group:</label>
                <select name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Passport No:</label>
                <input
                  type="text"
                  name="passportNo"
                  value={formData.passportNo}
                  onChange={handleInputChange}
                  placeholder="If applicable"
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Driving License:</label>
                <select
                  name="drivingLicense"
                  value={formData.drivingLicense}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select --</option>
                  <option value="No">No</option>
                  <option value="Light">Light</option>
                  <option value="Heavy">Heavy</option>
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>
                  Driving License Type:
                  <span 
                    className="license-help-icon-emp-reg"
                    onClick={() => !(formData.drivingLicense === 'No') && setShowLicenseHelpPopup(true)}
                    title="Click to see license code descriptions"
                    style={{ 
                      cursor: formData.drivingLicense === 'No' ? 'not-allowed' : 'pointer',
                      opacity: formData.drivingLicense === 'No' ? 0.5 : 1
                    }}
                  >
                    ?
                  </span>
                </label>
                
                {/* Selected License Types Display */}
                {formData.drivingLicenseType && formData.drivingLicenseType.length > 0 && (
                  <div className="selected-license-types-emp-reg">
                    {formData.drivingLicenseType.map(licenseId => {
                      const license = drivingLicenseTypes.find(l => l.id === licenseId);
                      if (!license) return null;
                      return (
                        <span key={licenseId} className="selected-license-tag-emp-reg">
                          {license.licenseCode}
                          <button
                            type="button"
                            className="remove-license-tag-emp-reg"
                            onClick={() => handleRemoveLicenseType(licenseId)}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Multi-Select Dropdown */}
                <div className="license-multi-select-container-emp-reg" ref={licenseDropdownRef}>
                  <div 
                    className="license-multi-select-input-emp-reg"
                    onClick={() => {
                      if (formData.drivingLicense !== 'No') {
                        setShowLicenseDropdown(!showLicenseDropdown);
                      }
                    }}
                    style={{ 
                      padding: '8px 12px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      cursor: formData.drivingLicense === 'No' ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: formData.drivingLicense === 'No' ? '#f5f5f5' : '#fff',
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      opacity: formData.drivingLicense === 'No' ? 0.6 : 1
                    }}
                  >
                    <span style={{ color: formData.drivingLicenseType.length === 0 ? '#999' : '#333' }}>
                      {formData.drivingLicense === 'No' 
                        ? 'Disabled (No driving license)' 
                        : (formData.drivingLicenseType.length === 0 ? 'Select license codes...' : `${formData.drivingLicenseType.length} selected`)
                      }
                    </span>
                    <span className="license-dropdown-arrow-emp-reg">▼</span>
                  </div>
                  
                  {showLicenseDropdown && formData.drivingLicense !== 'No' && (
                    <div className="license-multi-select-dropdown-emp-reg">
                      {drivingLicenseTypes.map(license => {
                          const isSelected = formData.drivingLicenseType && formData.drivingLicenseType.includes(license.id);
                          return (
                            <div
                              key={license.id}
                              className={`license-multi-select-option-emp-reg ${isSelected ? 'selected-license-emp-reg' : ''}`}
                              onClick={() => handleLicenseTypeToggle(license.id)}
                            >
                              <span className="license-option-text-emp-reg">
                                {license.licenseCode}
                              </span>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="license-checkbox-emp-reg"
                              />
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group-emp-reg">
                <label>Race:</label>
                <select
                  name="race"
                  value={formData.race}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select --</option>
                  <option value="Sinhalese">Sinhalese</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Muslim">Muslim</option>
                  <option value="Burgher">Burgher</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Religion:</label>
                <select
                  name="religion"
                  value={formData.religion}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select --</option>
                  <option value="Buddhist">Buddhist</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Christian">Christian</option>
                  <option value="Muslim">Muslim</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Gender:</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select --</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>DOB:</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  onClick={handleDateInputClick}
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Age:</label>
                <input
                  type="text"
                  name="age"
                  value={formData.age ? `${formData.age} years` : ''}
                  readOnly
                  placeholder="Auto from DOB/NIC"
                  style={{ backgroundColor: '#f5f5f5' }}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Email Address:</label>
                <input
                  type="email"
                  name="emailAddress"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
                  placeholder="example@domain.com"
                  className={emailInvalid ? 'invalid-field-emp-reg' : ''}
                />
                {emailInvalid && (
                  <span className="field-error-emp-reg">
                    Invalid email format for Email Address.
                  </span>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>Personal Email Address:</label>
                <input
                  type="email"
                  name="personalEmail"
                  value={formData.personalEmail}
                  onChange={handleInputChange}
                  placeholder="personal@domain.com"
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Company Email Address:</label>
                <input
                  type="email"
                  name="companyEmailAddress"
                  value={formData.companyEmailAddress}
                  onChange={handleInputChange}
                  className={companyEmailInvalid ? 'invalid-field-emp-reg' : ''}
                  placeholder="company@domain.com"
                />
                {companyEmailInvalid && (
                  <span className="field-error-emp-reg">
                    Invalid email format for Company Email Address.
                  </span>
                )}
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg full-width">
                <label>Permanent Address:</label>
                <textarea
                  name="permanentAddress"
                  value={formData.permanentAddress}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg full-width">
                <label>Temporary Address:</label>
                <textarea
                  name="temporaryAddress"
                  value={formData.temporaryAddress}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Telephone - Home:</label>
                <input
                  type="tel"
                  name="telephoneHome"
                  value={formData.telephoneHome}
                  onChange={handleInputChange}
                  maxLength={9}
                  placeholder="9 digits (no leading 0)"
                  className={telephoneInvalid ? 'invalid-field-emp-reg' : ''}
                />
                {telephoneInvalid && (
                  <span className="field-error-emp-reg">
                    Telephone - Home must be 9 digits and cannot start with 0.
                  </span>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>Mobile Number:</label>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  maxLength={9}
                  placeholder="9 digits (no leading 0)"
                  className={mobileInvalid ? 'invalid-field-emp-reg' : ''}
                />
                {mobileInvalid && (
                  <span className="field-error-emp-reg">
                    Mobile Number must be 9 digits and cannot start with 0.
                  </span>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>Company Mobile No:</label>
                <input
                  type="tel"
                  name="companyMobileNo"
                  value={formData.companyMobileNo}
                  onChange={handleInputChange}
                  placeholder="Company-provided number"
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Education Certificates:</label>
                <input
                  type="file"
                  name="educationCertificates"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleInputChange}
                />
                {formData.educationCertificates && formData.educationCertificates.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {Array.from(formData.educationCertificates).map((file, index) => (
                      <div key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        marginBottom: '4px',
                        backgroundColor: '#f0f4f8',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('educationCertificates', index)}
                          style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>Service Letters:</label>
                <input
                  type="file"
                  name="serviceLetters"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleInputChange}
                />
                {formData.serviceLetters && formData.serviceLetters.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    {Array.from(formData.serviceLetters).map((file, index) => (
                      <div key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        marginBottom: '4px',
                        backgroundColor: '#f0f4f8',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('serviceLetters', index)}
                          style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Birth Certificate:</label>
                <input
                  type="file"
                  name="birthCertificate"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleInputChange}
                />
                {formData.birthCertificate && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: '#f0f4f8',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formData.birthCertificate.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('birthCertificate')}
                        style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>Health Report:</label>
                <input
                  type="file"
                  name="healthReport"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleInputChange}
                />
                {formData.healthReport && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: '#f0f4f8',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formData.healthReport.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('healthReport')}
                        style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Family Details Tab */}
        {activeTab === 'family' && (
          <div className="form-section-emp-reg">
            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Marital Status:</label>
                <select
                  name="maritalStatus"
                  value={formData.maritalStatus}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select --</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Spouse's Name:</label>
                <input
                  type="text"
                  name="spouseName"
                  value={formData.spouseName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {formData.maritalStatus === 'Married' && (
              <div className="form-row-emp-reg">
                <div className="form-group-emp-reg">
                  <label>Married Certificate:</label>
                  <input
                    type="file"
                    name="marriedCertificate"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleInputChange}
                  />
                  {formData.marriedCertificate && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        backgroundColor: '#f0f4f8',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formData.marriedCertificate.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('marriedCertificate')}
                          style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="form-group-emp-reg">
                  {/* Empty placeholder for 2-column layout */}
                </div>
              </div>
            )}

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>No of Children:</label>
                <input
                  type="number"
                  name="noOfChildren"
                  value={formData.noOfChildren || ''}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Emergency Contact Name:</label>
                <input
                  type="text"
                  name="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Emergency Contact Relationship:</label>
                <select
                  name="emergencyContactRelationship"
                  value={formData.emergencyContactRelationship}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select --</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Friend">Friend</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Emergency Contact Number:</label>
                <input
                  type="tel"
                  name="emergencyContactNumber"
                  value={formData.emergencyContactNumber}
                  onChange={handleInputChange}
                  maxLength={9}
                  placeholder="9 digits (no leading 0)"
                  className={emergencyPhoneInvalid ? 'invalid-field-emp-reg' : ''}
                />
                {emergencyPhoneInvalid && (
                  <span className="field-error-emp-reg">
                    Emergency Contact Number must be 9 digits and cannot start with 0.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Security Details Tab */}
        {activeTab === 'security' && (
          <div className="form-section-emp-reg">
            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Province:</label>
                <select
                  name="province"
                  value={formData.province}
                  onChange={handleInputChange}
                  disabled={loadingProvinces}
                >
                  <option value="">-- Select --</option>
                  {provinces.map((province) => (
                    <option key={province.id} value={province.id}>
                      {province.province}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>District:</label>
                <select
                  name="district"
                  value={formData.district}
                  onChange={handleInputChange}
                  disabled={loadingDistricts}
                >
                  <option value="">-- Select --</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.district}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Divisional Secretariats:</label>
                <select
                  name="divisionalSecretariats"
                  value={formData.divisionalSecretariats}
                  onChange={handleInputChange}
                  disabled={loadingDSCS}
                >
                  <option value="">-- Select --</option>
                  {dscs.map((dsc) => (
                    <option key={dsc.id} value={dsc.id}>
                      {dsc.dse}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>ASC:</label>
                <select
                  name="asc"
                  value={formData.asc}
                  onChange={handleInputChange}
                  disabled={loadingASCS || (!formData.district && !formData.divisionalSecretariats)}
                >
                  <option value="">-- Select --</option>
                  {ascs.map((asc) => (
                    <option key={asc.id} value={asc.id}>
                      {asc.ascs}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Police Station:</label>
                <input
                  type="text"
                  name="policeStation"
                  value={formData.policeStation}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Police Report:</label>
                <input
                  type="file"
                  name="policeReport"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleInputChange}
                />
                {formData.policeReport && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: '#f0f4f8',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formData.policeReport.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('policeReport')}
                        style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>GND Certificate:</label>
                <input
                  type="file"
                  name="gndCertificate"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleInputChange}
                />
                {formData.gndCertificate && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: '#f0f4f8',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      <span style={{ flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formData.gndCertificate.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('gndCertificate')}
                        style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Job Details Tab */}
        {activeTab === 'job' && (
          <div className="form-section-emp-reg">
            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>EMP NO:</label>
                <div className="emp-no-input-group-emp-reg">
                  <span className="emp-no-prefix-emp-reg">EMP</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    name="empNoSuffix"
                    value={empNoSuffix}
                    onChange={handleEmpNoSuffixChange}
                    placeholder={loadingLastEmpNo ? 'Loading...' : '1'}
                    className="emp-no-suffix-input-emp-reg"
                  />
                </div>
                {checkingEmpNo && (
                  <small className="emp-no-hint-emp-reg">Checking availability...</small>
                )}
                {!checkingEmpNo && empNoConflict && (
                  <small className="emp-no-error-emp-reg">
                    Already assigned to {empNoConflict.employeeName || empNoConflict.preferredName || 'another employee'}
                  </small>
                )}
                {!checkingEmpNo && !empNoConflict && empNoSuffix && (
                  <small className="emp-no-success-emp-reg">
                    Will be saved as {formatEmpNoPreview(empNoSuffix)}
                  </small>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>User Level:</label>
                <select
                  name="jobRoleLayer"
                  value={formData.jobRoleLayer}
                  onChange={handleInputChange}
                  disabled={loadingLevels}
                >
                  <option value="">-- Select --</option>
                  {userLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.userLevel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Company:</label>
                <select name="companyName" value={formData.companyName} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="KWIL">KWIL</option>
                  <option value="CRMC">CRMC</option>
                  <option value="LAPMC">LAPMC</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Shift Type:</label>
                <select name="shiftType" value={formData.shiftType} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="Full time">Full time</option>
                  <option value="Roaster">Roaster (24 work days / 6 bulk holidays)</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Member Type:</label>
                <select name="memberTypeFlag" value={formData.memberTypeFlag} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="Internal">Internal</option>
                  <option value="External">External</option>
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Employment Category:</label>
                <select name="employmentCategory" value={formData.employmentCategory} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="Senior Management">Senior Management</option>
                  <option value="Middle Management">Middle Management</option>
                  <option value="Junior Management">Junior Management</option>
                  <option value="Non Management">Non Management</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Job Category:</label>
                <select name="jobCategory" value={formData.jobCategory} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="CEO">CEO</option>
                  <option value="COO">COO</option>
                  <option value="CHRO">CHRO</option>
                  <option value="HOD">HOD</option>
                  <option value="Manager">Manager</option>
                  <option value="Assistant Manager">Assistant Manager</option>
                  <option value="Senior Executive">Senior Executive</option>
                  <option value="Executive">Executive</option>
                  <option value="Junior Executive">Junior Executive</option>
                  <option value="Non-Executive">Non-Executive</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Designation (current job role):</label>
                <input
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Employment Type:</label>
                <select name="employmentType" value={formData.employmentType} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="Permanent Employee">Permanent Employee</option>
                  <option value="Probation Employee">Probation Employee</option>
                  <option value="Trainee Employee">Trainee Employee</option>
                  <option value="Intern">Intern</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Contract Type:</label>
                <select name="contractType" value={formData.contractType} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="Fixed-term Contract">Fixed-term Contract</option>
                  <option value="Short-term Contract">Short-term Contract</option>
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Contract Start Date:</label>
                <input
                  type="date"
                  name="contractStartDate"
                  value={formData.contractStartDate}
                  onChange={handleInputChange}
                  onClick={handleDateInputClick}
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Contract End Date:</label>
                <input
                  type="date"
                  name="contractEndDate"
                  value={formData.contractEndDate}
                  onChange={handleInputChange}
                  onClick={handleDateInputClick}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Probation Period:</label>
                <select name="probationPeriod" value={formData.probationPeriod} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="6 months">6 months</option>
                  <option value="9 months">9 months</option>
                  <option value="1 year">1 year</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Probation End Date (auto):</label>
                <input
                  type="date"
                  name="probationEndDate"
                  value={formData.probationEndDate}
                  onChange={handleInputChange}
                  onClick={handleDateInputClick}
                  placeholder="Auto-calculated"
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Retirement Date (auto, age 60):</label>
                <input
                  type="date"
                  name="retirementDate"
                  value={formData.retirementDate}
                  onChange={handleInputChange}
                  onClick={handleDateInputClick}
                  placeholder="Auto-calculated"
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Employee Status:</label>
                <select name="employeeStatus" value={formData.employeeStatus} onChange={handleInputChange}>
                  <option value="">-- Select --</option>
                  <option value="Active">Active</option>
                  <option value="On Long Leave">On Long Leave</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Resigned">Resigned</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Biometric / Fingerprint ID:</label>
                <input
                  type="text"
                  name="biometricId"
                  value={formData.biometricId}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Employee Job Role:</label>
                <select
                  name="employeeJobRole"
                  value={formData.employeeJobRole}
                  onChange={handleInputChange}
                  disabled={loadingJobRoles}
                >
                  <option value="">-- Select --</option>
                  {userJobRoles
                    .filter(role => role.status === 1) // Only show active job roles
                    .map((jobRole) => (
                      <option key={jobRole.id} value={jobRole.id}>
                        {jobRole.designation}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Employee Type:</label>
                <select
                  name="employeeType"
                  value={formData.employeeType}
                  onChange={handleInputChange}
                  disabled={true}
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                >
                  {userMemberTypes.map((memberType) => (
                    <option key={memberType.id} value={memberType.typeCode}>
                      {memberType.memberType}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Department:</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  disabled={loadingDepartments}
                >
                  <option value="">-- Select --</option>
                  {loadingDepartments ? (
                    <option value="" disabled>Loading...</option>
                  ) : departmentsError ? (
                    <option value="" disabled>Error loading departments</option>
                  ) : departments.length === 0 ? (
                    <option value="" disabled>No departments available</option>
                  ) : (
                    departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.department_name || dept.dept_code || `Department ${dept.id}`}
                      </option>
                    ))
                  )}
                </select>
                {departmentsError && (
                  <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Error: {departmentsError.message || 'Failed to load departments'}
                  </span>
                )}
              </div>
              <div className="form-group-emp-reg">
                <label>Reporting Officer:</label>
                <div className="reporting-officer-search-wrapper-emp-reg" ref={reportingOfficerDropdownRef}>
                  <input
                    type="text"
                    className="reporting-officer-search-input-emp-reg"
                    placeholder={loadingEmployees ? 'Loading employees...' : 'Search by name or EMP NO...'}
                    value={reportingOfficerSearch}
                    onChange={(e) => {
                      const value = e.target.value;
                      setReportingOfficerSearch(value);
                      setShowReportingOfficerDropdown(true);
                      if (!value.trim()) {
                        setFormData((prev) => ({ ...prev, reportingOfficer: '' }));
                      }
                    }}
                    onFocus={() => setShowReportingOfficerDropdown(true)}
                    disabled={loadingEmployees}
                    autoComplete="off"
                  />
                  <span className="reporting-officer-dropdown-indicator-emp-reg">▼</span>

                  {showReportingOfficerDropdown && !loadingEmployees && (
                    <div className="reporting-officer-suggestions-list-emp-reg">
                      {employees
                        .filter((emp) => {
                          const q = reportingOfficerSearch.trim().toLowerCase();
                          if (!q) return true;
                          const name = String(emp.employeeName || emp.preferredName || '').toLowerCase();
                          const empNo = String(emp.empNo || '').toLowerCase();
                          const id = String(emp.id || '').toLowerCase();
                          return name.includes(q) || empNo.includes(q) || id.includes(q);
                        })
                        .slice(0, 50)
                        .map((emp) => {
                          const displayName = emp.employeeName || emp.preferredName || emp.empNo || `Employee ${emp.id}`;
                          return (
                            <div
                              key={emp.id}
                              className="reporting-officer-suggestion-item-emp-reg"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, reportingOfficer: String(emp.id) }));
                                setReportingOfficerSearch(displayName);
                                setShowReportingOfficerDropdown(false);
                              }}
                            >
                              <div className="reporting-officer-name-emp-reg">{displayName}</div>
                              <div className="reporting-officer-meta-emp-reg">
                                {emp.empNo ? `EMP: ${emp.empNo}` : `ID: ${emp.id}`}
                              </div>
                            </div>
                          );
                        })}
                      {employees.filter((emp) => {
                        const q = reportingOfficerSearch.trim().toLowerCase();
                        if (!q) return true;
                        const name = String(emp.employeeName || emp.preferredName || '').toLowerCase();
                        const empNo = String(emp.empNo || '').toLowerCase();
                        const id = String(emp.id || '').toLowerCase();
                        return name.includes(q) || empNo.includes(q) || id.includes(q);
                      }).length === 0 && (
                        <div className="reporting-officer-no-result-emp-reg">No matching employees found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Joined Date:</label>
                <input
                  type="date"
                  name="joinedDate"
                  value={formData.joinedDate}
                  onChange={handleInputChange}
                  onClick={handleDateInputClick}
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Appointment Date (Current Start):</label>
                <input
                  type="date"
                  name="appointmentDate"
                  value={formData.appointmentDate}
                  onChange={handleInputChange}
                  onClick={handleDateInputClick}
                />
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg bulk-leave-special-emp-reg">
                <label>Bulk Leave Available:</label>
                <select
                  name="bulkLeaveAvailable"
                  value={formData.bulkLeaveAvailable}
                  onChange={handleInputChange}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Flex Hours Enabled:</label>
                <select
                  name="flexHoursEnabled"
                  value={formData.flexHoursEnabled}
                  onChange={handleInputChange}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="form-group-emp-reg">
                <label>Work Status:</label>
                <select
                  name="workStatus"
                  value={formData.workStatus}
                  onChange={handleInputChange}
                >
                  <option value="">-- Select --</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="form-row-emp-reg">
              <div className="form-group-emp-reg">
                <label>Flex Hours Minutes:</label>
                <input
                  type="number"
                  name="flexHoursMinutes"
                  min="0"
                  value={formData.flexHoursMinutes}
                  onChange={handleInputChange}
                  disabled={formData.flexHoursEnabled !== '1'}
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Permanent Date:</label>
                <input
                  type="date"
                  name="permanentDate"
                  value={formData.permanentDate}
                  onChange={handleInputChange}
                  onClick={handleDateInputClick}
                />
              </div>
              <div className="form-group-emp-reg">
                <label>Work Location:</label>
                <select
                  name="workLocation"
                  value={formData.workLocation}
                  onChange={handleInputChange}
                  disabled={loadingWorkLocations}
                >
                  <option value="">-- Select --</option>
                  {workLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.locationName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="registration-buttons-emp-reg">
        {activeTab !== 'employee' && (
          <button
            type="button"
            className="btn-back-emp-reg"
            onClick={handleBack}
          >
            Back
          </button>
        )}
        {activeTab !== 'job' ? (
          <button
            type="button"
            className="btn-next-emp-reg"
            onClick={handleNext}
          >
            Next
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-submit-emp-reg"
              onClick={handleSubmit}
              disabled={isSubmitting || isCreating || isUpdating}
            >
              {isSubmitting || isCreating || isUpdating
                ? 'Processing...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Employee'}
            </button>
            {submitMessage.text && (
              <div 
                style={{
                  marginTop: '10px',
                  padding: '10px',
                  borderRadius: '4px',
                  backgroundColor: submitMessage.type === 'success' ? '#d4edda' : '#f8d7da',
                  color: submitMessage.type === 'success' ? '#155724' : '#721c24',
                  border: `1px solid ${submitMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                  fontSize: '14px',
                }}
              >
                {submitMessage.text}
              </div>
            )}
          </>
        )}
      </div>

      {/* License Help Popup */}
      {showLicenseHelpPopup && (
        <div className="license-help-popup-overlay-emp-reg" onClick={() => setShowLicenseHelpPopup(false)}>
          <div className="license-help-popup-emp-reg" onClick={(e) => e.stopPropagation()}>
            <div className="license-help-popup-header-emp-reg">
              <h3>Driving License Code Descriptions</h3>
              <button 
                className="license-help-popup-close-emp-reg"
                onClick={() => setShowLicenseHelpPopup(false)}
              >
                ×
              </button>
            </div>
            <div className="license-help-popup-content-emp-reg">
              {drivingLicenseTypes.map(license => (
                <div key={license.id} className="license-help-item-emp-reg">
                  <strong className="license-help-code-emp-reg">{license.licenseCode}:</strong>
                  <span className="license-help-desc-emp-reg">{license.licenseType}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeRegistration;

