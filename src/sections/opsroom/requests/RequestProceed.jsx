import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bars } from 'react-loader-spinner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, parse } from 'date-fns';
import {
  useGetBookingCreationMissionTypesQuery,
  useGetBookingCreationCropTypesQuery,
} from '../../../api/services NodeJs/bookingCreationApi';
import {
  useGetPlantationPlanRequestsListQuery,
  useDeclinePlantationPlanRequestMutation,
  useApprovePlantationPlanRequestMutation,
  useGetPlantationPlanRescheduleRequestsListQuery,
  useApprovePlantationPlanRescheduleRequestMutation,
  useDeclinePlantationPlanRescheduleRequestMutation,
} from '../../../api/services NodeJs/plantationDashboardApi';
import { useLazyGetOpsroomPlansByDateRangeQuery } from '../../../api/services NodeJs/opsroomPlanCalendarApi';
import { useCreateAdHocNotificationMutation, useCreateRescheduleNotificationMutation, useCreatePlanApprovalNotificationMutation } from '../../../api/services NodeJs/notificationsApi';
import { withCurrentWingSearch } from '../../../config/wingRouteGuard';
import {
  originalRequestedSlots,
  mapPlantationRowToAdhocTile,
  approvePlantationPlanRequest,
  declinePlantationPlanRequest as submitPlantationPlanRequestDecline,
  missionCodeLabel,
} from '../plantation-plan-requests/plantationPlanRequestApproval';
import {
  mapRescheduleRowToTile,
  approveRescheduleRequest,
  declineRescheduleRequest as submitRescheduleRequestDecline,
} from '../plantation-plan-requests/plantationPlanRescheduleApproval';
import '../../../styles/requestProceed.css';

/** Same PHP-shaped payload as Plan Calendar (`status` + numeric keys). */
function parseOpsroomPlansGroupedByDate(apiData) {
  const grouped = {};
  if (!apiData || (apiData.status !== 'true' && apiData.status !== true)) {
    return grouped;
  }
  Object.keys(apiData)
    .filter((k) => !Number.isNaN(Number(k)))
    .forEach((k) => {
      const item = apiData[k];
      const dateKey = item?.date;
      if (!dateKey) return;
      // Adhoc proceed calendar: active plans only (same as Plan Calendar activatedOnly)
      if (Number(item?.activated) !== 1) return;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    });
  return grouped;
}

function applyEstateHighlight(grouped, estateId) {
  if (estateId == null || estateId === '') return grouped;
  const highlightId = Number(estateId);
  if (!Number.isFinite(highlightId)) return grouped;
  const out = {};
  Object.entries(grouped).forEach(([dateKey, plans]) => {
    out[dateKey] = plans.map((plan) => ({
      ...plan,
      is_request_estate:
        Number(plan.estate_id ?? plan.estateId) === highlightId ? 1 : 0,
    }));
  });
  return out;
}

function planMissionLabel(plan) {
  return plan.mission_type_name || missionCodeLabel(plan.mission_type_id);
}

const RequestProceed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [requestType, setRequestType] = useState('adhoc'); // 'adhoc' or 'reschedule'
  
  // Notification mutations
  const [createAdHocNotification] = useCreateAdHocNotificationMutation();
  const [createRescheduleNotification] = useCreateRescheduleNotificationMutation();
  const [createPlanApprovalNotification] = useCreatePlanApprovalNotificationMutation();
  const [declinePlanRequestMutation] = useDeclinePlantationPlanRequestMutation();
  const [approveAdhocMutation] = useApprovePlantationPlanRequestMutation();
  const [fetchOpsCalendarPlans] = useLazyGetOpsroomPlansByDateRangeQuery();
  const [approveRescheduleMutation] = useApprovePlantationPlanRescheduleRequestMutation();
  const [declineRescheduleMutation] = useDeclinePlantationPlanRescheduleRequestMutation();

  const {
    data: plantationRows,
    isLoading: adhocLoading,
    isError: adhocQueryError,
    refetch: refetchPlantationRequests,
  } = useGetPlantationPlanRequestsListQuery({ status: 'pending' });
  const { data: missionTypesRaw } = useGetBookingCreationMissionTypesQuery();
  const { data: cropTypesRaw } = useGetBookingCreationCropTypesQuery();

  const adhocData = useMemo(() => {
    const rows = Array.isArray(plantationRows) ? plantationRows : [];
    const requests = rows
      .map((row) =>
        mapPlantationRowToAdhocTile(row, {
          missionTypes: missionTypesRaw,
          cropTypes: cropTypesRaw,
        })
      )
      .filter(Boolean);
    return { requests, request_count: requests.length };
  }, [plantationRows, missionTypesRaw, cropTypesRaw]);

  const adhocError = adhocQueryError ? 'Failed to load ad-hoc requests' : '';

  const {
    data: rescheduleRows,
    isLoading: rescheduleLoading,
    isError: rescheduleQueryError,
    refetch: refetchRescheduleRequests,
  } = useGetPlantationPlanRescheduleRequestsListQuery({ status: 'pending' });

  const rescheduleData = useMemo(() => {
    const rows = Array.isArray(rescheduleRows) ? rescheduleRows : [];
    const requests = rows.map((row) => mapRescheduleRowToTile(row)).filter(Boolean);
    return { requests };
  }, [rescheduleRows]);

  const rescheduleError = rescheduleQueryError ? 'Failed to load reschedule requests' : '';
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [planCount, setPlanCount] = useState(1);
  
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansByDate, setPlansByDate] = useState({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const normalizeId = (id) => (id !== null && id !== undefined ? String(id) : null);

  const getCurrentUserId = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      return userData?.id || null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  const monthRange = useMemo(() => {
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    return { start, end };
  }, [currentMonth]);

  useEffect(() => {
    // Get request data from location state if passed
    const requestId = location.state?.requestId;
    const type = location.state?.requestType || 'adhoc';
    
    if (requestId !== undefined && requestId !== null) {
      setSelectedRequestId(normalizeId(requestId));
    }
    if (type) {
      setRequestType(type);
    }
  }, [location]);

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const formatDates = (datesString) => {
    if (!datesString) return 'N/A';
    return datesString.split(',').map(d => d.trim()).join(', ');
  };

  // Helper to get estate name for modal
  const getEstateName = () => {
    if (requestType === 'reschedule') {
      return selectedRescheduleRequest?.estate || 'N/A';
    }
    return selectedAdhocRequest?.estate || 'N/A';
  };

  const handleCreateClick = () => {
    if (!selectedDate) {
      setErrorMessage('Please select a date from the calendar');
      setShowError(true);
      return;
    }
    if (!selectedRequestId) {
      setErrorMessage('Please select a request');
      setShowError(true);
      return;
    }
    setShowCreateConfirm(true);
  };

  const handleCreatePlan = async () => {
    setShowCreateConfirm(false);
    setIsSubmitting(true);
    try {
      if (!selectedDate) {
        setErrorMessage('Please select a date from the calendar');
        setShowError(true);
        setIsSubmitting(false);
        return;
      }
      if (!selectedRequestId) {
        setErrorMessage('Please select a request');
        setShowError(true);
        setIsSubmitting(false);
        return;
      }

      const dateFormatted = format(selectedDate, 'yyyy-MM-dd');
      const parsedRequestId = selectedRequestId ? Number(selectedRequestId) : null;
      const apiRequestId =
        parsedRequestId !== null && !Number.isNaN(parsedRequestId) ? parsedRequestId : selectedRequestId;

      if (requestType === 'reschedule') {
        const row = selectedRescheduleRequest?._rescheduleRow || selectedRescheduleRequest;
        if (!row?.id) {
          setErrorMessage('Selected request not found');
          setShowError(true);
          return;
        }

        const approveResult = await approveRescheduleRequest({
          row,
          pickedDate: dateFormatted,
          approveMutation: approveRescheduleMutation,
        });

        if (approveResult.ok) {
          setSuccessMessage('Plan rescheduled successfully');
          setShowSuccess(true);
          await handlePostApproveNotifications({
            apiRequestId: row.id,
            dateFormatted,
            resultData: { status: 'true', plan_id: row.plan_id || selectedRescheduleRequest?.plan },
            selectedRequest: selectedRescheduleRequest,
          });
          const refetchResult = await refetchRescheduleRequests();
          const refreshedRows = Array.isArray(refetchResult.data) ? refetchResult.data : [];
          const stillExists = refreshedRows.some((r) => String(r.id) === selectedRequestId);
          if (!stillExists) {
            setSelectedRequestId(null);
            setSelectedDate(null);
          }
          await refreshCalendarPlans();
        } else {
          setErrorMessage(approveResult.error || 'Failed to reschedule plan');
          setShowError(true);
        }
        return;
      }

      const plantationRow = selectedAdhocRequest?._plantationRow || selectedAdhocRequest;
      if (!plantationRow?.id) {
        setErrorMessage('Selected request not found');
        setShowError(true);
        return;
      }

      const approveResult = await approvePlantationPlanRequest({
        row: plantationRow,
        planCount,
        pickedDate: dateFormatted,
        approveMutation: approveAdhocMutation,
      });

      if (approveResult.ok) {
        setSuccessMessage(
          approveResult.created === 1
            ? 'Plan created successfully'
            : `${approveResult.created} plans created successfully`
        );
        setShowSuccess(true);

        await handlePostApproveNotifications({
          apiRequestId: plantationRow.id,
          dateFormatted,
          createdPlanIds: approveResult.createdPlanIds || [],
          selectedRequest: selectedAdhocRequest,
        });

        const refetchResult = await refetchPlantationRequests();
        const refreshedRows = Array.isArray(refetchResult.data) ? refetchResult.data : [];
        const stillExists = refreshedRows.some((r) => String(r.id) === selectedRequestId);
        if (!stillExists) {
          setSelectedRequestId(null);
          setSelectedDate(null);
        }
        await refreshCalendarPlans();
      } else {
        setErrorMessage(approveResult.error || 'Failed to create plan');
        setShowError(true);
      }
    } catch (e) {
      console.error('Error creating plan:', e);
      const errorMsg =
        e?.data?.message ||
        e?.response?.data?.message ||
        e?.response?.data?.exception ||
        e?.response?.data?.error ||
        e?.message ||
        'Failed to create plan. Please try again.';
      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostApproveNotifications = async ({
    apiRequestId,
    dateFormatted,
    createdPlanIds = [],
    resultData,
    selectedRequest,
  }) => {
    try {
      if (!selectedRequest) return;

      const estateId = selectedRequest.estate_id || selectedRequest.estateId || null;
      const estateName = selectedRequest.estate || null;

      if (estateId || estateName) {
        if (requestType === 'reschedule') {
          await createRescheduleNotification({
            request_id: apiRequestId,
            estate_id: estateId || undefined,
            estate_name: estateName || undefined,
            date_planned: dateFormatted,
          })
            .unwrap()
            .catch((err) => {
              console.warn('Failed to create reschedule notification:', err);
            });
        } else {
          await createAdHocNotification({
            request_id: apiRequestId,
            estate_id: estateId || undefined,
            estate_name: estateName || undefined,
            date_planned: dateFormatted,
          })
            .unwrap()
            .catch((err) => {
              console.warn('Failed to create ad-hoc notification:', err);
            });
        }
      }

      try {
        const planIdsFromApprove = Array.isArray(createdPlanIds) ? createdPlanIds.filter(Boolean) : [];
        let planId =
          planIdsFromApprove[0] ||
          resultData?.plan_id ||
          resultData?.plan ||
          resultData?.id ||
          selectedRequest?.plan_id ||
          selectedRequest?.plan ||
          null;

        if (planId) {
          const currentUserId = getCurrentUserId();
          if (currentUserId) {
            await createPlanApprovalNotification({
              plan_id: planId,
              approved_by_user_id: currentUserId,
            })
              .unwrap()
              .catch((err) => {
                console.warn('Failed to create plan approval notification:', err);
              });
          }
        }
      } catch (planApprovalError) {
        console.error('Error creating plan approval notification:', planApprovalError);
      }
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
    }
  };

  const refreshCalendarPlans = async () => {
    const range = {
      start: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
      end: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
    };
    const req = requestType === 'reschedule' ? selectedRescheduleRequest : selectedAdhocRequest;
    const estateId = req?.estate_id ?? req?.estateId ?? null;
    try {
      const result = await fetchOpsCalendarPlans({
        startDate: range.start,
        endDate: range.end,
      });
      if (result.error) {
        console.error('Failed to refresh calendar data:', result.error);
        return;
      }
      const grouped = applyEstateHighlight(parseOpsroomPlansGroupedByDate(result.data), estateId);
      setPlansByDate(grouped);
    } catch (e) {
      console.error('Failed to refresh calendar data:', e);
    }
  };

  const handleDeclineClick = () => {
    if (!selectedRequestId) {
      setErrorMessage('Please select a request');
      setShowError(true);
      return;
    }
    setShowDeclineConfirm(true);
  };

  const handleDeclinePlan = async () => {
    setShowDeclineConfirm(false);
    setIsSubmitting(true);
    try {
      if (!selectedRequestId) {
        setErrorMessage('Please select a request');
        setShowError(true);
        setIsSubmitting(false);
        return;
      }

      const parsedRequestId = selectedRequestId ? Number(selectedRequestId) : null;
      const apiRequestId =
        parsedRequestId !== null && !Number.isNaN(parsedRequestId) ? parsedRequestId : selectedRequestId;

      if (requestType === 'reschedule') {
        await submitRescheduleRequestDecline({
          id: apiRequestId,
          declineMutation: declineRescheduleMutation,
        });

        setSuccessMessage('Request declined successfully');
        setShowSuccess(true);
        setSelectedRequestId(null);
        setSelectedDate(null);
        await refreshRescheduleListAfterDecline();
        await refreshCalendarPlans();
        return;
      }

      await submitPlantationPlanRequestDecline({
        id: apiRequestId,
        declineMutation: declinePlanRequestMutation,
      });

      setSuccessMessage('Request declined successfully');
      setShowSuccess(true);
      setSelectedRequestId(null);
      setSelectedDate(null);
      await refetchPlantationRequests();
      await refreshCalendarPlans();
    } catch (e) {
      console.error('Error declining request:', e);
      const errorMsg =
        e?.data?.message ||
        e?.response?.data?.message ||
        e?.response?.data?.exception ||
        e?.response?.data?.error ||
        e?.message ||
        'Failed to decline request. Please try again.';
      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshRescheduleListAfterDecline = async () => {
    await refetchRescheduleRequests();
  };

  const selectedAdhocRequest = useMemo(() => {
    if (!selectedRequestId || !adhocData?.requests) return null;
    return adhocData.requests.find((r) => String(r.request_id) === selectedRequestId) || null;
  }, [adhocData?.requests, selectedRequestId]);

  const selectedRescheduleRequest = useMemo(() => {
    if (!selectedRequestId || !rescheduleData?.requests) return null;
    return rescheduleData.requests.find((r) => String(r.request_id) === selectedRequestId) || null;
  }, [rescheduleData?.requests, selectedRequestId]);

  const selectedEstateId = useMemo(() => {
    const req = requestType === 'reschedule' ? selectedRescheduleRequest : selectedAdhocRequest;
    return req?.estate_id ?? req?.estateId ?? null;
  }, [requestType, selectedAdhocRequest, selectedRescheduleRequest]);

  useEffect(() => {
    let isCancelled = false;
    const loadCalendarPlans = async () => {
      setPlansLoading(true);
      try {
        const result = await fetchOpsCalendarPlans({
          startDate: monthRange.start,
          endDate: monthRange.end,
        });
        if (isCancelled) return;
        if (result.error) {
          console.error('Failed to load calendar plans data:', result.error);
          setPlansByDate({});
          return;
        }
        setPlansByDate(
          applyEstateHighlight(parseOpsroomPlansGroupedByDate(result.data), selectedEstateId)
        );
      } catch (e) {
        if (!isCancelled) console.error('Failed to load calendar plans data', e);
      } finally {
        if (!isCancelled) setPlansLoading(false);
      }
    };
    loadCalendarPlans();
    return () => {
      isCancelled = true;
    };
  }, [monthRange, selectedEstateId, fetchOpsCalendarPlans]);

  useEffect(() => {
    if (requestType !== 'adhoc' || !selectedAdhocRequest) return;

    const row = selectedAdhocRequest._plantationRow || selectedAdhocRequest;
    const slots = originalRequestedSlots(row);
    setPlanCount(slots > 0 ? slots : 1);

    const picked = String(selectedAdhocRequest.picked_date || selectedAdhocRequest.dates || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(picked)) {
      try {
        const parsedDate = parse(picked, 'yyyy-MM-dd', new Date());
        if (!Number.isNaN(parsedDate.getTime())) {
          setSelectedDate(parsedDate);
          setCurrentMonth(parsedDate);
        }
      } catch {
        // ignore invalid date
      }
    }
  }, [requestType, selectedAdhocRequest]);

  useEffect(() => {
    if (requestType !== 'reschedule' || !selectedRescheduleRequest) return;

    const requested = String(
      selectedRescheduleRequest.requested_picked_date ||
        selectedRescheduleRequest.requested_dates ||
        ''
    ).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
      try {
        const parsedDate = parse(requested, 'yyyy-MM-dd', new Date());
        if (!Number.isNaN(parsedDate.getTime())) {
          setSelectedDate(parsedDate);
          setCurrentMonth(parsedDate);
        }
      } catch {
        // ignore invalid date
      }
    }
  }, [requestType, selectedRescheduleRequest]);

  const sortedAdhocRequests = useMemo(() => {
    const requests = adhocData?.requests || [];
    if (!selectedRequestId) return requests;
    const selectedIndex = requests.findIndex((r) => String(r.request_id) === selectedRequestId);
    if (selectedIndex === -1) return requests;
    const selected = requests[selectedIndex];
    const others = requests.filter((_, idx) => idx !== selectedIndex);
    return [selected, ...others];
  }, [adhocData?.requests, selectedRequestId]);

  const sortedRescheduleRequests = useMemo(() => {
    const requests = rescheduleData?.requests || [];
    if (!selectedRequestId) return requests;
    const selectedIndex = requests.findIndex((r) => String(r.request_id) === selectedRequestId);
    if (selectedIndex === -1) return requests;
    const selected = requests[selectedIndex];
    const others = requests.filter((_, idx) => idx !== selectedIndex);
    return [selected, ...others];
  }, [rescheduleData?.requests, selectedRequestId]);
  
  const selectedRequest = requestType === 'reschedule' ? selectedRescheduleRequest : selectedAdhocRequest;

  // Parse requested dates from selected request
  const requestedDatesSet = useMemo(() => {
    if (!selectedRequest) return new Set();
    
    // Handle reschedule requests (uses requested_dates)
    if (requestType === 'reschedule' && selectedRequest.requested_dates) {
      const datesString = selectedRequest.requested_dates;
      if (!datesString) return new Set();
      const dates = datesString.split(',').map(d => d.trim()).filter(d => d);
      return new Set(dates);
    }
    
    // Handle adhoc requests (uses dates or picked_date)
    if (requestType === 'adhoc') {
      const picked = String(selectedRequest.picked_date || selectedRequest.dates || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(picked)) {
        return new Set([picked]);
      }
      if (selectedRequest.dates) {
        const dates = selectedRequest.dates.split(',').map((d) => d.trim()).filter((d) => d);
        return new Set(dates);
      }
    }
    
    return new Set();
  }, [selectedRequest, requestType]);

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const firstDayOfWeek = monthStart.getDay();
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthName = format(currentMonth, 'MMMM yyyy');
    const calendarDays = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) });

    return (
      <div className="calendar-container-req-proceed">
        <div className="calendar-header-sticky-req-proceed">
          <div className="calendar-header-req-proceed">
            <button 
              className="calendar-nav-btn-req-proceed" 
              onClick={handlePreviousMonth}
              aria-label="Previous month"
            >
              ◀
            </button>
            <h3 className="calendar-title-req-proceed">{monthName}</h3>
            <button 
              className="calendar-nav-btn-req-proceed" 
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              ▶
            </button>
          </div>

          {/* Day headers */}
          <div className="calendar-weekday-headers-req-proceed">
            {weekdayNames.map((day, index) => (
              <div key={index} className="calendar-weekday-header-req-proceed">
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Calendar grid - scrollable */}
        <div className="calendar-grid-wrapper-req-proceed">
          <div className="calendar-grid-req-proceed">
          {/* Empty spaces for days before month starts */}
          {[...Array(firstDayOfWeek)].map((_, index) => (
            <div key={`empty-${index}`} className="calendar-day-empty-req-proceed" />
          ))}

          {/* Calendar days */}
          {calendarDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayPlans = plansByDate[dayStr] || [];
            const planCount = dayPlans.length;
            const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dayStr;
            const isToday = format(new Date(), 'yyyy-MM-dd') === dayStr;
            const isRequestedDate = requestedDatesSet.has(dayStr);
            const hasRequestEstatePlans = dayPlans.some(
              (plan) => Number(plan.is_request_estate) === 1 || Number(plan.is_request_estate) === '1'
            );

            return (
              <div
                key={dayStr}
                className={`calendar-day-req-proceed ${isSelected ? 'calendar-day-selected-req-proceed' : ''} ${isToday ? 'calendar-day-today-req-proceed' : ''} ${isRequestedDate ? 'calendar-day-requested-req-proceed' : ''} ${hasRequestEstatePlans ? 'calendar-day-has-estate-plans-req-proceed' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                <div className="calendar-day-header-req-proceed">
                  <div className="calendar-day-number-req-proceed">{format(day, 'd')}</div>
                  {planCount > 0 && (
                    <div className="calendar-day-count-req-proceed">({planCount})</div>
                  )}
                </div>
                <div className="calendar-day-plans-req-proceed">
                  {dayPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`calendar-day-plan-req-proceed ${
                        Number(plan.is_request_estate) === 1 ? 'calendar-day-plan-estate-req-proceed' : ''
                      }`}
                      title={`${plan.estate} · ${planMissionLabel(plan)} · #${plan.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="calendar-day-plan-text-req-proceed">
                        {plan.estate} · {planMissionLabel(plan)} · #{plan.id}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="wrapper-req-proceed">
      <div className="header-req-proceed">
        <button 
          className="back-btn-req-proceed" 
          onClick={() => {
            if (isNavigating) return;
            setIsNavigating(true);
            navigate(withCurrentWingSearch('/home/requestsQueue', location.search));
          }} 
          disabled={isNavigating}
          aria-label="Back"
        >
          {isNavigating ? (
            <Bars height="16" width="16" color="#004b71" ariaLabel="bars-loading" visible={true} />
          ) : (
            <svg className="back-icon-req-proceed" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          )}
        </button>
        <div className="center-header-req-proceed">
          <div className="heading-req-proceed">
            {requestType === 'reschedule' ? 'Reschedule Plan Request Queue' : 'Add-hoc Plan Request Queue'}
          </div>
        </div>
      </div>

      <div className="content-container-req-proceed">
        {/* Left Side: Request List */}
        <div className="requests-column-req-proceed">
          <div className="column-header-req-proceed">
            <h2 className="column-title-req-proceed">
              {requestType === 'reschedule' ? 'Plantation Reschedule Request Queue' : 'Plantation Add-hoc Request Queue'}
            </h2>
            <span className="column-count-req-proceed">
              Plans {requestType === 'reschedule' ? (rescheduleData?.requests?.length || 0) : (adhocData?.request_count || 0)} »
            </span>
          </div>
          
          <div className="requests-list-req-proceed">
            {requestType === 'reschedule' ? (
              <>
                {rescheduleLoading && (
                  <div className="loading-req-proceed">
                    <Bars height="30" width="30" color="#003057" ariaLabel="bars-loading" visible={true} />
                    <span>Loading...</span>
                  </div>
                )}
                {rescheduleError && <div className="error-req-proceed">{rescheduleError}</div>}
                {!rescheduleLoading && !rescheduleError && (
                  <>
                    {(!rescheduleData?.requests || rescheduleData.requests.length === 0) ? (
                      <div className="empty-req-proceed">No pending requests</div>
                    ) : (
                      sortedRescheduleRequests.map((request, idx) => (
                        <div 
                          key={`${request.request_id}-${request.plan_date || 'no-date'}-${idx}`} 
                          className={`request-tile-req-proceed ${selectedRequestId === String(request.request_id) ? 'request-tile-selected-req-proceed' : ''}`}
                          onClick={() => setSelectedRequestId(normalizeId(request.request_id))}
                        >
                          <div className="tile-header-req-proceed">
                            <span className="tile-id-req-proceed">Plan #{request.plan}</span>
                            <span className="tile-status-req-proceed">
                              {request.status === 'p' ? 'Pending' : request.status}
                            </span>
                          </div>
                          <div className="tile-body-req-proceed">
                            <div className="tile-row-req-proceed">
                              <span className="tile-label-req-proceed">Estate:</span>
                              <span className="tile-value-req-proceed">{request.estate || 'N/A'}</span>
                            </div>
                            {request.plan_date && (
                              <div className="tile-row-req-proceed">
                                <span className="tile-label-req-proceed">Original date:</span>
                                <span className="tile-value-req-proceed">{request.plan_date}</span>
                              </div>
                            )}
                            <div className="tile-row-req-proceed">
                              <span className="tile-label-req-proceed">Requested date:</span>
                              <span className="tile-value-req-proceed">{formatDates(request.requested_dates)}</span>
                            </div>
                            {request.reason && (
                              <div className="tile-row-req-proceed">
                                <span className="tile-label-req-proceed">Reason:</span>
                                <span className="tile-value-req-proceed">{request.reason}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {adhocLoading && (
                  <div className="loading-req-proceed">
                    <Bars height="30" width="30" color="#003057" ariaLabel="bars-loading" visible={true} />
                    <span>Loading...</span>
                  </div>
                )}
                {adhocError && <div className="error-req-proceed">{adhocError}</div>}
                {!adhocLoading && !adhocError && (
                  <>
                    {(!adhocData?.requests || adhocData.requests.length === 0) ? (
                      <div className="empty-req-proceed">No pending requests</div>
                    ) : (
                      sortedAdhocRequests.map((request) => (
                        <div 
                          key={request.request_id} 
                          className={`request-tile-req-proceed ${selectedRequestId === String(request.request_id) ? 'request-tile-selected-req-proceed' : ''}`}
                          onClick={() => setSelectedRequestId(normalizeId(request.request_id))}
                        >
                          <div className="tile-header-req-proceed">
                            <span className="tile-id-req-proceed">Request #{request.request_id}</span>
                            <span className="tile-status-req-proceed">
                              {request.status === 'p' ? 'Pending' : request.status}
                            </span>
                          </div>
                          <div className="tile-body-req-proceed">
                            <div className="tile-row-req-proceed">
                              <span className="tile-label-req-proceed">Estate:</span>
                              <span className="tile-value-req-proceed">{request.estate || 'N/A'}</span>
                            </div>
                            {request.crop && (
                              <div className="tile-row-req-proceed">
                                <span className="tile-label-req-proceed">Crop:</span>
                                <span className="tile-value-req-proceed">{request.crop}</span>
                              </div>
                            )}
                            {request.mission_type && (
                              <div className="tile-row-req-proceed">
                                <span className="tile-label-req-proceed">Mission:</span>
                                <span className="tile-value-req-proceed">{request.mission_type}</span>
                              </div>
                            )}
                            <div className="tile-row-req-proceed">
                              <span className="tile-label-req-proceed">Requested date:</span>
                              <span className="tile-value-req-proceed">{formatDates(request.dates)}</span>
                            </div>
                            {request.requested_plan_count != null && request.requested_plan_count > 0 && (
                              <div className="tile-row-req-proceed">
                                <span className="tile-label-req-proceed">Requested plans:</span>
                                <span className="tile-value-req-proceed">{request.requested_plan_count}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Side: Calendar */}
        <div className="calendar-column-req-proceed">
          <div className="calendar-actions-req-proceed">
            <div className="calendar-actions-meta-req-proceed">
              <div className="selected-date-req-proceed">
                <span className="selected-date-label-req-proceed">Selected Date:</span>
                <span className="selected-date-value-req-proceed">
                  {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'No date selected'}
                </span>
              </div>
            {requestType === 'adhoc' && selectedRequestId && (
              <div className="plan-count-stepper-req-proceed">
                <span className="plan-count-label-req-proceed">Plans to create</span>
                <div className="plan-count-controls-req-proceed">
                  <button
                    type="button"
                    className="plan-count-btn-req-proceed"
                    onClick={() => setPlanCount((c) => Math.max(1, c - 1))}
                    disabled={isSubmitting || planCount <= 1}
                    aria-label="Decrease plan count"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="plan-count-input-req-proceed"
                    value={planCount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') return;
                      const n = parseInt(raw, 10);
                      if (Number.isFinite(n)) setPlanCount(Math.min(100, Math.max(1, n)));
                    }}
                    disabled={isSubmitting}
                    aria-label="Number of plans to create"
                  />
                  <button
                    type="button"
                    className="plan-count-btn-req-proceed"
                    onClick={() => setPlanCount((c) => Math.min(100, c + 1))}
                    disabled={isSubmitting || planCount >= 100}
                    aria-label="Increase plan count"
                  >
                    +
                  </button>
                </div>
                {selectedAdhocRequest?.requested_plan_count > 0 &&
                  selectedAdhocRequest.requested_plan_count !== planCount && (
                    <span className="plan-count-hint-req-proceed">
                      Requested: {selectedAdhocRequest.requested_plan_count}
                    </span>
                  )}
              </div>
            )}
            </div>
            <div className="action-buttons-req-proceed">
              <button 
                className="decline-btn-req-proceed" 
                onClick={handleDeclineClick}
                disabled={isSubmitting || !selectedRequestId}
              >
                {isSubmitting ? 'Processing...' : 'Decline'}
              </button>
              <button 
                className="create-plan-btn-req-proceed" 
                onClick={handleCreateClick}
                disabled={isSubmitting || !selectedDate || !selectedRequestId}
              >
                {isSubmitting ? 'Processing...' : requestType === 'reschedule' ? 'Approve' : 'Create'}
              </button>
            </div>
          </div>
          
          {plansLoading && (
            <div className="calendar-loading-overlay-req-proceed">
              <div className="calendar-loading-content-req-proceed">
                <Bars
                  height="40"
                  width="40"
                  color="#003057"
                  ariaLabel="bars-loading"
                  visible={true}
                />
                <span>Loading active plans...</span>
              </div>
            </div>
          )}
          {renderCalendar()}
        </div>
      </div>

      {/* Create Confirmation Modal */}
      {showCreateConfirm && selectedRequest && (
        <div className="modal-backdrop-req-proceed" onClick={() => setShowCreateConfirm(false)}>
          <div className="modal-content-req-proceed" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title-req-proceed">
              {requestType === 'reschedule' ? 'Confirm reschedule' : 'Confirm Create Plan'}
            </h3>
            <p className="modal-message-req-proceed">
              {requestType === 'reschedule' ? (
                <>
                  Approve reschedule for <strong>{getEstateName()}</strong> (Plan #
                  {selectedRescheduleRequest?.plan}) to{' '}
                  <strong>{selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}</strong>?
                </>
              ) : (
                <>
                  Are you sure you want to create a plan for <strong>{getEstateName()}</strong> on{' '}
                  <strong>{selectedDate ? format(selectedDate, 'dd/MM/yyyy') : ''}</strong>?
                  {planCount > 1 ? ` (${planCount} plans)` : ''}
                </>
              )}
            </p>
            <div className="modal-actions-req-proceed">
              <button 
                className="modal-cancel-btn-req-proceed" 
                onClick={() => setShowCreateConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                className="modal-confirm-btn-req-proceed" 
                onClick={handleCreatePlan}
                disabled={isSubmitting}
              >
                {isSubmitting ? (requestType === 'reschedule' ? 'Approving...' : 'Creating...') : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Confirmation Modal */}
      {showDeclineConfirm && selectedRequest && (
        <div className="modal-backdrop-req-proceed" onClick={() => setShowDeclineConfirm(false)}>
          <div className="modal-content-req-proceed" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title-req-proceed">Confirm Decline Request</h3>
            <p className="modal-message-req-proceed">
              Are you sure you want to decline the request for <strong>{getEstateName()}</strong>? This action cannot be undone.
            </p>
            <div className="modal-actions-req-proceed">
              <button 
                className="modal-cancel-btn-req-proceed" 
                onClick={() => setShowDeclineConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                className="modal-decline-btn-req-proceed" 
                onClick={handleDeclinePlan}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Declining...' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="modal-backdrop-req-proceed" onClick={() => setShowSuccess(false)}>
          <div className="modal-content-req-proceed modal-success-req-proceed" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title-req-proceed">Success</h3>
            <p className="modal-message-req-proceed">{successMessage}</p>
            <div className="modal-actions-req-proceed">
              <button 
                className="modal-ok-btn-req-proceed" 
                onClick={() => setShowSuccess(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showError && (
        <div className="modal-backdrop-req-proceed" onClick={() => setShowError(false)}>
          <div className="modal-content-req-proceed modal-error-req-proceed" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title-req-proceed">Error</h3>
            <p className="modal-message-req-proceed">{errorMessage}</p>
            <div className="modal-actions-req-proceed">
              <button 
                className="modal-ok-btn-req-proceed" 
                onClick={() => setShowError(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestProceed;

