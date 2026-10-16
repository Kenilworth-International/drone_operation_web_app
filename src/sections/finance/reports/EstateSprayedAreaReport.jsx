import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import '../../../styles/finance.css';
import '../../../styles/workSummary.css';
import '../../../styles/invoiceFlows.css';
import { useLazyGetFieldWiseFinanceReportQuery, useUpdatePlanFieldBillMutation } from '../../../api/services NodeJs/financeReportApi';
import { useLazyGetPlantationsListQuery, useLazyGetEstatesListQuery } from '../../../api/services NodeJs/plantationDashboardApi';
import {
    useSaveWorkSummaryBillingDraftMutation,
    useCreateWorkSummaryPdfDocumentMutation,
} from '../../../api/services NodeJs/financeWorkSummaryBillingApi';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Bars } from "react-loader-spinner";
import { FiRefreshCw, FiDownload, FiPrinter, FiFileText } from "react-icons/fi";
import CreatePlantationInvoiceModal from './CreatePlantationInvoiceModal';
import PlantationInvoicePrint from './PlantationInvoicePrint';
import EstateStatementPrint from './EstateStatementPrint';
import {
    buildWorkSummaryPdfDocument,
    buildPdfSnapshotLines,
    getWorkSummaryPdfFileName,
    formatWorkSummaryTitle,
} from './workSummaryPdfExport';
import {
    useGetPlantationFinalInvoiceDraftMutation,
    useGetInvoiceOrganizationsQuery,
    useGetInvoiceTaxTypesQuery,
} from '../../../api/services NodeJs/plantationInvoiceApi';
import { mergeDraftWithWorkSummaryLines } from './plantationInvoiceLineItems';
import {
    BASE_FUEL_PRICE,
    FUEL_LITERS_PER_HA,
    applyFuelSurchargeToDraft,
} from './plantationInvoiceFuelSurcharge';

/** Same 2dp rounding as the table; avoids false "issue" rows when floats differ only below display precision. */
const hasFinanceExtentIssue = (row) => {
    if (!row) return false;
    const land = Number((Number(row.landExtent) || 0).toFixed(2));
    const completed = Number((Number(row.fieldExtent) || 0).toFixed(2));
    return land < completed;
};

/** Bill full field Ha when all chargeable tasks have field_pilot_and_drones.bill = 1. */
const deriveBillIncluded = (tasks) => {
    const chargeable = (Array.isArray(tasks) ? tasks : []).filter(
        (t) => Number(t?.com_naration_chargeble) === 1
    );
    if (chargeable.length === 0) return true;
    return chargeable.every((t) => Number(t?.bill) === 1);
};

const isBillingIncluded = (row) => row?.billIncluded !== false;

const resolveBillingExtent = (row) => {
    if (row?.isManagerCanceled) return 0;
    const completed = Number(row.fieldExtent) || 0;
    if (!row.hasChargeableReason) return completed;
    const fullField = Number(row.landExtent) || 0;
    return isBillingIncluded(row) ? fullField : completed;
};

const MANAGER_CANCEL_EMPTY = '-';

const formatMetricCell = (row, value, { percent = false } = {}) => {
    if (row?.isManagerCanceled) return MANAGER_CANCEL_EMPTY;
    const num = Number(value) || 0;
    return percent ? `${num.toFixed(2)}%` : num.toFixed(2);
};

const billableRows = (rows) => (rows || []).filter((row) => !row?.isManagerCanceled);

const extractListData = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.data)) return payload.data;
    if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
    const numericKeys = Object.keys(payload).filter((k) => !isNaN(Number(k)));
    if (numericKeys.length > 0) {
        return numericKeys
            .sort((a, b) => Number(a) - Number(b))
            .map((k) => payload[k])
            .filter(Boolean);
    }
    return [];
};

const currentMonthValue = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
};

const monthToRange = (monthValue) => {
    const [y, m] = String(monthValue || '').split('-').map(Number);
    if (!y || !m) return { start: null, end: null };
    return {
        start: new Date(y, m - 1, 1),
        end: new Date(y, m, 0),
    };
};

const EstateSprayedAreaReport = ({ onInvoicePreview }) => {
    const [triggerFieldWiseFinanceReport] = useLazyGetFieldWiseFinanceReportQuery();
    const [triggerPlantationsList] = useLazyGetPlantationsListQuery();
    const [triggerEstatesList] = useLazyGetEstatesListQuery();
    const [plantations, setPlantations] = useState([]);
    const [selectedPlantation, setSelectedPlantation] = useState(null);
    const [estates, setEstates] = useState([]);
    const [selectedEstates, setSelectedEstates] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
    const [listLoading, setListLoading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [error, setError] = useState(null);

    const { start: periodStart, end: periodEnd } = useMemo(
        () => monthToRange(selectedMonth),
        [selectedMonth]
    );
    const estatesKey = useMemo(
        () => [...selectedEstates].sort((a, b) => a - b).join(','),
        [selectedEstates]
    );
    const [reportData, setReportData] = useState([]);
    const [reportTick, setReportTick] = useState(0);
    const processedData = [];
    const [selectedMissionType, setSelectedMissionType] = useState('all');
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoiceWorkSummaryRows, setInvoiceWorkSummaryRows] = useState([]);
    const [localPreviewInvoice, setLocalPreviewInvoice] = useState(null);
    const [estateStatement, setEstateStatement] = useState(null);
    const [estateStatementLoading, setEstateStatementLoading] = useState(false);
    const [fetchFinalDraft] = useGetPlantationFinalInvoiceDraftMutation();
    const { data: invoiceOrganizations = [] } = useGetInvoiceOrganizationsQuery();
    const { data: invoiceTaxTypes = [] } = useGetInvoiceTaxTypesQuery();
    const monthInputRef = useRef(null);

    const openMonthPicker = () => {
        const el = monthInputRef.current;
        if (!el) return;
        try {
            if (typeof el.showPicker === 'function') {
                el.showPicker();
            } else {
                el.focus();
            }
        } catch {
            el.focus();
        }
    };

    const [saveBillingDraft] = useSaveWorkSummaryBillingDraftMutation();
    const [createPdfDocument] = useCreateWorkSummaryPdfDocumentMutation();
    const [updatePlanFieldBill] = useUpdatePlanFieldBillMutation();

    const showInvoicePreview = (inv) => {
        if (onInvoicePreview) {
            onInvoicePreview(inv);
        } else {
            setLocalPreviewInvoice(inv);
        }
    };

    const getBillingContext = useCallback(() => {
        if (!selectedPlantation || !periodStart || !periodEnd) return null;
        return {
            plantation_id: selectedPlantation,
            start_date: periodStart.toLocaleDateString('en-CA'),
            end_date: periodEnd.toLocaleDateString('en-CA'),
            estates: selectedEstates,
            mission_filter: selectedMissionType,
        };
    }, [selectedPlantation, selectedMonth, selectedEstates, selectedMissionType, periodStart, periodEnd]);

    const buildDraftLineFromRow = (r) => ({
        plan_id: r.planId,
        field_id: r.fieldId,
        estate_id: r.estateId,
        field_name: r.fieldName,
        pilot_names: r.pilotNames,
        plan_date: r.date ? String(r.date).slice(0, 10) : null,
        mission_type: r.missionType,
        field_ha: r.landExtent,
        completed_ha: r.fieldExtent,
        covered_percent: r.coveredPercent,
        billing_ha_default: r.landExtent,
        reason_text: r.comNarration,
        has_chargeable_reason: 1,
        is_included: r.billIncluded ? 1 : 0,
    });

    const buildDraftLines = useCallback((rows) => {
        return (rows || [])
            .filter((r) => r.hasChargeableReason && !r.isManagerCanceled)
            .map((r) => buildDraftLineFromRow(r));
    }, []);

    const persistBillingDraft = useCallback(async (rows = reportData) => {
        const ctx = getBillingContext();
        if (!ctx || !rows.length) return;
        try {
            await saveBillingDraft({
                ...ctx,
                lines: buildDraftLines(rows),
            }).unwrap();
        } catch (e) {
            console.error('Failed to save billing draft', e);
            const msg =
                e?.data?.message ||
                e?.error ||
                e?.message ||
                'Failed to save billing draft';
            toast.warn(msg);
        }
    }, [getBillingContext, reportData, buildDraftLines, saveBillingDraft]);

    const getFilteredRows = () => {
        const rows = Array.isArray(reportData) ? reportData : [];
        return rows
            .filter((row) => {
                const missionMatch = selectedMissionType === 'all' || row.missionType === selectedMissionType;
                const isActivePlan = Number(row.planActivated ?? 1) === 1;
                return missionMatch && isActivePlan;
            })
            .map((row) => ({
                ...row,
                billingExtent: resolveBillingExtent(row),
                billingIncluded: isBillingIncluded(row),
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    const toggleBillingInclusion = async (row) => {
        if (!row?.hasChargeableReason || row?.isManagerCanceled) return;
        const planId = Number(row.planId);
        const fieldId = Number(row.fieldId);
        const nextBillIncluded = !row.billingIncluded;
        let snapshot = null;
        setReportData((prev) => {
            snapshot = prev;
            return prev.map((r) =>
                Number(r.planId) === planId && Number(r.fieldId) === fieldId
                    ? { ...r, billIncluded: nextBillIncluded }
                    : r
            );
        });
        try {
            const ctx = getBillingContext();
            const result = await updatePlanFieldBill({
                plan_id: planId,
                field_id: fieldId,
                bill: nextBillIncluded ? 1 : 0,
                ...(ctx
                    ? {
                          billing_draft: {
                              plantation_id: ctx.plantation_id,
                              start_date: ctx.start_date,
                              end_date: ctx.end_date,
                              estates: ctx.estates,
                              line: buildDraftLineFromRow({ ...row, billIncluded: nextBillIncluded }),
                          },
                      }
                    : {}),
            }).unwrap();
            if (result?.draft_sync_error) {
                toast.warn('Bill updated, but billing draft could not be saved. Ask ICT to run finance work summary billing SQL migration.');
            }
        } catch (e) {
            if (snapshot) setReportData(snapshot);
            console.error('Failed to update bill flag', e);
            toast.error('Could not update bill flag');
        }
    };

    const openInvoiceModal = async () => {
        const rowsForInvoice = getFilteredRows();
        await persistBillingDraft(reportData);
        setInvoiceWorkSummaryRows(rowsForInvoice);
        setShowInvoiceModal(true);
    };

    const computeIndicativeTaxes = (subtotal, taxTypes) => {
        const sorted = [...(taxTypes || [])].sort(
            (a, b) => Number(a.sort_order) - Number(b.sort_order)
        );
        let taxTotal = 0;
        let running = subtotal;
        const taxLines = [];
        for (const tax of sorted) {
            const base = tax.apply_on === 'subtotal' ? subtotal : running;
            const taxAmount = Math.round(base * (Number(tax.rate_percent) / 100) * 100) / 100;
            taxLines.push({
                tax_name: tax.tax_name,
                rate_percent: tax.rate_percent,
                tax_amount: taxAmount,
                net_amount: Math.round(base * 100) / 100,
            });
            taxTotal = Math.round((taxTotal + taxAmount) * 100) / 100;
            running = Math.round((running + taxAmount) * 100) / 100;
        }
        return {
            tax_lines: taxLines,
            tax_total: taxTotal,
            total: Math.round((subtotal + taxTotal) * 100) / 100,
        };
    };

    const openEstateStatement = async () => {
        if (!selectedPlantation || !selectedEstates.length || !periodStart || !periodEnd) {
            toast.error('Select plantation, estates, and month first');
            return;
        }
        setEstateStatementLoading(true);
        try {
            await persistBillingDraft(reportData);
            const rowsForStatement = getFilteredRows();
            let draft = await fetchFinalDraft({
                plantation_id: selectedPlantation,
                start_date: formatDateParam(periodStart),
                end_date: formatDateParam(periodEnd),
                estates: selectedEstates,
                mission_filter: selectedMissionType || 'all',
            }).unwrap();

            draft = mergeDraftWithWorkSummaryLines(draft, {
                rows: rowsForStatement,
                estateIds: selectedEstates,
                estateMeta: (Array.isArray(estates) ? estates : []).filter((e) =>
                    selectedEstates.includes(e.id)
                ),
                plantation: draft?.plantation,
                missionFilter: selectedMissionType || 'all',
            });

            const fuelCfg = draft?.fuel_price_config || {};
            const fuelPrice = Number(fuelCfg.fuel_price);
            const withFuel =
                Number.isFinite(fuelPrice)
                    ? applyFuelSurchargeToDraft(draft, {
                          enabled: true,
                          fuelPrice,
                          baseFuelPrice: fuelCfg.base_fuel_price ?? BASE_FUEL_PRICE,
                          litersPerHa: fuelCfg.liters_per_ha ?? FUEL_LITERS_PER_HA,
                      })
                    : draft;

            const org = invoiceOrganizations[0] || {};
            const taxes = computeIndicativeTaxes(withFuel.subtotal || 0, invoiceTaxTypes);
            const estateNames = (Array.isArray(estates) ? estates : [])
                .filter((e) => selectedEstates.includes(e.id))
                .map((e) => e.estate);
            const plantationName =
                (Array.isArray(plantations) ? plantations : []).find(
                    (p) => p.id === selectedPlantation
                )?.plantation ||
                draft?.plantation?.name ||
                '';

            setEstateStatement({
                document_kind: 'estate_statement',
                statement_ref: `ES-${selectedPlantation}-${String(formatDateParam(periodEnd)).replace(/-/g, '')}`,
                statement_date: new Date().toISOString().slice(0, 10),
                period_start: formatDateParam(periodStart),
                period_end: formatDateParam(periodEnd),
                plantation_name: plantationName,
                estate_names: estateNames,
                bill_to_address: draft?.plantation?.bill_to_address,
                ship_to_address: draft?.plantation?.ship_to_address,
                bill_to_lines: draft?.plantation?.bill_to_lines,
                ship_to_lines: draft?.plantation?.ship_to_lines,
                org_name: org.org_name,
                org_address: org.address,
                org_address_lines: null,
                telephone: org.telephone,
                email: org.email,
                logo_path: org.logo_path,
                line_items: withFuel.line_items || [],
                subtotal: withFuel.subtotal || 0,
                tax_total: taxes.tax_total,
                tax_lines: taxes.tax_lines,
                total: taxes.total,
            });
        } catch (err) {
            toast.error(err?.data?.message || err?.message || 'Failed to build estate statement');
        } finally {
            setEstateStatementLoading(false);
        }
    };

    useEffect(() => {
        const fetchPlantations = async () => {
            try {
                setListLoading(true);
                const result = await triggerPlantationsList(undefined, true);
                const data = extractListData(result?.data);
                setPlantations(data);
                setError(null);
            } catch (err) {
                setError("Failed to load plantations");
                console.error(err);
            } finally {
                setListLoading(false);
            }
        };
        fetchPlantations();
    }, []);
    useEffect(() => {
        const fetchEstates = async () => {
            if (selectedPlantation) {
                try {
                    setListLoading(true);
                    const result = await triggerEstatesList(selectedPlantation, true);
                    const data = extractListData(result?.data);
                    setEstates(data);
                    setSelectedEstates([]); // Reset selected estates
                    setReportData([]); // Clear previous report data
                    setError(null);
                } catch (err) {
                    setError("Failed to load estates");
                    console.error(err);
                } finally {
                    setListLoading(false);
                }
            }
        };
        fetchEstates();
    }, [selectedPlantation, triggerEstatesList]); // This effect runs when selectedPlantation changes

    useEffect(() => {
        if (selectedPlantation && selectedEstates.length > 0) return;
        setReportData((prev) => (prev.length === 0 ? prev : []));
    }, [selectedPlantation, selectedEstates.length]);

    useEffect(() => {
        if (!selectedPlantation || !estatesKey) return undefined;

        const { start, end } = monthToRange(selectedMonth);
        if (!start || !end) return undefined;

        const estateIds = estatesKey.split(',').map((id) => Number(id));
        let cancelled = false;

        const fetchReportData = async () => {
            try {
                setReportLoading(true);
                const startDate = start.toLocaleDateString('en-CA');
                const endDate = end.toLocaleDateString('en-CA');

                const result = await triggerFieldWiseFinanceReport(
                    {
                        start_date: startDate,
                        end_date: endDate,
                        estates: estateIds,
                    },
                    true
                );
                if (cancelled) return;

                const response = result.data;

                if (response && typeof response === 'object') {
                    if (response.status === false || response.status === 'false') {
                        setReportData((prev) => (prev.length === 0 ? prev : []));
                        setError(null);
                        setReportTick((t) => t + 1);
                        return;
                    }

                    const estatesData = Object.values(response).filter((item) => item.estate_id);
                    const nextRows = [];

                    estatesData.forEach((estate) => {
                        (estate.plans || []).forEach((plan) => {
                            (plan.fields || []).forEach((field) => {
                                let djiFieldArea = 0;
                                if (Array.isArray(field.task) && field.task.length > 0) {
                                    djiFieldArea = field.task.reduce(
                                        (sum, t) => sum + (Number(t.dji_field_area) || 0),
                                        0
                                    );
                                }
                                const comNarration = Array.from(
                                    new Set(
                                        (Array.isArray(field.task) ? field.task : [])
                                            .map((t) => t?.com_naration_reason)
                                            .filter((v) => v && String(v).trim() !== '')
                                    )
                                ).join(', ');
                                const hasChargeableReason = (Array.isArray(field.task) ? field.task : [])
                                    .some((t) => Number(t?.com_naration_chargeble) === 1);
                                const billIncluded = deriveBillIncluded(field.task);
                                const landExtent = Number(field.field_extent) || 0;
                                const coveredPercent = landExtent > 0
                                    ? (djiFieldArea / landExtent) * 100
                                    : 0;
                                const fieldCancelReasonId = Number(field.field_cancel_reason_id || 0);
                                const hasFieldManagerCancel = fieldCancelReasonId > 0;
                                const fieldCancelText = String(
                                    field.field_cancel_reason_text || ''
                                ).trim();
                                const managerCancelReasonId = Number(plan.manager_cancel_reason || 0);
                                const isPlanManagerCanceled = managerCancelReasonId > 0;
                                const managerCancelText = String(
                                    plan.manager_cancel_reason_text || ''
                                ).trim();
                                const isFullyManagerCanceledPlan =
                                    isPlanManagerCanceled &&
                                    !hasChargeableReason &&
                                    !hasFieldManagerCancel;
                                let displayReason = comNarration;
                                if (hasChargeableReason && comNarration) {
                                    displayReason = comNarration;
                                } else if (hasFieldManagerCancel) {
                                    displayReason = fieldCancelText;
                                } else if (isPlanManagerCanceled) {
                                    displayReason = managerCancelText;
                                }
                                nextRows.push({
                                    planId: Number(plan.plan_id) || 0,
                                    fieldId: Number(field.field_id) || 0,
                                    estateId: Number(estate.estate_id) || 0,
                                    estateName: estate.estate_name || '',
                                    planActivated: Number(plan.plan_activated ?? 1),
                                    date: plan.plan_date,
                                    fieldName: field.field_short_name || field.field_name || '',
                                    pilotNames: field.pilot_names?.map((p) => p.pilot_name).join(', ') || '',
                                    landExtent,
                                    fieldExtent: djiFieldArea,
                                    missionType: plan.mission_type_name,
                                    comNarration: displayReason,
                                    hasChargeableReason: isFullyManagerCanceledPlan
                                        ? false
                                        : hasChargeableReason,
                                    billIncluded,
                                    hasFieldManagerCancel,
                                    isManagerCanceled: isFullyManagerCanceledPlan,
                                    isPlanManagerCanceled,
                                    managerCancelReasonId,
                                    coveredPercent,
                                });
                            });
                        });
                    });

                    setReportData(nextRows);
                    setReportTick((t) => t + 1);
                    setError(null);
                } else {
                    setReportData((prev) => (prev.length === 0 ? prev : []));
                    setReportTick((t) => t + 1);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError('Failed to load report data');
                    console.error(err);
                }
            } finally {
                if (!cancelled) setReportLoading(false);
            }
        };

        fetchReportData();
        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- RTK lazy trigger is unstable
    }, [selectedPlantation, selectedMonth, estatesKey]);


    const handlePlantationSelect = (id) => {
        const nextId = Number(id) || null;
        if (!nextId || selectedPlantation === nextId) return;
        setSelectedPlantation(nextId);
        setSelectedEstates([]);
        setReportData([]);
    };

    const handlePlantationDropdownChange = (e) => {
        const value = e.target.value;
        if (!value) {
            setSelectedPlantation(null);
            setEstates([]);
            setSelectedEstates([]);
            setReportData([]);
            return;
        }
        handlePlantationSelect(Number(value));
    };

    const handleCheckboxChange = (estateId) => {
        setSelectedEstates(prev =>
            prev.includes(estateId)
                ? prev.filter(id => id !== estateId)
                : [...prev, estateId]
        );
    };

    const handleSelectAll = () => {
        const list = Array.isArray(estates) ? estates : [];
        setSelectedEstates(prev =>
            prev.length === list.length
                ? []
                : list.map(estate => estate.id)
        );
    };

    const plantationList = [...(Array.isArray(plantations) ? plantations : [])].sort((a, b) =>
        String(a.plantation || '').localeCompare(String(b.plantation || ''))
    );
    const safeEstates = Array.isArray(estates) ? estates : [];

    const exportToExcel = () => {
        if (!Array.isArray(reportData) || reportData.length === 0) return;

        const filteredData = getFilteredRows();

        if (filteredData.length === 0) return;

        // Calculate totals
        const billable = billableRows(filteredData);
        const totalLandExtent = billable.reduce((sum, row) => sum + row.landExtent, 0).toFixed(2);
        const totalFieldExtent = billable.reduce((sum, row) => sum + row.fieldExtent, 0).toFixed(2);
        const totalBillingExtent = billable.reduce((sum, row) => sum + (Number(row.billingExtent) || 0), 0).toFixed(2);

        const formattedData = filteredData.map((row) => {
            const planCol = formatPlanColumn(row);
            return {
            Plan: planCol.planLabel,
            Date: planCol.dateText,
            Estate: planCol.estateText,
            "Field Name": row.fieldName,
            "Field(Ha)": formatMetricCell(row, row.landExtent),
            "Completed(Ha)": formatMetricCell(row, row.fieldExtent),
            "Covered %": formatMetricCell(row, row.coveredPercent, { percent: true }),
            "Billing(Ha)": formatMetricCell(row, row.billingExtent),
            "Reason": row.comNarration || '-',
        };
        });

        // Add totals as the last row
        formattedData.push({
            Plan: "Total",
            Date: "",
            Estate: "",
            "Field Name": "",
            "Field(Ha)": totalLandExtent,
            "Completed(Ha)": totalFieldExtent,
            "Covered %": "",
            "Billing(Ha)": totalBillingExtent,
            "Reason": "",
        });

        const ws = XLSX.utils.json_to_sheet(formattedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Finance Report");
        // Helper to format date as YYYY-MM-DD
        const formatDate = (date) => {
            if (!date) return '';
            const d = new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        // Get selected estate names from estates array
        const excelEstateNames = (Array.isArray(estates) ? estates : [])
            .filter(e => selectedEstates.includes(e.id))
            .map(e => e.estate.replace(/\s+/g, '_'))
            .join('_') || 'All_Estates';
        XLSX.writeFile(wb, `Finance_Report_${excelEstateNames}_${selectedMonth}_${selectedMissionType}.xlsx`);
    };

    const exportPdf = async () => {
        const filteredData = getFilteredRows();

        if (filteredData.length === 0) return;

        const selectedPlantationData = (Array.isArray(plantations) ? plantations : []).find(
            (p) => p.id === selectedPlantation
        );
        const plantation = selectedPlantationData ? selectedPlantationData.plantation : 'N/A';
        const selectedEstateNames = (Array.isArray(estates) ? estates : [])
            .filter((estate) => selectedEstates.includes(estate.id))
            .map((estate) => estate.estate)
            .join(', ');

        let savedPdfId = null;
        const ctx = getBillingContext();
        if (ctx) {
            try {
                await persistBillingDraft(filteredData);
                const docMeta = await createPdfDocument({
                    ...ctx,
                    plantation_name: plantation,
                    estate_names: selectedEstateNames,
                    pdf_lines: buildPdfSnapshotLines(filteredData),
                }).unwrap();
                savedPdfId = docMeta?.pdf_id ?? null;
                if (savedPdfId) {
                    toast.info(formatWorkSummaryTitle(periodStart, savedPdfId));
                }
            } catch (e) {
                toast.warn('PDF will download, but billing history was not saved');
                console.error(e);
            }
        }

        const doc = buildWorkSummaryPdfDocument({
            plantation,
            estateNames: selectedEstateNames,
            periodStart,
            rows: filteredData,
            pdfId: savedPdfId,
        });

        const formatDateForPdf = (date) => {
            if (!date) return '';
            const d = new Date(date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const pdfEstateNames = (Array.isArray(estates) ? estates : [])
            .filter((e) => selectedEstates.includes(e.id))
            .map((e) => e.estate.replace(/\s+/g, '_'))
            .join('_') || 'All_Estates';
        const fallbackName = `Finance_Report_${pdfEstateNames}_${selectedMonth}_${selectedMissionType}.pdf`;
        doc.save(savedPdfId ? getWorkSummaryPdfFileName(savedPdfId) : fallbackName);
    };

    const exportIssuesPdf = () => {
        const filteredData = getFilteredRows();
        const issueRows = filteredData.filter(hasFinanceExtentIssue);
        if (issueRows.length === 0) return;

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 15;

        const logo = new Image();
        logo.src = '../../assets/images/kenilowrthlogoDark.png';
        doc.addImage(logo, 'PNG', 10, 10, 30, 30);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.text("Kenilworth International Lanka Pvt Ltd", pageWidth / 2, 25, { align: 'center' });
        doc.setFontSize(10);
        doc.text("7B , D.W Rupasinghe Mawatha, Nugegoda", pageWidth / 2, 30, { align: 'center' });

        const selectedPlantationData = (Array.isArray(plantations) ? plantations : []).find(p => p.id === selectedPlantation);
        const plantation = selectedPlantationData ? selectedPlantationData.plantation : "N/A";
        const selectedEstateNames = (Array.isArray(estates) ? estates : [])
            .filter(estate => selectedEstates.includes(estate.id))
            .map(estate => estate.estate)
            .join(", ");
        const monthYear = periodStart
            ? periodStart.toLocaleString('default', { month: 'long', year: 'numeric' })
            : selectedMonth;

        let currentY = 45;
        doc.text(`Plantation: ${plantation}`, marginX, currentY);
        currentY += 5;
        const estateText = `Estate: ${selectedEstateNames}`;
        const estateWrapped = doc.splitTextToSize(estateText, pageWidth - marginX * 2);
        doc.text(estateWrapped, marginX, currentY);
        currentY += estateWrapped.length * 5;
        doc.text(`Month: ${monthYear}`, marginX, currentY);
        currentY += 7;
        doc.text(`Field Wise Financial Report - Issues Only`, pageWidth / 2, currentY, { align: 'center' });

        const tableData = issueRows.map((row) => {
            const planCol = formatPlanColumn(row);
            const planCell = [planCol.planLabel, planCol.dateText, planCol.estateText]
                .filter(Boolean)
                .join('\n');
            return [
            planCell,
            row.fieldName,
            row.landExtent.toFixed(2),
            row.fieldExtent.toFixed(2),
            `${(Number(row.coveredPercent) || 0).toFixed(2)}%`,
            (Number(row.billingExtent) || 0).toFixed(2),
            row.comNarration || '-',
        ];
        });

        const totalLandExtent = issueRows.reduce((sum, row) => sum + row.landExtent, 0).toFixed(2);
        const totalFieldExtent = issueRows.reduce((sum, row) => sum + row.fieldExtent, 0).toFixed(2);
        const totalBillingExtent = issueRows.reduce((sum, row) => sum + (Number(row.billingExtent) || 0), 0).toFixed(2);
        tableData.push([
            'Total',
            '',
            totalLandExtent,
            totalFieldExtent,
            '',
            totalBillingExtent,
            ''
        ]);

        autoTable(doc, {
            head: [["Plan / Date", "Field Name", "Field(Ha)", "Completed(Ha)", "Covered %", "Billing(Ha)", "Reason"]],
            body: tableData,
            startY: currentY + 5,
            margin: { top: 20, bottom: 50 },
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 28 },
                1: { cellWidth: 24 },
                2: { cellWidth: 16, halign: 'right' },
                3: { cellWidth: 20, halign: 'right' },
                4: { cellWidth: 16, halign: 'right' },
                5: { cellWidth: 16, halign: 'right' },
                6: { cellWidth: 66 },
            },
            headStyles: {
                fillColor: [185, 28, 28],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            },
            didParseCell: (hookData) => {
                if (hookData.section === 'body') {
                    const isLastRow = hookData.row.index === tableData.length - 1;
                    if (isLastRow) {
                        hookData.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        const tableEndY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : currentY + 10;
        let footerStartY = tableEndY + 12;
        if (footerStartY + 40 > pageHeight - 10) {
            doc.addPage();
            footerStartY = 20;
        }
        doc.setFontSize(9);
        doc.text(
            "These rows have Field Extent less than Completed Extent. Please contact Ops room.",
            pageWidth / 2,
            footerStartY,
            { align: 'center' }
        );
        doc.setLineWidth(0.5);
        doc.line(15, footerStartY + 2, pageWidth - 15, footerStartY + 2);

        const sigY = footerStartY + 16;
        doc.text("Signature:", 16, sigY);
        doc.text("Name:", 16, sigY + 10);
        const rightColX = pageWidth - 90;
        doc.text("Stamp:", rightColX, sigY);
        doc.text("Date:", rightColX, sigY + 10);

        const pdfEstateNames = (Array.isArray(estates) ? estates : [])
            .filter(e => selectedEstates.includes(e.id))
            .map(e => e.estate.replace(/\s+/g, '_'))
            .join('_') || 'All_Estates';
        doc.save(`Finance_Report_Issues_${pdfEstateNames}_${selectedMonth}_${selectedMissionType}.pdf`);
    };

    // Helper to format date as YYYY-MM-DD (move above both exportToExcel and exportPdf)
    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const filteredRows = getFilteredRows();
    const resolveEstateName = (row) => {
        if (row.estateName) return row.estateName;
        const match = (Array.isArray(estates) ? estates : []).find((e) => e.id === row.estateId);
        return match?.estate || '';
    };

    const formatPlanColumn = (row) => {
        const safeDate = row?.date ? new Date(row.date) : null;
        const dateText =
            safeDate && !Number.isNaN(safeDate.getTime())
                ? safeDate.toLocaleDateString()
                : 'Invalid Date';
        return {
            planLabel: `${row.planId}-${row.missionType}`,
            dateText,
            estateText: resolveEstateName(row),
        };
    };

    const groupedRows = filteredRows.reduce((acc, row) => {
        const key = `${row.planId}__${row.date}__${row.missionType}__${row.estateId}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
    }, {});
    const issueRows = filteredRows.filter(hasFinanceExtentIssue);
    const hasIssues = issueRows.length > 0;
    const canCreateInvoice =
        selectedPlantation &&
        selectedEstates.length > 0 &&
        periodStart &&
        periodEnd &&
        filteredRows.length > 0 &&
        !hasIssues;

    const formatDateParam = (d) => d?.toLocaleDateString?.('en-CA') || '';

    return (
        <div className="finance finance-work-summary">
            <div className="top-finance-part-work-summary">
                <div className="finance-filters-row-work-summary">
                    <div className="finance-toolbar-filters-work-summary">
                        <div className="finance-month-filter-work-summary">
                            <label htmlFor="finance-month-select">Month</label>
                            <div className="finance-month-input-wrap-work-summary">
                                <input
                                    ref={monthInputRef}
                                    id="finance-month-select"
                                    className="finance-month-input-work-summary"
                                    type="month"
                                    value={selectedMonth}
                                    onClick={openMonthPicker}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            openMonthPicker();
                                        }
                                    }}
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        if (!next) return;
                                        setSelectedMonth(next);
                                    }}
                                    title="Choose month"
                                />
                            </div>
                        </div>
                        <div className="mission-filter-container-work-summary">
                            <label htmlFor="mission-type-filter">Mission Type</label>
                            <select
                                id="mission-type-filter"
                                value={selectedMissionType}
                                onChange={(e) => setSelectedMissionType(e.target.value)}
                            >
                                <option value="all">All</option>
                                <option value="Spray">Spray</option>
                                <option value="Spread">Spread</option>
                            </select>
                        </div>
                    </div>
                    <div className="download-buttons-work-summary">
                        {filteredRows.length > 0 && (
                                <button
                                    onClick={hasIssues ? undefined : exportToExcel}
                                    disabled={filteredRows.length === 0 || hasIssues}
                                    className="flex items-center bg-green-500 text-white"
                                    title={hasIssues ? 'Cannot download Excel while there are issue rows' : 'Download Excel'}
                                >
                                    <FiDownload />
                                    Excel
                                </button>
                            )}
                            {filteredRows.length > 0 && (
                                <button
                                    onClick={hasIssues ? undefined : exportPdf}
                                    disabled={filteredRows.length === 0 || hasIssues}
                                    className="flex items-center bg-red-600 text-white"
                                    title={hasIssues ? 'Cannot download work summary while there are issue rows' : formatWorkSummaryTitle(periodStart)}
                                >
                                    <FiPrinter />
                                    Work Summary
                                </button>
                            )}
                            {filteredRows.length > 0 && hasIssues && (
                                <button
                                    onClick={exportIssuesPdf}
                                    className="flex items-center bg-amber-600 text-white"
                                    title="Download issues-only PDF and contact Ops room"
                                >
                                    <FiPrinter />
                                    Issues PDF
                                </button>
                            )}
                            {canCreateInvoice && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => void openEstateStatement()}
                                        className="flex items-center"
                                        style={{
                                            background: '#0f766e',
                                            color: '#fff',
                                            border: '1px solid #0f766e',
                                        }}
                                        disabled={estateStatementLoading}
                                        title="Spraying details for estates - for information only, not a tax invoice"
                                    >
                                        <FiFileText />
                                        {estateStatementLoading ? 'Building…' : 'Estate statement'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openInvoiceModal}
                                        className="finance-btn-invoice-work-summary flex items-center"
                                        title="Create tax invoice from billing Ha (plantation payee)"
                                    >
                                        <FiFileText />
                                        Create Invoice
                                    </button>
                                </>
                        )}
                    </div>
                </div>
            </div>
            {hasIssues && (
                <div className="finance-issues-warning-work-summary">
                    These rows have Field Extent less than Completed Extent. Please download the issues-only PDF and contact Ops room.
                </div>
            )}


            <div className="bottom-finance-part-work-summary">
                <div className="bottom-finance-part-left-work-summary">
                    <label htmlFor="finance-plantation-select">Select Plantation</label>
                    <select
                        id="finance-plantation-select"
                        className="finance-field-select-work-summary"
                        value={selectedPlantation ?? ''}
                        onChange={handlePlantationDropdownChange}
                        disabled={listLoading && plantationList.length === 0}
                    >
                        <option value="">Choose plantation…</option>
                        {plantationList.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.plantation}
                            </option>
                        ))}
                    </select>

                    {selectedPlantation && safeEstates.length > 0 ? (
                        <div className="finance-estates-panel-work-summary" role="group" aria-labelledby="estate-selection">
                            <div className="finance-estates-panel-header-work-summary">
                                <span id="estate-selection" className="finance-estates-panel-title-work-summary">
                                    Estates
                                </span>
                                <label className="finance-select-all-inline-work-summary" htmlFor="select-all">
                                    <input
                                        type="checkbox"
                                        id="select-all"
                                        checked={
                                            safeEstates.length > 0 &&
                                            selectedEstates.length === safeEstates.length
                                        }
                                        onChange={handleSelectAll}
                                    />
                                    Select all
                                </label>
                            </div>
                            <div className="finance-estates-list-work-summary">
                                {safeEstates.map((estate) => (
                                    <div key={estate.id} className="estate-item-fin-work-summary">
                                        <input
                                            type="checkbox"
                                            id={`estate-${estate.id}`}
                                            checked={selectedEstates.includes(estate.id)}
                                            onChange={() => handleCheckboxChange(estate.id)}
                                        />
                                        <label htmlFor={`estate-${estate.id}`}>{estate.estate}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : selectedPlantation ? (
                        <p className="finance-panel-hint-work-summary">No estates for this plantation</p>
                    ) : (
                        <p className="finance-panel-hint-work-summary">Choose a plantation to see estates</p>
                    )}
                </div>

                <div className="bottom-finance-part-right-work-summary">
                        {reportLoading && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                            <Bars
                                height="80"
                                width="80"
                                color="#4180B9"
                                ariaLabel="bars-loading"
                                visible={true}
                            />
                        </div>}
                        {error && <div className="error-message">{error}</div>}

                        {!selectedPlantation || selectedEstates.length === 0 ? (
                            <div className="finance-report-placeholder-work-summary">
                                {!selectedPlantation
                                    ? 'Select a plantation and estate(s) to view the report'
                                    : 'Select at least one estate to load the report'}
                            </div>
                        ) : !reportLoading && !error && (
                            filteredRows.length > 0 ? (
                                <div className="finance-table-container">
                                    <table className="finance-report-table">
                                        <thead>
                                            <tr>
                                                <th>Plan</th>
                                                <th>Field Name</th>
                                                <th>Pilot Name</th>
                                                <th>Field(Ha)</th>
                                                <th>Completed(Ha)</th>
                                                <th>Covered %</th>
                                                <th>Billing(Ha)</th>
                                                <th>Bill</th>
                                                <th>Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(groupedRows).flatMap(([key, rows]) => {
                                                const firstRow = rows[0];
                                                const planCol = formatPlanColumn(firstRow);

                                                return rows.map((row, idx) => {
                                                    const isIssue = !row.isManagerCanceled && hasFinanceExtentIssue(row);
                                                    return (
                                                        <tr
                                                            key={`${key}-${idx}`}
                                                            className={row.isManagerCanceled ? 'finance-manager-cancel-row' : undefined}
                                                        >
                                                            {idx === 0 && (
                                                                <td rowSpan={rows.length}>
                                                                    <div><strong>{planCol.planLabel}</strong></div>
                                                                    <div>{planCol.dateText}</div>
                                                                    {planCol.estateText ? (
                                                                        <div>{planCol.estateText}</div>
                                                                    ) : null}
                                                                </td>
                                                            )}
                                                            <td>{row.fieldName}</td>
                                                            <td>{row.pilotNames}</td>
                                                            <td className={isIssue ? 'finance-issue-cell' : ''}>
                                                                {formatMetricCell(row, row.landExtent)}
                                                            </td>
                                                            <td className={isIssue ? 'finance-issue-cell' : ''}>
                                                                {formatMetricCell(row, row.fieldExtent)}
                                                            </td>
                                                            <td>
                                                                {formatMetricCell(row, row.coveredPercent, { percent: true })}
                                                            </td>
                                                            <td className={row.hasChargeableReason && !row.billingIncluded ? 'finance-billing-excluded-cell' : ''}>
                                                                {formatMetricCell(row, row.billingExtent)}
                                                            </td>
                                                            <td>
                                                                {row.isManagerCanceled ? (
                                                                    '-'
                                                                ) : row.hasChargeableReason ? (
                                                                    <label className="finance-bill-toggle" title={row.billingIncluded ? 'Bill full field (Ha) - click to bill completed only' : 'Bill completed (Ha) only - click to bill full field'}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={row.billingIncluded}
                                                                            onChange={() => toggleBillingInclusion(row)}
                                                                        />
                                                                        <span>{row.billingIncluded ? 'Yes' : 'No'}</span>
                                                                    </label>
                                                                ) : (
                                                                    '-'
                                                                )}
                                                            </td>
                                                            <td>{row.comNarration || '-'}</td>
                                                        </tr>
                                                    );
                                                });
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan="3"><strong>Total</strong></td>
                                                <td>
                                                    <strong>
                                                        {billableRows(filteredRows)
                                                            .reduce((sum, row) => sum + row.landExtent, 0)
                                                            .toFixed(2)}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <strong>
                                                        {billableRows(filteredRows)
                                                            .reduce((sum, row) => sum + row.fieldExtent, 0)
                                                            .toFixed(2)}
                                                    </strong>
                                                </td>
                                                <td></td>
                                                <td>
                                                    <strong>
                                                        {billableRows(filteredRows)
                                                            .reduce((sum, row) => sum + (Number(row.billingExtent) || 0), 0)
                                                            .toFixed(2)}
                                                    </strong>
                                                </td>
                                                <td></td>
                                                <td></td>
                                            </tr>
                                        </tfoot>

                                    </table>
                                </div>
                            ) : (
                                <div className="no-data-message">
                                    No data available for selected criteria
                                </div>
                            )
                        )}

                    </div>
            </div>

            {!onInvoicePreview && localPreviewInvoice ? (
                <PlantationInvoicePrint
                    invoice={localPreviewInvoice}
                    variant="preview"
                    onClose={() => setLocalPreviewInvoice(null)}
                />
            ) : null}

            <CreatePlantationInvoiceModal
                open={showInvoiceModal}
                onClose={() => setShowInvoiceModal(false)}
                onCreated={(inv) => {
                    setShowInvoiceModal(false);
                    showInvoicePreview(inv);
                }}
                mode="final"
                plantationId={selectedPlantation}
                plantationName={
                    plantations.find((p) => p.id === selectedPlantation)?.plantation || ''
                }
                estateIds={selectedEstates}
                estateMeta={(Array.isArray(estates) ? estates : []).filter((e) =>
                    selectedEstates.includes(e.id)
                )}
                workSummaryRows={invoiceWorkSummaryRows}
                startDate={formatDateParam(periodStart)}
                endDate={formatDateParam(periodEnd)}
                missionFilter={selectedMissionType}
            />

            {estateStatement ? (
                <EstateStatementPrint
                    statement={estateStatement}
                    onClose={() => setEstateStatement(null)}
                />
            ) : null}
        </div>
    );
};

export default EstateSprayedAreaReport;

