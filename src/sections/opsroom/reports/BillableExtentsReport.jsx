import React, { useEffect, useMemo, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import { FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  useGetBillableExtentsPlantationsQuery,
  useLazyGetBillableExtentsEstatesQuery,
  useLazyGetBillableExtentsReportQuery,
} from '../../../api/services NodeJs/billableExtentsReportApi';
import '../../../styles/billableExtentsReport.css';
import { useReportsPeriod } from '../../management/reports/ReportsPeriodContext';
import { useOpsReportWorkspace } from '../../management/reports/OpsReportWorkspaceContext';
import OpsReportViewToggle from '../../management/reports/OpsReportViewToggle';
import { OpsDateRangeControls, startOfMonthDate } from '../../management/reports/OpsPeriodControls';
import { toYmd } from '../../management/reports/reportsExcelExport';
import '../../management/reports/reportsDecisionShell.css';

function fmtHa(n) {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TABS = [
  { key: 'plantation', label: 'Plantation' },
  { key: 'estate', label: 'Estate' },
  { key: 'field', label: 'Field by field' },
];

export default function BillableExtentsReport({ onExportReady }) {
  const workspace = useOpsReportWorkspace();
  const { data: plantations = [], isLoading: loadingPlantations } =
    useGetBillableExtentsPlantationsQuery();
  const [fetchEstates, { data: estates = [], isFetching: loadingEstates }] =
    useLazyGetBillableExtentsEstatesQuery();
  const [fetchReport, { data: report, isFetching: loadingReport, error }] =
    useLazyGetBillableExtentsReportQuery();

  const shellPeriod = useReportsPeriod();
  const [startDate, setStartDate] = useState(() => startOfMonthDate());
  const [endDate, setEndDate] = useState(() => new Date());
  const [view, setView] = useState('chart');

  useEffect(() => {
    if (!shellPeriod?.startYmd || !shellPeriod?.endYmd) return;
    setStartDate(new Date(`${shellPeriod.startYmd}T00:00:00`));
    setEndDate(new Date(`${shellPeriod.endYmd}T00:00:00`));
  }, [shellPeriod?.startYmd, shellPeriod?.endYmd]);

  const [plantationId, setPlantationId] = useState('');
  const [selectedEstates, setSelectedEstates] = useState([]);
  const [missionType, setMissionType] = useState('all');
  const [tab, setTab] = useState('field');

  const startYmd = toYmd(startDate);
  const endYmd = toYmd(endDate);

  useEffect(() => {
    if (!plantationId) {
      setSelectedEstates([]);
      return;
    }
    fetchEstates(Number(plantationId));
    setSelectedEstates([]);
  }, [plantationId, fetchEstates]);

  const canGenerate =
    Boolean(startYmd) && Boolean(endYmd) && Boolean(plantationId) && !loadingReport;

  const handleGenerate = () => {
    if (!canGenerate) return;
    fetchReport({
      start_date: startYmd,
      end_date: endYmd,
      plantation_id: Number(plantationId),
      estates: selectedEstates.map(Number),
      mission_type: missionType,
    });
  };

  // Ops workspace: auto-load when period / plantation / filters change
  useEffect(() => {
    if (!workspace?.setSidebar) return;
    if (!startYmd || !endYmd || !plantationId) return;
    let cancelled = false;
    (async () => {
      try {
        await fetchReport({
          start_date: startYmd,
          end_date: endYmd,
          plantation_id: Number(plantationId),
          estates: selectedEstates.map(Number),
          mission_type: missionType,
        });
      } catch (_) {
        /* RTK query surfaces error */
      }
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspace?.setSidebar,
    startYmd,
    endYmd,
    plantationId,
    selectedEstates,
    missionType,
  ]);

  const summary = report?.summary || null;

  const downloadExcel = () => {
    const rows = report?.fields || [];
    if (!rows.length) return;
    const excelData = rows.map((r) => ({
      Date: r.plan_date || '',
      Plan: r.plan_id || '',
      Plantation: r.plantation_name || '',
      Estate: r.estate_name || '',
      Field: r.field_name || '',
      Mission: r.mission_type_name || '',
      'Field (Ha)': r.is_manager_canceled ? '' : Number(r.field_ha) || 0,
      'DJI Sprayed (Ha)': r.is_manager_canceled ? '' : Number(r.sprayed_ha) || 0,
      'Covered %': r.is_manager_canceled ? '' : Number(r.covered_pct) || 0,
      Chargeable: r.chargeable ? 'Yes' : 'No',
      Reason: r.reason || '',
      Bill: r.bill || '',
      'Billing (Ha)': r.is_manager_canceled ? '' : Number(r.billing_ha) || 0,
      Issue: r.extent_issue ? 'Field Ha < DJI Ha' : '',
      'Manager canceled': r.is_manager_canceled ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Billable Extents');
    XLSX.writeFile(wb, `Billable_Extents_${startYmd}_${endYmd}.xlsx`);
  };

  useEffect(() => {
    onExportReady?.(downloadExcel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, startYmd, endYmd]);

  const plantationRows = useMemo(() => report?.by_plantation || [], [report]);
  const estateRows = useMemo(() => report?.by_estate || [], [report]);
  const fieldRows = useMemo(() => report?.fields || [], [report]);

  const chartData = useMemo(() => {
    if (estateRows.length > 0) {
      return estateRows
        .map((r) => ({
          name: r.estate_name || 'Unknown',
          field: Number(Number(r.field_ha || 0).toFixed(2)),
          dji: Number(Number(r.sprayed_ha || 0).toFixed(2)),
          billing: Number(Number(r.billing_ha || 0).toFixed(2)),
        }))
        .sort((a, b) => b.field - a.field);
    }
    if (summary) {
      return [
        {
          name: 'Total',
          field: Number(Number(summary.field_ha || 0).toFixed(2)),
          dji: Number(Number(summary.sprayed_ha || 0).toFixed(2)),
          billing: Number(Number(summary.billing_ha || 0).toFixed(2)),
        },
      ];
    }
    return [];
  }, [estateRows, summary]);

  useEffect(() => {
    if (!workspace?.setSidebar) return undefined;
    workspace.setSidebar(
      <div className="rds-ops-controls">
        <OpsDateRangeControls
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
        <OpsReportViewToggle view={view} onChange={setView} />
        <div className="rds-ops-controls-block">
          <div className="rds-ops-controls-label">Plantation</div>
          <label className="rds-ops-field">
            <span>Plantation</span>
            <select
              value={plantationId}
              onChange={(e) => setPlantationId(e.target.value)}
              disabled={loadingPlantations}
            >
              <option value="">Select…</option>
              {plantations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="rds-ops-field">
            <span>Mission</span>
            <select value={missionType} onChange={(e) => setMissionType(e.target.value)}>
              <option value="all">All</option>
              <option value="spy">Spray</option>
              <option value="spd">Spread</option>
            </select>
          </label>
        </div>
        {plantationId && (
          <div className="rds-ops-controls-block">
            <div className="rds-ops-controls-label">Estates (optional)</div>
            {loadingEstates ? (
              <div className="rds-empty" style={{ padding: 8 }}>Loading…</div>
            ) : (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {(estates || []).map((e) => (
                  <label
                    key={e.id}
                    className="rds-ops-field"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEstates.includes(String(e.id)) || selectedEstates.includes(e.id)}
                      onChange={() => {
                        const id = String(e.id);
                        setSelectedEstates((prev) => {
                          const asStr = prev.map(String);
                          return asStr.includes(id)
                            ? asStr.filter((x) => x !== id)
                            : [...asStr, id];
                        });
                      }}
                    />
                    <span>{e.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
    return () => workspace.clearSidebar?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    workspace?.setSidebar,
    startDate,
    endDate,
    view,
    plantationId,
    missionType,
    plantations,
    estates,
    selectedEstates,
    loadingPlantations,
    loadingEstates,
  ]);

  const summaryKpis = summary ? (
    <div className={workspace ? 'rds-metric-strip' : 'ber-kpis'}>
      {workspace ? (
        <>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Field (Ha)</div>
            <div className="rds-metric-strip-val">{fmtHa(summary.field_ha)}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">DJI Sprayed</div>
            <div className="rds-metric-strip-val">{fmtHa(summary.sprayed_ha)}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Billing (Ha)</div>
            <div className="rds-metric-strip-val">{fmtHa(summary.billing_ha)}</div>
          </div>
          <div className="rds-metric-strip-item">
            <div className="rds-metric-strip-lbl">Fields</div>
            <div className="rds-metric-strip-val">{summary.billable_field_count || 0}</div>
          </div>
        </>
      ) : (
        <>
          <div className="ber-kpi">
            <span>Field (Ha)</span>
            <strong>{fmtHa(summary.field_ha)}</strong>
          </div>
          <div className="ber-kpi">
            <span>DJI Sprayed (Ha)</span>
            <strong>{fmtHa(summary.sprayed_ha)}</strong>
          </div>
          <div className="ber-kpi">
            <span>Billing (Ha)</span>
            <strong>{fmtHa(summary.billing_ha)}</strong>
          </div>
          <div className="ber-kpi">
            <span>Fields</span>
            <strong>{summary.billable_field_count || 0}</strong>
          </div>
          <div className="ber-kpi">
            <span>Extent issues</span>
            <strong>{summary.extent_issue_count || 0}</strong>
          </div>
        </>
      )}
    </div>
  ) : null;

  const tablesBlock = summary ? (
    <>
      {!workspace && summaryKpis}

      <div className="ber-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            className={`ber-tab${tab === t.key ? ' active' : ''}`}
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plantation' ? (
        <div className={workspace ? 'rds-table-wrap' : 'ber-table-wrap'}>
          <table className={workspace ? 'rds-table' : 'ber-table'}>
            <thead>
              <tr>
                <th>Plantation</th>
                <th className="num">Estates</th>
                <th className="num">Fields</th>
                <th className="num">Field (Ha)</th>
                <th className="num">DJI Sprayed (Ha)</th>
                <th className="num">Billing (Ha)</th>
                <th className="num">Issues</th>
              </tr>
            </thead>
            <tbody>
              {plantationRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>No data</td>
                </tr>
              ) : (
                plantationRows.map((r) => (
                  <tr key={r.plantation_id}>
                    <td>{r.plantation_name || '—'}</td>
                    <td className="num">{r.estate_count}</td>
                    <td className="num">{r.billable_field_count}</td>
                    <td className="num">{fmtHa(r.field_ha)}</td>
                    <td className="num">{fmtHa(r.sprayed_ha)}</td>
                    <td className="num">{fmtHa(r.billing_ha)}</td>
                    <td className="num">{r.extent_issue_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'estate' ? (
        <div className={workspace ? 'rds-table-wrap' : 'ber-table-wrap'}>
          <table className={workspace ? 'rds-table' : 'ber-table'}>
            <thead>
              <tr>
                <th>Estate</th>
                <th className="num">Fields</th>
                <th className="num">Field (Ha)</th>
                <th className="num">DJI Sprayed (Ha)</th>
                <th className="num">Billing (Ha)</th>
                <th className="num">Issues</th>
              </tr>
            </thead>
            <tbody>
              {estateRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>No data</td>
                </tr>
              ) : (
                estateRows.map((r) => (
                  <tr key={r.estate_id}>
                    <td>{r.estate_name || '—'}</td>
                    <td className="num">{r.billable_field_count}</td>
                    <td className="num">{fmtHa(r.field_ha)}</td>
                    <td className="num">{fmtHa(r.sprayed_ha)}</td>
                    <td className="num">{fmtHa(r.billing_ha)}</td>
                    <td className="num">{r.extent_issue_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'field' ? (
        <div className={workspace ? 'rds-table-wrap' : 'ber-table-wrap'}>
          <table className={workspace ? 'rds-table' : 'ber-table'}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Estate</th>
                <th>Field</th>
                <th>Mission</th>
                <th className="num">Field (Ha)</th>
                <th className="num">DJI Sprayed (Ha)</th>
                <th className="num">Covered %</th>
                <th>Chargeable</th>
                <th>Reason</th>
                <th>Bill</th>
                <th className="num">Billing (Ha)</th>
                <th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {fieldRows.length === 0 ? (
                <tr>
                  <td colSpan={13}>No field rows for this period</td>
                </tr>
              ) : (
                fieldRows.map((r) => (
                  <tr
                    key={`${r.plan_id}-${r.field_id}`}
                    className={[
                      r.extent_issue ? 'issue' : '',
                      r.is_manager_canceled ? 'canceled' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <td>{r.plan_date || '—'}</td>
                    <td>{r.plan_id || '—'}</td>
                    <td>{r.estate_name || '—'}</td>
                    <td>{r.field_name || '—'}</td>
                    <td>{r.mission_type_name || '—'}</td>
                    <td className="num">
                      {r.is_manager_canceled ? '—' : fmtHa(r.field_ha)}
                    </td>
                    <td className="num">
                      {r.is_manager_canceled ? '—' : fmtHa(r.sprayed_ha)}
                    </td>
                    <td className="num">
                      {r.is_manager_canceled ? '—' : fmtHa(r.covered_pct)}
                    </td>
                    <td>{r.chargeable ? 'Yes' : 'No'}</td>
                    <td title={r.reason || ''}>
                      {r.reason
                        ? r.reason.length > 40
                          ? `${r.reason.slice(0, 40)}…`
                          : r.reason
                        : '—'}
                    </td>
                    <td>{r.bill || '—'}</td>
                    <td className="num">
                      {r.is_manager_canceled ? '—' : fmtHa(r.billing_ha)}
                    </td>
                    <td>{r.extent_issue ? 'Field Ha < DJI' : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  ) : null;

  const chartBlock =
    chartData.length > 0 ? (
      <div className="rds-ops-data">
        {summaryKpis}
        <div className="rds-chart-bleed">
          <div className="rds-chart-bleed-title">
            {estateRows.length > 0 ? 'By estate' : 'Summary'} · Field vs DJI vs Billing (Ha)
          </div>
          <ResponsiveContainer
            width="100%"
            height={Math.max(280, Math.min(520, chartData.length * 36))}
          >
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="#c9d9d2" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                angle={-25}
                textAnchor="end"
                height={56}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip />
              <Legend />
              <Bar dataKey="field" name="Field Ha" fill="#94a3b8" />
              <Bar dataKey="dji" name="DJI Sprayed" fill="#0f6b4c" />
              <Bar dataKey="billing" name="Billing Ha" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    ) : (
      <div className="rds-empty">
        {plantationId
          ? 'No chart data for this period.'
          : 'Select a plantation and period to view billable extents.'}
      </div>
    );

  if (workspace) {
    if (loadingReport && !report) {
      return (
        <div className="rds-loading">
          <Bars height={40} width={40} color="#0f6b4c" />
        </div>
      );
    }
    return (
      <div className="rds-ops-data">
        {error ? (
          <div className="rds-empty">
            {error?.data?.message || error?.error || 'Failed to load report'}
          </div>
        ) : loadingReport ? (
          <div className="rds-loading">
            <Bars height={40} width={40} color="#0f6b4c" />
          </div>
        ) : view === 'chart' ? (
          chartBlock
        ) : summary ? (
          tablesBlock
        ) : (
          <div className="rds-empty">
            Select plantation and dates in Data view to load billable extents.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ber-page">
      <div className="ber-filters">
        <div className="ber-field">
          <label htmlFor="ber-start">Start date</label>
          <input
            id="ber-start"
            type="date"
            value={startYmd}
            onChange={(e) => {
              if (!e.target.value) return;
              setStartDate(new Date(`${e.target.value}T00:00:00`));
            }}
          />
        </div>
        <div className="ber-field">
          <label htmlFor="ber-end">End date</label>
          <input
            id="ber-end"
            type="date"
            value={endYmd}
            onChange={(e) => {
              if (!e.target.value) return;
              setEndDate(new Date(`${e.target.value}T00:00:00`));
            }}
          />
        </div>
        <div className="ber-field">
          <label htmlFor="ber-plantation">Plantation</label>
          <select
            id="ber-plantation"
            value={plantationId}
            onChange={(e) => setPlantationId(e.target.value)}
            disabled={loadingPlantations}
          >
            <option value="">Select plantation…</option>
            {plantations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ber-field">
          <label htmlFor="ber-estates">Estates (optional)</label>
          <select
            id="ber-estates"
            multiple
            value={selectedEstates.map(String)}
            onChange={(e) =>
              setSelectedEstates(
                Array.from(e.target.selectedOptions).map((o) => o.value)
              )
            }
            disabled={!plantationId || loadingEstates}
          >
            {(estates || []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ber-field">
          <label htmlFor="ber-mission">Mission</label>
          <select
            id="ber-mission"
            value={missionType}
            onChange={(e) => setMissionType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="spy">Spray</option>
            <option value="spd">Spread</option>
          </select>
        </div>
        <div className="ber-actions">
          <button
            type="button"
            className="ber-btn"
            onClick={handleGenerate}
            disabled={!canGenerate}
          >
            {loadingReport ? 'Loading…' : 'Generate'}
          </button>
          <button
            type="button"
            className="ber-btn ghost"
            onClick={downloadExcel}
            disabled={!fieldRows.length}
          >
            <FiDownload aria-hidden /> Excel
          </button>
        </div>
      </div>

      <p className="ber-note">
        <strong>How Billing Ha is calculated:</strong>{' '}
        Sprayed Ha uses Day End <em>DJI Field Area</em>. If there is a chargeable ops
        reason and Bill = Yes, Billing Ha = full Field Ha; otherwise Billing Ha = DJI
        sprayed Ha. Manager-canceled plans (no chargeable ops reason) are excluded from
        billing totals.
      </p>

      {loadingReport ? (
        <div className="ber-loading">
          <Bars color="#004b71" height={36} width={36} />
          <p>Loading billable extents…</p>
        </div>
      ) : null}

      {error ? (
        <div className="ber-error">
          {error?.data?.message || error?.error || 'Failed to load report'}
        </div>
      ) : null}

      {summary ? (
        tablesBlock
      ) : !loadingReport && !error ? (
        <div className="ber-empty">
          Select plantation and dates, then Generate to view billable extents.
        </div>
      ) : null}
    </div>
  );
}
