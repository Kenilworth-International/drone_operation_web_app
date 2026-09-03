import { parseNic } from '../../../utils/nic';

/** Normalize wing / department labels for comparison (strip " Wing", collapse spaces). */
export function normalizeWingLabel(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+wing$/i, '')
    .replace(/\s+/g, ' ');
}

function wingLabelsMatch(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function isHumanResourceText(value) {
  const text = normalizeWingLabel(value);
  return text.includes('human resource') || text === 'hrm' || text === 'hrmw' || text === 'hr';
}

function isHumanResourceWingQuery(wingNorm) {
  return wingNorm.includes('human resource')
    || wingNorm.includes('hr and admin')
    || wingNorm === 'hr'
    || wingNorm === 'hrm'
    || wingNorm === 'hrmw';
}

function addDeptToContext(dept, deptIds, deptCodes, normalizedLabels) {
  if (dept.id != null) deptIds.add(Number(dept.id));
  const code = String(dept.dept_code || dept.deptCode || '').trim().toLowerCase();
  if (code) deptCodes.add(code);
  const name = normalizeWingLabel(dept.department_name || dept.departmentName);
  if (name) normalizedLabels.add(name);
}

/**
 * Resolve ?wing= query to emp department ids/codes and normalized labels.
 */
export function buildWingFilterContext(wingQuery, empDepartments = [], wings = []) {
  const raw = decodeURIComponent(String(wingQuery || '').replace(/\+/g, ' ')).trim();
  if (!raw) return null;

  const wingNorm = normalizeWingLabel(raw);
  const deptIds = new Set();
  const deptCodes = new Set();
  const normalizedLabels = new Set([wingNorm]);

  empDepartments.forEach((dept) => {
    const name = normalizeWingLabel(dept.department_name || dept.departmentName);
    if (wingLabelsMatch(name, wingNorm)) {
      addDeptToContext(dept, deptIds, deptCodes, normalizedLabels);
    }
  });

  wings.forEach((wing) => {
    const name = normalizeWingLabel(wing.wing);
    if (wingLabelsMatch(name, wingNorm)) {
      const code = String(wing.wingsCode || wing.wingCode || '').trim().toLowerCase();
      if (code) deptCodes.add(code);
      if (name) normalizedLabels.add(name);
    }
  });

  const isHumanResource = isHumanResourceWingQuery(wingNorm);
  if (isHumanResource) {
    deptCodes.add('hrmw');
    deptCodes.add('hr');
    empDepartments.forEach((dept) => {
      const name = normalizeWingLabel(dept.department_name || dept.departmentName);
      const code = String(dept.dept_code || dept.deptCode || '').trim().toLowerCase();
      if (isHumanResourceText(name) || code === 'hrmw' || code === 'hr') {
        addDeptToContext(dept, deptIds, deptCodes, normalizedLabels);
      }
    });
    wings.forEach((wing) => {
      const code = String(wing.wingsCode || wing.wingCode || '').trim().toLowerCase();
      if (code === 'hrmw' || code === 'hr') {
        deptCodes.add(code);
        const name = normalizeWingLabel(wing.wing);
        if (name) normalizedLabels.add(name);
      }
    });
  }

  return { wingNorm, deptIds, deptCodes, normalizedLabels, isHumanResource };
}

export function employeeInWing(employee, wingContext) {
  if (!wingContext) return true;

  const empDeptId = employee?.emp_department_id != null ? Number(employee.emp_department_id) : null;
  if (empDeptId && wingContext.deptIds.has(empDeptId)) return true;

  const legacyDeptRaw = String(employee?.department ?? '').trim();
  if (legacyDeptRaw) {
    const legacyNum = Number(legacyDeptRaw);
    if (Number.isInteger(legacyNum) && legacyNum > 0 && wingContext.deptIds.has(legacyNum)) {
      return true;
    }
    const code = legacyDeptRaw.toLowerCase();
    if (wingContext.deptCodes.has(code)) return true;
  }

  const deptName = normalizeWingLabel(employee?.departmentName || employee?.department_name);
  if (deptName) {
    if (wingContext.normalizedLabels.has(deptName)) return true;
    for (const label of wingContext.normalizedLabels) {
      if (wingLabelsMatch(deptName, label)) return true;
    }
  }

  if (wingContext.isHumanResource) {
    if (isHumanResourceText(employee?.departmentName || employee?.department_name)) return true;
    if (isHumanResourceText(employee?.department)) return true;
  }

  return false;
}

/** @deprecated use employeeInWing + buildWingFilterContext */
export function employeeMatchesWing(employee, wingQuery) {
  const ctx = buildWingFilterContext(wingQuery, [], []);
  return employeeInWing(employee, ctx);
}

/**
 * Normalize API/DB date values to YYYY-MM-DD for <input type="date">.
 * Avoids the classic -1 day bug: MySQL DATE → JS Date → JSON UTC ISO → split('T')[0].
 */
export function splitDate(value) {
  if (value == null || value === '') return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const s = String(value).trim();
  if (!s || s === 'null' || s === 'undefined') return '';

  // Pure calendar date — never run through Date() (UTC parsing shifts the day)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Date prefix with time / timezone (ISO or MySQL datetime)
  if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return s.slice(0, 10);
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
}

export function formatProfileDate(value) {
  const raw = splitDate(value);
  if (!raw) return null;
  const parts = raw.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return raw;
  const [y, m, d] = parts;
  try {
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return raw;
  }
}

export const EMPLOYEE_CAREER_DATE_FIELDS = [
  { key: 'joinedDate', label: 'Joined' },
  { key: 'appointmentDate', label: 'Appointment' },
  { key: 'probationEndDate', label: 'Probation end' },
  { key: 'permanentDate', label: 'Permanent' },
  { key: 'contractStartDate', label: 'Contract start' },
  { key: 'contractEndDate', label: 'Contract end' },
  { key: 'retirementDate', label: 'Retirement' },
];

/** True when employment type is Contract Employee (HR master option_value). */
export function isContractEmploymentType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return text === 'contract employee' || text.startsWith('contract');
}

/** True when employment type is Probation Employee. */
export function isProbationEmploymentType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return text === 'probation employee' || text.startsWith('probation');
}

/** Default stored value for contract employment type (HR master option). */
export const CONTRACT_EMPLOYMENT_TYPE_VALUE = 'Contract Employee';

/** True when member type is External. */
export function isExternalMemberType(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === 'external';
}

/** True when member type is Internal. */
export function isInternalMemberType(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === 'internal';
}

/**
 * Filter employment_type master options by member type:
 * External → Contract Employee only; Internal → non-contract types.
 */
export function filterEmploymentTypeOptionsByMemberType(options, memberType) {
  const list = Array.isArray(options) ? options : [];
  if (isExternalMemberType(memberType)) {
    return list.filter((opt) => isContractEmploymentType(opt.value || opt.label));
  }
  if (isInternalMemberType(memberType)) {
    return list.filter((opt) => !isContractEmploymentType(opt.value || opt.label));
  }
  return list;
}

/** True when shift type is Roaster (roster) — bulk leave is only for this shift. */
export function isRoasterShiftType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return text === 'roaster' || text === 'roster' || text.startsWith('roaster') || text.startsWith('roster');
}

function normalizeCategoryKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** True when employment category is Senior Management (chief/HOD managed elsewhere). */
export function isSeniorManagementCategory(value) {
  return normalizeCategoryKey(value) === 'senior management';
}

/**
 * Match employment category (HR master) to emp_job_roles management layer name.
 * e.g. "Senior Management" ↔ emp_management_layers.layer_name
 */
export function jobRoleMatchesEmploymentCategory(role, employmentCategory) {
  const category = normalizeCategoryKey(employmentCategory);
  if (!category) return false;
  const layer = normalizeCategoryKey(role?.layer_name || role?.mgtLayerName || role?.mgt_layer_name);
  if (!layer) return false;
  return layer === category || layer.includes(category) || category.includes(layer);
}

/** Org-placement fields that do not apply to Senior Management employees. */
export const SENIOR_MANAGEMENT_CLEARED_ORG_FIELDS = [
  'emp_department_id',
  'emp_division_id',
  'emp_sub_division_id',
  'emp_job_role_id',
  'emp_specialization_id',
  'emp_designation_id',
  'designation_title',
  'designation',
  'department',
  'departmentName',
];

export function clearSeniorManagementOrgFields(formLike = {}) {
  const next = { ...formLike };
  SENIOR_MANAGEMENT_CLEARED_ORG_FIELDS.forEach((key) => {
    next[key] = '';
  });
  return next;
}

/**
 * Parse probation period labels like "6 months", "9 months", "1 year" into months.
 * @returns {number|null}
 */
export function parseProbationPeriodMonths(period) {
  const text = String(period || '').trim().toLowerCase();
  if (!text) return null;

  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*years?/);
  if (yearMatch) {
    const years = Number(yearMatch[1]);
    return Number.isFinite(years) ? Math.round(years * 12) : null;
  }

  const monthMatch = text.match(/(\d+(?:\.\d+)?)\s*months?/);
  if (monthMatch) {
    const months = Number(monthMatch[1]);
    return Number.isFinite(months) ? Math.round(months) : null;
  }

  const bare = Number(text);
  if (Number.isFinite(bare) && bare > 0) return Math.round(bare);

  return null;
}

/**
 * joinedDate (YYYY-MM-DD) + probation period → probation end date (YYYY-MM-DD).
 */
export function calculateProbationEndDate(joinedDate, probationPeriod) {
  const joined = splitDate(joinedDate);
  const months = parseProbationPeriodMonths(probationPeriod);
  if (!joined || months == null || months <= 0) return '';

  const d = new Date(`${joined}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';

  d.setMonth(d.getMonth() + months);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function employeeRecord(data) {
  return data?.data || data || null;
}

/**
 * Resolve employee document/photo URLs for the current app origin.
 * On localhost, rewrite absolute dev API URLs to /documents/... so setupProxy can serve them.
 */
export function resolveEmployeeAssetUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal) {
      if (trimmed.startsWith('/documents/') || trimmed.startsWith('/uploads/')) {
        return trimmed;
      }
      try {
        const parsed = new URL(trimmed, window.location.origin);
        if (parsed.pathname.startsWith('/documents/') || parsed.pathname.startsWith('/uploads/')) {
          return parsed.pathname;
        }
      } catch {
        /* keep original */
      }
    }
  }

  return trimmed;
}

export function getEmployeePhotoUrl(employee) {
  if (!employee) return null;
  if (employee.employeePhotoUrl) {
    return resolveEmployeeAssetUrl(employee.employeePhotoUrl);
  }
  const photo = employee.employeePhoto;
  if (Array.isArray(photo) && photo.length > 0) {
    return resolveEmployeeAssetUrl(photo[0]);
  }
  if (typeof photo === 'string' && photo.startsWith('http')) {
    return resolveEmployeeAssetUrl(photo);
  }
  if (typeof photo === 'string' && photo.trim().startsWith('/documents/')) {
    return resolveEmployeeAssetUrl(photo.trim());
  }
  if (typeof photo === 'string' && photo.trim() && !photo.includes('/')) {
    return resolveEmployeeAssetUrl(`/documents/employees/photos/${photo.trim()}`);
  }
  return null;
}

export function appendFormFields(formData, fields) {
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, value === '' ? '' : String(value));
    }
  });
}

export function sanitizeNicInput(value) {
  const upper = String(value || '').toUpperCase().replace(/[^0-9VX]/g, '');
  if (upper.length <= 9) return upper.replace(/[VX]/g, '');
  if (upper.length === 10 && /^\d{9}[VX]$/.test(upper)) return upper;
  if (/^\d{9}[VX]/.test(upper)) return upper.slice(0, 10);
  return upper.replace(/[VX]/g, '').slice(0, 12);
}

export function applyNicDerived(values, nic) {
  const parsed = parseNic(nic);
  if (!parsed.valid) {
    return { ...values, dob: '', gender: '', age: '' };
  }
  const next = { ...values };
  next.dob = parsed.dob;
  next.gender = parsed.gender;
  next.age = parsed.age != null ? String(parsed.age) : '';
  return next;
}

export function isValidNic(nic) {
  const value = String(nic || '').trim().toUpperCase();
  return /^\d{12}$/.test(value) || /^\d{9}[VX]$/.test(value);
}

export function employeeInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function sanitizePhone9(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 9);
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

/** Sri Lankan mobile: exactly 9 digits, no leading 0 (e.g. 771234567). */
export function isValidMobile9(value) {
  const mobile = sanitizePhone9(value);
  return /^\d{9}$/.test(mobile);
}

export function mobileValidationMessage(value) {
  const mobile = sanitizePhone9(value);
  if (!mobile) return 'Mobile number is required.';
  if (!/^\d{9}$/.test(mobile)) return 'Enter exactly 9 digits without a leading 0.';
  if (!/^7\d{8}$/.test(mobile)) return 'Mobile number should start with 7 (e.g. 771234567).';
  return null;
}

export function nicValidationMessage(nic) {
  const value = String(nic || '').trim();
  if (!value) return 'NIC is required.';
  if (!isValidNic(value)) return 'Use 12 digits (new NIC) or 9 digits + V/X (old NIC).';
  return null;
}

export function parseEmpNoSuffix(empNo) {
  const match = String(empNo || '').trim().toUpperCase().match(/^EMP(\d+)$/);
  if (!match) return '';
  return String(Number(match[1]));
}

export function sanitizeEmpNoSuffix(value) {
  return String(value || '').replace(/\D/g, '');
}

export function formatEmpNoPreview(suffix) {
  if (!suffix || !/^\d+$/.test(String(suffix))) return '';
  return `EMP${String(Number(suffix)).padStart(3, '0')}`;
}

export function empNoSuffixValidationMessage(suffix) {
  if (!suffix || !/^\d+$/.test(String(suffix))) {
    return 'Enter the numeric part of the employee number (e.g. 1 for EMP001).';
  }
  if (Number(suffix) <= 0) return 'Employee number must be a positive number.';
  return null;
}
