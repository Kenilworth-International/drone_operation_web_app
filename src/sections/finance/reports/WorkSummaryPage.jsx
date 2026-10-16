import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EstateSprayedAreaReport from './EstateSprayedAreaReport';
import PreInvoiceCreate from './PreInvoiceCreate';
import PlantationInvoiceHistory from './PlantationInvoiceHistory';
import WorkSummaryPdfHistory from './WorkSummaryPdfHistory';
import PlantationInvoicePrint from './PlantationInvoicePrint';
import WorkSummaryPdfDetailModal from './WorkSummaryPdfDetailModal';
import '../../../styles/workSummary.css';
import '../../../styles/invoiceFlows.css';

const TABS = [
  {
    id: 'pre',
    step: '1',
    label: 'Pre-invoice',
    hint: 'Start of month',
  },
  {
    id: 'final',
    step: '2',
    label: 'Final invoice',
    hint: 'End of month',
  },
  {
    id: 'payments',
    step: '3',
    label: 'Invoices & Payments',
    hint: 'Track receipts',
  },
  {
    id: 'work-summary-history',
    step: null,
    label: 'Work Summary History',
    hint: 'Saved PDFs',
  },
];

const LEGACY_TAB_MAP = {
  create: 'final',
  history: 'payments',
  'pdf-history': 'work-summary-history',
};

export default function WorkSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [previewPdfDoc, setPreviewPdfDoc] = useState(null);

  const rawTab = searchParams.get('tab');
  const mapped = LEGACY_TAB_MAP[rawTab] || rawTab;
  const activeTab = TABS.some((t) => t.id === mapped) ? mapped : 'final';

  const setTab = (tabId) => {
    const next = new URLSearchParams(searchParams);
    if (tabId === 'final') {
      next.delete('tab');
    } else {
      next.set('tab', tabId);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="work-summary-page inv-flow-page">
      <div className="inv-flow-tabs" role="tablist" aria-label="Billing workflow">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`inv-flow-tab${activeTab === tab.id ? ' inv-flow-tab--active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            {tab.step ? <span className="inv-flow-tab-step">{tab.step}</span> : null}
            <span className="inv-flow-tab-meta">
              <span>{tab.label}</span>
              <small>{tab.hint}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="work-summary-tab-panel" role="tabpanel">
        {activeTab === 'pre' ? (
          <PreInvoiceCreate onInvoicePreview={setPreviewInvoice} />
        ) : activeTab === 'final' ? (
          <EstateSprayedAreaReport onInvoicePreview={setPreviewInvoice} />
        ) : activeTab === 'payments' ? (
          <PlantationInvoiceHistory onInvoicePreview={setPreviewInvoice} />
        ) : activeTab === 'work-summary-history' ? (
          <WorkSummaryPdfHistory onPdfPreview={setPreviewPdfDoc} />
        ) : null}
      </div>

      {previewInvoice ? (
        <PlantationInvoicePrint
          invoice={previewInvoice}
          variant="preview"
          onClose={() => setPreviewInvoice(null)}
        />
      ) : null}

      {previewPdfDoc ? (
        <WorkSummaryPdfDetailModal document={previewPdfDoc} onClose={() => setPreviewPdfDoc(null)} />
      ) : null}
    </div>
  );
}
