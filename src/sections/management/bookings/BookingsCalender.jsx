import React, { useEffect, useState, useMemo } from 'react';
import { Bars } from 'react-loader-spinner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths } from 'date-fns';
import { toast } from 'react-toastify';
import CustomDropdown from '../../../components/CustomDropdown';
import {
  useDeactivateBookingPlanMutation,
} from '../../../api/services NodeJs/bookingCreationApi';
import { useGetDeactivateReasonsQuery } from '../../../api/services NodeJs/reasonsApi';
import { useGetHrHolidayCalendarQuery } from '../../../api/services NodeJs/hrLeaveApi';
import {
  buildHolidayMetaByDate,
  extractHolidayRows,
  holidayCellClass,
  holidayHoverText,
  holidayTypeShortLabel,
} from './bookingHolidayDisplay';
import '../../../styles/bookingsCalender.css';
import '../../../styles/updateservices.css';
import '../../../styles/deactivateplan.css';

const DeactivatePlanIcon = () => (
  <svg
    className="booking-calender-task-deactivate-icon"
    viewBox="0 0 24 24"
    width="12"
    height="12"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <line x1="7.2" y1="7.2" x2="16.8" y2="16.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const BookingsCalender = ({
  currentMonth,
  onMonthChange,
  tasksData = [],
  calendarLoading = false,
  onDateClick = null,
  selectedDate = null,
  submittingDate = null,
  onCalendarChange = null,
}) => {
  const [loading, setLoading] = useState(false);
  const [tasksByDate, setTasksByDate] = useState({});
  const [deactivatingPlanId, setDeactivatingPlanId] = useState(null);
  const [deactivateModalTask, setDeactivateModalTask] = useState(null);
  const [selectedDeactivateReason, setSelectedDeactivateReason] = useState(null);
  const [deactivateBookingPlan] = useDeactivateBookingPlanMutation();
  const { data: deactivateReasons } = useGetDeactivateReasonsQuery({ include_inactive: false });
  const yearMonth = format(currentMonth, 'yyyy-MM');
  const { data: holidayResponse } = useGetHrHolidayCalendarQuery({ yearMonth });
  const holidayMetaByDate = useMemo(
    () => buildHolidayMetaByDate(extractHolidayRows(holidayResponse)),
    [holidayResponse]
  );

  const deactivateReasonOptions = useMemo(
    () =>
      (deactivateReasons || [])
        .filter((row) => Number(row.id) !== 1)
        .map((row) => ({ id: row.id, group: row.reason })),
    [deactivateReasons]
  );

  const canManagePlans = useMemo(() => {
    const userData = JSON.parse(localStorage.getItem('userData')) || {};
    const jobRole = userData.job_role || '';
    const memberType = userData.member_type || '';

    if (memberType === 'i' && userData.user_level === 'i') {
      return true;
    }
    if (jobRole === 'md') {
      return true;
    }
    return false;
  }, []);

  const closeDeactivateModal = () => {
    setDeactivateModalTask(null);
    setSelectedDeactivateReason(null);
  };

  useEffect(() => {
    const grouped = tasksData.reduce((acc, task) => {
      if (!acc[task.date]) acc[task.date] = [];

      const taskEstate = task.estate;
      const taskArea = `${task.area} Ha`;

      acc[task.date].push({
        ...task,
        estate: taskEstate,
        area: taskArea,
      });
      return acc;
    }, {});

    setTasksByDate(grouped);
  }, [tasksData]);

  useEffect(() => {
    if (!deactivateModalTask || selectedDeactivateReason) return;
    if (deactivateReasonOptions.length === 1) {
      setSelectedDeactivateReason(deactivateReasonOptions[0]);
    }
  }, [deactivateModalTask, deactivateReasonOptions, selectedDeactivateReason]);

  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  };

  const calendarDays = getCalendarDays();

  const getDayNumber = (date) => format(date, 'd');

  const openDeactivateModal = (task) => {
    if (!task?.id) return;
    if (!deactivateReasonOptions.length) {
      toast.error('No deactivate reasons are configured. Add reasons in master data first.', {
        position: 'top-center',
        autoClose: 5000,
      });
      return;
    }
    setSelectedDeactivateReason(null);
    setDeactivateModalTask(task);
  };

  const confirmDeactivatePlan = async () => {
    const task = deactivateModalTask;
    if (!task?.id) return;
    if (!selectedDeactivateReason?.id) {
      toast.error('Please select a deactivate reason.', {
        position: 'top-center',
        autoClose: 4000,
      });
      return;
    }
    await executeDeactivatePlan(task, selectedDeactivateReason.id);
  };

  const executeDeactivatePlan = async (task, reasonId) => {
    try {
      setDeactivatingPlanId(task.id);
      const result = await deactivateBookingPlan({
        plan_id: task.id,
        deactivate_reason_id: reasonId,
      });
      if (result.error) {
        const errMsg =
          result.error?.data?.message ||
          result.error?.message ||
          'Failed to deactivate the plan.';
        toast.error(errMsg, {
          position: 'top-center',
          autoClose: 5000,
        });
        return;
      }
      const response = result.data;
      const isSuccess = response?.status === 'true' || response?.success === true;
      if (!isSuccess) {
        toast.error(response?.message || 'Failed to deactivate the plan.', {
          position: 'top-center',
          autoClose: 5000,
        });
        return;
      }
      setTasksByDate((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((dateKey) => {
          updated[dateKey] = (updated[dateKey] || []).filter((t) => t.id !== task.id);
        });
        return updated;
      });
      if (onCalendarChange) {
        await onCalendarChange();
      }
      toast.success('Plan deactivated.', { position: 'top-center', autoClose: 3000 });
      closeDeactivateModal();
    } catch (e) {
      console.error(e);
      toast.error('Error occurred while deactivating the plan.', {
        position: 'top-center',
        autoClose: 5000,
      });
    } finally {
      setDeactivatingPlanId(null);
    }
  };

  const handlePreviousMonth = () => {
    onMonthChange(addMonths(currentMonth, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };

  const renderDeactivateModal = () => {
    if (!deactivateModalTask) return null;
    const task = deactivateModalTask;
    return (
      <div className="modal-backdrop">
        <div className="modal-content">
          <h3>Deactivate Plan</h3>
          <p>Select a reason before deactivating this plan.</p>
          <div className="deactivate-modal-plan">
            Plan #{task.id} - {task.estate || '-'}
          </div>
          <div style={{ marginTop: 12 }}>
            <CustomDropdown
              options={deactivateReasonOptions}
              onSelect={(option) => setSelectedDeactivateReason(option)}
              selectedValue={selectedDeactivateReason}
            />
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="confirm-button"
              onClick={confirmDeactivatePlan}
              disabled={deactivatingPlanId === task.id}
            >
              {deactivatingPlanId === task.id ? 'Updating...' : 'Deactivate'}
            </button>
            <button type="button" className="cancel-button" onClick={closeDeactivateModal}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const firstDayOfWeek = monthStart.getDay();
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthName = format(currentMonth, 'MMMM yyyy');

    return (
      <div className="booking-calender-container">
        <div className="booking-calender-header">
          <button
            className="booking-calender-nav-btn"
            onClick={handlePreviousMonth}
            aria-label="Previous month"
          >
            ◀
          </button>
          <h3 className="booking-calender-title">{monthName}</h3>
          <button
            className="booking-calender-nav-btn"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            ▶
          </button>
        </div>

        <div className="booking-calender-holiday-legend" aria-label="Holiday legend">
          <span className="booking-calender-holiday-legend-item mercantile">Statutory</span>
          <span className="booking-calender-holiday-legend-item poya">Poya</span>
          <span className="booking-calender-holiday-legend-item special">Special</span>
        </div>

        <div className="booking-calender-weekday-headers">
          {weekdayNames.map((day, index) => (
            <div key={index} className="booking-calender-weekday-header">
              {day}
            </div>
          ))}
        </div>

        <div className="booking-calender-grid">
          {[...Array(firstDayOfWeek)].map((_, index) => (
            <div key={`empty-${index}`} className="booking-calender-day-empty" />
          ))}

          {calendarDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const allTasks = tasksByDate[dayStr] || [];
            const dayTasks = allTasks.filter((task) => task.activated === 1);
            const planCount = dayTasks.length;
            const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dayStr;
            const isSubmitting = submittingDate && format(submittingDate, 'yyyy-MM-dd') === dayStr;
            const holidayMeta = holidayMetaByDate[dayStr];
            const holidayTitle = holidayHoverText(holidayMeta);
            const dayClassName = [
              'booking-calender-day',
              isSameMonth(day, currentMonth) ? '' : 'booking-calender-day-other-month',
              isSelected ? 'booking-calender-day-selected' : '',
              onDateClick ? 'booking-calender-day-clickable' : '',
              isSubmitting ? 'booking-calender-day-submitting' : '',
              holidayCellClass(holidayMeta?.type),
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={dayStr}
                className={dayClassName}
                title={holidayTitle || undefined}
                onClick={onDateClick ? () => onDateClick(day) : undefined}
                style={{ cursor: onDateClick ? 'pointer' : 'default' }}
              >
                <div className="booking-calender-day-header">
                  <div className="booking-calender-day-number">{getDayNumber(day)}</div>
                  {planCount > 0 && <div className="booking-calender-day-count">({planCount})</div>}
                </div>
                {holidayMeta ? (
                  <div
                    className={`booking-calender-holiday-badge booking-calender-holiday-badge-${holidayMeta.type}`}
                    title={holidayTitle}
                  >
                    {holidayMeta.description || holidayTypeShortLabel(holidayMeta.type)}
                  </div>
                ) : null}
                <div className="booking-calender-tasks">
                  {dayTasks.map((task, index) => (
                    <div
                      key={index}
                      className="booking-calender-task"
                      title={`${task.estate} - ${task.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="booking-calender-task-estate">
                        {task.estate} - ID: {task.id}
                      </span>
                      {canManagePlans && task.activated === 1 && (
                        <span className="booking-calender-task-actions">
                          <button
                            className="booking-calender-task-deactivate"
                            aria-label="Deactivate plan"
                            title={task.delete_block_reason || 'Deactivate plan'}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeactivateModal(task);
                            }}
                            disabled={deactivatingPlanId === task.id}
                          >
                            {deactivatingPlanId === task.id ? '...' : <DeactivatePlanIcon />}
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                  {isSubmitting && (
                    <div className="booking-calender-submitting-indicator">
                      <div className="booking-calender-loading-bar"></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="booking-calender-wrapper">
      {(calendarLoading || loading) && (
        <div className="booking-calender-loading-overlay">
          <div className="booking-calender-loading-content">
            <Bars
              height="50"
              width="50"
              color="#003057FF"
              ariaLabel="bars-loading"
              visible={true}
            />
            <p>Loading calendar data...</p>
          </div>
        </div>
      )}
      {renderCalendar()}
      {renderDeactivateModal()}
    </div>
  );
};

export default BookingsCalender;
