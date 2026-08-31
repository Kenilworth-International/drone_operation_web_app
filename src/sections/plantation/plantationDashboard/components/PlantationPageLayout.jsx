import React from 'react';

/**
 * Shared page chrome for external plantation tabs (Home, Calendar, Profile, Manager).
 */
export default function PlantationPageLayout({
  title,
  subtitle,
  actions,
  children,
  className = '',
  flush = false,
}) {
  const hasHeader = title || subtitle || actions;

  return (
    <div className={`plantation-ext-page${className ? ` ${className}` : ''}`}>
      {hasHeader ? (
        <header className="plantation-ext-page-header">
          {(title || actions) ? (
            <div className="plantation-ext-page-header-row">
              {title ? <h1 className="plantation-ext-page-title">{title}</h1> : null}
              {actions ? <div className="plantation-ext-page-actions">{actions}</div> : null}
            </div>
          ) : null}
          {subtitle ? <p className="plantation-ext-page-subtitle">{subtitle}</p> : null}
        </header>
      ) : null}
      <div className={`plantation-ext-page-body${flush ? ' plantation-ext-page-body--flush' : ''}`}>
        {children}
      </div>
    </div>
  );
}
