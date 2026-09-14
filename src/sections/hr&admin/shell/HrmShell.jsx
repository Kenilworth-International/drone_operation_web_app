import React from 'react';
import './hrmShell.css';

/**
 * HrmPageHeader — consistent page header for all HRM pages.
 *
 * Props:
 *   title        {string}   Page title
 *   hint         {string}   One-line purpose text
 *   wingLabel    {string=}  Wing badge text (optional)
 *   actions      {node=}    Right-side action buttons (Add, Export, etc.)
 */
export function HrmPageHeader({ title, hint, wingLabel, actions }) {
  return (
    <div className="hrm-page-header">
      <div className="hrm-page-header-left">
        <h2 className="hrm-page-title">{title}</h2>
        {hint && <p className="hrm-page-hint">{hint}</p>}
      </div>
      <div className="hrm-page-header-right">
        {wingLabel && <span className="hrm-wing-badge">{wingLabel}</span>}
        {actions && <div className="hrm-page-actions">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * HrmSubTabs — unified tab bar to replace bespoke tab bars across all HRM pages.
 *
 * Props:
 *   tabs    {Array<{key: string, label: string}>}  Tab descriptors
 *   active  {string}                               Key of the active tab
 *   onChange {function(key: string): void}         Callback when a tab is clicked
 */
export function HrmSubTabs({ tabs, active, onChange }) {
  return (
    <div className="hrm-sub-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`hrm-sub-tab${active === tab.key ? ' hrm-sub-tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * HrmSplitLayout — left rail + right detail pane used by directory-type pages.
 *
 * Props:
 *   rail    {node}  Left side (list / filters)
 *   detail  {node}  Right side (form / view)
 *   empty   {node=} Content shown in the detail pane when no item is selected
 */
export function HrmSplitLayout({ rail, detail, empty }) {
  return (
    <div className="hrm-split-layout">
      <aside className="hrm-split-rail">{rail}</aside>
      <main className="hrm-split-detail">
        {detail != null ? detail : (empty || null)}
      </main>
    </div>
  );
}
