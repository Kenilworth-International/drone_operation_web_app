import React from 'react';

const TYPE_LABELS = {
  ceo: 'CEO',
  chief: 'Chief',
  department: 'Department',
  hod: 'HOD',
  job_role: 'Role',
  employee: 'Staff',
};

/** Power ladder only below department (roles / staff), not CEO → chiefs → departments. */
const STACK_CHILDREN_UNDER = new Set(['department', 'hod', 'job_role']);

function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

function OrgCard({ node, nameOnlyPeople }) {
  const type = node.nodeType || 'employee';
  const label = TYPE_LABELS[type] || type;
  const subtitle = node.subtitle || node.designation || node.departmentName || '';
  const isPerson = Boolean(node.employeeId) && !node.vacant;
  const showPerson = isPerson && (type === 'employee' || type === 'hod' || type === 'ceo' || type === 'chief');

  // Employees view: name only (no role box chrome).
  if (nameOnlyPeople && type === 'employee') {
    return (
      <div
        className="org-card org-card--employee org-card--name-only"
        title={node.empNo ? `EMP ${node.empNo}` : undefined}
      >
        <div className="org-card-body org-card-body--name-only">
          <span className="org-card-avatar" aria-hidden="true">{initials(node.name) || '?'}</span>
          <div className="org-card-text">
            <div className="org-card-name">{node.name}</div>
          </div>
        </div>
      </div>
    );
  }

  let status = null;
  if (node.vacant) {
    status = 'Vacant';
  } else if (type === 'job_role' && node.headcount != null) {
    status = node.headcount === 0 ? 'Open' : `${node.headcount}`;
  }

  return (
    <div
      className={`org-card org-card--${type}${node.vacant ? ' org-card--vacant' : ''}`}
      title={node.empNo ? `EMP ${node.empNo}` : undefined}
    >
      <div className="org-card-top">
        <span className="org-card-type">{label}</span>
        {status != null ? <span className="org-card-status">{status}</span> : null}
      </div>
      <div className="org-card-body">
        {showPerson ? (
          <span className="org-card-avatar" aria-hidden="true">{initials(node.name) || '?'}</span>
        ) : null}
        <div className="org-card-text">
          <div className="org-card-name">{node.name}</div>
          {subtitle ? <div className="org-card-sub">{subtitle}</div> : null}
        </div>
      </div>
    </div>
  );
}

function OrgChartNode({ node, stackBelowDepartment, nameOnlyPeople }) {
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const multiChildren = children.length > 1;
  const useStack = Boolean(stackBelowDepartment)
    && multiChildren
    && STACK_CHILDREN_UNDER.has(node.nodeType);

  return (
    <>
      <OrgCard node={node} nameOnlyPeople={nameOnlyPeople} />
      {hasChildren && (
        <div className="org-tree-children">
          <div className="org-tree-line org-tree-line--stem" aria-hidden="true" />
          <ul
            className={[
              'org-tree-branch',
              useStack
                ? 'org-tree-branch--stack'
                : multiChildren
                  ? 'org-tree-branch--multi'
                  : 'org-tree-branch--single',
            ].join(' ')}
          >
            {children.map((child) => (
              <li key={child.id} className="org-tree-child">
                <div className="org-tree-line org-tree-line--drop" aria-hidden="true" />
                <OrgChartNode
                  node={child}
                  stackBelowDepartment={stackBelowDepartment}
                  nameOnlyPeople={nameOnlyPeople}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function OrgChartTree({
  roots,
  stackBelowDepartment = false,
  nameOnlyPeople = false,
}) {
  if (!roots?.length) return null;

  return (
    <div className="org-tree">
      <ul className="org-tree-branch org-tree-branch--root">
        {roots.map((node) => (
          <li key={node.id} className="org-tree-item org-tree-item--root">
            <OrgChartNode
              node={node}
              stackBelowDepartment={stackBelowDepartment}
              nameOnlyPeople={nameOnlyPeople}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
