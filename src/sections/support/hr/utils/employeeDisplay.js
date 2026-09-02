export function getEmployeeGreetingName(profileOrEmployee) {
  if (!profileOrEmployee) return 'User';
  const preferred = String(
    profileOrEmployee.preferredName || profileOrEmployee.preferred_name || '',
  ).trim();
  if (preferred) return preferred;
  const legal = String(
    profileOrEmployee.employeeName
      || profileOrEmployee.employee_name
      || profileOrEmployee.name
      || '',
  ).trim();
  return legal || 'User';
}
