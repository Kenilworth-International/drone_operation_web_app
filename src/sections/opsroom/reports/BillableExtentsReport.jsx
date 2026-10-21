import React, { useEffect, useMemo, useState } from 'react';
import { Bars } from 'react-loader-spinner';
import { FiDownload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import {
  useGetBillableExtentsPlantationsQuery,
  useLazyGetBillableExtentsEstatesQuery,
  useLazyGetBillableExtentsReportQuery,
} from '../../../api/services NodeJs/billableExtentsReportApi';
import '../../../styles/billableExtentsReport.css';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

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

export default function BillableExtentsReport() {
  const { data: plantations = [], isLoading: loadingPlantations } =
    useGetBillableExtentsPlantationsQuery();
  const [fetchEstates, { data: estates = [], isFetching: loadingEstates }] =
    useLazyGetBillableExtentsEstatesQuery();
  const [fetchReport, { data: report, isFetching: loadingReport, error }] =
    useLazyGetBillableExtentsReportQuery();

  const [startDate, setStartDate] = useState(monthStartKey);
  const [endDate, setEndDate] = useState(todayKey);
  const [plantationId, setPlantationId] = useState('');
  const [selectedEstates, setSelectedEstates] = useState([]);
  const [missionType, setMissionType] = useState('all');
  const [tab, setTab] = useState('field');

  useEffect(() => {
    if (!plantationId) {
      setSelectedEstates([]);
      return;
    }
    fetchEstates(Number(plantationId));
    setSelectedEstates([]);
  }, [plantationId, fetchEstates]);

  const canGenerate =
    Boolean(startDate) && Boolean(endDate) && Boolean(plantationId) && !loadingReport;

  const handleGenerate = () => {
    if (!canGenerate) return;
    fetchReport({
      start_date: startDate,
      end_date: endDate,
      plantation_id: Number(plantationId),
      estates: selectedEstates.map(Number),
      mission_type: missionType,
    });
  };

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
    XLSX.writeFile(
      wb,
      `Billable_Extents_${startDate}_${endDate}.xlsx`
    );
  };

  const plantationRows = useMemo(() => report?.by_plantation || [], [report]);
  const estateRows = useMemo(() => report?.by_estate || [], [report]);
  const fieldRows = useMemo(() => report?.fields || [], [report]);

  return (
    <div className="ber-page">
      <div className="ber-filters">
        <div className="ber-field">
          <label htmlFor="ber-start">Start date</label>
          <input
            id="ber-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="ber-field">
          <label htmlFor="ber-end">End date</label>
          <input
            id="ber-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
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
        <>
          <div className="ber-kpis">
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
          </div>

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
            <div className="ber-table-wrap">
              <table className="ber-table">
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
            <div className="ber-table-wrap">
              <table className="ber-table">
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
            <div className="ber-table-wrap">
              <table className="ber-table">
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
      ) : !loadingReport && !error ? (
        <div className="ber-empty">
          Select plantation and dates, then Generate to view billable extents.
        </div>
      ) : null}
    </div>
  );
}
