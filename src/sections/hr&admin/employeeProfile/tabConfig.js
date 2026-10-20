export const TAB_GROUPS = [
  {
    key: 'core',
    label: 'Core',
    tabs: [
      { key: 'personal', label: 'Personal' },
      { key: 'employment', label: 'Employment' },
      { key: 'family', label: 'Family & Dependents' },
      { key: 'security', label: 'Security' },
    ],
  },
  {
    key: 'qualifications',
    label: 'Qualifications',
    tabs: [
      { key: 'education', label: 'Education' },
      { key: 'employment-history', label: 'Employment History' },
      { key: 'skills', label: 'Skills' },
      { key: 'training-records', label: 'Training' },
    ],
  },
  {
    key: 'hr-admin',
    label: 'HR Admin',
    tabs: [
      { key: 'documents', label: 'Documents' },
      { key: 'assets', label: 'Assets' },
    ],
  },
  {
    key: 'lifecycle',
    label: 'Lifecycle',
    tabs: [
      { key: 'performance-reviews', label: 'Performance' },
      { key: 'disciplinary-actions', label: 'Disciplinary' },
      { key: 'exit', label: 'Exit' },
      { key: 'exit-clearances', label: 'Clearance' },
    ],
  },
];

export const DEFAULT_GROUP = 'core';
export const DEFAULT_TAB = 'personal';

export function findGroupForTab(tabKey) {
  return TAB_GROUPS.find((g) => g.tabs.some((t) => t.key === tabKey))?.key || DEFAULT_GROUP;
}

export function isValidTab(tabKey) {
  return TAB_GROUPS.some((g) => g.tabs.some((t) => t.key === tabKey));
}
