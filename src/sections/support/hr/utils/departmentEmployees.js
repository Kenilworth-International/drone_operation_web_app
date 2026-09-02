export function filterDepartmentEmployees(employees, query) {
  const list = Array.isArray(employees) ? employees : [];
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((employee) => {
    const name = String(employee?.employeeName || '').toLowerCase();
    const empNo = String(employee?.empNo || '').toLowerCase();
    return name.includes(q) || empNo.includes(q);
  });
}

export function formatDepartmentEmployeeLabel(employee) {
  const name = String(employee?.employeeName || '').trim() || 'Unknown';
  const empNo = String(employee?.empNo || '').trim();
  return empNo ? `${name} (${empNo})` : name;
}
