import React from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { Bars } from 'react-loader-spinner';

export default function ManagerWizardLayout({
  title,
  subtitle,
  steps = [],
  activeStep = 0,
  onBack,
  loading = false,
  error = null,
  children,
  footer,
}) {
  if (loading) {
    return (
      <div className="pd-mgr-wizard pd-mgr-wizard--loading">
        <Bars height={36} width={48} color="#1b5e40" />
        <span>Loading plan…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pd-mgr-wizard">
        <header className="pd-mgr-wizard-topbar">
          <button type="button" className="pd-mgr-wizard-back" onClick={onBack}>
            <FaArrowLeft aria-hidden="true" /> Back
          </button>
        </header>
        <div className="pd-mgr-wizard-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="pd-mgr-wizard">
      <header className="pd-mgr-wizard-topbar">
        <button type="button" className="pd-mgr-wizard-back" onClick={onBack}>
          <FaArrowLeft aria-hidden="true" /> Back
        </button>
        <div className="pd-mgr-wizard-topbar-text">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>

      {steps.length > 0 ? (
        <ol className="pd-mgr-wizard-steps" aria-label="Progress">
          {steps.map((step, idx) => {
            const state = idx < activeStep ? 'done' : idx === activeStep ? 'active' : 'upcoming';
            return (
              <li key={step.key || step.label} className={`pd-mgr-wizard-step pd-mgr-wizard-step--${state}`}>
                <span className="pd-mgr-wizard-step-index">{idx + 1}</span>
                <span className="pd-mgr-wizard-step-label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="pd-mgr-wizard-panel">{children}</div>

      {footer ? <footer className="pd-mgr-wizard-footer">{footer}</footer> : null}
    </div>
  );
}
