import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { baseApi } from '../../../api/services/allEndpoints';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  FaSync,
  FaBell,
  FaTimes,
  FaEnvelope,
  FaEnvelopeOpen,
  FaInbox,
  FaUserCheck,
  FaTruck,
  FaCreditCard,
  FaUnlock,
  FaTasks,
  FaCalendarDay,
  FaMapMarkedAlt,
  FaChevronRight,
  FaCalendarAlt,
  FaClipboardList,
  FaHistory,
  FaChartBar,
  FaRulerCombined,
  FaBolt,
  FaCogs,
  FaHome,
} from 'react-icons/fa';
import {
  useGetMissionsPendingPaymentQuery,
  useGetDroneUnlockingQueueQuery,
  useGetResourceAssignmentCountQuery,
} from '../../../api/services NodeJs/pilotAssignmentApi';
import { useGetPlansPendingDayEndCountQuery } from '../../../api/services NodeJs/dayEndProcessApi';
import { useGetTodayDjiImagesCountQuery } from '../../../api/services NodeJs/djiImagesApi';
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationAsDisplayedMutation,
  useLogNotificationActionMutation,
} from '../../../api/services NodeJs/notificationsApi';
import { useGetPlantationPlanRequestsPendingCountQuery, useGetPlantationPlanRescheduleRequestsPendingCountQuery } from '../../../api/services NodeJs/plantationDashboardApi';
import {
  getCategoryVisibility,
  getUserData,
  isInternalDeveloper,
} from '../../../utils/authUtils';
import {
  useGetMyPermissionsQuery,
} from '../../../api/services NodeJs/featurePermissionsApi';
import { FEATURE_CODES } from '../../../utils/featurePermissions';
import '../../../styles/workflowDashboard-com.css';

const WorkflowDashboard = () => {
  const dispatch = useAppDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const go = (pathname) => navigate({ pathname, search: routerLocation.search });

  // Get user data and permissions
  const userData = getUserData();
  const permissions = useAppSelector((state) => state.permissions?.categories);
  
  // Define categories for visibility check (same as LeftNavBar)
  const categories = [
    { title: 'OpsRoom' },
    { title: 'Field Operations Wing' },
    { title: 'Strategic Planning and Monitoring wing' },
    { title: 'Operation Digitalization & Digital Monitoring & Evaluation Wing' },
    { title: 'Finance' },
    { title: 'ICT Wing' },
    { title: 'Inventory' },
    { title: 'Workshop' },
    { title: 'Human Resource Management' },
    { title: 'Administration Wing' },
  ];
  
  const categoryVisibility = getCategoryVisibility(userData, permissions, categories);
  const isOpsRoomUser = categoryVisibility.OpsRoom;
  const isDeveloper = isInternalDeveloper(userData);
  
  // Get user ID to track user changes
  const userId = userData?.id || null;

  // Get feature permissions from backend
  const { data: featurePermissionsData = {} } = useGetMyPermissionsQuery(undefined, {
    skip: !userId,
  });

  // Check feature permissions
  // Backend returns permissions as: { categories: {...}, paths: {...}, features: {...} }
  // Features are returned as: { featureCode: true/false }
  const checkFeatureAccess = (featureCode) => {
    if (isDeveloper) return true;
    if (!featurePermissionsData || typeof featurePermissionsData !== 'object') return false;
    
    // Check features object first (new format)
    if (featurePermissionsData.features && featurePermissionsData.features[featureCode] === true) {
      return true;
    }
    
    // Also check categories for backward compatibility (old format)
    const categories = featurePermissionsData.categories || featurePermissionsData;
    for (const category in categories) {
      if (category === 'paths' || category === 'features') continue; // Skip these keys
      const categoryData = categories[category];
      if (Array.isArray(categoryData) && categoryData.includes(featureCode)) {
        return true;
      }
    }
    return false;
  };

  const hasAdhocPlansFeature = checkFeatureAccess(FEATURE_CODES.WORKFLOW_ACTION_ADHOC_PLANS);
  const hasRescheduleRequestsFeature = checkFeatureAccess(FEATURE_CODES.WORKFLOW_ACTION_RESCHEDULE_REQUESTS);
  const hasManagerApprovalFeature = checkFeatureAccess(FEATURE_CODES.WORKFLOW_ACTION_MANAGER_APPROVAL);
  const hasResourceAssignmentCardFeature = checkFeatureAccess(
    FEATURE_CODES.WORKFLOW_ACTION_RESOURCE_ASSIGNMENT
  );
  const hasPendingPaymentFeature = checkFeatureAccess(FEATURE_CODES.WORKFLOW_ACTION_PENDING_PAYMENT);
  const hasDroneUnlockingFeature = checkFeatureAccess(FEATURE_CODES.WORKFLOW_ACTION_DRONE_UNLOCKING);
  const hasOpsAssignmentFeature = checkFeatureAccess(FEATURE_CODES.WORKFLOW_ACTION_OPS_ASSIGNMENT);
  const hasDayEndCardFeature = checkFeatureAccess(FEATURE_CODES.WORKFLOW_ACTION_DAY_END);
  const hasDjiMapUploadFeature = checkFeatureAccess(FEATURE_CODES.WORKFLOW_ACTION_DJI_MAP_UPLOAD);
  const showPlanRequestsCard = hasAdhocPlansFeature || hasRescheduleRequestsFeature;

  // Fetch notifications for all users (no feature gate)
  const { data: unreadCountData, refetch: refetchUnreadCount } = useGetUnreadCountQuery(undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  const unreadCount = unreadCountData?.data?.count || 0;
  
  // Fetch all notifications (both read and unread) - get enough to ensure we have unread ones
  // We'll sort and filter on the frontend to show unread first, then latest 3
  const { data: allNotificationsData, refetch: refetchAllNotifications } = useGetNotificationsQuery(
    {}, // No filters - get all notifications (read and unread)
    {}
  );
  
  // For the modal, fetch all notifications separately
  const { data: modalNotificationsData, refetch: refetchModalNotifications } = useGetNotificationsQuery(
    {}, // No filters - get all notifications (read and unread)
    { skip: !showNotificationsModal }
  );
  
  // Refetch notifications when user changes (userId changes) or when unreadCount changes
  useEffect(() => {
    if (userId) {
      refetchUnreadCount();
      refetchAllNotifications();
      if (showNotificationsModal) {
        refetchModalNotifications();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, unreadCount]); // Refetch when user ID or unread count changes
  
  const [markAsRead] = useMarkNotificationAsDisplayedMutation();
  const [logNotificationAction] = useLogNotificationActionMutation();
  
  // Helper function to parse date and time for sorting
  const parseDateTime = (notification) => {
    const date = notification.date ? (notification.date.includes('T') ? notification.date.split('T')[0] : notification.date) : '';
    const time = notification.time || '00:00:00';
    return `${date} ${time}`;
  };
  
  // Sort all notifications: unread first, then by time (latest first), then take top 3
  const allNotificationsRaw = allNotificationsData?.data || [];
  const sortedAllNotifications = [...allNotificationsRaw].sort((a, b) => {
    // First, prioritize unread (displayed === 0) over read (displayed === 1)
    const aDisplayed = a.displayed === 0 || a.displayed === '0' ? 0 : 1;
    const bDisplayed = b.displayed === 0 || b.displayed === '0' ? 0 : 1;
    
    if (aDisplayed !== bDisplayed) {
      return aDisplayed - bDisplayed; // 0 (unread) comes before 1 (read)
    }
    
    // If both have same read status, sort by time (latest first)
    const datetimeA = parseDateTime(a);
    const datetimeB = parseDateTime(b);
    
    return datetimeB.localeCompare(datetimeA);
  });
  
  const todayYmd = new Date().toISOString().split('T')[0];
  const todayNotifications = sortedAllNotifications.filter((n) => {
    if (!n.date) return false;
    let d = String(n.date);
    if (d.includes('T')) d = d.split('T')[0];
    return d === todayYmd;
  });
  
  // For modal: sort all notifications with unread first, then by time (latest first)
  const modalNotificationsRaw = modalNotificationsData?.data || [];
  const allNotifications = [...modalNotificationsRaw].sort((a, b) => {
    // First, prioritize unread (displayed === 0) over read (displayed === 1)
    const aDisplayed = a.displayed === 0 || a.displayed === '0' ? 0 : 1;
    const bDisplayed = b.displayed === 0 || b.displayed === '0' ? 0 : 1;
    
    if (aDisplayed !== bDisplayed) {
      return aDisplayed - bDisplayed; // 0 (unread) comes before 1 (read)
    }
    
    // If both have same read status, sort by time (latest first)
    const datetimeA = parseDateTime(a);
    const datetimeB = parseDateTime(b);
    
    return datetimeB.localeCompare(datetimeA);
  });
  
  // Format notification date and time
  const formatNotificationDateTime = (date, time) => {
    if (!date) return '';
    
    // If date is in ISO format (2025-12-18T18:30:00.000Z), extract just the date part
    let formattedDate = date;
    if (date.includes('T')) {
      formattedDate = date.split('T')[0];
    }
    
    // Combine date and time
    return time ? `${formattedDate} ${time}` : formattedDate;
  };
  
  const handleMarkAsRead = async (notificationId) => {
    try {
      await markAsRead(notificationId).unwrap();
      if (isOpsRoomUser) {
        // Refetch unread count and all notifications
        await refetchUnreadCount();
        refetchAllNotifications();
        // Refetch modal notifications if modal is open
        if (showNotificationsModal) {
          refetchModalNotifications();
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  const handleShowAll = async () => {
    // Log the "Show All" action
    try {
      await logNotificationAction({
        action: 'show_all',
        additionalData: {
          unreadCount: unreadCount,
          totalNotifications: allNotifications.length
        }
      }).unwrap();
    } catch (error) {
      console.error('Error logging show all action:', error);
      // Don't block the action if logging fails
    }
    
    setShowNotificationsModal(true);
    // The query will automatically fetch when skip becomes false
  };

  // Get tomorrow's date for manager approval queue
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  // Get today's date for resource assignment queue
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  // Use React Query to fetch counts with intelligent caching and deduplication
  const { data: counts, refetch: refetchCounts } = useQuery({
    queryKey: ['workflowDashboard', 'counts'],
    queryFn: async () => {
      const tomorrowDate = getTomorrowDate();
      const todayDate = getTodayDate();
      // Fetch all counts in parallel (faster than sequential)
      const [plansResult, todayPlansResult] = await Promise.all([
        dispatch(baseApi.endpoints.getPlansByDate.initiate(tomorrowDate)),
        dispatch(baseApi.endpoints.getPlansByDate.initiate(todayDate)),
      ]);
      const plansData = plansResult.data;
      const todayPlansData = todayPlansResult.data;

      const parsePlansArray = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data === 'object' && data.status === 'true') {
          return Object.keys(data)
            .filter(key => !isNaN(key) && key !== 'status' && key !== 'count')
            .map(key => data[key]);
        }
        if (typeof data === 'object') {
          return Object.keys(data)
            .filter(key => !isNaN(key))
            .map(key => data[key]);
        }
        return [];
      };

      // Filter plans for manager approval: activated=1 AND manager_approval=0
      const plansArray = parsePlansArray(plansData);
      let managerApprovalCount = 0;
      
      if (plansArray.length > 0) {
        managerApprovalCount = plansArray.filter(plan => {
          const activated = Number(plan.activated) === 1 || plan.activated === '1';
          const managerApproval = Number(plan.manager_approval) === 0 || 
                                  plan.manager_approval === '0' || 
                                  plan.manager_approval === null ||
                                  plan.manager_approval === undefined;
          return activated && managerApproval;
        }).length;
      }

      // Count today's active plans with no operator assigned
      const todayPlansArray = parsePlansArray(todayPlansData);
      let opsAssignPendingCount = 0;
      if (todayPlansArray.length > 0) {
        opsAssignPendingCount = todayPlansArray.filter(plan => {
          const activated = Number(plan.activated) === 1 || plan.activated === '1';
          const noOperator = !plan.operator;
          return activated && noOperator;
        }).length;
      }

      // Process and return the counts
      return {
        managerApproval: managerApprovalCount,
        opsAssignPending: opsAssignPendingCount,
      };
    },
    enabled: Boolean(userId && (hasManagerApprovalFeature || hasOpsAssignmentFeature)),
    staleTime: 2 * 60 * 1000, // 2 minutes - data is fresh for 2 minutes
    gcTime: 2 * 60 * 1000, // 2 minutes - keep in cache for 2 minutes
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes (max refresh interval)
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
    refetchOnMount: false, // Don't refetch on component remount if data is fresh
    retry: 2, // Retry 2 times on failure (helps with 429 errors)
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 1s, 2s, 4s (helps with rate limiting)
      return Math.min(1000 * 2 ** attemptIndex, 10000);
    },
  });

  // Get pending payment missions count
  const { data: pendingPaymentData, refetch: refetchPendingPayment } = useGetMissionsPendingPaymentQuery(
    undefined,
    { skip: !userId || !hasPendingPaymentFeature }
  );
  const pendingPaymentCount = pendingPaymentData?.data?.length || 0;

  // Get drone unlocking queue count
  const { data: droneUnlockingData, refetch: refetchDroneUnlocking } = useGetDroneUnlockingQueueQuery(
    undefined,
    { skip: !userId || !hasDroneUnlockingFeature }
  );
  const droneUnlockingCount = (droneUnlockingData?.data?.plans?.length || 0) +
                              (droneUnlockingData?.data?.missions?.length || 0);

  // Get plans pending day end process count
  const { data: dayEndProcessData, refetch: refetchDayEndProcess } = useGetPlansPendingDayEndCountQuery(
    undefined,
    { skip: !userId || !hasDayEndCardFeature }
  );
  const dayEndProcessCount = dayEndProcessData?.data?.count || 0;

  // Get DJI images uploaded today count
  const { data: djiImagesCountData, refetch: refetchDjiImages } = useGetTodayDjiImagesCountQuery(
    undefined,
    { skip: !userId || !hasDjiMapUploadFeature }
  );
  const djiImagesCount = djiImagesCountData?.data?.count || 0;

  // Get resource assignment count for tomorrow
  const tomorrowDate = getTomorrowDate();
  const { data: resourceAssignmentData, refetch: refetchResourceAssignment } = useGetResourceAssignmentCountQuery(
    tomorrowDate,
    { skip: !userId || !hasResourceAssignmentCardFeature }
  );
  const resourceAssignmentCount = resourceAssignmentData?.data?.total || 0;

  const { data: plantationPlanReschedulePayload, refetch: refetchPlantationPlanRescheduleCount } =
    useGetPlantationPlanRescheduleRequestsPendingCountQuery(undefined, {
      pollingInterval: 120000,
      skip: !userId || !hasRescheduleRequestsFeature,
    });
  const plantationPlanRescheduleCount = Number(plantationPlanReschedulePayload?.data?.count ?? 0);

  const { data: plantationPlanRequestPayload, refetch: refetchPlantationPlanRequestCount } =
    useGetPlantationPlanRequestsPendingCountQuery(undefined, {
      pollingInterval: 120000,
      skip: !userId || !hasAdhocPlansFeature,
    });
  const plantationPlanRequestCount = Number(plantationPlanRequestPayload?.data?.count ?? 0);

  // Refresh all counts handler
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      // Refetch all queries in parallel
      await Promise.all([
        ...(hasManagerApprovalFeature || hasOpsAssignmentFeature ? [refetchCounts()] : []),
        ...(hasPendingPaymentFeature ? [refetchPendingPayment()] : []),
        ...(hasDroneUnlockingFeature ? [refetchDroneUnlocking()] : []),
        ...(hasDayEndCardFeature ? [refetchDayEndProcess()] : []),
        ...(hasDjiMapUploadFeature ? [refetchDjiImages()] : []),
        ...(hasAdhocPlansFeature ? [refetchPlantationPlanRequestCount()] : []),
        ...(hasRescheduleRequestsFeature ? [refetchPlantationPlanRescheduleCount()] : []),
        ...(hasResourceAssignmentCardFeature ? [refetchResourceAssignment()] : []),
      ]);
    } catch (error) {
      console.error('Error refreshing counts:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh all counts when component mounts or when navigating back to this page
  useEffect(() => {
    // Refetch all queries when the component mounts or when location changes to this page
    const refreshAllData = async () => {
      try {
        await Promise.all([
          ...(hasManagerApprovalFeature || hasOpsAssignmentFeature ? [refetchCounts()] : []),
          ...(hasPendingPaymentFeature ? [refetchPendingPayment()] : []),
          ...(hasDroneUnlockingFeature ? [refetchDroneUnlocking()] : []),
          ...(hasDayEndCardFeature ? [refetchDayEndProcess()] : []),
          ...(hasDjiMapUploadFeature ? [refetchDjiImages()] : []),
          ...(hasAdhocPlansFeature ? [refetchPlantationPlanRequestCount()] : []),
          ...(hasRescheduleRequestsFeature ? [refetchPlantationPlanRescheduleCount()] : []),
          ...(hasResourceAssignmentCardFeature ? [refetchResourceAssignment()] : []),
        ]);
      } catch (error) {
        console.error('Error auto-refreshing counts:', error);
      }
    };

    // Only refresh if we're on the workflow dashboard route
    if (routerLocation.pathname === '/home/workflowDashboard') {
      refreshAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    routerLocation.pathname,
    hasManagerApprovalFeature,
    hasOpsAssignmentFeature,
    hasPendingPaymentFeature,
    hasDroneUnlockingFeature,
    hasDayEndCardFeature,
    hasDjiMapUploadFeature,
    hasAdhocPlansFeature,
    hasRescheduleRequestsFeature,
    hasResourceAssignmentCardFeature,
  ]);

  // Extract counts with fallback to 0
  const adhocCount = plantationPlanRequestCount;
  const rescheduleCount = plantationPlanRescheduleCount;
  const managerApprovalCount = counts?.managerApproval || 0;
  const opsAssignCount = counts?.opsAssignPending || 0;

  const todayDisplay = new Date(`${todayYmd}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const actionMetricCards = [
    {
      title: 'Plantation manager approval',
      subtitle: 'Tomorrow — pending manager sign-off',
      count: managerApprovalCount,
      unit: 'plans',
      path: '/home/managerApprovalQueue',
      icon: FaUserCheck,
      featureCode: FEATURE_CODES.WORKFLOW_ACTION_MANAGER_APPROVAL,
    },
    {
      title: 'Resource assignment',
      subtitle: 'Tomorrow — items to assign',
      count: resourceAssignmentCount,
      unit: 'items',
      path: '/home/pilotAssignment',
      icon: FaTruck,
      featureCode: FEATURE_CODES.WORKFLOW_ACTION_RESOURCE_ASSIGNMENT,
    },
    {
      title: 'Pending payment',
      subtitle: 'Missions awaiting payment',
      count: pendingPaymentCount,
      unit: 'missions',
      path: '/home/pendingPaymentQueue',
      icon: FaCreditCard,
      featureCode: FEATURE_CODES.WORKFLOW_ACTION_PENDING_PAYMENT,
    },
    {
      title: 'Drone unlocking',
      subtitle: 'Plans & missions in queue',
      count: droneUnlockingCount,
      unit: 'items',
      path: '/home/droneUnlockingQueue',
      icon: FaUnlock,
      featureCode: FEATURE_CODES.WORKFLOW_ACTION_DRONE_UNLOCKING,
    },
    {
      title: 'Ops assignment',
      subtitle: 'Today — active plans without operator',
      count: opsAssignCount,
      unit: 'items',
      path: '/home/opsAsign',
      icon: FaTasks,
      featureCode: FEATURE_CODES.WORKFLOW_ACTION_OPS_ASSIGNMENT,
    },
    {
      title: 'Day end process',
      subtitle: 'Plans pending day end',
      count: dayEndProcessCount,
      unit: 'plans',
      path: '/home/dayEndProcess',
      icon: FaCalendarDay,
      featureCode: FEATURE_CODES.WORKFLOW_ACTION_DAY_END,
    },
    {
      title: 'DJI map upload',
      subtitle: 'Maps uploaded today',
      count: djiImagesCount,
      unit: 'maps',
      path: '/home/djiMapUpload',
      icon: FaMapMarkedAlt,
      featureCode: FEATURE_CODES.WORKFLOW_ACTION_DJI_MAP_UPLOAD,
    },
  ];

  const quickAccessItems = [
    {
      label: 'Plan calendar',
      description: 'Schedule & browse plans',
      path: '/home/opsroomPlanCalendar',
      icon: FaCalendarAlt,
      featureCode: FEATURE_CODES.WORKFLOW_QUICK_PLAN_CALENDAR,
    },
    {
      label: "Today's plans",
      description: "Today's operational view",
      path: '/home/todayPlans',
      icon: FaClipboardList,
      featureCode: FEATURE_CODES.WORKFLOW_QUICK_TODAYS_PLANS,
    },
    {
      label: 'Emergency moving',
      description: 'Reassign or move plans',
      path: '/home/emergencyMoving',
      icon: FaBolt,
      featureCode: FEATURE_CODES.WORKFLOW_QUICK_EMERGENCY_MOVING,
    },
    {
      label: 'Field history',
      description: 'Past field activity',
      path: '/home/fieldHistory',
      icon: FaHistory,
      featureCode: FEATURE_CODES.WORKFLOW_QUICK_FIELD_HISTORY,
    },
    {
      label: 'Reports',
      description: 'Ops reporting',
      path: '/home/reports/ops',
      icon: FaChartBar,
      featureCode: FEATURE_CODES.WORKFLOW_QUICK_REPORTS,
    },
    {
      label: 'Field size adjustments',
      description: 'Area corrections',
      path: '/home/fieldSizeAdjustments',
      icon: FaRulerCombined,
      featureCode: FEATURE_CODES.WORKFLOW_QUICK_FIELD_SIZE_ADJUSTMENTS,
    },
    {
      label: 'Plan Customization',
      description: 'Customize plans',
      path: '/home/planCustomization',
      icon: FaCogs,
      featureCode: FEATURE_CODES.WORKFLOW_QUICK_PLAN_CUSTOMIZATION,
    },
  ];

  return (
    <div className="workflow-dashboard-workflowDashboard">
      {/* Notifications Modal */}
      {showNotificationsModal && (
        <div className="notifications-modal-overlay-workflowDashboard" onClick={() => setShowNotificationsModal(false)}>
          <div className="notifications-modal-workflowDashboard" onClick={(e) => e.stopPropagation()}>
            <div className="notifications-modal-header-workflowDashboard">
              <h2>All Notifications</h2>
              <button
                className="notifications-modal-close-workflowDashboard"
                onClick={() => setShowNotificationsModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="notifications-modal-body-workflowDashboard">
              {allNotifications.length > 0 ? (
                <div className="notifications-modal-list-workflowDashboard">
                  {allNotifications.map((notification) => (
                    <div key={notification.id} className="notification-modal-item-workflowDashboard">
                      <div className="notification-modal-content-workflowDashboard">
                        <p className="notification-modal-description-workflowDashboard">{notification.description}</p>
                        <div className="notification-modal-meta-workflowDashboard">
                          <span className="notification-modal-date-workflowDashboard">
                            {formatNotificationDateTime(notification.date, notification.time)}
                          </span>
                        </div>
                      </div>
                      {notification.displayed === 0 ? (
                        <button
                          className="notification-modal-read-btn-workflowDashboard"
                          onClick={() => handleMarkAsRead(notification.id)}
                          title="Mark as read"
                        >
                          <FaEnvelope className="unread-icon-modal-workflowDashboard" /> Mark as Read
                        </button>
                      ) : (
                        <div className="notification-modal-read-indicator-workflowDashboard" title="Already read">
                          <FaEnvelopeOpen className="read-icon-modal-workflowDashboard" /> Read
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-notifications-modal-workflowDashboard">
                  <p>No notifications found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="wf-dashboard-shell-workflowDashboard">
        <aside className="wf-notifications-aside-workflowDashboard" aria-label="Today's notifications">
            <div className="wf-notifications-aside-card-workflowDashboard">
              <div className="wf-notifications-aside-head-workflowDashboard">
                <div>
                  <h2 className="wf-aside-title-workflowDashboard">
                    <FaBell className="wf-aside-bell-workflowDashboard" aria-hidden />
                    {"Today's notifications"}
                  </h2>
                  <p className="wf-aside-date-workflowDashboard">{todayDisplay}</p>
                </div>
                <button type="button" className="wf-aside-viewall-workflowDashboard" onClick={handleShowAll}>
                  View all
                </button>
              </div>
              {unreadCount > 0 ? (
                <div className="wf-unread-strip-workflowDashboard">
                  <span className="wf-unread-dot-workflowDashboard" aria-hidden />
                  {unreadCount} unread across all dates
                </div>
              ) : null}
              <div className="wf-notifications-scroll-workflowDashboard">
                {todayNotifications.length > 0 ? (
                  todayNotifications.map((notification) => {
                    const isRead = notification.displayed === 1;
                    return (
                      <div key={notification.id} className="wf-notify-row-workflowDashboard">
                        <div className="wf-notify-row-main-workflowDashboard">
                          <p className="wf-notify-text-workflowDashboard">{notification.description}</p>
                          <span className="wf-notify-meta-workflowDashboard">
                            {formatNotificationDateTime(notification.date, notification.time)}
                          </span>
                        </div>
                        {isRead ? (
                          <div className="wf-notify-status-workflowDashboard" title="Read">
                            <FaEnvelopeOpen className="wf-notify-icon-read-workflowDashboard" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="wf-notify-mark-read-workflowDashboard"
                            onClick={() => handleMarkAsRead(notification.id)}
                            title="Mark as read"
                          >
                            <FaEnvelope className="wf-notify-icon-unread-workflowDashboard" />
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="wf-notifications-empty-workflowDashboard">
                    <p>No notifications dated today.</p>
                    <p className="wf-notifications-empty-hint-workflowDashboard">Use “View all” for the full inbox.</p>
                  </div>
                )}
              </div>
            </div>
        </aside>

        <div className="wf-main-column-workflowDashboard">
          <section className="wf-panel-workflowDashboard wf-panel--action-workflowDashboard">
            <div className="wf-panel-head-workflowDashboard">
              <div>
                <h2 className="wf-panel-title-workflowDashboard">Action needed</h2>
                <p className="wf-panel-subtitle-workflowDashboard">Operational queues — select a card to open the screen</p>
              </div>
              <button
                type="button"
                className="wf-refresh-btn-workflowDashboard"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                title="Refresh all counts"
              >
                <FaSync className={isRefreshing ? 'wf-refresh-spin-workflowDashboard' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="wf-action-cards-grid-workflowDashboard">
              {showPlanRequestsCard ? (
                <div className="wf-nested-queue-card-workflowDashboard">
                  <div className="wf-nested-queue-head-workflowDashboard">
                    <FaInbox className="wf-nested-queue-icon-workflowDashboard" aria-hidden />
                    <div>
                      <span className="wf-nested-queue-title-workflowDashboard">Plan requests</span>
                      <span className="wf-nested-queue-sub-workflowDashboard">Requests queue</span>
                    </div>
                  </div>
                  {hasAdhocPlansFeature ? (
                    <button
                      type="button"
                      className="wf-nested-queue-row-workflowDashboard"
                      onClick={() => go('/home/requestsQueue')}
                      aria-label={`Ad-hoc plans, ${adhocCount} pending`}
                    >
                      <span className="wf-nested-queue-label-workflowDashboard">Ad-hoc plans</span>
                      <span className="wf-nested-queue-meta-workflowDashboard">
                        <span className="wf-count-pill-workflowDashboard">{adhocCount}</span>
                        <FaChevronRight className="wf-chevron-workflowDashboard" aria-hidden />
                      </span>
                    </button>
                  ) : null}
                  {hasRescheduleRequestsFeature ? (
                    <button
                      type="button"
                      className="wf-nested-queue-row-workflowDashboard"
                      onClick={() => go('/home/requestsQueue')}
                      aria-label={`Reschedule requests, ${rescheduleCount} pending`}
                    >
                      <span className="wf-nested-queue-label-workflowDashboard">Reschedule requests</span>
                      <span className="wf-nested-queue-meta-workflowDashboard">
                        <span className="wf-count-pill-workflowDashboard">{rescheduleCount}</span>
                        <FaChevronRight className="wf-chevron-workflowDashboard" aria-hidden />
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {actionMetricCards
                .filter((c) => checkFeatureAccess(c.featureCode))
                .map(({ title, subtitle, count, unit, path, icon: Icon }) => (
                <button
                  key={path}
                  type="button"
                  className="wf-metric-card-workflowDashboard"
                  onClick={() => go(path)}
                  aria-label={`${title}, ${count} ${unit}`}
                >
                  <span className="wf-metric-icon-wrap-workflowDashboard" aria-hidden>
                    <Icon className="wf-metric-icon-workflowDashboard" />
                  </span>
                  <span className="wf-metric-body-workflowDashboard">
                    <span className="wf-metric-title-workflowDashboard">{title}</span>
                    <span className="wf-metric-sub-workflowDashboard">{subtitle}</span>
                  </span>
                  <span className="wf-metric-right-workflowDashboard">
                    <span className="wf-count-pill-workflowDashboard wf-count-pill--emphasis-workflowDashboard">{count}</span>
                    <FaChevronRight className="wf-chevron-workflowDashboard" aria-hidden />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="wf-panel-workflowDashboard wf-panel--quick-workflowDashboard">
            <h3 className="wf-quick-section-title-workflowDashboard">Quick access</h3>
            <p className="wf-quick-section-sub-workflowDashboard">Shortcuts to common workflow tools</p>
            <div className="wf-quick-grid-workflowDashboard">
              {quickAccessItems
                .filter(({ featureCode }) => checkFeatureAccess(featureCode))
                .map(({ label, description, path, icon: Icon }) => (
                  <button
                    key={path}
                    type="button"
                    className="wf-quick-card-workflowDashboard"
                    onClick={() => go(path)}
                    aria-label={label}
                  >
                    <span className="wf-quick-icon-wrap-workflowDashboard" aria-hidden>
                      <Icon className="wf-quick-icon-workflowDashboard" />
                    </span>
                    <span className="wf-quick-text-workflowDashboard">
                      <span className="wf-quick-label-workflowDashboard">{label}</span>
                      <span className="wf-quick-desc-workflowDashboard">{description}</span>
                    </span>
                    <FaChevronRight className="wf-quick-chevron-workflowDashboard" aria-hidden />
                  </button>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDashboard;



