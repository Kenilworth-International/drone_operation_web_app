import * as XLSX from 'xlsx';

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function writeSheet(workbook, sheetName, rows) {
  const safeName = String(sheetName || 'Sheet').slice(0, 31);
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: 'No data' }]);
  XLSX.utils.book_append_sheet(workbook, ws, safeName);
}

function downloadWorkbook(workbook, filename) {
  XLSX.writeFile(workbook, filename);
}

export function exportHrmSummaryExcel({ data, periodType, periodKey, periodLabel }) {
  const workforce = data?.workforce || {};
  const attendance = data?.attendance || {};
  const leave = data?.leave || {};
  const kpi = data?.kpi || {};

  const wb = XLSX.utils.book_new();
  writeSheet(wb, 'Summary', [{
    Period: periodLabel,
    'Period type': periodType,
    'Period key': periodKey,
    'Total employees': workforce.totalEmployees ?? '',
    Departments: workforce.totalDepartments ?? '',
    'Assigned employees': workforce.assignedEmployees ?? '',
    'Unassigned employees': workforce.unassignedEmployees ?? '',
    'Open vacancies': workforce.openVacancies ?? '',
    'Present today': attendance.presentTodayCount ?? attendance.presentCount ?? '',
    'Present days (period)': attendance.presentPeriodCount ?? '',
    Absent: attendance.absentCount ?? '',
    'Attendance rate %': attendance.attendanceRate ?? '',
    'On leave today': leave.onLeaveToday ?? '',
    'Pending approvals': leave.pendingApprovals ?? '',
    'Leave approved (period)': leave.approvedCount ?? '',
    'Leave rejected (period)': leave.rejectedCount ?? '',
    'System KPI avg score': kpi.system?.averageScore ?? '',
    'System KPI rated employees': kpi.system?.ratedEmployees ?? '',
    'Top performer': kpi.system?.topPerformer?.employee_name ?? '',
    'SMART KPI reviews': kpi.smart?.reviewCount ?? '',
    'SMART KPI avg score': kpi.smart?.averageScore ?? '',
  }]);

  downloadWorkbook(wb, `HRM_Summary_${periodType}_${periodKey}_${stamp()}.xlsx`);
}

export function exportHrmAttendanceExcel({ data, periodType, periodKey, periodLabel }) {
  const attendance = data?.attendance || {};
  const wb = XLSX.utils.book_new();

  writeSheet(wb, 'Overview', [{
    Period: periodLabel,
    'Period type': periodType,
    'Period key': periodKey,
    'Present today': attendance.presentTodayCount ?? attendance.presentCount ?? 0,
    'Present days (period)': attendance.presentPeriodCount ?? 0,
    Absent: attendance.absentCount ?? 0,
    Other: attendance.otherCount ?? 0,
    'Employees with records': attendance.employeesWithRecords ?? 0,
    'Attendance rate %': attendance.attendanceRate ?? '',
  }]);

  writeSheet(wb, 'Trend', (attendance.trend || []).map((row) => ({
    Date: row.label,
    Present: row.present ?? 0,
    Absent: row.absent ?? 0,
    Other: row.other ?? 0,
  })));

  downloadWorkbook(wb, `HRM_Attendance_${periodType}_${periodKey}_${stamp()}.xlsx`);
}

export function exportHrmLeaveExcel({ data, periodType, periodKey, periodLabel }) {
  const leave = data?.leave || {};
  const wb = XLSX.utils.book_new();

  writeSheet(wb, 'Overview', [{
    Period: periodLabel,
    'Period type': periodType,
    'Period key': periodKey,
    'On leave today': leave.onLeaveToday ?? 0,
    'Pending approvals': leave.pendingApprovals ?? 0,
    'Approved (period)': leave.approvedCount ?? 0,
    'Rejected (period)': leave.rejectedCount ?? 0,
    'Pending in period': leave.pendingInPeriod ?? 0,
    'Total requests': leave.totalRequests ?? 0,
  }]);

  writeSheet(wb, 'By status', (leave.statusBreakdown || []).map((row) => ({
    Status: row.status,
    Count: row.count ?? 0,
  })));

  writeSheet(wb, 'Monthly trend', (leave.monthlyTrend || []).map((row) => ({
    Month: row.label,
    'Leave requests': row.count ?? 0,
  })));

  downloadWorkbook(wb, `HRM_Leave_${periodType}_${periodKey}_${stamp()}.xlsx`);
}

export function exportHrmWorkforceExcel({ data, periodLabel }) {
  const workforce = data?.workforce || {};
  const wb = XLSX.utils.book_new();

  writeSheet(wb, 'Overview', [{
    Period: periodLabel,
    'Total employees': workforce.totalEmployees ?? 0,
    Departments: workforce.totalDepartments ?? 0,
    'Open vacancies': workforce.openVacancies ?? 0,
    'Assigned employees': workforce.assignedEmployees ?? 0,
    'Unassigned employees': workforce.unassignedEmployees ?? 0,
  }]);

  writeSheet(wb, 'By department', (workforce.departmentHeadcount || []).map((row) => ({
    'Department code': row.departmentCode ?? '',
    'Department name': row.departmentName ?? '',
    Headcount: row.headcount ?? 0,
  })));

  downloadWorkbook(wb, `HRM_Workforce_${stamp()}.xlsx`);
}

export function exportHrmKpiExcel({ data, periodType, periodKey, periodLabel }) {
  const kpi = data?.kpi || {};
  const wb = XLSX.utils.book_new();

  writeSheet(wb, 'System KPI', [{
    Period: periodLabel,
    'Period type': kpi.period?.periodType || periodType,
    'Period key': kpi.period?.periodKey || periodKey,
    'Total employees': kpi.system?.totalEmployees ?? '',
    'Rated employees': kpi.system?.ratedEmployees ?? '',
    'Average score': kpi.system?.averageScore ?? '',
    'Top performer': kpi.system?.topPerformer?.employee_name ?? '',
    'Top score': kpi.system?.topPerformer?.composite_score ?? '',
  }]);

  writeSheet(wb, 'Top performers', (kpi.system?.topRows || []).map((row, index) => ({
    Rank: index + 1,
    'Employee ID': row.employeeId ?? '',
    'Employee name': row.employeeName ?? '',
    Score: row.compositeScore ?? '',
    'Rating label': row.ratingLabel ?? '',
  })));

  writeSheet(wb, 'SMART KPI overview', [{
    Period: periodLabel,
    'Review count': kpi.smart?.reviewCount ?? 0,
    'Average score': kpi.smart?.averageScore ?? '',
  }]);

  writeSheet(wb, 'SMART KPI by status', (kpi.smart?.statusBreakdown || []).map((row) => ({
    Status: row.status,
    Count: row.count ?? 0,
  })));

  downloadWorkbook(wb, `HRM_KPI_${periodType}_${periodKey}_${stamp()}.xlsx`);
}

export function exportHrmFullDashboardExcel({ data, periodType, periodKey, periodLabel }) {
  const workforce = data?.workforce || {};
  const attendance = data?.attendance || {};
  const leave = data?.leave || {};
  const kpi = data?.kpi || {};
  const wb = XLSX.utils.book_new();

  writeSheet(wb, 'Summary', [{
    Period: periodLabel,
    'Period type': periodType,
    'Period key': periodKey,
    'Total employees': workforce.totalEmployees ?? '',
    'Present today': attendance.presentTodayCount ?? attendance.presentCount ?? '',
    'On leave today': leave.onLeaveToday ?? '',
    'Open vacancies': workforce.openVacancies ?? '',
    'Avg KPI score': kpi.system?.averageScore ?? kpi.smart?.averageScore ?? '',
  }]);

  writeSheet(wb, 'Attendance trend', (attendance.trend || []).map((row) => ({
    Date: row.label,
    Present: row.present ?? 0,
    Absent: row.absent ?? 0,
  })));

  writeSheet(wb, 'Leave by status', (leave.statusBreakdown || []).map((row) => ({
    Status: row.status,
    Count: row.count ?? 0,
  })));

  writeSheet(wb, 'Headcount', (workforce.departmentHeadcount || []).map((row) => ({
    'Department code': row.departmentCode ?? '',
    'Department name': row.departmentName ?? '',
    Headcount: row.headcount ?? 0,
  })));

  writeSheet(wb, 'SMART KPI status', (kpi.smart?.statusBreakdown || []).map((row) => ({
    Status: row.status,
    Count: row.count ?? 0,
  })));

  writeSheet(wb, 'Top KPI performers', (kpi.system?.topRows || []).map((row, index) => ({
    Rank: index + 1,
    'Employee name': row.employeeName ?? '',
    Score: row.compositeScore ?? '',
    'Rating label': row.ratingLabel ?? '',
  })));

  writeSheet(wb, 'Upcoming holidays', (data?.upcomingHolidays?.items || []).map((row) => ({
    Date: row.holidayDate ?? '',
    Type: row.holidayTypeLabel || row.holidayType || '',
    Description: row.description ?? '',
    'Days until': row.daysUntil ?? '',
  })));

  writeSheet(wb, 'Upcoming birthdays', (data?.upcomingBirthdays?.items || []).map((row) => ({
    Employee: row.employeeName ?? '',
    'Emp No': row.empNo ?? '',
    Department: row.departmentName ?? '',
    'Next birthday': row.nextBirthdayDate ?? '',
    DOB: row.dob ?? '',
    'Days until': row.daysUntil ?? '',
  })));

  downloadWorkbook(wb, `HRM_Dashboard_Full_${periodType}_${periodKey}_${stamp()}.xlsx`);
}
