/** HR dropdown categories managed in Master Data Update → HR Master Options */
export const HR_MASTER_CATEGORIES = [
  { key: 'title', label: 'Title', group: 'Personal' },
  { key: 'blood_group', label: 'Blood Group', group: 'Personal' },
  { key: 'race', label: 'Race', group: 'Personal' },
  { key: 'religion', label: 'Religion', group: 'Personal' },
  { key: 'gender', label: 'Gender', group: 'Personal' },
  { key: 'driving_license', label: 'Driving License', group: 'Personal' },
  { key: 'marital_status', label: 'Marital Status', group: 'Family' },
  { key: 'dependent_relationship', label: 'Dependent Relationship', group: 'Family' },
  { key: 'emergency_relationship', label: 'Emergency Contact Relationship', group: 'Family' },
  { key: 'company_name', label: 'Company', group: 'Employment' },
  { key: 'shift_type', label: 'Shift Type', group: 'Employment' },
  { key: 'member_type', label: 'Member Type', group: 'Employment' },
  { key: 'employment_category', label: 'Employment Category', group: 'Employment' },
  { key: 'employment_type', label: 'Employment Type', group: 'Employment' },
  { key: 'contract_type', label: 'Contract Type', group: 'Employment' },
  { key: 'probation_period', label: 'Probation Period', group: 'Employment' },
  { key: 'employee_status', label: 'Employee Status', group: 'Employment' },
  { key: 'work_status', label: 'Work Status', group: 'Employment' },
  { key: 'qualification_type', label: 'Qualification Type', group: 'Qualifications' },
  { key: 'education_stream', label: 'A/L Stream', group: 'Qualifications' },
  { key: 'education_al_major_subject', label: 'A/L Major Subjects', group: 'Qualifications' },
  { key: 'education_ol_core_subject', label: 'O/L Core Subjects', group: 'Qualifications' },
  { key: 'education_ol_category_1', label: 'O/L Category I Subjects', group: 'Qualifications' },
  { key: 'education_ol_category_2', label: 'O/L Category II Subjects', group: 'Qualifications' },
  { key: 'education_ol_category_3', label: 'O/L Category III Subjects', group: 'Qualifications' },
  { key: 'education_institution', label: 'School / Institution', group: 'Qualifications' },
  { key: 'education_course', label: 'Degree / Programme', group: 'Qualifications' },
  { key: 'education_field_of_study', label: 'Field of Study', group: 'Qualifications' },
  { key: 'employment_industry', label: 'Employment Industry', group: 'Employment History' },
  { key: 'skill_category', label: 'Skill Category', group: 'Qualifications' },
  { key: 'asset_type', label: 'Asset Type', group: 'HR Admin' },
  { key: 'salary_method', label: 'Salary Method', group: 'HR Admin' },
  { key: 'attendance_method', label: 'Attendance Method', group: 'HR Admin' },
  { key: 'review_type', label: 'Performance Review Type', group: 'Lifecycle' },
  { key: 'disciplinary_action_type', label: 'Disciplinary Action Type', group: 'Lifecycle' },
  { key: 'exit_clearance_status', label: 'Exit Clearance Status', group: 'Lifecycle' },
  { key: 'exit_clearance_type', label: 'Exit Clearance Type', group: 'Lifecycle' },
  { key: 'exit_item_status', label: 'Exit Item Status', group: 'Lifecycle' },
];

export function hrMasterCategoryLabel(key) {
  return HR_MASTER_CATEGORIES.find((c) => c.key === key)?.label || key;
}

/** Ordered group headings for ICT Master Data → HR Master Options dropdowns */
export const HR_MASTER_CATEGORY_GROUPS = [
  'Personal',
  'Family',
  'Employment',
  'Qualifications',
  'Employment History',
  'HR Admin',
  'Lifecycle',
];

/** Short help shown when a category is selected in Master Data Update */
export const HR_MASTER_CATEGORY_HINTS = {
  qualification_type: 'Primary, O/L, A/L, Degree, Diploma, etc.',
  education_stream: 'A/L stream options (Science, Commerce, Arts). Used on employee Education tab when type is A/L.',
  education_al_major_subject: 'A/L major subject dropdown options used in employee profile.',
  education_ol_core_subject: 'O/L compulsory core subjects shown in employee profile.',
  education_ol_category_1: 'O/L Category I subject dropdown options.',
  education_ol_category_2: 'O/L Category II subject dropdown options.',
  education_ol_category_3: 'O/L Category III subject dropdown options.',
  education_institution: 'Schools, colleges, and universities for education records.',
  education_course: 'Degree and diploma programme names.',
  education_field_of_study: 'Subjects, majors, or specializations.',
  employment_industry: 'Industry sector for previous employment history records.',
};

export function groupHrMasterCategories() {
  const byGroup = {};
  HR_MASTER_CATEGORIES.forEach((cat) => {
    const group = cat.group || 'Other';
    if (!byGroup[group]) byGroup[group] = [];
    byGroup[group].push(cat);
  });
  return HR_MASTER_CATEGORY_GROUPS.filter((g) => byGroup[g]?.length).map((group) => ({
    group,
    categories: byGroup[group],
  }));
}
