import React, { useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Bars } from 'react-loader-spinner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import { FaBan } from 'react-icons/fa';
import 'react-datepicker/dist/react-datepicker.css';
import '../../../styles/deactivatedPlansReport.css';
import { useLazyGetDeactivatedPlansReportQuery } from '../../../api/services NodeJs/financeReportApi';
import { useGetDeactivateReasonsQuery } from '../../../api/services NodeJs/reasonsApi';
import { useSyncShellPeriod } from '../../management/reports/ReportsPeriodContext';

const toYmd = (date) => date.toLocaleDateString('en-CA');

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '—';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateStr;
};

export default function DeactivatedPlansReport() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  useSyncShellPeriod(setStartDate, setEndDate);
  const [reasonFilter, setReasonFilter] = useState('');
  const [plantationFilter, setPlantationFilter] = useState('');
  const [estateFilter, setEstateFilter] = useState('');
  const [plans, setPlans] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [fetchReport, { isLoading, isFetching }] = useLazyGetDeactivatedPlansReportQuery();
  const { data: deactivateReasonsList = [] } = useGetDeactivateReasonsQuery({ include_inactive: true });

  const handleGenerate = async () => {
    setPlantationFilter('');
    setEstateFilter('');
    try {
      const result = await fetchReport({
        start_date: toYmd(startDate),
        end_date: toYmd(endDate),
        deactivate_reason_id: reasonFilter ? Number(reasonFilter) : undefined,
      }).unwrap();
      setPlans(Array.isArray(result?.plans) ? result.plans : []);
      setHasGenerated(true);
    } catch (e) {
      console.error(e);
      setPlans([]);
      setHasGenerated(true);
    }
  };

  const reasonOptions = useMemo(() => {
    const byId = new Map();
    deactivateReasonsList.forEach((r) => {
      if (r.id != null && r.reason) {
        byId.set(String(r.id), r.reason);
      }
    });
    plans.forEach((row) => {
      if (row.deactivate_reason_id && row.deactivate_reason && row.deactivate_reason !== '—') {
        byId.set(String(row.deactivate_reason_id), row.deactivate_reason);
      }
    });
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [deactivateReasonsList, plans]);

  const plantationOptions = useMemo(() => {
    const names = [...new Set(plans.map((p) => p.plantation_name).filter((n) => n && n !== '—'))];
    return names.sort();
  }, [plans]);

  const estateOptions = useMemo(() => {
    const names = [...new Set(plans.map((p) => p.estate_name).filter((n) => n && n !== '—'))];
    return names.sort();
  }, [plans]);

  const filtered = useMemo(
    () =>
      plans.filter((row) => {
        if (reasonFilter && String(row.deactivate_reason_id) !== String(reasonFilter)) {
          return false;
        }
        if (plantationFilter && row.plantation_name !== plantationFilter) return false;
        if (estateFilter && row.estate_name !== estateFilter) return false;
        return true;
      }),
    [plans, reasonFilter, plantationFilter, estateFilter]
  );

  const loading = isLoading || isFetching;

  const exportRows = () =>
    filtered.map((row) => ({
      'Plan ID': row.plan_id,
      'Plan Date': formatDisplayDate(row.plan_date),
      Plantation: row.plantation_name,
      Estate: row.estate_name,
      'Total Extent (Ha)': Number(row.total_extent || 0).toFixed(2),
      'Deactivate Reason': row.deactivate_reason,
      'Deactivated By': row.deactivated_by_name,
      'Deactivated At': row.deactivated_at || '—',
    }));

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deactivated Plans');
    XLSX.writeFile(
      wb,
      `Deactivated_Plans_${toYmd(startDate)}_to_${toYmd(endDate)}.xlsx`
    );
  };

  const downloadPdf = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('Deactivated Plans with Reason', 14, 16);
    doc.setFontSize(10);
    doc.text(`Period: ${formatDisplayDate(toYmd(startDate))} – ${formatDisplayDate(toYmd(endDate))}`, 14, 24);

    autoTable(doc, {
      head: [
        [
          'Plan ID',
          'Plan Date',
          'Plantation',
          'Estate',
          'Extent (Ha)',
          'Deactivate Reason',
          'Deactivated By',
          'Deactivated At',
        ],
      ],
      body: filtered.map((row) => [
        row.plan_id,
        formatDisplayDate(row.plan_date),
        row.plantation_name,
        row.estate_name,
        Number(row.total_extent || 0).toFixed(2),
        row.deactivate_reason,
        row.deactivated_by_name,
        row.deactivated_at || '—',
      ]),
      startY: 30,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [0, 75, 113] },
    });

    doc.save(`Deactivated_Plans_${toYmd(startDate)}_to_${toYmd(endDate)}.pdf`);
  };

  return (
    <div className="deactivated-plans-report">
      <div className="deactivated-plans-toolbar">
        <div className="deactivated-plans-fields">
          <div className="deactivated-plans-field deactivated-plans-field--date">
            <span className="deactivated-plans-field-label">From</span>
            <DatePicker
              selected={startDate}
              onChange={(d) => d && setStartDate(d)}
              dateFormat="dd/MM/yyyy"
              wrapperClassName="deactivated-plans-datepicker-wrap"
              className="deactivated-plans-date-input"
            />
          </div>
          <div className="deactivated-plans-field deactivated-plans-field--date">
            <span className="deactivated-plans-field-label">To</span>
            <DatePicker
              selected={endDate}
              onChange={(d) => d && setEndDate(d)}
              dateFormat="dd/MM/yyyy"
              wrapperClassName="deactivated-plans-datepicker-wrap"
              className="deactivated-plans-date-input"
            />
          </div>
          <div className="deactivated-plans-field deactivated-plans-field--select deactivated-plans-field--reason">
            <span className="deactivated-plans-field-label">Deactivate Reason</span>
            <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
              <option value="">All</option>
              {reasonOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="deactivated-plans-field deactivated-plans-field--select">
            <span className="deactivated-plans-field-label">Plantation</span>
            <select value={plantationFilter} onChange={(e) => setPlantationFilter(e.target.value)}>
              <option value="">All</option>
              {plantationOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="deactivated-plans-field deactivated-plans-field--select">
            <span className="deactivated-plans-field-label">Estate</span>
            <select value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)}>
              <option value="">All</option>
              {estateOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="deactivated-plans-actions">
          <button
            type="button"
            className="deactivated-plans-btn deactivated-plans-btn--generate"
            onClick={handleGenerate}
            disabled={loading || !startDate || !endDate}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
          <button
            type="button"
            className="deactivated-plans-btn deactivated-plans-btn--excel"
            onClick={downloadExcel}
            disabled={!filtered.length}
          >
            <FiDownload /> Excel
          </button>
          <button
            type="button"
            className="deactivated-plans-btn deactivated-plans-btn--pdf"
            onClick={downloadPdf}
            disabled={!filtered.length}
          >
            <FiPrinter /> PDF
          </button>
        </div>
      </div>

      {hasGenerated ? (
        <div className="deactivated-plans-summary">
          <FaBan aria-hidden />
          <span>
            <strong>{filtered.length}</strong> deactivated plan{filtered.length === 1 ? '' : 's'}
            {filtered.length !== plans.length ? ` (of ${plans.length} in range)` : ''}
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="deactivated-plans-loading">
          <Bars height={48} width={48} color="#004b71" ariaLabel="loading" />
        </div>
      ) : !hasGenerated ? (
        <p className="deactivated-plans-empty">
          Select a date range and click <strong>Generate</strong> to load deactivated plans.
        </p>
      ) : filtered.length === 0 ? (
        <p className="deactivated-plans-empty">No deactivated plans found for the selected period.</p>
      ) : (
        <div className="deactivated-plans-table-wrap">
          <table className="deactivated-plans-table">
            <thead>
              <tr>
                <th>Plan ID</th>
                <th>Plan Date</th>
                <th>Plantation</th>
                <th>Estate</th>
                <th>Extent (Ha)</th>
                <th>Deactivate Reason</th>
                <th>Deactivated By</th>
                <th>Deactivated At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.plan_id}>
                  <td>{row.plan_id}</td>
                  <td>{formatDisplayDate(row.plan_date)}</td>
                  <td>{row.plantation_name}</td>
                  <td>{row.estate_name}</td>
                  <td>{Number(row.total_extent || 0).toFixed(2)}</td>
                  <td className="deactivated-plans-reason-cell">{row.deactivate_reason}</td>
                  <td>{row.deactivated_by_name}</td>
                  <td>{row.deactivated_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
