import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Bars } from 'react-loader-spinner';
import {
  useListWorkSummaryDocumentsQuery,
  useLazyGetWorkSummaryDocumentQuery,
} from '../../../api/services NodeJs/financeWorkSummaryBillingApi';
import { useLazyGetPlantationsListQuery } from '../../../api/services NodeJs/plantationDashboardApi';
import {
  downloadWorkSummaryPdfFromSnapshot,
  getWorkSummaryPdfFileName,
  formatPeriodRange,
  formatWorkSummaryTitle,
  formatWorkSummaryShortLabel,
  normalizeRowForPdf,
} from './workSummaryPdfExport';

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayDate = (d) => {
  if (!d) return '-';
  const text = String(d).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  return text;
};

const formatDateTime = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const extractListData = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
};

export default function WorkSummaryPdfHistory({ onPdfPreview }) {
  const [triggerPlantationsList] = useLazyGetPlantationsListQuery();
  const [plantations, setPlantations] = useState([]);
  const [plantationFilter, setPlantationFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loadDocument, { isLoading: loadingOne }] = useLazyGetWorkSummaryDocumentQuery();

  const { data: documents = [], isLoading, isFetching, refetch } = useListWorkSummaryDocumentsQuery({
    plantation_id: plantationFilter || undefined,
    doc_type: 'pdf',
    limit: 200,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const result = await triggerPlantationsList(undefined, true);
        setPlantations(extractListData(result?.data));
      } catch {
        setPlantations([]);
      }
    };
    load();
  }, [triggerPlantationsList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => {
      const hay = [
        doc.id,
        doc.pdf_id,
        doc.pdf_file_name,
        formatWorkSummaryTitle(doc.period_start, doc.pdf_id ?? doc.id),
        formatWorkSummaryShortLabel(doc.period_start, doc.pdf_id ?? doc.id),
        doc.plantation_name,
        doc.created_by_name,
        doc.period_start,
        doc.period_end,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [documents, search]);

  const openDocument = async (pdfId) => {
    try {
      const full = await loadDocument(pdfId).unwrap();
      onPdfPreview?.(full);
    } catch {
      toast.error('Could not load PDF history');
    }
  };

  const downloadPdf = async (pdfId, e) => {
    e?.stopPropagation?.();
    try {
      const full = await loadDocument(pdfId).unwrap();
      if (!full?.lines?.length) {
        toast.error('No rows in snapshot - cannot rebuild PDF');
        return;
      }
      downloadWorkSummaryPdfFromSnapshot(full);
      toast.success(`Downloaded ${getWorkSummaryPdfFileName(pdfId)}`);
    } catch {
      toast.error('Could not download PDF');
    }
  };

  const loading = isLoading || isFetching;

  return (
    <div className="finance plantation-invoice-history work-summary-pdf-history">
      <div className="plantation-invoice-history-toolbar">
        <div className="plantation-invoice-history-filters">
          <div>
            <label htmlFor="pdf-history-plantation">Plantation</label>
            <select
              id="pdf-history-plantation"
              value={plantationFilter}
              onChange={(e) => setPlantationFilter(e.target.value)}
            >
              <option value="">All plantations</option>
              {plantations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plantation}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pdf-history-search">Search</label>
            <input
              id="pdf-history-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Month, plantation, creator…"
              autoComplete="off"
            />
          </div>
        </div>
        <button
          type="button"
          className="plantation-invoice-btn plantation-invoice-btn-secondary"
          onClick={() => refetch()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="plantation-invoice-history-loading">
          <Bars height={48} width={48} color="#1d4ed8" ariaLabel="loading" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="plantation-invoice-history-empty">No saved work summary exports found.</p>
      ) : (
        <div className="finance-table-container">
          <table className="finance-report-table plantation-invoice-history-table">
            <thead>
              <tr>
                <th>Work Summary</th>
                <th>Plantation</th>
                <th>Period</th>
                <th>Billing (Ha)</th>
                <th>Rows</th>
                <th>Excluded</th>
                <th>Created by</th>
                <th>Created at</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const pdfId = row.pdf_id ?? row.id;
                const title = formatWorkSummaryTitle(row.period_start, pdfId);
                const actionLabel = formatWorkSummaryShortLabel(row.period_start, pdfId);
                return (
                <tr key={row.id}>
                  <td>{title}</td>
                  <td>{row.plantation_name || '-'}</td>
                  <td>{formatPeriodRange(row.period_start, row.period_end)}</td>
                  <td>{formatMoney(row.total_billing_ha)}</td>
                  <td>{row.total_rows ?? '-'}</td>
                  <td>{row.excluded_rows ?? 0}</td>
                  <td>{row.created_by_name || '-'}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td className="work-summary-pdf-history-actions">
                    <button
                      type="button"
                      className="plantation-invoice-btn plantation-invoice-btn-link work-summary-pdf-history-btn"
                      disabled={loadingOne}
                      onClick={() => openDocument(pdfId)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="plantation-invoice-btn plantation-invoice-btn-link work-summary-pdf-history-btn work-summary-pdf-history-btn-download"
                      disabled={loadingOne}
                      onClick={(e) => downloadPdf(pdfId, e)}
                      title={title}
                    >
                      {actionLabel}
                    </button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
