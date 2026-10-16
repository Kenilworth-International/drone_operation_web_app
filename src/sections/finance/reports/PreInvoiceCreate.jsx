import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Bars } from 'react-loader-spinner';
import { FiCalendar, FiSend, FiRefreshCw } from 'react-icons/fi';
import {
  useLazyGetPlantationsListQuery,
  useLazyGetEstatesListQuery,
} from '../../../api/services NodeJs/plantationDashboardApi';
import { useGetPlantationPreInvoiceDraftMutation } from '../../../api/services NodeJs/plantationInvoiceApi';
import CreatePlantationInvoiceModal from './CreatePlantationInvoiceModal';
import '../../../styles/finance.css';
import '../../../styles/workSummary.css';
import '../../../styles/plantationInvoice.css';
import '../../../styles/invoiceFlows.css';

const DEFAULT_HA_PER_PLAN = 15;

const extractListData = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
};

const currentMonthValue = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
};

const monthToRange = (monthValue) => {
  const [y, m] = String(monthValue || '').split('-').map(Number);
  if (!y || !m) return { start: null, end: null };
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
};

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PreInvoiceCreate({ onInvoicePreview }) {
  const [triggerPlantationsList] = useLazyGetPlantationsListQuery();
  const [triggerEstatesList] = useLazyGetEstatesListQuery();
  const [fetchPreDraft, { isLoading: draftLoading }] = useGetPlantationPreInvoiceDraftMutation();

  const [plantations, setPlantations] = useState([]);
  const [selectedPlantation, setSelectedPlantation] = useState('');
  const [estates, setEstates] = useState([]);
  const [selectedEstates, setSelectedEstates] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [haPerPlan, setHaPerPlan] = useState(String(DEFAULT_HA_PER_PLAN));
  const [previewDraft, setPreviewDraft] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const { start: periodStart, end: periodEnd } = useMemo(
    () => monthToRange(selectedMonth),
    [selectedMonth]
  );

  useEffect(() => {
    const load = async () => {
      setListLoading(true);
      try {
        const result = await triggerPlantationsList(undefined, true);
        setPlantations(extractListData(result?.data));
      } catch {
        setPlantations([]);
      } finally {
        setListLoading(false);
      }
    };
    load();
  }, [triggerPlantationsList]);

  useEffect(() => {
    if (!selectedPlantation) {
      setEstates([]);
      setSelectedEstates([]);
      return;
    }
    const load = async () => {
      try {
        const result = await triggerEstatesList(selectedPlantation, true);
        const list = extractListData(result?.data);
        setEstates(list);
        setSelectedEstates(list.map((e) => Number(e.id)));
      } catch {
        setEstates([]);
        setSelectedEstates([]);
      }
    };
    load();
  }, [selectedPlantation, triggerEstatesList]);

  const toggleEstate = (id) => {
    const num = Number(id);
    setSelectedEstates((prev) =>
      prev.includes(num) ? prev.filter((x) => x !== num) : [...prev, num]
    );
  };

  const selectAllEstates = () => setSelectedEstates(estates.map((e) => Number(e.id)));
  const clearEstates = () => setSelectedEstates([]);

  const loadPreview = useCallback(async () => {
    if (!selectedPlantation || !selectedEstates.length || !periodStart || !periodEnd) {
      toast.error('Select plantation, at least one estate, and a month');
      return;
    }
    try {
      const data = await fetchPreDraft({
        plantation_id: Number(selectedPlantation),
        start_date: periodStart,
        end_date: periodEnd,
        estates: selectedEstates,
        ha_per_plan: Number(haPerPlan) || DEFAULT_HA_PER_PLAN,
      }).unwrap();
      setPreviewDraft(data);
    } catch (err) {
      setPreviewDraft(null);
      toast.error(err?.data?.message || err?.message || 'Failed to estimate pre-invoice');
    }
  }, [
    selectedPlantation,
    selectedEstates,
    periodStart,
    periodEnd,
    haPerPlan,
    fetchPreDraft,
  ]);

  const plantationName =
    plantations.find((p) => Number(p.id) === Number(selectedPlantation))?.plantation || '';

  const allSelected =
    estates.length > 0 && selectedEstates.length === estates.length;

  const activeConflict = previewDraft?.active_conflict || null;
  const canSend =
    Boolean(previewDraft?.line_items?.length) && !activeConflict && previewDraft?.can_create !== false;

  return (
    <div className="inv-flow-page pre-invoice-create">
      <div className="inv-panel inv-panel-pad" style={{ marginBottom: 16 }}>
        <div className="inv-toolbar">
          <div className="inv-toolbar-fields">
            <div className="inv-field">
              <label htmlFor="pre-inv-month">Billing month</label>
              <input
                id="pre-inv-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setPreviewDraft(null);
                }}
              />
            </div>
            <div className="inv-field" style={{ minWidth: 220 }}>
              <label htmlFor="pre-inv-plantation">Plantation</label>
              <select
                id="pre-inv-plantation"
                value={selectedPlantation}
                onChange={(e) => {
                  setSelectedPlantation(e.target.value);
                  setPreviewDraft(null);
                }}
                disabled={listLoading}
              >
                <option value="">Select plantation…</option>
                {plantations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plantation}
                  </option>
                ))}
              </select>
            </div>
            <div className="inv-field" style={{ minWidth: 120 }}>
              <label htmlFor="pre-inv-ha">Ha per plan</label>
              <input
                id="pre-inv-ha"
                type="number"
                min="0.01"
                step="0.01"
                value={haPerPlan}
                onChange={(e) => {
                  setHaPerPlan(e.target.value);
                  setPreviewDraft(null);
                }}
              />
            </div>
          </div>
          <div className="inv-toolbar-actions">
            <button
              type="button"
              className="inv-btn inv-btn--secondary"
              onClick={() => void loadPreview()}
              disabled={draftLoading || !selectedPlantation || !selectedEstates.length}
            >
              <FiRefreshCw />
              {draftLoading ? 'Estimating…' : 'Estimate'}
            </button>
            {canSend ? (
              <button
                type="button"
                className="inv-btn inv-btn--primary"
                onClick={() => setShowModal(true)}
              >
                <FiSend />
                Review &amp; send
              </button>
            ) : null}
          </div>
        </div>
        {activeConflict ? (
          <div className="inv-alert" style={{ marginTop: 12, marginBottom: 0 }}>
            Pre-invoice #{activeConflict.invoice_no} is already active for one or more of these estates
            in this period. Void it under <strong>Invoices &amp; Payments</strong> before sending again.
          </div>
        ) : null}
      </div>

      <div className="inv-pre-layout">
        <aside className="inv-panel inv-panel-pad inv-estate-panel">
          <div className="inv-estate-panel-head">
            <div>
              <h2 className="inv-section-title">Estates</h2>
              <p className="inv-section-sub" style={{ marginBottom: 0 }}>
                Full plantation or a subset
              </p>
            </div>
            {estates.length > 0 ? (
              <div className="inv-estate-actions">
                <button type="button" className="inv-btn inv-btn--ghost" onClick={selectAllEstates}>
                  All
                </button>
                <button type="button" className="inv-btn inv-btn--ghost" onClick={clearEstates}>
                  Clear
                </button>
              </div>
            ) : null}
          </div>

          {!selectedPlantation ? (
            <p className="inv-estate-count">Select a plantation to load estates.</p>
          ) : estates.length === 0 ? (
            <p className="inv-estate-count">No estates found for this plantation.</p>
          ) : (
            <>
              <div className="inv-estate-list">
                {estates.map((e) => {
                  const on = selectedEstates.includes(Number(e.id));
                  return (
                    <label
                      key={e.id}
                      className={`inv-estate-item${on ? ' inv-estate-item--on' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          toggleEstate(e.id);
                          setPreviewDraft(null);
                        }}
                      />
                      <span>{e.estate}</span>
                    </label>
                  );
                })}
              </div>
              <p className="inv-estate-count">
                {selectedEstates.length} of {estates.length} selected
                {allSelected ? ' · full plantation' : ''}
              </p>
            </>
          )}
        </aside>

        <section className="inv-panel inv-panel-pad">
          {draftLoading ? (
            <div className="inv-loading">
              <Bars height={40} width={40} color="#1d4ed8" ariaLabel="loading" />
            </div>
          ) : previewDraft ? (
            <>
              <h2 className="inv-section-title">Estimate summary</h2>
              <p className="inv-section-sub">
                {plantationName} · {periodStart} to {periodEnd} · plans × {formatMoney(previewDraft.ha_per_plan)}{' '}
                Ha
              </p>

              <div className="inv-kpi-grid">
                <div className="inv-kpi">
                  <div className="inv-kpi-label">Scheduled plans</div>
                  <div className="inv-kpi-value">{previewDraft.plan_count ?? 0}</div>
                </div>
                <div className="inv-kpi">
                  <div className="inv-kpi-label">Ha per plan</div>
                  <div className="inv-kpi-value">{formatMoney(previewDraft.ha_per_plan)}</div>
                </div>
                <div className="inv-kpi inv-kpi--teal">
                  <div className="inv-kpi-label">Estimated Ha</div>
                  <div className="inv-kpi-value">{formatMoney(previewDraft.estimated_ha)}</div>
                </div>
                <div className="inv-kpi inv-kpi--accent">
                  <div className="inv-kpi-label">Subtotal</div>
                  <div className="inv-kpi-value">
                    <small>LKR</small>
                    {formatMoney(previewDraft.subtotal)}
                  </div>
                </div>
              </div>

              {(previewDraft.billing_ha_by_estate || []).length ? (
                <div className="inv-table-wrap">
                  <table className="inv-table">
                    <thead>
                      <tr>
                        <th>Estate</th>
                        <th className="num">Plans</th>
                        <th className="num">Spray Ha</th>
                        <th className="num">Spread Ha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewDraft.billing_ha_by_estate.map((row) => (
                        <tr key={row.estate_id}>
                          <td>{row.estate_name || '-'}</td>
                          <td className="num">{row.plan_count ?? 0}</td>
                          <td className="num">{formatMoney(row.Spray)}</td>
                          <td className="num">{formatMoney(row.Spread)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="inv-alert">
                  No scheduled plans found for this month and estate selection. Adjust the month or estates
                  before sending a pre-invoice.
                </div>
              )}
            </>
          ) : (
            <div className="inv-empty">
              <div className="inv-empty-icon" aria-hidden>
                <FiCalendar />
              </div>
              <strong>Ready to estimate</strong>
              <p>
                Choose a plantation and estates, set Ha per plan, then click Estimate to preview the
                advance invoice lines.
              </p>
            </div>
          )}
        </section>
      </div>

      <CreatePlantationInvoiceModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(inv) => {
          setShowModal(false);
          onInvoicePreview?.(inv);
        }}
        mode="pre"
        haPerPlan={Number(haPerPlan) || DEFAULT_HA_PER_PLAN}
        onHaPerPlanChange={(v) => setHaPerPlan(String(v))}
        plantationId={Number(selectedPlantation) || null}
        plantationName={plantationName}
        estateIds={selectedEstates}
        startDate={periodStart}
        endDate={periodEnd}
      />
    </div>
  );
}
