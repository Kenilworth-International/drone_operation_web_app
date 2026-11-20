import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import * as XLSX from 'xlsx-js-style';
import { FiDownload } from 'react-icons/fi';
import 'react-datepicker/dist/react-datepicker.css';
import '../../../styles/planExecutionReport.css';
import { useLazyGetManagementPlanExecutionReportQuery } from '../../../api/services NodeJs/financeReportApi';
import { useSyncShellPeriod } from './ReportsPeriodContext';

const toYmd = (date) => date.toLocaleDateString('en-CA');
const toDisplay = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
};
const splitReasonLines = (value) =>
  String(value || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

/** Deactivated rows override covered-based coloring. */
function coveredRowStyleKey(field, plan) {
  if (plan?.is_deactivated) {
    if (Number(plan.deactivate_reason_id) === 1) return 'deactYellow';
    return 'deactGray';
  }
  if (field == null || typeof field !== 'object') return 'covBlue';
  const c = Number(field.covered);
  if (field.covered != null && !Number.isNaN(c) && c > 0) return 'covGreen';
  return 'covBlue';
}

const PLAN_ROW_CLASS = {
  covGreen: 'plan-excu-row-cov-green',
  covBlue: 'plan-excu-row-cov-blue',
  deactYellow: 'plan-excu-row-deact-yellow',
  deactGray: 'plan-excu-row-deact-gray',
};

/** xlsx-js-style expects 6-char RGB (package README); matches CSS row tints in planExecutionReport.css */
const EXCEL_FILL = {
  header: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
  neutral: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
  covGreen: { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } },
  covBlue: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
  deactYellow: { patternType: 'solid', fgColor: { rgb: 'FEF08A' } },
  deactGray: { patternType: 'solid', fgColor: { rgb: 'D1D5DB' } },
  total: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
  grand: { patternType: 'solid', fgColor: { rgb: 'E0E7FF' } },
};

/** Filled cells hide Excel’s default gridlines — apply thin borders on all sides so rows/columns stay visible */
const EXCEL_GRID_BORDER = {
  top: { style: 'thin', color: { rgb: '9CA3AF' } },
  bottom: { style: 'thin', color: { rgb: '9CA3AF' } },
  left: { style: 'thin', color: { rgb: '9CA3AF' } },
  right: { style: 'thin', color: { rgb: '9CA3AF' } },
};

/** Compact Excel row height (points). Avoid wrapText on all cells — that makes Excel inflate row heights. */
function reasonHasOpsAndPilot(reasonText) {
  const s = String(reasonText || '').toLowerCase();
  return /ops\s*:/.test(s) && /pilot\s*:/.test(s);
}

/**
 * One pass per report: per-plan sums, plan covered % = avg of field covered (exclude 0 & null),
 * grand sums + grand covered % = avg of all field covered values (>0) across plans.
 */
function aggregateReport(plans) {
  const planRows = [];
  let gField = 0;
  let gOps = 0;
  let gPilot = 0;
  let gBill = 0;
  const coveredForGrand = [];

  for (const plan of plans) {
    const fields = Array.isArray(plan.fields) ? plan.fields : [];
    let tField = 0;
    let tOps = 0;
    let tPilot = 0;
    let tBill = 0;
    const coveredForPlan = [];

    fields.forEach((f) => {
      tField += Number(f.field_size) || 0;
      tOps += Number(f.completed) || 0;
      tPilot += Number(f.completed_pilot) || 0;
      tBill += Number(f.billing_extent) || 0;
      const c = Number(f.covered);
      if (f.covered != null && !Number.isNaN(c) && c > 0) {
        coveredForPlan.push(c);
        coveredForGrand.push(c);
      }
    });

    const planCoveredStr = coveredForPlan.length === 0
      ? '0.00%'
      : `${(coveredForPlan.reduce((a, b) => a + b, 0) / coveredForPlan.length).toFixed(2)}%`;

    gField += tField;
    gOps += tOps;
    gPilot += tPilot;
    gBill += tBill;

    planRows.push({
      plan,
      fields,
      totals: {
        totalField: tField,
        totalCompletedOps: tOps,
        totalCompletedPilot: tPilot,
        totalBilling: tBill,
        coveredPctStr: planCoveredStr,
      },
    });
  }

  const grandCoveredStr = coveredForGrand.length === 0
    ? '0.00%'
    : `${(coveredForGrand.reduce((a, b) => a + b, 0) / coveredForGrand.length).toFixed(2)}%`;

  return {
    planRows,
    grand: {
      totalField: gField,
      totalCompletedOps: gOps,
      totalCompletedPilot: gPilot,
      totalBilling: gBill,
      coveredPctStr: grandCoveredStr,
    },
  };
}

function excelRowHeightHpt(aoaRow, rowIndex) {
  if (rowIndex === 0) return 18;
  if (!aoaRow) return 15;
  const planIdCell = aoaRow[2];
  if (typeof planIdCell === 'string' && planIdCell.includes('Total')) return 16;
  const reason = String(aoaRow[10] ?? '');
  const lines = reason.trim() ? reason.split(/\r?\n/).length : 1;
  let hpt = Math.min(Math.max(14, 12 + (lines - 1) * 11), 70);
  if (reasonHasOpsAndPilot(reason)) {
    hpt = Math.min(hpt + 8, 78);
  }
  return hpt;
}

const PlanExecutionReasonReport = () => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());
  useSyncShellPeriod(setStartDate, setEndDate);
  const [pilotFilter, setPilotFilter] = useState('');
  const [estateFilter, setEstateFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [trigger, { data = [], isFetching }] = useLazyGetManagementPlanExecutionReportQuery();

  useEffect(() => {
    if (!startDate || endDate == null) return;
    trigger({ start_date: toYmd(startDate), end_date: toYmd(endDate) }, true);
  }, [startDate, endDate, trigger]);

  const filteredPlans = useMemo(
    () =>
      (data || []).filter((p) => {
        const statusOk = statusFilter === 'all'
          || (statusFilter === 'active' && !p.is_deactivated)
          || (statusFilter === 'deactivated' && p.is_deactivated);
        return statusOk
          && (!pilotFilter || (p.pilot || '').includes(pilotFilter))
          && (!estateFilter || p.estate === estateFilter)
          && (!planFilter || String(p.plan_id) === String(planFilter));
      }),
    [data, pilotFilter, estateFilter, planFilter, statusFilter]
  );

  const pilotOptions = useMemo(() => [...new Set((data || []).map((p) => p.pilot).filter(Boolean))], [data]);
  const estateOptions = useMemo(() => [...new Set((data || []).map((p) => p.estate).filter(Boolean))], [data]);
  const planOptions = useMemo(() => [...new Set((data || []).map((p) => p.plan_id).filter(Boolean))], [data]);

  const reportAgg = useMemo(() => aggregateReport(filteredPlans), [filteredPlans]);

  const exportExcel = () => {
    const headers = ['Date', 'Pilot', 'PlanID', 'Estate', 'Field Name', 'Field Size (Ha)', 'Completed (Ha)(Ops)', 'Completed (Ha)(Pilot)', 'Covered %', 'Billing Extent', 'If Canceled/Deactivated - Reasons'];
    const aoa = [headers];
    const merges = [];
    /** Parallel to data rows only (aoa rows 1..n-1); each entry: covGreen | covBlue | total | grand */
    const rowStyles = [];
    let currentRow = 1;

    const { planRows, grand } = reportAgg;

    planRows.forEach(({ plan, fields, totals }) => {
      const fieldRows = fields.length > 0 ? fields : [{}];
      const startRow = currentRow;
      fieldRows.forEach((f, idx) => {
        rowStyles.push(coveredRowStyleKey(f, plan));
        aoa.push([
          idx === 0 ? toDisplay(plan.date) : '',
          idx === 0 ? (plan.pilot || '') : '',
          idx === 0 ? plan.plan_id : '',
          idx === 0 ? (plan.estate || '') : '',
          f.field_name || '',
          (Number(f.field_size) || 0).toFixed(2),
          (Number(f.completed) || 0).toFixed(2),
          (Number(f.completed_pilot) || 0).toFixed(2),
          `${(Number(f.covered) || 0).toFixed(2)}%`,
          (Number(f.billing_extent) || 0).toFixed(2),
          splitReasonLines(f.reasons).join('\n'),
        ]);
        currentRow += 1;
      });

      const endRow = currentRow - 1;
      if (endRow > startRow) {
        [0, 1, 2, 3].forEach((c) => {
          merges.push({ s: { r: startRow, c }, e: { r: endRow, c } });
        });
      }

      if (!plan.is_deactivated) {
        rowStyles.push('total');
        aoa.push([
          '',
          '',
          `Plan ${plan.plan_id} Total`,
          '',
          '',
          totals.totalField.toFixed(2),
          totals.totalCompletedOps.toFixed(2),
          totals.totalCompletedPilot.toFixed(2),
          totals.coveredPctStr,
          totals.totalBilling.toFixed(2),
          '',
        ]);
        currentRow += 1;
      }
    });

    if (planRows.length > 0) {
      rowStyles.push('grand');
      aoa.push([
        '',
        '',
        'Grand Total',
        '',
        '',
        grand.totalField.toFixed(2),
        grand.totalCompletedOps.toFixed(2),
        grand.totalCompletedPilot.toFixed(2),
        grand.coveredPctStr,
        grand.totalBilling.toFixed(2),
        '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (merges.length > 0) ws['!merges'] = merges;
    /* 11 columns (A–K): last col = reasons — was missing before, so Excel used a default narrow width */
    ws['!cols'] = [
      { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 20 }, { wch: 24 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      { wch: 58 },
    ];

    const headerStyle = {
      font: { bold: true, color: { rgb: '004B71' } },
      fill: EXCEL_FILL.header,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '004B71' } },
        bottom: { style: 'thin', color: { rgb: '004B71' } },
        left: { style: 'thin', color: { rgb: '004B71' } },
        right: { style: 'thin', color: { rgb: '004B71' } },
      },
    };
    const centerTight = {
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    };
    const fieldNameStyle = {
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    };
    const reasonsColStyle = {
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    };

    const fillForRowKind = (kind) => {
      if (kind === 'grand') return EXCEL_FILL.grand;
      if (kind === 'total') return EXCEL_FILL.total;
      if (kind === 'deactYellow') return EXCEL_FILL.deactYellow;
      if (kind === 'deactGray') return EXCEL_FILL.deactGray;
      if (kind === 'covGreen') return EXCEL_FILL.covGreen;
      return EXCEL_FILL.covBlue;
    };

    // Ensure field + numeric columns exist so fill applies (avoid creating cols 0–3 on merge continuation rows)
    const numCols = headers.length;
    for (let r = 1; r < aoa.length; r += 1) {
      for (let c = 4; c < numCols; c += 1) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };
      }
    }

    // Header row
    headers.forEach((_, c) => {
      const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: headers[c] };
      ws[cellAddr].s = headerStyle;
    });

    // Data rows: Date–Estate (cols A–D) stay white; covered tint from field name onward.
    for (let r = 1; r < aoa.length; r += 1) {
      const kind = rowStyles[r - 1] ?? 'covBlue';
      for (let c = 0; c < numCols; c += 1) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddr]) continue;
        const fill = c <= 3 ? EXCEL_FILL.neutral : fillForRowKind(kind);
        const base = c === 10 ? reasonsColStyle : c === 4 ? fieldNameStyle : centerTight;
        ws[cellAddr].s = { ...base, fill, border: EXCEL_GRID_BORDER };
        if (kind === 'total' || kind === 'grand') {
          ws[cellAddr].s = { ...ws[cellAddr].s, font: { bold: true } };
        }
      }
    }

    ws['!rows'] = new Array(aoa.length);
    for (let r = 0; r < aoa.length; r += 1) {
      ws['!rows'][r] = { hpt: excelRowHeightHpt(aoa[r], r) };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PlanExecution');
    const exportEnd = endDate ?? startDate;
    XLSX.writeFile(wb, `Management_Plan_Execution_${toYmd(startDate)}_to_${toYmd(exportEnd)}.xlsx`);
  };

  const controlsDisabled = isFetching;
  const onRangeChange = (dates) => {
    const [start, end] = dates ?? [];
    if (start == null && end == null) return;
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="plan-excu-container">
      <div className={`plan-excu-filters${controlsDisabled ? ' plan-excu-filters-disabled' : ''}`}>
        <div className="plan-excu-filters-inner">
          <div className="plan-excu-top">
            <div className="plan-excu-date-range">
              <label>Date range</label>
              <DatePicker
                selectsRange
                startDate={startDate}
                endDate={endDate}
                onChange={onRangeChange}
                disabled={controlsDisabled}
                dateFormat="dd-MM-yyyy"
                placeholderText="Select date range"
                className="plan-excu-range-input"
              />
            </div>
            <div className="plan-excu-field">
              <label htmlFor="plan-excu-status">Status</label>
              <select
                id="plan-excu-status"
                value={statusFilter}
                disabled={controlsDisabled}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>
            <div className="plan-excu-align">
              <select value={pilotFilter} disabled={controlsDisabled} onChange={(e) => setPilotFilter(e.target.value)}>
                <option value="">All Pilots</option>
                {pilotOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="plan-excu-align">
              <select value={estateFilter} disabled={controlsDisabled} onChange={(e) => setEstateFilter(e.target.value)}>
                <option value="">All Estates</option>
                {estateOptions.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="plan-excu-align">
              <select value={planFilter} disabled={controlsDisabled} onChange={(e) => setPlanFilter(e.target.value)}>
                <option value="">All Plans</option>
                {planOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="plan-excu-align">
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={exportExcel}
                className="flex items-center bg-green-500 text-white m-0 plan-excu-excel-btn"
              >
                <FiDownload className="mr-2" /> Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="plan-excu-table-wrap">
        {isFetching && (
          <div className="plan-excu-fetch-overlay" aria-live="polite">
            Loading…
          </div>
        )}
        <table className={`plan-excu-table${isFetching ? ' plan-excu-table-dimmed' : ''}`}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Pilot</th>
                <th>PlanID</th>
                <th>Estate</th>
                <th>Field Name</th>
                <th>Field Size (Ha)</th>
                <th>Completed (Ha)(Ops)</th>
                <th>Completed (Ha)(Pilot)</th>
                <th>Covered %</th>
                <th>Billing Extent</th>
                <th>If Canceled/Deactivated - Reasons</th>
              </tr>
            </thead>
            <tbody>
              {reportAgg.planRows.map(({ plan, fields, totals }) => {
                const fieldRows = fields.length > 0 ? fields : [{}];
                return (
                  <React.Fragment key={plan.plan_id}>
                    {fieldRows.map((f, idx) => (
                      <tr
                        key={`${plan.plan_id}-${idx}`}
                        className={PLAN_ROW_CLASS[coveredRowStyleKey(f, plan)]}
                      >
                        {idx === 0 && (
                          <>
                            <td rowSpan={fieldRows.length} className="plan-excu-lead-merge">
                              {toDisplay(plan.date)}
                            </td>
                            <td rowSpan={fieldRows.length} className="plan-excu-lead-merge">
                              {plan.pilot || ''}
                            </td>
                            <td rowSpan={fieldRows.length} className="plan-excu-lead-merge">
                              {plan.plan_id}
                            </td>
                            <td rowSpan={fieldRows.length} className="plan-excu-lead-merge">
                              {plan.estate || ''}
                            </td>
                          </>
                        )}
                        <td className="plan-excu-metric-cell">{f.field_name || ''}</td>
                        <td className="plan-excu-metric-cell">{(Number(f.field_size) || 0).toFixed(2)}</td>
                        <td className="plan-excu-metric-cell">{(Number(f.completed) || 0).toFixed(2)}</td>
                        <td className="plan-excu-metric-cell">{(Number(f.completed_pilot) || 0).toFixed(2)}</td>
                        <td className="plan-excu-metric-cell">{(Number(f.covered) || 0).toFixed(2)}%</td>
                        <td className="plan-excu-metric-cell">{(Number(f.billing_extent) || 0).toFixed(2)}</td>
                        <td className="plan-excu-reasons-cell plan-excu-metric-cell">
                          <div className="plan-excu-reasons">
                            {splitReasonLines(f.reasons).length > 0
                              ? splitReasonLines(f.reasons).map((line, lineIdx) => (
                                <div key={lineIdx}>{line}</div>
                              ))
                              : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!plan.is_deactivated && (
                    <tr className="plan-excu-row-total">
                      <td colSpan={5}>{`Plan ${plan.plan_id} Total`}</td>
                      <td>{totals.totalField.toFixed(2)}</td>
                      <td>{totals.totalCompletedOps.toFixed(2)}</td>
                      <td>{totals.totalCompletedPilot.toFixed(2)}</td>
                      <td>{totals.coveredPctStr}</td>
                      <td>{totals.totalBilling.toFixed(2)}</td>
                      <td></td>
                    </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {reportAgg.planRows.length > 0 && (
                <tr className="plan-excu-row-grand">
                  <td colSpan={5}>Grand Total</td>
                  <td>{reportAgg.grand.totalField.toFixed(2)}</td>
                  <td>{reportAgg.grand.totalCompletedOps.toFixed(2)}</td>
                  <td>{reportAgg.grand.totalCompletedPilot.toFixed(2)}</td>
                  <td>{reportAgg.grand.coveredPctStr}</td>
                  <td>{reportAgg.grand.totalBilling.toFixed(2)}</td>
                  <td></td>
                </tr>
              )}
              {reportAgg.planRows.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center' }}>No data available</td></tr>
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
};

export default PlanExecutionReasonReport;

