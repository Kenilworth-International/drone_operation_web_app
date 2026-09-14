import React, { useState } from 'react';
import {
  useGetHrHolidayCalendarQuery,
  useSaveHrHolidayMarkMutation,
} from '../../../api/services NodeJs/hrLeaveApi';
import {
  useGetAllEmployeeRegistrationsQuery,
  useUpdateEmployeeRegistrationMutation,
} from '../../../api/services NodeJs/jdManagementApi';
import HolidayMarkingPanel from './HolidayMarkingPanel';
import FlexHoursPanel from './FlexHoursPanel';
import { getEmployeeDisplayName } from '../employeeProfile/employeeProfileUtils';
import '../../../styles/leavemanagement.css';

const TABS = [
  { key: 'holiday_marking', label: 'Holiday Marking' },
  { key: 'flex_hours', label: 'Flex Hours' },
];

const HolidaysFlexPage = () => {
  const [activeTab, setActiveTab] = useState('holiday_marking');
  const [holidayMonth, setHolidayMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data: holidayResponse, refetch: refetchHolidays } = useGetHrHolidayCalendarQuery({ yearMonth: holidayMonth });
  const { data: allEmployeesResponse, refetch: refetchEmployees } = useGetAllEmployeeRegistrationsQuery();
  const [saveHrHolidayMark, { isLoading: savingHoliday }] = useSaveHrHolidayMarkMutation();
  const [updateEmployeeRegistration, { isLoading: updatingEmployee }] = useUpdateEmployeeRegistrationMutation();
  const [message, setMessage] = useState('');
  const [savingEmployeeId, setSavingEmployeeId] = useState(null);
  const [editedFlexByEmployee, setEditedFlexByEmployee] = useState({});
  const [flexSearchText, setFlexSearchText] = useState('');
  const [flexStatusFilter, setFlexStatusFilter] = useState('all');
  const [holidayModal, setHolidayModal] = useState(null);

  const allEmployees = Array.isArray(allEmployeesResponse)
    ? allEmployeesResponse
    : Array.isArray(allEmployeesResponse?.data)
      ? allEmployeesResponse.data
      : Array.isArray(allEmployeesResponse?.data?.data)
        ? allEmployeesResponse.data.data
        : [];

  const holidayRows = Array.isArray(holidayResponse?.data) ? holidayResponse.data : [];
  const holidayMetaByDate = holidayRows.reduce((acc, row) => {
    const key = String(row?.holiday_date || '').slice(0, 10);
    if (!key) return acc;
    const t = String(row?.holiday_type || '').toLowerCase();
    if (t === 'mercantile' || t === 'poya' || t === 'special') {
      acc[key] = {
        type: t,
        description: row.description != null ? String(row.description).trim() : '',
      };
    }
    return acc;
  }, {});

  const showMessage = (text, isError = false) => {
    setMessage(isError ? `Failed: ${text}` : text);
  };

  const buildMonthDays = (yearMonthValue) => {
    const [yearText, monthText] = String(yearMonthValue || '').split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return [];
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const days = [];
    for (let day = 1; day <= end.getDate(); day += 1) {
      const date = new Date(year, month - 1, day);
      days.push({
        dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        dayNumber: day,
        weekDay: date.getDay(),
      });
    }
    const leading = start.getDay();
    return [...Array.from({ length: leading }, (_, idx) => ({ empty: true, key: `lead-${idx}` })), ...days];
  };

  const holidayCalendarCells = buildMonthDays(holidayMonth);

  const openHolidayEditor = (dateKey) => {
    const existing = holidayMetaByDate[dateKey];
    setHolidayModal({
      dateKey,
      holidayType: existing?.type || '',
      description: existing?.description || '',
    });
  };

  const saveHolidayModal = async () => {
    if (!holidayModal) return;
    try {
      await saveHrHolidayMark({
        holidayDate: holidayModal.dateKey,
        holidayType: holidayModal.holidayType || null,
        description:
          holidayModal.holidayType && String(holidayModal.description || '').trim()
            ? String(holidayModal.description).trim()
            : null,
      }).unwrap();
      setHolidayModal(null);
      refetchHolidays();
      showMessage(
        holidayModal.holidayType
          ? `Saved holiday for ${holidayModal.dateKey}`
          : `Removed holiday for ${holidayModal.dateKey}`
      );
    } catch (error) {
      showMessage(error?.data?.message || 'Failed to save holiday', true);
    }
  };

  const getEffectiveFlex = (employee) => {
    const overridden = editedFlexByEmployee[employee.id];
    if (overridden) return overridden;
    return {
      enabled:
        Number(employee.flexHoursEnabled ?? employee.flex_hours_enabled ?? 0) === 1 ||
        employee.flexHoursEnabled === true,
      minutes: Number(employee.flexHoursMinutes ?? employee.flex_hours_minutes ?? 0) || 0,
    };
  };

  const onFlexEnabledChange = (employee, checked) => {
    const current = getEffectiveFlex(employee);
    setEditedFlexByEmployee((prev) => ({
      ...prev,
      [employee.id]: { ...current, enabled: checked },
    }));
  };

  const onFlexMinutesChange = (employee, value) => {
    const current = getEffectiveFlex(employee);
    const nextMinutes = value === '' ? 0 : Math.max(0, Number(value || 0));
    setEditedFlexByEmployee((prev) => ({
      ...prev,
      [employee.id]: {
        ...current,
        minutes: Number.isFinite(nextMinutes) ? nextMinutes : 0,
      },
    }));
  };

  const onSaveFlexHours = async (employee) => {
    try {
      setSavingEmployeeId(employee.id);
      const effective = getEffectiveFlex(employee);
      await updateEmployeeRegistration({
        id: employee.id,
        flexHoursEnabled: effective.enabled ? 1 : 0,
        flexHoursMinutes: effective.enabled ? Number(effective.minutes || 0) : 0,
      }).unwrap();
      showMessage(`Updated flex hours for ${getEmployeeDisplayName(employee, employee.empNo || employee.id)}`);
      refetchEmployees();
    } catch (error) {
      showMessage(error?.data?.message || 'Failed to update flex hours', true);
    } finally {
      setSavingEmployeeId(null);
    }
  };

  const filteredFlexEmployees = allEmployees.filter((employee) => {
    const effective = getEffectiveFlex(employee);
    const statusOk =
      flexStatusFilter === 'all' ||
      (flexStatusFilter === 'enabled' && effective.enabled) ||
      (flexStatusFilter === 'disabled' && !effective.enabled);
    if (!statusOk) return false;
    const needle = String(flexSearchText || '').trim().toLowerCase();
    if (!needle) return true;
    const name = String(employee.preferredName || employee.employeeName || '').toLowerCase();
    const empNo = String(employee.empNo || '').toLowerCase();
    return name.includes(needle) || empNo.includes(needle);
  });

  return (
    <div className="leave-page-leavemgt">
      <div className="hrm-page-header-block">
        <div>
          <h2 className="hrm-page-title">Holidays &amp; Flex Hours</h2>
          <p className="hrm-page-hint">Mark public and company holidays, and configure flex-time minutes per employee.</p>
        </div>
      </div>

      <div className="leave-tabs-leavemgt leave-tabs-scroll-leavemgt">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`leave-tab-btn-leavemgt ${activeTab === tab.key ? 'active-leavemgt' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'holiday_marking' ? (
        <HolidayMarkingPanel
          holidayMonth={holidayMonth}
          setHolidayMonth={setHolidayMonth}
          holidayCalendarCells={holidayCalendarCells}
          holidayMetaByDate={holidayMetaByDate}
          openHolidayEditor={openHolidayEditor}
          savingHoliday={savingHoliday}
          holidayModal={holidayModal}
          setHolidayModal={setHolidayModal}
          saveHolidayModal={saveHolidayModal}
        />
      ) : null}
      {activeTab === 'flex_hours' ? (
        <FlexHoursPanel
          flexSearchText={flexSearchText}
          setFlexSearchText={setFlexSearchText}
          flexStatusFilter={flexStatusFilter}
          setFlexStatusFilter={setFlexStatusFilter}
          filteredFlexEmployees={filteredFlexEmployees}
          getEffectiveFlex={getEffectiveFlex}
          onFlexEnabledChange={onFlexEnabledChange}
          onFlexMinutesChange={onFlexMinutesChange}
          onSaveFlexHours={onSaveFlexHours}
          updatingEmployee={updatingEmployee}
          savingEmployeeId={savingEmployeeId}
        />
      ) : null}

      {message ? (
        <div className={`leave-message-leavemgt ${message.toLowerCase().includes('failed') ? 'error-leavemgt' : 'success-leavemgt'}`}>
          {message}
        </div>
      ) : null}
    </div>
  );
};

export default HolidaysFlexPage;
