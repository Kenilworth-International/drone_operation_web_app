export function getEmployeeGreetingName(profileOrEmployee) {
  return getEmployeeDisplayName(profileOrEmployee, 'User');
}

/**
 * Preferred name for employee lists/selectors.
 * Falls back to EMP no, then legal name only if preferred is empty.
 */
export function getEmployeeDisplayName(profileOrEmployee, fallback = 'Employee') {
  if (!profileOrEmployee) return fallback;
  const preferred = String(
    profileOrEmployee.preferredName || profileOrEmployee.preferred_name || '',
  ).trim();
  if (preferred) return preferred;
  const empNo = String(profileOrEmployee.empNo || profileOrEmployee.emp_no || '').trim();
  if (empNo) return empNo;
  const legal = String(
    profileOrEmployee.employeeName
      || profileOrEmployee.employee_name
      || profileOrEmployee.name
      || '',
  ).trim();
  return legal || fallback;
}
