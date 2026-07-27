import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import * as XLSX from "xlsx";
import {
  useGetUserMemberTypesQuery,
  useGetUserJobRolesQuery,
  useGetUserLevelsQuery,
  useGetAllEmployeeRegistrationsQuery,
  useCreateUserMutation,
  useGetAllUsersQuery,
  useUpdateUserMutation,
  useGetGroupsQuery,
  useGetPlantationsQuery,
  useGetRegionsQuery,
  useGetEstatesQuery,
} from "../../../api/services NodeJs/jdManagementApi";
import { useGetWingsQuery } from "../../../api/services/assetsApi";
import ProfileImageUploadCard from "../../../components/ProfileImageUploadCard";
import "../../../styles/userRegistration.css";
import "../../../styles/userProfile.css";
import "../../../styles/userManagement.css";
import SuggestionPortal from "../../../components/SuggestionPortal";

const DRIVER_JOB_ROLE_CODE = "dri";
const isPrimaryDriverJobRole = (code) => {
  const c = String(code || "")
    .trim()
    .toLowerCase();
  return c === "dri" || c === "driex";
};
const isDriverLikeJobRoleForForms = (jobRole, partTimeDriverIsYes) =>
  isPrimaryDriverJobRole(jobRole) || Boolean(partTimeDriverIsYes);
const coerceEmbeddedTransportJobRole = (currentRole, partTimeDriverValue) => {
  return Number(partTimeDriverValue || 0) === 1
    ? currentRole || ""
    : DRIVER_JOB_ROLE_CODE;
};

export default function UsersDirectory({
  embeddedTransportDriver = false,
  onEmbeddedRegisterSuccess,
  embeddedInUserManagement = false,
  managementView = "legacy",
  registerInModal = false,
  onRegisterFormReady,
  onCancelAdd,
  onUserRegisteredSuccess,
  onMgmtProfileChange,
} = {}) {
  const [mgmtProfileUserId, setMgmtProfileUserId] = useState(null);
  const isMgmtList =
    embeddedInUserManagement && managementView === "list" && !mgmtProfileUserId;
  const isMgmtAdd = embeddedInUserManagement && managementView === "add";
  const isMgmtProfile = embeddedInUserManagement && Boolean(mgmtProfileUserId);
  const showLegacyTabs = !embeddedInUserManagement && !embeddedTransportDriver;

  const rootRef = useRef(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  // Fetch dropdown data
  const { data: userMemberTypesData } = useGetUserMemberTypesQuery();
  const userMemberTypes = userMemberTypesData?.data || [];

  const { data: userJobRolesData } = useGetUserJobRolesQuery();
  const userJobRoles = userJobRolesData?.data || [];

  const { data: userLevelsData } = useGetUserLevelsQuery();
  const userLevels = userLevelsData?.data || [];

  // External user fields
  const { data: groupsData } = useGetGroupsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const groups = useMemo(() => {
    const raw = groupsData?.data ?? groupsData;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.groups)) return raw.groups;
    return [];
  }, [groupsData]);

  const getGroupLabel = (group) =>
    group?.group ||
    group?.name ||
    group?.group_name ||
    (group?.id != null ? `Group ${group.id}` : "");

  const { data: plantationsData } = useGetPlantationsQuery();
  const plantations = Array.isArray(plantationsData?.data)
    ? plantationsData.data
    : Array.isArray(plantationsData)
      ? plantationsData
      : [];

  const { data: regionsData } = useGetRegionsQuery();
  const regions = Array.isArray(regionsData?.data)
    ? regionsData.data
    : Array.isArray(regionsData)
      ? regionsData
      : [];

  const { data: estatesData } = useGetEstatesQuery();
  const estates = Array.isArray(estatesData?.data)
    ? estatesData.data
    : Array.isArray(estatesData)
      ? estatesData
      : [];
  const { data: wingsResponse } = useGetWingsQuery();
  const wings = useMemo(() => {
    if (!wingsResponse) return [];
    if (Array.isArray(wingsResponse)) return wingsResponse;
    if (Array.isArray(wingsResponse?.wings)) return wingsResponse.wings;
    if (Array.isArray(wingsResponse?.data)) return wingsResponse.data;
    return [];
  }, [wingsResponse]);
  // Mutations
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const {
    data: allUsersData,
    isLoading: loadingUsers,
    refetch: refetchUsers,
  } = useGetAllUsersQuery();
  const {
    data: employeeRegistrationsData,
    isLoading: loadingEmployeeOptions,
    error: employeeOptionsError,
  } = useGetAllEmployeeRegistrationsQuery();
  const employeeOptions = useMemo(() => {
    if (!employeeRegistrationsData) return [];
    if (Array.isArray(employeeRegistrationsData))
      return employeeRegistrationsData;
    if (Array.isArray(employeeRegistrationsData?.data))
      return employeeRegistrationsData.data;
    if (Array.isArray(employeeRegistrationsData?.data?.data))
      return employeeRegistrationsData.data.data;
    if (Array.isArray(employeeRegistrationsData?.employees))
      return employeeRegistrationsData.employees;
    if (Array.isArray(employeeRegistrationsData?.data?.employees))
      return employeeRegistrationsData.data.employees;
    if (Array.isArray(employeeRegistrationsData?.employeeRegistrations))
      return employeeRegistrationsData.employeeRegistrations;
    if (Array.isArray(employeeRegistrationsData?.data?.employeeRegistrations))
      return employeeRegistrationsData.data.employeeRegistrations;
    return [];
  }, [employeeRegistrationsData]);

  // State
  const [userType, setUserType] = useState(""); // 'i' for internal, 'e' for external
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    nic: "",
    mobile_no: "",
    password: "",
    confirmPassword: "",
    member_type: "",
    job_role: "",
    part_time_driver: "0",
    user_level: "g",
    employeeId: null, // Link to employees table
    sect_command: "0",
    activated: "1",
    image: null, // Profile picture file
    // External user fields
    group: "",
    plantation: "",
    region: "",
    estate: "",
    // Driver fields (job_role dri / driex, or part-time driver)
    driver_license_no: "",
    driver_license_front_image: null,
    driver_license_back_image: null,
  });

  const [submitMessage, setSubmitMessage] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);
  const [activeTab, setActiveTab] = useState("register");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editMessage, setEditMessage] = useState({ type: "", text: "" });
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [editEmployeeSearchTerm, setEditEmployeeSearchTerm] = useState("");
  const [showEditEmployeeDropdown, setShowEditEmployeeDropdown] =
    useState(false);
  const [selectedUserImageUrl, setSelectedUserImageUrl] = useState("");
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState("");
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    nic: "",
    mobile_no: "",
    password: "",
    confirmPassword: "",
    member_type: "",
    job_role: "",
    part_time_driver: "0",
    user_level: "g",
    employeeId: "",
    activated: "1",
    image: null,
    group: "",
    plantation: "",
    region: "",
    estate: "",
  });
  const activeUserJobRoles = useMemo(
    () => userJobRoles.filter((role) => Number(role?.status) === 1),
    [userJobRoles],
  );
  const roleMetaByCode = useMemo(() => {
    const map = new Map();
    activeUserJobRoles.forEach((role) => {
      const key = String(role?.jdCode || role?.id || "").trim();
      if (!key) return;
      map.set(key, {
        memberTypeCode: String(role?.memberTypeCode || "").trim(),
        userLevelCode: String(role?.userLevelCode || "").trim(),
      });
    });
    return map;
  }, [activeUserJobRoles]);
  const effectiveUserType = String(
    formData.member_type || userType || "",
  ).trim();

  useEffect(() => {
    if (!embeddedTransportDriver) return;
    setFormData((prev) => ({
      ...prev,
      job_role: coerceEmbeddedTransportJobRole(
        prev.job_role,
        prev.part_time_driver,
      ),
    }));
  }, [embeddedTransportDriver]);

  useEffect(() => {
    if (!registerInModal || !onRegisterFormReady) return;
    onRegisterFormReady();
  }, [registerInModal, onRegisterFormReady]);
  useEffect(() => {
    if (userType !== effectiveUserType) {
      setUserType(effectiveUserType);
    }
  }, [effectiveUserType, userType]);

  const allUsers = useMemo(() => allUsersData?.data || [], [allUsersData]);
  const availableEmployeeOptionsForRegister = useMemo(() => {
    const usedEmployeeIds = new Set(
      allUsers.filter((u) => u?.employeeId).map((u) => String(u.employeeId)),
    );
    return employeeOptions.filter(
      (employee) => !usedEmployeeIds.has(String(employee.id)),
    );
  }, [allUsers, employeeOptions]);
  const availableEmployeeOptionsForEdit = useMemo(() => {
    const usedEmployeeIds = new Set(
      allUsers
        .filter((u) => {
          if (!u?.employeeId) return false;
          // Keep current edit user's own employee link selectable.
          return String(u.id) !== String(selectedUserId || "");
        })
        .map((u) => String(u.employeeId)),
    );

    return employeeOptions.filter(
      (employee) => !usedEmployeeIds.has(String(employee.id)),
    );
  }, [allUsers, employeeOptions, selectedUserId]);

  const filteredUsers = useMemo(() => {
    const q = userSearchTerm.trim().toLowerCase();
    return allUsers.filter((u) => {
      const matchesSearch =
        !q ||
        String(u?.name || "")
          .toLowerCase()
          .includes(q) ||
        String(u?.nic || "")
          .toLowerCase()
          .includes(q) ||
        String(u?.mobile_no || "")
          .toLowerCase()
          .includes(q) ||
        String(u?.email || "")
          .toLowerCase()
          .includes(q) ||
        String(u?.job_role || "")
          .toLowerCase()
          .includes(q);
      const matchesType =
        !userTypeFilter || String(u?.member_type || "") === userTypeFilter;
      const matchesRole =
        !userRoleFilter || String(u?.job_role || "") === userRoleFilter;
      return matchesSearch && matchesType && matchesRole;
    });
  }, [allUsers, userSearchTerm, userTypeFilter, userRoleFilter]);

  const memberTypeLabelMap = useMemo(() => {
    const map = {};
    userMemberTypes.forEach((item) => {
      const code = String(item?.typeCode || "").trim();
      const label = String(item?.memberType || "").trim();
      if (code) map[code] = label || code;
    });
    return map;
  }, [userMemberTypes]);

  const jobRoleLabelMap = useMemo(() => {
    const map = {};
    userJobRoles.forEach((item) => {
      const code = String(item?.jdCode || item?.id || "").trim();
      const label = String(item?.designation || "").trim();
      if (code) map[code] = label || code;
    });
    return map;
  }, [userJobRoles]);

  const formatEmployeeOptionLabel = useMemo(
    () => (employee) => {
      if (!employee) return "";
      const displayName =
        employee.employeeName ||
        employee.preferredName ||
        employee.name ||
        "Unnamed";
      const empNo = employee.empNo ? ` (${employee.empNo})` : "";
      return `${displayName}${empNo} - ID ${employee.id}`;
    },
    [],
  );
  const filteredRegisterEmployeeOptions = useMemo(() => {
    const q = employeeSearchTerm.trim().toLowerCase();
    if (!q) return availableEmployeeOptionsForRegister;
    return availableEmployeeOptionsForRegister.filter((employee) => {
      const name = String(
        employee.employeeName || employee.preferredName || employee.name || "",
      ).toLowerCase();
      const empNo = String(employee.empNo || "").toLowerCase();
      const nic = String(employee.nic || "").toLowerCase();
      const idText = String(employee.id || "").toLowerCase();
      return (
        name.includes(q) ||
        empNo.includes(q) ||
        nic.includes(q) ||
        idText.includes(q) ||
        formatEmployeeOptionLabel(employee).toLowerCase().includes(q)
      );
    });
  }, [
    availableEmployeeOptionsForRegister,
    employeeSearchTerm,
    formatEmployeeOptionLabel,
  ]);

  const plantationLabelMap = useMemo(() => {
    const map = {};
    plantations.forEach((item) => {
      if (item?.id != null) {
        map[String(item.id)] = item.plantation || String(item.id);
      }
    });
    return map;
  }, [plantations]);

  const estateLabelMap = useMemo(() => {
    const map = {};
    estates.forEach((item) => {
      if (item?.id != null) {
        map[String(item.id)] = item.estate || String(item.id);
      }
    });
    return map;
  }, [estates]);

  const wingLabelMap = useMemo(() => {
    const map = {};
    wings.forEach((item) => {
      if (item?.id != null) {
        map[String(item.id)] = item.wing || String(item.id);
      }
    });
    return map;
  }, [wings]);

  const normalizeMobileNo = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    const withoutLeadingZero = digits.startsWith("0")
      ? digits.slice(1)
      : digits;
    return withoutLeadingZero.slice(0, 9);
  };
  const isValidEmail = (value) => {
    const v = String(value || "").trim();
    if (!v) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  };
  const isValidMobileNo = (value) =>
    /^[1-9]\d{8}$/.test(String(value || "").trim());
  const registerEmailInvalid =
    Boolean(formData.email) && !isValidEmail(formData.email);
  const registerMobileInvalid =
    Boolean(formData.mobile_no) && !isValidMobileNo(formData.mobile_no);
  const editEmailInvalid =
    Boolean(editFormData.email) && !isValidEmail(editFormData.email);
  const editMobileInvalid =
    Boolean(editFormData.mobile_no) && !isValidMobileNo(editFormData.mobile_no);

  const generateEightLetterPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let generated = "";
    for (let i = 0; i < 8; i += 1) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return generated;
  };

  const handleGenerateRegisterPassword = () => {
    const generated = generateEightLetterPassword();
    setFormData((prev) => ({
      ...prev,
      password: generated,
      confirmPassword: generated,
    }));
  };

  const handleGenerateEditPassword = () => {
    const generated = generateEightLetterPassword();
    setEditFormData((prev) => ({
      ...prev,
      password: generated,
      confirmPassword: generated,
    }));
  };

  useEffect(() => {
    if (!rootRef.current) return;
    const nodes = rootRef.current.querySelectorAll("[class]");
    nodes.forEach((node) => {
      const current = (node.getAttribute("class") || "")
        .split(" ")
        .filter(Boolean);
      const withSuffix = current.map((className) =>
        className.endsWith("-user-maintain")
          ? className
          : `${className}-user-maintain`,
      );
      const merged = [...new Set([...current, ...withSuffix])];
      node.setAttribute("class", merged.join(" "));
    });
  }, [
    activeTab,
    selectedUserId,
    showUpdatePopup,
    showEditPopup,
    filteredUsers.length,
  ]);

  useEffect(() => {
    if (editFormData.image instanceof File) {
      const previewUrl = URL.createObjectURL(editFormData.image);
      setEditImagePreviewUrl(previewUrl);
      return () => URL.revokeObjectURL(previewUrl);
    }
    setEditImagePreviewUrl("");
    return undefined;
  }, [editFormData.image]);

  useEffect(() => {
    if (!editFormData.employeeId) {
      setEditEmployeeSearchTerm("");
      return;
    }
    const selected = availableEmployeeOptionsForEdit.find(
      (employee) => String(employee.id) === String(editFormData.employeeId),
    );
    if (selected) {
      setEditEmployeeSearchTerm(formatEmployeeOptionLabel(selected));
    }
  }, [
    editFormData.employeeId,
    availableEmployeeOptionsForEdit,
    formatEmployeeOptionLabel,
  ]);

  const startEditUser = (user, options = {}) => {
    setSelectedUserId(user?.id || null);
    setEditMessage({ type: "", text: "" });
    setEditFormData({
      name: user?.name || "",
      email: user?.email || "",
      nic: user?.nic || "",
      mobile_no: normalizeMobileNo(user?.mobile_no || ""),
      password: "",
      confirmPassword: "",
      member_type: user?.member_type || "",
      job_role: user?.job_role || "",
      part_time_driver: String(user?.part_time_driver ?? "0"),
      user_level: user?.user_level || "g",
      employeeId: user?.employeeId != null ? String(user.employeeId) : "",
      activated: String(user?.activated ?? "1"),
      image: null,
      group: user?.group ? String(user.group) : "",
      plantation: user?.plantation ? String(user.plantation) : "",
      region: user?.region ? String(user.region) : "",
      estate: user?.estate ? String(user.estate) : "",
    });
    setSelectedUserImageUrl(user?.image || "");
    setShowEditPopup(true);
  };

  const openMgmtUserProfile = (user) => {
    if (!user?.id) return;
    setMgmtProfileUserId(user.id);
    startEditUser(user);
  };

  const closeMgmtUserProfile = useCallback(() => {
    setMgmtProfileUserId(null);
    setShowEditPopup(false);
    setShowUpdatePopup(false);
    setSelectedUserId(null);
    setEditMessage({ type: "", text: "" });
    setSelectedUserImageUrl("");
  }, []);

  useEffect(() => {
    if (!embeddedInUserManagement || typeof onMgmtProfileChange !== "function")
      return;
    onMgmtProfileChange(
      isMgmtProfile,
      isMgmtProfile ? closeMgmtUserProfile : null,
    );
  }, [
    embeddedInUserManagement,
    isMgmtProfile,
    onMgmtProfileChange,
    closeMgmtUserProfile,
  ]);

  useEffect(() => {
    if (!isMgmtProfile || !mgmtProfileUserId || loadingUsers) return;
    const user = allUsers.find(
      (u) => String(u.id) === String(mgmtProfileUserId),
    );
    if (user && String(selectedUserId) !== String(mgmtProfileUserId)) {
      startEditUser(user);
    }
  }, [
    isMgmtProfile,
    mgmtProfileUserId,
    allUsers,
    loadingUsers,
    selectedUserId,
  ]);

  const handleEditInputChange = (e) => {
    const { name, value, files } = e.target;

    if (e.target.type === "file") {
      setEditFormData((prev) => ({
        ...prev,
        [name]: files && files.length > 0 ? files[0] : null,
      }));
      return;
    }

    setEditFormData((prev) => {
      const next = {
        ...prev,
        [name]: name === "mobile_no" ? normalizeMobileNo(value) : value || "",
      };

      if (name === "member_type" && value !== "e") {
        next.group = "";
        next.plantation = "";
        next.region = "";
        next.estate = "";
      }

      const nextJobRole = name === "job_role" ? value : next.job_role;
      const nextPartTimeDriver =
        Number(name === "part_time_driver" ? value : next.part_time_driver) ===
        1;
      if (name === "estate" && value) {
        const selectedEstate = estates.find(
          (item) => item.id === parseInt(value),
        );
        if (selectedEstate) {
          if (selectedEstate.group) next.group = String(selectedEstate.group);
          if (selectedEstate.plantation)
            next.plantation = String(selectedEstate.plantation);
          if (selectedEstate.region)
            next.region = String(selectedEstate.region);
        }
      } else if (name === "region" && value) {
        const selectedRegion = regions.find(
          (item) => item.id === parseInt(value),
        );
        if (selectedRegion) {
          if (selectedRegion.group) next.group = String(selectedRegion.group);
          if (selectedRegion.plantation)
            next.plantation = String(selectedRegion.plantation);
        }
        next.estate = "";
      } else if (name === "plantation" && value) {
        const selectedPlantation = plantations.find(
          (item) => item.id === parseInt(value),
        );
        if (selectedPlantation?.group) {
          next.group = String(selectedPlantation.group);
        }
        next.region = "";
        next.estate = "";
      } else if (name === "group") {
        next.plantation = "";
        next.region = "";
        next.estate = "";
      }

      return next;
    });
  };

  const handleClearEmployeeLink = async () => {
    setEditFormData((prev) => ({ ...prev, employeeId: "" }));
    setEditEmployeeSearchTerm("");

    if (!selectedUserId) return;

    try {
      await updateUser({ id: selectedUserId, employeeId: null }).unwrap();
      setEditMessage({
        type: "success",
        text: "Employee link cleared successfully.",
      });
      refetchUsers();
    } catch (error) {
      setEditMessage({
        type: "error",
        text:
          error?.data?.message ||
          error?.message ||
          "Failed to clear employee link.",
      });
    }
  };

  const buildUpdatePayload = () => {
    const { confirmPassword, image, ...base } = editFormData;
    const normalizedEmployeeId =
      base.employeeId === "" || base.employeeId == null
        ? null
        : Number(base.employeeId);
    const payload = {
      id: selectedUserId,
      ...base,
      employeeId: Number.isFinite(normalizedEmployeeId)
        ? normalizedEmployeeId
        : null,
    };

    if (!payload.password) delete payload.password;
    if (payload.member_type !== "e") {
      payload.group = null;
      payload.plantation = null;
      payload.region = null;
      payload.estate = null;
    }
    if (image instanceof File) {
      const formDataToSend = new FormData();
      Object.entries(payload).forEach(([key, val]) => {
        if (val !== undefined && val !== "") {
          formDataToSend.append(key, val == null ? "" : val);
        }
      });
      formDataToSend.append("image", image);
      return formDataToSend;
    }

    return payload;
  };

  const submitUserUpdate = async () => {
    try {
      const result = await updateUser(buildUpdatePayload()).unwrap();
      setEditMessage({
        type: "success",
        text: result?.message || "User updated successfully.",
      });
      setShowEditPopup(false);
      setShowUpdatePopup(false);
      refetchUsers();
      if (isMgmtProfile) {
        closeMgmtUserProfile();
      }
    } catch (error) {
      setEditMessage({
        type: "error",
        text:
          error?.data?.message || error?.message || "Failed to update user.",
      });
      setShowUpdatePopup(false);
    }
  };

  const handleUpdateUserSubmit = async (e) => {
    e.preventDefault();
    setEditMessage({ type: "", text: "" });

    if (!selectedUserId) {
      setEditMessage({
        type: "error",
        text: "Please select a user to update.",
      });
      return;
    }
    if (!editFormData.name || !editFormData.nic || !editFormData.mobile_no) {
      setEditMessage({
        type: "error",
        text: "Name, NIC and mobile number are required.",
      });
      return;
    }
    if (editFormData.mobile_no.length !== 9) {
      setEditMessage({
        type: "error",
        text: "Mobile number must be 9 digits without leading 0 (e.g., 771234567).",
      });
      return;
    }
    if (
      editFormData.password &&
      editFormData.password !== editFormData.confirmPassword
    ) {
      setEditMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setShowUpdatePopup(true);
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;

    // Handle file inputs
    if (e.target.type === "file") {
      setFormData((prev) => ({
        ...prev,
        [name]: files && files.length > 0 ? files[0] : null,
      }));
      return;
    }

    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: name === "mobile_no" ? normalizeMobileNo(value) : value || "",
      };
      if (
        embeddedTransportDriver &&
        name === "part_time_driver" &&
        Number(value || 0) !== 1
      ) {
        newData.job_role = DRIVER_JOB_ROLE_CODE;
      }
      const nextJobRole = name === "job_role" ? value : newData.job_role;
      const nextPartTimeDriver =
        Number(
          name === "part_time_driver" ? value : newData.part_time_driver,
        ) === 1;
      const roleMeta = roleMetaByCode.get(String(nextJobRole || "").trim());
      if (roleMeta) {
        newData.member_type = roleMeta.memberTypeCode || newData.member_type;
        newData.user_level = roleMeta.userLevelCode || newData.user_level;
      }
      if (newData.member_type !== "e") {
        newData.group = "";
        newData.plantation = "";
        newData.region = "";
        newData.estate = "";
      }
      if (!isDriverLikeJobRoleForForms(nextJobRole, nextPartTimeDriver)) {
        newData.driver_license_no = "";
        newData.driver_license_front_image = null;
        newData.driver_license_back_image = null;
      }

      // Handle cascading dropdowns for external user fields - AUTO-POPULATE PARENT FIELDS
      if (name === "estate" && value) {
        // When estate is selected, auto-populate group, plantation, and region
        const selectedEstate = estates.find((e) => e.id === parseInt(value));
        if (selectedEstate) {
          if (selectedEstate.group)
            newData.group = String(selectedEstate.group);
          if (selectedEstate.plantation)
            newData.plantation = String(selectedEstate.plantation);
          if (selectedEstate.region)
            newData.region = String(selectedEstate.region);
        }
      } else if (name === "region" && value) {
        // When region is selected, auto-populate group and plantation
        const selectedRegion = regions.find((r) => r.id === parseInt(value));
        if (selectedRegion) {
          if (selectedRegion.group)
            newData.group = String(selectedRegion.group);
          if (selectedRegion.plantation)
            newData.plantation = String(selectedRegion.plantation);
        }
        // Reset estate when region changes
        newData.estate = "";
      } else if (name === "plantation" && value) {
        // When plantation is selected, auto-populate group
        const selectedPlantation = plantations.find(
          (p) => p.id === parseInt(value),
        );
        if (selectedPlantation && selectedPlantation.group) {
          newData.group = String(selectedPlantation.group);
        }
        // Reset dependent fields when plantation changes
        newData.region = "";
        newData.estate = "";
      } else if (name === "group") {
        // Reset dependent fields when group changes
        newData.plantation = "";
        newData.region = "";
        newData.estate = "";
      }

      return newData;
    });
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      image: null,
    }));
  };

  const handlePickRegisterEmployee = (employee) => {
    setSelectedEmployee(employee);
    setEmployeeSearchTerm(formatEmployeeOptionLabel(employee));
    setShowEmployeeDropdown(false);
    const jobRoleCode = employee.employeeJobRole || "";
    const userLevelCode = employee.jobRoleLayer || "g";
    setFormData((prev) => ({
      ...prev,
      name: employee.employeeName || employee.preferredName || "",
      email: employee.companyEmailAddress || employee.emailAddress || "",
      nic: employee.nic || "",
      mobile_no: normalizeMobileNo(employee.mobileNumber || ""),
      employeeId: employee.id,
      job_role: embeddedTransportDriver
        ? coerceEmbeddedTransportJobRole(jobRoleCode, prev.part_time_driver)
        : jobRoleCode,
      user_level: userLevelCode,
      member_type: employee.employeeType || "i",
    }));
    setSubmitMessage({
      type: "success",
      text: "Employee selected. Data has been auto-filled.",
    });
  };

  const employeeInputRef = useRef(null);
  const [employeeInputRect, setEmployeeInputRect] = useState(null);

  useEffect(() => {
    if (!showEmployeeDropdown || !employeeInputRef.current) return;
    const rect = employeeInputRef.current.getBoundingClientRect();
    setEmployeeInputRect(rect);

    const handleScrollResize = () => {
      const r = employeeInputRef.current?.getBoundingClientRect();
      if (r) setEmployeeInputRect(r);
    };
    window.addEventListener("scroll", handleScrollResize, true);
    window.addEventListener("resize", handleScrollResize);
    return () => {
      window.removeEventListener("scroll", handleScrollResize, true);
      window.removeEventListener("resize", handleScrollResize);
    };
  }, [showEmployeeDropdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitMessage({ type: "", text: "" });
    setIsSubmitting(true);

    // Validation
    if (!formData.name || !formData.nic || !formData.mobile_no) {
      setSubmitMessage({
        type: "error",
        text: "Name, NIC, and Mobile Number are required",
      });
      setIsSubmitting(false);
      return;
    }
    if (formData.mobile_no.length !== 9) {
      setSubmitMessage({
        type: "error",
        text: "Mobile number must be 9 digits without leading 0 (e.g., 771234567).",
      });
      setIsSubmitting(false);
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      setSubmitMessage({ type: "error", text: "Passwords do not match" });
      setIsSubmitting(false);
      return;
    }

    if (!formData.job_role) {
      setSubmitMessage({ type: "error", text: "Please select a Job Role." });
      setIsSubmitting(false);
      return;
    }
    if (!effectiveUserType) {
      setSubmitMessage({
        type: "error",
        text: "Selected Job Role has no User Type mapping in JD Management.",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Prepare submission data (exclude confirmPassword)
      const { confirmPassword, image, ...submissionData } = formData;
      if (embeddedTransportDriver) {
        submissionData.job_role = coerceEmbeddedTransportJobRole(
          submissionData.job_role,
          submissionData.part_time_driver,
        );
      }

      // Only include external user fields if user is external
      if (effectiveUserType !== "e") {
        delete submissionData.group;
        delete submissionData.plantation;
        delete submissionData.region;
        delete submissionData.estate;
      } else {
        // Convert empty strings to null for external fields
        if (!submissionData.group) submissionData.group = null;
        if (!submissionData.plantation) submissionData.plantation = null;
        if (!submissionData.region) submissionData.region = null;
        if (!submissionData.estate) submissionData.estate = null;
      }

      if (
        !isDriverLikeJobRoleForForms(
          submissionData.job_role,
          Number(submissionData.part_time_driver || 0) === 1,
        )
      ) {
        delete submissionData.driver_license_no;
        delete submissionData.driver_license_front_image;
        delete submissionData.driver_license_back_image;
      }
      delete submissionData.card_id;

      // Use FormData when any file is attached
      let dataToSend;
      const hasFileUpload =
        image ||
        submissionData.driver_license_front_image instanceof File ||
        submissionData.driver_license_back_image instanceof File;
      if (hasFileUpload) {
        const formDataToSend = new FormData();

        // Append all form fields
        Object.keys(submissionData).forEach((key) => {
          const value = submissionData[key];
          if (value !== null && value !== undefined && value !== "") {
            if (value instanceof File) {
              formDataToSend.append(key, value);
            } else if (typeof value === "object") {
              formDataToSend.append(key, JSON.stringify(value));
            } else {
              formDataToSend.append(key, value);
            }
          }
        });

        if (image instanceof File) {
          formDataToSend.append("image", image);
        }

        dataToSend = formDataToSend;
      } else {
        dataToSend = submissionData;
      }

      const result = await createUser(dataToSend).unwrap();

      if (result.status) {
        setSubmitMessage({
          type: "success",
          text: result.message || "User registered successfully!",
        });

        // Reset form
        setFormData({
          name: "",
          email: "",
          nic: "",
          mobile_no: "",
          password: "",
          confirmPassword: "",
          member_type: "",
          job_role: embeddedTransportDriver ? DRIVER_JOB_ROLE_CODE : "",
          part_time_driver: "0",
          user_level: "g",
          employeeId: null,
          sect_command: "0",
          activated: "1",
          image: null,
          group: "",
          plantation: "",
          region: "",
          estate: "",
          driver_license_no: "",
          driver_license_front_image: null,
          driver_license_back_image: null,
        });
        if (isMgmtAdd) {
          onUserRegisteredSuccess?.();
        } else if (!embeddedTransportDriver) {
          setUserType("");
        }
        setSelectedEmployee(null);
        setEmployeeSearchTerm("");
        if (embeddedTransportDriver) {
          onEmbeddedRegisterSuccess?.();
        }
      }
    } catch (error) {
      setSubmitMessage({
        type: "error",
        text:
          error?.data?.message || error?.message || "Failed to register user",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadFilteredUsersExcel = () => {
    if (!filteredUsers.length) {
      setSubmitMessage({
        type: "error",
        text: "No users available for export.",
      });
      return;
    }

    const excelData = filteredUsers.map((user) => ({
      ID: user.id || "",
      Name: user.name || "",
      NIC: user.nic || "",
      Mobile: user.mobile_no || "",
      Email: user.email || "",
      Type:
        memberTypeLabelMap[String(user.member_type || "").trim()] ||
        user.member_type ||
        "",
      Role:
        jobRoleLabelMap[String(user.job_role || "").trim()] ||
        user.job_role ||
        "",
      Status: String(user.activated) === "1" ? "Active" : "Inactive",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    const now = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Users_Filtered_${now}.xlsx`);
  };

  const normalizedTypeFilter = String(userTypeFilter || "")
    .trim()
    .toLowerCase();
  const showExternalColumns =
    normalizedTypeFilter === "e" || normalizedTypeFilter === "external";
  const showInternalColumns =
    normalizedTypeFilter === "i" || normalizedTypeFilter === "internal";
  const usersTableColSpan =
    (isMgmtList ? 10 : 11) +
    (showExternalColumns ? 2 : 0) +
    (showInternalColumns ? 1 : 0);
  const profileUser = allUsers.find(
    (u) => String(u.id) === String(mgmtProfileUserId || selectedUserId || ""),
  );
  const profileRoleLabel =
    jobRoleLabelMap[String(profileUser?.job_role || "").trim()] ||
    profileUser?.job_role ||
    "";
  const profileTypeLabel =
    memberTypeLabelMap[String(profileUser?.member_type || "").trim()] ||
    profileUser?.member_type ||
    "";

  const registerFormContent =
    embeddedTransportDriver || activeTab === "register" || isMgmtAdd ? (
      <div className="registration-form-content">
        <form onSubmit={handleSubmit}>
          {/* User Type Selection */}
          <div className="form-section">
            <h2 className="section-title">User Type</h2>
            <div className="form-row">
              <div className="form-group">
                <label>
                  Job Role: <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  name="job_role"
                  value={formData.job_role}
                  onChange={handleInputChange}
                  required
                  disabled={
                    embeddedTransportDriver &&
                    Number(formData.part_time_driver || 0) !== 1
                  }
                  style={
                    embeddedTransportDriver &&
                    Number(formData.part_time_driver || 0) !== 1
                      ? { backgroundColor: "#f5f5f5", cursor: "not-allowed" }
                      : undefined
                  }
                >
                  <option value="">-- Select Job Role --</option>
                  {activeUserJobRoles.map((role) => (
                    <option key={role.id} value={role.jdCode || role.id}>
                      {role.designation}
                      {role.memberTypeCode
                        ? ` (${String(role.memberTypeCode).toLowerCase()})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>User Type:</label>
                <input
                  type="text"
                  value={
                    memberTypeLabelMap[
                      String(formData.member_type || "").trim()
                    ] ||
                    formData.member_type ||
                    ""
                  }
                  readOnly
                  placeholder="Auto from Job Role"
                  style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                />
              </div>
              <div className="form-group">
                <label>User Level:</label>
                <input
                  type="text"
                  value={
                    userLevels.find(
                      (lvl) =>
                        String(lvl.levelCode || lvl.id) ===
                        String(formData.user_level || ""),
                    )?.userLevel ||
                    formData.user_level ||
                    ""
                  }
                  readOnly
                  placeholder="Auto from Job Role"
                  style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full-width">
                <small
                  className="field-error-emp-reg"
                  style={{ color: "#64748b", display: "block", marginTop: 6 }}
                >
                  User Type and User Level are auto-selected from JD Management
                  mapping.
                </small>
              </div>
            </div>

            {/* Employee Search (only for Internal users) */}
            {effectiveUserType === "i" && (
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Search Employee (Name / NIC / Employee Number):</label>
                  <div className="employee-estate-like-wrapper-user-reg-ict">
                    <input
                      id="employee-search-input-user-reg-ict"
                      ref={employeeInputRef}
                      className="employee-estate-like-input-user-reg-ict"
                      type="text"
                      value={employeeSearchTerm}
                      onChange={(e) => {
                        setEmployeeSearchTerm(e.target.value);
                        setShowEmployeeDropdown(true);
                        setSelectedEmployee(null);
                        setFormData((prev) => ({ ...prev, employeeId: null }));
                      }}
                      onFocus={() => setShowEmployeeDropdown(true)}
                      onBlur={() => {
                        window.setTimeout(
                          () => setShowEmployeeDropdown(false),
                          120,
                        );
                      }}
                      placeholder="Enter Name, NIC, or Employee Number (e.g., Kamal / 901234567V / EMP001)"
                    />
                    <div
                      className="employee-estate-like-indicator-user-reg-ict"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowEmployeeDropdown((prev) => !prev)}
                    >
                      ▼
                    </div>
                    {console.log(
                      "EMP_DROPDOWN",
                      showEmployeeDropdown,
                      !!employeeInputRef.current,
                    )}
                    <SuggestionPortal
                      open={showEmployeeDropdown}
                      anchorRef={employeeInputRef}
                      className="employee-estate-like-suggestions-portal-user-reg-ict"
                    >
                      <div className="employee-estate-like-suggestions-user-reg-ict">
                        {filteredRegisterEmployeeOptions
                          .slice(0, 50)
                          .map((employee) => (
                            <div
                              key={employee.id}
                              className="employee-estate-like-item-user-reg-ict"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() =>
                                handlePickRegisterEmployee(employee)
                              }
                            >
                              <div className="employee-estate-like-title-user-reg-ict">
                                {employee.employeeName ||
                                  employee.preferredName ||
                                  employee.name ||
                                  "Unnamed"}
                              </div>
                              <div className="employee-estate-like-meta-user-reg-ict">
                                EMP: {employee.empNo || "-"} | ID: {employee.id}
                              </div>
                            </div>
                          ))}
                        {filteredRegisterEmployeeOptions.length === 0 ? (
                          <div className="employee-estate-like-empty-user-reg-ict">
                            Not available
                          </div>
                        ) : null}
                      </div>
                    </SuggestionPortal>
                  </div>
                  {selectedEmployee && (
                    <div className="employee-info-box">
                      <p>
                        <strong>Employee Found:</strong>{" "}
                        {selectedEmployee.employeeName} (
                        {selectedEmployee.empNo})
                      </p>
                      <p>
                        Data has been auto-filled below. Please complete
                        remaining fields.
                      </p>
                    </div>
                  )}
                  {loadingEmployeeOptions ? (
                    <div className="employee-suggestion-info-user-reg-ict">
                      Loading employees...
                    </div>
                  ) : null}
                  {employeeOptionsError ? (
                    <div className="employee-suggestion-error-user-reg-ict">
                      Failed to load employee list.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* User Details */}
          <div className="form-section">
            <h2 className="section-title">User Details</h2>

            <div className="form-row">
              <div className="form-group">
                <label>
                  Full Name: <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter full name"
                />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email address"
                  className={
                    registerEmailInvalid ? "invalid-field-emp-reg" : ""
                  }
                />
                {registerEmailInvalid && (
                  <span className="field-error-emp-reg">
                    Invalid email format.
                  </span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>
                  NIC: <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  name="nic"
                  value={formData.nic}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter NIC number"
                  disabled={!!selectedEmployee}
                  style={selectedEmployee ? { backgroundColor: "#f5f5f5" } : {}}
                />
              </div>
              <div className="form-group">
                <label>
                  Mobile Number: <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  name="mobile_no"
                  value={formData.mobile_no}
                  onChange={handleInputChange}
                  maxLength={9}
                  inputMode="numeric"
                  required
                  placeholder="Example: 771234567"
                  disabled={!!selectedEmployee}
                  style={selectedEmployee ? { backgroundColor: "#f5f5f5" } : {}}
                  className={
                    registerMobileInvalid ? "invalid-field-emp-reg" : ""
                  }
                />
                {registerMobileInvalid && (
                  <span className="field-error-emp-reg">
                    Mobile Number must be 9 digits and cannot start with 0.
                  </span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <div className="password-label-row">
                  <label>Password:</label>
                  <button
                    type="button"
                    className="password-inline-action"
                    onClick={handleGenerateRegisterPassword}
                  >
                    Auto generate
                  </button>
                </div>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <input
                    type={showRegisterPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password (optional)"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="password-visibility-btn"
                    onClick={() => setShowRegisterPassword((prev) => !prev)}
                    title={
                      showRegisterPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showRegisterPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Confirm Password:</label>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <input
                    type={showRegisterConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm password"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="password-visibility-btn"
                    onClick={() =>
                      setShowRegisterConfirmPassword((prev) => !prev)
                    }
                    title={
                      showRegisterConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showRegisterConfirmPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group full-width">
                <label>Profile photo (optional)</label>
                <p
                  className="user-profile-header-hint"
                  style={{ marginTop: 4, marginBottom: 10 }}
                >
                  Same upload style as vehicle photos in fleet management. JPG
                  or PNG recommended.
                </p>
                <div className="user-register-photo-row">
                  <ProfileImageUploadCard
                    label="Profile photo"
                    file={
                      formData.image instanceof File ? formData.image : null
                    }
                    onFileSelect={(picked) => {
                      setFormData((prev) => ({ ...prev, image: picked }));
                    }}
                    onClear={handleRemoveImage}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="form-section">
            <h2 className="section-title">Job Details</h2>

            <div className="form-row">
              <div className="form-group full-width">
                <small style={{ color: "#6b7280" }}>
                  Job Role, User Type, and User Level are controlled from the
                  User Type section above.
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Status:</label>
                <select
                  name="activated"
                  value={formData.activated}
                  onChange={handleInputChange}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label>Part Time Driver:</label>
                <select
                  name="part_time_driver"
                  value={formData.part_time_driver}
                  onChange={handleInputChange}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Driver Information (internal/external driver role or part-time driver) */}
          {(isDriverLikeJobRoleForForms(
            formData.job_role,
            Number(formData.part_time_driver) === 1,
          ) ||
            embeddedTransportDriver) && (
            <div className="form-section">
              <h2 className="section-title">Driver Information</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>Driver License No:</label>
                  <input
                    type="text"
                    name="driver_license_no"
                    value={formData.driver_license_no}
                    onChange={handleInputChange}
                    placeholder="Enter driver license number"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Driver License Front Image:</label>
                  <input
                    type="file"
                    name="driver_license_front_image"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setFormData((prev) => ({
                        ...prev,
                        driver_license_front_image: file || null,
                      }));
                    }}
                  />
                  {formData.driver_license_front_image && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        color: "#666",
                      }}
                    >
                      Selected: {formData.driver_license_front_image.name}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Driver License Back Image:</label>
                  <input
                    type="file"
                    name="driver_license_back_image"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      setFormData((prev) => ({
                        ...prev,
                        driver_license_back_image: file || null,
                      }));
                    }}
                  />
                  {formData.driver_license_back_image && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        color: "#666",
                      }}
                    >
                      Selected: {formData.driver_license_back_image.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* External User Fields (Group, Plantation, Region, Estate) */}
          {effectiveUserType === "e" && (
            <div className="form-section">
              <h2 className="section-title">Plantation Details</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>Group:</label>
                  <select
                    name="group"
                    value={formData.group}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Select Group --</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {getGroupLabel(group)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Plantation:</label>
                  <select
                    name="plantation"
                    value={formData.plantation}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Select Plantation --</option>
                    {plantations
                      .filter(
                        (p) =>
                          !formData.group ||
                          p.group === parseInt(formData.group),
                      )
                      .map((plantation) => (
                        <option key={plantation.id} value={plantation.id}>
                          {plantation.plantation}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Region:</label>
                  <select
                    name="region"
                    value={formData.region}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Select Region --</option>
                    {regions
                      .filter((r) => {
                        if (
                          formData.group &&
                          r.group !== parseInt(formData.group)
                        )
                          return false;
                        if (
                          formData.plantation &&
                          r.plantation !== parseInt(formData.plantation)
                        )
                          return false;
                        return true;
                      })
                      .map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.region}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Estate:</label>
                  <select
                    name="estate"
                    value={formData.estate}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Select Estate --</option>
                    {estates
                      .filter((e) => {
                        // Filter by group if selected
                        if (
                          formData.group &&
                          e.group !== parseInt(formData.group)
                        )
                          return false;
                        // Filter by plantation if selected
                        if (
                          formData.plantation &&
                          e.plantation !== parseInt(formData.plantation)
                        )
                          return false;
                        // Filter by region if selected
                        if (
                          formData.region &&
                          e.region !== parseInt(formData.region)
                        )
                          return false;
                        return true;
                      })
                      .map((estate) => (
                        <option key={estate.id} value={estate.id}>
                          {estate.estate}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="form-buttons">
            {registerInModal ? (
              <button
                type="button"
                className="btn-search"
                onClick={() => onCancelAdd?.()}
                disabled={isSubmitting || isCreating}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting || isCreating}
              className="btn-submit"
            >
              {isSubmitting || isCreating ? "Registering..." : "Register User"}
            </button>
          </div>

          {/* Message Display */}
          {submitMessage.text && (
            <div className={`message ${submitMessage.type}`}>
              {submitMessage.text}
            </div>
          )}
        </form>
      </div>
    ) : null;

  if (isMgmtAdd && registerInModal) {
    return (
      <div
        className="user-register-modal-form ictumx-register-modal-form"
        ref={rootRef}
      >
        {registerFormContent}
      </div>
    );
  }

  if (isMgmtAdd) {
    return (
      <div
        className="user-registration-container user-registration-container--mgmt-add"
        ref={rootRef}
      >
        {registerFormContent}
      </div>
    );
  }

  return (
    <div
      className={
        isMgmtProfile
          ? "user-profile-wrap user-profile-wrap--mgmt-scroll user-registration-profile-flow ictum-scope"
          : `user-registration-container${embeddedTransportDriver ? " user-registration-embedded-transport-hr" : ""}${isMgmtList ? " user-registration-container--mgmt-list" : ""}${embeddedInUserManagement ? " ictum-scope" : ""}`
      }
      ref={rootRef}
    >
      {isMgmtProfile && (
        <>
          <div className="user-profile-header ictumx-profile-header">
            <div className="user-profile-header-main ictumx-profile-main">
              <h2 className="user-profile-title">
                {profileUser?.name || "User profile"}
              </h2>
              <p className="user-profile-subtitle">
                User ID {mgmtProfileUserId}
                {profileRoleLabel ? ` · ${profileRoleLabel}` : ""}
                {profileTypeLabel ? ` · ${profileTypeLabel}` : ""}
              </p>
              <div className="user-profile-badges">
                <span
                  className={`user-profile-badge${
                    String(profileUser?.activated) !== "1"
                      ? " user-profile-badge--inactive"
                      : ""
                  }`}
                >
                  {String(profileUser?.activated) === "1"
                    ? "Active"
                    : "Inactive"}
                </span>
                {Number(profileUser?.part_time_driver || 0) === 1 ? (
                  <span className="user-profile-badge">Part-time driver</span>
                ) : null}
              </div>
            </div>
            <div className="user-profile-hero-photo">
              {selectedUserImageUrl || profileUser?.image ? (
                <img src={selectedUserImageUrl || profileUser?.image} alt="" />
              ) : (
                <div className="user-profile-hero-placeholder">No photo</div>
              )}
            </div>
          </div>
          {!selectedUserId || loadingUsers ? (
            <p className="user-profile-subtitle">Loading user profile…</p>
          ) : null}
        </>
      )}
      {!isMgmtProfile && showLegacyTabs && (
        <div className="users-top-tabs">
          <button
            type="button"
            className={`users-top-tab ${activeTab === "register" ? "active" : ""}`}
            onClick={() => setActiveTab("register")}
          >
            Registration
          </button>
          <button
            type="button"
            className={`users-top-tab ${activeTab === "manage" ? "active" : ""}`}
            onClick={() => setActiveTab("manage")}
          >
            View / Update Users
          </button>
        </div>
      )}

      {!isMgmtProfile && !isMgmtList && registerFormContent}

      {!isMgmtProfile &&
        (isMgmtList ||
          (!embeddedTransportDriver && activeTab === "manage")) && (
          <div
            className={`registration-form-content user-management-content${isMgmtList ? " users-mgmt-list-shell" : ""}`}
          >
            {!isMgmtList && (
              <div className="users-manage-header-row">
                <h2 className="section-title">View / Update Users</h2>
              </div>
            )}
            <div
              className={
                isMgmtList
                  ? "users-mgmt-toolbar"
                  : "users-manage-right-controls"
              }
              style={isMgmtList ? undefined : { marginBottom: 12 }}
            >
              <div className="users-filter-group">
                <label>Type</label>
                <select
                  value={userTypeFilter}
                  onChange={(e) => setUserTypeFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="i">Internal</option>
                  <option value="e">External</option>
                </select>
              </div>
              <div className="users-filter-group">
                <label>Role</label>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                >
                  <option value="">All</option>
                  {userJobRoles
                    .filter((role) => role.status === 1)
                    .map((role) => (
                      <option key={role.id} value={role.jdCode || role.id}>
                        {role.designation}
                      </option>
                    ))}
                </select>
              </div>
              <div
                className={`form-group full-width${isMgmtList ? " users-search-wrap" : ""}`}
              >
                <label>Search</label>
                <input
                  type="text"
                  className={isMgmtList ? "users-search-input" : undefined}
                  placeholder="Search by name, NIC, mobile, email or role"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-search users-download-excel-btn"
                onClick={handleDownloadFilteredUsersExcel}
              >
                Download Excel
              </button>
            </div>

            <div
              className={`users-table-wrapper${isMgmtList ? " users-mgmt-table-scroll" : ""}`}
            >
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Employee ID</th>
                    <th>Profile</th>
                    <th>Name</th>
                    <th>NIC</th>
                    <th>Mobile</th>
                    <th>Type</th>
                    {showInternalColumns && <th>Wing</th>}
                    {showExternalColumns && <th>Plantation</th>}
                    {showExternalColumns && <th>Estate</th>}
                    <th>Role</th>
                    <th>Part Time Driver</th>
                    <th>Status</th>
                    {!isMgmtList && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={usersTableColSpan}>Loading users...</td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={usersTableColSpan}>No users found.</td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={[
                          selectedUserId === user.id ? "selected-row" : "",
                          isMgmtList ? "users-table-row-clickable" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={
                          isMgmtList
                            ? () => openMgmtUserProfile(user)
                            : undefined
                        }
                        onKeyDown={
                          isMgmtList
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openMgmtUserProfile(user);
                                }
                              }
                            : undefined
                        }
                        tabIndex={isMgmtList ? 0 : undefined}
                        role={isMgmtList ? "button" : undefined}
                      >
                        <td>{user.id}</td>
                        <td>{user.employeeId ?? "-"}</td>
                        <td>
                          {user?.image ? (
                            <img
                              src={user.image}
                              alt={user.name || "User"}
                              className="user-avatar-thumb"
                            />
                          ) : (
                            <div className="user-avatar-placeholder">N/A</div>
                          )}
                        </td>
                        <td>{user.name || "-"}</td>
                        <td>{user.nic || "-"}</td>
                        <td>{user.mobile_no || "-"}</td>
                        <td>
                          {memberTypeLabelMap[
                            String(user.member_type || "").trim()
                          ] ||
                            user.member_type ||
                            "-"}
                        </td>
                        {showInternalColumns && (
                          <td>
                            {wingLabelMap[
                              String(user.sect_command || user.wing || "")
                            ] ||
                              user.wing_name ||
                              user.sect_command ||
                              "-"}
                          </td>
                        )}
                        {showExternalColumns && (
                          <td>
                            {plantationLabelMap[
                              String(user.plantation || "")
                            ] ||
                              user.plantation ||
                              "-"}
                          </td>
                        )}
                        {showExternalColumns && (
                          <td>
                            {estateLabelMap[String(user.estate || "")] ||
                              user.estate ||
                              "-"}
                          </td>
                        )}
                        <td>
                          {jobRoleLabelMap[
                            String(user.job_role || "").trim()
                          ] ||
                            user.job_role ||
                            "-"}
                        </td>
                        <td>
                          {Number(user.part_time_driver || 0) === 1
                            ? "Yes"
                            : "No"}
                        </td>
                        <td>
                          {String(user.activated) === "1"
                            ? "Active"
                            : "Inactive"}
                        </td>
                        {!isMgmtList && (
                          <td>
                            <button
                              type="button"
                              className="btn-search"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditUser(user);
                              }}
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {showEditPopup && selectedUserId && (
        <div
          className={
            isMgmtProfile
              ? "user-profile-edit-host user-profile-edit-host--mgmt"
              : "update-popup-overlay edit-user-popup-overlay"
          }
        >
          <div
            className={
              isMgmtProfile
                ? "update-popup-card edit-user-popup-card user-profile-edit-card"
                : "update-popup-card edit-user-popup-card"
            }
          >
            {!isMgmtProfile ? (
              <div className="edit-user-popup-header">
                <h3 className="section-title">Edit User #{selectedUserId}</h3>
                <button
                  type="button"
                  className="btn-search"
                  onClick={() => {
                    setShowEditPopup(false);
                    setShowUpdatePopup(false);
                    setEditMessage({ type: "", text: "" });
                    setSelectedUserImageUrl("");
                  }}
                  disabled={isUpdating}
                >
                  Close
                </button>
              </div>
            ) : (
              <p className="user-profile-header-hint">
                Update account details below. Leave password blank to keep the
                current password.
              </p>
            )}
            <form
              onSubmit={handleUpdateUserSubmit}
              className={`edit-user-form${isMgmtProfile ? " edit-user-form--mgmt-profile" : ""}`}
            >
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    name="email"
                    type="email"
                    value={editFormData.email}
                    onChange={handleEditInputChange}
                    className={editEmailInvalid ? "invalid-field-emp-reg" : ""}
                  />
                  {editEmailInvalid && (
                    <span className="field-error-emp-reg">
                      Invalid email format.
                    </span>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>NIC</label>
                  <input
                    name="nic"
                    value={editFormData.nic}
                    onChange={handleEditInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input
                    name="mobile_no"
                    value={editFormData.mobile_no}
                    onChange={handleEditInputChange}
                    maxLength={9}
                    inputMode="numeric"
                    required
                    placeholder="Example: 771234567"
                    className={editMobileInvalid ? "invalid-field-emp-reg" : ""}
                  />
                  {editMobileInvalid && (
                    <span className="field-error-emp-reg">
                      Mobile Number must be 9 digits and cannot start with 0.
                    </span>
                  )}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <div className="password-label-row">
                    <label>Password (optional)</label>
                    <button
                      type="button"
                      className="password-inline-action"
                      onClick={handleGenerateEditPassword}
                    >
                      Auto generate
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      name="password"
                      type={showEditPassword ? "text" : "password"}
                      value={editFormData.password}
                      onChange={handleEditInputChange}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="password-visibility-btn"
                      onClick={() => setShowEditPassword((prev) => !prev)}
                      title={
                        showEditPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showEditPassword ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      name="confirmPassword"
                      type={showEditConfirmPassword ? "text" : "password"}
                      value={editFormData.confirmPassword}
                      onChange={handleEditInputChange}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="password-visibility-btn"
                      onClick={() =>
                        setShowEditConfirmPassword((prev) => !prev)
                      }
                      title={
                        showEditConfirmPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showEditConfirmPassword ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group employee-link-field-user-reg-ict">
                  <label>Employee (link)</label>
                  <div className="employee-link-input-row-user-reg-ict">
                    <div style={{ position: "relative", flex: 1 }}>
                      <input
                        type="text"
                        value={editEmployeeSearchTerm}
                        placeholder="Search employee by name, EMP NO, ID..."
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditEmployeeSearchTerm(v);
                          setShowEditEmployeeDropdown(true);
                          if (!v.trim()) {
                            setEditFormData((prev) => ({
                              ...prev,
                              employeeId: "",
                            }));
                          }
                        }}
                        onFocus={() => setShowEditEmployeeDropdown(true)}
                        onBlur={() =>
                          setTimeout(
                            () => setShowEditEmployeeDropdown(false),
                            150,
                          )
                        }
                      />
                      {showEditEmployeeDropdown && (
                        <div style={{}}>
                          {availableEmployeeOptionsForEdit
                            .filter((employee) => {
                              const q = editEmployeeSearchTerm
                                .trim()
                                .toLowerCase();
                              if (!q) return true;
                              const label =
                                formatEmployeeOptionLabel(
                                  employee,
                                ).toLowerCase();
                              return label.includes(q);
                            })
                            .slice(0, 50)
                            .map((employee) => (
                              <div
                                key={employee.id}
                                style={{
                                  padding: "8px 10px",
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f1f5f9",
                                  fontSize: "13px",
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setEditFormData((prev) => ({
                                    ...prev,
                                    employeeId: String(employee.id),
                                  }));
                                  setEditEmployeeSearchTerm(
                                    formatEmployeeOptionLabel(employee),
                                  );
                                  setShowEditEmployeeDropdown(false);
                                }}
                              >
                                {formatEmployeeOptionLabel(employee)}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-search employee-clear-btn-user-reg-ict"
                      onClick={handleClearEmployeeLink}
                    >
                      Clear Link
                    </button>
                  </div>
                  {loadingEmployeeOptions ? (
                    <div className="employee-suggestion-info-user-reg-ict">
                      Loading employees...
                    </div>
                  ) : null}
                  {employeeOptionsError ? (
                    <div className="employee-suggestion-error-user-reg-ict">
                      Failed to load employee list.
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>User Type</label>
                  <select
                    name="member_type"
                    value={editFormData.member_type}
                    onChange={handleEditInputChange}
                  >
                    <option value="">-- Select --</option>
                    {userMemberTypes.map((type) => (
                      <option key={type.id} value={type.typeCode}>
                        {type.memberType}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Job Role</label>
                  <select
                    name="job_role"
                    value={editFormData.job_role}
                    onChange={handleEditInputChange}
                  >
                    <option value="">-- Select --</option>
                    {userJobRoles
                      .filter((role) => role.status === 1)
                      .map((role) => (
                        <option key={role.id} value={role.jdCode || role.id}>
                          {role.designation}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>User Level</label>
                  <select
                    name="user_level"
                    value={editFormData.user_level}
                    onChange={handleEditInputChange}
                  >
                    <option value="g">Guest User</option>
                    {userLevels.map((level) => (
                      <option
                        key={level.id}
                        value={level.levelCode || level.id}
                      >
                        {level.userLevel}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="activated"
                    value={editFormData.activated}
                    onChange={handleEditInputChange}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Part Time Driver</label>
                  <select
                    name="part_time_driver"
                    value={editFormData.part_time_driver}
                    onChange={handleEditInputChange}
                  >
                    <option value="0">No</option>
                    <option value="1">Yes</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Profile photo (optional)</label>
                  <div className="user-register-photo-row">
                    <ProfileImageUploadCard
                      label="Profile photo"
                      file={
                        editFormData.image instanceof File
                          ? editFormData.image
                          : null
                      }
                      existingUrl={
                        editFormData.image instanceof File
                          ? null
                          : editImagePreviewUrl || selectedUserImageUrl || null
                      }
                      disabled={isUpdating}
                      onFileSelect={(picked) => {
                        setEditFormData((prev) => ({ ...prev, image: picked }));
                      }}
                      onClear={() => {
                        setEditFormData((prev) => ({ ...prev, image: null }));
                        setEditImagePreviewUrl("");
                      }}
                    />
                  </div>
                </div>
              </div>

              {editFormData.member_type === "e" && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Group</label>
                      <select
                        name="group"
                        value={editFormData.group}
                        onChange={handleEditInputChange}
                      >
                        <option value="">-- Select Group --</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {getGroupLabel(group)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Plantation</label>
                      <select
                        name="plantation"
                        value={editFormData.plantation}
                        onChange={handleEditInputChange}
                      >
                        <option value="">-- Select Plantation --</option>
                        {plantations
                          .filter(
                            (p) =>
                              !editFormData.group ||
                              p.group === parseInt(editFormData.group),
                          )
                          .map((plantation) => (
                            <option key={plantation.id} value={plantation.id}>
                              {plantation.plantation}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Region</label>
                      <select
                        name="region"
                        value={editFormData.region}
                        onChange={handleEditInputChange}
                      >
                        <option value="">-- Select Region --</option>
                        {regions
                          .filter((r) => {
                            if (
                              editFormData.group &&
                              r.group !== parseInt(editFormData.group)
                            )
                              return false;
                            if (
                              editFormData.plantation &&
                              r.plantation !== parseInt(editFormData.plantation)
                            )
                              return false;
                            return true;
                          })
                          .map((region) => (
                            <option key={region.id} value={region.id}>
                              {region.region}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Estate</label>
                      <select
                        name="estate"
                        value={editFormData.estate}
                        onChange={handleEditInputChange}
                      >
                        <option value="">-- Select Estate --</option>
                        {estates
                          .filter((estate) => {
                            if (
                              editFormData.group &&
                              estate.group !== parseInt(editFormData.group)
                            )
                              return false;
                            if (
                              editFormData.plantation &&
                              estate.plantation !==
                                parseInt(editFormData.plantation)
                            )
                              return false;
                            if (
                              editFormData.region &&
                              estate.region !== parseInt(editFormData.region)
                            )
                              return false;
                            return true;
                          })
                          .map((estate) => (
                            <option key={estate.id} value={estate.id}>
                              {estate.estate}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="form-buttons">
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={isUpdating}
                >
                  {isUpdating ? "Updating..." : "Update User"}
                </button>
              </div>

              {editMessage.text && (
                <div className={`message ${editMessage.type}`}>
                  {editMessage.text}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {showUpdatePopup && (
        <div className="update-popup-overlay">
          <div className="update-popup-card">
            <h3>Confirm Update</h3>
            <p>Are you sure you want to update this user?</p>
            <div className="update-popup-actions">
              <button
                type="button"
                className="btn-search"
                onClick={() => setShowUpdatePopup(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit"
                onClick={submitUserUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? "Updating..." : "Yes, Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
