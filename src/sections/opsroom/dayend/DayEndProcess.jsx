import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import '../../../styles/dayendprocess.css';
import { FaCalendarAlt, FaRegArrowAltCircleRight, FaArrowCircleDown, FaArrowCircleUp, FaCheck, FaTimes, FaMinus } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Bars } from 'react-loader-spinner';
import { useAppDispatch } from '../../../store/hooks';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useGetAllDjiImagesQuery } from '../../../api/services NodeJs/djiImagesApi';
import { getNodeBackendUrl } from '../../../api/services NodeJs/nodeBackendConfig';
import {
  dayEndProcessApi,
  useLazyGetCancelReasonsQuery,
  useCancelTaskMutation,
  useClearOpsCancelMutation,
  useResetPilotCancelMutation,
  useLazyGetDayOverviewQuery,
  useLazyGetDayEndPlanSummaryQuery,
  useLazyGetDayEndTasksByPlanAndFieldQuery,
  useSubmitDayEndDjiRecordMutation,
  useUpdateDayEndOpsApprovalMutation,
  useLazyGetDayEndFlagReasonsQuery,
  useLazyGetDayEndTaskFlagQuery,
  useSubmitDayEndTaskFlagMutation,
} from '../../../api/services NodeJs/dayEndProcessApi';
import { getResourceUrl } from '../../../utils/resourceUrls';
import { useGetMyPermissionsQuery } from '../../../api/services NodeJs/featurePermissionsApi';
import { FEATURE_CODES } from '../../../utils/featurePermissions';
import { isInternalDeveloper } from '../../../utils/authUtils';

const CustomDateInput = React.forwardRef(({ value, onClick }, ref) => (
  <div className="custom-date-input" ref={ref} onClick={onClick}>
    <input type="text" value={value} readOnly className="date-picker-input" />
    <FaCalendarAlt className="calendar-icon" />
  </div>
));

/** DJI field area below this ratio of pilot field area requires a partial (flag h) cancel reason. */
const PARTIAL_DJI_AREA_RATIO = 0.7;

const DayEndProcess = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const dispatch = useAppDispatch();
  const [missions, setMissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState(null);
  const [expandedDivisions, setExpandedDivisions] = useState([]);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [loadingMissionDetails, setLoadingMissionDetails] = useState(false);
  const [fieldTasks, setFieldTasks] = useState({});
  const [loadingFields, setLoadingFields] = useState({});
  const [expandedFields, setExpandedFields] = useState([]);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [currentField, setCurrentField] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskLoading, setTaskLoading] = useState(null); // Track which task is loading
  const userData = JSON.parse(localStorage.getItem('userData')) || {};
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

  const showDirOpsApprovalFeature = checkFeatureAccess(FEATURE_CODES.DAY_END_DIR_OPS_APPROVAL);

  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [djiData, setDjiData] = useState({
    dji_image_id: null, // Changed from dji_image file to dji_image_id
    dji_field_area: '',
    dji_spraying_area: '',
    dji_spraying_litres: '',
    dji_flying_duration: '',
    dji_no_of_flights: '',
  });

  // Get all DJI images for selected date (to show both linked and unlinked)
  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const { data: allDjiImagesData } = useGetAllDjiImagesQuery({ date: selectedDateStr });
  const allDjiImages = allDjiImagesData?.data || [];

  // Separate linked and unlinked images
  const unlinkedDjiImages = allDjiImages.filter(img => !img.linked_task || img.linked_task === 0);
  const linkedDjiImages = allDjiImages.filter(img => img.linked_task && img.linked_task !== 0);

  const [fetchDayOverview] = useLazyGetDayOverviewQuery();
  const [fetchPlanSummary] = useLazyGetDayEndPlanSummaryQuery();
  const [fetchTasksByPlanAndField] = useLazyGetDayEndTasksByPlanAndFieldQuery();
  const [submitDjiRecord] = useSubmitDayEndDjiRecordMutation();
  const [updateOpsApproval] = useUpdateDayEndOpsApprovalMutation();
  const [fetchFlagReasons] = useLazyGetDayEndFlagReasonsQuery();
  const [fetchTaskFlag] = useLazyGetDayEndTaskFlagQuery();
  const [submitTaskFlag] = useSubmitDayEndTaskFlagMutation();

  // Cancel task state
  const [triggerCancelReasons, { data: cancelReasons = [] }] = useLazyGetCancelReasonsQuery();
  const [cancelTask] = useCancelTaskMutation();
  const [clearOpsCancel] = useClearOpsCancelMutation();
  const [resetPilotCancel] = useResetPilotCancelMutation();
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  /** 'direct' = Cancel Task button (flags c + h, filterable); 'partial' = task popup below 70% (flag h only). */
  const [cancelPopupMode, setCancelPopupMode] = useState('direct');
  const [cancelReasonFlagFilter, setCancelReasonFlagFilter] = useState('');
  const [cancelTaskId, setCancelTaskId] = useState(null);
  const [cancelFieldId, setCancelFieldId] = useState(null);
  const [selectedCancelReason, setSelectedCancelReason] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [removeOpsCancelConfirm, setRemoveOpsCancelConfirm] = useState(null);
  // Cancel status map: { task_id: { com_naration, cancel_reason_text } }
  const [taskCancelStatusMap, setTaskCancelStatusMap] = useState({});
  // State for image modal
  const [selectedImage, setSelectedImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [showReportPopup, setShowReportPopup] = useState(false);
  const [reportReasons, setReportReasons] = useState([]);
  const [selectedReportReasons, setSelectedReportReasons] = useState([]);
  const [reportDescription, setReportDescription] = useState('');
  const [existingReportData, setExistingReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Helper function to update report data after submission
  const updateReportDataAfterSubmission = async (taskId) => {
    try {
      const reportResult = await fetchTaskFlag(taskId);
      const reportRes = reportResult.data;
      if (reportRes?.flags?.length > 0) {
        setExistingReportData(reportRes.flags[0]);
      }
    } catch (e) {
      console.error('Error fetching updated report data:', e);
    }
  };


  // Fetch cancel status for all tasks in a plan
  const fetchCancelStatus = async (planId) => {
    try {
      const result = await dispatch(
        dayEndProcessApi.endpoints.getTasksCancelStatus.initiate({ planId }, { forceRefetch: true })
      );
      if (result.data) {
        const normalized = {};
        Object.entries(result.data).forEach(([key, value]) => {
          normalized[Number(key)] = value;
        });
        setTaskCancelStatusMap(normalized);
      }
    } catch (e) {
      console.error('Error fetching cancel status:', e);
    }
  };

  const isOpsCancelEditMode = (taskId) => {
    const id = taskId ?? cancelTaskId;
    return Number(taskCancelStatusMap[id]?.ops_cancel_id) > 0;
  };

  const loadCancelReasonsForPopup = useCallback(
    (mode, flagFilter = '') => {
      if (mode === 'partial') {
        triggerCancelReasons({ reasonFlag: 'h' }, false);
        return;
      }
      if (flagFilter === 'c' || flagFilter === 'h') {
        triggerCancelReasons({ reasonFlag: flagFilter }, false);
        return;
      }
      triggerCancelReasons({}, false);
    },
    [triggerCancelReasons]
  );

  const handleCancelReasonFlagFilterChange = (e) => {
    const value = e.target.value;
    setCancelReasonFlagFilter(value);
    loadCancelReasonsForPopup('direct', value);
    if (!isOpsCancelEditMode()) {
      setSelectedCancelReason(null);
    }
  };

  const handleCancelReasonSelect = (reasonId) => {
    const reasonNum = Number(reasonId);
    if (!Number.isFinite(reasonNum) || reasonNum <= 0) return;
    if (Number(selectedCancelReason) === reasonNum) {
      setSelectedCancelReason(null);
      return;
    }
    setSelectedCancelReason(reasonNum);
  };

  const mapTasksResponse = (response, fieldId, missionId, previousTasks = []) => ({
    tasks: (response?.tasks || []).map((task) => {
      const previousTask = previousTasks.find((t) => t.task_id === task.task_id);
      return {
        ...task,
        expanded: previousTask ? previousTask.expanded : false,
        task_image: task.task_image ? `${task.task_image}?${Date.now()}` : null,
        dji_image: task.dji_image ? `${task.dji_image}?${Date.now()}` : null,
      };
    }),
    field_id: fieldId,
    mission_id: missionId,
  });

  const refreshAfterCancelChange = async () => {
    if (selectedMission) {
      await fetchCancelStatus(selectedMission.id);
    }
    if (cancelFieldId && selectedMission) {
      const taskResult = await fetchTasksByPlanAndField(
        { planId: selectedMission.id, fieldId: cancelFieldId },
        true
      );
      if (taskResult.data) {
        const previousTasks = fieldTasks[cancelFieldId]?.tasks || [];
        setFieldTasks((prev) => ({
          ...prev,
          [cancelFieldId]: mapTasksResponse(
            taskResult.data,
            cancelFieldId,
            selectedMission.id,
            previousTasks
          ),
        }));
      }
    }
  };

  const handleRemoveOpsCancelClick = () => {
    if (!cancelTaskId) return;
    const currentReason =
      taskCancelStatusMap[cancelTaskId]?.ops_cancel_reason ||
      getCancelReasonText(taskCancelStatusMap[cancelTaskId]?.ops_cancel_id);
    setRemoveOpsCancelConfirm({ currentReason: currentReason || null });
  };

  const confirmRemoveOpsCancel = async () => {
    if (!cancelTaskId) return;

    setCancelSubmitting(true);
    try {
      const res = await clearOpsCancel({ taskId: cancelTaskId }).unwrap();
      toast.success(res?.message || 'Ops cancel reason cleared successfully');
      setRemoveOpsCancelConfirm(null);
      setShowCancelPopup(false);
      setSelectedCancelReason(null);
      await refreshAfterCancelChange();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to remove ops cancel reason');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Cancel task handlers
  const handleCancelTaskClick = (fieldId, task) => {
    setCancelPopupMode('direct');
    setCancelReasonFlagFilter('');
    loadCancelReasonsForPopup('direct', '');
    setCancelTaskId(task.task_id);
    setCancelFieldId(fieldId);
    // Pre-select existing ops cancel reason if task was already cancelled
    const cancelInfo = taskCancelStatusMap[task.task_id];
    const existing = cancelInfo ? Number(cancelInfo.ops_cancel_id) : 0;
    setSelectedCancelReason(existing > 0 ? existing : null);
    setShowCancelPopup(true);
  };

  // Handle pilot cancel reset
  const handleResetPilotCancel = async (fieldId, task) => {
    if (!window.confirm('Are you sure you want to reset the pilot cancel status? The task will be set back to pending.')) {
      return;
    }
    setCancelSubmitting(true);
    try {
      await resetPilotCancel({ taskId: task.task_id }).unwrap();
      toast.success('Pilot cancel reset successfully');
      // Refresh cancel status map
      if (selectedMission) {
        fetchCancelStatus(selectedMission.id);
      }
      // Refresh field tasks
      if (fieldId && selectedMission) {
        const taskResult = await fetchTasksByPlanAndField(
          { planId: selectedMission.id, fieldId },
          true
        );
        if (taskResult.data) {
          const previousTasks = fieldTasks[fieldId]?.tasks || [];
          setFieldTasks((prev) => ({
            ...prev,
            [fieldId]: mapTasksResponse(taskResult.data, fieldId, selectedMission.id, previousTasks),
          }));
        }
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to reset pilot cancel');
    } finally {
      setCancelSubmitting(false);
    }
  };

  // Helper to get cancel reason text by id
  const getCancelReasonText = (reasonId) => {
    if (!reasonId || reasonId === 0 || reasonId === '0') return null;
    const r = cancelReasons.find((cr) => cr.id === Number(reasonId));
    return r ? r.reason : null;
  };

  const handleCancelTaskSubmit = async () => {
    const reasonNum = Number(selectedCancelReason);
    if (!cancelTaskId || !Number.isFinite(reasonNum) || reasonNum <= 0) {
      toast.error('Please select a cancellation reason');
      return;
    }
    setCancelSubmitting(true);
    try {
      const isEdit = isOpsCancelEditMode();
      const res = await cancelTask({ taskId: cancelTaskId, reasonId: reasonNum }).unwrap();
      toast.success(res?.message || (isEdit ? 'Cancel reason updated successfully' : 'Task cancelled successfully'));
      setShowCancelPopup(false);
      await refreshAfterCancelChange();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to cancel task');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleContainerClick = (missionId) => {
    setSelectedMissionId(missionId); // Update selected mission ID
    handleMissionClick(missionId); // Call original handler
  };

  // Image modal handlers
  const openImage = (imageSrc) => {
    setSelectedImage(imageSrc || '/assets/images/no-plan-found.png');
    setRotation(0);
  };

  const closeImage = () => {
    setSelectedImage(null);
    setRotation(0);
  };

  const rotateLeft = (e) => {
    e.stopPropagation();
    setRotation((prev) => (prev - 90) % 360);
  };

  const rotateRight = (e) => {
    e.stopPropagation();
    setRotation((prev) => (prev + 90) % 360);
  };

  const downloadImage = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = selectedImage;
    link.download = `field_image_${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBackground = (status) => {
    switch (status) {
      case 'Pending': return '#E4E4E4FF';
      case 'Complete': return '#DAFFDBFF';
      case 'Cancel': return '#FFDEDEFF';
      default: return '#0080C0FF';
    }
  };

  const handleDateChange = async (date) => {
    setMissions([]);
    setSelectedMission(null);
    setSelectedMissionId(null);
    setExpandedDivisions([]);
    setExpandedFields([]);
    setFieldTasks({});
    setTaskCancelStatusMap({});
    setLoadingFields({});
    setLoadingMissions(true);
    try {
      setSelectedDate(date);
      const formattedDate = date.toLocaleDateString('en-CA');
      const overviewResult = await fetchDayOverview({ date: formattedDate });
      if (overviewResult.error) {
        console.error('Error fetching day overview:', overviewResult.error);
        setMissions([]);
        return;
      }

      const allPlans = overviewResult.data || [];
      if (allPlans.length > 0) {
        const missionOptions = allPlans.map((plan) => ({
          id: plan.id,
          group: `${plan.estate}(${(plan.estate_id)}) - ${plan.area} Ha`,
          completed: plan.completed,
          activated: plan.activated,
          team_assigned: plan.team_assigned,
          operator_name: plan.operator_name,
          total_sub_task: plan.total_sub_task,
          total_sub_task_ops_room_approved_subs: plan.total_sub_task_ops_room_approved_subs,
          total_sub_task_ops_room_pending_subs: plan.total_sub_task_ops_room_pending_subs,
          total_sub_task_ops_room_rejected_subs: plan.total_sub_task_ops_room_rejected_subs,
          completionStats: plan.completionStats || {
            totalFields: 0,
            completedFields: 0,
            pendingFields: 0,
            completionPercentage: 0,
          },
        }));
        setMissions(missionOptions);
      } else {
        setMissions([]);
      }
    } catch (error) {
      toast.error('Failed to load missions. Please try again.');
      console.error(error);
      setMissions([]);
    } finally {
      setLoadingMissions(false);
    }
  };

  const handleMissionClick = async (missionId) => {
    setLoadingMissionDetails(true);
    try {
      // Clear all field-related state when switching missions to prevent stale data
      setFieldTasks({});
      setLoadingFields({});
      setExpandedDivisions([]);
      setExpandedFields([]);
      setTaskCancelStatusMap({});

      const summaryResult = await fetchPlanSummary(missionId);
      const response = summaryResult.data;
      if (response) {
        setSelectedMission({ ...response, id: missionId });
        // Fetch cancel status for all tasks in this plan
        fetchCancelStatus(missionId);
      } else {
        setSelectedMission(null);
      }
    } catch (error) {
      console.error('Error fetching mission details:', error);
    } finally {
      setLoadingMissionDetails(false);
    }
  };

  const toggleTaskExpansion = (fieldId, taskIndex) => {
    setFieldTasks((prev) => {
      if (!prev[fieldId] || !prev[fieldId].tasks) return prev;
      return {
        ...prev,
        [fieldId]: {
          ...prev[fieldId],
          tasks: prev[fieldId].tasks.map((task, idx) =>
            idx === taskIndex ? { ...task, expanded: !task.expanded } : task
          ),
        },
      };
    });
  };

  const toggleDivision = (divisionId) => {
    setExpandedDivisions((prev) =>
      prev.includes(divisionId)
        ? prev.filter((id) => id !== divisionId)
        : [...prev, divisionId]
    );
  };

  const handleFieldClick = async (fieldId) => {
    if (!selectedMission || !selectedMission.id) {
      console.warn('No mission selected');
      return;
    }

    setExpandedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((id) => id !== fieldId)
        : [...prev, fieldId]
    );

    // Always fetch fresh data when clicking a field to ensure we have correct data for current mission
    // This prevents showing stale data from previous missions with same field IDs
    const existingFieldData = fieldTasks[fieldId];
    const shouldFetch = !existingFieldData || existingFieldData.mission_id !== selectedMission.id;

    if (shouldFetch) {
      setLoadingFields((prev) => ({ ...prev, [fieldId]: true }));
      try {
        const taskResult = await fetchTasksByPlanAndField(
          { planId: selectedMission.id, fieldId },
          true
        );
        const response = taskResult.data || {};
        if (response.tasks && response.tasks.length > 0) {
          setFieldTasks((prev) => ({
            ...prev,
            [fieldId]: {
              tasks: response.tasks.map((task) => ({
                ...task,
                task_image: task.task_image ? `${task.task_image}?${Date.now()}` : null,
                dji_image: task.dji_image ? `${task.dji_image}?${Date.now()}` : null,
              })),
              field_id: fieldId,
              mission_id: selectedMission.id, // Store mission ID to verify data belongs to current mission
            },
          }));
        } else {
          setFieldTasks((prev) => ({
            ...prev,
            [fieldId]: {
              tasks: [],
              field_id: fieldId,
              mission_id: selectedMission.id, // Store mission ID even for empty tasks
            },
          }));
        }
      } catch (error) {
        console.error('Error fetching field tasks:', error);
      } finally {
        setLoadingFields((prev) => ({ ...prev, [fieldId]: false }));
      }
    }
  };

  const calculateTotalExtent = () => {
    if (!selectedMission?.divisions) {
      console.warn('No divisions found in mission, returning 0');
      return 0;
    }
    const total = selectedMission.divisions.reduce((total, division) => {
      const divisionTotal = division.checkedFields.reduce((sum, field) => {
        const fieldArea = parseFloat(field.field_area) || 0;
        return sum + fieldArea;
      }, 0);
      return total + divisionTotal;
    }, 0);
    return total.toFixed(2);
  };

  useEffect(() => {
    handleDateChange(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTaskApproveClick = async (fieldId, taskData) => {
    setTaskLoading(taskData.task_id); // Set loading for this specific task
    try {
      // Find the correct field from the mission data
      let fieldInfo = null;
      if (selectedMission && selectedMission.divisions) {
        for (const division of selectedMission.divisions) {
          const field = division.checkedFields?.find(f => f.field_id === fieldId);
          if (field) {
            fieldInfo = field;
            break;
          }
        }
      }

      const taskResult = await fetchTasksByPlanAndField(
        { planId: selectedMission.id, fieldId },
        true
      );
      const freshData = taskResult.data || {};
      const freshTask = freshData.tasks?.find((t) => t.task_id === taskData.task_id) || taskData;
      setCurrentTask({ ...freshTask, field_id: fieldId });
      setCurrentField(fieldInfo);
      setDjiData({
        dji_image_id: null, // Will be selected from dropdown (only unlinked images available)
        dji_field_area: freshTask.dji_field_area || '',
        dji_spraying_area: freshTask.dji_spraying_area || '',
        dji_spraying_litres: freshTask.dji_spraying_litres || '',
        dji_flying_duration: freshTask.dji_flying_duration || '',
        dji_no_of_flights: freshTask.dji_no_of_flights || '',
      });
      // Crop image is now handled automatically from DJI image, no need to reset

      // Fetch existing report data to show button color immediately
      try {
        const reportResult = await fetchTaskFlag(freshTask.task_id);
        const reportRes = reportResult.data;
        if (reportRes && reportRes.flags && reportRes.flags.length > 0) {
          const flag = reportRes.flags[0];
          setExistingReportData(flag);
        } else {
          setExistingReportData(null);
        }
      } catch (reportError) {
        console.error('Error fetching report data:', reportError);
        setExistingReportData(null);
      }

      setShowTaskPopup(true);
    } catch (error) {
      console.error('Error refreshing task data:', error);
      toast.error('Failed to load latest task data');
    } finally {
      setTaskLoading(null); // Clear loading state
    }
  };

  const handleTaskPopupClose = () => {
    setShowTaskPopup(false);
    setCurrentField(null);
    setCurrentTask(null);
    // Reset DJI image selection
    setDjiData((prev) => ({ ...prev, dji_image_id: null }));
    // Reset existing report data when closing the task popup
    setExistingReportData(null);
  };

  const StatusToggle = ({ status, onChange }) => {
    const getPosition = () => {
      if (status === 'a') return 'right';
      if (status === 'r') return 'left';
      return 'center';
    };

    const handleClick = (newStatus) => {
      onChange(newStatus);
    };

    return (
      <div className="tri-state-toggle">
        <div className={`slider ${getPosition()}`} />
        <div className="toggle-options">
          <div
            className={`option left ${status === 'r' ? 'active' : ''}`}
            onClick={() => handleClick('r')}
          >
            <FaTimes className="icon" />
          </div>
          <div className="option center">
            <FaMinus className="icon" />
          </div>
          <div
            className={`option right ${status === 'a' ? 'active' : ''}`}
            onClick={() => handleClick('a')}
          >
            <FaCheck className="icon" />
          </div>
        </div>
      </div>
    );
  };

  const getDjiImageUrl = () => {
    if (djiData.dji_image_id) {
      const selectedImage = allDjiImages.find((img) => img.id === parseInt(djiData.dji_image_id, 10));
      if (selectedImage) {
        const baseUrl = getNodeBackendUrl();
        return `${baseUrl}/api/dji-images/file/${selectedImage.image_filename}`;
      }
    }
    if (currentTask?.dji_image) {
      return currentTask.dji_image;
    }
    if (currentTask?.image_crop) {
      return getResourceUrl('DJI_SCREEN_IMAGE', currentTask.image_crop);
    }
    return null;
  };

  const handleSubmit = async () => {
    const parseArea = (value) => {
      const n = Number(String(value ?? '').replace(/,/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    const fullFieldArea = parseArea(currentField?.field_area || currentTask?.task_fieldArea || 0);
    const enteredDjiFieldArea = parseArea(djiData?.dji_field_area);
    const isBelowPartialThreshold =
      fullFieldArea > 0 && enteredDjiFieldArea < fullFieldArea * PARTIAL_DJI_AREA_RATIO;

    const hasSubmittedCancelReason = () => {
      const cancelInfo = taskCancelStatusMap[currentTask?.task_id];
      if (!cancelInfo) return false;
      return Number(cancelInfo.ops_cancel_id || 0) > 0 || Boolean(String(cancelInfo.ops_cancel_reason || '').trim());
    };

    const pilotFieldAreaValue = Number(currentTask?.task_fieldArea || currentField?.field_area || 0);
    const hasPilotFieldArea = Number.isFinite(pilotFieldAreaValue) && pilotFieldAreaValue > 0;
    const hasTaskImage = Boolean(String(currentTask?.task_image || '').trim());
    if (!hasPilotFieldArea || !hasTaskImage) {
      toast.warning('Pilot Field Area (Ha) and Task Image are required before submitting DJI data.');
      return;
    }

    if (isBelowPartialThreshold && !hasSubmittedCancelReason()) {
      setCancelPopupMode('partial');
      setCancelReasonFlagFilter('');
      loadCancelReasonsForPopup('partial');
      setCancelTaskId(currentTask.task_id);
      setCancelFieldId(currentTask.field_id);
      const existingOps = Number(taskCancelStatusMap[currentTask.task_id]?.ops_cancel_id || 0);
      setSelectedCancelReason(existingOps > 0 ? existingOps : null);
      setShowCancelPopup(true);
      toast.info('DJI field area is below 70%. Please save a partial (h) reason before submitting DJI data.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formatNumber = (value, decimals = 2) => {
        const num = Number(String(value).replace(/,/g, ''));
        return Number.isNaN(num) ? 0 : num.toFixed(decimals);
      };

      const response = await submitDjiRecord({
        taskId: currentTask.task_id,
        djiImageId: djiData.dji_image_id ? parseInt(djiData.dji_image_id, 10) : null,
        dji_field_area: formatNumber(djiData.dji_field_area),
        dji_spraying_area: formatNumber(djiData.dji_spraying_area),
        dji_spraying_litres: formatNumber(djiData.dji_spraying_litres),
        dji_flying_duration: formatNumber(djiData.dji_flying_duration),
        dji_no_of_flights: formatNumber(djiData.dji_no_of_flights),
      }).unwrap();

      if (response?.success || response?.status === 'true') {
        if (selectedMission?.id) {
          const formattedDate = selectedDate.toLocaleDateString('en-CA');
          const overviewResult = await fetchDayOverview({ date: formattedDate });
          const updatedPlan = (overviewResult.data || []).find((p) => p.id === selectedMission.id);
          if (updatedPlan?.completionStats) {
            setMissions((prevMissions) =>
              prevMissions.map((mission) =>
                mission.id === selectedMission.id
                  ? { ...mission, completionStats: updatedPlan.completionStats }
                  : mission
              )
            );
          }
        }

        toast.success('DJI data submitted successfully!');
        try {
          const updatedResult = await fetchTasksByPlanAndField(
            { planId: selectedMission.id, fieldId: currentTask.field_id },
            true
          );
          const previousTasks = fieldTasks[currentTask.field_id]?.tasks || [];
          setFieldTasks((prev) => ({
            ...prev,
            [currentTask.field_id]: mapTasksResponse(
              updatedResult.data,
              currentTask.field_id,
              selectedMission.id,
              previousTasks
            ),
          }));
        } catch (error) {
          console.error('Error refetching task data:', error);
        }
        handleTaskPopupClose();
      } else {
        toast.error('Submission failed. Please try again.');
      }
    } catch (error) {
      toast.error('An error occurred during submission.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };


  const taskPopupPartialInfo = useMemo(() => {
    if (!showTaskPopup || !currentTask) return null;
    const pilotArea = Number(currentField?.field_area || currentTask.task_fieldArea || 0);
    const djiArea = Number(String(djiData?.dji_field_area ?? '').replace(/,/g, '')) || 0;
    if (pilotArea <= 0) return null;
    const pct = Math.round((djiArea / pilotArea) * 100);
    const belowThreshold = djiArea < pilotArea * PARTIAL_DJI_AREA_RATIO;
    return { pilotArea, djiArea, pct, belowThreshold };
  }, [showTaskPopup, currentTask, currentField, djiData?.dji_field_area]);

  useEffect(() => {
    if (showReportPopup && currentTask) {
      setReportLoading(true);
      setReportReasons([]);
      setSelectedReportReasons([]);
      setReportDescription('');
      setExistingReportData(null);

      const loadReportData = async () => {
        try {
          const [reasonsResult, reportResult] = await Promise.all([
            fetchFlagReasons(),
            fetchTaskFlag(currentTask.task_id),
          ]);

          const reasonsRes = reasonsResult.data;
          const reportRes = reportResult.data;

          if (Array.isArray(reasonsRes)) {
            setReportReasons(reasonsRes);
            console.log('Fetched report reasons:', reasonsRes);
          }
          if (reportRes && reportRes.flags && reportRes.flags.length > 0) {
            const flag = reportRes.flags[0];
            setExistingReportData(flag);
            setReportDescription(flag.reason_text || '');
            setSelectedReportReasons(
              (flag.reasons || []).map((r) => String(r.reason_id))
            );
          }
        } catch (error) {
          console.error('Error fetching report data:', error);
        } finally {
          setReportLoading(false);
        }
      };

      loadReportData();
    } else if (!showReportPopup) {
      setReportReasons([]);
      setSelectedReportReasons([]);
      setReportDescription('');
      // Only reset existingReportData if task popup is also closed
      if (!showTaskPopup) {
        setExistingReportData(null);
      }
      setReportLoading(false);
      setReportSubmitting(false);
    }
    // eslint-disable-next-line
  }, [showReportPopup, currentTask, showTaskPopup]);

  return (
    <div className="dayendprocess">
      <div className="dayendprocess-header">
        <button
          className="dayendprocess-back-btn"
          onClick={() => navigate({ pathname: '/home/workflowDashboard', search: routerLocation.search })}
          title="Go back to Workflow Dashboard"
        >
          <span className="back-btn-icon-dayend">←</span>
        </button>
        <h1 className="dayendprocess-title">Day End Process</h1>
        <div className="date-area-dayendprocess-header">
          <label>Plan Date: </label>
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="yyyy/MM/dd"
            customInput={<CustomDateInput />}
          />
        </div>
      </div>
      <div className="dayendprocess-content">
        <div className="left-dayend">
          <div className="dayendprocess-missions-list">
            {loadingMissions ? (
              <Bars height="50" width="50" color="#004B71" ariaLabel="loading" />
            ) : (
              [...missions]
                .sort((a, b) => {
                  // Missions with activated === 0 go to the end
                  if (a.activated === 0 && b.activated !== 0) return 1;
                  if (a.activated !== 0 && b.activated === 0) return -1;
                  // Missions with team_assigned === 0 go before activated === 0 but after others
                  if (a.team_assigned !== 0 && b.team_assigned === 0) return -1;
                  if (a.team_assigned === 0 && b.team_assigned !== 0) return 1;
                  // Missions with pending subs (total_sub_task_ops_room_pending_subs !== 0) go first
                  if (a.total_sub_task_ops_room_pending_subs !== 0 && b.total_sub_task_ops_room_pending_subs === 0) return -1;
                  if (a.total_sub_task_ops_room_pending_subs === 0 && b.total_sub_task_ops_room_pending_subs !== 0) return 1;

                  // Missions with rejected subs (total_sub_task_ops_room_rejected_subs !== 0) go next
                  if (a.total_sub_task_ops_room_rejected_subs !== 0 && b.total_sub_task_ops_room_rejected_subs === 0) return -1;
                  if (a.total_sub_task_ops_room_rejected_subs === 0 && b.total_sub_task_ops_room_rejected_subs !== 0) return 1;

                  // For the rest, maintain original order or sort by another criterion (e.g., id)
                  return a.id - b.id;
                })
                .map((mission) => (
                  <div
                    key={mission.id}
                    className={`dayendprocess-mission-container ${mission.activated === 0
                      ? 'mission-canceled-byops'
                      : mission.team_assigned === 0
                        ? 'team-not-assigned'
                        : mission.completed === 1
                          ? 'completed-mission'
                          : 'incomplete-mission'
                      } ${selectedMissionId === mission.id ? 'clicked-one' : ''}`}
                    onClick={() => handleContainerClick(mission.id)}
                  >
                    <div className="mission-container-left">
                      <p><strong>{mission.group} - ({mission.id})</strong> </p>
                      <p><strong>Ops Assignment: </strong>{mission.operator_name && mission.operator_name.trim() !== '' ? mission.operator_name : 'Not Assigned'}</p>
                      {mission.completionStats && mission.completionStats.totalFields > 0 && (
                        <div className="ops-completion-stats-dayend">
                          <span className="ops-completion-label-dayend">OPS Completed - {mission.completionStats.completionPercentage}%</span>
                          <span className="ops-completion-detail-dayend">
                            ({mission.completionStats.completedFields}/{mission.completionStats.totalFields})
                          </span>
                        </div>
                      )}
                      {showDirOpsApprovalFeature && (
                        <div className="completion-checkbox" onClick={(e) => e.stopPropagation()}>
                          <label className="dir-opstext">
                            Dir-Ops Approval
                            <input
                              type="checkbox"
                              checked={mission.completed === 1}
                              disabled={
                                !showDirOpsApprovalFeature ||
                                mission.activated === 0 ||
                                mission.team_assigned === 0
                              }
                              onChange={async (e) => {
                                if (!showDirOpsApprovalFeature) {
                                  toast.error("You don't have permission to modify Dir-Ops approvals");
                                  return;
                                }
                                const newStatus = e.target.checked ? 1 : 0;
                                try {
                                  const updatedMissions = missions.map((m) =>
                                    m.id === mission.id ? { ...m, completed: newStatus } : m
                                  );
                                  setMissions(updatedMissions);
                                  const response = await updateOpsApproval({
                                    planId: mission.id,
                                    status: newStatus,
                                  }).unwrap();
                                  if (response.status === 'true' || response.success === true) {
                                    toast.success('Status updated successfully');
                                    await handleDateChange(selectedDate);
                                  } else {
                                    setMissions(missions);
                                    toast.error(response.message || 'Update failed');
                                  }
                                } catch (error) {
                                  console.error('Update error:', error);
                                  setMissions(missions);
                                  toast.error('Failed to update status');
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                      {mission.activated === 0 && (
                        <div className="deactivate_alert">Deactivated Plan</div>
                      )}
                      {mission.team_assigned === 0 && (
                        <div className="deactivate_alert">Team Not Assigned</div>
                      )}
                    </div>
                    <div className="mission-container-right">
                      <FaRegArrowAltCircleRight />
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
        <div className="right-dayend">
          {loadingMissionDetails && (
            <Bars height="50" width="50" color="#004B71" ariaLabel="loading" />
          )}
          {(!loadingMissionDetails && selectedMission) ? (
            <div className="mission-details-container">
              <h3>
                {selectedMission?.estateName ?? 'Unknown Estate'} - {calculateTotalExtent()} Ha
              </h3>
              {selectedMission.divisions && selectedMission.divisions.length > 0 ? (
                selectedMission.divisions.map((division) => (
                  <div key={division.divisionId} className="division-container">
                    <div
                      className="division-header"
                      onClick={() => toggleDivision(division.divisionId)}
                    >
                      <span>{division.divisionName}</span>
                      <span className="division-total-dayend">
                        {division.checkedFields
                          .reduce((sum, field) => sum + (parseFloat(field.field_area) || 0), 0)
                          .toFixed(2)} Ha
                        {expandedDivisions.includes(division.divisionId) ? (
                          <FaArrowCircleUp className="toggle-icon" />
                        ) : (
                          <FaArrowCircleDown className="toggle-icon" />
                        )}
                      </span>
                    </div>
                    {expandedDivisions.includes(division.divisionId) && (
                      <div className="fields-list">
                        {division.checkedFields.map((field) => (
                          <div
                            key={field.field_id}
                            className={`field-item ${field.field_pilots?.status === 'false' ? 'field-pilot-warning' : ''}`}
                          >
                            <div
                              className="field-header"
                              onClick={() => handleFieldClick(field.field_id)}
                            >
                              <span>
                                <span
                                  style={{
                                    color: field.activated ? '#4CAF50' : '#f44336',
                                    fontSize: '25px',
                                  }}
                                  title={field.activated ? 'Active Field' : 'Inactive Field'}
                                >
                                  ●
                                </span>
                                {field.field_name} - ({field.field_id})
                              </span>
                              <span>
                                {field.field_pilots?.status === 'false' && (
                                  <span className="warning-badge">⚠️ No Pilot Assigned</span>
                                )}
                                {field.field_area} Ha
                                {loadingFields[field.field_id] ? (
                                  <Bars height="20" width="20" color="#004B71" />
                                ) : expandedFields.includes(field.field_id) ? (
                                  <FaArrowCircleUp className="toggle-icon" />
                                ) : (
                                  <FaArrowCircleDown className="toggle-icon" />
                                )}
                              </span>
                            </div>
                            {expandedFields.includes(field.field_id) && (
                              <div className="field-tasks-container">
                                {(fieldTasks[field.field_id]?.tasks || []).map((task, taskIndex) => (
                                  <div key={`task-${task.task_id}-${taskIndex}`} className="task-details-dayend">
                                    <div
                                      className={`task-header ${(taskCancelStatusMap[task.task_id]?.pilot_cancel_id || taskCancelStatusMap[task.task_id]?.ops_cancel_id) ? 'task-header-cancelled' : ''}`}
                                      style={{
                                        backgroundColor: (taskCancelStatusMap[task.task_id]?.pilot_cancel_id || taskCancelStatusMap[task.task_id]?.ops_cancel_id) ? '#ffebee' : getStatusBackground(task.task_status_text),
                                        transition: 'all 0.3s ease',
                                      }}
                                      onClick={() => toggleTaskExpansion(field.field_id, taskIndex)}
                                    >
                                      <h4>
                                        Task {taskIndex + 1} : {task.drone_tag} - {task.pilot}
                                        {taskCancelStatusMap[task.task_id]?.pilot_cancel_id > 0 && (
                                          <span className="cancelled-badge cancelled-badge-pilot">Pilot Cancelled</span>
                                        )}
                                        {taskCancelStatusMap[task.task_id]?.ops_cancel_id > 0 && (
                                          <span className="cancelled-badge cancelled-badge-ops">Ops Cancelled</span>
                                        )}
                                      </h4>
                                      {task.expanded ? <FaArrowCircleUp /> : <FaArrowCircleDown />}
                                    </div>
                                    {task.expanded && (
                                      <div className="tasks-all">
                                        <div className="task-content">
                                          <div className="task-content-left">
                                            <div className="task-text">
                                              <p>Task ID: {task.task_id}</p>
                                              <p>Field Area: {parseFloat(task.task_fieldArea || 0).toFixed(2)} Ha</p>
                                              <p>Sprayed Area: {parseFloat(task.task_sprayedArea || 0).toFixed(2)}</p>
                                              <p>Obstacle Area: {parseFloat(task.task_obstacleArea || 0).toFixed(2)}</p>
                                            </div>
                                            <div className="task-text">
                                              <p>Margin Area: {parseFloat(task.task_marginArea || 0).toFixed(2)}</p>
                                              <p>Liters Used: {parseFloat(task.task_sprayedLiters || 0).toFixed(2)}</p>
                                              <p>Status: {task.task_status_text}</p>
                                              <p>Pilot: {task.pilot}</p>
                                              <p>Drone: {task.drone_tag}</p>
                                            </div>
                                          </div>
                                          <div className="task-image-container">
                                            <img
                                              src={task.task_image || '/assets/images/no-plan-found.png'}
                                              alt="Field task"
                                              className="task-image"
                                              onClick={() => openImage(task.task_image)}
                                            />
                                          </div>
                                        </div>
                                        {/* Show pilot cancel reason */}
                                        {taskCancelStatusMap[task.task_id]?.pilot_cancel_id > 0 && (
                                          <div className="cancel-reason-display cancel-reason-pilot">
                                            <span className="cancel-reason-label">Pilot Cancel:</span>
                                            <span className="cancel-reason-value">
                                              {taskCancelStatusMap[task.task_id].pilot_cancel_reason || 'Unknown'}
                                            </span>
                                          </div>
                                        )}
                                        {/* Show ops room cancel reason */}
                                        {taskCancelStatusMap[task.task_id]?.ops_cancel_id > 0 && (
                                          <div className="cancel-reason-display cancel-reason-ops">
                                            <span className="cancel-reason-label">Ops Cancel:</span>
                                            <span className="cancel-reason-value">
                                              {taskCancelStatusMap[task.task_id].ops_cancel_reason || 'Unknown'}
                                            </span>
                                          </div>
                                        )}
                                        <div className="button-set-dayend">
                                          <button
                                            className="confirm-button-dayend"
                                            onClick={() => handleTaskApproveClick(field.field_id, task)}
                                            disabled={taskLoading === task.task_id}
                                          >
                                            {taskLoading === task.task_id ? 'Loading...' : 'Task'}
                                          </button>
                                          <button
                                            className={`cancel-button-dayend ${Number(taskCancelStatusMap[task.task_id]?.ops_cancel_id) > 0 ? 'cancel-button-edit' : ''}`}
                                            onClick={() => handleCancelTaskClick(field.field_id, task)}
                                          >
                                            {Number(taskCancelStatusMap[task.task_id]?.ops_cancel_id) > 0
                                              ? 'Edit Cancel Reason'
                                              : 'Cancel Task'}
                                          </button>
                                          {taskCancelStatusMap[task.task_id]?.pilot_cancel_id > 0 && (
                                            <button
                                              className="reset-button-dayend"
                                              onClick={() => handleResetPilotCancel(field.field_id, task)}
                                              title="Reset pilot cancel status"
                                            >
                                              Pilot Cancel Reset
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="placeholder-text">Select a mission to view details</div>
              )}
            </div>
          ) : null}
        </div>
        {/* Full-screen image modal - Using Portal to render outside component hierarchy */}
        {selectedImage && createPortal(
          <div className="image_modal" onClick={closeImage}>
            <div className="image_modal_content_wrapper" onClick={(e) => e.stopPropagation()}>
              <img
                src={selectedImage}
                alt="Full-screen"
                className="image_modal_content"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
              <div className="image_modal_controls">
                <button className="image_modal_btn rotate_left" onClick={rotateLeft} title="Rotate Left">
                  ↺
                </button>
                <button className="image_modal_btn rotate_right" onClick={rotateRight} title="Rotate Right">
                  ↻
                </button>
                <button className="image_modal_btn download-btn" onClick={downloadImage} title="Download">
                  ⬇
                </button>
                <button className="image_modal_close" onClick={closeImage} title="Close">
                  ✕
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        {showTaskPopup && currentTask && (
          <div className="task-popup-overlay" onClick={handleTaskPopupClose}>
            <div className="task-popup-content" onClick={(e) => e.stopPropagation()}>
              <div className="task-popup-header">
                <div className="task-popup-header-top">
                  <h3>{currentField?.field_name || 'Unknown Field'} - TaskID: {currentTask.task_id} | {currentField?.field_area || currentTask.task_fieldArea || 'N/A'} Ha</h3>
                  <button
                    className="submit-button2"
                    style={{
                      background: existingReportData
                        ? existingReportData.status === 'a'
                          ? '#2fc653'
                          : existingReportData.status === 'r'
                            ? '#ff4d4f'
                            : existingReportData.status === 'p'
                              ? '#948F62FF'
                              : '#004B71'
                        : '#004B71',
                      color: '#fff',
                      border: existingReportData ? '1.5px solid #888' : undefined,
                    }}
                    onClick={() => setShowReportPopup(true)}
                  >
                    Report
                  </button>
                  <button className="close-button" onClick={handleTaskPopupClose}>✖</button>
                </div>
                <div className="task-top-line">
                  <span className="status-badge">Status: {currentTask.task_status_text}</span>
                  <span>Drone: {currentTask.drone_tag}</span>
                  <span>Pilot: {currentTask.pilot}</span>
                  <span>Mobile: {currentTask.mobile_no}</span>
                </div>
              </div>
              <div className="task-popup-body">
                <div className="task-images-section">
                  <div className="image-cards-row">
                    <div className="image-card2">
                      <h4>Task Image</h4>
                      <img
                        src={currentTask.task_image || '/assets/images/no-plan-found.png'}
                        alt="Task"
                        className="popup-image"
                        onClick={() => openImage(currentTask.task_image)}
                      />
                      {!String(currentTask.task_image || '').trim() && (
                        <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px', display: 'block' }}>
                          Task Image is required to submit DJI data.
                        </span>
                      )}
                    </div>
                    <div className="image-card2">
                      <h4>DJI Image</h4>
                      <img
                        src={getDjiImageUrl() || '/assets/images/no-plan-found.png'}
                        alt="DJI"
                        className="popup-image"
                        onClick={() => {
                          const url = getDjiImageUrl();
                          if (url) openImage(url);
                        }}
                      />
                      <select
                        value={djiData.dji_image_id || ''}
                        onChange={(e) => {
                          // Only allow selection of unlinked images
                          const selectedValue = e.target.value;
                          if (selectedValue && !unlinkedDjiImages.find(img => img.id.toString() === selectedValue)) {
                            return; // Prevent selection of linked images
                          }
                          setDjiData((prev) => ({
                            ...prev,
                            dji_image_id: selectedValue || null,
                          }));
                        }}
                        className="dji-image-select"
                        style={{
                          width: '100%',
                          padding: '8px',
                          marginTop: '8px',
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                        }}
                      >
                        <option value="">Select DJI Image</option>
                        {/* Show unlinked images (selectable) */}
                        {unlinkedDjiImages.map((image) => (
                          <option key={image.id} value={image.id}>
                            {image.auto_generated_id} {image.is_plantation === 1 ? `(${image.estate_name} - ${image.field_name})` : `(NIC: ${image.nic})`}
                          </option>
                        ))}
                        {/* Show linked images (disabled, not selectable) */}
                        {linkedDjiImages.length > 0 && (
                          <optgroup label="Already Used (Not Available)">
                            {linkedDjiImages.map((image) => (
                              <option key={image.id} value={image.id} disabled style={{ color: '#999', fontStyle: 'italic' }}>
                                {image.auto_generated_id} {image.is_plantation === 1 ? `(${image.estate_name} - ${image.field_name})` : `(NIC: ${image.nic})`} - Used
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="data-grid">
                  <div className="data-row">
                    <div className="data-item">
                      <label>Pilot Field Area (Ha):</label>
                      <input
                        type="number"
                        value={currentTask.task_fieldArea}
                        readOnly
                        disabled
                      />
                      {!Number(currentTask.task_fieldArea || currentField?.field_area || 0) && (
                        <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          Pilot Field Area (Ha) is required.
                        </span>
                      )}
                    </div>
                    <div className="data-item">
                      <label>DJI Field Area (Ha):</label>
                      <input
                        type="number"
                        value={djiData.dji_field_area}
                        onChange={(e) =>
                          setDjiData((prev) => ({
                            ...prev,
                            dji_field_area: e.target.value,
                          }))
                        }
                        style={{
                          borderColor: parseFloat(djiData.dji_field_area) > parseFloat(currentField?.field_area || currentTask.task_fieldArea || 0) ? '#ef4444' : ''
                        }}
                      />
                      {parseFloat(djiData.dji_field_area) > parseFloat(currentField?.field_area || currentTask.task_fieldArea || 0) && (
                        <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          Cannot exceed field size ({currentField?.field_area || currentTask.task_fieldArea} Ha)
                        </span>
                      )}
                      {taskPopupPartialInfo?.belowThreshold ? (
                        <span className="partial-threshold-hint-dayend">
                          DJI field area is {taskPopupPartialInfo.pct}% of pilot field area (below 70%). Save a
                          partial (h) cancel reason before submitting DJI data.
                        </span>
                      ) : taskPopupPartialInfo && taskPopupPartialInfo.djiArea > 0 ? (
                        <span className="partial-threshold-ok-dayend">
                          {taskPopupPartialInfo.pct}% (70% minimum for full completion).
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="data-row">
                    <div className="data-item">
                      <label>Pilot Sprayed Area (Ha):</label>
                      <input
                        type="number"
                        value={currentTask.task_sprayedArea}
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="data-item">
                      <label>DJI Spraying Area (Ha):</label>
                      <input
                        type="number"
                        value={djiData.dji_spraying_area}
                        onChange={(e) =>
                          setDjiData((prev) => ({
                            ...prev,
                            dji_spraying_area: e.target.value,
                          }))
                        }
                        style={{
                          borderColor: parseFloat(djiData.dji_spraying_area) > parseFloat(currentField?.field_area || currentTask.task_fieldArea || 0) ? '#ef4444' : ''
                        }}
                      />
                      {parseFloat(djiData.dji_spraying_area) > parseFloat(currentField?.field_area || currentTask.task_fieldArea || 0) && (
                        <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                          Cannot exceed field size ({currentField?.field_area || currentTask.task_fieldArea} Ha)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="data-row">
                    <div className="data-item">
                      <label>Pilot Sprayed Liters:</label>
                      <input
                        type="number"
                        value={currentTask.task_sprayedLiters}
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="data-item">
                      <label>DJI Sprayed Liters:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={djiData.dji_spraying_litres}
                        onChange={(e) =>
                          setDjiData((prev) => ({
                            ...prev,
                            dji_spraying_litres: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="data-row">
                    <div className="data-item">
                      <label>DJI Flying Duration (mins):</label>
                      <input
                        type="number"
                        value={djiData.dji_flying_duration}
                        onChange={(e) =>
                          setDjiData((prev) => ({
                            ...prev,
                            dji_flying_duration: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="data-item">
                      <label>DJI No of Flights:</label>
                      <input
                        type="number"
                        value={djiData.dji_no_of_flights}
                        onChange={(e) =>
                          setDjiData((prev) => ({
                            ...prev,
                            dji_no_of_flights: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="data-row submit-row">
                    <button
                      className="submit-button"
                      onClick={handleSubmit}
                      disabled={
                        isSubmitting ||
                        !Number(currentTask?.task_fieldArea || currentField?.field_area || 0) ||
                        !String(currentTask?.task_image || '').trim() ||
                        !djiData.dji_flying_duration ||
                        !djiData.dji_no_of_flights ||
                        !djiData.dji_field_area ||
                        !djiData.dji_spraying_litres ||
                        !djiData.dji_spraying_area ||
                        parseFloat(djiData.dji_field_area) > parseFloat(currentField?.field_area || currentTask.task_fieldArea || 0) ||
                        parseFloat(djiData.dji_spraying_area) > parseFloat(currentField?.field_area || currentTask.task_fieldArea || 0)
                      }
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit DJI Data'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {showReportPopup && currentTask && (
          <div className="task-popup-overlay" onClick={() => setShowReportPopup(false)}>
            <div className="task-popup-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <button className="close-button" onClick={() => setShowReportPopup(false)}>✖</button>
              <h3>Report Task - ID: {currentTask.task_id}</h3>
              {reportLoading ? (
                <div style={{ textAlign: 'center', margin: '32px 0' }}>Loading...</div>
              ) : (
                <>
                  {existingReportData ? (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: 600 }}>Explanation:</label>
                        <textarea
                          value={reportDescription}
                          onChange={e => setReportDescription(e.target.value)}
                          rows={3}
                          style={{ width: '100%', resize: 'vertical', marginTop: 4 }}
                          placeholder="Describe the issue..."
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: 600 }}>Select Reason(s):</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, maxWidth: 320 }}>
                          {reportReasons.map((r) => {
                            const selected = selectedReportReasons.includes(String(r.id));
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setSelectedReportReasons(prev =>
                                    selected ? prev.filter(id => id !== String(r.id)) : [...prev, String(r.id)]
                                  );
                                }}
                                style={{
                                  padding: '6px 16px',
                                  borderRadius: 16,
                                  border: selected ? '1.5px solid #2fc653' : '1px solid #ccc',
                                  background: selected ? '#eaffea' : '#fff',
                                  color: '#222',
                                  fontWeight: 500,
                                  fontSize: 15,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  transition: 'background 0.15s, border 0.15s',
                                  boxShadow: selected ? '0 1px 4px #2fc65322' : 'none',
                                  minWidth: 80,
                                }}
                              >
                                {r.reason}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        className="submit-button"
                        style={{ width: '100%' }}
                        onClick={async () => {
                          setReportSubmitting(true);
                          try {
                            const res = await submitTaskFlag({
                              taskId: currentTask.task_id,
                              reason: reportDescription,
                              reasonList: selectedReportReasons,
                            }).unwrap();
                            if (res && res.status === 'true') {
                              toast.success('Report submitted successfully');
                              await updateReportDataAfterSubmission(currentTask.task_id);
                              setShowReportPopup(false);
                            } else {
                              toast.error('Failed to submit report');
                            }
                          } catch (err) {
                            toast.error('Error submitting report');
                          } finally {
                            setReportSubmitting(false);
                          }
                        }}
                        disabled={
                          reportSubmitting ||
                          !reportDescription.trim() ||
                          selectedReportReasons.length === 0
                        }
                      >
                        {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: 600 }}>Select Reason(s):</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, maxWidth: 320 }}>
                          {reportReasons.map((r) => {
                            const selected = selectedReportReasons.includes(String(r.id));
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setSelectedReportReasons(prev =>
                                    selected ? prev.filter(id => id !== String(r.id)) : [...prev, String(r.id)]
                                  );
                                }}
                                style={{
                                  padding: '6px 16px',
                                  borderRadius: 16,
                                  border: selected ? '1.5px solid #2fc653' : '1px solid #ccc',
                                  background: selected ? '#eaffea' : '#fff',
                                  color: '#222',
                                  fontWeight: 500,
                                  fontSize: 15,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  transition: 'background 0.15s, border 0.15s',
                                  boxShadow: selected ? '0 1px 4px #2fc65322' : 'none',
                                  minWidth: 80,
                                }}
                              >
                                {r.reason}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: 600 }}>Explanation:</label>
                        <textarea
                          value={reportDescription}
                          onChange={e => setReportDescription(e.target.value)}
                          rows={3}
                          style={{ width: '100%', resize: 'vertical', marginTop: 4 }}
                          placeholder="Describe the issue..."
                        />
                      </div>
                      <button
                        className="submit-button"
                        style={{ width: '100%' }}
                        onClick={async () => {
                          setReportSubmitting(true);
                          try {
                            const res = await submitTaskFlag({
                              taskId: currentTask.task_id,
                              reason: reportDescription,
                              reasonList: selectedReportReasons,
                            }).unwrap();
                            if (res && res.status === 'true') {
                              toast.success('Report submitted successfully');
                              await updateReportDataAfterSubmission(currentTask.task_id);
                              setShowReportPopup(false);
                            } else {
                              toast.error('Failed to submit report');
                            }
                          } catch (err) {
                            toast.error('Error submitting report');
                          } finally {
                            setReportSubmitting(false);
                          }
                        }}
                        disabled={
                          reportSubmitting ||
                          !reportDescription.trim() ||
                          selectedReportReasons.length === 0
                        }
                      >
                        {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Cancel Task Popup ─── */}
      {showCancelPopup && createPortal(
        <div className="cancel-task-overlay" onClick={() => !cancelSubmitting && setShowCancelPopup(false)}>
          <div className="cancel-task-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cancel-task-header">
              <h3>
                {isOpsCancelEditMode()
                  ? 'Edit ops cancel reason'
                  : cancelPopupMode === 'partial'
                    ? 'Partial completion reason'
                    : 'Cancel Task'}
              </h3>
              <button className="cancel-task-close" onClick={() => !cancelSubmitting && setShowCancelPopup(false)}>×</button>
            </div>
            <div className="cancel-task-body">
              <p className="cancel-task-label">
                {isOpsCancelEditMode()
                  ? 'Choose a different reason if needed:'
                  : cancelPopupMode === 'partial'
                    ? 'DJI field area is below 70%. Select a partially completed reason (flag h):'
                    : 'Select a cancellation reason:'}
              </p>
              {isOpsCancelEditMode() ? (
                <p className="cancel-task-hint">
                  Change the reason below and click <strong>Update Reason</strong>, or use{' '}
                  <strong>Remove cancellation</strong> if this was added by mistake.
                </p>
              ) : cancelPopupMode === 'partial' ? (
                <p className="cancel-task-hint cancel-task-hint-partial">
                  Only partially completed (h) reasons are listed here. Use Cancel Task on the task row for full
                  cancel (c) reasons.
                </p>
              ) : null}
              {cancelPopupMode === 'direct' ? (
                <div className="cancel-reason-flag-filter-wrap">
                  <label className="cancel-reason-flag-filter-label" htmlFor="cancel-reason-flag-filter">
                    Reason type
                  </label>
                  <select
                    id="cancel-reason-flag-filter"
                    className="cancel-reason-flag-filter"
                    value={cancelReasonFlagFilter}
                    onChange={handleCancelReasonFlagFilterChange}
                    disabled={cancelSubmitting}
                  >
                    <option value="">All Flags</option>
                    <option value="h">Partially (h)</option>
                    <option value="c">Cancel (c)</option>
                  </select>
                </div>
              ) : null}
              <div className="cancel-reasons-list">
                {cancelReasons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`cancel-reason-item ${Number(selectedCancelReason) === Number(r.id) ? 'selected' : ''}`}
                    onClick={() => handleCancelReasonSelect(r.id)}
                  >
                    <span className="cancel-reason-radio">
                      {Number(selectedCancelReason) === Number(r.id) ? '●' : '○'}
                    </span>
                    <span className="cancel-reason-text">
                      {r.reason}
                      {r.flag ? (
                        <span className="cancel-reason-flag-tag"> ({String(r.flag).toLowerCase()})</span>
                      ) : null}
                    </span>
                  </button>
                ))}
                {cancelReasons.length === 0 && (
                  <p className="cancel-no-reasons">No reasons available for this filter.</p>
                )}
              </div>
            </div>
            <div className="cancel-task-footer">
              <div className="cancel-task-footer-actions">
                {isOpsCancelEditMode() ? (
                  <button
                    type="button"
                    className="cancel-task-btn-remove"
                    onClick={handleRemoveOpsCancelClick}
                    disabled={cancelSubmitting}
                  >
                    {cancelSubmitting ? 'Working...' : 'Remove cancellation'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="cancel-task-btn-secondary"
                  onClick={() => setShowCancelPopup(false)}
                  disabled={cancelSubmitting}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="cancel-task-btn-danger"
                  onClick={handleCancelTaskSubmit}
                  disabled={!Number(selectedCancelReason) || cancelSubmitting}
                >
                  {cancelSubmitting
                    ? 'Saving...'
                    : isOpsCancelEditMode()
                      ? 'Update Reason'
                      : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {removeOpsCancelConfirm && createPortal(
        <div
          className="dayend-confirm-overlay"
          onClick={() => !cancelSubmitting && setRemoveOpsCancelConfirm(null)}
        >
          <div className="dayend-confirm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h4 className="dayend-confirm-title">Remove ops cancel reason?</h4>
            {removeOpsCancelConfirm.currentReason ? (
              <p className="dayend-confirm-current">
                <span className="dayend-confirm-current-label">Current:</span>{' '}
                {removeOpsCancelConfirm.currentReason}
              </p>
            ) : null}
            <p className="dayend-confirm-message">
              The task will no longer show as ops cancelled.
            </p>
            <div className="dayend-confirm-actions">
              <button
                type="button"
                className="cancel-task-btn-secondary"
                onClick={() => setRemoveOpsCancelConfirm(null)}
                disabled={cancelSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cancel-task-btn-danger"
                onClick={confirmRemoveOpsCancel}
                disabled={cancelSubmitting}
              >
                {cancelSubmitting ? 'Working...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DayEndProcess;