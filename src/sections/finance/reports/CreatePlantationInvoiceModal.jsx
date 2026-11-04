import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  useGetInvoiceOrganizationsQuery,
  useGetInvoiceTaxTypesQuery,
  useGetPlantationInvoiceDraftMutation,
  useGetPlantationPreInvoiceDraftMutation,
  useGetPlantationFinalInvoiceDraftMutation,
  useCreatePlantationInvoiceMutation,
  useLazyGetPlantationInvoiceByIdQuery,
} from '../../../api/services NodeJs/plantationInvoiceApi';
import { useGetFuelCategoriesQuery } from '../../../api/services/assetsApi';
import '../../../styles/plantationInvoice.css';
import '../../../styles/invoiceFlows.css';
import { mergeDraftWithWorkSummaryLines } from './plantationInvoiceLineItems';
import {
  BASE_FUEL_PRICE,
  FUEL_LITERS_PER_HA,
  billingMonthFromPeriodEnd,
  applyFuelSurchargeToDraft,
  fuelSurchargeRatePerHa,
  isBillableServiceLine,
  sumInvoiceLinePlans,
  sumInvoiceLineHa,
} from './plantationInvoiceFuelSurcharge';

const formatMoney = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Prefer Petrol 92 (official code or name), else first priced category. */
function findDefaultFuelCategory(categories = []) {
  const list = Array.isArray(categories) ? categories : [];
  const byCode = list.find((c) => String(c.official_fuel_type_code || '') === 'petrol_92');
  if (byCode) return byCode;
  const byName = list.find((c) =>
    /petrol\s*92|92\s*octane|octane\s*92/i.test(String(c.category || ''))
  );
  if (byName) return byName;
  return list.find((c) => c.unit_price != null && c.unit_price !== '') || list[0] || null;
}

function fuelCategoryPrice(category) {
  const n = Number(category?.unit_price);
  return Number.isFinite(n) ? n : null;
}

function computePreviewTaxes(subtotal, taxTypes, selectedIds) {
  const selected = taxTypes.filter((t) => selectedIds.includes(Number(t.id)));
  const sorted = [...selected].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const lines = [];
  let taxTotal = 0;
  let running = subtotal;
  for (const tax of sorted) {
    const base = tax.apply_on === 'subtotal' ? subtotal : running;
    const taxAmount = Math.round(base * (Number(tax.rate_percent) / 100) * 100) / 100;
    lines.push({
      tax_type_id: tax.id,
      tax_name: tax.tax_name,
      rate_percent: tax.rate_percent,
      net_amount: Math.round(base * 100) / 100,
      tax_amount: taxAmount,
    });
    taxTotal = Math.round((taxTotal + taxAmount) * 100) / 100;
    running = Math.round((running + taxAmount) * 100) / 100;
  }
  return { tax_lines: lines, tax_total: taxTotal, total: Math.round((subtotal + taxTotal) * 100) / 100 };
}

/**
 * mode: 'post' (default / final from work summary), 'pre' (advance), 'final' (reconciled)
 */
export default function CreatePlantationInvoiceModal({
  open,
  onClose,
  onCreated,
  plantationId,
  plantationName,
  estateIds,
  startDate,
  endDate,
  missionFilter,
  workSummaryRows,
  estateMeta,
  mode = 'post',
  haPerPlan = 15,
  onHaPerPlanChange,
  linkedPreInvoiceId = null,
}) {
  const { data: organizations = [] } = useGetInvoiceOrganizationsQuery(undefined, { skip: !open });
  const { data: taxTypes = [] } = useGetInvoiceTaxTypesQuery(undefined, { skip: !open });
  const { data: fuelCategories = [] } = useGetFuelCategoriesQuery(undefined, { skip: !open });
  const [fetchDraft, { isLoading: postDraftLoading }] = useGetPlantationInvoiceDraftMutation();
  const [fetchPreDraft, { isLoading: preDraftLoading }] = useGetPlantationPreInvoiceDraftMutation();
  const [fetchFinalDraft, { isLoading: finalDraftLoading }] = useGetPlantationFinalInvoiceDraftMutation();
  const [createInvoice, { isLoading: saving }] = useCreatePlantationInvoiceMutation();
  const [loadInvoice] = useLazyGetPlantationInvoiceByIdQuery();

  const draftLoading = postDraftLoading || preDraftLoading || finalDraftLoading;
  const isPre = mode === 'pre';
  const isFinal = mode === 'final' || mode === 'post';

  const [draft, setDraft] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [overlayReady, setOverlayReady] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [selectedTaxIds, setSelectedTaxIds] = useState([]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [includeFuelSurcharge, setIncludeFuelSurcharge] = useState(false);
  const [selectedFuelCategoryId, setSelectedFuelCategoryId] = useState('');
  const [monthlyFuelPrice, setMonthlyFuelPrice] = useState('');
  const [fuelPriceSource, setFuelPriceSource] = useState('none');
  const [fuelSourceInvoiceNo, setFuelSourceInvoiceNo] = useState(null);
  const [billingMonth, setBillingMonth] = useState(null);
  const [localHaPerPlan, setLocalHaPerPlan] = useState(String(haPerPlan ?? 15));
  const fuelDefaultsAppliedRef = useRef(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const workSummaryRowsRef = useRef(workSummaryRows);
  workSummaryRowsRef.current = workSummaryRows;
  const estateMetaRef = useRef(estateMeta);
  estateMetaRef.current = estateMeta;

  const estateIdsKey = useMemo(
    () =>
      [...new Set((estateIds || []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))]
        .sort((a, b) => a - b)
        .join(','),
    [estateIds]
  );

  useEffect(() => {
    setLocalHaPerPlan(String(haPerPlan ?? 15));
  }, [haPerPlan, open]);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setLoadError(null);
      setOverlayReady(false);
      setSelectedFuelCategoryId('');
      setMonthlyFuelPrice('');
      setFuelPriceSource('none');
      setFuelSourceInvoiceNo(null);
      setIncludeFuelSurcharge(false);
      fuelDefaultsAppliedRef.current = false;
      return undefined;
    }
    const t = window.setTimeout(() => setOverlayReady(true), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !plantationId || !estateIdsKey) return undefined;

    const estates = estateIdsKey.split(',').map((v) => Number(v));
    let cancelled = false;

    const load = async () => {
      setLoadError(null);
      try {
        let data;
        if (isPre) {
          data = await fetchPreDraft({
            plantation_id: plantationId,
            start_date: startDate,
            end_date: endDate,
            estates,
            ha_per_plan: Number(localHaPerPlan) || 15,
          }).unwrap();
        } else if (mode === 'final') {
          data = await fetchFinalDraft({
            plantation_id: plantationId,
            start_date: startDate,
            end_date: endDate,
            estates,
            pre_invoice_id: linkedPreInvoiceId || undefined,
            mission_filter: missionFilter || 'all',
          }).unwrap();
          const rows = workSummaryRowsRef.current;
          if (rows?.length) {
            data = mergeDraftWithWorkSummaryLines(data, {
              rows,
              estateIds: estates,
              estateMeta: estateMetaRef.current,
              plantation: data?.plantation,
              missionFilter: missionFilter || 'all',
            });
          }
        } else {
          data = await fetchDraft({
            plantation_id: plantationId,
            start_date: startDate,
            end_date: endDate,
            estates,
            mission_filter: missionFilter || 'all',
          }).unwrap();
          data = mergeDraftWithWorkSummaryLines(data, {
            rows: workSummaryRowsRef.current,
            estateIds: estates,
            estateMeta: estateMetaRef.current,
            plantation: data?.plantation,
            missionFilter: missionFilter || 'all',
          });
        }

        if (cancelled) return;

        if (data?.active_conflict || data?.can_create === false) {
          const no = data?.active_conflict?.invoice_no;
          toast.error(
            no
              ? `Invoice #${no} is already active for these estates/period. Void it under Invoices & Payments first.`
              : 'An active invoice already exists for these estates/period. Void it first.',
            { autoClose: 8000 }
          );
        }

        const month = data?.billing_month || billingMonthFromPeriodEnd(endDate);
        const fuelCfg = data?.fuel_price_config || {};
        const histSource = String(fuelCfg.price_source || 'none');
        setBillingMonth(month);
        setDraft(data);
        setSelectedFuelCategoryId('');
        setFuelPriceSource(histSource);
        setFuelSourceInvoiceNo(fuelCfg.source_invoice_no || null);
        if (fuelCfg.fuel_price != null && fuelCfg.fuel_price !== '') {
          // Saved / previous billing price for this month — show and allow edit.
          setMonthlyFuelPrice(String(fuelCfg.fuel_price));
          setIncludeFuelSurcharge(true);
          fuelDefaultsAppliedRef.current = true;
        } else {
          setMonthlyFuelPrice('');
          setIncludeFuelSurcharge(false);
          fuelDefaultsAppliedRef.current = false;
        }
        setInvoiceNo(data?.suggested_invoice_no || '');
        const today = new Date().toISOString().slice(0, 10);
        setInvoiceDate(today);
        const due = new Date();
        due.setDate(due.getDate() + 10);
        setDueDate(due.toISOString().slice(0, 10));
      } catch (err) {
        if (cancelled) return;
        const msg = err?.data?.message || err?.message || 'Failed to build invoice draft';
        setLoadError(msg);
        toast.error(msg);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // localHaPerPlan is refreshed via Recalculate for pre; opening uses current value once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    plantationId,
    estateIdsKey,
    startDate,
    endDate,
    missionFilter,
    mode,
    linkedPreInvoiceId,
    fetchDraft,
    fetchPreDraft,
    fetchFinalDraft,
  ]);

  const reloadPreDraft = async () => {
    if (!isPre || !plantationId || !estateIds?.length) return;
    try {
      const data = await fetchPreDraft({
        plantation_id: plantationId,
        start_date: startDate,
        end_date: endDate,
        estates: estateIds,
        ha_per_plan: Number(localHaPerPlan) || 15,
      }).unwrap();
      setDraft(data);
      onHaPerPlanChange?.(Number(localHaPerPlan) || 15);
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to refresh pre-invoice draft');
    }
  };

  useEffect(() => {
    if (organizations.length && !organizationId) {
      setOrganizationId(String(organizations[0].id));
    }
  }, [organizations, organizationId]);

  useEffect(() => {
    if (taxTypes.length && selectedTaxIds.length === 0) {
      setSelectedTaxIds(taxTypes.map((t) => Number(t.id)));
    }
  }, [taxTypes, selectedTaxIds.length]);

  /**
   * Default fuel type = Petrol Octane 92.
   * Only fill price from current Fuel Prices master when this month has no saved/history price.
   */
  useEffect(() => {
    if (!open || !fuelCategories.length) return;

    const defaultCat = findDefaultFuelCategory(fuelCategories);
    if (!defaultCat) return;

    if (!selectedFuelCategoryId) {
      setSelectedFuelCategoryId(String(defaultCat.id));
    }

    const hasHistory =
      fuelPriceSource === 'monthly_table' || fuelPriceSource === 'invoice_history';
    if (hasHistory) {
      fuelDefaultsAppliedRef.current = true;
      return;
    }

    if (!fuelDefaultsAppliedRef.current && monthlyFuelPrice === '') {
      const cat =
        (selectedFuelCategoryId
          ? fuelCategories.find((c) => String(c.id) === String(selectedFuelCategoryId))
          : null) || defaultCat;
      const price = fuelCategoryPrice(cat);
      if (price != null) {
        setMonthlyFuelPrice(String(price));
        setFuelPriceSource('fuel_master');
        fuelDefaultsAppliedRef.current = true;
      }
    } else if (monthlyFuelPrice !== '') {
      fuelDefaultsAppliedRef.current = true;
    }
  }, [open, fuelCategories, selectedFuelCategoryId, monthlyFuelPrice, fuelPriceSource]);

  const fuelBasePrice = draft?.fuel_price_config?.base_fuel_price ?? BASE_FUEL_PRICE;
  const fuelLitersPerHa = draft?.fuel_price_config?.liters_per_ha ?? FUEL_LITERS_PER_HA;
  const selectedFuelCategory =
    fuelCategories.find((c) => String(c.id) === String(selectedFuelCategoryId)) || null;
  const fuelRatePreview = useMemo(() => {
    const price = Number(monthlyFuelPrice);
    if (!Number.isFinite(price)) return null;
    return fuelSurchargeRatePerHa(price, fuelBasePrice, fuelLitersPerHa);
  }, [monthlyFuelPrice, fuelBasePrice, fuelLitersPerHa]);

  const displayDraft = useMemo(() => {
    if (!draft) return null;
    const fuelPrice = Number(monthlyFuelPrice);
    return applyFuelSurchargeToDraft(draft, {
      enabled: includeFuelSurcharge && Number.isFinite(fuelPrice),
      fuelPrice,
      baseFuelPrice: fuelBasePrice,
      litersPerHa: fuelLitersPerHa,
    });
  }, [draft, includeFuelSurcharge, monthlyFuelPrice, fuelBasePrice, fuelLitersPerHa]);

  const preview = useMemo(() => {
    if (!displayDraft) return null;
    const subtotal = displayDraft.subtotal || 0;
    return computePreviewTaxes(subtotal, taxTypes, selectedTaxIds);
  }, [displayDraft, taxTypes, selectedTaxIds]);

  const prepaid = Number(draft?.prepaid_applied || 0);
  const priorCredit = Number(draft?.prior_credit_applied || 0);
  const coverage = Math.round((prepaid + priorCredit) * 100) / 100;
  const previewNet =
    preview && coverage > 0
      ? Math.round((preview.total - coverage) * 100) / 100
      : preview?.total;
  const isCreditNote =
    isFinal && coverage > 0 && Number.isFinite(previewNet) && previewNet < -0.009;

  const handleFuelCategoryChange = (e) => {
    const id = e.target.value;
    setSelectedFuelCategoryId(id);
    const cat = fuelCategories.find((c) => String(c.id) === String(id));
    const price = fuelCategoryPrice(cat);
    if (price != null) {
      setMonthlyFuelPrice(String(price));
      setFuelPriceSource('fuel_master');
      fuelDefaultsAppliedRef.current = true;
    }
  };

  const handleFuelPriceChange = (e) => {
    const raw = e.target.value;
    setMonthlyFuelPrice(raw);
    if (raw !== '') setFuelPriceSource('manual');
  };

  const handleFuelSurchargeToggle = (checked) => {
    setIncludeFuelSurcharge(checked);
    if (!checked) return;
    if (monthlyFuelPrice !== '') return;
    const cat =
      selectedFuelCategory || findDefaultFuelCategory(fuelCategories);
    const price = fuelCategoryPrice(cat);
    if (price != null) {
      setMonthlyFuelPrice(String(price));
      setFuelPriceSource('fuel_master');
      fuelDefaultsAppliedRef.current = true;
    }
  };

  const fuelPriceHint = useMemo(() => {
    const monthLabel = billingMonth ? billingMonth.slice(0, 7) : 'this month';
    if (fuelPriceSource === 'monthly_table') {
      return `Previous billing price saved for ${monthLabel} — edit if needed; creating the invoice updates it.`;
    }
    if (fuelPriceSource === 'invoice_history') {
      return fuelSourceInvoiceNo
        ? `Previous price from invoice #${fuelSourceInvoiceNo} (${monthLabel}) — editable.`
        : `Previous price from an invoice in ${monthLabel} — editable.`;
    }
    if (fuelPriceSource === 'manual') {
      return `Custom price for ${monthLabel} — saved when you create the invoice.`;
    }
    if (fuelPriceSource === 'fuel_master') {
      return `No saved price for ${monthLabel} yet — using current Fuel Prices (editable).`;
    }
    return `Enter the LKR/L price for ${monthLabel} (editable).`;
  }, [fuelPriceSource, fuelSourceInvoiceNo, billingMonth]);

  const toggleTax = (id) => {
    setSelectedTaxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (draft?.active_conflict || draft?.can_create === false) {
      const no = draft?.active_conflict?.invoice_no;
      toast.error(
        no
          ? `Invoice #${no} is already active. Void it under Invoices & Payments first.`
          : 'An active invoice already exists for these estates/period.'
      );
      return;
    }
    if (!organizationId) {
      toast.error('Select an organization');
      return;
    }
    const allowZeroSprayCredit =
      isCreditNote && coverage > 0.009 && !(displayDraft?.line_items?.length);
    if (!displayDraft?.line_items?.length && !allowZeroSprayCredit) {
      toast.error('No billable lines (check spray/spread rates and billing Ha)');
      return;
    }
    if (!draft?.plantation?.plantation_code) {
      toast.error('Set plantation code under Corporate Customer before creating invoices');
      return;
    }
    if (!selectedTaxIds.length) {
      toast.error('Select at least one tax');
      return;
    }
    if (includeFuelSurcharge) {
      const price = Number(monthlyFuelPrice);
      if (!Number.isFinite(price) || price < 0) {
        toast.error('Enter a valid fuel price (LKR / L) for the surcharge');
        return;
      }
    }

    try {
      const created = await createInvoice({
        invoice_no: invoiceNo,
        invoice_date: invoiceDate,
        due_date: dueDate,
        plantation_id: plantationId,
        organization_id: Number(organizationId),
        period_start: startDate,
        period_end: endDate,
        estates: estateIds,
        selected_tax_ids: selectedTaxIds,
        line_items: Array.isArray(displayDraft.line_items) ? displayDraft.line_items : [],
        invoice_type: isPre ? 'pre' : isCreditNote ? 'credit_note' : 'post',
        ha_per_plan: isPre ? Number(localHaPerPlan) || 15 : undefined,
        plan_count: isPre ? draft?.plan_count : undefined,
        estimated_ha: isPre ? draft?.estimated_ha : undefined,
        linked_pre_invoice_id:
          draft?.linked_pre_invoice?.id || linkedPreInvoiceId || undefined,
        prepaid_applied: draft?.prepaid_applied != null ? Number(draft.prepaid_applied) : undefined,
        fuel_surcharge: includeFuelSurcharge
          ? {
              billing_month: billingMonth,
              fuel_price: Number(monthlyFuelPrice),
            }
          : null,
      }).unwrap();

      toast.success(
        isPre ? 'Pre-invoice created' : isCreditNote ? 'Credit note created' : 'Final invoice created'
      );
      const full = await loadInvoice(created.id).unwrap();
      onCreated?.(full);
      onClose();
    } catch (err) {
      const body = err?.data?.data || err?.data || {};
      const conflictNo = body?.conflict?.invoice_no || err?.data?.conflict?.invoice_no;
      const msg =
        body?.message ||
        err?.data?.message ||
        err?.message ||
        'Failed to save invoice';
      toast.error(
        conflictNo
          ? `${msg} Open Invoices & Payments and void #${conflictNo} first.`
          : msg,
        { autoClose: 8000 }
      );
    }
  };

  if (!open) return null;

  const title = isPre
    ? 'Create Pre-Invoice (Advance)'
    : isCreditNote
      ? 'Create Credit Note'
      : mode === 'final'
        ? 'Create Final Invoice'
        : 'Create Tax Invoice';

  const activeConflict = draft?.active_conflict || null;
  const createBlocked = Boolean(activeConflict) || draft?.can_create === false;

  return (
    <div
      className="plantation-invoice-modal-overlay"
      role="presentation"
      onClick={() => {
        if (overlayReady) onCloseRef.current?.();
      }}
    >
      <div
        className="plantation-invoice-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="plantation-invoice-modal-header">
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              {plantationName} · {startDate} to {endDate}
            </p>
          </div>
          <button
            type="button"
            className="plantation-invoice-modal-close"
            onClick={() => onCloseRef.current?.()}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="plantation-invoice-modal-body">
          {draftLoading && !draft ? (
            <p>Loading invoice data…</p>
          ) : loadError && !draft ? (
            <div className="inv-callout inv-callout--warn" style={{ marginBottom: 0 }}>
              <div className="inv-callout-body">
                <strong>Could not load draft</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : !draft ? (
            <p>Loading invoice data…</p>
          ) : (
            <>
              {createBlocked ? (
                <div className="inv-callout inv-callout--warn" style={{ marginBottom: 14 }}>
                  <div className="inv-callout-body">
                    <strong>Cannot create - active document exists</strong>
                    <p>
                      {activeConflict?.invoice_no
                        ? `Invoice #${activeConflict.invoice_no} (${activeConflict.invoice_type || 'final'}) already covers these estates for this period. Void it under Invoices & Payments, then try again.`
                        : 'An active final invoice or credit note already exists for these estates/period. Void it first.'}
                    </p>
                  </div>
                </div>
              ) : null}

              {isPre ? (
                <div className="pre-invoice-basis-row">
                  <div className="pre-invoice-basis-field">
                    <label htmlFor="inv-plan-count">Monthly plans</label>
                    <input
                      id="inv-plan-count"
                      className="plantation-invoice-input-readonly"
                      value={draft.plan_count ?? 0}
                      readOnly
                    />
                  </div>
                  <div className="pre-invoice-basis-field pre-invoice-basis-field--ha">
                    <label htmlFor="inv-ha-per-plan">Ha per plan</label>
                    <input
                      id="inv-ha-per-plan"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={localHaPerPlan}
                      onChange={(e) => setLocalHaPerPlan(e.target.value)}
                    />
                  </div>
                  <div className="pre-invoice-basis-field pre-invoice-basis-field--action">
                    <label className="pre-invoice-basis-spacer" aria-hidden>
                      &nbsp;
                    </label>
                    <button
                      type="button"
                      className="plantation-invoice-btn plantation-invoice-btn-secondary"
                      onClick={() => void reloadPreDraft()}
                      disabled={draftLoading}
                    >
                      Recalculate
                    </button>
                  </div>
                  <div className="pre-invoice-basis-field">
                    <label htmlFor="inv-est-ha">Estimated Ha</label>
                    <input
                      id="inv-est-ha"
                      className="plantation-invoice-input-readonly"
                      value={formatMoney(draft.estimated_ha)}
                      readOnly
                    />
                  </div>
                </div>
              ) : null}

              {isFinal &&
              (draft.reconciliation || draft.linked_pre_invoice || priorCredit > 0) ? (
                <div
                  className={`inv-callout ${isCreditNote ? 'inv-callout--credit' : 'inv-callout--final'}`}
                  style={{ marginBottom: 14 }}
                >
                  <div className="inv-callout-body">
                    <strong>
                      {isCreditNote
                        ? 'Credit note (coverage exceeds sprayed work — not a tax invoice)'
                        : 'Advance / credit reconciliation'}
                    </strong>
                    {draft.linked_pre_invoice ? (
                      <p>
                        Linked pre-invoice #{draft.linked_pre_invoice.invoice_no} — prepaid LKR{' '}
                        {formatMoney(draft.prepaid_applied)}.
                      </p>
                    ) : (
                      <p>No matching same-month pre-invoice for this plantation / period / estates.</p>
                    )}
                    {priorCredit > 0 ? (
                      <p>
                        M-2 credit applied LKR {formatMoney(priorCredit)}
                        {Array.isArray(draft.prior_credits) && draft.prior_credits.length
                          ? ` (${draft.prior_credits
                              .map((c) => c.invoice_no)
                              .filter(Boolean)
                              .join(', ')})`
                          : ''}
                        . Jan overpayment settles in March (fixed 2-month lag). Refunds remain
                        available on the credit note.
                      </p>
                    ) : null}
                    {draft.reconciliation?.guidance ? (
                      <p>{draft.reconciliation.guidance}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="plantation-invoice-form-grid">
                <div>
                  <label htmlFor="inv-org">Organization</label>
                  <select
                    id="inv-org"
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                  >
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.org_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="inv-no">Invoice No</label>
                  <input
                    id="inv-no"
                    className="plantation-invoice-input-readonly"
                    value={invoiceNo}
                    readOnly
                    aria-readonly="true"
                    title="Format: YYMMM_CODE_#### (e.g. 26NOV_BTE_0001). Assigned on create."
                  />
                  {!draft?.plantation?.plantation_code ? (
                    <small style={{ color: '#b45309', display: 'block', marginTop: 4 }}>
                      Set plantation code under Corporate Customer before creating.
                    </small>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="inv-date">Invoice Date</label>
                  <input
                    id="inv-date"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="inv-due">Due Date</label>
                  <input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="plantation-invoice-taxes-fuel-section">
                <div className="plantation-invoice-taxes-fuel-row">
                  <div className="plantation-invoice-option-panel">
                    <div className="plantation-invoice-option-panel-title">Taxes</div>
                    <div className="plantation-invoice-option-panel-body plantation-invoice-tax-list">
                      {taxTypes.map((t) => (
                        <label key={t.id}>
                          <input
                            type="checkbox"
                            checked={selectedTaxIds.includes(Number(t.id))}
                            onChange={() => toggleTax(Number(t.id))}
                          />
                          <span>
                            {t.tax_name} ({Number(t.rate_percent).toFixed(2)}%)
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="plantation-invoice-option-panel">
                    <label className="plantation-invoice-option-panel-title plantation-invoice-fuel-title-toggle">
                      <input
                        type="checkbox"
                        checked={includeFuelSurcharge}
                        onChange={(e) => handleFuelSurchargeToggle(e.target.checked)}
                      />
                      <span>Fuel surcharge</span>
                    </label>
                    <div className="plantation-invoice-option-panel-body">
                      {includeFuelSurcharge ? (
                        <div className="plantation-invoice-fuel-fields">
                          <div className="plantation-invoice-fuel-price-row">
                            <label htmlFor="inv-fuel-type" className="plantation-invoice-fuel-price-label">
                              Fuel type
                            </label>
                            <select
                              id="inv-fuel-type"
                              className="plantation-invoice-fuel-type-select"
                              value={selectedFuelCategoryId}
                              onChange={handleFuelCategoryChange}
                            >
                              {!fuelCategories.length ? (
                                <option value="">No fuel prices in DB</option>
                              ) : null}
                              {fuelCategories.map((cat) => (
                                <option key={cat.id} value={String(cat.id)}>
                                  {cat.category}
                                  {cat.unit_price != null && cat.unit_price !== ''
                                    ? ` — ${formatMoney(cat.unit_price)}`
                                    : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="plantation-invoice-fuel-price-row">
                            <label htmlFor="inv-fuel-month" className="plantation-invoice-fuel-price-label">
                              Price (LKR / L)
                              <span className="plantation-invoice-fuel-month">
                                {' '}
                                · {billingMonth ? billingMonth.slice(0, 7) : 'month'}
                              </span>
                            </label>
                            <input
                              id="inv-fuel-month"
                              type="number"
                              min="0"
                              step="0.01"
                              className="plantation-invoice-fuel-price-input"
                              value={monthlyFuelPrice}
                              onChange={handleFuelPriceChange}
                              placeholder="e.g. 311"
                              title={fuelPriceHint}
                            />
                          </div>
                          <p className="plantation-invoice-fuel-hint plantation-invoice-fuel-hint--source">
                            {fuelPriceHint}
                          </p>
                          <p className="plantation-invoice-fuel-hint">
                            <strong>1 Ha needs {fuelLitersPerHa} L</strong>
                            {' · '}
                            Rate/Ha = (price − {formatMoney(fuelBasePrice)}) × {fuelLitersPerHa}
                            {fuelRatePreview != null ? (
                              <>
                                {' = '}
                                <strong>{formatMoney(fuelRatePreview)}</strong>
                              </>
                            ) : null}
                          </p>
                          <p className="plantation-invoice-panel-muted" style={{ marginTop: 6 }}>
                            Price is taken from Fuel Prices (fuel type). It cannot be edited on the invoice.
                          </p>
                        </div>
                      ) : (
                        <p className="plantation-invoice-panel-muted">
                          Uses Fuel Prices (default Petrol Octane 92). 1 Ha = {fuelLitersPerHa} L.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {!displayDraft?.line_items?.length ? (
                <p style={{ color: isCreditNote && coverage > 0 ? '#9a3412' : '#b45309' }}>
                  {isCreditNote && coverage > 0
                    ? 'No sprayed work this period — line items stay empty. Sending creates a Credit Note for the full prepaid / prior credit (not a tax invoice).'
                    : 'No invoice lines. Ensure plantation has spray/spread rates in Corporate Customers and billing Ha > 0 for selected estates.'}
                </p>
              ) : (
                <table className="plantation-invoice-preview-table">
                  <thead>
                    <tr>
                      <th>Activity</th>
                      {isPre ? <th className="num">Plans</th> : null}
                      <th className="num">Ha</th>
                      <th className="num">Rate (per Ha)</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayDraft.line_items.map((row, idx) => {
                      const isFuel = row.line_type === 'fuel_surcharge';
                      return (
                        <tr
                          key={`${row.estate_id ?? 'e'}-${row.mission_type}-${row.line_type || 'line'}-${idx}`}
                          className={isFuel ? 'plantation-invoice-fuel-row' : ''}
                        >
                          <td>
                            <div>{row.activity}</div>
                            <small style={{ color: '#64748b' }}>{row.description}</small>
                          </td>
                          {isPre ? (
                            <td className="num">
                              {isFuel || !isBillableServiceLine(row)
                                ? '—'
                                : row.plan_count != null
                                  ? Number(row.plan_count)
                                  : '—'}
                            </td>
                          ) : null}
                          <td className="num">{formatMoney(row.qty)}</td>
                          <td className="num">{formatMoney(row.rate)}</td>
                          <td className="num">{formatMoney(row.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="plantation-invoice-preview-totals-row">
                      <td>Total</td>
                      {isPre ? (
                        <td className="num">{sumInvoiceLinePlans(displayDraft.line_items)}</td>
                      ) : null}
                      <td className="num">{formatMoney(sumInvoiceLineHa(displayDraft.line_items))}</td>
                      <td />
                      <td className="num">{formatMoney(displayDraft.subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {preview ? (
                <div className="plantation-invoice-totals">
                  <div>
                    <span>Subtotal</span>
                    <span>{formatMoney(displayDraft.subtotal)}</span>
                  </div>
                  <div>
                    <span>Tax</span>
                    <span>{formatMoney(preview.tax_total)}</span>
                  </div>
                  <div>
                    <span>Total</span>
                    <span>LKR {formatMoney(preview.total)}</span>
                  </div>
                  {coverage > 0 ? (
                    <>
                      {prepaid > 0 ? (
                        <div>
                          <span>Prepaid (from pre-invoice)</span>
                          <span>− {formatMoney(prepaid)}</span>
                        </div>
                      ) : null}
                      {priorCredit > 0 ? (
                        <div>
                          <span>Prior credit (M-2)</span>
                          <span>− {formatMoney(priorCredit)}</span>
                        </div>
                      ) : null}
                      <div className="balance">
                        <span>{isCreditNote ? 'Credit amount' : 'Net balance due'}</span>
                        <span>LKR {formatMoney(Math.abs(previewNet || 0))}</span>
                      </div>
                    </>
                  ) : (
                    <div className="balance">
                      <span>Balance due</span>
                      <span>LKR {formatMoney(preview.total)}</span>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="plantation-invoice-modal-footer">
          <button
            type="button"
            className="plantation-invoice-btn plantation-invoice-btn-secondary"
            onClick={() => onCloseRef.current?.()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="plantation-invoice-btn plantation-invoice-btn-primary"
            disabled={
              saving ||
              draftLoading ||
              createBlocked ||
              Boolean(loadError) ||
              !draft?.plantation?.plantation_code ||
              (!(displayDraft?.line_items?.length) &&
                !(isCreditNote && coverage > 0.009))
            }
            onClick={handleCreate}
          >
            {saving
              ? 'Saving…'
              : isPre
                ? 'Send pre-invoice'
                : isCreditNote
                  ? 'Send credit note'
                  : 'Create final invoice'}
          </button>
        </footer>
      </div>
    </div>
  );
}
