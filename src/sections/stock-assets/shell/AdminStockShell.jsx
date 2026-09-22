import React from 'react';
import './adminStockShell.css';

/**
 * Shared Administration stock / procurement content shell.
 * Light, minimal UI — does not replace the global left nav.
 */
export function AdminPageHeader({ title, hint, actions }) {
  return (
    <div className="admin-stock-header">
      <div className="admin-stock-header-left">
        <h2 className="admin-stock-title">{title}</h2>
        {hint ? <p className="admin-stock-hint">{hint}</p> : null}
      </div>
      {actions ? <div className="admin-stock-header-actions">{actions}</div> : null}
    </div>
  );
}

export function AdminSubTabs({ tabs, active, onChange, className = '', variant = 'default' }) {
  const variantClass = variant === 'compact' ? ' admin-stock-tabs--compact' : '';
  return (
    <div className={`admin-stock-tabs${variantClass}${className ? ` ${className}` : ''}`.trim()} role="tablist">
      {(tabs || []).map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          title={tab.title || tab.label}
          className={`admin-stock-tab${active === tab.key ? ' admin-stock-tab--active' : ''}`}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.shortLabel || tab.label}
        </button>
      ))}
    </div>
  );
}

export function AdminStockPage({ children, className = '' }) {
  return <div className={`admin-stock-page ${className}`.trim()}>{children}</div>;
}

export function AdminPanel({ children, className = '' }) {
  return <div className={`admin-stock-panel ${className}`.trim()}>{children}</div>;
}

export function AdminToolbar({ children }) {
  return <div className="admin-stock-toolbar">{children}</div>;
}

export function AdminTableWrap({ children }) {
  return <div className="admin-stock-table-wrap">{children}</div>;
}
