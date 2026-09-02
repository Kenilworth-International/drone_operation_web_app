import React, { useEffect, useMemo, useState } from 'react';
import {
  useUpdateEmployeeRegistrationMutation,
  useCreateEmployeeRegistrationMutation,
  useGetWorkLocationsQuery,
  useGetDrivingLicenseTypesQuery,
  useGetProvincesQuery,
  useGetDistrictsQuery,
  useGetDSCSQuery,
  useGetASCSQuery,
  useGetAllEmployeeRegistrationsQuery,
} from '../../../api/services NodeJs/jdManagementApi';
import {
  useGetEmpDepartmentsQuery,
  useGetEmpSubDivisionsQuery,
  useGetEmpJobRolesQuery,
  useGetEmpSpecializationsQuery,
  useGetEmpDesignationsQuery,
  useResolveEmpDesignationMutation,
  useGetEmpRoleMaxLimitsQuery,
  useGetEmpChiefJobRolesQuery,
} from '../../../api/services NodeJs/empOrgStructureApi';
import {
  appendFormFields,
  applyNicDerived,
  isValidNic,
  mobileValidationMessage,
  nicValidationMessage,
  sanitizeNicInput,
  sanitizePhone9,
  splitDate,
} from './employeeProfileUtils';
import { parseNic } from '../../../utils/nic';
import { calculateAge } from '../../../utils/nic';
import { useEmployee } from './useEmployee';
import FamilyDependentsSection from './FamilyDependentsSection';
import DrivingLicenseTypeMultiSelect from './DrivingLicenseTypeMultiSelect';
import MasterSelect from './MasterSelect';
import ProfileReadOnlyGrid from './ProfileReadOnlyGrid';
import {
  DRIVING_LICENSE_NO,
  drivingLicenseTypesDisabledHint,
  licenseTypesFilterHint,
  filterLicenseTypesByCategory,
  inferDrivingLicenseFromTypes,
  isDrivingLicenseTypesEnabled,
  pruneLicenseTypeIds,
} from './drivingLicenseUtils';

/** Stable fallbacks — avoid new [] / {} references that retrigger RTK Query + useEffect loops */
const EMPTY_LIST = [];
const DESIGNATIONS_QUERY_ARG = {};

function str(value) {
  return value ?? '';
}

function SaveBanner({ message }) {
  if (!message?.text) return null;
  return (
    <p className={`epd-schedule-message epd-schedule-message--${message.type}`}>{message.text}</p>
  );
}

function FieldGrid({ children }) {
  return <div className="epd-form-grid">{children}</div>;
}

function Field({ label, children, hint, error }) {
  return (
    <div className={`epd-field${error ? ' epd-field--error' : ''}`}>
      <label>{label}</label>
      {children}
      {error ? <span className="epd-field-error">{error}</span> : null}
      {!error && hint ? <span className="epd-field-hint">{hint}</span> : null}
    </div>
  );
}

function yesNo(value) {
  if (value === '1' || value === 1 || value === true) return 'Yes';
  if (value === '0' || value === 0 || value === false) return 'No';
  return value;
}

function lookupLabel(list, id, labelKey = 'name') {
  if (!id) return '';
  const row = list.find((item) => String(item.id) === String(id));
  if (!row) return '';
  return row[labelKey] || row.name || row.label || '';
}

export function PersonalTab({ employeeId, readOnly = false }) {
  const { employee, refetch, isLoading } = useEmployee(employeeId);
  const [updateEmployee, { isLoading: saving }] = useUpdateEmployeeRegistrationMutation();
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(null);

  const { data: licenseTypesData } = useGetDrivingLicenseTypesQuery();
  const licenseTypes = useMemo(
    () => (Array.isArray(licenseTypesData?.data) ? licenseTypesData.data : EMPTY_LIST),
    [licenseTypesData],
  );

  useEffect(() => {
    if (!employee || Number(employee.id) !== Number(employeeId)) {
      setForm(null);
      return;
    }
    let licenseTypeArray = [];
    if (employee.drivingLicenseType) {
      const raw = employee.drivingLicenseType;
      if (Array.isArray(raw)) {
        licenseTypeArray = raw.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id));
      } else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            licenseTypeArray = parsed.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id));
          } else {
            licenseTypeArray = raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((id) => !Number.isNaN(id));
          }
        } catch {
          licenseTypeArray = raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((id) => !Number.isNaN(id));
        }
      }
    }
    const nic = employee.nic || '';
    let dob = splitDate(employee.dob);
    let gender = employee.gender || '';
    let age = employee.age != null ? String(employee.age) : '';
    if (nic) {
      const derived = applyNicDerived({ dob, gender, age }, nic);
      dob = derived.dob || dob;
      gender = derived.gender || gender;
      age = derived.age || age;
    }
    setForm({
      title: employee.title || '',
      employeeName: employee.employeeName || '',
      nameWithInitials: employee.nameWithInitials || '',
      preferredName: employee.preferredName || '',
      nic,
      taxIdentificationNo: employee.taxIdentificationNo || '',
      nationality: employee.nationality || 'Sri Lankan',
      bloodGroup: employee.bloodGroup || '',
      passportNo: employee.passportNo || '',
      race: employee.race || '',
      religion: employee.religion || '',
      gender,
      dob,
      age,
      permanentAddress: employee.permanentAddress || '',
      temporaryAddress: employee.temporaryAddress || '',
      telephoneHome: employee.telephoneHome || '',
      mobileNumber: employee.mobileNumber || '',
      companyMobileNo: employee.companyMobileNo || '',
      emailAddress: employee.emailAddress || '',
      personalEmail: employee.personalEmail || '',
      companyEmailAddress: employee.companyEmailAddress || '',
      drivingLicense: employee.drivingLicense || '',
      drivingLicenseType: licenseTypeArray,
    });
  }, [employee, employeeId]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (!prev) return prev;
      let next = { ...prev, [name]: value };
      if (name === 'nic') {
        next.nic = sanitizeNicInput(value);
        next = applyNicDerived(next, next.nic);
      }
      if (name === 'dob') {
        if (value) {
          const computed = calculateAge(value);
          if (computed != null) next.age = String(computed);
        } else {
          next = applyNicDerived(next, next.nic);
        }
      }
      if (name === 'mobileNumber' || name === 'telephoneHome') {
        next[name] = sanitizePhone9(value);
      }
      if (name === 'drivingLicense') {
        if (!isDrivingLicenseTypesEnabled(value)) {
          next.drivingLicenseType = [];
        } else {
          next.drivingLicenseType = pruneLicenseTypeIds(prev.drivingLicenseType, licenseTypes, value);
        }
      }
      return next;
    });
  };

  const onSave = async () => {
    setMessage(null);
    if (!isValidNic(form.nic)) {
      setMessage({ type: 'error', text: 'Invalid NIC format.' });
      return;
    }
    if (isDrivingLicenseTypesEnabled(form.drivingLicense) && !(form.drivingLicenseType || []).length) {
      setMessage({ type: 'error', text: 'Select at least one license type for the chosen driving license class.' });
      return;
    }
    if (form.drivingLicense === DRIVING_LICENSE_NO && (form.drivingLicenseType || []).length) {
      setMessage({ type: 'error', text: 'Remove license types when driving license is No.' });
      return;
    }
    const fd = new FormData();
    fd.append('id', String(employeeId));
    appendFormFields(fd, form);
    try {
      await updateEmployee(fd).unwrap();
      setMessage({ type: 'success', text: 'Personal details saved.' });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err?.data?.message || 'Failed to save.' });
    }
  };

  const licenseTypesEnabled = isDrivingLicenseTypesEnabled(form?.drivingLicense);
  const visibleLicenseTypes = useMemo(
    () => filterLicenseTypesByCategory(licenseTypes, form?.drivingLicense),
    [licenseTypes, form?.drivingLicense],
  );

  if (isLoading || !employee || !form) return <p className="epd-empty">Loading…</p>;

  if (readOnly) {
    const licenseLabels = (form.drivingLicenseType || [])
      .map((id) => licenseTypes.find((l) => Number(l.id) === Number(id))?.licenseCode)
      .filter(Boolean)
      .join(', ');
    const licenseDisplay = form.drivingLicense === DRIVING_LICENSE_NO || !licenseTypesEnabled
      ? 'Not applicable'
      : (licenseLabels || '—');

    return (
      <div className="epd-section ep-tab-readonly">
        <ProfileReadOnlyGrid
          items={[
            { label: 'Title', value: form.title },
            { label: 'Employee name (as per NIC)', value: form.employeeName },
            { label: 'Name with initials', value: form.nameWithInitials },
            { label: 'Preferred name', value: form.preferredName },
            { label: 'NIC', value: form.nic },
            { label: 'Tax identification no.', value: form.taxIdentificationNo },
            { label: 'Nationality', value: form.nationality },
            { label: 'Blood group', value: form.bloodGroup },
            { label: 'Passport no.', value: form.passportNo },
            { label: 'Race', value: form.race },
            { label: 'Religion', value: form.religion },
            { label: 'Gender', value: form.gender },
            { label: 'Date of birth', value: form.dob },
            { label: 'Age', value: form.age ? `${form.age} years` : '' },
            { label: 'Permanent address', value: form.permanentAddress },
            { label: 'Current address', value: form.temporaryAddress },
            { label: 'Telephone (home)', value: form.telephoneHome },
            { label: 'Mobile number', value: form.mobileNumber },
            { label: 'Company mobile', value: form.companyMobileNo },
            { label: 'Email', value: form.emailAddress },
            { label: 'Personal email', value: form.personalEmail },
            { label: 'Company email', value: form.companyEmailAddress },
            { label: 'Driving license', value: form.drivingLicense },
            { label: 'License type(s)', value: licenseDisplay },
          ]}
        />
      </div>
    );
  }

  return (
    <div className={`epd-section${readOnly ? ' ep-tab-readonly' : ''}`}>
      {!readOnly && (
        <p className="epd-section-intro">Identity, contact, and personal attributes. NIC auto-fills date of birth, gender, and age.</p>
      )}
      <FieldGrid>
        <Field label="Title">
          <MasterSelect category="title" name="title" value={str(form.title)} onChange={onChange} />
        </Field>
        <Field label="Employee name (as per NIC)">
          <input name="employeeName" value={str(form.employeeName)} onChange={onChange} />
        </Field>
        <Field label="Name with initials">
          <input name="nameWithInitials" value={str(form.nameWithInitials)} onChange={onChange} />
        </Field>
        <Field label="Preferred name">
          <input name="preferredName" value={str(form.preferredName)} onChange={onChange} />
        </Field>
        <Field label="NIC">
          <input name="nic" value={str(form.nic)} onChange={onChange} maxLength={12} placeholder="12 digits or 9 digits + V/X" />
        </Field>
        <Field label="Tax identification no.">
          <input name="taxIdentificationNo" value={str(form.taxIdentificationNo)} onChange={onChange} />
        </Field>
        <Field label="Nationality">
          <select name="nationality" value={str(form.nationality)} onChange={onChange}>
            <option value="Sri Lankan">Sri Lankan</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Blood group">
          <MasterSelect category="blood_group" name="bloodGroup" value={str(form.bloodGroup)} onChange={onChange} />
        </Field>
        <Field label="Passport no.">
          <input name="passportNo" value={str(form.passportNo)} onChange={onChange} />
        </Field>
        <Field label="Race">
          <MasterSelect category="race" name="race" value={str(form.race)} onChange={onChange} />
        </Field>
        <Field label="Religion">
          <MasterSelect category="religion" name="religion" value={str(form.religion)} onChange={onChange} />
        </Field>
        <Field label="Gender">
          <MasterSelect category="gender" name="gender" value={str(form.gender)} onChange={onChange} />
        </Field>
        <Field label="Date of birth">
          <input type="date" name="dob" value={str(form.dob)} onChange={onChange} />
        </Field>
        <Field label="Age" hint="Auto from NIC or DOB">
          <input value={form.age ? `${form.age} years` : ''} readOnly style={{ background: '#f5f5f5' }} />
        </Field>
        <Field label="Permanent address">
          <textarea name="permanentAddress" rows={2} value={str(form.permanentAddress)} onChange={onChange} />
        </Field>
        <Field label="Current address">
          <textarea name="temporaryAddress" rows={2} value={str(form.temporaryAddress)} onChange={onChange} />
        </Field>
        <Field label="Telephone (home)">
          <input name="telephoneHome" value={str(form.telephoneHome)} onChange={onChange} maxLength={9} />
        </Field>
        <Field label="Mobile number">
          <input name="mobileNumber" value={str(form.mobileNumber)} onChange={onChange} maxLength={9} />
        </Field>
        <Field label="Company mobile">
          <input name="companyMobileNo" value={str(form.companyMobileNo)} onChange={onChange} />
        </Field>
        <Field label="Email">
          <input type="email" name="emailAddress" value={str(form.emailAddress)} onChange={onChange} />
        </Field>
        <Field label="Personal email">
          <input type="email" name="personalEmail" value={str(form.personalEmail)} onChange={onChange} />
        </Field>
        <Field label="Company email">
          <input type="email" name="companyEmailAddress" value={str(form.companyEmailAddress)} onChange={onChange} />
        </Field>
        <Field label="Driving license">
          <MasterSelect category="driving_license" name="drivingLicense" value={str(form.drivingLicense)} onChange={onChange} />
        </Field>
        <Field
          label="License type(s)"
          hint={licenseTypesEnabled ? licenseTypesFilterHint(form.drivingLicense) : undefined}
        >
          <DrivingLicenseTypeMultiSelect
            value={form.drivingLicenseType || []}
            onChange={(ids) => {
              setForm((prev) => {
                if (!prev) return prev;
                const next = { ...prev, drivingLicenseType: ids };
                if (ids.length > 0 && !isDrivingLicenseTypesEnabled(prev.drivingLicense)) {
                  next.drivingLicense = inferDrivingLicenseFromTypes(ids, licenseTypes);
                  next.drivingLicenseType = pruneLicenseTypeIds(ids, licenseTypes, next.drivingLicense);
                }
                return next;
              });
            }}
            licenseTypes={visibleLicenseTypes}
            disabled={!licenseTypesEnabled}
            disabledHint={drivingLicenseTypesDisabledHint(form.drivingLicense)}
          />
        </Field>
      </FieldGrid>
      {!readOnly && (
        <>
          <SaveBanner message={message} />
          <div className="epd-actions">
            <button type="button" className="epd-btn epd-btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save personal details'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function EmploymentTab({ employeeId, readOnly = false }) {
  const { employee, refetch, isLoading } = useEmployee(employeeId);
  const [updateEmployee, { isLoading: saving }] = useUpdateEmployeeRegistrationMutation();
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(null);
  const [resolvedDesignation, setResolvedDesignation] = useState(null);

  const { data: departmentsData } = useGetEmpDepartmentsQuery();
  const { data: jobRolesData } = useGetEmpJobRolesQuery();
  const { data: chiefRolesData } = useGetEmpChiefJobRolesQuery();
  const { data: allDesignationsData } = useGetEmpDesignationsQuery(DESIGNATIONS_QUERY_ARG);
  const { data: locationsData } = useGetWorkLocationsQuery();
  const { data: employeesData } = useGetAllEmployeeRegistrationsQuery();
  const [resolveDesignation] = useResolveEmpDesignationMutation();

  const departments = departmentsData ?? EMPTY_LIST;
  const jobRoles = jobRolesData ?? EMPTY_LIST;
  const chiefRoles = chiefRolesData ?? EMPTY_LIST;
  const allDesignations = allDesignationsData ?? EMPTY_LIST;

  const deptId = form?.emp_department_id || '';
  const roleId = form?.emp_job_role_id || '';
  const specId = form?.emp_specialization_id || '';

  const subDivisionsQueryArg = useMemo(
    () => (deptId ? { dept_id: Number(deptId) } : undefined),
    [deptId],
  );
  const specializationsQueryArg = useMemo(() => {
    if (!deptId || !roleId) return undefined;
    return { dept_id: Number(deptId), job_role_id: Number(roleId) };
  }, [deptId, roleId]);
  const roleLimitsQueryArg = useMemo(() => {
    if (!deptId) return undefined;
    return { dept_id: Number(deptId), exclude_employee_id: employeeId };
  }, [deptId, employeeId]);

  const { data: subDivisionsData } = useGetEmpSubDivisionsQuery(subDivisionsQueryArg, { skip: !subDivisionsQueryArg });
  const { data: specializationsData } = useGetEmpSpecializationsQuery(specializationsQueryArg, { skip: !specializationsQueryArg });
  const { data: roleLimitsData } = useGetEmpRoleMaxLimitsQuery(roleLimitsQueryArg, { skip: !roleLimitsQueryArg });

  const subDivisions = subDivisionsData ?? EMPTY_LIST;
  const specializations = specializationsData ?? EMPTY_LIST;
  const roleLimits = roleLimitsData ?? EMPTY_LIST;

  const roleLimitById = useMemo(() => {
    const map = new Map();
    roleLimits.forEach((row) => map.set(Number(row.job_role_id), row));
    return map;
  }, [roleLimits]);

  const isRoleSelectable = (candidateRoleId) => {
    const lim = roleLimitById.get(Number(candidateRoleId));
    if (!lim || lim.max_limit == null) return true;
    return Number(lim.current_count ?? 0) < Number(lim.max_limit);
  };

  const selectedRoleLimit = roleId ? roleLimitById.get(Number(roleId)) : null;
  const selectedRoleAtCapacity = Boolean(
    roleId && deptId && selectedRoleLimit?.max_limit != null
    && Number(selectedRoleLimit.current_count ?? 0) >= Number(selectedRoleLimit.max_limit),
  );

  const chiefDeptMap = useMemo(() => {
    const map = new Map();
    chiefRoles.forEach((r) => {
      map.set(Number(r.id), new Set((r.dept_ids || []).map(Number)));
    });
    return map;
  }, [chiefRoles]);

  const selectableJobRoles = useMemo(() => jobRoles.filter((r) => {
    if (Number(r.activated) !== 1) return false;
    if (!deptId) return false;
    if (Number(r.chief) === 1) {
      return chiefDeptMap.get(Number(r.id))?.has(Number(deptId));
    }
    return (r.dept_ids || []).includes(Number(deptId));
  }), [jobRoles, deptId, chiefDeptMap]);

  const selectedIsChief = Boolean(
    roleId && jobRoles.find((r) => Number(r.id) === Number(roleId) && Number(r.chief) === 1),
  );

  const workLocations = useMemo(() => {
    const w = locationsData?.data || locationsData;
    return Array.isArray(w) ? w : [];
  }, [locationsData]);
  const employees = useMemo(() => {
    const e = employeesData?.data || employeesData;
    return Array.isArray(e) ? e : [];
  }, [employeesData]);

  useEffect(() => {
    if (!employee || Number(employee.id) !== Number(employeeId)) {
      setForm(null);
      setResolvedDesignation(null);
      return;
    }
    const des = allDesignations.find((d) => Number(d.id) === Number(employee.emp_designation_id));
    setForm({
      companyName: employee.companyName || '',
      shiftType: employee.shiftType || '',
      memberTypeFlag: employee.memberTypeFlag || '',
      employmentCategory: employee.employmentCategory || '',
      jobCategory: employee.jobCategory || '',
      employmentType: employee.employmentType || '',
      contractType: employee.contractType || '',
      contractStartDate: splitDate(employee.contractStartDate),
      contractEndDate: splitDate(employee.contractEndDate),
      probationPeriod: employee.probationPeriod || '',
      probationEndDate: splitDate(employee.probationEndDate),
      retirementDate: splitDate(employee.retirementDate),
      employeeStatus: employee.employeeStatus || '',
      biometricId: employee.biometricId || '',
      employeeType: employee.employeeType || 'i',
      emp_department_id: employee.emp_department_id ? String(employee.emp_department_id) : '',
      emp_sub_division_id: employee.emp_sub_division_id ? String(employee.emp_sub_division_id) : '',
      emp_job_role_id: des?.job_role_id ? String(des.job_role_id) : '',
      emp_specialization_id: des?.specialization_id ? String(des.specialization_id) : '',
      emp_designation_id: employee.emp_designation_id ? String(employee.emp_designation_id) : '',
      designation_title: employee.designation_title || employee.designation || '',
      workLocation: workLocations.find((wl) => wl.locationCode === employee.workLocation)?.id || '',
      reportingOfficer: employee.reportofficer ? String(employee.reportofficer) : '',
      joinedDate: splitDate(employee.joinedDate),
      appointmentDate: splitDate(employee.appointmentDate),
      permanentDate: splitDate(employee.permanentDate),
      workStatus: employee.workStatus || '',
      bulkLeaveAvailable: employee.bulkLeaveAvailable != null ? String(employee.bulkLeaveAvailable) : '0',
      flexHoursEnabled: employee.flexHoursEnabled != null ? String(employee.flexHoursEnabled) : '0',
      flexHoursMinutes: employee.flexHoursMinutes != null ? String(employee.flexHoursMinutes) : '0',
    });
  }, [employee, employeeId, allDesignationsData, workLocations]);

  useEffect(() => {
    if (!deptId || !roleId) {
      setResolvedDesignation(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await resolveDesignation({
          dept_id: Number(deptId),
          job_role_id: Number(roleId),
          specialization_id: specId ? Number(specId) : undefined,
        }).unwrap();
        if (!cancelled && res) {
          setResolvedDesignation(res);
          const nextDesId = res.id ? String(res.id) : '';
          const nextTitle = res.designation_title || '';
          setForm((prev) => {
            if (!prev) return prev;
            if (prev.emp_designation_id === nextDesId && prev.designation_title === nextTitle) {
              return prev;
            }
            return {
              ...prev,
              emp_designation_id: nextDesId,
              designation_title: nextTitle,
            };
          });
        }
      } catch {
        if (!cancelled) setResolvedDesignation(null);
      }
    })();
    return () => { cancelled = true; };
  }, [deptId, roleId, specId]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [name]: value };
      if (name === 'emp_department_id') {
        next.emp_sub_division_id = '';
        next.emp_job_role_id = '';
        next.emp_specialization_id = '';
        next.emp_designation_id = '';
        next.designation_title = '';
      }
      if (name === 'emp_job_role_id') {
        next.emp_specialization_id = '';
        next.emp_designation_id = '';
        next.designation_title = '';
      }
      if (name === 'emp_specialization_id') {
        next.emp_designation_id = '';
        next.designation_title = '';
      }
      if (name === 'flexHoursEnabled' && value !== '1') next.flexHoursMinutes = '0';
      return next;
    });
  };

  const onSave = async () => {
    setMessage(null);
    if (roleId && deptId && !isRoleSelectable(roleId)) {
      const roleName = jobRoles.find((r) => Number(r.id) === Number(roleId))?.job_role || 'this role';
      const deptName = departments.find((d) => Number(d.id) === Number(deptId))?.department_name || 'this department';
      setMessage({
        type: 'error',
        text: `Maximum headcount (${selectedRoleLimit?.max_limit}) reached for ${roleName} in ${deptName}.`,
      });
      return;
    }
    const fd = new FormData();
    fd.append('id', String(employeeId));
    appendFormFields(fd, form);
    try {
      await updateEmployee(fd).unwrap();
      setMessage({ type: 'success', text: 'Employment details saved.' });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err?.data?.message || 'Failed to save.' });
    }
  };

  if (isLoading || !employee || !form) return <p className="epd-empty">Loading…</p>;

  if (readOnly) {
    const deptName = lookupLabel(departments, form.emp_department_id, 'department_name');
    const subName = lookupLabel(subDivisions, form.emp_sub_division_id, 'sub_division_name');
    const roleName = lookupLabel(jobRoles, form.emp_job_role_id, 'job_role');
    const specName = lookupLabel(specializations, form.emp_specialization_id, 'specialization');
    const officer = employees.find((e) => String(e.id) === String(form.reportingOfficer));
    const locationName = lookupLabel(workLocations, form.workLocation, 'locationName');

    return (
      <div className="epd-section ep-tab-readonly">
        <ProfileReadOnlyGrid
          items={[
            { label: 'EMP no.', value: employee.empNo },
            { label: 'Company', value: form.companyName },
            { label: 'Department', value: deptName || employee.departmentName },
            { label: 'Sub-division', value: subName },
            { label: 'Job role', value: roleName || employee.employeeJobRoleName },
            { label: 'Specialization', value: specName },
            { label: 'Designation', value: form.designation_title || resolvedDesignation?.designation_title },
            { label: 'Reporting officer', value: officer ? (officer.employeeName || officer.empNo) : '' },
            { label: 'Work location', value: locationName || employee.workLocationName },
            { label: 'Shift type', value: form.shiftType },
            { label: 'Member type', value: form.memberTypeFlag },
            { label: 'Employment category', value: form.employmentCategory },
            { label: 'Job category', value: form.jobCategory },
            { label: 'Employment type', value: form.employmentType },
            { label: 'Contract type', value: form.contractType },
            { label: 'Joined date', value: form.joinedDate },
            { label: 'Appointment date', value: form.appointmentDate },
            { label: 'Contract start', value: form.contractStartDate },
            { label: 'Contract end', value: form.contractEndDate },
            { label: 'Probation period', value: form.probationPeriod },
            { label: 'Probation end', value: form.probationEndDate },
            { label: 'Retirement date', value: form.retirementDate },
            { label: 'Employee status', value: form.employeeStatus },
            { label: 'Work status', value: form.workStatus },
            { label: 'Biometric ID', value: form.biometricId },
            { label: 'Bulk leave', value: yesNo(form.bulkLeaveAvailable) },
            { label: 'Flex hours', value: yesNo(form.flexHoursEnabled) },
            { label: 'Flex minutes', value: form.flexHoursMinutes },
            { label: 'Permanent date', value: form.permanentDate },
          ]}
        />
      </div>
    );
  }

  return (
    <div className={`epd-section${readOnly ? ' ep-tab-readonly' : ''}`}>
      {!readOnly && (
        <p className="epd-section-intro">Department, sub-division, role, designation, contract, and attendance settings — saved once here only.</p>
      )}
      <FieldGrid>
        <Field label="EMP no.">
          <input value={employee.empNo || ''} readOnly style={{ background: '#f5f5f5' }} />
        </Field>
        <Field label="Company">
          <MasterSelect category="company_name" name="companyName" value={str(form.companyName)} onChange={onChange} />
        </Field>
        <Field label="Department">
          <select name="emp_department_id" value={str(form.emp_department_id)} onChange={onChange}>
            <option value="">-- Select --</option>
            {departments.filter((d) => Number(d.activated) === 1).map((d) => (
              <option key={d.id} value={d.id}>{d.department_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Sub-division">
          <select name="emp_sub_division_id" value={form.emp_sub_division_id} onChange={onChange} disabled={!deptId}>
            <option value="">-- Select --</option>
            {subDivisions.filter((s) => Number(s.activated) === 1).map((s) => (
              <option key={s.id} value={s.id}>{s.sub_division_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Job role" hint={deptId ? 'Chief roles appear only for departments they manage. Roles at max headcount are disabled.' : 'Select a department first to see chief-level roles.'}>
          <select name="emp_job_role_id" value={form.emp_job_role_id} onChange={onChange}>
            <option value="">-- Select --</option>
            {selectableJobRoles.map((r) => {
              const atCapacity = deptId && !Number(r.chief) && !isRoleSelectable(r.id);
              return (
                <option key={r.id} value={r.id} disabled={atCapacity}>
                  {r.job_role}{Number(r.chief) === 1 ? ' (chief)' : ''}{atCapacity ? ' (full)' : ''}
                </option>
              );
            })}
          </select>
          {selectedRoleAtCapacity && (
            <p className="epd-row-warning">
              Maximum headcount ({selectedRoleLimit.max_limit}) reached for this role in the selected department.
            </p>
          )}
        </Field>
        <Field label="Specialization" hint={selectedIsChief ? 'Not applicable for chief-level roles.' : (specializations.length === 0 && roleId ? 'No specializations for this dept/role — role-only designation applies.' : undefined)}>
          <select name="emp_specialization_id" value={form.emp_specialization_id} onChange={onChange} disabled={selectedIsChief || !roleId || specializations.length === 0}>
            <option value="">-- None --</option>
            {specializations.filter((s) => Number(s.activated) === 1).map((s) => (
              <option key={s.id} value={s.id}>{s.specialization}</option>
            ))}
          </select>
        </Field>
        <Field label="Designation">
          <input
            name="designation_title"
            value={form.designation_title || resolvedDesignation?.designation_title || ''}
            readOnly
            style={{ background: '#f5f5f5' }}
          />
        </Field>
        <Field label="Reporting officer">
          <select name="reportingOfficer" value={form.reportingOfficer} onChange={onChange}>
            <option value="">-- Select --</option>
            {employees.filter((e) => {
              const isDepartmentHead = departments.some((dept) => Number(dept.hod_employee_id) === Number(employeeId));
              return String(e.id) !== String(employeeId) || isDepartmentHead;
            }).map((e) => (
              <option key={e.id} value={e.id}>{e.employeeName || e.empNo}</option>
            ))}
          </select>
        </Field>
        <Field label="Work location">
          <select name="workLocation" value={form.workLocation} onChange={onChange}>
            <option value="">-- Select --</option>
            {workLocations.map((wl) => <option key={wl.id} value={wl.id}>{wl.locationName}</option>)}
          </select>
        </Field>
        <Field label="Shift type">
          <MasterSelect category="shift_type" name="shiftType" value={form.shiftType} onChange={onChange} />
        </Field>
        <Field label="Member type">
          <MasterSelect category="member_type" name="memberTypeFlag" value={form.memberTypeFlag} onChange={onChange} />
        </Field>
        <Field label="Employment category">
          <MasterSelect category="employment_category" name="employmentCategory" value={form.employmentCategory} onChange={onChange} />
        </Field>
        <Field label="Job category">
          <MasterSelect category="job_category" name="jobCategory" value={form.jobCategory} onChange={onChange} />
        </Field>
        <Field label="Employment type">
          <MasterSelect category="employment_type" name="employmentType" value={form.employmentType} onChange={onChange} />
        </Field>
        <Field label="Contract type">
          <MasterSelect category="contract_type" name="contractType" value={form.contractType} onChange={onChange} />
        </Field>
        <Field label="Joined date">
          <input type="date" name="joinedDate" value={form.joinedDate} onChange={onChange} />
        </Field>
        <Field label="Appointment date">
          <input type="date" name="appointmentDate" value={form.appointmentDate} onChange={onChange} />
        </Field>
        <Field label="Contract start">
          <input type="date" name="contractStartDate" value={form.contractStartDate} onChange={onChange} />
        </Field>
        <Field label="Contract end">
          <input type="date" name="contractEndDate" value={form.contractEndDate} onChange={onChange} />
        </Field>
        <Field label="Probation period">
          <MasterSelect category="probation_period" name="probationPeriod" value={form.probationPeriod} onChange={onChange} />
        </Field>
        <Field label="Probation end">
          <input type="date" name="probationEndDate" value={form.probationEndDate} onChange={onChange} />
        </Field>
        <Field label="Retirement date">
          <input type="date" name="retirementDate" value={form.retirementDate} onChange={onChange} />
        </Field>
        <Field label="Employee status">
          <MasterSelect category="employee_status" name="employeeStatus" value={form.employeeStatus} onChange={onChange} />
        </Field>
        <Field label="Work status">
          <MasterSelect category="work_status" name="workStatus" value={form.workStatus} onChange={onChange} />
        </Field>
        <Field label="Biometric ID">
          <input name="biometricId" value={form.biometricId} onChange={onChange} />
        </Field>
        <Field label="Bulk leave">
          <select name="bulkLeaveAvailable" value={form.bulkLeaveAvailable} onChange={onChange}>
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </Field>
        <Field label="Flex hours">
          <select name="flexHoursEnabled" value={form.flexHoursEnabled} onChange={onChange}>
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </Field>
        <Field label="Flex minutes">
          <input type="number" name="flexHoursMinutes" value={form.flexHoursMinutes} onChange={onChange} disabled={form.flexHoursEnabled !== '1'} />
        </Field>
        <Field label="Permanent date">
          <input type="date" name="permanentDate" value={form.permanentDate} onChange={onChange} />
        </Field>
      </FieldGrid>
      {!readOnly && (
        <>
          <SaveBanner message={message} />
          <div className="epd-actions">
            <button type="button" className="epd-btn epd-btn-primary" onClick={onSave} disabled={saving || selectedRoleAtCapacity}>
              {saving ? 'Saving…' : 'Save employment details'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function FamilyTab({ employeeId, readOnly = false }) {
  return <FamilyDependentsSection employeeId={employeeId} readOnly={readOnly} />;
}

export function SecurityTab({ employeeId, readOnly = false }) {
  const { employee, refetch, isLoading } = useEmployee(employeeId);
  const [updateEmployee, { isLoading: saving }] = useUpdateEmployeeRegistrationMutation();
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(null);

  const { data: provincesData } = useGetProvincesQuery();
  const { data: districtsData } = useGetDistrictsQuery(
    form?.province ? { provinceId: form.province } : undefined
  );
  const { data: dscsData } = useGetDSCSQuery(
    form?.district ? { districtId: form.district } : undefined
  );
  const provinces = provincesData?.data || provincesData || [];
  const districts = districtsData?.data || districtsData || [];
  const dscs = dscsData?.data || dscsData || [];

  const { data: ascsData } = useGetASCSQuery(
    { districtId: form?.district || undefined, dscsId: form?.divisionalSecretariats || undefined },
    { skip: !form?.district && !form?.divisionalSecretariats },
  );
  const ascs = ascsData?.data || ascsData || [];
  const filteredDistricts = useMemo(() => {
    if (!form?.province) return districts;
    return (Array.isArray(districts) ? districts : []).filter((d) => {
      const pid = d.province_id ?? d.provinceId ?? d.province;
      return pid == null ? true : String(pid) === String(form.province);
    });
  }, [districts, form?.province]);
  const filteredDscs = useMemo(() => {
    if (!form?.district) return dscs;
    return (Array.isArray(dscs) ? dscs : []).filter((d) => {
      const did = d.district_id ?? d.districtId ?? d.district;
      return did == null ? true : String(did) === String(form.district);
    });
  }, [dscs, form?.district]);

  useEffect(() => {
    if (!employee || Number(employee.id) !== Number(employeeId)) {
      setForm(null);
      return;
    }
    setForm({
      province: employee.province || '',
      district: employee.district || '',
      divisionalSecretariats: employee.divisionalSecretariats || '',
      asc: employee.ascsId || '',
      policeStation: employee.policeStation || '',
    });
  }, [employee, employeeId]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [name]: value };
      if (name === 'province') {
        next.district = '';
        next.divisionalSecretariats = '';
        next.asc = '';
      }
      if (name === 'district') {
        next.divisionalSecretariats = '';
        next.asc = '';
      }
      if (name === 'divisionalSecretariats') next.asc = '';
      return next;
    });
  };

  const onSave = async () => {
    const fd = new FormData();
    fd.append('id', String(employeeId));
    appendFormFields(fd, { ...form, asc: form.asc });
    try {
      await updateEmployee(fd).unwrap();
      setMessage({ type: 'success', text: 'Security details saved.' });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err?.data?.message || 'Failed to save.' });
    }
  };

  if (isLoading || !employee || !form) return <p className="epd-empty">Loading…</p>;

  if (readOnly) {
    const provinceName = lookupLabel(provinces, form.province, 'province');
    const districtName = lookupLabel(districts, form.district, 'district');
    const dscName = lookupLabel(dscs, form.divisionalSecretariats, 'dse');
    const ascName = lookupLabel(ascs, form.asc, 'ascs');

    return (
      <div className="epd-section ep-tab-readonly">
        <ProfileReadOnlyGrid
          items={[
            { label: 'Province', value: provinceName },
            { label: 'District', value: districtName },
            { label: 'Divisional secretariat', value: dscName },
            { label: 'ASC', value: ascName },
            { label: 'Police station', value: form.policeStation },
          ]}
        />
      </div>
    );
  }

  return (
    <div className={`epd-section${readOnly ? ' ep-tab-readonly' : ''}`}>
      {!readOnly && (
        <p className="epd-section-intro">Administrative / clearance location details. Upload police and GN reports under Documents.</p>
      )}
      <FieldGrid>
        <Field label="Province">
          <select name="province" value={str(form.province)} onChange={onChange}>
            <option value="">-- Select --</option>
            {(Array.isArray(provinces) ? provinces : []).map((p) => (
              <option key={p.id} value={p.id}>{p.province}</option>
            ))}
          </select>
        </Field>
        <Field label="District">
          <select name="district" value={str(form.district)} onChange={onChange}>
            <option value="">-- Select --</option>
            {(Array.isArray(filteredDistricts) ? filteredDistricts : []).map((d) => (
              <option key={d.id} value={d.id}>{d.district}</option>
            ))}
          </select>
        </Field>
        <Field label="Divisional secretariat">
          <select name="divisionalSecretariats" value={str(form.divisionalSecretariats)} onChange={onChange}>
            <option value="">-- Select --</option>
            {(Array.isArray(filteredDscs) ? filteredDscs : []).map((d) => (
              <option key={d.id} value={d.id}>{d.dse}</option>
            ))}
          </select>
        </Field>
        <Field label="ASC">
          <select name="asc" value={str(form.asc)} onChange={onChange}>
            <option value="">-- Select --</option>
            {(Array.isArray(ascs) ? ascs : []).map((a) => (
              <option key={a.id} value={a.id}>{a.ascs}</option>
            ))}
          </select>
        </Field>
        <Field label="Police station">
          <input name="policeStation" value={str(form.policeStation)} onChange={onChange} />
        </Field>
      </FieldGrid>
      {!readOnly && (
        <>
          <SaveBanner message={message} />
          <div className="epd-actions">
            <button type="button" className="epd-btn epd-btn-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save security details'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const LEGACY_DOC_SLOTS = [
  { key: 'birthCertificate', label: 'Birth certificate' },
  { key: 'healthReport', label: 'Health / medical report' },
  { key: 'policeReport', label: 'Police report' },
  { key: 'gndCertificate', label: 'GN certificate' },
  { key: 'marriedCertificate', label: 'Marriage certificate' },
];

export function LegacyFilesSection({ employeeId, readOnly = false }) {
  const { employee, refetch } = useEmployee(employeeId);
  const [updateEmployee, { isLoading: saving }] = useUpdateEmployeeRegistrationMutation();
  const [message, setMessage] = useState(null);

  const handleUpload = async (fieldKey, files) => {
    if (!files?.length) return;
    const fd = new FormData();
    fd.append('id', String(employeeId));
    fd.append(fieldKey, files[0]);
    try {
      await updateEmployee(fd).unwrap();
      setMessage({ type: 'success', text: 'File uploaded.' });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err?.data?.message || 'Upload failed.' });
    }
  };

  const urlFor = (fieldKey) => {
    const val = employee?.[fieldKey];
    if (!val) return null;
    if (typeof val === 'string' && val.startsWith('http')) return val;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.includes(',')) return val.split(',').map((s) => s.trim());
    return val;
  };

  return (
    <div className="epd-section">
      <h4 className="ep-subsection-title">Registration documents</h4>
      <p className="epd-section-intro">
        HR registration documents. Education certificates and service letters are managed under Qualifications — not here.
      </p>
      {!readOnly && <SaveBanner message={message} />}
      <div className="ep-doc-gallery">
        {LEGACY_DOC_SLOTS.map((slot) => {
          const existing = urlFor(slot.key);
          const inputId = `legacy-doc-${slot.key}`;
          return (
            <div key={slot.key} className="ep-doc-card">
              <span className="ep-doc-label">{slot.label}</span>
              <div className="ep-doc-preview">
                {existing ? (
                  Array.isArray(existing) ? (
                    <span>{existing.length} file(s) on record</span>
                  ) : (
                    <a href={existing} target="_blank" rel="noreferrer">View file</a>
                  )
                ) : (
                  <span className="epd-empty">No file</span>
                )}
              </div>
              {!readOnly && (
                <>
                  <input
                    id={inputId}
                    type="file"
                    className="ep-doc-file-input"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    multiple={slot.multiple}
                    disabled={saving}
                    onChange={(e) => {
                      handleUpload(slot.key, e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <label htmlFor={inputId} className="epd-btn epd-btn-sm">{existing ? 'Replace' : 'Upload'}</label>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AddEmployeeModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ employeeName: '', nic: '', mobileNumber: '', dob: '', gender: '' });
  const [touched, setTouched] = useState({});
  const [message, setMessage] = useState(null);
  const [createEmployee, { isLoading: creating }] = useCreateEmployeeRegistrationMutation();

  const fieldErrors = useMemo(() => {
    const errors = {};
    if (touched.employeeName && !form.employeeName?.trim()) {
      errors.employeeName = 'Employee name is required.';
    } else if (touched.employeeName && form.employeeName.trim().length < 2) {
      errors.employeeName = 'Enter at least 2 characters.';
    }
    if (touched.nic) {
      const nicErr = nicValidationMessage(form.nic);
      if (nicErr) errors.nic = nicErr;
    }
    if (touched.mobileNumber) {
      const mobileErr = mobileValidationMessage(form.mobileNumber);
      if (mobileErr) errors.mobileNumber = mobileErr;
    }
    return errors;
  }, [form, touched]);

  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const validateAll = () => {
    const errors = {};
    if (!form.employeeName?.trim()) errors.employeeName = 'Employee name is required.';
    else if (form.employeeName.trim().length < 2) errors.employeeName = 'Enter at least 2 characters.';
    const nicErr = nicValidationMessage(form.nic);
    if (nicErr) errors.nic = nicErr;
    const mobileErr = mobileValidationMessage(form.mobileNumber);
    if (mobileErr) errors.mobileNumber = mobileErr;
    return errors;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setTouched({ employeeName: true, nic: true, mobileNumber: true });
    const errors = validateAll();
    if (Object.keys(errors).length) {
      setMessage({ type: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }
    const mobile = sanitizePhone9(form.mobileNumber);
    const fd = new FormData();
    fd.append('employeeName', form.employeeName.trim());
    fd.append('nic', form.nic.trim().toUpperCase());
    fd.append('mobileNumber', mobile);
    fd.append('employeeType', 'i');
    const parsed = parseNic(form.nic);
    if (parsed.valid) {
      fd.append('dob', parsed.dob);
      fd.append('gender', parsed.gender);
    }
    try {
      const result = await createEmployee(fd).unwrap();
      if (result?.status && result?.data) {
        onCreated(result.data);
      } else {
        setMessage({ type: 'error', text: result?.message || 'Create failed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err?.data?.message || 'Create failed.' });
    }
  };

  return (
    <div className="epd-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="epd-modal-card ep-add-modal" role="dialog" aria-modal="true">
        <div className="epd-modal-header">
          <h3>Add new employee</h3>
          <button type="button" className="epd-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form className="epd-modal-body ep-add-modal-body" onSubmit={onSubmit} noValidate>
          <p className="epd-section-intro">Create with minimum details, then complete the full profile in the tabs.</p>
          <div className="ep-add-form">
            <Field label="Employee name *" error={fieldErrors.employeeName}>
              <input
                value={str(form.employeeName)}
                onChange={(e) => setForm((p) => ({ ...p, employeeName: e.target.value }))}
                onBlur={() => markTouched('employeeName')}
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.employeeName)}
              />
            </Field>
            <Field
              label="NIC *"
              hint="12 digits (new) or 9 digits + V/X (old)"
              error={fieldErrors.nic}
            >
              <input
                value={str(form.nic)}
                onChange={(e) => {
                  const nic = sanitizeNicInput(e.target.value);
                  setForm((p) => applyNicDerived({ ...p, nic }, nic));
                }}
                onBlur={() => markTouched('nic')}
                maxLength={12}
                placeholder="e.g. 200012345678 or 851234567V"
                inputMode="text"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.nic)}
              />
            </Field>
            {form.dob ? (
              <Field label="Date of birth" hint="Auto-filled from NIC">
                <input value={str(form.dob)} readOnly className="epd-input-readonly" />
              </Field>
            ) : null}
            {form.gender ? (
              <Field label="Gender" hint="Auto-filled from NIC">
                <input value={str(form.gender)} readOnly className="epd-input-readonly" />
              </Field>
            ) : null}
            <Field
              label="Mobile number *"
              hint="9 digits without leading 0 (e.g. 771234567)"
              error={fieldErrors.mobileNumber}
            >
              <input
                value={str(form.mobileNumber)}
                onChange={(e) => setForm((p) => ({ ...p, mobileNumber: sanitizePhone9(e.target.value) }))}
                onBlur={() => markTouched('mobileNumber')}
                maxLength={9}
                placeholder="771234567"
                inputMode="numeric"
                pattern="\d{9}"
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.mobileNumber)}
              />
            </Field>
          </div>
          <SaveBanner message={message} />
          <div className="epd-actions ep-add-modal-actions">
            <button type="button" className="epd-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="epd-btn epd-btn-primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create & open profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
